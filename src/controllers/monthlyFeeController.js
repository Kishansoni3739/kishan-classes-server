import { Fee } from "../models/Fee.js";
import { PaymentReversalLog } from "../models/PaymentReversalLog.js";
import { Student } from "../models/Student.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { appEvents, EVENTS } from "../events/index.js";

export const listMonthlyFees = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, student } = req.query;
  const query = {};

  if (status) query.status = status;
  if (student) query.student = student;

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const studentIds = await Student.find({ batch: { $in: assigned } }).distinct("_id");
    query.student = { $in: studentIds };
  } else if (req.user && req.user.role === "student") {
    query.student = req.user.linkedId;
  }

  const fees = await Fee.find(query)
    .populate({
      path: "student",
      select: "user studentId batch guardian",
      populate: [
        { path: "user", select: "name" },
        { path: "batch", select: "name" }
      ]
    })
    .sort({ dueDate: 1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Fee.countDocuments(query);

  const items = fees.map(t => {
    // Fee model has virtuals for paidAmount and pendingAmount
    // But since it's a map we can ensure it's calculated
    const paidAmount = t.payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = t.totalAmount - paidAmount;
    
    return {
      ...t.toObject(),
      paidAmount,
      pendingAmount
    };
  });

  // Simple search filtering since search across populated fields is complex
  let filteredItems = items;
  if (search) {
    const s = search.toLowerCase();
    filteredItems = items.filter(item => 
      item.student?.user?.name?.toLowerCase().includes(s) ||
      item.student?.studentId?.toLowerCase().includes(s)
    );
  }

  res.json({ 
    items: filteredItems, 
    total: search ? filteredItems.length : total, 
    page: Number(page), 
    pages: Math.ceil(total / Number(limit)) || 1 
  });
});

export const collectMonthlyFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, method, note, paidAt } = req.body;

  const fee = await Fee.findById(id);
  if (!fee) {
    res.status(404);
    throw new Error("Fee tenure not found");
  }

  fee.payments.push({
    amount: Number(amount),
    method: method || "cash",
    note,
    receiptNo: `KC-FEE-${Date.now()}`,
    paidAt: paidAt || new Date(),
    collectedBy: req.user?._id
  });

  await fee.save(); // pre-save hook handles status calculation

  const populatedFee = await Fee.findById(fee._id).populate({
    path: "student",
    populate: { path: "user" }
  });
  
  appEvents.emit(EVENTS.FEE_COLLECTED, { fee: populatedFee, payment: fee.payments[fee.payments.length - 1] });

  res.json({ message: "Fee collected successfully", fee });
});

export const reverseMonthlyFee = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    res.status(400);
    throw new Error("Reversal reason is required");
  }

  const fee = await Fee.findById(id);
  if (!fee) {
    res.status(404);
    throw new Error("Fee tenure not found");
  }

  const payment = fee.payments.id(paymentId);
  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  if (payment.status === "reversed" || payment.status === "cancelled") {
    res.status(400);
    throw new Error(`Payment is already ${payment.status}`);
  }

  const previousStatus = fee.status;

  payment.status = "reversed";
  payment.reversalReason = reason;
  payment.reversedBy = req.user._id;
  payment.reversedAt = new Date();

  await fee.save(); // pre-save hook recalculates total status

  await PaymentReversalLog.create({
    originalPaymentId: payment._id,
    fee: fee._id,
    student: fee.student,
    amount: payment.amount,
    reversalReason: reason,
    reversedBy: req.user._id,
    previousStatus: previousStatus,
    newStatus: fee.status
  });

  res.json({ message: "Payment reversed successfully", fee });
});

export const listReversals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  const query = {};

  const reversals = await PaymentReversalLog.find(query)
    .populate({ path: "student", populate: { path: "user", select: "name" } })
    .populate("reversedBy", "name")
    .sort({ reversedAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await PaymentReversalLog.countDocuments(query);

  const items = reversals.map(r => {
    const item = r.toObject();
    return {
      _id: item._id,
      studentName: item.student?.user?.name,
      amount: item.amount,
      reason: item.reversalReason,
      reversedBy: item.reversedBy?.name,
      date: item.reversedAt
    };
  });

  // Filter for search
  let filteredItems = items;
  if (search) {
    const s = search.toLowerCase();
    filteredItems = items.filter(item => 
      item.studentName?.toLowerCase().includes(s) ||
      item.reason?.toLowerCase().includes(s)
    );
  }

  res.json({
    items: filteredItems,
    total: search ? filteredItems.length : total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1
  });
});
