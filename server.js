import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Force Google DNS to fix broken SRV lookups on some networks
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "coaching-center";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev_only";

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────
// Mongoose Schemas — strict: false so frontend extra fields
// are preserved and don't cause silent data loss
// ─────────────────────────────────────────────────────────

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    coachingName: String,
    address: String,
    phone: String,
    logo: String,
    feeDueDay: Number,
    subjects: [String],
    gradeBoundaries: {
      aPlus: Number,
      a: Number,
      b: Number,
      c: Number,
      d: Number,
    },
    academicYear: String,
    templates: {
      feeReminder: String,
      scoreReport: String,
    },
  },
  { strict: false, timestamps: true },
);

const studentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    studentId: String,
    fullName: String,
    fatherName: String,
    motherName: String,
    dateOfBirth: String,
    gender: String,
    contactNumber: String,
    parentWhatsapp: String,
    email: String,
    address: String,
    photo: String,
    admissionDate: String,
    classGrade: String,
    subjects: [String],
    batchId: String,
    totalCourseFee: Number,
    monthlyFeeAmount: Number,
    discount: Number,
    feeDueDay: Number,
  },
  { strict: false, timestamps: true },
);
studentSchema.index({ batchId: 1 });

const batchSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    timing: String,
    days: [String],
    maxStudents: Number,
    teacher: String,
  },
  { strict: false, timestamps: true },
);

const feeRecordSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    monthKey: String,
    amountDue: Number,
    amountPaid: Number,
    dueDate: String,
    paymentDate: String,
    mode: String,
    remarks: String,
    status: String,
  },
  { strict: false, timestamps: true },
);
feeRecordSchema.index({ studentId: 1 });
feeRecordSchema.index({ status: 1 });

const testSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    batchId: String,
    subject: String,
    testName: String,
    testDate: String,
    maxMarks: Number,
    marksObtained: Number,
    remarks: String,
    grade: String,
    performanceTag: String,
  },
  { strict: false, timestamps: true },
);
testSchema.index({ studentId: 1 });

const notificationLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    date: String,
    type: String,
    message: String,
    status: String,
  },
  { strict: false, timestamps: true },
);
notificationLogSchema.index({ studentId: 1 });

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "student"], required: true },
    studentId: { type: String }, // For students, links to Student.id
  },
  { timestamps: true }
);

const Settings = mongoose.model("Setting", settingsSchema);
const Student = mongoose.model("Student", studentSchema);
const Batch = mongoose.model("Batch", batchSchema);
const FeeRecord = mongoose.model("FeeRecord", feeRecordSchema);
const Test = mongoose.model("Test", testSchema);
const NotificationLog = mongoose.model("NotificationLog", notificationLogSchema);
const User = mongoose.model("User", userSchema);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const defaultSubjects = ["Maths", "Science", "English", "Physics", "Chemistry", "Biology", "History", "Geography"];
const uid = () => crypto.randomUUID();
const monthKeyFromDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function createCycleBoundary(year, monthIndex, dayOfMonth) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

function buildFeeRecord(student, date, overrides = {}) {
  return {
    id: uid(),
    studentId: student.id,
    monthKey: monthKeyFromDate(date),
    amountDue: student.monthlyFeeAmount,
    amountPaid: 0,
    dueDate: createCycleBoundary(date.getFullYear(), date.getMonth(), Number(student.feeDueDay || 1)).toISOString(),
    paymentDate: "",
    mode: "",
    remarks: "Awaiting payment",
    status: "Pending",
    ...overrides,
  };
}

function getGrade(percent, boundaries) {
  if (percent >= boundaries.aPlus) return "A+";
  if (percent >= boundaries.a) return "A";
  if (percent >= boundaries.b) return "B";
  if (percent >= boundaries.c) return "C";
  if (percent >= boundaries.d) return "D";
  return "F";
}

function getPerformanceTag(percent) {
  if (percent >= 90) return "Excellent";
  if (percent >= 75) return "Good";
  if (percent >= 50) return "Average";
  return "Needs Improvement";
}

