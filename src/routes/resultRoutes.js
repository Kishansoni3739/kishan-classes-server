import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { deleteResult, getResult, listResults, updateResult, upsertResult, deleteMultipleResults } from "../controllers/resultController.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "teacher", "student"), listResults).post(authorize("admin", "teacher"), upsertResult);
router.post("/bulk-delete", authorize("admin"), deleteMultipleResults);
router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getResult)
  .put(authorize("admin", "teacher"), updateResult)
  .delete(authorize("admin"), deleteResult);

export default router;
