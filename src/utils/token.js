import jwt from "jsonwebtoken";

export const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: String(user.role || "").toLowerCase(),
      username: user.username
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
