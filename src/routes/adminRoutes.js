import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { adminChangeCredentials } from "../controllers/authController.js";

const router = express.Router();

router.use(protect);
router.patch("/change-credentials", authorize("admin"), adminChangeCredentials);

export default router;
