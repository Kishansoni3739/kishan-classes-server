import { Batch } from "../models/Batch.js";
import { Teacher } from "../models/Teacher.js";
import { buildCrudController } from "./crudController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const populate = [
  { path: "subjects", select: "name code" },
  { path: "teachers", populate: { path: "user", select: "name email" } },
  { path: "students", populate: { path: "user", select: "name email" } }
];

const base = buildCrudController(Batch, { 
  populate, 
  searchFields: ["name", "schedule", "room"],
  scope: (req, query) => {
    if (req.user && req.user.role === "teacher") {
      return { ...query, _id: { $in: req.user.assignedBatches || [] } };
    }
    return query;
  }
});

export const listBatches = base.list;
export const getBatch = base.get;

export const createBatch = asyncHandler(async (req, res) => {
  const { name, schedule, room, subjects, teachers, students, isActive, feePlan } = req.body;
  
  const batch = await Batch.create({
    name,
    schedule,
    room,
    subjects,
    teachers,
    students,
    isActive,
    feePlan
  });

  if (teachers && teachers.length > 0) {
    await Teacher.updateMany({ _id: { $in: teachers } }, { $addToSet: { batches: batch._id } });
  }

  res.status(201).json(await batch.populate(populate));
});

export const updateBatch = asyncHandler(async (req, res) => {
  const { name, schedule, room, subjects, teachers, students, isActive, feePlan } = req.body;
  
  const batch = await Batch.findByIdAndUpdate(req.params.id, {
    name,
    schedule,
    room,
    subjects,
    teachers,
    students,
    isActive,
    feePlan
  }, { new: true, runValidators: true });

  if (!batch) {
    res.status(404);
    throw new Error("Batch not found");
  }

  // Synchronize many-to-many relationship with Teacher
  await Teacher.updateMany({ batches: batch._id }, { $pull: { batches: batch._id } });
  if (teachers && teachers.length > 0) {
    await Teacher.updateMany({ _id: { $in: teachers } }, { $addToSet: { batches: batch._id } });
  }

  res.json(await batch.populate(populate));
});

export const deleteBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findByIdAndDelete(req.params.id);
  if (!batch) {
    res.status(404);
    throw new Error("Batch not found");
  }

  // Clean up batches from assigned teachers
  await Teacher.updateMany({ batches: batch._id }, { $pull: { batches: batch._id } });

  res.json({ message: "Batch deleted successfully" });
});

export const deleteMultipleBatches = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No IDs provided");
  }

  await Teacher.updateMany({ batches: { $in: ids } }, { $pull: { batches: { $in: ids } } });
  await Batch.deleteMany({ _id: { $in: ids } });

  res.json({ message: "Batches deleted successfully" });
});
