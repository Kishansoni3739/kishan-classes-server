import { User } from "../models/User.js";
import { Teacher } from "../models/Teacher.js";
import { Batch } from "../models/Batch.js";
import { buildCrudController } from "./crudController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToImageKitDetailed, deleteFromImageKit } from "../utils/imagekit.js";

const populate = [
  { path: "user", select: "name email phone role isActive" },
  { path: "subjects", select: "name code" },
  { path: "batches", select: "name schedule" }
];

const base = buildCrudController(Teacher, {
  populate,
  searchFields: ["employeeId", "qualification", "address"],
  scope: (req, query) => {
    if (req.user.role === "teacher") return { ...query, user: req.user._id };
    return query;
  }
});

export const listTeachers = base.list;
export const getTeacher = base.get;

export const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, phone, ...teacherData } = req.body;

  // Generate employee ID automatically
  const count = await Teacher.countDocuments();
  const year = new Date().getFullYear();
  const employeeId = `TCH-${year}-${String(count + 1).padStart(3, '0')}`;

  // Extract teacher's first name for initial password (strip common titles if any)
  const cleanName = name.trim().replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '');
  const firstName = cleanName.split(/\s+/)[0] || name.trim().split(/\s+/)[0];

  const userData = {
    username: employeeId,
    passwordHash: firstName, // Initial password is teacher's first name
    role: "TEACHER",
    mustChangePassword: true,
    name,
    phone,
    isActive: true
  };

  if (email && email.trim() !== "") {
    userData.email = email.trim().toLowerCase();
  }

  const user = await User.create(userData);

  const teacher = await Teacher.create({
    ...teacherData,
    employeeId,
    user: user._id
  });

  // Link teacher ID back to auth User document
  user.linkedId = teacher._id;
  await user.save();

  await Batch.updateMany({ _id: { $in: teacher.batches } }, { $addToSet: { teachers: teacher._id } });
  res.status(201).json(await teacher.populate(populate));
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const teacherObj = await Teacher.findById(req.params.id);
  if (!teacherObj) {
    res.status(404);
    throw new Error("Teacher not found");
  }

  // Teacher role constraint - can only edit self, and cannot edit certain sensitive fields
  if (req.user.role === "teacher") {
    if (teacherObj.user.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("You are not authorized to update this profile.");
    }
  }

  let { name, email, phone, ...teacherData } = req.body;

  if (req.user.role === "teacher") {
    // Prevent updating sensitive fields
    delete teacherData.employeeId;
    delete teacherData.batches;
    delete teacherData.subjects;
    delete teacherData.salary;
  }

  const teacher = await Teacher.findByIdAndUpdate(req.params.id, teacherData, {
    new: true,
    runValidators: true
  });

  if (name || email !== undefined || phone) {
    const user = await User.findById(teacher.user);
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
      await user.save();
    }
  }

  if (req.user.role !== "teacher") {
    await Batch.updateMany({ teachers: teacher._id }, { $pull: { teachers: teacher._id } });
    await Batch.updateMany({ _id: { $in: teacher.batches } }, { $addToSet: { teachers: teacher._id } });
  }

  res.json(await teacher.populate(populate));
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findByIdAndDelete(req.params.id);
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }
  await User.findByIdAndUpdate(teacher.user, { isActive: false });
  await Batch.updateMany({ teachers: teacher._id }, { $pull: { teachers: teacher._id } });
  res.json({ message: "Teacher deleted" });
});

export const deleteMultipleTeachers = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No IDs provided");
  }

  const teachers = await Teacher.find({ _id: { $in: ids } });
  if (teachers.length === 0) {
    return res.json({ message: "No teachers found to delete" });
  }

  const teacherIds = teachers.map(t => t._id);
  const userIds = teachers.map(t => t.user);

  await User.updateMany({ _id: { $in: userIds } }, { isActive: false });
  await Batch.updateMany({ teachers: { $in: teacherIds } }, { $pull: { teachers: { $in: teacherIds } } });
  await Teacher.deleteMany({ _id: { $in: teacherIds } });

  res.json({ message: "Teachers deleted successfully" });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }
  
  if (!req.file) {
    res.status(400);
    throw new Error("Please upload an image file");
  }
  
  const user = await User.findById(teacher.user);
  if (!user) {
    res.status(404);
    throw new Error("User associated with teacher not found");
  }

  // Delete previous avatar from ImageKit if it exists
  if (user.avatarFileId) {
    await deleteFromImageKit(user.avatarFileId);
  }
  
  const uploadResult = await uploadToImageKitDetailed(req.file.path, req.file.filename, "/avatars/teachers");
  user.avatarUrl = uploadResult.url;
  user.avatarFileId = uploadResult.fileId;
  await user.save();
  
  res.json({ avatarUrl: user.avatarUrl, message: "Profile picture updated successfully" });
});
