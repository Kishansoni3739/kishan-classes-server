import { User } from "../models/User.js";

export const ensureDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({
      $or: [
        { username: "kishan_admin" },
        { username: "admin" },
        { role: "ADMIN" }
      ]
    });

    if (!adminExists) {
      console.log("[AUTO-ADMIN] Creating admin account 'kishan_admin'...");
      await User.create({
        name: "Kishan Admin",
        username: "kishan_admin",
        email: "admin@kishanclasses.com",
        passwordHash: "admin123",
        role: "ADMIN",
        isActive: true
      });
      console.log("==================================================");
      console.log("  [AUTO-ADMIN] Admin Created Successfully!");
      console.log("  Username : kishan_admin");
      console.log("  Password : admin123");
      console.log("==================================================");
    } else {
      // Ensure kishan_admin also exists if only generic admin was created
      const kishanAdmin = await User.findOne({ username: "kishan_admin" });
      if (!kishanAdmin) {
        await User.create({
          name: "Kishan Admin",
          username: "kishan_admin",
          email: "kishan_admin@kishanclasses.com",
          passwordHash: "admin123",
          role: "ADMIN",
          isActive: true
        });
        console.log("[AUTO-ADMIN] Created 'kishan_admin' account (Password: admin123).");
      }
      console.log(`[AUTO-ADMIN] Verified admin account exists (${adminExists.username}).`);
    }
  } catch (err) {
    console.error("[AUTO-ADMIN] Error ensuring default admin user:", err.message);
  }
};
