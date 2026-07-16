import { Notice } from "../models/Notice.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const populate = [
  { path: "batch", select: "name" },
  { path: "students", populate: { path: "user", select: "name" } },
  { path: "teachers", populate: { path: "user", select: "name" } },
  { path: "createdBy", select: "name role" }
];

export const listNotices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const andConditions = [];

  // 1. Search condition
  if (search) {
    andConditions.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ]
    });
  }

  // 2. Expiration condition (disappear if expired)
  andConditions.push({
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });

  // 3. Role-based visibility condition
  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id });
    const batchId = student?.batch;
    const studentId = student?._id;
    
    andConditions.push({
      $or: [
        { audience: "all" },
        { audience: "students" },
        ...(batchId ? [{ audience: "batch", batch: batchId }] : []),
        ...(studentId ? [{ audience: "student", students: studentId }] : [])
      ]
    });
  } else if (req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const teacherId = req.user.linkedId;
    
    andConditions.push({
      $or: [
        { audience: "all" },
        { audience: "teachers" },
        { audience: "batch", batch: { $in: assigned } },
        ...(teacherId ? [{ audience: "teacher", teachers: teacherId }] : [])
      ]
    });
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {};

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Notice.find(query)
      .populate(populate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notice.countDocuments(query)
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
});

export const getNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.findById(req.params.id).populate(populate);
  if (!notice) {
    res.status(404);
    throw new Error("Notice not found");
  }

  // Teacher/student checks
  if (req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const teacherId = req.user.linkedId?.toString();
    
    const isAudienceAllowed = 
      notice.audience === "all" ||
      notice.audience === "teachers" ||
      (notice.audience === "batch" && assigned.includes(notice.batch?.toString())) ||
      (notice.audience === "teacher" && notice.teachers?.map(t => t._id?.toString() || t.toString()).includes(teacherId));

    if (!isAudienceAllowed) {
      res.status(403);
      throw new Error("Forbidden access to this notice.");
    }
  } else if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id });
    const studentId = student?._id?.toString();
    
    const isAudienceAllowed = 
      notice.audience === "all" ||
      notice.audience === "students" ||
      (notice.audience === "batch" && student?.batch?.toString() === notice.batch?.toString()) ||
      (notice.audience === "student" && notice.students?.map(s => s._id?.toString() || s.toString()).includes(studentId));

    if (!isAudienceAllowed) {
      res.status(403);
      throw new Error("Forbidden access to this notice.");
    }
  }

  res.json(notice);
});

export const createNotice = asyncHandler(async (req, res) => {
  const { title, message, audience, batch, students, teachers, priority, expiresAt } = req.body;

  if (req.user.role === "teacher") {
    if (audience !== "batch") {
      res.status(403);
      throw new Error("Teachers cannot create institute-wide notices.");
    }
    const assigned = req.user.assignedBatches || [];
    if (!batch || !assigned.includes(batch.toString())) {
      res.status(403);
      throw new Error("Teachers can only create notices for their assigned batches.");
    }
  }

  const parsedStudents = Array.isArray(students) ? students : (students ? [students] : []);
  const parsedTeachers = Array.isArray(teachers) ? teachers : (teachers ? [teachers] : []);

  const notice = await Notice.create({
    title,
    message,
    audience,
    batch: audience === "batch" ? batch : undefined,
    students: audience === "student" ? parsedStudents : [],
    teachers: audience === "teacher" ? parsedTeachers : [],
    priority,
    expiresAt,
    createdBy: req.user._id
  });

  res.status(201).json(await notice.populate(populate));
});

export const updateNotice = asyncHandler(async (req, res) => {
  const { title, message, audience, batch, students, teachers, priority, expiresAt } = req.body;
  const notice = await Notice.findById(req.params.id);
  if (!notice) {
    res.status(404);
    throw new Error("Notice not found");
  }

  if (req.user.role === "teacher") {
    if (notice.createdBy.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Teachers can only edit notices created by themselves.");
    }
    if (audience !== "batch") {
      res.status(403);
      throw new Error("Teachers cannot edit notices to be institute-wide.");
    }
    const assigned = req.user.assignedBatches || [];
    if (!batch || !assigned.includes(batch.toString())) {
      res.status(403);
      throw new Error("Teachers can only assign notices to their assigned batches.");
    }
  }

  const parsedStudents = Array.isArray(students) ? students : (students ? [students] : []);
  const parsedTeachers = Array.isArray(teachers) ? teachers : (teachers ? [teachers] : []);

  notice.title = title;
  notice.message = message;
  notice.audience = audience;
  notice.batch = audience === "batch" ? batch : undefined;
  notice.students = audience === "student" ? parsedStudents : [];
  notice.teachers = audience === "teacher" ? parsedTeachers : [];
  notice.priority = priority;
  notice.expiresAt = expiresAt;

  await notice.save();
  res.json(await notice.populate(populate));
});

export const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) {
    res.status(404);
    throw new Error("Notice not found");
  }

  if (req.user.role === "teacher" && notice.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Teachers can only delete notices created by themselves.");
  }

  await Notice.findByIdAndDelete(req.params.id);
  res.json({ message: "Notice deleted successfully" });
});

export const deleteMultipleNotices = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No IDs provided");
  }

  if (req.user.role === "teacher") {
    const ownNoticesCount = await Notice.countDocuments({ _id: { $in: ids }, createdBy: req.user._id });
    if (ownNoticesCount !== ids.length) {
      res.status(403);
      throw new Error("Teachers can only delete notices created by themselves.");
    }
  }

  await Notice.deleteMany({ _id: { $in: ids } });
  res.json({ message: "Notices deleted successfully" });
});
