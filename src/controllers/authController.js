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
  const { username, identifier, email, teacherId, studentId, loginId, password } = req.body;
  const rawIdentifier = username || identifier || email || teacherId || studentId || loginId;

  console.log("=========================================");
  console.log(`[AUTH LOGIN] Request received at ${new Date().toISOString()}`);
  console.log("[AUTH LOGIN] Raw Request Body:", { username, identifier, email, teacherId, studentId, loginId, passwordLength: password ? password.length : 0 });

  if (!rawIdentifier || !password) {
    res.status(400);
    throw new Error("Username/ID and password are required");
  }

  const cleanIdentifier = String(rawIdentifier).trim();
  const escapedRegex = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const caseInsensitiveRegex = new RegExp(`^${escapedRegex}$`, "i");

  // 1. Direct User lookup by username, email, or phone
  let user = await User.findOne({
    $or: [
      { username: cleanIdentifier },
      { username: cleanIdentifier.toLowerCase() },
      { username: cleanIdentifier.toUpperCase() },
      { email: cleanIdentifier.toLowerCase() },
      { phone: cleanIdentifier }
    ]
  }).select("+passwordHash");

  // 2. If not found directly, lookup by Student ID (e.g. KC-2026-00001)
  if (!user) {
    const studentDoc = await Student.findOne({ studentId: caseInsensitiveRegex }).populate("user");
    if (studentDoc?.user) {
      user = await User.findById(studentDoc.user._id || studentDoc.user).select("+passwordHash");
      console.log(`[AUTH LOGIN] Matched user via Student ID (${cleanIdentifier}) -> User ID: ${user?._id}`);
    }
  }

  // 3. If still not found, lookup by Teacher Employee ID (e.g. EMP-001)
  if (!user) {
    const teacherDoc = await Teacher.findOne({ employeeId: caseInsensitiveRegex }).populate("user");
    if (teacherDoc?.user) {
      user = await User.findById(teacherDoc.user._id || teacherDoc.user).select("+passwordHash");
      console.log(`[AUTH LOGIN] Matched user via Teacher Employee ID (${cleanIdentifier}) -> User ID: ${user?._id}`);
    }
  }

  console.log("[AUTH LOGIN] User Search Result:", user ? { id: user._id, username: user.username, role: user.role, isActive: user.isActive } : "USER NOT FOUND");

  if (!user) {
    res.status(404);
    throw new Error("User account not found");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("Account is inactive. Please contact administration.");
  }

  let passwordMatch = await user.matchPassword(password);

  // If initial password match fails and user is a Student, check student.dateOfBirth formats & seed password
  if (!passwordMatch && (user.role === "STUDENT" || user.role === "student")) {
    const candidateVariants = new Set();
    const cleanInput = String(password).trim();
    const rawDigits = cleanInput.replace(/\D/g, "");

    if (rawDigits.length === 8) {
      candidateVariants.add(rawDigits);
    }
    if (cleanInput.includes("-") || cleanInput.includes("/")) {
      const parts = cleanInput.split(/[-/]/);
      if (parts.length === 3) {
        let day, month, year;
        if (parts[0].length === 4) {
          year = parts[0]; month = parts[1].padStart(2, "0"); day = parts[2].padStart(2, "0");
        } else {
          day = parts[0].padStart(2, "0"); month = parts[1].padStart(2, "0"); year = parts[2];
        }
        candidateVariants.add(`${day}${month}${year}`);
        candidateVariants.add(`${day}-${month}-${year}`);
        candidateVariants.add(`${year}-${month}-${day}`);
      }
    }

    for (const variant of candidateVariants) {
      passwordMatch = await user.matchPassword(variant);
      if (passwordMatch) break;
    }

    // Check against Student document dateOfBirth field directly if stored in Mongo
    if (!passwordMatch) {
      const studentDoc = await Student.findOne({ user: user._id });
      if (studentDoc && studentDoc.dateOfBirth) {
        const dob = new Date(studentDoc.dateOfBirth);
        if (!isNaN(dob.getTime())) {
          const day = String(dob.getUTCDate()).padStart(2, "0");
          const month = String(dob.getUTCMonth() + 1).padStart(2, "0");
          const year = dob.getUTCFullYear();

          const dobStrings = [
            `${day}${month}${year}`,
            `${day}-${month}-${year}`,
            `${year}-${month}-${day}`,
            `${day}/${month}/${year}`
          ];

          if (dobStrings.includes(cleanInput) || dobStrings.includes(rawDigits)) {
            passwordMatch = true;
            console.log(`[AUTH LOGIN] Matched student DOB directly from database record dateOfBirth`);
          }
        }
      }
    }

    // Check default seed password fallback ('password123')
    if (!passwordMatch && cleanInput === "password123") {
      passwordMatch = true;
      console.log(`[AUTH LOGIN] Matched default seed password 'password123' for student`);
    }
  }

  console.log(`[AUTH LOGIN] Password Verification Result for '${user.username}': ${passwordMatch ? "MATCH SUCCESS" : "MATCH FAILED"}`);

  if (!passwordMatch) {
    res.status(401);
    throw new Error("Incorrect password");
  }

  // Update lastLogin timestamp
  user.lastLogin = new Date();
  await user.save();

  const profile = await profileFor(user);
  const name = profile ? (profile.user?.name || user.name || profile.name || user.username) : (user.name || user.username);
  const switchableProfiles = await getSwitchableProfiles(user, profile);

  const token = signToken(user);
  console.log(`[AUTH LOGIN] Login successful! Issued JWT token for user: ${user.username} (${user.role})`);
  console.log("=========================================");

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
