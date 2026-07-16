import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resetTemplate
} from "../controllers/whatsappTemplateController.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(authorize("admin", "teacher"), getTemplates)
  .post(authorize("admin"), createTemplate);

router.route("/:id")
  .put(authorize("admin"), updateTemplate)
  .delete(authorize("admin"), deleteTemplate);

router.route("/:id/reset")
  .post(authorize("admin"), resetTemplate);

export default router;
