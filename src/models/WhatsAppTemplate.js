import mongoose from "mongoose";

const whatsappTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Template name is required"],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    messageBody: {
      type: String,
      required: [true, "Message body is required"],
    },
    variables: [{
      type: String,
      trim: true
    }],
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const WhatsAppTemplate = mongoose.model("WhatsAppTemplate", whatsappTemplateSchema);
