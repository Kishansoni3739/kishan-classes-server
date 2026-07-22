import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Student } from '../src/models/Student.js';
import { Teacher } from '../src/models/Teacher.js';
import { Batch } from '../src/models/Batch.js';

import { MonthlyEnrollment } from '../src/models/MonthlyEnrollment.js';
import { MonthlyTenure } from '../src/models/MonthlyTenure.js';
import { MonthlyPayment } from '../src/models/MonthlyPayment.js';
import { BatchEnrollment } from '../src/models/BatchEnrollment.js';
import { BatchInstallment } from '../src/models/BatchInstallment.js';
import { BatchPayment } from '../src/models/BatchPayment.js';

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const addMonths = (date, months) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; };

const firstNames = ["Amit", "Rahul", "Priya", "Neha", "Rohan", "Sneha", "Vikram", "Pooja", "Arjun", "Kavita", "Karan", "Simran", "Suresh", "Ramesh", "Deepak", "Anjali", "Gaurav", "Nisha", "Rohit", "Aarti", "Manish", "Sunita", "Raj", "Anita", "Sanjay", "Suman"];
const lastNames = ["Kumar", "Singh", "Sharma", "Verma", "Yadav", "Gupta", "Mishra", "Patel", "Das", "Chaudhary", "Jain", "Bansal", "Mehta", "Reddy", "Nair", "Rao"];

const generateName = () => `${randomItem(firstNames)} ${randomItem(lastNames)}`;
const generatePhone = () => `9${Math.floor(100000000 + Math.random() * 900000000)}`;
const generateEmail = (name) => `${name.replace(' ', '.').toLowerCase()}${randomInt(10, 99)}@example.com`;

