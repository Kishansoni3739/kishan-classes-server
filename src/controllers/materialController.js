import { StudyMaterial } from "../models/StudyMaterial.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { User } from "../models/User.js";
import { Subject } from "../models/Subject.js";
import { Batch } from "../models/Batch.js";
import { MaterialDownload } from "../models/MaterialDownload.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { uploadToImageKitDetailed, deleteFromImageKit } from "../utils/imagekit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import fs from "node:fs";
import path from "node:path";

export { upload };

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt",
  "jpg", "jpeg", "png", "webp", "gif", "zip"
];

const populate = [
  { path: "subject", select: "name code" },
  { path: "recipientBatchIds", select: "name" },
  { path: "recipientStudentIds", populate: { path: "user", select: "name studentId" } },
  { path: "recipientTeacherIds", populate: { path: "user", select: "name employeeId" } },
  { path: "uploadedBy", select: "name role" }
];

// ──────────── FILE UPLOAD ────────────
export const uploadFiles = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const ext = path.extname(req.file.originalname).toLowerCase().substring(1);
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting invalid file:", err.message);
      }
    }
    res.status(400);
    throw new Error(`Unsupported file format. Supported formats: ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()}`);
  }

  try {
    const folderPath = "/study-materials";
    const uploadResult = await uploadToImageKitDetailed(req.file.path, req.file.filename, folderPath);

    res.json({
      url: uploadResult.url,
      fileId: uploadResult.fileId,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date()
    });
  } catch (err) {
    res.status(500);
    throw new Error(`ImageKit Upload failed: ${err.message}`);
  }
});

// ──────────── LIST MATERIALS ────────────
export const listMaterials = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, subject, uploader, audienceType, dateRange, batch, sortBy } = req.query;
  const andConditions = [{ deletedAt: null }];

  // 1. Role-based visibility
  if (req.user.role === "teacher") {
    const teacherProfile = await Teacher.findOne({ user: req.user._id });
    const teacherId = teacherProfile?._id;
    const teacherBatches = req.user.assignedBatches || []; // array of batch IDs as strings

    andConditions.push({
      $or: [
        { uploadedBy: req.user._id }, // Own uploads
        { uploaderRole: "admin", audienceType: "all" }, // Shared with everyone
        { uploaderRole: "admin", audienceType: "teachers" }, // Shared with all teachers
        // Admin uploads shared with teacher's assigned batches
        ...(teacherBatches.length > 0 ? [{ uploaderRole: "admin", audienceType: "batch", recipientBatchIds: { $in: teacherBatches } }] : []),
        // Admin uploads shared specifically with this teacher
        ...(teacherId ? [{ uploaderRole: "admin", audienceType: "particular-teachers", recipientTeacherIds: teacherId }] : [])
      ]
    });
  } else if (req.user.role === "student") {
    const studentProfile = await Student.findOne({ user: req.user._id });
    const studentId = studentProfile?._id;
    const batchId = studentProfile?.batch;
    andConditions.push({
      $or: [
        { audienceType: "all" },
        { audienceType: "students" },
        ...(batchId ? [{ audienceType: "batch", recipientBatchIds: batchId }] : []),
        ...(studentId ? [{ audienceType: "particular-students", recipientStudentIds: studentId }] : [])
      ]
    });
  }

  // 2. Search implementation
  if (search) {
    const searchRegex = new RegExp(search, "i");
    const orConditions = [
      { title: searchRegex },
      { description: searchRegex },
      { "files.name": searchRegex }
    ];

    const subjects = await Subject.find({ name: searchRegex }).select("_id");
    if (subjects.length > 0) {
      orConditions.push({ subject: { $in: subjects.map(s => s._id) } });
    }

    const users = await User.find({ name: searchRegex }).select("_id");
    if (users.length > 0) {
      orConditions.push({ uploadedBy: { $in: users.map(u => u._id) } });
    }

    const batches = await Batch.find({ name: searchRegex }).select("_id");
    if (batches.length > 0) {
      orConditions.push({ recipientBatchIds: { $in: batches.map(b => b._id) } });
    }

    const studentUsers = await User.find({ name: searchRegex, role: "STUDENT" }).select("_id");
    const students = await Student.find({
      $or: [
        { studentId: searchRegex },
        { user: { $in: studentUsers.map(u => u._id) } }
      ]
    }).select("_id");
    if (students.length > 0) {
      orConditions.push({ recipientStudentIds: { $in: students.map(s => s._id) } });
    }

    const teacherUsers = await User.find({ name: searchRegex, role: "TEACHER" }).select("_id");
    const teachers = await Teacher.find({
      $or: [
        { employeeId: searchRegex },
        { user: { $in: teacherUsers.map(u => u._id) } }
      ]
    }).select("_id");
    if (teachers.length > 0) {
      orConditions.push({ recipientTeacherIds: { $in: teachers.map(t => t._id) } });
    }

    andConditions.push({ $or: orConditions });
  }

  // 3. Filters implementation
  if (subject) {
    andConditions.push({ subject });
  }
  if (uploader) {
    andConditions.push({ uploadedBy: uploader });
  }
  if (audienceType) {
    andConditions.push({ audienceType });
  }
  if (batch) {
    andConditions.push({ recipientBatchIds: batch });
  }
  if (dateRange) {
    try {
      const dates = JSON.parse(dateRange);
      const dateQuery = {};
      if (dates.start) dateQuery.$gte = new Date(dates.start);
      if (dates.end) dateQuery.$lte = new Date(dates.end);
      if (Object.keys(dateQuery).length > 0) {
        andConditions.push({ createdAt: dateQuery });
      }
    } catch (e) {
      andConditions.push({
        createdAt: {
          $gte: new Date(dateRange),
          $lte: new Date(new Date(dateRange).setHours(23, 59, 59, 999))
        }
      });
    }
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {};

  // 4. Sorting implementation
  let sort = { createdAt: -1 };
  if (sortBy) {
    if (sortBy === "oldest") sort = { createdAt: 1 };
    else if (sortBy === "title") sort = { title: 1 };
    else if (sortBy === "subject") sort = { subject: 1 };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    StudyMaterial.find(query)
      .populate(populate)
      .sort(sort)
      .skip(skip)
      .limit(Math.min(Number(limit), 1000)),
    StudyMaterial.countDocuments(query)
  ]);

  res.json({
    items,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1
  });
});

