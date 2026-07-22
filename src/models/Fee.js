import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    method: { type: String, enum: ["cash", "upi", "card", "bank_transfer", "cheque"], default: "cash" },
    receiptNo: { type: String, required: true },
    note: String,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["active", "reversed", "cancelled"], default: "active" },
    reversalReason: String,
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reversedAt: Date
  },
  { _id: true }
);

const feeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    totalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },
    periodStart: Date,
    periodEnd: Date,
    dueDate: Date,
    payments: [paymentSchema],
    status: { type: String, enum: ["pending", "partial", "paid", "overdue"], default: "pending", index: true }
  },
  { timestamps: true }
);

feeSchema.index({ student: 1, periodStart: 1 });
feeSchema.index({ student: 1, status: 1 });

feeSchema.pre("save", function(next) {
  const activePayments = this.payments.filter(p => !p.status || p.status === "active");
  const paid = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const netAmount = this.totalAmount - this.discount;
  
  if (paid > netAmount) {
    return next(new Error(`Overpayment blocked: Payment amount exceeds outstanding due.`));
  }
  
  if (paid === netAmount) {
    this.status = "paid";
  } else if (paid > 0 && paid < netAmount) {
    this.status = "partial";
  } else if (paid === 0 && this.dueDate && new Date(this.dueDate) < new Date()) {
    this.status = "overdue";
  } else if (paid === 0) {
    this.status = "pending";
  }
  
  next();
});

feeSchema.virtual("paidAmount").get(function paidAmount() {
  const activePayments = this.payments.filter(p => !p.status || p.status === "active");
  return activePayments.reduce((sum, payment) => sum + payment.amount, 0);
});

feeSchema.virtual("pendingAmount").get(function pendingAmount() {
  return Math.max(this.totalAmount - this.discount - this.paidAmount, 0);
});

feeSchema.set("toJSON", { virtuals: true });
feeSchema.set("toObject", { virtuals: true });

export const Fee = mongoose.model("Fee", feeSchema);
