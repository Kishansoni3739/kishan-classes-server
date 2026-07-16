import mongoose from "mongoose";

const materialDownloadSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudyMaterial",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    userName: {
      type: String,
      required: true
    },
    userRole: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { timestamps: true }
);

export const MaterialDownload = mongoose.model("MaterialDownload", materialDownloadSchema);
