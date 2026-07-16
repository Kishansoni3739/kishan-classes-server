import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { listMonthlyFees, collectMonthlyFee, reverseMonthlyFee, listReversals } from "../controllers/monthlyFeeController.js";

const router = express.Router();

router.use(protect);
router.get("/", authorize("admin", "teacher", "student"), listMonthlyFees);
router.get("/reversals", authorize("admin"), listReversals);
router.post("/:id/collect", authorize("admin"), collectMonthlyFee);
router.post("/:id/payments/:paymentId/reverse", authorize("admin", "superadmin"), reverseMonthlyFee);

export default router;
