import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Student } from '../src/models/Student.js';
import { User } from '../src/models/User.js';
import { Fee } from '../src/models/Fee.js';
import { Result } from '../src/models/Result.js';

const URI = process.env.MONGODB_URI;

async function deleteAllStudents() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(URI);
    console.log('Connected.');

    console.log('Deleting all Results...');
    await Result.deleteMany({});
    
    console.log('Deleting all Fees...');
    await Fee.deleteMany({});
    
    console.log('Deleting all Students...');
    await Student.deleteMany({});
    
    console.log('Deleting all Users with role = student...');
    await User.deleteMany({ role: 'student' });

    console.log('Successfully deleted all student-related data!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

deleteAllStudents();