// ──────────── GET DETAIL ────────────
export const getMaterial = asyncHandler(async (req, res) => {
  const item = await StudyMaterial.findById(req.params.id).populate(populate);
  if (!item || item.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  const role = req.user.role;

  // Visibility Check (verify they have access to it)
  if (role === "teacher") {
    const teacherProfile = await Teacher.findOne({ user: req.user._id });
    const teacherId = teacherProfile?._id;
    const teacherBatches = req.user.assignedBatches || []; // array of batch IDs as strings

    const isOwner = (item.uploadedBy?._id || item.uploadedBy || "").toString() === req.user._id.toString();
    const isSharedToAll = item.uploaderRole === "admin" && (item.audienceType === "all" || item.audienceType === "teachers");
    
    const isSharedToMe = item.uploaderRole === "admin" && 
      item.audienceType === "particular-teachers" && 
      teacherId && 
      (item.recipientTeacherIds || []).some(t => (t._id || t).toString() === teacherId.toString());

    const isSharedToMyBatch = item.uploaderRole === "admin" && 
      item.audienceType === "batch" && 
      (item.recipientBatchIds || []).some(b => teacherBatches.includes((b._id || b).toString()));

    if (!isOwner && !isSharedToAll && !isSharedToMe && !isSharedToMyBatch) {
      res.status(403);
      throw new Error("Access denied. You do not have permission to view this material.");
    }
  } else if (role === "student") {
    const studentProfile = await Student.findOne({ user: req.user._id });
    const studentId = studentProfile?._id;
    const batchId = studentProfile?.batch;
    const isSharedToAll = item.audienceType === "all" || item.audienceType === "students";
    
    const isSharedToBatch = item.audienceType === "batch" && 
      batchId && 
      (item.recipientBatchIds || []).some(b => (b._id || b).toString() === batchId.toString());
      
    const isSharedToMe = item.audienceType === "particular-students" && 
      studentId && 
      (item.recipientStudentIds || []).some(s => (s._id || s).toString() === studentId.toString());

    if (!isSharedToAll && !isSharedToBatch && !isSharedToMe) {
      res.status(403);
      throw new Error("Access denied. You do not have permission to view this material.");
    }
  }

  // Calculate unique downloads
  const uniqueUsers = await MaterialDownload.distinct("user", { material: item._id });
  const uniqueDownloadsCount = uniqueUsers.length;

  // Fetch recent download logs for details view (admin/uploader only)
  let downloadLogs = [];
  const isAdmin = role === "admin";
  const isUploader = (item.uploadedBy?._id || item.uploadedBy || "").toString() === req.user._id.toString();
  if (isAdmin || isUploader) {
    downloadLogs = await MaterialDownload.find({ material: item._id })
      .sort({ downloadedAt: -1 })
      .limit(50);
  }

  res.json({
    ...item.toObject(),
    uniqueDownloads: uniqueDownloadsCount,
    downloadLogs
  });
});

// ──────────── CREATE MATERIAL ────────────
export const createMaterial = asyncHandler(async (req, res) => {
  const {
    title,
    subject,
    description,
    audienceType,
    recipientStudentIds,
    recipientTeacherIds,
    recipientBatchIds,
    files,
    externalUrls,
    whatsappEnabled
  } = req.body;

  if (!title || !subject || !audienceType) {
    res.status(400);
    throw new Error("Title, subject, and audienceType are required.");
  }

  if (title.length > 150) {
    res.status(400);
    throw new Error("Title cannot exceed 150 characters.");
  }

  if (description && description.length > 3000) {
    res.status(400);
    throw new Error("Description cannot exceed 3000 characters.");
  }

  const role = req.user.role;
  let finalStudentIds = recipientStudentIds || [];
  let finalTeacherIds = recipientTeacherIds || [];
  let finalBatchIds = recipientBatchIds || [];

  if (role === "teacher") {
    if (audienceType !== "batch" && audienceType !== "particular-students") {
      res.status(403);
      throw new Error("Teachers can only share materials with assigned batches or particular students from assigned batches.");
    }

    const teacherBatches = req.user.assignedBatches || [];

    if (audienceType === "batch") {
      if (finalBatchIds.length === 0) {
        res.status(400);
        throw new Error("At least one batch must be selected.");
      }
      const hasUnauthorizedBatch = finalBatchIds.some(bId => !teacherBatches.includes(bId.toString()));
      if (hasUnauthorizedBatch) {
        res.status(403);
        throw new Error("You can only share materials with your assigned batches.");
      }
      finalStudentIds = [];
      finalTeacherIds = [];
    } else if (audienceType === "particular-students") {
      if (finalStudentIds.length === 0) {
        res.status(400);
        throw new Error("At least one student must be selected.");
      }
      const targetStudents = await Student.find({ _id: { $in: finalStudentIds } });
      const isAllAssigned = targetStudents.every(s => s.batch && teacherBatches.includes(s.batch.toString()));
      if (!isAllAssigned) {
        res.status(403);
        throw new Error("You can only share materials with students in your assigned batches.");
      }
      finalTeacherIds = [];
      finalBatchIds = [];
    }
  } else if (role === "admin") {
    if (audienceType === "all") {
      finalStudentIds = [];
      finalTeacherIds = [];
      finalBatchIds = [];
    } else if (audienceType === "students") {
      finalTeacherIds = [];
      finalBatchIds = [];
    } else if (audienceType === "teachers") {
      finalStudentIds = [];
      finalBatchIds = [];
    } else if (audienceType === "particular-students") {
      finalTeacherIds = [];
      finalBatchIds = [];
    } else if (audienceType === "particular-teachers") {
      finalStudentIds = [];
      finalBatchIds = [];
    } else if (audienceType === "batch") {
      finalStudentIds = [];
      finalTeacherIds = [];
    }
  }

  const parsedFiles = Array.isArray(files) ? files : [];
  if (parsedFiles.length > 20) {
    res.status(400);
    throw new Error("Maximum of 20 files are allowed per material.");
  }
  parsedFiles.forEach(f => {
    if (!f.url || !f.name || !f.size || !f.mimeType) {
      res.status(400);
      throw new Error("Invalid file upload data. Please re-upload.");
    }
    const ext = path.extname(f.name).toLowerCase().substring(1);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      res.status(400);
      throw new Error(`File extension .${ext} is not allowed.`);
    }
  });

  const parsedUrls = Array.isArray(externalUrls) ? externalUrls.filter(Boolean) : [];
  parsedUrls.forEach(url => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      res.status(400);
      throw new Error(`Invalid URL: ${url}. External URLs must start with http:// or https://`);
    }
  });

  const material = await StudyMaterial.create({
    title,
    subject,
    description,
    audienceType,
    recipientStudentIds: finalStudentIds,
    recipientTeacherIds: finalTeacherIds,
    recipientBatchIds: finalBatchIds,
    uploadedBy: req.user._id,
    uploaderRole: role,
    files: parsedFiles,
    externalUrls: parsedUrls,
    whatsappEnabled: !!whatsappEnabled,
    whatsappNotificationStatus: whatsappEnabled ? "pending" : "none",
    totalDownloads: 0,
    deletedAt: null
  });

  res.status(201).json(await material.populate(populate));
});

