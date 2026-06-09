export function formatFeeTenure(startDate, endDate) {
  if (!startDate || !endDate) return "";
  const formatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${formatter.format(startDate).toUpperCase()} - ${formatter.format(endDate).toUpperCase()}`;
}

export function getFeeTenureDates(record, student) {
  const dueDate = record.dueDate ? new Date(record.dueDate) : new Date(`${record.monthKey}-01T00:00:00`);
  const dueDay = Number(student?.feeDueDay || dueDate.getDate() || 1);
  
  const lastDayPrev = new Date(dueDate.getFullYear(), dueDate.getMonth(), 0).getDate();
  const startDate = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, Math.min(dueDay, lastDayPrev));
  
  const lastDayCurr = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
  const endDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), Math.min(dueDay, lastDayCurr));
  
  return { startDate, endDate };
}

export function getCompletedFeeTenures(allRecords, studentObj) {
  const sorted = [...allRecords].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const now = new Date();

  return sorted.filter((record) => {
    const student = record.student || studentObj || {};
    const dates = getFeeTenureDates(record, student);
    const tenureLabel = record.transactionType === "OPENING_BALANCE" 
        ? "Previous Outstanding Balance" 
        : formatFeeTenure(dates.startDate, dates.endDate);
    
    record.computedStartDate = dates.startDate;
    record.computedEndDate = dates.endDate;
    record.tenureLabel = tenureLabel;

    if (record.transactionType === "OPENING_BALANCE") {
      record.computedStatus = record.status;
      return true;
    }
    
    if (now < dates.startDate) {
      return false; // Hide future tenures completely
    }

    const diffDays = (dates.endDate - now) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 10) {
      record.computedStatus = record.status;
      return true; // Show only completed or nearly completed tenures
    }

    return false; // Hide active tenures that have more than 10 days remaining
  });
}

export function isOverdueFeeRecord(record, now = new Date()) {
  return record.status !== "Paid" && new Date(record.dueDate) < now;
}

export function getAllVisibleFeeRecords(feeRecords, students = []) {
  const studentMap = {};
  for (const stu of students) {
    studentMap[stu.id] = stu;
  }
  
  const grouped = {};
  for (const record of feeRecords) {
    if (!grouped[record.studentId]) grouped[record.studentId] = [];
    grouped[record.studentId].push(record);
  }
  
  const result = [];
  for (const studentId in grouped) {
    result.push(...getCompletedFeeTenures(grouped[studentId], studentMap[studentId]));
  }
  return result;
}
