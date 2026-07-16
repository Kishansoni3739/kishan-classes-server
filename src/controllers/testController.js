import { Test } from "../models/Test.js";
import { Result } from "../models/Result.js";
import { Student } from "../models/Student.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper function to calculate grade based on percentage
const calculateGrade = (percentage) => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
};

export const scheduleTest = asyncHandler(async (req, res) => {
  const { title, topic, subject, batch, students, teacher, testDate, maxMarks, description } = req.body;

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    if (!batch || !assigned.includes(batch.toString())) {
      res.status(403);
      throw new Error("Teachers cannot create tests for unassigned batches.");
    }
  }

  // Validate date is not in the past (using server time, ignoring time of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(testDate);
  selectedDate.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    res.status(400);
    throw new Error("Test date cannot be in the past.");
  }

  if (maxMarks <= 0) {
    res.status(400);
    throw new Error("Maximum marks must be greater than 0.");
  }

  // Create the test
  const test = await Test.create({
    title,
    topic,
    subject,
    batch: batch || undefined,
    teacher,
    testDate,
    maxMarks,
    description,
    students,
    createdBy: req.user._id
  });

  // Create empty results (participants) for each student
  const participants = students.map((studentId) => ({
    test: test._id,
    student: studentId
  }));

  if (participants.length > 0) {
    await Result.insertMany(participants);
  }

  res.status(201).json(test);
});

export const listTests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, batch, teacher, search } = req.query;
  const query = {};

  if (status) query.status = status;

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    if (batch) {
      if (!assigned.includes(batch.toString())) {
        query.batch = { $in: [] };
      } else {
        query.batch = batch;
      }
    } else {
      query.batch = { $in: assigned };
    }
  } else if (batch) {
    query.batch = batch;
  }
  if (teacher) query.teacher = teacher;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { topic: { $regex: search, $options: "i" } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Test.find(query)
      .populate("subject", "name")
      .populate("batch", "name")
      .populate({ path: "teacher", populate: { path: "user", select: "name" } })
      .sort({ testDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Test.countDocuments(query)
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
});

export const updateTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) {
    res.status(404);
    throw new Error("Test not found");
  }

  if (req.user && req.user.role === "teacher") {
    if (test.createdBy?.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Teachers can only edit upcoming tests created by themselves.");
    }
    const { batch } = req.body;
    const assigned = req.user.assignedBatches || [];
    if (batch && !assigned.includes(batch.toString())) {
      res.status(403);
      throw new Error("Teachers cannot assign tests to unassigned batches.");
    }
  }

  if (test.status !== "scheduled") {
    res.status(400);
    throw new Error("Only scheduled tests can be edited.");
  }

  const { title, topic, subject, batch, students, teacher, testDate, maxMarks, description } = req.body;

  // Verify date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(testDate);
  selectedDate.setHours(0, 0, 0, 0);
  
  if (selectedDate < today && new Date(test.testDate).getTime() !== new Date(testDate).getTime()) {
    res.status(400);
    throw new Error("Test date cannot be changed to the past.");
  }

  test.title = title;
  test.topic = topic;
  test.subject = subject;
  test.batch = batch || undefined;
  test.teacher = teacher;
  test.testDate = testDate;
  test.maxMarks = maxMarks;
  test.description = description;
  test.updatedBy = req.user._id;

  // Handle participant changes
  const oldStudents = test.students.map(s => s.toString());
  const newStudents = students.map(s => s.toString());
  
  const toAdd = newStudents.filter(s => !oldStudents.includes(s));
  const toRemove = oldStudents.filter(s => !newStudents.includes(s));

  if (toAdd.length > 0) {
    const addParticipants = toAdd.map(studentId => ({ test: test._id, student: studentId }));
    await Result.insertMany(addParticipants);
  }
  if (toRemove.length > 0) {
    await Result.deleteMany({ test: test._id, student: { $in: toRemove } });
  }

  test.students = students;
  await test.save();

  res.json(test);
});

