import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, required: true, trim: true, unique: true },
    qualification: String,
    experienceYears: { type: Number, min: 0, default: 0 },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Batch" }],
    joiningDate: { type: Date, default: Date.now },
    salary: { type: Number, min: 0, default: 0 },
    address: String
  },
  { timestamps: true }
);

export const Teacher = mongoose.model("Teacher", teacherSchema);
