import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we load from the server root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { Student } from '../src/models/Student.js';
import { Teacher } from '../src/models/Teacher.js';
import { Batch } from '../src/models/Batch.js';
import { Test } from '../src/models/Test.js';
import { Result } from '../src/models/Result.js';
import { Notice } from '../src/models/Notice.js';
import { StudyMaterial } from '../src/models/StudyMaterial.js';
import { Fee } from '../src/models/Fee.js';
import { MonthlyEnrollment } from '../src/models/MonthlyEnrollment.js';
import { MonthlyTenure } from '../src/models/MonthlyTenure.js';
import { MonthlyPayment } from '../src/models/MonthlyPayment.js';
import { BatchEnrollment } from '../src/models/BatchEnrollment.js';
import { BatchInstallment } from '../src/models/BatchInstallment.js';
import { BatchPayment } from '../src/models/BatchPayment.js';
import { User } from '../src/models/User.js';
import { StudentIdCounter } from '../src/models/StudentIdCounter.js';

const URI = process.env.MONGODB_URI;

const backupCollection = async (model, backupDir) => {
  try {
    const data = await model.find({});
    const filePath = path.join(backupDir, `${model.modelName}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Backed up ${data.length} records from ${model.modelName}`);
  } catch (err) {
    console.error(`❌ Failed to backup ${model.modelName}:`, err.message);
  }
};

async function wipeData() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected successfully.\n');

    // 1. Database Backup
    const backupDir = path.join(__dirname, '../backup', `backup-${Date.now()}`);
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Creating database backup at ${backupDir}...`);

    const collectionsToWipe = [
      Student, Teacher, Batch, Test, Result, Notice, StudyMaterial, Fee,
      MonthlyEnrollment, MonthlyTenure, MonthlyPayment,
      BatchEnrollment, BatchInstallment, BatchPayment
    ];

    for (const model of collectionsToWipe) {
      await backupCollection(model, backupDir);
    }
    await backupCollection(User, backupDir);
    await backupCollection(StudentIdCounter, backupDir);
    
    console.log('\nBackup complete. Starting destructive wipe...\n');

    // 2. Delete Demo Entities
    for (const model of collectionsToWipe) {
      const result = await model.deleteMany({});
      console.log(`🗑️ Deleted ${result.deletedCount} records from ${model.modelName}`);
    }

    // 3. Clean Users (Remove students and teachers, keep admins)
    const userResult = await User.deleteMany({ role: { $in: ['student', 'teacher'] } });
    console.log(`🗑️ Deleted ${userResult.deletedCount} User records (Students & Teachers)`);

    // 4. Reset Counters
    const counterResult = await StudentIdCounter.deleteMany({});
    console.log(`🗑️ Reset StudentIdCounter (Deleted ${counterResult.deletedCount} counters)`);

    console.log('\n🎉 System has been completely wiped of demo data and is ready for production!');
    console.log('Note: Admin accounts, Courses, Subjects, and Settings have been fully preserved.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Wipe operation failed:', error);
    process.exit(1);
  }
}

wipeData();
