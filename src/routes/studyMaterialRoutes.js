import express from "express";
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMaterials,
  updateMaterial,
  upload,
  deleteMultipleMaterials,
  uploadFiles,
  downloadMaterial,
  recordDownload,
  getWhatsappPreview
} from "../controllers/materialController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(authorize("admin", "teacher", "student"), listMaterials)
  .post(authorize("admin", "teacher"), createMaterial);

router.post("/upload", authorize("admin", "teacher"), upload.single("file"), uploadFiles);
router.post("/bulk-delete", authorize("admin", "teacher"), deleteMultipleMaterials);

router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getMaterial)
  .put(authorize("admin", "teacher"), updateMaterial)
  .delete(authorize("admin", "teacher"), deleteMaterial);

router.get("/:id/download", authorize("admin", "teacher", "student"), downloadMaterial);
router.post("/:id/record-download", authorize("admin", "teacher", "student"), recordDownload);
router.get("/:id/whatsapp-preview", authorize("admin", "teacher"), getWhatsappPreview);

export default router;
