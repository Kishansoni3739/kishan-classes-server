import { uid, monthKeyFromDate, createCycleBoundary, buildFeeRecord, getGrade, getPerformanceTag } from "./utils.js";

const defaultSubjects = ["Maths", "Science", "English", "Physics", "Chemistry", "Biology", "History", "Geography"];

export function defaultSettings() {
  const currentYear = new Date().getFullYear();
  return {
    coachingName: "KISHAN CLASSES",
    address: "Agra",
    phone: "+91 9389915375",
    logo: "",
    feeDueDay: 5,
    subjects: defaultSubjects,
    gradeBoundaries: { aPlus: 90, a: 80, b: 70, c: 55, d: 40 },
    academicYear: `${currentYear}-${currentYear + 1}`,
    templates: {
      feeReminder:
        "Dear [ParentName], this is a reminder that [StudentName]'s tuition fee of Rs [Amount] for [Month] is due on [DueDate]. Please pay at the earliest. - [CoachingName]",
      scoreReport:
        "Dear [ParentName], [StudentName] scored [Marks]/[MaxMarks] ([Grade]) in [Subject] - [TestName] held on [Date]. Teacher's Remark: [Remark] Keep encouraging your child! - [CoachingName]",
    },
  };
}

export function emptyState() {
  return {
    settings: defaultSettings(),
    batches: [],
    students: [],
    feeRecords: [],
    tests: [],
    scheduledTests: [],
    notificationLogs: [],
  };
}

