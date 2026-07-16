import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String },
    durationMonths: { type: Number },
    totalFee: { type: Number },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    startDate: Date,
    endDate: Date,
    schedule: String,
    room: String,
    capacity: { type: Number, min: 1, default: 60 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

batchSchema.index({ name: 1 }, { unique: true });

export const Batch = mongoose.model("Batch", batchSchema);
