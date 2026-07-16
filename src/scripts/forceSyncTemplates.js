import mongoose from "mongoose";
import dotenv from "dotenv";
import { WhatsAppTemplate } from "../models/WhatsAppTemplate.js";
import { defaultTemplates } from "../controllers/defaultTemplates.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Find and update or insert each default template
    for (const defTemp of defaultTemplates) {
      console.log(`Syncing template: ${defTemp.name}`);
      const result = await WhatsAppTemplate.findOneAndUpdate(
        { name: defTemp.name },
        { 
          messageBody: defTemp.messageBody,
          variables: defTemp.variables,
          category: defTemp.category,
          isDefault: defTemp.isDefault
        },
        { upsert: true, new: true }
      );
      console.log(`Synced template "${defTemp.name}" successfully.`);
    }

    console.log("Sync complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error during sync:", error);
    process.exit(1);
  }
};

run();
