import mongoose from "mongoose";

const monthlyEnrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", index: true },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
  admissionDate: { type: Date, default: Date.now },
  monthlyFee: { type: Number, min: 0, required: true },
  status: { type: String, enum: ["active", "inactive", "suspended"], default: "active", index: true }
}, { timestamps: true });

export const MonthlyEnrollment = mongoose.model("MonthlyEnrollment", monthlyEnrollmentSchema);
