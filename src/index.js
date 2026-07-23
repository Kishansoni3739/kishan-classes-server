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
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { seedDefaultTemplates } from "./controllers/whatsappTemplateController.js";
import { startFeeCron } from "./cron/feeGenerator.js";
import { startTestCleanupCron } from "./cron/testCleanup.js";
import { ensureDefaultAdmin } from "./utils/initAdmin.js";

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

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, crossOriginOpenerPolicy: false }));
app.use(compression());

// Flexible & Secure Production CORS Setup
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Allow non-browser requests (mobile native, Postman, curl)

  const allowedStaticOrigins = [
    "https://kishan-classes-rosy.vercel.app",
    "https://kishan-classes.vercel.app",
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5173"
  ];

  if (allowedStaticOrigins.includes(origin)) return true;

  // Allow all Vercel deployment origins (*.vercel.app)
  if (origin.endsWith(".vercel.app") || /\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Allow origins specified in CLIENT_URL env variable (comma-separated or wildcard '*')
  if (process.env.CLIENT_URL) {
    const customOrigins = process.env.CLIENT_URL.split(",").map((o) => o.trim());
    if (customOrigins.includes("*") || customOrigins.includes(origin)) {
      return true;
    }
  }

  return false;
};

const allowedOrigins = [
  "https://kishan-classes-rosy.vercel.app",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost"
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(",").forEach(origin => {
    const url = origin.trim();
    if (url && !allowedOrigins.includes(url)) {
      allowedOrigins.push(url);
    }
  });
}

app.use(cors({
  origin(origin, callback) {
    // Allow Postman, mobile apps, server-to-server requests
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked Origin:", origin);
    callback(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With"
  ]
}));

app.options("*", cors());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kishan-classes-api" });
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/fees", feeRoutes);
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

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await ensureDefaultAdmin();
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