// ──────────── UPDATE MATERIAL ────────────
export const updateMaterial = asyncHandler(async (req, res) => {
  const {
    title,
    subject,
    description,
    audienceType,
    recipientStudentIds,
    recipientTeacherIds,
    recipientBatchIds,
    files,
    externalUrls,
    whatsappEnabled,
    whatsappNotificationStatus
  } = req.body;

  const material = await StudyMaterial.findById(req.params.id);
  if (!material || material.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  const role = req.user.role;
  const isOwner = (material.uploadedBy?._id || material.uploadedBy || "").toString() === req.user._id.toString();

  if (role !== "admin" && !isOwner) {
    res.status(403);
    throw new Error("You do not have permission to edit this material.");
  }

  if (title) {
    if (title.length > 150) {
      res.status(400);
      throw new Error("Title cannot exceed 150 characters.");
    }
    material.title = title;
  }
  if (subject) material.subject = subject;
  if (description !== undefined) {
    if (description && description.length > 3000) {
      res.status(400);
      throw new Error("Description cannot exceed 3000 characters.");
    }
    material.description = description;
  }

  if (audienceType) {
    let finalStudentIds = recipientStudentIds || [];
    let finalTeacherIds = recipientTeacherIds || [];
    let finalBatchIds = recipientBatchIds || [];

    if (role === "teacher") {
      if (audienceType !== "batch" && audienceType !== "particular-students") {
        res.status(403);
        throw new Error("Teachers can only share materials with assigned batches or particular students from assigned batches.");
      }

      const teacherBatches = req.user.assignedBatches || [];

      if (audienceType === "batch") {
        if (finalBatchIds.length === 0) {
          res.status(400);
          throw new Error("At least one batch must be selected.");
        }
        const hasUnauthorizedBatch = finalBatchIds.some(bId => !teacherBatches.includes(bId.toString()));
        if (hasUnauthorizedBatch) {
          res.status(403);
          throw new Error("You can only share materials with your assigned batches.");
        }
        finalStudentIds = [];
        finalTeacherIds = [];
      } else if (audienceType === "particular-students") {
        if (finalStudentIds.length === 0) {
          res.status(400);
          throw new Error("At least one student must be selected.");
        }
        const targetStudents = await Student.find({ _id: { $in: finalStudentIds } });
        const isAllAssigned = targetStudents.every(s => s.batch && teacherBatches.includes(s.batch.toString()));
        if (!isAllAssigned) {
          res.status(403);
          throw new Error("You can only share materials with students in your assigned batches.");
        }
        finalTeacherIds = [];
        finalBatchIds = [];
      }
    } else if (role === "admin") {
      if (audienceType === "all") {
        finalStudentIds = [];
        finalTeacherIds = [];
        finalBatchIds = [];
      } else if (audienceType === "students") {
        finalTeacherIds = [];
        finalBatchIds = [];
      } else if (audienceType === "teachers") {
        finalStudentIds = [];
        finalBatchIds = [];
      } else if (audienceType === "particular-students") {
        finalTeacherIds = [];
        finalBatchIds = [];
      } else if (audienceType === "particular-teachers") {
        finalStudentIds = [];
        finalBatchIds = [];
      } else if (audienceType === "batch") {
        finalStudentIds = [];
        finalTeacherIds = [];
      }
    }

    material.audienceType = audienceType;
    material.recipientStudentIds = finalStudentIds;
    material.recipientTeacherIds = finalTeacherIds;
    material.recipientBatchIds = finalBatchIds;
  }

  if (files) {
    const parsedFiles = Array.isArray(files) ? files : [];
    if (parsedFiles.length > 20) {
      res.status(400);
      throw new Error("Maximum of 20 files are allowed per material.");
    }
    parsedFiles.forEach(f => {
      if (!f.url || !f.name || !f.size || !f.mimeType) {
        res.status(400);
        throw new Error("Invalid file upload data. Please re-upload.");
      }
      const ext = path.extname(f.name).toLowerCase().substring(1);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        res.status(400);
        throw new Error(`File extension .${ext} is not allowed.`);
      }
    });

    // Detect and delete removed files from ImageKit
    const oldFiles = material.files || [];
    const newUrls = parsedFiles.map(f => f.url);
    const removedFiles = oldFiles.filter(f => !newUrls.includes(f.url));
    for (const file of removedFiles) {
      if (file.fileId) {
        await deleteFromImageKit(file.fileId);
      }
    }

    material.files = parsedFiles;
  }

  if (externalUrls) {
    const parsedUrls = Array.isArray(externalUrls) ? externalUrls.filter(Boolean) : [];
    parsedUrls.forEach(url => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        res.status(400);
        throw new Error(`Invalid URL: ${url}. External URLs must start with http:// or https://`);
      }
    });
    material.externalUrls = parsedUrls;
  }

  if (whatsappEnabled !== undefined) {
    material.whatsappEnabled = !!whatsappEnabled;
  }
  if (whatsappNotificationStatus) {
    material.whatsappNotificationStatus = whatsappNotificationStatus;
  }

  await material.save();
  res.json(await material.populate(populate));
});

