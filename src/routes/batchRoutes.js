import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import {
  listBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  deleteMultipleBatches
} from "../controllers/batchController.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "teacher", "student"), listBatches).post(authorize("admin"), createBatch);
router.post("/bulk-delete", authorize("admin"), deleteMultipleBatches);
router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getBatch)
  .put(authorize("admin"), updateBatch)
  .delete(authorize("admin"), deleteBatch);

export default router;
