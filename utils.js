import crypto from "crypto";

export const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export const monthKeyFromDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function createCycleBoundary(year, monthIndex, dayOfMonth) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

export function buildFeeRecord(student, date, overrides = {}) {
  const dueDate = createCycleBoundary(date.getFullYear(), date.getMonth(), Number(student.feeDueDay || 1));
  return {
    id: uid(),
    studentId: student.id,
    monthKey: monthKeyFromDate(date),
    amountDue: student.monthlyFeeAmount,
    amountPaid: 0,
    dueDate: dueDate.toISOString(),
    paymentDate: "",
    mode: "",
    remarks: "Awaiting payment",
    status: "Pending",
    ...overrides,
  };
}

export function getGrade(percent, boundaries) {
  if (percent >= boundaries.aPlus) return "A+";
  if (percent >= boundaries.a) return "A";
  if (percent >= boundaries.b) return "B";
  if (percent >= boundaries.c) return "C";
  if (percent >= boundaries.d) return "D";
  return "F";
}

export function getPerformanceTag(percent) {
  if (percent >= 90) return "Excellent";
  if (percent >= 75) return "Good";
  if (percent >= 50) return "Average";
  return "Needs Improvement";
}
