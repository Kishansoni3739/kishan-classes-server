import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { teacherChangePassword } from "../controllers/authController.js";

const router = express.Router();

router.use(protect);
router.patch("/change-password", authorize("teacher"), teacherChangePassword);

export default router;
