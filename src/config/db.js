import dns from "node:dns";
import mongoose from "mongoose";

// Force Google DNS since the local DNS may not resolve MongoDB Atlas hostnames
dns.setServers(["8.8.8.8", "8.8.4.4"]);

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Copy server/.env.example to server/.env.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production"
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
};
