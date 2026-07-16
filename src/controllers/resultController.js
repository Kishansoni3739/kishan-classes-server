import { Result } from "../models/Result.js";
import { Test } from "../models/Test.js";
import { Student } from "../models/Student.js";
import { buildCrudController } from "./crudController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const gradeFor = (percentage) => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "Needs Improvement";
};

const populate = [
  { path: "test", populate: [{ path: "subject", select: "name code" }, { path: "batch", select: "name" }] },
  { path: "student", populate: { path: "user", select: "name email" } },
  { path: "enteredBy", select: "name role" }
];

const base = buildCrudController(Result, { 
  populate,
  scope: async (req, query) => {
    if (req.user && req.user.role === "teacher") {
      const assigned = req.user.assignedBatches || [];
      const studentIds = await Student.find({ batch: { $in: assigned } }).distinct("_id");
      return { ...query, student: { $in: studentIds } };
    }
    return query;
  }
});

export const listResults = base.list;
export const getResult = base.get;
export const deleteResult = base.remove;
export const deleteMultipleResults = base.removeMultiple;

export const upsertResult = asyncHandler(async (req, res) => {
  const { test, student, marksObtained, remarks } = req.body;
  const testDoc = await Test.findById(test);
  if (!testDoc) {
    res.status(404);
    throw new Error("Test not found");
  }

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = testDoc.batch?.toString();
    if (batchId && !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("Teachers can only enter marks for their assigned batches.");
    }
  }

  if (marksObtained < 0 || marksObtained > testDoc.maxMarks) {
    res.status(400);
    throw new Error(`Marks obtained must be between 0 and ${testDoc.maxMarks}.`);
  }

  const percentage = Number(((marksObtained / testDoc.maxMarks) * 100).toFixed(2));
  const result = await Result.findOneAndUpdate(
    { test, student },
    {
      test,
      student,
      marksObtained,
      percentage,
      grade: gradeFor(percentage),
      remarks,
      enteredBy: req.user._id
    },
    { upsert: true, new: true, runValidators: true }
  ).populate(populate);

  res.status(201).json(result);
});

export const updateResult = upsertResult;
