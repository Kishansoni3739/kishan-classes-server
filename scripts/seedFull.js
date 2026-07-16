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

const createFakeDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
};

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(URI);
    console.log('Connected.');

    // 1. Settings
    console.log('Seeding Settings...');
    await Setting.create({ key: 'studentIdPrefix', value: 'KC-' });
    
    // 2. Admin User
    console.log('Seeding Admin...');
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@kishanclasses.com',
      password: 'password123',
      phone: '9999999999',
      role: 'admin'
    });

    // 3. Subjects
    console.log('Seeding Subjects...');
    const subPhysics = await Subject.create({ name: 'Physics', code: 'PHY', description: 'Advanced Physics' });
    const subChemistry = await Subject.create({ name: 'Chemistry', code: 'CHEM', description: 'Organic & Inorganic' });
    const subMaths = await Subject.create({ name: 'Mathematics', code: 'MATH', description: 'Calculus & Algebra' });
    const subBio = await Subject.create({ name: 'Biology', code: 'BIO', description: 'Botany & Zoology' });

    // 4. Teachers
    console.log('Seeding Teachers...');
    const tUser1 = await User.create({ name: 'Dr. HC Verma', email: 'hcverma@kishanclasses.com', password: 'password123', phone: '9888888881', role: 'teacher' });
    const tUser2 = await User.create({ name: 'RD Sharma', email: 'rdsharma@kishanclasses.com', password: 'password123', phone: '9888888882', role: 'teacher' });
    
    const teacher1 = await Teacher.create({
      user: tUser1._id,
      employeeId: 'EMP-001',
      qualification: 'Ph.D Physics',
      specialization: 'Quantum Mechanics',
      joiningDate: createFakeDate(1000),
      subjects: [subPhysics._id],
      status: 'active'
    });
    
    const teacher2 = await Teacher.create({
      user: tUser2._id,
      employeeId: 'EMP-002',
      qualification: 'M.Sc Mathematics',
      specialization: 'Advanced Calculus',
      joiningDate: createFakeDate(900),
      subjects: [subMaths._id],
      status: 'active'
    });

    // 5. Courses
    console.log('Seeding Courses...');
    const courseJEE = await Course.create({
      name: 'JEE Main + Advanced 2026',
      description: '2 Year comprehensive classroom program',
      totalFee: 120000,
      durationMonths: 24,
      subjects: [subPhysics._id, subChemistry._id, subMaths._id],
      status: 'active'
    });

    // 6. Batches
    console.log('Seeding Batches...');
    const batchMorning = await Batch.create({
      name: 'Morning Star - Class 11 (JEE)',
      course: courseJEE._id,
      schedule: 'Mon, Wed, Fri (8:00 AM - 12:00 PM)',
      capacity: 40,
      teachers: [teacher1._id, teacher2._id],
      isActive: true
    });

    // 7. Students (Monthly and Course-based)
    console.log('Seeding Students & Users...');
    
    // Course Student
    const sUser1 = await User.create({ name: 'Rahul Kumar', email: 'rahul@student.com', password: 'password123', phone: '9111111111', role: 'student' });
    const student1 = await Student.create({
      user: sUser1._id,
      studentId: 'KC-2026-00001',
      enrollmentType: 'BATCH',
      course: courseJEE._id,
      batch: batchMorning._id,
      admissionDate: createFakeDate(120), // joined 4 months ago
      guardian: { name: 'Raj Kumar', relation: 'Father', phone: '9222222222' },
      address: '123 Main St, City',
      status: 'active'
    });

    // Monthly Student
    const sUser2 = await User.create({ name: 'Priya Sharma', email: 'priya@student.com', password: 'password123', phone: '9333333333', role: 'student' });
    const student2 = await Student.create({
      user: sUser2._id,
      studentId: 'KC-2026-00002',
      enrollmentType: 'MONTHLY',
      monthlyFee: 5000,
      subjects: [subPhysics._id, subChemistry._id],
      admissionDate: createFakeDate(90), // joined 3 months ago
      guardian: { name: 'Sunil Sharma', relation: 'Father', phone: '9444444444' },
      address: '456 Park Ave, City',
      status: 'active'
    });

    // 8. Fees & Payments
    console.log('Seeding Fees...');
    
    // Course Student Fees: 120k / 24 = 5000 per month
    const inst1Due = createFakeDate(90);
    const inst2Due = createFakeDate(60);
    const inst3Due = createFakeDate(30);
    const inst4Due = createFakeDate(-10); // Upcoming

    // Paid installment
    await Fee.create({
      student: student1._id, course: courseJEE._id, totalAmount: 5000, dueDate: inst1Due, status: 'paid',
      payments: [{ amount: 5000, method: 'cash', receiptNo: 'REC-001', paidAt: createFakeDate(85), collectedBy: adminUser._id }]
    });
    // Partially paid installment
    await Fee.create({
      student: student1._id, course: courseJEE._id, totalAmount: 5000, dueDate: inst2Due, status: 'partial',
      payments: [{ amount: 3000, method: 'upi', receiptNo: 'REC-002', paidAt: createFakeDate(55), collectedBy: adminUser._id }]
    });
    // Overdue installment
    await Fee.create({ student: student1._id, course: courseJEE._id, totalAmount: 5000, dueDate: inst3Due, status: 'overdue', payments: [] });
    // Upcoming installment
    await Fee.create({ student: student1._id, course: courseJEE._id, totalAmount: 5000, dueDate: inst4Due, status: 'pending', payments: [] });


    // Monthly Student Fees
    const p1Start = createFakeDate(90);
    const p1End = createFakeDate(61);
    const p2Start = createFakeDate(60);
    const p2End = createFakeDate(31);
    const p3Start = createFakeDate(30);
    const p3End = createFakeDate(1);

    // Paid month 1
    await Fee.create({
      student: student2._id, totalAmount: 5000, periodStart: p1Start, periodEnd: p1End, dueDate: p1End, status: 'paid',
      payments: [{ amount: 5000, method: 'online', receiptNo: 'REC-101', paidAt: createFakeDate(60), collectedBy: adminUser._id }]
    });
    // Paid month 2
    await Fee.create({
      student: student2._id, totalAmount: 5000, periodStart: p2Start, periodEnd: p2End, dueDate: p2End, status: 'paid',
      payments: [{ amount: 5000, method: 'cash', receiptNo: 'REC-102', paidAt: createFakeDate(30), collectedBy: adminUser._id }]
    });
    // Overdue month 3
    await Fee.create({ student: student2._id, totalAmount: 5000, periodStart: p3Start, periodEnd: p3End, dueDate: p3End, status: 'overdue', payments: [] });


    // 9. Tests & Results
    console.log('Seeding Tests...');
    const pastTest = await Test.create({
      title: 'Physics Mechanics Mock',
      subject: subPhysics._id,
      batch: batchMorning._id,
      students: [student1._id],
      testDate: createFakeDate(15),
      maxMarks: 100,
      teacher: teacher1._id,
      status: 'completed'
    });

    const upcomingTest = await Test.create({
      title: 'JEE Full Syllabus Test 1',
      subject: subMaths._id,
      batch: batchMorning._id,
      students: [student1._id],
      testDate: createFakeDate(-5),
      maxMarks: 300,
      teacher: teacher2._id,
      status: 'scheduled'
    });

    console.log('Seeding Results...');
    await Result.create({
      test: pastTest._id,
      student: student1._id,
      marksObtained: 85,
      percentage: 85,
      grade: 'A',
      feedback: 'Excellent performance in Rotational Mechanics',
      teacher: teacher1._id
    });


    // 10. Notices
    console.log('Seeding Notices...');
    await Notice.create({
      title: 'Diwali Holidays Announcement',
      content: 'The coaching center will remain closed for 3 days on account of Diwali. Happy festivities!',
      priority: 'high',
      targetAudience: 'all',
      validUntil: createFakeDate(-10),
      createdBy: adminUser._id
    });


    // 11. Study Materials
    console.log('Seeding Study Materials...');
    await StudyMaterial.create({
      title: 'Kinematics Formula Sheet',
      subject: subPhysics._id,
      recipientBatchIds: [batchMorning._id],
      description: 'Quick revision formulas for 1D and 2D motion.',
      audienceType: 'batch',
      uploadedBy: teacher1.user?._id || teacher1.user || teacher1._id,
      uploaderRole: 'teacher',
      files: [
        {
          url: 'https://example.com/kinematics.pdf',
          name: 'kinematics.pdf',
          size: 102400,
          mimeType: 'application/pdf',
          uploadedAt: new Date()
        }
      ],
      externalUrls: []
    });


    console.log('\n✅ Successfully seeded database with all rich features!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seedDatabase();
