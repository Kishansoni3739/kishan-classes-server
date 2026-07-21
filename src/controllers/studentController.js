import { User } from "../models/User.js";
import { Student } from "../models/Student.js";
import { Batch } from "../models/Batch.js";
import { Fee } from "../models/Fee.js";
import { Result } from "../models/Result.js";
import { Test } from "../models/Test.js";
import { Subject } from "../models/Subject.js";
import { Teacher } from "../models/Teacher.js";
import { buildCrudController } from "./crudController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateStudentId } from "../utils/studentId.js";
import { appEvents, EVENTS } from "../events/index.js";
import { uploadToImageKitDetailed, deleteFromImageKit } from "../utils/imagekit.js";

const populate = [
  { path: "user", select: "name email phone role isActive" },
  { path: "batch", select: "name schedule" },
  { path: "subjects", select: "name code" }
];

const validateStudentPayload = (data) => {
  const { name, phone, dateOfBirth, gender, guardian, admissionDate, status, batch, monthlyFee } = data;
  
  if (!name || name.trim().length < 2 || name.trim().length > 100) {
    const err = new Error("Student name is required."); err.status = 400; throw err;
  }
  if (phone && !/^\d{10}$/.test(phone)) {
    const err = new Error("Valid mobile number is required."); err.status = 400; throw err;
  }
  if (!dateOfBirth || isNaN(new Date(dateOfBirth).getTime()) || new Date(dateOfBirth) > new Date()) {
    const err = new Error("Date of birth is required."); err.status = 400; throw err;
  }
  if (!gender || !["male", "female", "other"].includes(gender.toLowerCase())) {
    const err = new Error("Please select gender."); err.status = 400; throw err;
  }
  if (!guardian || !guardian.name || guardian.name.trim().length === 0) {
    const err = new Error("Guardian name is required."); err.status = 400; throw err;
  }
  if (!guardian || !guardian.phone || !/^\d{10}$/.test(guardian.phone)) {
    const err = new Error("Guardian valid mobile number is required."); err.status = 400; throw err;
  }
  if (!admissionDate || new Date(admissionDate) > new Date()) {
    const err = new Error("Admission date is required."); err.status = 400; throw err;
  }
  if (!status || !["active", "inactive", "suspended"].includes(status.toLowerCase())) {
    const err = new Error("Please select student status."); err.status = 400; throw err;
  }
  if (!batch) {
    const err = new Error("Batch selection is required."); err.status = 400; throw err;
  }
  if (monthlyFee === undefined || isNaN(Number(monthlyFee)) || Number(monthlyFee) <= 0) {
    const err = new Error("Monthly fee is required."); err.status = 400; throw err;
  }
};

const base = buildCrudController(Student, {
  populate,
  searchFields: ["studentId", "address"],
  scope: (req, query) => {
    if (req.user.role === "student") return { ...query, user: req.user._id };
    return query;
  }
});

export const listStudents = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, ...filters } = req.query;
  const query = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== undefined) query[key] = value;
  });

  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    }).select("_id");
    const userIds = users.map(u => u._id);

    query.$or = [
      { studentId: { $regex: search, $options: "i" } },
      { "guardian.name": { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
      { user: { $in: userIds } }
    ];
  }

  if (req.user && req.user.role === "student") {
    query.user = req.user._id;
  }

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    if (query.batch) {
      if (!assigned.includes(query.batch.toString())) {
        query.batch = { $in: [] };
      }
    } else {
      query.batch = { $in: assigned };
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Student.find(query)
      .populate(populate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(Number(limit), 1000)),
    Student.countDocuments(query)
  ]);

  let responseItems = items;
  if (req.user && req.user.role === "teacher") {
    responseItems = items.map(item => {
      const doc = item.toObject();
      delete doc.monthlyFee;
      return doc;
    });
  }

  res.json({ items: responseItems, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
});

