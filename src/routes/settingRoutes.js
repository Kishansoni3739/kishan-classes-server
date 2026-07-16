import express from "express";
import { Setting } from "../models/Setting.js";
import { buildCrudController } from "../controllers/crudController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
const controller = buildCrudController(Setting, {
  searchFields: ["key"]
});

router.use(protect);
router.use(authorize("admin"));

router.route("/").get(controller.list).post(controller.create);
router.route("/:id").get(controller.get).put(controller.update).delete(controller.remove);

export default router;
