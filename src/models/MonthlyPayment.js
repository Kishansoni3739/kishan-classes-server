import mongoose from "mongoose";

const monthlyPaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  tenure: { type: mongoose.Schema.Types.ObjectId, ref: "MonthlyTenure", required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paidAt: { type: Date, default: Date.now },
  method: { type: String, enum: ["cash", "upi", "card", "bank_transfer", "cheque"], default: "cash" },
  receiptNo: { type: String, required: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export const MonthlyPayment = mongoose.model("MonthlyPayment", monthlyPaymentSchema);
