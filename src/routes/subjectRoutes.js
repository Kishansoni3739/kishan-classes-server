import express from "express";
import { Subject } from "../models/Subject.js";
import { buildCrudController } from "../controllers/crudController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const controller = buildCrudController(Subject, {
  populate: [],
  searchFields: ["name", "code", "description"]
});

router.use(protect);
router.route("/").get(authorize("admin", "teacher", "student"), controller.list).post(authorize("admin"), controller.create);
router.post("/bulk-delete", authorize("admin"), controller.removeMultiple);
router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), controller.get)
  .put(authorize("admin"), controller.update)
  .delete(authorize("admin"), controller.remove);

export default router;
