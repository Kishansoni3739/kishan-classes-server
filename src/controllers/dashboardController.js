import { Batch } from "../models/Batch.js";
import { Notice } from "../models/Notice.js";
import { Result } from "../models/Result.js";
import { Student } from "../models/Student.js";
import { StudyMaterial } from "../models/StudyMaterial.js";
import { Teacher } from "../models/Teacher.js";
import { Test } from "../models/Test.js";
import { Fee } from "../models/Fee.js";
import { User } from "../models/User.js";
import { Remark } from "../models/Remark.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const calculateGrade = (percentage) => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
};

export const adminDashboard = asyncHandler(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // Basic lookups
  const totalTeachers = await Teacher.countDocuments();
  const activeBatches = await Batch.countDocuments({ isActive: true });
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const upcomingTests = await Test.find({ testDate: { $gte: now }, status: "scheduled" })
    .populate("subject", "name")
    .populate("batch", "name")
    .sort("testDate")
    .limit(10);

  const recentTests = await Test.find()
    .populate("subject", "name")
    .populate("batch", "name")
    .sort("-testDate")
    .limit(10);
    
  const todaysTests = await Test.find({ testDate: { $gte: todayStart, $lt: tomorrow } })
    .populate("subject", "name")
    .populate("batch", "name")
    .sort("testDate")
    .limit(10);
    
  const completedTestsCount = await Test.countDocuments({ status: "completed" });
  const cancelledTestsCount = await Test.countDocuments({ status: "cancelled" });
  const todayTestsCount = await Test.countDocuments({ testDate: { $gte: todayStart, $lt: tomorrow } });
    
  const topResultsAgg = await Result.aggregate([
    {
      $lookup: {
        from: "tests",
        localField: "test",
        foreignField: "_id",
        as: "testDoc"
      }
    },
    { $unwind: "$testDoc" },
    { 
      $match: { 
        "testDoc.status": "completed",
        "testDoc.testDate": { $gte: thirtyDaysAgo },
        percentage: { $ne: null }
      } 
    },
    {
      $group: {
        _id: "$student",
        avgPercentage: { $avg: "$percentage" }
      }
    },
    { $sort: { avgPercentage: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "students",
        localField: "_id",
        foreignField: "_id",
        as: "studentDoc"
      }
    },
    { $unwind: "$studentDoc" },
    { $match: { "studentDoc.status": "active" } },
    {
      $lookup: {
        from: "users",
        localField: "studentDoc.user",
        foreignField: "_id",
        as: "userDoc"
      }
    },
    { $unwind: "$userDoc" },
    {
      $lookup: {
        from: "batches",
        localField: "studentDoc.batch",
        foreignField: "_id",
        as: "batchDoc"
      }
    },
    {
      $unwind: { path: "$batchDoc", preserveNullAndEmptyArrays: true }
    }
  ]);

  let totalStudents = 0;
  let feeCollection = 0;
  let pendingFeesAmount = 0;
  const studentDuesMap = new Map();
  let upcomingDueDates = [];

  totalStudents = await Student.countDocuments({ status: "active" });
  
  const feesAgg = await Fee.aggregate([
    { $unwind: "$payments" },
    { $match: { "payments.paidAt": { $gte: startOfMonth }, "payments.status": "active" } },
    { $group: { _id: null, totalCollected: { $sum: "$payments.amount" } } }
  ]);
  feeCollection = feesAgg[0]?.totalCollected || 0;

  const pendingFees = await Fee.find({ status: { $in: ["pending", "partial", "overdue"] } })
    .populate({ path: "student", select: "studentId user batch", populate: [{ path: "user", select: "name" }, { path: "batch", select: "name" }] });

  for (const fee of pendingFees) {
    const due = fee.pendingAmount;
    if (due > 0 && fee.student) {
      pendingFeesAmount += due;
      
      const sId = fee.student._id.toString();
      if (!studentDuesMap.has(sId)) {
        studentDuesMap.set(sId, {
          _id: sId,
          studentId: fee.student.studentId,
          studentName: fee.student.user?.name || "-",
          batch: fee.student.batch?.name || "-",
          dueAmount: 0
        });
      }
      studentDuesMap.get(sId).dueAmount += due;
    }
  }

  const activeStudents = await Student.find({ status: "active" })
    .populate("user", "name")
    .populate("batch", "name");

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const student of activeStudents) {
    const adminDate = student.admissionDate || student.createdAt;
    if (!adminDate) continue;
    
    const day = adminDate.getDate();
    let nextDueDate = new Date(today.getFullYear(), today.getMonth(), day);
    
    if (nextDueDate < today) {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }
    
    const daysUntilDue = Math.round((nextDueDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue >= 0 && daysUntilDue <= 7) {
      upcomingDueDates.push({
        _id: student._id.toString() + nextDueDate.getTime(),
        studentId: student.studentId,
        studentName: student.user?.name || "-",
        batch: student.batch?.name || "-",
        dueAmount: student.monthlyFee || 0,
        dueDate: nextDueDate,
        status: "upcoming",
        daysUntilDue,
        urgency: daysUntilDue === 0 ? "red" : daysUntilDue <= 3 ? "yellow" : "green"
      });
    }
  }

  // Sort aggregates
  const feesDueStudents = Array.from(studentDuesMap.values()).sort((a, b) => b.dueAmount - a.dueAmount).slice(0, 10);
  upcomingDueDates = upcomingDueDates.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 10);

  const topPerformers = topResultsAgg.map((result, index) => ({
    _id: result._id,
    rank: index + 1,
    studentName: result.userDoc?.name || "-",
    batch: result.batchDoc?.name || "-",
    testTitle: "Average (All Tests)",
    percentage: Number(result.avgPercentage.toFixed(1)),
    grade: calculateGrade(result.avgPercentage)
  }));

  const recentNotices = await Notice.find({
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).populate("batch").limit(5).sort("-createdAt").populate("createdBy", "name role");

  res.json({
    cards: {
      totalStudents,
      totalTeachers,
      monthlyFeeCollection: feeCollection,
      pendingFees: pendingFeesAmount,
      activeBatches,
      completedTests: completedTestsCount,
      cancelledTests: cancelledTestsCount,
      todayTests: todayTestsCount
    },
    upcomingTests,
    recentTests,
    feesDueStudents,
    upcomingDueDates,
    topPerformers,
    recentNotices
  });
});