// ──────────── SOFT DELETE MATERIAL ────────────
export const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await StudyMaterial.findById(req.params.id);
  if (!material || material.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  const isOwner = (material.uploadedBy?._id || material.uploadedBy || "").toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isOwner) {
    res.status(403);
    throw new Error("You do not have permission to delete this material.");
  }

  // Clean up files from ImageKit
  if (material.files && material.files.length > 0) {
    for (const file of material.files) {
      if (file.fileId) {
        await deleteFromImageKit(file.fileId);
      }
    }
  }

  material.deletedAt = new Date();
  await material.save();

  res.json({ message: "Material deleted successfully (soft delete)" });
});

// ──────────── BULK DELETE ────────────
export const deleteMultipleMaterials = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No IDs provided");
  }

  if (req.user.role === "teacher") {
    const ownMaterialsCount = await StudyMaterial.countDocuments({
      _id: { $in: ids },
      uploadedBy: req.user._id,
      deletedAt: null
    });
    if (ownMaterialsCount !== ids.length) {
      res.status(403);
      throw new Error("Teachers can only delete study materials uploaded by themselves.");
    }
  }

  // Detect and delete files from ImageKit for all targets
  const materialsToDelete = await StudyMaterial.find({ _id: { $in: ids }, deletedAt: null });
  for (const mat of materialsToDelete) {
    if (mat.files && mat.files.length > 0) {
      for (const file of mat.files) {
        if (file.fileId) {
          await deleteFromImageKit(file.fileId);
        }
      }
    }
  }

  await StudyMaterial.updateMany(
    { _id: { $in: ids }, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );

  res.json({ message: "Materials deleted successfully" });
});

