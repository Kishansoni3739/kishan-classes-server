import express from "express";
import { login, me, switchProfile } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login requests per windowMs
  message: { message: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post("/login", loginLimiter, login);
router.post("/logout", (req, res) => res.json({ message: "Logged out successfully" }));
router.get("/me", protect, me);
router.post("/switch-profile", protect, switchProfile);

export default router;
