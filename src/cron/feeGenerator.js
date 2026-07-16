import cron from "node-cron";
import { Student } from "../models/Student.js";
import { Fee } from "../models/Fee.js";

// Run every day at midnight
export const startFeeCron = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Running fee generation cron...");
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all active students
      const students = await Student.find({ status: "active" });

      for (const student of students) {
        if (!student.monthlyFee || student.monthlyFee <= 0) continue;

        // Find the latest fee tenure for this student
        const lastFee = await Fee.findOne({ student: student._id }).sort({ periodEnd: -1 });

        let nextStart, nextEnd;

        if (!lastFee) {
          // If no fee exists yet, start from admission date
          nextStart = new Date(student.admissionDate);
        } else {
          // If a fee exists, and it hasn't ended yet, skip
          const lastEnd = new Date(lastFee.periodEnd);
          if (lastEnd >= today) continue;

          // Next tenure starts the day after the last tenure ends
          nextStart = new Date(lastEnd);
          nextStart.setDate(nextStart.getDate() + 1);
        }

        // Generate up to the current date if they are far behind, or just the next month
        while (nextStart <= today) {
          nextEnd = new Date(nextStart);
          nextEnd.setMonth(nextEnd.getMonth() + 1);
          nextEnd.setDate(nextEnd.getDate() - 1);

          await Fee.create({
            student: student._id,
            totalAmount: student.monthlyFee,
            periodStart: nextStart,
            periodEnd: nextEnd,
            dueDate: nextEnd, // Due date is the end of the tenure (Post-payment model)
            status: "pending",
            payments: []
          });
          
          console.log(`[CRON] Generated fee for student ${student._id}: ${nextStart.toISOString()} to ${nextEnd.toISOString()}`);

          // Prepare for potential next iteration if they were multiple months behind
          nextStart = new Date(nextEnd);
          nextStart.setDate(nextStart.getDate() + 1);
        }
      }

      // Mark overdue fees
      const pendingFees = await Fee.find({ status: "pending", dueDate: { $lt: today } });
      for (const fee of pendingFees) {
         fee.status = "overdue";
         await fee.save();
         console.log(`[CRON] Marked fee ${fee._id} as overdue.`);
      }
    } catch (error) {
      console.error("[CRON] Error generating fees:", error);
    }
  });
  console.log("[CRON] Fee generator scheduled.");
};
