import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const protect = asyncHandler(async (req, res, next) => {

  const authHeader = req.headers.authorization || "";
  let token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.status(401);
    throw new Error("Authentication token required");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-passwordHash");

  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("User is not authorized");
  }

  // Strict check: Ensure token role claim matches user role in DB
  if (decoded.role && user.role.toLowerCase() !== decoded.role.toLowerCase()) {
    res.status(403);
    throw new Error("Access forbidden. Token role mismatch.");
  }

  user.roleOriginal = user.role;
  const roleLower = user.role.toLowerCase();

  if (roleLower === "teacher") {
    const { Teacher } = await import("../models/Teacher.js");
    const teacher = await Teacher.findOne({ user: user._id });
    user.assignedBatches = teacher ? teacher.batches.map(id => id.toString()) : [];
  }

  user.role = roleLower;

  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) => {
  const allowed = roles.map(r => String(r).toLowerCase());
  const userRole = String(req.user?.role || "").toLowerCase();
  if (!allowed.includes(userRole)) {
    res.status(403);
    return next(new Error("Access forbidden. Insufficient permissions for this role."));
  }
  next();
};