export const cancelTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) {
    res.status(404);
    throw new Error("Test not found");
  }

  if (req.user && req.user.role === "teacher") {
    if (test.createdBy?.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Teachers can only cancel upcoming tests created by themselves.");
    }
  }

  if (test.status === "completed") {
    res.status(400);
    throw new Error("Cannot cancel a completed test.");
  }

  if (test.status === "cancelled") {
    res.status(400);
    throw new Error("Test is already cancelled.");
  }

  test.status = "cancelled";
  test.cancelledBy = req.user._id;
  test.cancelledAt = new Date();
  await Test.updateOne({ _id: test._id }, {
    $set: {
      status: test.status,
      cancelledBy: test.cancelledBy,
      cancelledAt: test.cancelledAt
    }
  });

  res.json({ message: "Test cancelled successfully.", test });
});

export const getTestParticipants = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) {
    res.status(404);
    throw new Error("Test not found");
  }

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = test.batch?.toString();
    if (batchId && !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("You do not have permission to access test details for this batch.");
    }
  }

  // Self-heal: ensure all students in test.students have a Result document
  const existingResults = await Result.find({ test: test._id });
  const existingStudentIds = existingResults.map(r => r.student.toString());
  
  const missingStudents = test.students.filter(s => !existingStudentIds.includes(s.toString()));
  
  if (missingStudents.length > 0) {
    const toInsert = missingStudents.map(studentId => ({
      test: test._id,
      student: studentId
    }));
    await Result.insertMany(toInsert);
  }

  const results = await Result.find({ test: req.params.id })
    .populate({
      path: "student",
      select: "user studentId batch",
      populate: [
        { path: "user", select: "name" },
        { path: "batch", select: "name" }
      ]
    })
    // Sort by student name
    .lean();
    
  // Sort manually by populated name
  results.sort((a, b) => {
    const nameA = a.student?.user?.name?.toLowerCase() || '';
    const nameB = b.student?.user?.name?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });

  res.json(results);
});

export const completeTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) {
    res.status(404);
    throw new Error("Test not found");
  }

  if (req.user && req.user.role === "teacher") {
    const assigned = req.user.assignedBatches || [];
    const batchId = test.batch?.toString();
    if (batchId && !assigned.includes(batchId)) {
      res.status(403);
      throw new Error("Teachers can only grade tests in their assigned batches.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const testDate = new Date(test.testDate);
    testDate.setHours(0, 0, 0, 0);
    if (testDate > today) {
      res.status(400);
      throw new Error("Cannot complete a test before its scheduled date.");
    }
  }

  if (test.status === "cancelled") {
    res.status(400);
    throw new Error("Cannot complete a cancelled test.");
  }
  if (test.status === "completed") {
    res.status(400);
    throw new Error("Test is already completed.");
  }

  const { marks } = req.body; // Array of { studentId, marksObtained, isAbsent }

  if (!Array.isArray(marks)) {
    res.status(400);
    throw new Error("Invalid marks data format.");
  }

  // Process all marks
  const updatePromises = marks.map(async (entry) => {
    let percentage = null;
    let grade = null;
    let finalMarks = entry.isAbsent ? null : Number(entry.marksObtained);

    if (!entry.isAbsent) {
      if (finalMarks === null || finalMarks < 0 || finalMarks > test.maxMarks) {
        throw new Error(`Invalid marks for student. Must be between 0 and ${test.maxMarks}.`);
      }
      percentage = (finalMarks / test.maxMarks) * 100;
      grade = calculateGrade(percentage);
    }

    return Result.findOneAndUpdate(
      { test: test._id, student: entry.studentId },
      {
        marksObtained: finalMarks,
        isAbsent: entry.isAbsent,
        percentage,
        grade,
        enteredBy: req.user._id
      },
      { upsert: true, new: true }
    );
  });

  await Promise.all(updatePromises);

  test.status = "completed";
  test.completedBy = req.user._id;
  test.completedAt = new Date();
  await Test.updateOne({ _id: test._id }, {
    $set: {
      status: test.status,
      completedBy: test.completedBy,
      completedAt: test.completedAt
    }
  });

  res.json({ message: "Test completed successfully.", test });
});