export const teacherDashboard = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user._id }).populate({
    path: "batches",
    populate: { path: "subjects", select: "name" }
  }).populate("subjects");
  
  const batchIds = teacher?.batches?.map((batch) => batch._id) || [];
  
  const studentCount = await Student.countDocuments({ batch: { $in: batchIds }, status: "active" });
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcomingTests = await Test.find({ 
    batch: { $in: batchIds }, 
    status: "scheduled"
  }).populate("subject batch").limit(5).sort("testDate");

  const recentlyCompletedTests = await Test.find({
    batch: { $in: batchIds },
    status: "completed"
  }).populate("subject batch").limit(5).sort("-completedAt");

  const recentNotices = await Notice.find({
    $and: [
      {
        $or: [
          { audience: "all" },
          { audience: "teachers" },
          { audience: "batch", batch: { $in: batchIds } },
          ...(teacher ? [{ audience: "teacher", teachers: teacher._id }] : [])
        ]
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ]
  }).populate("batch").limit(5).sort("-createdAt").populate("createdBy", "name role");

  const teacherStudents = await Student.find({ batch: { $in: batchIds } }).select("_id");
  const teacherStudentIds = teacherStudents.map(s => s._id);

  const lowScores = await Result.find({
    student: { $in: teacherStudentIds },
    percentage: { $lt: 50, $ne: null }
  })
  .populate({
    path: "student",
    select: "user studentId batch",
    populate: [
      { path: "user", select: "name" },
      { path: "batch", select: "name" }
    ]
  })
  .populate({
    path: "test",
    select: "title maxMarks subject",
    populate: { path: "subject", select: "name" }
  })
  const teacherId = teacher?._id;
  const teacherMaterials = await StudyMaterial.find({
    deletedAt: null,
    $or: [
      { uploadedBy: req.user._id },
      { uploaderRole: "admin", audienceType: "all" },
      { uploaderRole: "admin", audienceType: "teachers" },
      ...(batchIds.length > 0 ? [{ uploaderRole: "admin", audienceType: "batch", recipientBatchIds: { $in: batchIds } }] : []),
      ...(teacherId ? [{ uploaderRole: "admin", audienceType: "particular-teachers", recipientTeacherIds: teacherId }] : [])
    ]
  })
    .populate("subject", "name")
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    teacher,
    cards: {
      assignedBatches: batchIds.length,
      studentCount,
      upcomingTests: upcomingTests.length
    },
    upcomingTests,
    recentlyCompletedTests,
    recentNotices,
    lowScores,
    materials: teacherMaterials
  });
});

