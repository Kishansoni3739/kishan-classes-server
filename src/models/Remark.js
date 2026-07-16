import mongoose from "mongoose";

const remarkSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    teacherName: { type: String, required: true },
    category: { type: String, enum: ["academic", "behavioral"], default: "academic", required: true },
    text: { type: String, required: true }
  },
  { timestamps: true }
);

export const Remark = mongoose.model("Remark", remarkSchema);
