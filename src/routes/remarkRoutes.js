import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  listRemarks,
  createRemark,
  updateRemark,
  deleteRemark
} from "../controllers/remarkController.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(authorize("admin", "teacher", "student"), listRemarks)
  .post(authorize("admin", "teacher"), createRemark);

router.route("/:id")
  .put(authorize("admin", "teacher"), updateRemark)
  .delete(authorize("admin", "teacher"), deleteRemark);

export default router;
