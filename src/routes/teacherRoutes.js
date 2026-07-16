import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { createTeacher, deleteTeacher, getTeacher, listTeachers, updateTeacher, deleteMultipleTeachers, uploadAvatar } from "../controllers/teacherController.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "teacher"), listTeachers).post(authorize("admin"), createTeacher);
router.post("/bulk-delete", authorize("admin"), deleteMultipleTeachers);
router.post("/:id/avatar", authorize("admin", "teacher"), upload.single("avatar"), uploadAvatar);
router
  .route("/:id")
  .get(authorize("admin", "teacher"), getTeacher)
  .put(authorize("admin", "teacher"), updateTeacher)
  .delete(authorize("admin"), deleteTeacher);

export default router;
