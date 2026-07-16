import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import {
  scheduleTest,
  listTests,
  updateTest,
  cancelTest,
  completeTest,
  getTestParticipants
} from "../controllers/testController.js";

const router = express.Router();

router.use(protect);

router.post("/", authorize("admin", "teacher"), scheduleTest);
router.get("/", authorize("admin", "teacher"), listTests);
router.put("/:id", authorize("admin", "teacher"), updateTest);
router.post("/:id/cancel", authorize("admin", "teacher"), cancelTest);
router.get("/:id/participants", authorize("admin", "teacher"), getTestParticipants);
router.post("/:id/complete", authorize("admin", "teacher"), completeTest);

export default router;
