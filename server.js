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
import { initTelegramBot } from "./telegramService.js";
let telegramBot = null;

// Force Google DNS to fix broken SRV lookups on some networks
dns.setServers(["8.8.8.8", "8.8.4.4"]);

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
    status: { type: String, enum: ["Active", "Inactive", "Dropped", "Completed", "Transferred", "Archived"], default: "Active" },
    withdrawalDate: String,
    withdrawalReason: String,
    withdrawalNotes: String,
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
    transactionType: { type: String, default: "MONTHLY_FEE" },
    createdBy: String,
    lastUpdatedBy: String,
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

const scheduledTestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    batchId: String,
    subject: String,
    testName: String,
    testDate: String,
    maxMarks: Number,
  },
  { strict: false, timestamps: true },
);
scheduledTestSchema.index({ studentId: 1 });

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
    role: { type: String, enum: ["admin", "student", "testuser"], required: true },
    studentId: { type: String }, // For students, links to Student.id
  },
  { timestamps: true }
);

const messageTemplateSchema = new mongoose.Schema(
  {
    templateKey: { type: String, required: true },
    templateName: { type: String, required: true },
    category: { type: String, enum: ["admission", "fee", "exam", "attendance", "general", "announcement"], required: true },
    channel: { type: String, enum: ["whatsapp", "sms", "email"], default: "whatsapp" },
    content: { type: String, required: true },
    variables: [String],
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: true },
    defaultContent: String,
    lastUpdatedBy: String,
    lastUpdatedAt: Date,
  },
  { strict: false, timestamps: true },
);
messageTemplateSchema.index({ templateKey: 1, channel: 1 }, { unique: true });
messageTemplateSchema.index({ category: 1 });

const telegramLinkTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    type: { type: String, enum: ["student", "parent"], required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Setting", settingsSchema);
const Student = mongoose.model("Student", studentSchema);
const Batch = mongoose.model("Batch", batchSchema);
const FeeRecord = mongoose.model("FeeRecord", feeRecordSchema);
const Test = mongoose.model("Test", testSchema);
const ScheduledTest = mongoose.model("ScheduledTest", scheduledTestSchema);
const NotificationLog = mongoose.model("NotificationLog", notificationLogSchema);
const User = mongoose.model("User", userSchema);
const MessageTemplate = mongoose.model("MessageTemplate", messageTemplateSchema);
const TelegramLinkToken = mongoose.model("TelegramLinkToken", telegramLinkTokenSchema);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

import { uid, monthKeyFromDate } from "./utils.js";
import { emptyState, demoState } from "./demoData.js";


// ─────────────────────────────────────────────────────────
// Template Variable Replacement Engine
// ─────────────────────────────────────────────────────────

function replaceTemplateVariables(content, data) {
  if (!content) return "";
  return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return data[varName] !== undefined && data[varName] !== null ? String(data[varName]) : match;
  });
}

// ─────────────────────────────────────────────────────────
// Default Message Templates
// ─────────────────────────────────────────────────────────

