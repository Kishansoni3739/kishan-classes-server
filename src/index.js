import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import { Student } from "./models/Student.js";
import { MonthlyEnrollment } from "./models/MonthlyEnrollment.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import batchRoutes from "./routes/batchRoutes.js";
import feeRoutes from "./routes/feeRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import studyMaterialRoutes from "./routes/studyMaterialRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import monthlyFeeRoutes from "./routes/monthlyFeeRoutes.js";
import whatsappTemplateRoutes from "./routes/whatsappTemplateRoutes.js";
import remarkRoutes from "./routes/remarkRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import teacherAuthRoutes from "./routes/teacherAuthRoutes.js";
import { startFeeCron } from "./cron/feeGenerator.js";

const app = express();
import { seedDefaultTemplates } from "./controllers/whatsappTemplateController.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());

// Strict Production CORS Setup
const allowedOrigins = ["https://kishan-classes-rosy.vercel.app"];
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5173");
  allowedOrigins.push("http://localhost:5000");
  allowedOrigins.push("http://127.0.0.1:5173");
}
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(",").forEach((origin) => {
    const trimmed = origin.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS block: Request origin not allowed by production security policy"), false);
    },
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kishan-classes-api" });
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/fees", feeRoutes); // Legacy fee routes
app.use("/api/monthly-fees", monthlyFeeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/study-materials", studyMaterialRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/whatsapp-templates", whatsappTemplateRoutes);
app.use("/api/remarks", remarkRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", teacherAuthRoutes);

app.use(notFound);
app.use(errorHandler);
import { startTestCleanupCron } from "./cron/testCleanup.js";

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedDefaultTemplates();
    app.listen(port, () => {
      console.log(`API running on port ${port}`);
      startFeeCron();
      startTestCleanupCron();
    });
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
};

startServer();

