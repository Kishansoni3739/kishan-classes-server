import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", index: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    testDate: { type: Date, required: true, index: true },
    maxMarks: { type: Number, required: true, min: 1 },
    description: String,
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: Date
  },
  { timestamps: true }
);

export const Test = mongoose.model("Test", testSchema);
