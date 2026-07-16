import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { collectFee, createFee, deleteFee, getFee, listFees, updateFee } from "../controllers/feeController.js";

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "student"), listFees).post(authorize("admin"), createFee);
router.patch("/:id/collect", authorize("admin"), collectFee);
router
  .route("/:id")
  .get(authorize("admin", "student"), getFee)
  .put(authorize("admin"), updateFee)
  .delete(authorize("admin"), deleteFee);

export default router;