function getDefaultTemplates() {
  return [
    // ── Admission ──
    {
      templateKey: "new_student_admission",
      templateName: "New Student Admission",
      category: "admission",
      channel: "whatsapp",
      variables: ["studentName", "studentId", "class", "batch", "admissionDate", "coachingName", "contactNumber"],
      content: `Dear Parent,\n\n🎓 *New Admission Confirmed!*\n\nWe are pleased to inform you that *{{studentName}}* has been successfully admitted to *{{coachingName}}*.\n\n📋 *Admission Details:*\n• Student ID: {{studentId}}\n• Class: {{class}}\n• Batch: {{batch}}\n• Admission Date: {{admissionDate}}\n\nFor any queries, please contact us at {{contactNumber}}.\n\nWelcome aboard! 🌟\n\n— {{coachingName}}`,
    },
    {
      templateKey: "welcome_message",
      templateName: "Welcome Message",
      category: "admission",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "studentId", "class", "subjects", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\nWelcome! 🎉 *{{studentName}}* has been successfully enrolled at *{{coachingName}}*.\n\n📋 *Details:*\n• Student ID: {{studentId}}\n• Class: {{class}}\n• Subjects: {{subjects}}\n\nWe look forward to a great learning journey together! 📚\n\nFor any assistance, contact us at {{contactNumber}}.\n\n— {{coachingName}}`,
    },
    {
      templateKey: "parent_welcome_message",
      templateName: "Parent Welcome Message",
      category: "admission",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "studentId", "class", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\nWelcome to *{{coachingName}}*! 🙏\n\nYour child *{{studentName}}* (ID: {{studentId}}, Class: {{class}}) is now part of our learning community.\n\nYou will receive updates about:\n• Fee reminders & receipts\n• Test scores & progress reports\n• Important announcements\n\nContact us anytime at {{contactNumber}}.\n\nThank you for choosing us! 🌟\n\n— {{coachingName}}`,
    },

    // ── Fee ──
    {
      templateKey: "fee_receipt",
      templateName: "Fee Receipt",
      category: "fee",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "paymentAmount", "month", "mode", "totalOutstanding", "coachingName"],
      content: `Dear {{parentName}},\n\n✅ *Payment Received!*\n\n• Student: {{studentName}}\n• Amount: ₹{{paymentAmount}}\n• Month: {{month}}\n• Mode: {{mode}}\n• Outstanding Balance: ₹{{totalOutstanding}}\n\nThank you for the payment! 🙏\n\n— {{coachingName}}`,
    },
    {
      templateKey: "fee_due_reminder",
      templateName: "Fee Due Reminder",
      category: "fee",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "dueAmount", "totalOutstanding", "dueDate", "month", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\nThis is a reminder that *{{studentName}}*'s tuition fee of ₹{{dueAmount}} for {{month}} is due on {{dueDate}}.\n\nTotal Outstanding: ₹{{totalOutstanding}}\n\nPlease contact the coaching office if payment has already been made.\n\n{{coachingName}}\n📞 {{contactNumber}}`,
    },
    {
      templateKey: "fee_overdue_reminder",
      templateName: "Fee Overdue Reminder",
      category: "fee",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "dueAmount", "totalOutstanding", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n⚠️ *Fee Overdue Notice*\n\n*{{studentName}}*'s tuition fee of ₹{{dueAmount}} is overdue.\n\nTotal Outstanding: ₹{{totalOutstanding}}\n\nPlease clear the dues at the earliest to avoid any inconvenience.\n\nContact: {{contactNumber}}\n\n— {{coachingName}}`,
    },
    {
      templateKey: "monthly_fee_reminder",
      templateName: "Monthly Fee Reminder",
      category: "fee",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "dueAmount", "month", "dueDate", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n📅 *Monthly Fee Reminder*\n\n• Student: {{studentName}}\n• Amount Due: ₹{{dueAmount}}\n• Month: {{month}}\n• Due Date: {{dueDate}}\n\nKindly make the payment on or before the due date.\n\n— {{coachingName}}\n📞 {{contactNumber}}`,
    },
    {
      templateKey: "payment_confirmation",
      templateName: "Payment Confirmation",
      category: "fee",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "paymentAmount", "month", "mode", "coachingName"],
      content: `Dear {{parentName}},\n\n💰 *Fee Payment Update* for *{{studentName}}*:\n\n• Month: {{month}}\n• Amount Paid: ₹{{paymentAmount}}\n• Mode: {{mode}}\n\nThank you for the payment! ✅\n\n— {{coachingName}}`,
    },

    // ── Exam ──
    {
      templateKey: "test_created",
      templateName: "Test Created",
      category: "exam",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "testName", "subject", "testDate", "maxMarks", "coachingName"],
      content: `Dear {{parentName}},\n\n📅 *Upcoming Test Scheduled* for *{{studentName}}*:\n\n• Subject: {{subject}}\n• Test: {{testName}}\n• Date: {{testDate}}\n• Max Marks: {{maxMarks}}\n\nPlease ensure your child is prepared! 📚\n\n— {{coachingName}}`,
    },
    {
      templateKey: "marks_published",
      templateName: "Marks Published",
      category: "exam",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "testName", "subject", "marks", "maxMarks", "percentage", "grade", "coachingName"],
      content: `Dear {{parentName}},\n\n📝 *Test Score Update* for *{{studentName}}*:\n\n• Subject: {{subject}}\n• Test: {{testName}}\n• Marks: *{{marks}}/{{maxMarks}}* ({{percentage}}%)\n• Grade: *{{grade}}*\n\nKeep encouraging your child! 🌟\n\n— {{coachingName}}`,
    },
    {
      templateKey: "progress_report_available",
      templateName: "Progress Report Available",
      category: "exam",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "reportLink", "coachingName"],
      content: `Dear {{parentName}},\n\n📊 *Progress Report Available*\n\n*{{studentName}}*'s progress report is now ready.\n\nPlease contact the coaching office or check the student portal to view the detailed report.\n\nKeep supporting your child's learning journey! 📚\n\n— {{coachingName}}`,
    },
    {
      templateKey: "result_announcement",
      templateName: "Result Announcement",
      category: "exam",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "testName", "marks", "maxMarks", "percentage", "rank", "coachingName"],
      content: `Dear {{parentName}},\n\n🏆 *Result Announcement*\n\n*{{studentName}}* has secured the following in *{{testName}}*:\n\n• Marks: {{marks}}/{{maxMarks}}\n• Percentage: {{percentage}}%\n• Rank: {{rank}}\n\nCongratulations! Keep up the great work! 🌟\n\n— {{coachingName}}`,
    },

    // ── Attendance (Future) ──
    {
      templateKey: "student_absent",
      templateName: "Student Absent",
      category: "attendance",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "date", "class", "batch", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n⚠️ *Absence Notice*\n\n*{{studentName}}* (Class: {{class}}, Batch: {{batch}}) was absent on {{date}}.\n\nIf your child was unwell, please inform us. Regular attendance is important for academic progress.\n\nContact: {{contactNumber}}\n\n— {{coachingName}}`,
    },
    {
      templateKey: "low_attendance_warning",
      templateName: "Low Attendance Warning",
      category: "attendance",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "percentage", "class", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n🔴 *Low Attendance Warning*\n\n*{{studentName}}*'s attendance has dropped to *{{percentage}}%* which is below the minimum requirement.\n\nRegular attendance is crucial for academic success. Please ensure your child attends classes regularly.\n\nContact: {{contactNumber}}\n\n— {{coachingName}}`,
    },

    // ── General ──
    {
      templateKey: "password_reset",
      templateName: "Password Reset",
      category: "general",
      channel: "whatsapp",
      variables: ["studentName", "studentId", "coachingName", "contactNumber"],
      content: `Dear Student,\n\n🔐 *Password Reset*\n\nYour password for *{{studentName}}* (ID: {{studentId}}) has been reset.\n\nPlease login with your new credentials and change your password immediately.\n\nIf you did not request this, contact us at {{contactNumber}}.\n\n— {{coachingName}}`,
    },
    {
      templateKey: "account_created",
      templateName: "Account Created",
      category: "general",
      channel: "whatsapp",
      variables: ["studentName", "studentId", "coachingName", "contactNumber"],
      content: `Dear Student,\n\n✅ *Account Created Successfully!*\n\nYour student account at *{{coachingName}}* is ready.\n\n• Name: {{studentName}}\n• Student ID: {{studentId}}\n• Login: Use your Student ID and Date of Birth (DDMMYYYY) as password\n\nFor any issues, contact {{contactNumber}}.\n\n— {{coachingName}}`,
    },
    {
      templateKey: "parent_account_created",
      templateName: "Parent Account Created",
      category: "general",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "studentId", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n✅ *Parent Access Enabled!*\n\nYou can now access *{{studentName}}*'s portal at *{{coachingName}}*.\n\n• Student ID: {{studentId}}\n• Login: Use Student ID and Date of Birth (DDMMYYYY)\n\nYou can view fee status, test scores, and progress reports.\n\nContact: {{contactNumber}}\n\n— {{coachingName}}`,
    },
    {
      templateKey: "student_login_credentials",
      templateName: "Student Login Credentials",
      category: "general",
      channel: "whatsapp",
      variables: ["studentName", "studentId", "coachingName", "contactNumber"],
      content: `Dear Student,\n\n🔑 *Your Login Credentials*\n\n• Username: {{studentId}}\n• Password: Your Date of Birth (DDMMYYYY)\n\nPlease keep your credentials safe and do not share them.\n\nFor help, contact {{contactNumber}}.\n\n— {{coachingName}}`,
    },
    {
      templateKey: "parent_login_credentials",
      templateName: "Parent Login Credentials",
      category: "general",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "studentId", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n🔑 *Login Credentials for {{studentName}}*\n\n• Username: {{studentId}}\n• Password: Date of Birth (DDMMYYYY)\n\nUse these to access the student portal and track {{studentName}}'s academic progress.\n\nContact: {{contactNumber}}\n\n— {{coachingName}}`,
    },
    {
      templateKey: "profile_updated",
      templateName: "Profile Updated",
      category: "general",
      channel: "whatsapp",
      variables: ["studentName", "parentName", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\nThis is to inform you that *{{studentName}}*'s profile has been updated at *{{coachingName}}*.\n\nIf you have any questions, please contact us at {{contactNumber}}.\n\n— {{coachingName}}`,
    },

    // ── Announcement ──
    {
      templateKey: "batch_announcement",
      templateName: "Batch Announcement",
      category: "announcement",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "batch", "coachingName"],
      content: `Dear {{parentName}},\n\n📢 *Batch Announcement*\n\nThis is an important update regarding *{{batch}}* batch at *{{coachingName}}*.\n\nPlease note the changes and contact us for any queries.\n\n— {{coachingName}}`,
    },
    {
      templateKey: "holiday_notice",
      templateName: "Holiday Notice",
      category: "announcement",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "coachingName"],
      content: `Dear {{parentName}},\n\n🏖️ *Holiday Notice*\n\nPlease be informed that *{{coachingName}}* will remain closed on the mentioned dates.\n\nRegular classes will resume as per schedule after the holiday period.\n\nThank you! 🙏\n\n— {{coachingName}}`,
    },
    {
      templateKey: "event_notification",
      templateName: "Event Notification",
      category: "announcement",
      channel: "whatsapp",
      variables: ["parentName", "studentName", "coachingName", "contactNumber"],
      content: `Dear {{parentName}},\n\n🎉 *Event Notification*\n\n*{{coachingName}}* is organizing a special event. We would love to have *{{studentName}}* participate!\n\nFor details, contact us at {{contactNumber}}.\n\n— {{coachingName}}`,
    },
  ];
}