export const getStudentProfile = asyncHandler(async (req, res) => {
  const studentId = req.params.id;
  const student = await Student.findById(studentId).populate("user").populate("batch").populate("subjects");
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = student.batch?._id?.toString() || student.batch?.toString();
    if (!batchId || !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("You do not have permission to view this student profile");
    }
  }

  let [
    monthlyTenures,
    results
  ] = await Promise.all([
    Fee.find({ student: studentId }).sort("dueDate"),
    Result.find({ student: studentId }).populate({ path: "test", select: "title testDate maxMarks", populate: { path: "subject", select: "name" } }).sort("-test.testDate")
  ]);

  // --- Deduplicate existing duplicate Fee records for this student ---
  const uniqueTenuresMap = new Map();
  const duplicateIdsToDelete = [];

  for (const t of monthlyTenures) {
    const pStart = new Date(t.periodStart);
    const key = `${pStart.getUTCFullYear()}-${pStart.getUTCMonth() + 1}`;
    
    if (!uniqueTenuresMap.has(key)) {
      uniqueTenuresMap.set(key, t);
    } else {
      const existing = uniqueTenuresMap.get(key);
      const existingPaid = (existing.payments || []).reduce((sum, p) => sum + p.amount, 0);
      const currentPaid = (t.payments || []).reduce((sum, p) => sum + p.amount, 0);

      if (currentPaid > existingPaid) {
        duplicateIdsToDelete.push(existing._id);
        uniqueTenuresMap.set(key, t);
      } else {
        duplicateIdsToDelete.push(t._id);
      }
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    await Fee.deleteMany({ _id: { $in: duplicateIdsToDelete } });
    console.log(`[FEE DEDUPLICATION] Removed ${duplicateIdsToDelete.length} duplicate fee record(s) for student ${studentId}`);
    monthlyTenures = Array.from(uniqueTenuresMap.values());
  }

  // --- Auto-Generate Missing Tenures ---
  const admissionDate = student.admissionDate ? new Date(student.admissionDate) : new Date(student.createdAt);
  const effectiveMonthlyFee = student.monthlyFee || (monthlyTenures.length > 0 ? monthlyTenures[0].totalAmount : 0);

  if (effectiveMonthlyFee > 0) {
    let currentStart = new Date(admissionDate);
    currentStart.setUTCDate(1);
    currentStart.setUTCHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    let generatedNew = false;

    // Continue generating tenures until current date falls before the next tenure start date
    while (currentStart <= today) {
      let currentEnd = new Date(currentStart);
      currentEnd.setUTCMonth(currentEnd.getUTCMonth() + 1);
      currentEnd.setUTCDate(currentEnd.getUTCDate() - 1);

      const exists = monthlyTenures.some(t => {
        const tDate = new Date(t.periodStart);
        return (
          tDate.getUTCFullYear() === currentStart.getUTCFullYear() &&
          tDate.getUTCMonth() === currentStart.getUTCMonth()
        );
      });

      if (!exists) {
        const newFee = await Fee.create({
          student: student._id,
          totalAmount: effectiveMonthlyFee,
          periodStart: new Date(currentStart),
          periodEnd: new Date(currentEnd),
          dueDate: new Date(currentEnd),
          status: "pending",
          payments: []
        });
        monthlyTenures.push(newFee);
        generatedNew = true;
      }

      currentStart = new Date(currentStart);
      currentStart.setUTCMonth(currentStart.getUTCMonth() + 1);
    }

    if (generatedNew) {
      monthlyTenures.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }
  }

  if (req.user && req.user.role === "teacher") {
    monthlyTenures = [];
    if (student) {
      student.monthlyFee = undefined;
    }
  }

  res.json({
    student,
    monthlyTenures,
    results
  });
});

