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
  if (!roles.includes(req.user.role)) {
    res.status(403);
    return next(new Error("You do not have permission to perform this action"));
  }
  next();
};
