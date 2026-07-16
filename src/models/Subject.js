import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: String,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

subjectSchema.index({ name: 1 }, { unique: true });

export const Subject = mongoose.model("Subject", subjectSchema);
