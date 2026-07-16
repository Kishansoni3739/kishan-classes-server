import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    audience: { type: String, enum: ["all", "students", "teachers", "batch", "student", "teacher"], default: "all", index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: Date,
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" }
  },
  { timestamps: true }
);

export const Notice = mongoose.model("Notice", noticeSchema);
