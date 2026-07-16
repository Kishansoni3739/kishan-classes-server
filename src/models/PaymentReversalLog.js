import mongoose from "mongoose";

const paymentReversalLogSchema = new mongoose.Schema(
  {
    originalPaymentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fee: { type: mongoose.Schema.Types.ObjectId, ref: "Fee", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    amount: { type: Number, required: true },
    reversalReason: { type: String, required: true },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reversedAt: { type: Date, default: Date.now },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true }
  },
  { timestamps: true }
);

export const PaymentReversalLog = mongoose.model("PaymentReversalLog", paymentReversalLogSchema);
