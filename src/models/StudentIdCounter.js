import mongoose from "mongoose";

const studentIdCounterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true },
    lastSequence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const StudentIdCounter = mongoose.model("StudentIdCounter", studentIdCounterSchema);
