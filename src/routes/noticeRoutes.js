import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import {
  listNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  deleteMultipleNotices
} from "../controllers/noticeController.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "teacher", "student"), listNotices).post(authorize("admin"), createNotice);
router.post("/bulk-delete", authorize("admin"), deleteMultipleNotices);
router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getNotice)
  .put(authorize("admin"), updateNotice)
  .delete(authorize("admin"), deleteNotice);

export default router;
