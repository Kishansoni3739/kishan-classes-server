import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
  {
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    marksObtained: { type: Number, min: 0 },
    isAbsent: { type: Boolean, default: false },
    percentage: { type: Number, min: 0, max: 100 },
    grade: String,
    remarks: String,
    rank: Number,
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

resultSchema.index({ test: 1, student: 1 }, { unique: true });

export const Result = mongoose.model("Result", resultSchema);
