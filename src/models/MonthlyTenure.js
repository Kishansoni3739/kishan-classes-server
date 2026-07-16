import mongoose from "mongoose";

const monthlyTenureSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: "MonthlyEnrollment", required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  discount: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["paid", "partial", "unpaid", "future"], default: "unpaid", index: true }
}, { timestamps: true });

monthlyTenureSchema.virtual("payments", {
  ref: "MonthlyPayment",
  localField: "_id",
  foreignField: "tenure"
});

monthlyTenureSchema.set("toJSON", { virtuals: true });
monthlyTenureSchema.set("toObject", { virtuals: true });

export const MonthlyTenure = mongoose.model("MonthlyTenure", monthlyTenureSchema);