const formatDOB = (dob) => {
  const d = new Date(dob);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}${month}${year}`;
};

export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate(populate);
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  
  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = student.batch?._id?.toString() || student.batch?.toString();
    if (!batchId || !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("You do not have permission to view this student");
    }
    
    const doc = student.toObject();
    delete doc.monthlyFee;
    return res.json(doc);
  }
  
  res.json(student);
});
export const createStudent = asyncHandler(async (req, res) => {
  validateStudentPayload(req.body);
  const { name, email, phone, ...studentData } = req.body;
  
  const admissionDateObj = studentData.admissionDate ? new Date(studentData.admissionDate) : new Date();
  const studentId = await generateStudentId(admissionDateObj);
  const dobPassword = formatDOB(studentData.dateOfBirth);

  const userData = {
    username: studentId,
    passwordHash: dobPassword,
    role: "STUDENT",
    name,
    phone,
    isActive: true
  };

  if (email && email.trim() !== "") {
    userData.email = email.trim().toLowerCase();
  }

  const user = await User.create(userData);

  const student = await Student.create({
    ...studentData,
    user: user._id,
    admissionDate: admissionDateObj,
    admissionYear: admissionDateObj.getFullYear(),
    studentId
  });

  // Update user with linkedId
  user.linkedId = student._id;
  await user.save();

  if (student.batch) {
    await Batch.findByIdAndUpdate(student.batch, { $addToSet: { students: student._id } });
  }

  // Auto-generate fee tenures
  if (student.monthlyFee > 0) {
    const admissionDate = new Date(student.admissionDate || Date.now());
    const periodEnd = new Date(admissionDate);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    
    const dueDate = new Date(periodEnd);
    
    await Fee.create({
      student: student._id,
      totalAmount: student.monthlyFee,
      periodStart: admissionDate,
      periodEnd: periodEnd,
      dueDate: dueDate,
      status: "pending",
      payments: []
    });
  }

  if (student.openingBalance > 0) {
    const admissionDate = new Date(student.admissionDate || Date.now());
    await Fee.create({
      student: student._id,
      totalAmount: student.openingBalance,
      periodStart: admissionDate,
      periodEnd: admissionDate,
      dueDate: admissionDate,
      status: "pending",
      payments: []
    });
  }

  // Trigger automation event
  appEvents.emit(EVENTS.STUDENT_ADMITTED, await student.populate(populate));

  res.status(201).json(student);
});

export const updateStudent = asyncHandler(async (req, res) => {
  validateStudentPayload(req.body);
  const { name, email, phone, ...studentData } = req.body;
  
  const oldStudent = await Student.findById(req.params.id);
  if (!oldStudent) {
    res.status(404);
    throw new Error("Student not found");
  }

  // Check if DOB is updated
  let dobUpdated = false;
  let newDobPassword = "";
  if (studentData.dateOfBirth) {
    const oldDobStr = formatDOB(oldStudent.dateOfBirth);
    const newDobStr = formatDOB(studentData.dateOfBirth);
    if (oldDobStr !== newDobStr) {
      dobUpdated = true;
      newDobPassword = newDobStr;
    }
  }

  const student = await Student.findByIdAndUpdate(req.params.id, studentData, {
    new: true,
    runValidators: true
  });

  // Sync opening balance dues
  const oldBalance = oldStudent.openingBalance || 0;
  const newBalance = student.openingBalance || 0;
  if (newBalance !== oldBalance) {
    const openingFee = await Fee.findOne({
      student: student._id,
      $expr: { $eq: ["$periodStart", "$periodEnd"] }
    });

    if (openingFee) {
      if (newBalance > 0) {
        openingFee.totalAmount = newBalance;
        const paid = openingFee.payments?.filter(p => !p.status || p.status === "active").reduce((sum, p) => sum + p.amount, 0) || 0;
        if (paid >= newBalance) {
          openingFee.status = "paid";
        } else if (paid > 0) {
          openingFee.status = "partial";
        } else {
          openingFee.status = "pending";
        }
        await openingFee.save();
      } else {
        if (!openingFee.payments || openingFee.payments.length === 0) {
          await Fee.findByIdAndDelete(openingFee._id);
        } else {
          openingFee.totalAmount = 0;
          openingFee.status = "paid";
          await openingFee.save();
        }
      }
    } else if (newBalance > 0) {
      const admissionDate = new Date(student.admissionDate || Date.now());
      await Fee.create({
        student: student._id,
        totalAmount: newBalance,
        periodStart: admissionDate,
        periodEnd: admissionDate,
        dueDate: admissionDate,
        status: "pending",
        payments: []
      });
    }
  }

  if (name || email !== undefined || phone || dobUpdated) {
    const user = await User.findById(student.user);
    if (user) {
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (email !== undefined) {
        if (email.trim() === "") {
          user.email = undefined;
        } else {
          user.email = email.trim().toLowerCase();
        }
      }
      if (dobUpdated) {
        user.passwordHash = newDobPassword; // Will trigger password rehash in save middleware
      }
      await user.save();
    }
  }

  if (student.batch) {
    await Batch.findByIdAndUpdate(student.batch, { $addToSet: { students: student._id } });
  }

  res.json(await student.populate(populate));
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  await User.findByIdAndUpdate(student.user, { isActive: false });
  await Batch.updateMany({ students: student._id }, { $pull: { students: student._id } });
  res.json({ message: "Student deleted" });
});

export const deleteMultipleStudents = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const studentIds = ids || req.body.studentIds;
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    res.status(400);
    throw new Error("No student IDs provided");
  }

  const students = await Student.find({ _id: { $in: studentIds } });
  const userIds = students.map(s => s.user);

  await Student.deleteMany({ _id: { $in: studentIds } });
  await User.updateMany({ _id: { $in: userIds } }, { isActive: false });
  await Batch.updateMany({ students: { $in: studentIds } }, { $pull: { students: { $in: studentIds } } });

  res.json({ message: "Students deleted successfully" });
});

export const getStudentTests = asyncHandler(async (req, res) => {
  const results = await Result.find({ student: req.params.id })
    .populate({
      path: "test",
      populate: [
        { path: "subject", select: "name" },
        { path: "teacher", populate: { path: "user", select: "name" } }
      ]
    })
    .sort({ createdAt: -1 });

  res.json(results);
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  
  if (!req.file) {
    res.status(400);
    throw new Error("Please upload an image file");
  }
  
  const user = await User.findById(student.user);
  if (!user) {
    res.status(404);
    throw new Error("User associated with student not found");
  }

  // Delete previous avatar from ImageKit if it exists
  if (user.avatarFileId) {
    await deleteFromImageKit(user.avatarFileId);
  }
  
  const uploadResult = await uploadToImageKitDetailed(req.file.path, req.file.filename, "/avatars/students");
  user.avatarUrl = uploadResult.url;
  user.avatarFileId = uploadResult.fileId;
  await user.save();
  
  res.json({ avatarUrl: user.avatarUrl, message: "Profile picture updated successfully" });
});
