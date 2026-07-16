import mongoose from "mongoose";

const fileMetadataSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileId: { type: String },
    name: { type: String, required: true },
    size: { type: Number, required: true }, // size in bytes
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const studyMaterialSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true,
      maxlength: 150
    },
    subject: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Subject", 
      required: true,
      index: true 
    },
    description: {
      type: String,
      maxlength: 3000
    },
    audienceType: { 
      type: String, 
      enum: ["all", "students", "teachers", "particular-students", "particular-teachers", "batch"], 
      default: "all", 
      index: true,
      required: true
    },
    recipientStudentIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Student" 
    }],
    recipientTeacherIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Teacher" 
    }],
    recipientBatchIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Batch" 
    }],
    uploadedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    uploaderRole: {
      type: String,
      enum: ["admin", "teacher"],
      required: true
    },
    files: [fileMetadataSchema],
    externalUrls: [{
      type: String
    }],
    whatsappEnabled: {
      type: Boolean,
      default: false
    },
    whatsappNotificationStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "none"],
      default: "none"
    },
    totalDownloads: {
      type: Number,
      default: 0
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

export const StudyMaterial = mongoose.model("StudyMaterial", studyMaterialSchema);
