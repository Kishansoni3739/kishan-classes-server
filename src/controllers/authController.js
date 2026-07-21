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

const getSwitchableProfiles = async (user, profile) => {
  const roleUpper = user.role?.toUpperCase();
  if (roleUpper === "STUDENT" && profile && profile.guardian && profile.guardian.phone) {
    const siblingStudents = await Student.find({
      "guardian.phone": profile.guardian.phone,
      _id: { $ne: profile._id }
    }).populate("user");
    return siblingStudents.map(s => ({
      userId: s.user?._id,
      studentId: s.studentId,
      name: s.user?.name || s.studentId,
      username: s.user?.username
    }));
  }
  return [];
};

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400);
    throw new Error("Username and password are required");
  }

  const user = await User.findOne({
    $or: [
      { username: username },
      { username: username.toLowerCase() },
      { username: username.toUpperCase() }
    ]
  }).select("+passwordHash");

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
  const switchableProfiles = await getSwitchableProfiles(user, profile);

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
    profile,
    switchableProfiles
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
  const switchableProfiles = await getSwitchableProfiles(user, profile);

  res.json({
    user: {
      id: user._id,
      username: user.username,
      name,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    },
    profile,
    switchableProfiles
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

export const switchProfile = asyncHandler(async (req, res) => {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    res.status(400);
    throw new Error("Target user ID is required");
  }

  if (req.user.role?.toUpperCase() !== "STUDENT") {
    res.status(403);
    throw new Error("Only students can switch profiles");
  }

  const currentStudent = await Student.findOne({ user: req.user._id });
  if (!currentStudent || !currentStudent.guardian || !currentStudent.guardian.phone) {
    res.status(400);
    throw new Error("Current student has no guardian contact info");
  }

  const targetStudent = await Student.findOne({ user: targetUserId }).populate("user");
  if (!targetStudent) {
    res.status(404);
    throw new Error("Target student not found");
  }

  if (targetStudent.guardian?.phone !== currentStudent.guardian.phone) {
    res.status(403);
    throw new Error("You do not have permission to switch to this profile");
  }

  const targetUser = targetStudent.user;
  if (!targetUser) {
    res.status(404);
    throw new Error("Target user credentials not found");
  }

  if (!targetUser.isActive) {
    res.status(403);
    throw new Error("Target user account is inactive");
  }

  const token = signToken(targetUser);
  const profile = await profileFor(targetUser);
  const name = profile ? (profile.user?.name || targetUser.name || profile.name || targetUser.username) : (targetUser.name || targetUser.username);
  const switchableProfiles = await getSwitchableProfiles(targetUser, profile);

  res.json({
    token,
    role: targetUser.role,
    user: {
      id: targetUser._id,
      username: targetUser.username,
      name,
      mustChangePassword: targetUser.mustChangePassword
    },
    profile,
    switchableProfiles
  });
});
