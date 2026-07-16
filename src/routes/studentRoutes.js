import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { createStudent, deleteStudent, getStudent, listStudents, updateStudent, getStudentProfile, deleteMultipleStudents, uploadAvatar, getStudentTests } from "../controllers/studentController.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "teacher", "student"), listStudents).post(authorize("admin"), createStudent);
router.get("/:id/profile", authorize("admin", "teacher", "student"), getStudentProfile);
router.get("/:id/tests", authorize("admin", "teacher", "student"), getStudentTests);
router.post("/:id/avatar", authorize("admin", "student"), upload.single("avatar"), uploadAvatar);
router.post("/bulk-delete", authorize("admin"), deleteMultipleStudents);
router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getStudent)
  .put(authorize("admin"), updateStudent)
  .delete(authorize("admin"), deleteStudent);

export default router;