function defaultSettings() {
  const currentYear = new Date().getFullYear();
  return {
    coachingName: "KISHAN CLASSES",
    address: "Agra",
    phone: "+91 9389915375",
    logo: "",
    feeDueDay: 5,
    subjects: defaultSubjects,
    gradeBoundaries: { aPlus: 90, a: 80, b: 70, c: 55, d: 40 },
    academicYear: `${currentYear}-${currentYear + 1}`,
    templates: {
      feeReminder:
        "Dear [ParentName], this is a reminder that [StudentName]'s tuition fee of Rs [Amount] for [Month] is due on [DueDate]. Please pay at the earliest. - [CoachingName]",
      scoreReport:
        "Dear [ParentName], [StudentName] scored [Marks]/[MaxMarks] ([Grade]) in [Subject] - [TestName] held on [Date]. Teacher's Remark: [Remark] Keep encouraging your child! - [CoachingName]",
    },
  };
}

function emptyState() {
  return {
    settings: defaultSettings(),
    batches: [],
    students: [],
    feeRecords: [],
    tests: [],
    notificationLogs: [],
  };
}

function demoState() {
  const currentYear = new Date().getFullYear();
  const settings = {
    ...defaultSettings(),
    coachingName: "KISHAN CLASSES",
  };

  const batches = [
    { id: uid(), name: "Morning Achievers", timing: "7:00 AM - 9:00 AM", days: ["Mon", "Wed", "Fri"], maxStudents: 20, teacher: "Ritika Sharma" },
    { id: uid(), name: "Evening Scholars", timing: "4:30 PM - 6:30 PM", days: ["Mon", "Tue", "Thu", "Fri"], maxStudents: 24, teacher: "Aman Verma" },
    { id: uid(), name: "Weekend Excellence", timing: "10:00 AM - 1:00 PM", days: ["Sat"], maxStudents: 18, teacher: "Neha Kapoor" },
    { id: uid(), name: "Foundation Focus", timing: "2:30 PM - 4:00 PM", days: ["Tue", "Thu", "Sat"], maxStudents: 22, teacher: "Piyush Mehta" },
  ];

  const students = [
    ["Aarav Sen", "Sourav Sen", "Madhumita Sen", "2010-05-11", "Male", "9876500011", "9876501011", "aarav@example.com", "Salt Lake, Kolkata", "Class 10", ["Maths", "Science", "English"], 0, 36000, 3000, 0, 5, "2026-01-08"],
    ["Diya Roy", "Anirban Roy", "Nandita Roy", "2011-01-19", "Female", "9876500012", "9876501012", "diya@example.com", "New Town, Kolkata", "Class 9", ["Maths", "English", "History"], 1, 30000, 2500, 1000, 5, "2026-02-05"],
    ["Kabir Das", "Sudip Das", "Poulomi Das", "2009-09-02", "Male", "9876500013", "9876501013", "kabir@example.com", "Howrah, Kolkata", "Class 11", ["Physics", "Chemistry", "Biology"], 1, 48000, 4000, 0, 10, "2026-01-10"],
    ["Meera Nair", "Rajeev Nair", "Anitha Nair", "2012-03-28", "Female", "9876500014", "9876501014", "meera@example.com", "Ballygunge, Kolkata", "Class 8", ["Science", "English", "Geography"], 2, 24000, 2000, 500, 7, "2026-03-07"],
    ["Rohan Iyer", "Sanjay Iyer", "Deepa Iyer", "2008-11-13", "Male", "9876500015", "9876501015", "rohan@example.com", "Behala, Kolkata", "Class 12", ["Physics", "Chemistry", "Maths"], 0, 54000, 4500, 1500, 18, "2026-02-18"],
    ["Sana Khan", "Farhan Khan", "Nazia Khan", "2010-07-22", "Female", "9876500016", "9876501016", "sana@example.com", "Park Circus, Kolkata", "Class 10", ["Biology", "Chemistry", "English"], 2, 36000, 3000, 0, 8, "2026-02-08"],
    ["Vranda Sharma", "Gaurav Sharma", "Preeti Sharma", "2011-09-14", "Female", "9876500017", "9876501017", "vranda@example.com", "Dum Dum, Kolkata", "Class 9", ["Maths", "Science", "English"], 3, 30000, 2500, 0, 21, "2026-04-21"],
    ["Arjun Patel", "Mahesh Patel", "Kavita Patel", "2009-12-01", "Male", "9876500018", "9876501018", "arjun@example.com", "Tollygunge, Kolkata", "Class 11", ["Physics", "Maths", "Chemistry"], 0, 42000, 3500, 500, 19, "2026-03-19"],
  ].map((s, i) => ({
    id: uid(),
    fullName: s[0], fatherName: s[1], motherName: s[2], dateOfBirth: s[3], gender: s[4],
    contactNumber: s[5], parentWhatsapp: s[6], email: s[7], address: s[8], photo: "",
    admissionDate: s[16], classGrade: s[9], subjects: s[10], batchId: batches[s[11]].id,
    studentId: `CC-${currentYear}-${String(i + 1).padStart(3, "0")}`,
    totalCourseFee: s[12], monthlyFeeAmount: s[13], discount: s[14], feeDueDay: s[15],
  }));

  const feeRecords = [];
  const tests = [];
  const notificationLogs = [];
  const now = new Date();
  const testNames = ["Unit Test 1", "Unit Test 2", "Practice Quiz", "Mock Exam", "Revision Test"];

  students.forEach((student, si) => {
    const admDate = new Date(student.admissionDate);
    const start = new Date(admDate.getFullYear(), admDate.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    for (const cur = new Date(start); cur <= end; cur.setMonth(cur.getMonth() + 1)) {
      const ci = (cur.getFullYear() - start.getFullYear()) * 12 + cur.getMonth() - start.getMonth();
      let status = "Pending", amountPaid = 0;
      if (cur < new Date(now.getFullYear(), now.getMonth(), 1)) {
        if ((si + ci) % 4 === 0) { status = "Pending"; amountPaid = 0; }
        else if ((si + ci) % 5 === 0) { status = "Partial"; amountPaid = Math.round(student.monthlyFeeAmount * 0.6); }
        else { status = "Paid"; amountPaid = student.monthlyFeeAmount; }
      } else if (cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth()) {
        if (student.feeDueDay <= now.getDate()) {
          status = (si + ci) % 3 === 0 ? "Pending" : "Partial";
          amountPaid = status === "Partial" ? Math.round(student.monthlyFeeAmount * 0.5) : 0;
        }
      }
      feeRecords.push(buildFeeRecord(student, new Date(cur), {
        amountPaid,
        paymentDate: status === "Paid" ? createCycleBoundary(cur.getFullYear(), cur.getMonth(), Math.max(1, student.feeDueDay - 1)).toISOString().slice(0, 10) : "",
        mode: status === "Paid" ? ((si + ci) % 2 === 0 ? "UPI" : "Cash") : "",
        remarks: status === "Partial" ? "Advance received partially" : status === "Paid" ? "On time" : "Awaiting payment",
        status,
      }));
    }

    student.subjects.forEach((subject, sj) => {
      for (let i = 0; i < 3; i++) {
        const marks = 52 + ((si * 7 + sj * 9 + i * 13) % 45);
        const percent = marks;
        tests.push({
          id: uid(), studentId: student.id, batchId: student.batchId, subject,
          testName: testNames[(si + sj + i) % testNames.length],
          testDate: new Date(currentYear, (sj + i) % 5, 4 + ((si + i) % 20)).toISOString().slice(0, 10),
          maxMarks: 100, marksObtained: marks, remarks: percent >= 75 ? "Solid performance" : "Needs more revision",
          grade: getGrade(percent, settings.gradeBoundaries), performanceTag: getPerformanceTag(percent),
        });
      }
    });

    notificationLogs.push(
      { id: uid(), studentId: student.id, date: now.toISOString(), type: "Welcome", message: `Admission confirmation shared with ${student.motherName}.`, status: "Sent" },
      { id: uid(), studentId: student.id, date: now.toISOString(), type: "Fee Reminder", message: `Reminder prepared for ${student.fullName} regarding monthly fee status.`, status: "Sent" },
    );
  });

  return { settings, batches, students, feeRecords, tests, notificationLogs };
}

// ─────────────────────────────────────────────────────────
// Database Read / Write
// ─────────────────────────────────────────────────────────

function stripMongoFields(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  delete obj.key;
  return obj;
}

async function readState() {
  const [settingsDoc, students, batches, feeRecords, tests, notificationLogs] = await Promise.all([
    Settings.findOne({ key: "main" }).lean(),
    Student.find({}).lean(),
    Batch.find({}).lean(),
    FeeRecord.find({}).lean(),
    Test.find({}).lean(),
    NotificationLog.find({}).lean(),
  ]);

  if (!settingsDoc) return null;

  return {
    settings: stripMongoFields(settingsDoc),
    students: students.map(stripMongoFields),
    batches: batches.map(stripMongoFields),
    feeRecords: feeRecords.map(stripMongoFields),
    tests: tests.map(stripMongoFields),
    notificationLogs: notificationLogs.map(stripMongoFields),
  };
}

async function writeState(state) {
  const { settings = {}, students = [], batches = [], feeRecords = [], tests = [], notificationLogs = [] } = state;

  // Run all collection writes in parallel
  const ops = [
    Settings.findOneAndUpdate(
      { key: "main" },
      { $set: { ...settings, key: "main" } },
      { upsert: true, returnDocument: "after" },
    ),
  ];

  // For each array collection: delete all, then bulk insert
  const bulkOps = [
    { Model: Student, docs: students },
    { Model: Batch, docs: batches },
    { Model: FeeRecord, docs: feeRecords },
    { Model: Test, docs: tests },
    { Model: NotificationLog, docs: notificationLogs },
  ];

  for (const { Model, docs } of bulkOps) {
    ops.push(
      Model.deleteMany({}).then(() => {
        if (docs.length === 0) return;
        // Strip any _id / __v from incoming docs to avoid duplicate key errors
        const clean = docs.map((d) => {
          const copy = { ...d };
          delete copy._id;
          delete copy.__v;
          delete copy.createdAt;
          delete copy.updatedAt;
          return copy;
        });
        return Model.insertMany(clean, { ordered: false });
      }),
    );
  }

  await Promise.all(ops);

  // Sync student users
  try {
    const currentUsers = await User.find({ role: "student" });
    const currentUserMap = new Map(currentUsers.map((u) => [u.studentId, u]));
    const studentUserOps = [];
    for (const s of students) {
      if (!currentUserMap.has(s.id)) {
        const defaultPassword = s.contactNumber || "password123";
        const hash = await bcrypt.hash(defaultPassword, 10);
        studentUserOps.push({
          insertOne: {
            document: {
              username: s.studentId,
              passwordHash: hash,
              role: "student",
              studentId: s.id,
            },
          },
        });
      }
    }
    if (studentUserOps.length > 0) {
      await User.bulkWrite(studentUserOps);
    }
  } catch (err) {
    console.error("Failed to sync student users:", err);
  }

  return state;
}

// ─────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────

function validateStateShape(body) {
  if (!body || typeof body !== "object") return "Payload must be a JSON object";
  if (!Array.isArray(body.students)) return "students must be an array";
  if (!Array.isArray(body.batches)) return "batches must be an array";
  if (!Array.isArray(body.feeRecords)) return "feeRecords must be an array";
  if (!Array.isArray(body.tests)) return "tests must be an array";
  if (!Array.isArray(body.notificationLogs)) return "notificationLogs must be an array";
  return null;
}

// ─────────────────────────────────────────────────────────
// Express App
// ─────────────────────────────────────────────────────────

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Capacitor, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      "https://localhost",           // Capacitor Android with androidScheme: "https"
      "http://localhost",
      "http://localhost:5173",
      "http://localhost:4173",
      "capacitor://localhost",
      "http://10.0.2.2",            // Android emulator
    ].filter(Boolean); // Remove undefined entries (e.g. if FRONTEND_URL is not set)

    if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
      return callback(null, true);
    }

    console.warn("CORS blocked origin:", origin);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "12mb" }));