export const studentDashboard = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user._id }).populate({
    path: "batch",
    populate: {
      path: "teachers",
      populate: [
        { path: "user", select: "name email phone avatarUrl" },
        { path: "subjects", select: "name" }
      ]
    }
  });
  
  const fee = await Fee.findOne({ student: student?._id, status: { $in: ["pending", "partial", "overdue"] } }).sort({ dueDate: 1 });
  const recentResults = await Result.find({ student: student?._id }).populate({ path: "test", populate: { path: "subject", select: "name" } }).limit(5).sort({ createdAt: -1 });
  
  const recentTests = [];
  if (student && student.batch) {
    const completedTests = await Test.find({
      batch: student.batch._id,
      status: "completed"
    })
      .populate("subject", "name")
      .sort("-completedAt")
      .limit(5);

    for (const test of completedTests) {
      const resultDoc = await Result.findOne({ test: test._id, student: student._id });
      recentTests.push({
        _id: test._id,
        title: test.title,
        subject: test.subject?.name || "General",
        topic: test.topic || "",
        testDate: test.testDate,
        maxMarks: test.maxMarks,
        result: resultDoc ? {
          marksObtained: resultDoc.marksObtained,
          percentage: resultDoc.percentage,
          grade: resultDoc.grade,
          isAbsent: resultDoc.isAbsent,
        } : null
      });
    }
  }

  const studentNotices = student ? await Notice.find({
    $and: [
      {
        $or: [
          { audience: "all" },
          { audience: "students" },
          ...(student.batch ? [{ audience: "batch", batch: student.batch._id }] : []),
          { audience: "student", students: student._id }
        ]
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ]
  }).populate("batch").limit(5).sort("-createdAt") : [];

  const studentId = student?._id;
  const batchId = student?.batch?._id;
  const studentMaterials = student ? await StudyMaterial.find({
    deletedAt: null,
    $or: [
      { audienceType: "all" },
      { audienceType: "students" },
      ...(batchId ? [{ audienceType: "batch", recipientBatchIds: batchId }] : []),
      ...(studentId ? [{ audienceType: "particular-students", recipientStudentIds: studentId }] : [])
    ]
  })
    .populate("subject", "name")
    .sort({ createdAt: -1 })
    .limit(5) : [];

  const studentRemarks = student ? await Remark.find({ student: student._id })
    .populate({
      path: "teacher",
      populate: { path: "user", select: "name" }
    })
    .sort({ createdAt: -1 })
    .limit(5) : [];

  res.json({ student, monthly: null, batch: student?.batch, recentResults, materials: studentMaterials, notices: studentNotices, fee, recentTests, remarks: studentRemarks });
});
