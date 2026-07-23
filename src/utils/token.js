import jwt from "jsonwebtoken";

export const signToken = (user) => {
  const secret = process.env.JWT_SECRET || "kishan_classes_fallback_jwt_secret_key_2026";
  return jwt.sign(
    {
      id: user._id,
      role: String(user.role || "").toLowerCase(),
      username: user.username
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
};