async function seedDefaultTemplates() {
  const count = await MessageTemplate.countDocuments();
  if (count > 0) return;

  const defaults = getDefaultTemplates();
  const docs = defaults.map((t) => ({
    ...t,
    isActive: true,
    isDefault: true,
    defaultContent: t.content,
    lastUpdatedAt: new Date(),
    lastUpdatedBy: "system",
  }));
  await MessageTemplate.insertMany(docs, { ordered: false });
  console.log(`  → Seeded ${docs.length} default message templates`);
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
  const [settingsDoc, students, batches, feeRecords, tests, scheduledTests, notificationLogs] = await Promise.all([
    Settings.findOne({ key: "main" }).lean(),
    Student.find({}).lean(),
    Batch.find({}).lean(),
    FeeRecord.find({}).lean(),
    Test.find({}).lean(),
    ScheduledTest.find({}).lean(),
    NotificationLog.find({}).lean(),
  ]);

  if (!settingsDoc) return null;

  return {
    settings: stripMongoFields(settingsDoc),
    students: students.map(stripMongoFields),
    batches: batches.map(stripMongoFields),
    feeRecords: feeRecords.map(stripMongoFields),
    tests: tests.map(stripMongoFields),
    scheduledTests: scheduledTests.map(stripMongoFields),
    notificationLogs: notificationLogs.map(stripMongoFields),
  };
}

