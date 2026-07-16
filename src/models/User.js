import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "TEACHER", "STUDENT"], required: true, index: true },
    linkedId: { type: mongoose.Schema.Types.ObjectId },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLogin: { type: Date },
    
    // Optional compatibility fields
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: String,
    avatarFileId: String
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  if (this.role) {
    this.role = this.role.toUpperCase();
  }
  if (!this.username) {
    this.username = this.email || this.phone || `user_${Math.random().toString(36).substr(2, 9)}`;
  }
  if (this.password && !this.passwordHash) {
    this.passwordHash = this.password;
  }
  next();
});

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("passwordHash")) return next();
  const isBcryptHash = /^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.passwordHash);
  if (isBcryptHash) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash.toLowerCase(), 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(candidate) {
  return bcrypt.compare(candidate.toLowerCase(), this.passwordHash);
};

export const User = mongoose.model("User", userSchema);
