import cron from "node-cron";
import { Test } from "../models/Test.js";
import { Result } from "../models/Result.js";

// Run every day at 02:00 AM
export const startTestCleanupCron = () => {
  cron.schedule("0 2 * * *", async () => {
    console.log("[CRON] Running test cleanup cron...");
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 45);

      // Find tests older than 45 days based on their testDate
      const oldTests = await Test.find({ testDate: { $lt: cutoffDate } });
      
      if (oldTests.length === 0) {
        return;
      }

      const testIds = oldTests.map(t => t._id);

      // Delete associated results first to prevent orphaned records
      const resultDeleteRes = await Result.deleteMany({ test: { $in: testIds } });
      
      // Delete the tests
      const testDeleteRes = await Test.deleteMany({ _id: { $in: testIds } });

      console.log(`[CRON] Cleanup complete: Deleted ${testDeleteRes.deletedCount} tests and ${resultDeleteRes.deletedCount} associated results older than 45 days.`);
    } catch (error) {
      console.error("[CRON] Error cleaning up old tests:", error);
    }
  });
  console.log("[CRON] Test cleanup scheduled.");
};