async function seed() {
  await connectDB();
  console.log("Seeding Database...");

  // 1. Teachers
  const subjects = ["Mathematics", "Science", "English", "Hindi", "Social Science", "Computer"];
  const createdTeachers = [];
  for (let i = 0; i < 12; i++) {
    const name = generateName();
    const empId = `TCH${100+i}`;
    const firstName = name.trim().split(/\s+/)[0];
    const user = await User.create({ name, username: empId, email: generateEmail(name), phone: generatePhone(), role: "teacher", password: firstName, mustChangePassword: true });
    const teacher = await Teacher.create({
      user: user._id, employeeId: empId, subject: randomItem(subjects),
      joiningDate: randomDate(new Date(2023, 0, 1), new Date(2025, 11, 31)), salary: randomInt(20000, 50000),
      status: "active"
    });
    createdTeachers.push(teacher);
  }
  console.log(`✅ Created 12 Teachers`);

  // 3. Batches
  const batchNames = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10 Morning", "Class 10 Evening", "Class 11 Science", "Class 11 Commerce", "Class 12 Science A", "Class 12 Science B", "Class 12 Commerce", "SSC Foundation Batch A", "SSC Foundation Batch B", "Railway Prep", "UPSC Basics", "Spoken English Morning", "Bank PO", "General Knowledge"];
  const createdBatches = [];
  for (let i = 0; i < 18; i++) {
    const batch = await Batch.create({
      name: batchNames[i], code: `B${100+i}`, capacity: randomInt(30, 60),
      teacher: randomItem(createdTeachers)._id, schedule: "Mon-Wed-Fri", time: "10:00 AM",
      enrollmentType: randomItem(["MONTHLY", "BATCH"])
    });
    createdBatches.push(batch);
  }
  console.log(`✅ Created 18 Batches`);

  // 4. Monthly Students
  const monthlyFeesAmounts = [800, 1000, 1200, 1500, 1800, 2200];
  let studentCount = 1;
  for (let i = 0; i < 80; i++) {
    process.stdout.write(`M${i} `);
    let name = generateName();
    if (i === 0) name = "Rahul Kumar";
    if (i === 1) name = "Rahul Singh";
    if (i === 2) name = "Rahul Verma";

    const user = await User.create({ name, email: generateEmail(name), phone: generatePhone(), role: "student", password: "password123" });
    const student = await Student.create({
      user: user._id, studentId: `STU${1000 + studentCount++}`, admissionDate: randomDate(new Date(2025, 0, 1), new Date(2026, 3, 30)),
      guardianName: generateName(), guardianPhone: generatePhone(), address: "123 Test Street", status: "active", enrollmentType: "MONTHLY"
    });
    
    const monthlyFee = randomItem(monthlyFeesAmounts);
    const enrollment = await MonthlyEnrollment.create({ student: student._id, batch: randomItem(createdBatches)._id, admissionDate: student.admissionDate, monthlyFee, status: "active" });

    // Determine state: 40 paid, 20 partial, 15 overdue, 5 recent
    const state = i < 40 ? "paid" : i < 60 ? "partial" : i < 75 ? "overdue" : "recent";
    
    // Generate tenures based on admission
    let currentPeriod = new Date(enrollment.admissionDate.getFullYear(), enrollment.admissionDate.getMonth(), 1);
    const now = new Date();
    while (currentPeriod < now) {
      const nextPeriod = addMonths(currentPeriod, 1);
      const isCurrentMonth = currentPeriod.getMonth() === now.getMonth() && currentPeriod.getFullYear() === now.getFullYear();
      
      const tenureStatus = state === "paid" ? "paid" : (state === "partial" && isCurrentMonth ? "partial" : (state === "overdue" ? "unpaid" : "unpaid"));
      
      const tenure = await MonthlyTenure.create({
        student: student._id, enrollment: enrollment._id,
        periodStart: currentPeriod, periodEnd: new Date(nextPeriod.getTime() - 1), dueDate: new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() + 5),
        totalAmount: monthlyFee, discount: 0, status: tenureStatus
      });

      if (tenureStatus === "paid" || tenureStatus === "partial") {
        const paidAmount = tenureStatus === "paid" ? monthlyFee : randomInt(100, monthlyFee - 100);
        await MonthlyPayment.create({
          student: student._id, tenure: tenure._id, amount: paidAmount,
          method: randomItem(["cash", "upi", "bank_transfer"]), receiptNo: `KC-FEE-${Date.now()}-${randomInt(1000, 9999)}`,
          paidAt: new Date(currentPeriod.getTime() + randomInt(1, 10)*86400000)
        });
      }
      currentPeriod = nextPeriod;
      if (state === "recent") break; // Only 1 tenure for recent
    }
  }
  console.log(`✅ Created 80 Monthly Students and their histories`);

  // 5. Course Students
  for (let i = 0; i < 40; i++) {
    process.stdout.write(`C${i} `);
    const name = generateName();
    const user = await User.create({ name, email: generateEmail(name), phone: generatePhone(), role: "student", password: "password123" });
    const student = await Student.create({
      user: user._id, studentId: `STU${1000 + studentCount++}`, admissionDate: randomDate(new Date(2025, 0, 1), new Date(2026, 3, 30)),
      guardianName: generateName(), guardianPhone: generatePhone(), address: "456 Main Road", status: "active", enrollmentType: "BATCH"
    });

    const batch = randomItem(createdBatches);
    const enrollment = await BatchEnrollment.create({
      student: student._id, batch: batch._id, enrollmentDate: student.admissionDate,
      batchDurationMonths: 12, batchFee: 5000, discount: 0, finalFee: 5000, status: "active"
    });

    const state = i < 15 ? "paid" : i < 30 ? "installment" : "pending";

    // Create Installments
    const numInstallments = Math.min(12, 3);
    const instAmount = Math.floor(5000 / numInstallments);
    let currentDue = new Date(enrollment.enrollmentDate);
    
    for (let j = 0; j < numInstallments; j++) {
      const isLast = j === numInstallments - 1;
      const amount = isLast ? (5000 - (instAmount * (numInstallments - 1))) : instAmount;
      
      let instStatus = "unpaid";
      if (state === "paid") instStatus = "paid";
      else if (state === "installment" && j === 0) instStatus = "paid";
      else if (state === "installment" && j === 1) instStatus = "partial";
      else if (state === "pending") instStatus = "unpaid";

      const installment = await BatchInstallment.create({
        student: student._id, enrollment: enrollment._id, dueDate: currentDue,
        totalAmount: amount, status: instStatus
      });

      if (instStatus === "paid" || instStatus === "partial") {
        const paidAmount = instStatus === "paid" ? amount : randomInt(100, amount - 100);
        await BatchPayment.create({
          student: student._id, installment: installment._id, amount: paidAmount,
          method: randomItem(["cash", "upi", "card"]), receiptNo: `KC-CRS-${Date.now()}-${randomInt(1000, 9999)}`,
          paidAt: new Date(currentDue.getTime() + randomInt(0, 5)*86400000)
        });
      }
      currentDue = addMonths(currentDue, 1);
    }
  }
  console.log(`✅ Created 40 Course Students and their histories`);

  console.log("🎉 Successfully populated Realistic Demo Data for Admin Testing!");
  process.exit(0);
}

seed();
