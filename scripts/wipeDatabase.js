import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from server/.env or .env
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Batch } from '../src/models/Batch.js';
import { Fee } from '../src/models/Fee.js';
import { Notice } from '../src/models/Notice.js';
import { Result } from '../src/models/Result.js';
import { Setting } from '../src/models/Setting.js';
import { Student } from '../src/models/Student.js';
import { StudentIdCounter } from '../src/models/StudentIdCounter.js';
import { StudyMaterial } from '../src/models/StudyMaterial.js';
import { Subject } from '../src/models/Subject.js';
import { Teacher } from '../src/models/Teacher.js';
import { Test } from '../src/models/Test.js';
import { User } from '../src/models/User.js';
import { WhatsAppTemplate } from '../src/models/WhatsAppTemplate.js';
import { Remark } from '../src/models/Remark.js';
import { PaymentReversalLog } from '../src/models/PaymentReversalLog.js';
import { ensureDefaultAdmin } from '../src/utils/initAdmin.js';
import { seedDefaultTemplates } from '../src/controllers/whatsappTemplateController.js';

const URI = process.env.MONGODB_URI;

async function wipeDatabaseAndInitializeProduction() {
  if (!URI) {
    console.error("❌ MONGODB_URI is missing in environment variables!");
    process.exit(1);
  }

  try {
    console.log("==================================================");
    console.log("   PRODUCITON DATABASE RESET & INITIALIZATION     ");
    console.log("==================================================");
    console.log("Connecting to MongoDB...");
    await mongoose.connect(URI);
    console.log("Connected successfully.\n");

    console.log("Deleting demo data from collections...");
    
    const stats = {};
    
    stats.students = (await Student.deleteMany({})).deletedCount;
    stats.teachers = (await Teacher.deleteMany({})).deletedCount;
    stats.fees = (await Fee.deleteMany({})).deletedCount;
    stats.batches = (await Batch.deleteMany({})).deletedCount;
    stats.subjects = (await Subject.deleteMany({})).deletedCount;
    stats.tests = (await Test.deleteMany({})).deletedCount;
    stats.results = (await Result.deleteMany({})).deletedCount;
    stats.notices = (await Notice.deleteMany({})).deletedCount;
    stats.studyMaterials = (await StudyMaterial.deleteMany({})).deletedCount;
    stats.remarks = (await Remark.deleteMany({})).deletedCount;
    stats.settings = (await Setting.deleteMany({})).deletedCount;
    stats.studentIdCounters = (await StudentIdCounter.deleteMany({})).deletedCount;
    stats.paymentReversals = (await PaymentReversalLog.deleteMany({})).deletedCount;
    stats.whatsAppTemplates = (await WhatsAppTemplate.deleteMany({})).deletedCount;
    stats.users = (await User.deleteMany({})).deletedCount;

    console.log("\n📊 Deleted Record Summary:");
    console.table(stats);

    console.log("\nInitializing mandatory production system data...");
    await ensureDefaultAdmin();
    await seedDefaultTemplates();

    console.log("\n✅ Database has been successfully reset and initialized for Production!");
    console.log("==================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error during production database reset:", err);
    process.exit(1);
  }
}

wipeDatabaseAndInitializeProduction();
