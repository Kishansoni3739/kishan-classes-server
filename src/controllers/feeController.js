import { Fee } from "../models/Fee.js";
import { Student } from "../models/Student.js";
import { buildCrudController } from "./crudController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const populate = [
  { path: "student", populate: { path: "user", select: "name email phone" } },
  { path: "course", select: "name code totalFee" },
  { path: "payments.collectedBy", select: "name" }
];

const base = buildCrudController(Fee, {
  populate
});

export const listFees = asyncHandler(async (req, res) => {
  if (req.user.role !== "student") return base.list(req, res);

  const student = await Student.findOne({ user: req.user._id }).select("_id");
  const items = student ? await Fee.find({ student: student._id }).populate(populate).sort({ createdAt: -1 }) : [];
  res.json({ items, total: items.length, page: 1, pages: 1 });
});
export const getFee = base.get;
export const createFee = base.create;
export const updateFee = base.update;
export const deleteFee = base.remove;

export const collectFee = asyncHandler(async (req, res) => {
  const { amount, method = "cash", note } = req.body;
  const fee = await Fee.findById(req.params.id);

  if (!fee) {
    res.status(404);
    throw new Error("Fee record not found");
  }

  const paidAmount = fee.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const netAmount = fee.totalAmount - fee.discount;
  const outstandingDue = netAmount - paidAmount;

  if (amount > outstandingDue) {
    res.status(400);
    throw new Error(`Payment amount cannot exceed outstanding due amount (₹${outstandingDue}).`);
  }

  fee.payments.push({
    amount,
    method,
    note,
    receiptNo: `KC-FEE-${Date.now()}`,
    collectedBy: req.user._id,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date()
  });

  await fee.save();

  res.json(await fee.populate(populate));
});
