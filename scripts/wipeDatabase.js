import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Batch } from '../src/models/Batch.js';
import { Course } from '../src/models/Course.js';
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

const URI = process.env.MONGODB_URI;

async function wipeDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(URI);
    console.log('Connected.');

    console.log('Wiping Batches...');
    await Batch.deleteMany({});
    
    console.log('Wiping Courses...');
    await Course.deleteMany({});
    
    console.log('Wiping Fees...');
    await Fee.deleteMany({});
    
    console.log('Wiping Notices...');
    await Notice.deleteMany({});
    
    console.log('Wiping Results...');
    await Result.deleteMany({});
    
    console.log('Wiping Settings...');
    await Setting.deleteMany({});
    
    console.log('Wiping Students...');
    await Student.deleteMany({});
    
    console.log('Wiping Student ID Counters...');
    await StudentIdCounter.deleteMany({});
    
    console.log('Wiping Study Materials...');
    await StudyMaterial.deleteMany({});
    
    console.log('Wiping Subjects...');
    await Subject.deleteMany({});
    
    console.log('Wiping Teachers...');
    await Teacher.deleteMany({});
    
    console.log('Wiping Tests...');
    await Test.deleteMany({});
    
    console.log('Wiping ALL Users (including admin)...');
    const deleteUsersResult = await User.deleteMany({});
    console.log(`Deleted ${deleteUsersResult.deletedCount} users.`);

    console.log('\n✅ Successfully wiped ALL data!');
    process.exit(0);
  } catch (err) {
    console.error('Error wiping database:', err);
    process.exit(1);
  }
}

wipeDatabase();
