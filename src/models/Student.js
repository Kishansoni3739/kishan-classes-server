import mongoose from "mongoose";

const guardianSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    relation: String
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    studentId: { type: String, required: true, unique: true, index: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female", "other", ""] },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", index: true },
    monthlyFee: { type: Number, min: 0 },
    openingBalance: { type: Number, default: 0 },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    admissionDate: { type: Date, default: Date.now },
    admissionYear: { type: Number },
    guardian: guardianSchema,
    address: String,
    status: { type: String, enum: ["active", "inactive", "completed", "suspended", "dropped"], default: "active", index: true }
  },
  { timestamps: true }
);

studentSchema.index({ studentId: "text", "guardian.name": "text", address: "text" });

export const Student = mongoose.model("Student", studentSchema);
