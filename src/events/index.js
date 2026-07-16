import { EventEmitter } from "events";

class AppEventEmitter extends EventEmitter {}

export const appEvents = new AppEventEmitter();

// Define Event Names
export const EVENTS = {
  STUDENT_ADMITTED: "student.admitted",
  FEE_COLLECTED: "fee.collected",
  TEST_SCHEDULED: "test.scheduled",
  RESULT_PUBLISHED: "result.published"
};