async function writeState(state) {
  const { settings = {}, students = [], batches = [], feeRecords = [], tests = [], scheduledTests = [], notificationLogs = [] } = state;

  // Diff Engine for Telegram Notifications
  let oldFeeRecords = [];
  let oldTests = [];
  try {
    oldFeeRecords = await FeeRecord.find({}).lean();
    oldTests = await Test.find({}).lean();
  } catch (e) {}

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
    { Model: ScheduledTest, docs: scheduledTests },
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

  // Trigger Telegram Notifications
  if (telegramBot) {
    try {
      // 1. Fee Paid
      for (const newFee of feeRecords) {
        if (newFee.status === "Paid") {
          const oldFee = oldFeeRecords.find(f => f.id === newFee.id);
          if (!oldFee || oldFee.status !== "Paid") {
            const student = await Student.findOne({ id: newFee.studentId }).lean();
            if (student && student.telegramParentChatId) {
              telegramBot.sendMessage(student.telegramParentChatId, `✅ *Fee Payment Received*\n\nStudent: ${student.fullName}\nAmount: ₹${newFee.amountPaid}\nMonth: ${newFee.monthKey}\n\nThank you!`);
            }
          }
        }
      }
      // 2. New Test Results
      for (const newTest of tests) {
        const oldTest = oldTests.find(t => t.id === newTest.id);
        if (!oldTest) {
          const student = await Student.findOne({ id: newTest.studentId }).lean();
          if (student && (student.telegramStudentChatId || student.telegramParentChatId)) {
            const msg = `📊 *New Test Result*\n\nStudent: ${student.fullName}\nTest: ${newTest.testName}\nSubject: ${newTest.subject}\nMarks: ${newTest.marksObtained}/${newTest.maxMarks}\nGrade: ${newTest.grade}`;
            if (student.telegramStudentChatId) telegramBot.sendMessage(student.telegramStudentChatId, msg);
            if (student.telegramParentChatId && student.telegramParentChatId !== student.telegramStudentChatId) telegramBot.sendMessage(student.telegramParentChatId, msg);
          }
        }
      }
    } catch (e) {
      console.error("Error sending telegram notifications:", e);
    }
  }

  // Sync student users
  try {
    const currentUsers = await User.find({ role: "student" });
    const currentUserMap = new Map(currentUsers.map((u) => [u.studentId, u]));
    const studentUserOps = [];
    for (const s of students) {
      if (!currentUserMap.has(s.id)) {
        let defaultPassword = s.contactNumber || "password123";
        if (s.dateOfBirth) {
          const parts = s.dateOfBirth.split("-");
          if (parts.length === 3) {
            defaultPassword = parts[2] + parts[1] + parts[0]; // DDMMYYYY
          }
        }
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
  if (!Array.isArray(body.scheduledTests)) return "scheduledTests must be an array";
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
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "testuser")) {
    return res.status(403).json({ error: "Forbidden: Admin only" });
  }
  if (req.user.role === "testuser" && req.method !== "GET") {
    return res.status(403).json({ error: "Test User can't do this action." });
  }
  next();
}

// ─────────────────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Case-insensitive exact match
    const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
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

app.put("/api/auth/update-admin", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const hash = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(req.user.id, { username, passwordHash: hash });

    res.json({ ok: true, message: "Admin credentials updated" });
  } catch (error) {
    console.error("Update admin error:", error);
    res.status(500).json({ error: "Failed to update admin credentials" });
  }
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
    
    if (req.user.role === "testuser") {
      const demo = demoState();
      demo.students = demo.students.slice(0, 4);
      const studentIds = demo.students.map(s => s.id);
      demo.feeRecords = demo.feeRecords.filter(f => studentIds.includes(f.studentId));
      demo.tests = demo.tests.filter(t => studentIds.includes(t.studentId));
      demo.scheduledTests = demo.scheduledTests.filter(t => studentIds.includes(t.studentId));
      demo.notificationLogs = demo.notificationLogs.filter(n => studentIds.includes(n.studentId));
      return res.json(demo);
    }

    if (req.user.role === "student") {
      const studentDbId = req.user.studentId;
      const loggedInStudent = resultState.students.find(s => s.id === studentDbId);
      
      let linkedStudents = [];
      if (loggedInStudent && loggedInStudent.contactNumber) {
        linkedStudents = resultState.students.filter(s => s.contactNumber === loggedInStudent.contactNumber);
      } else if (loggedInStudent) {
        linkedStudents = [loggedInStudent];
      }
      
      const linkedStudentIds = linkedStudents.map(s => s.id);
      
      const feeRecords = resultState.feeRecords.filter(f => linkedStudentIds.includes(f.studentId));
      const tests = resultState.tests.filter(t => linkedStudentIds.includes(t.studentId));
      const scheduledTests = resultState.scheduledTests.filter(t => linkedStudentIds.includes(t.studentId));
      
      const batchIds = [...new Set(linkedStudents.map(s => s.batchId))];
      const batches = resultState.batches.filter(b => batchIds.includes(b.id));

      return res.json({
        ...resultState,
        students: linkedStudents,
        feeRecords,
        tests,
        batches,
        notificationLogs: [],
        scheduledTests
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
      ScheduledTest.deleteMany({ studentId: id }),
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
// Message Templates Routes
// ─────────────────────────────────────────────────────────

app.get("/api/message-templates", authMiddleware, async (req, res) => {
  try {
    const templates = await MessageTemplate.find({}).sort({ category: 1, templateName: 1 });
    res.json(templates);
  } catch (error) {
    console.error("GET /api/message-templates error:", error);
    res.status(500).json({ error: "Failed to fetch message templates" });
  }
});

app.get("/api/message-templates/:id", authMiddleware, async (req, res) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    console.error("GET /api/message-templates/:id error:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

app.put("/api/message-templates/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { content, isActive } = req.body;
    const template = await MessageTemplate.findByIdAndUpdate(
      req.params.id,
      { content, isActive, lastUpdatedBy: req.user.username, lastUpdatedAt: new Date() },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    console.error("PUT /api/message-templates/:id error:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

app.post("/api/message-templates/:id/reset", authMiddleware, adminOnly, async (req, res) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    template.content = template.defaultContent;
    template.lastUpdatedBy = req.user.username;
    template.lastUpdatedAt = new Date();
    await template.save();
    res.json(template);
  } catch (error) {
    console.error("POST /api/message-templates/:id/reset error:", error);
    res.status(500).json({ error: "Failed to reset template" });
  }
});

// ─────────────────────────────────────────────────────────
// Telegram Routes
// ─────────────────────────────────────────────────────────

app.get("/api/telegram/link-token", authMiddleware, async (req, res) => {
  try {
    const { type } = req.query; // 'student' or 'parent'
    if (type !== "student" && type !== "parent") return res.status(400).json({ error: "Invalid type" });
    
    // We only allow students to link from a student login
    if (req.user.role !== "student") return res.status(403).json({ error: "Only students can generate link tokens" });

    // Generate token
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    
    await TelegramLinkToken.create({
      token,
      studentId: req.user.studentId,
      type,
      expiresAt
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "kishan_classes_bot";
    const linkUrl = `https://t.me/${botUsername}?start=${token}`;
    
    res.json({ linkUrl });
  } catch (error) {
    console.error("Link token error:", error);
    res.status(500).json({ error: "Failed to generate link token" });
  }
});

app.post("/api/telegram/broadcast", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { audience, message, batchId, studentId } = req.body;
    let chatIds = [];
    
    const students = await Student.find({}).lean();
    
    students.forEach(s => {
      let include = false;
      if (audience === "all_students" || audience === "all") include = true;
      if (audience === "all_parents" || audience === "all") include = true;
      if (audience === "batch" && s.batchId === batchId) include = true;
      if (audience === "student" && s.id === studentId) include = true;
      
      if (include) {
        if ((audience === "all_students" || audience === "batch" || audience === "student" || audience === "all") && s.telegramStudentChatId) chatIds.push(s.telegramStudentChatId);
        if ((audience === "all_parents" || audience === "batch" || audience === "student" || audience === "all") && s.telegramParentChatId) chatIds.push(s.telegramParentChatId);
      }
    });
    
    // Remove duplicates
    chatIds = [...new Set(chatIds)];
    
    if (!telegramBot) {
      return res.status(400).json({ error: "Telegram bot is not initialized" });
    }
    
    const result = await telegramBot.broadcastMessage(chatIds, message);
    res.json({ ok: true, result });
  } catch (error) {
    console.error("Broadcast error:", error);
    res.status(500).json({ error: "Failed to broadcast message" });
  }
});

app.get("/api/analytics/:studentId", authMiddleware, async (req, res) => {
  try {
    const studentId = req.params.studentId;

    if (req.user.role === "testuser") {
      return res.json({
        summary: {
          studentName: "Demo Student", studentId: "CC-DEMO", classGrade: "Class 10", batchName: "Demo Batch",
          totalTestsAttempted: 12, overallAverage: 82, currentRank: 2, bestSubject: "Maths", weakestSubject: "Physics", improvementPercentage: 5
        },
        growthTrend: [
          { testName: "Unit Test 1", date: "2026-02-15", percentage: 75 },
          { testName: "Mid Term", date: "2026-03-20", percentage: 80 },
          { testName: "Unit Test 2", date: "2026-04-10", percentage: 85 }
        ],
        subjectPerformance: [
          { subject: "Maths", score: 90 }, { subject: "Science", score: 85 }, { subject: "Physics", score: 70 }
        ],
        batchComparison: [
          { subject: "Maths", studentScore: 90, batchAvg: 75 },
          { subject: "Science", studentScore: 85, batchAvg: 80 },
          { subject: "Physics", studentScore: 70, batchAvg: 72 }
        ],
        insights: {
          strengths: ["Maths is consistently strong.", "Performance is improving steadily."],
          needsImprovement: ["Physics is below the batch average."],
          achievements: ["Ranked top 3 in the batch!", "Overall percentage increased by 5%."]
        }
      });
    }

    const student = await Student.findOne({ id: studentId }).lean();
    if (!student) return res.status(404).json({ error: "Student not found" });

    const batch = await Batch.findOne({ id: student.batchId }).lean();
    
    // Fetch all tests for this student
    const studentTests = await Test.find({ studentId }).sort({ testDate: 1 }).lean();
    
    // Fetch all tests for the entire batch
    const batchTests = await Test.find({ batchId: student.batchId }).lean();
    
    // Calculate Student Overall Average
    const studentAverage = studentTests.length 
      ? Math.round(studentTests.reduce((sum, t) => sum + (t.marksObtained / t.maxMarks) * 100, 0) / studentTests.length)
      : 0;
      
    // Calculate Student Growth Trend
    const growthTrend = studentTests.map(t => ({
      testName: t.testName,
      date: t.testDate,
      percentage: Math.round((t.marksObtained / t.maxMarks) * 100)
    }));
    
    // Calculate Subject Performance
    const subjectsMap = {};
    studentTests.forEach(t => {
      if (!subjectsMap[t.subject]) subjectsMap[t.subject] = { sum: 0, count: 0 };
      subjectsMap[t.subject].sum += (t.marksObtained / t.maxMarks) * 100;
      subjectsMap[t.subject].count += 1;
    });
    
    const subjectPerformance = Object.keys(subjectsMap).map(sub => ({
      subject: sub,
      score: Math.round(subjectsMap[sub].sum / subjectsMap[sub].count)
    }));
    
    // Calculate Batch Comparison
    const batchSubjectsMap = {};
    batchTests.forEach(t => {
      if (!batchSubjectsMap[t.subject]) batchSubjectsMap[t.subject] = { sum: 0, count: 0 };
      batchSubjectsMap[t.subject].sum += (t.marksObtained / t.maxMarks) * 100;
      batchSubjectsMap[t.subject].count += 1;
    });
    
    const batchComparison = subjectPerformance.map(sp => ({
      subject: sp.subject,
      studentScore: sp.score,
      batchAvg: batchSubjectsMap[sp.subject] ? Math.round(batchSubjectsMap[sp.subject].sum / batchSubjectsMap[sp.subject].count) : 0
    }));
    
    // Calculate Rank
    const batchStudentsMap = {};
    batchTests.forEach(t => {
      if (!batchStudentsMap[t.studentId]) batchStudentsMap[t.studentId] = { sum: 0, count: 0 };
      batchStudentsMap[t.studentId].sum += (t.marksObtained / t.maxMarks) * 100;
      batchStudentsMap[t.studentId].count += 1;
    });
    
    const batchAverages = Object.keys(batchStudentsMap).map(sId => ({
      studentId: sId,
      avg: Math.round(batchStudentsMap[sId].sum / batchStudentsMap[sId].count)
    })).sort((a, b) => b.avg - a.avg);
    
    let currentRank = 0;
    const rankIndex = batchAverages.findIndex(s => s.studentId === studentId);
    if (rankIndex !== -1) currentRank = rankIndex + 1;
    
    // Determine Best and Weakest Subject
    let bestSubject = "N/A";
    let weakestSubject = "N/A";
    if (subjectPerformance.length > 0) {
      const sorted = [...subjectPerformance].sort((a, b) => b.score - a.score);
      bestSubject = sorted[0].subject;
      weakestSubject = sorted[sorted.length - 1].subject;
    }
    
    // Calculate improvement percentage
    let improvementPercentage = 0;
    if (growthTrend.length >= 2) {
      const first = growthTrend[0].percentage;
      const last = growthTrend[growthTrend.length - 1].percentage;
      improvementPercentage = last - first;
    }
    
    // Generate Insights
    const strengths = [];
    const needsImprovement = [];
    const achievements = [];
    
    if (bestSubject !== "N/A") strengths.push(`${bestSubject} is consistently strong.`);
    if (improvementPercentage > 0) strengths.push("Performance is improving steadily.");
    
    subjectPerformance.forEach(sp => {
      if (sp.score < studentAverage - 5) needsImprovement.push(`${sp.subject} is below overall average.`);
      const bAvg = batchComparison.find(b => b.subject === sp.subject)?.batchAvg || 0;
      if (bAvg > 0 && sp.score < bAvg - 5) needsImprovement.push(`${sp.subject} is below the batch average.`);
    });
    if (needsImprovement.length === 0 && studentTests.length > 0) needsImprovement.push("No major weaknesses identified! Keep it up.");
    
    if (currentRank > 0 && currentRank <= 3) achievements.push(`Ranked top 3 in the batch!`);
    if (improvementPercentage > 5) achievements.push(`Overall percentage increased by ${improvementPercentage}%.`);
    
    const summary = {
      studentName: student.fullName,
      studentId: student.studentId,
      classGrade: student.classGrade,
      batchName: batch ? batch.name : "Unassigned",
      totalTestsAttempted: studentTests.length,
      overallAverage: studentAverage,
      currentRank,
      bestSubject,
      weakestSubject,
      improvementPercentage
    };
    
    res.json({
      summary,
      growthTrend,
      subjectPerformance,
      batchComparison,
      insights: { strengths, needsImprovement, achievements }
    });
  } catch (error) {
    console.error("GET /api/analytics/:studentId error:", error);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
});

app.post("/api/message-templates/preview", authMiddleware, async (req, res) => {
  try {
    const { content, data } = req.body;
    const preview = replaceTemplateVariables(content, data);
    res.json({ preview });
  } catch (error) {
    console.error("POST /api/message-templates/preview error:", error);
    res.status(500).json({ error: "Failed to preview template" });
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

    // Init Telegram Bot
    telegramBot = initTelegramBot({ Student, FeeRecord, Test, TelegramLinkToken });

    // Seed admin
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await User.create({ username: "admin", passwordHash: hash, role: "admin" });
      console.log("  → Default admin created (admin/admin123)");
    }

    const testUserCount = await User.countDocuments({ role: "testuser" });
    if (testUserCount === 0) {
      const hash = await bcrypt.hash("test1234", 10);
      await User.create({ username: "testuser", passwordHash: hash, role: "testuser" });
      console.log("  → Default testuser created (testuser/test1234)");
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
    } else {
      // Temporarily sync all student passwords to DOB for existing data
      console.log("  → Syncing student passwords to DOB...");
      await User.deleteMany({ role: "student" });
      const allStudents = await Student.find({}).lean();
      const studentUserOps = [];
      for (const s of allStudents) {
        let defaultPassword = s.contactNumber || "password123";
        if (s.dateOfBirth) {
          const parts = s.dateOfBirth.split("-");
          if (parts.length === 3) {
            defaultPassword = parts[2] + parts[1] + parts[0]; // DDMMYYYY
          }
        }
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
      if (studentUserOps.length > 0) {
        await User.bulkWrite(studentUserOps);
        console.log(`  ✓ Recreated ${studentUserOps.length} student users with DOB passwords`);
      }
    }

    // Seed default message templates
    await seedDefaultTemplates();

    app.listen(PORT, () => {
      console.log(`\n✓ Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
}

start();
