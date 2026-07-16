import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import { Batch } from "../models/Batch.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const batches = await Batch.find({});
    for (const batch of batches) {
      const validStudents = [];
      for (const studentId of batch.students) {
        const exists = await Student.findById(studentId);
        if (exists) {
          validStudents.push(studentId);
        }
      }
      if (validStudents.length !== batch.students.length) {
         batch.students = validStudents;
         await batch.save();
         console.log(`Cleaned up batch ${batch.name}, removed ${batch.students.length - validStudents.length} dead students`);
      }
    }

    console.log("Cleanup successful.");
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
};

cleanup();
