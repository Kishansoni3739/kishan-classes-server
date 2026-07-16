export const defaultTemplates = [
  {
    name: "Admission",
    category: "Student",
    isDefault: true,
    messageBody: `Dear {{guardian_name}},

Welcome to {{coaching_name}}.

Student:
{{student_name}}

Course:
{{course}}

Batch:
{{batch}}

Admission Date:
{{admission_date}}

Student ID:
{{student_id}}

Thank you.`,
    variables: ["guardian_name", "coaching_name", "student_name", "course", "batch", "admission_date", "student_id"]
  },
  {
    name: "Fee Due Reminder",
    category: "Fees",
    isDefault: true,
    messageBody: `Dear {{guardian_name}},

This is a reminder that the following fees are pending for {{student_name}}:

{{due_details}}

Total Outstanding: ₹{{due_amount}}
Please pay before {{next_due_date}}.

Thank you.`,
    variables: ["guardian_name", "student_name", "due_details", "due_amount", "next_due_date"]
  },
  {
    name: "Fee Received",
    category: "Fees",
    isDefault: true,
    messageBody: `Dear {{guardian_name}}

Received ₹{{paid_amount}}

Student:
{{student_name}}

Payment Date:
{{payment_date}}

Remaining Due:
₹{{total_due}}

Thank you.`,
    variables: ["guardian_name", "paid_amount", "student_name", "payment_date", "total_due"]
  },
  {
    name: "Test Scheduled",
    category: "Test",
    isDefault: true,
    messageBody: `Dear {{guardian_name}}

A test has been scheduled.

Student:
{{student_name}}

Subject:
{{subject}}

Topic:
{{topic}}

Date:
{{test_date}}

Time:
{{test_time}}

Maximum Marks:
{{max_marks}}

Regards`,
    variables: ["guardian_name", "student_name", "subject", "topic", "test_date", "test_time", "max_marks"]
  },
  {
    name: "Test Reminder",
    category: "Test",
    isDefault: true,
    messageBody: `Dear {{guardian_name}}

This is a reminder for the upcoming test.

Student:
{{student_name}}

Subject:
{{subject}}

Date:
{{test_date}}

Time:
{{test_time}}

Regards`,
    variables: ["guardian_name", "student_name", "subject", "test_date", "test_time"]
  },
  {
    name: "Marks Published",
    category: "Marks",
    isDefault: true,
    messageBody: `Dear {{guardian_name}},

The results for the recently conducted test have been published.

Student: {{student_name}}
Test: {{test_name}}
Subject: {{subject}}
Topic: {{topic}}
Date: {{test_date}}

--------------------------------
Performance Details:
--------------------------------
Marks Obtained: {{marks}} / {{max_marks}}
Percentage: {{percentage}}
Grade: {{grade}}

Regards,
Kishan Classes`,
    variables: ["guardian_name", "student_name", "test_name", "subject", "topic", "test_date", "marks", "max_marks", "percentage", "grade"]
  },
  {
    name: "Progress Report",
    category: "Progress",
    isDefault: true,
    messageBody: `Dear {{guardian_name}},

Here is the academic progress report for {{student_name}} (Batch: {{batch}}):

Overall Performance Score: {{overall_average}}%

Subject Performance:
{{subject_performance}}

Feedback Comments:
{{feedback_comments}}

Regards,
Kishan Classes`,
    variables: ["guardian_name", "student_name", "batch", "overall_average", "subject_performance", "feedback_comments"]
  },
  {
    name: "General Notice",
    category: "Notices",
    isDefault: true,
    messageBody: `Dear Parent,

{{notice_message}}

Regards`,
    variables: ["notice_message"]
  },
  {
    name: "Batch Changed",
    category: "Student",
    isDefault: true,
    messageBody: `Dear {{guardian_name}}

The batch for {{student_name}} has been changed to {{batch}}.

Regards`,
    variables: ["guardian_name", "student_name", "batch"]
  },
  {
    name: "Student Left",
    category: "Student",
    isDefault: true,
    messageBody: `Dear {{guardian_name}}

{{student_name}} is no longer enrolled at {{coaching_name}}.

Regards`,
    variables: ["guardian_name", "student_name", "coaching_name"]
  },
  {
    name: "Birthday Wish",
    category: "Student",
    isDefault: true,
    messageBody: `Dear {{student_name}}

Wishing you a very Happy Birthday!

Regards,
{{coaching_name}}`,
    variables: ["student_name", "coaching_name"]
  },
  {
    name: "Material Shared",
    category: "Material",
    isDefault: true,
    messageBody: `Dear {{recipient_name}},

New study material has been shared with you:

Title: {{title}}
Subject: {{subject}}
Shared By: {{uploader}}

You can access and download it from the student portal.

Regards,
Kishan Classes`,
    variables: ["recipient_name", "title", "subject", "uploader"]
  }
];