export function demoState() {
  const currentYear = new Date().getFullYear();
  const settings = {
    ...defaultSettings(),
    coachingName: "KISHAN CLASSES",
  };

  const batches = [
    { id: uid(), name: "Morning Achievers", timing: "7:00 AM - 9:00 AM", days: ["Mon", "Wed", "Fri"], maxStudents: 20, teacher: "Ritika Sharma" },
    { id: uid(), name: "Evening Scholars", timing: "4:30 PM - 6:30 PM", days: ["Mon", "Tue", "Thu", "Fri"], maxStudents: 24, teacher: "Aman Verma" },
    { id: uid(), name: "Weekend Excellence", timing: "10:00 AM - 1:00 PM", days: ["Sat"], maxStudents: 18, teacher: "Neha Kapoor" },
    { id: uid(), name: "Foundation Focus", timing: "2:30 PM - 4:00 PM", days: ["Tue", "Thu", "Sat"], maxStudents: 22, teacher: "Piyush Mehta" },
  ];

  const students = [
    ["Aarav Sen", "Sourav Sen", "Madhumita Sen", "2010-05-11", "Male", "9876500011", "9876501011", "aarav@example.com", "Salt Lake, Kolkata", "Class 10", ["Maths", "Science", "English"], 0, 36000, 3000, 0, 5, "2026-01-08"],
    ["Diya Roy", "Anirban Roy", "Nandita Roy", "2011-01-19", "Female", "9876500012", "9876501012", "diya@example.com", "New Town, Kolkata", "Class 9", ["Maths", "English", "History"], 1, 30000, 2500, 1000, 5, "2026-02-05"],
    ["Kabir Das", "Sudip Das", "Poulomi Das", "2009-09-02", "Male", "9876500013", "9876501013", "kabir@example.com", "Howrah, Kolkata", "Class 11", ["Physics", "Chemistry", "Biology"], 1, 48000, 4000, 0, 10, "2026-01-10"],
    ["Meera Nair", "Rajeev Nair", "Anitha Nair", "2012-03-28", "Female", "9876500014", "9876501014", "meera@example.com", "Ballygunge, Kolkata", "Class 8", ["Science", "English", "Geography"], 2, 24000, 2000, 500, 7, "2026-03-07"],
    ["Rohan Iyer", "Sanjay Iyer", "Deepa Iyer", "2008-11-13", "Male", "9876500015", "9876501015", "rohan@example.com", "Behala, Kolkata", "Class 12", ["Physics", "Chemistry", "Maths"], 0, 54000, 4500, 1500, 18, "2026-02-18"],
    ["Sana Khan", "Farhan Khan", "Nazia Khan", "2010-07-22", "Female", "9876500016", "9876501016", "sana@example.com", "Park Circus, Kolkata", "Class 10", ["Biology", "Chemistry", "English"], 2, 36000, 3000, 0, 8, "2026-02-08"],
    ["Vranda Sharma", "Gaurav Sharma", "Preeti Sharma", "2011-09-14", "Female", "9876500017", "9876501017", "vranda@example.com", "Dum Dum, Kolkata", "Class 9", ["Maths", "Science", "English"], 3, 30000, 2500, 0, 21, "2026-04-21"],
    ["Arjun Patel", "Mahesh Patel", "Kavita Patel", "2009-12-01", "Male", "9876500018", "9876501018", "arjun@example.com", "Tollygunge, Kolkata", "Class 11", ["Physics", "Maths", "Chemistry"], 0, 42000, 3500, 500, 19, "2026-03-19"],
  ].map((s, i) => ({
    id: uid(),
    fullName: s[0], fatherName: s[1], motherName: s[2], dateOfBirth: s[3], gender: s[4],
    contactNumber: s[5], parentWhatsapp: s[6], email: s[7], address: s[8], photo: "",
    admissionDate: s[16], classGrade: s[9], subjects: s[10], batchId: batches[s[11]].id,
    studentId: `CC-${currentYear}-${String(i + 1).padStart(3, "0")}`,
    totalCourseFee: s[12], monthlyFeeAmount: s[13], discount: s[14], feeDueDay: s[15],
    status: "Active"
  }));

  const feeRecords = [];
  const tests = [];
  const scheduledTests = [];
  const notificationLogs = [];
  const now = new Date();
  const testNames = ["Unit Test 1", "Unit Test 2", "Practice Quiz", "Mock Exam", "Revision Test"];

  students.forEach((student, si) => {
    const admDate = new Date(student.admissionDate);
    const start = new Date(admDate.getFullYear(), admDate.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    for (const cur = new Date(start); cur <= end; cur.setMonth(cur.getMonth() + 1)) {
      const ci = (cur.getFullYear() - start.getFullYear()) * 12 + cur.getMonth() - start.getMonth();
      let status = "Pending", amountPaid = 0;
      if (cur < new Date(now.getFullYear(), now.getMonth(), 1)) {
        if ((si + ci) % 4 === 0) { status = "Pending"; amountPaid = 0; }
        else if ((si + ci) % 5 === 0) { status = "Partial"; amountPaid = Math.round(student.monthlyFeeAmount * 0.6); }
        else { status = "Paid"; amountPaid = student.monthlyFeeAmount; }
      } else if (cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth()) {
        if (student.feeDueDay <= now.getDate()) {
          status = (si + ci) % 3 === 0 ? "Pending" : "Partial";
          amountPaid = status === "Partial" ? Math.round(student.monthlyFeeAmount * 0.5) : 0;
        }
      }
      feeRecords.push(buildFeeRecord(student, new Date(cur), {
        amountPaid,
        paymentDate: status === "Paid" ? createCycleBoundary(cur.getFullYear(), cur.getMonth(), Math.max(1, student.feeDueDay - 1)).toISOString().slice(0, 10) : "",
        mode: status === "Paid" ? ((si + ci) % 2 === 0 ? "UPI" : "Cash") : "",
        remarks: status === "Partial" ? "Advance received partially" : status === "Paid" ? "On time" : "Awaiting payment",
        status,
      }));
    }

    student.subjects.forEach((subject, sj) => {
      for (let i = 0; i < 3; i++) {
        const marks = 52 + ((si * 7 + sj * 9 + i * 13) % 45);
        const percent = marks;
        tests.push({
          id: uid(), studentId: student.id, batchId: student.batchId, subject,
          testName: testNames[(si + sj + i) % testNames.length],
          testDate: new Date(currentYear, (sj + i) % 5, 4 + ((si + i) % 20)).toISOString().slice(0, 10),
          maxMarks: 100, marksObtained: marks, remarks: percent >= 75 ? "Solid performance" : "Needs more revision",
          grade: getGrade(percent, settings.gradeBoundaries), performanceTag: getPerformanceTag(percent),
        });
      }
    });

    notificationLogs.push(
      { id: uid(), studentId: student.id, date: now.toISOString(), type: "Welcome", message: `Admission confirmation shared with ${student.motherName}.`, status: "Sent" },
      { id: uid(), studentId: student.id, date: now.toISOString(), type: "Fee Reminder", message: `Reminder prepared for ${student.fullName} regarding monthly fee status.`, status: "Sent" },
    );
  });

  return { settings, batches, students, feeRecords, tests, scheduledTests, notificationLogs };
}
