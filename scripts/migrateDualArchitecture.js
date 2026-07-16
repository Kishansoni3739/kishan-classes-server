import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import { Student } from '../src/models/Student.js';
import { Fee } from '../src/models/Fee.js';
import { Course } from '../src/models/Course.js';
import { MonthlyEnrollment } from '../src/models/MonthlyEnrollment.js';
import { MonthlyTenure } from '../src/models/MonthlyTenure.js';
import { MonthlyPayment } from '../src/models/MonthlyPayment.js';
import { CourseEnrollment } from '../src/models/CourseEnrollment.js';
import { CourseInstallment } from '../src/models/CourseInstallment.js';
import { CoursePayment } from '../src/models/CoursePayment.js';

const URI = process.env.MONGODB_URI;

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(URI);
    console.log('Connected.');

    // Clear new collections first if re-running
    await MonthlyEnrollment.deleteMany({});
    await MonthlyTenure.deleteMany({});
    await MonthlyPayment.deleteMany({});
    await CourseEnrollment.deleteMany({});
    await CourseInstallment.deleteMany({});
    await CoursePayment.deleteMany({});

    console.log('Migrating Students to Enrollments...');
    const students = await Student.find({});
    
    for (const student of students) {
      if (student.enrollmentType === "MONTHLY") {
        const enrollment = await MonthlyEnrollment.create({
          student: student._id,
          batch: student.batch,
          subjects: student.subjects,
          admissionDate: student.admissionDate,
          monthlyFee: student.monthlyFee || 0,
          status: student.status === "completed" ? "inactive" : (student.status || "active")
        });

        const fees = await Fee.find({ student: student._id });
        for (const fee of fees) {
          const tenure = await MonthlyTenure.create({
            student: student._id,
            enrollment: enrollment._id,
            periodStart: fee.periodStart || new Date(),
            periodEnd: fee.periodEnd || new Date(),
            dueDate: fee.dueDate || new Date(),
            totalAmount: fee.totalAmount,
            discount: fee.discount,
            status: fee.status === "paid" ? "paid" : (fee.status === "partial" ? "partial" : (fee.status === "overdue" ? "unpaid" : "unpaid"))
          });

          for (const payment of fee.payments) {
            await MonthlyPayment.create({
              student: student._id,
              tenure: tenure._id,
              amount: payment.amount,
              paidAt: payment.paidAt,
              method: payment.method,
              receiptNo: payment.receiptNo,
              collectedBy: payment.collectedBy
            });
          }
        }
      } else {
        // Course / BATCH
        let courseDurationMonths = 12;
        let finalFee = 0;
        if (student.course) {
          const course = await Course.findById(student.course);
          if (course) {
            courseDurationMonths = course.durationMonths || 12;
            finalFee = course.totalFee || 0;
          }
        }

        const enrollment = await CourseEnrollment.create({
          student: student._id,
          course: student.course,
          enrollmentDate: student.admissionDate,
          courseDurationMonths: courseDurationMonths,
          courseFee: finalFee,
          discount: 0,
          finalFee: finalFee,
          status: student.status === "completed" ? "completed" : (student.status || "active")
        });

        const fees = await Fee.find({ student: student._id });
        for (const fee of fees) {
          const installment = await CourseInstallment.create({
            student: student._id,
            enrollment: enrollment._id,
            dueDate: fee.dueDate || new Date(),
            totalAmount: fee.totalAmount,
            status: fee.status === "paid" ? "paid" : (fee.status === "partial" ? "partial" : "unpaid")
          });

          for (const payment of fee.payments) {
            await CoursePayment.create({
              student: student._id,
              installment: installment._id,
              amount: payment.amount,
              paidAt: payment.paidAt,
              method: payment.method,
              receiptNo: payment.receiptNo,
              collectedBy: payment.collectedBy
            });
          }
        }
      }
    }

    console.log('Migration of models complete.');
    console.log('NOTE: Legacy fields (enrollmentType, batch, course, monthlyFee) on Student have NOT been dropped yet.');
    console.log('Please ensure the UI functions properly before running a schema clean up.');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