// ─────────────────────────────────────────────────────────
// Middlewares
// ─────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin only" });
  }
  next();
}

// ─────────────────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const payload = { id: user._id, username: user.username, role: user.role, studentId: user.studentId };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user: payload });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/health", async (_req, res) => {
  try {
    const [studentCount, batchCount, feeCount, testCount, logCount] = await Promise.all([
      Student.countDocuments(),
      Batch.countDocuments(),
      FeeRecord.countDocuments(),
      Test.countDocuments(),
      NotificationLog.countDocuments(),
    ]);
    res.json({
      ok: true,
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      database: DB_NAME,
      collections: { students: studentCount, batches: batchCount, feeRecords: feeCount, tests: testCount, notificationLogs: logCount },
    });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

app.get("/api/state", authMiddleware, async (req, res) => {
  try {
    const state = await readState();
    const resultState = state || emptyState();
    
    if (req.user.role === "student") {
      const studentDbId = req.user.studentId;
      const student = resultState.students.find(s => s.id === studentDbId);
      const feeRecords = resultState.feeRecords.filter(f => f.studentId === studentDbId);
      const tests = resultState.tests.filter(t => t.studentId === studentDbId);
      const batch = student ? resultState.batches.find(b => b.id === student.batchId) : null;
      
      return res.json({
        ...resultState,
        students: student ? [student] : [],
        feeRecords,
        tests,
        batches: batch ? [batch] : [],
        notificationLogs: []
      });
    }

    return res.json(resultState);
  } catch (error) {
    console.error("GET /api/state error:", error);
    return res.status(500).json({ error: "Failed to read state from MongoDB" });
  }
});

app.put("/api/state", authMiddleware, adminOnly, async (req, res) => {
  try {
    const validationError = validateStateShape(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    await writeState(req.body);
    return res.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("PUT /api/state error:", error);
    return res.status(500).json({ error: "Failed to save state to MongoDB" });
  }
});

app.post("/api/reset-demo", authMiddleware, adminOnly, async (req, res) => {
  try {
    const reset = await writeState(demoState());
    res.json(reset);
  } catch (error) {
    console.error("POST /api/reset-demo error:", error);
    res.status(500).json({ error: "Failed to reset app state" });
  }
});

app.delete("/api/students/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      Student.deleteOne({ id }),
      FeeRecord.deleteMany({ studentId: id }),
      Test.deleteMany({ studentId: id }),
      NotificationLog.deleteMany({ studentId: id }),
      User.deleteOne({ studentId: id })
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/students error:", error);
    res.status(500).json({ error: "Failed to delete student and related data" });
  }
});

app.delete("/api/notification-logs/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await NotificationLog.deleteOne({ id });
    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/notification-logs error:", error);
    res.status(500).json({ error: "Failed to delete notification log" });
  }
});

// ─────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file. Please provide a MongoDB Atlas connection string.");
    }
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`✓ MongoDB Atlas connected — database: ${DB_NAME}`);

    // Seed admin
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await User.create({ username: "admin", passwordHash: hash, role: "admin" });
      console.log("  → Default admin created (admin/admin123)");
    }

    // Show collection counts
    const counts = {
      students: await Student.countDocuments(),
      batches: await Batch.countDocuments(),
      feeRecords: await FeeRecord.countDocuments(),
      tests: await Test.countDocuments(),
      notifications: await NotificationLog.countDocuments(),
    };
    console.log("  Collections:", counts);

    if (counts.students === 0 && counts.batches === 0) {
      console.log("  → Empty database. Loading demo data...");
      await writeState(demoState());
      console.log("  ✓ Demo data loaded!");
    }

    app.listen(PORT, () => {
      console.log(`\n✓ Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
}

start();
