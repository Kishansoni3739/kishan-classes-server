import { StudentIdCounter } from "../models/StudentIdCounter.js";
import { Setting } from "../models/Setting.js";

export const generateStudentId = async (admissionDate) => {
  const date = admissionDate ? new Date(admissionDate) : new Date();
  const year = date.getFullYear();

  const setting = await Setting.findOne({ key: "STUDENT_ID_PREFIX" });
  const prefix = setting && setting.value ? setting.value : "KC";

  const counter = await StudentIdCounter.findOneAndUpdate(
    { year },
    { $inc: { lastSequence: 1 } },
    { new: true, upsert: true }
  );

  const sequenceStr = String(counter.lastSequence).padStart(5, "0");
  return `${prefix}-${year}-${sequenceStr}`;
};