// ──────────── DOWNLOAD TRACKING & REDIRECT ────────────
export const downloadMaterial = asyncHandler(async (req, res) => {
  const { fileUrl } = req.query;
  const materialId = req.params.id;

  if (!fileUrl) {
    res.status(400);
    throw new Error("fileUrl is required.");
  }

  const material = await StudyMaterial.findById(materialId);
  if (!material || material.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  const file = material.files.find(f => f.url === fileUrl);
  const fileName = file ? file.name : "External Attachment";

  await MaterialDownload.create({
    material: materialId,
    user: req.user._id,
    userName: req.user.name || req.user.username,
    userRole: req.user.role,
    fileName,
    downloadedAt: new Date()
  });

  material.totalDownloads = (material.totalDownloads || 0) + 1;
  await material.save();

  res.redirect(fileUrl);
});

// ──────────── DIRECT DOWNLOAD LOG RECORD ────────────
export const recordDownload = asyncHandler(async (req, res) => {
  const { fileName } = req.body;
  const materialId = req.params.id;

  if (!fileName) {
    res.status(400);
    throw new Error("fileName is required.");
  }

  const material = await StudyMaterial.findById(materialId);
  if (!material || material.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  await MaterialDownload.create({
    material: materialId,
    user: req.user._id,
    userName: req.user.name || req.user.username,
    userRole: req.user.role,
    fileName,
    downloadedAt: new Date()
  });

  material.totalDownloads = (material.totalDownloads || 0) + 1;
  await material.save();

  res.json({
    message: "Download logged successfully",
    totalDownloads: material.totalDownloads
  });
});

// ──────────── GENERATE WHATSAPP MESSAGE PREVIEWS ────────────
export const getWhatsappPreview = asyncHandler(async (req, res) => {
  const materialId = req.params.id;
  const material = await StudyMaterial.findById(materialId).populate(populate);

  if (!material || material.deletedAt) {
    res.status(404);
    throw new Error("Material not found");
  }

  const isOwner = (material.uploadedBy?._id || material.uploadedBy || "").toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isOwner) {
    res.status(403);
    throw new Error("You do not have permission to view notifications for this material.");
  }

  const { WhatsAppTemplate } = await import("../models/WhatsAppTemplate.js");
  const template = await WhatsAppTemplate.findOne({ name: "Material Shared" }) || {
    messageBody: `Dear {{recipient_name}},\n\nNew study material has been shared with you:\n\nTitle: {{title}}\nSubject: {{subject}}\nShared By: {{uploader}}\n\nYou can access and download it from the student portal.\n\nRegards,\nKishan Classes`,
    variables: ["recipient_name", "title", "subject", "uploader"]
  };

  const uploaderName = material.uploadedBy?.name || req.user.name || "Kishan Classes";
  const subjectName = material.subject?.name || "General";

  const recipients = [];
  const teacherBatches = req.user.role === "teacher" ? (req.user.assignedBatches || []) : [];

  if (["all", "students", "particular-students", "batch"].includes(material.audienceType)) {
    const studentQuery = { status: "active" };

    if (material.audienceType === "batch") {
      studentQuery.batch = { $in: material.recipientBatchIds };
    } else if (material.audienceType === "particular-students") {
      studentQuery._id = { $in: material.recipientStudentIds };
    }

    const students = await Student.find(studentQuery).populate("user");
    
    let filteredStudents = students;
    if (req.user.role === "teacher") {
      filteredStudents = students.filter(s => s.batch && teacherBatches.includes(s.batch.toString()));
    }

    filteredStudents.forEach(s => {
      const phone = s.guardian?.phone || s.user?.phone;
      if (phone) {
        const recipientName = s.guardian?.name || s.user?.name || "Parent";
        let message = template.messageBody;
        message = message.replace(/{{recipient_name}}/g, recipientName)
                         .replace(/{{title}}/g, material.title)
                         .replace(/{{subject}}/g, subjectName)
                         .replace(/{{uploader}}/g, uploaderName);

        recipients.push({
          name: s.user?.name || recipientName,
          phone,
          message
        });
      }
    });
  }

  if (req.user.role === "admin" && ["all", "teachers", "particular-teachers"].includes(material.audienceType)) {
    const teacherQuery = {};
    if (material.audienceType === "particular-teachers") {
      teacherQuery._id = { $in: material.recipientTeacherIds };
    }

    const teachers = await Teacher.find(teacherQuery).populate("user");
    teachers.forEach(t => {
      const phone = t.user?.phone;
      if (phone) {
        const recipientName = t.user?.name || "Teacher";
        let message = template.messageBody;
        message = message.replace(/{{recipient_name}}/g, recipientName)
                         .replace(/{{title}}/g, material.title)
                         .replace(/{{subject}}/g, subjectName)
                         .replace(/{{uploader}}/g, uploaderName);

        recipients.push({
          name: recipientName,
          phone,
          message
        });
      }
    });
  }

  res.json({ recipients });
});
