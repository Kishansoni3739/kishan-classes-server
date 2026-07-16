import { Remark } from "../models/Remark.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listRemarks = asyncHandler(async (req, res) => {
  const { student: studentId } = req.query;

  if (!studentId) {
    res.status(400);
    throw new Error("Student ID is required.");
  }

  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error("Student not found.");
  }

  // Permission check
  if (req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = student.batch?.toString();
    if (batchId && !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("You do not have permission to view remarks for this student.");
    }
  } else if (req.user.role === "student") {
    const ownStudent = await Student.findOne({ user: req.user._id });
    if (ownStudent?._id.toString() !== studentId) {
      res.status(403);
      throw new Error("You can only view your own remarks.");
    }
  }

  const remarks = await Remark.find({ student: studentId })
    .populate("user", "name role")
    .populate({
      path: "teacher",
      populate: { path: "user", select: "name" }
    })
    .sort("-createdAt");

  res.json(remarks);
});

export const createRemark = asyncHandler(async (req, res) => {
  const { student: studentId, category, text } = req.body;

  if (!studentId || !text) {
    res.status(400);
    throw new Error("Student ID and remark text are required.");
  }

  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error("Student not found.");
  }

  let teacherId;
  let teacherName = req.user.name || "Admin";

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      res.status(404);
      throw new Error("Teacher profile not found.");
    }
    teacherId = teacher._id;
    teacherName = req.user.name || teacherName;

    const assigned = req.user.assignedBatches || [];
    const batchId = student.batch?.toString();
    if (!batchId || !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("Teachers can only add remarks for students in their assigned batches.");
    }
  } else if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Unauthorized action.");
  }

  const remark = await Remark.create({
    student: studentId,
    user: req.user._id,
    teacher: teacherId,
    teacherName,
    category,
    text
  });

  res.status(201).json(remark);
});

export const updateRemark = asyncHandler(async (req, res) => {
  const { text, category } = req.body;
  const remark = await Remark.findById(req.params.id);
  
  if (!remark) {
    res.status(404);
    throw new Error("Remark not found.");
  }

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id });
    const isUserOwner = remark.user && remark.user.toString() === req.user._id.toString();
    const isTeacherOwner = teacher && remark.teacher && remark.teacher.toString() === teacher._id.toString();
    if (!isUserOwner && !isTeacherOwner) {
      res.status(403);
      throw new Error("Teachers can only edit their own remarks.");
    }
  } else if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Unauthorized action.");
  }

  // Backfill user field for remarks created before it was added to the schema
  if (!remark.user) {
    remark.user = req.user._id;
  }

  remark.text = text || remark.text;
  remark.category = category || remark.category;
  await remark.save();

  res.json(remark);
});

export const deleteRemark = asyncHandler(async (req, res) => {
  const remark = await Remark.findById(req.params.id);
  
  if (!remark) {
    res.status(404);
    throw new Error("Remark not found.");
  }

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id });
    const isUserOwner = remark.user && remark.user.toString() === req.user._id.toString();
    const isTeacherOwner = teacher && remark.teacher && remark.teacher.toString() === teacher._id.toString();
    if (!isUserOwner && !isTeacherOwner) {
      res.status(403);
      throw new Error("Teachers can only delete their own remarks.");
    }
  } else if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Unauthorized action.");
  }

  await Remark.findByIdAndDelete(req.params.id);
  res.json({ message: "Remark deleted successfully." });
});
