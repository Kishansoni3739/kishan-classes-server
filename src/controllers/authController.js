import { User } from "../models/User.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signToken } from "../utils/token.js";

const profileFor = async (user) => {
  if (user.role === "STUDENT" || user.role === "student") {
    return Student.findOne({ user: user._id }).populate("subjects batch");
  }
  if (user.role === "TEACHER" || user.role === "teacher") {
    return Teacher.findOne({ user: user._id }).populate("subjects batches");
  }
  return null;
};

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400);
    throw new Error("Username and password are required");
  }

  const user = await User.findOne({ username }).select("+passwordHash");

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid username or password");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("User account is inactive");
  }

  // Update lastLogin
  user.lastLogin = new Date();
  await user.save();

  const profile = await profileFor(user);
  const name = profile ? (profile.user?.name || user.name || profile.name || user.username) : (user.name || user.username);

  const token = signToken(user);

  res.json({
    token,
    role: user.role, // Uppercase ADMIN, TEACHER, STUDENT
    user: {
      id: user._id,
      username: user.username,
      name,
      mustChangePassword: user.mustChangePassword
    },
    profile
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const profile = await profileFor(user);
  const name = profile ? (profile.user?.name || user.name || profile.name || user.username) : (user.name || user.username);

  res.json({
    user: {
      id: user._id,
      username: user.username,
      name,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    },
    profile
  });
});

export const adminChangeCredentials = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only admins can change credentials");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (username) {
    const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
    if (existingUser) {
      res.status(400);
      throw new Error("Username already taken");
    }
    user.username = username;
  }

  if (password) {
    user.passwordHash = password;
  }

  await user.save();
  res.json({ message: "Admin credentials updated successfully", username: user.username });
});

export const teacherChangePassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password || password.trim() === "") {
    res.status(400);
    throw new Error("Password is required");
  }

  if (req.user.role !== "teacher") {
    res.status(403);
    throw new Error("Only teachers can change password");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.passwordHash = password;
  user.mustChangePassword = false;

  await user.save();
  res.json({ message: "Teacher password changed successfully" });
});
