import express from "express";
import { adminDashboard, studentDashboard, teacherDashboard } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/admin", authorize("admin"), adminDashboard);
router.get("/teacher", authorize("teacher"), teacherDashboard);
router.get("/student", authorize("student"), studentDashboard);

export default router;
