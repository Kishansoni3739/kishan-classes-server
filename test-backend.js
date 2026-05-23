const API_BASE = 'http://localhost:4000/api';

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Failed fetching ${url}: ${error.message}`);
  }
}

async function runTests() {
  console.log("Starting Backend Integration Tests...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    console.log("--- 1. Health Check ---");
    const health = await fetchJson('/health');
    assert(health.ok === true && health.db === 'connected', 'Server is healthy and DB is connected');

    // 2. Demo Reset
    console.log("\n--- 2. Demo Reset ---");
    const reset = await fetchJson('/reset-demo', { method: 'POST' });
    assert(reset.students && reset.students.length > 0, 'Demo reset populated students');
    assert(reset.notificationLogs && reset.notificationLogs.length > 0, 'Demo reset populated notifications');

    // 3. State Fetching
    console.log("\n--- 3. State Fetching ---");
    let state = await fetchJson('/state');
    assert(state.students.length === 8, 'Fetched exactly 8 students from DB');
    assert(state.batches.length === 4, 'Fetched exactly 4 batches from DB');

    // 4. State Syncing
    console.log("\n--- 4. State Syncing (PUT) ---");
    const newName = "Test Coaching Center 123";
    state.settings.coachingName = newName;
    const putRes = await fetchJson('/state', { method: 'PUT', body: JSON.stringify(state) });
    assert(putRes.ok === true, 'PUT /api/state succeeded');
    
    state = await fetchJson('/state');
    assert(state.settings.coachingName === newName, 'Coaching name successfully updated in DB');

    // 5. Single Notification Log Deletion
    console.log("\n--- 5. Notification Log Deletion ---");
    const logToDelete = state.notificationLogs[0];
    assert(logToDelete !== undefined, 'Found a notification log to delete');
    const delLogRes = await fetchJson(`/notification-logs/${logToDelete.id}`, { method: 'DELETE' });
    assert(delLogRes.ok === true, 'DELETE notification API succeeded');
    
    state = await fetchJson('/state');
    const logFound = state.notificationLogs.find(l => l.id === logToDelete.id);
    assert(logFound === undefined, 'Notification log completely removed from DB');

    // 6. Cascading Student Deletion
    console.log("\n--- 6. Cascading Student Deletion ---");
    const studentToDelete = state.students[0];
    const studentId = studentToDelete.id;
    
    // Count associated records before delete
    const preFeesCount = state.feeRecords.filter(r => r.studentId === studentId).length;
    const preTestsCount = state.tests.filter(t => t.studentId === studentId).length;
    const preLogsCount = state.notificationLogs.filter(l => l.studentId === studentId).length;
    
    assert(preFeesCount > 0 && preTestsCount > 0 && preLogsCount > 0, `Student has associated records to delete (Fees: ${preFeesCount}, Tests: ${preTestsCount}, Logs: ${preLogsCount})`);

    const delStudentRes = await fetchJson(`/students/${studentId}`, { method: 'DELETE' });
    assert(delStudentRes.ok === true, 'DELETE student API succeeded');

    state = await fetchJson('/state');
    
    const postStudent = state.students.find(s => s.id === studentId);
    const postFeesCount = state.feeRecords.filter(r => r.studentId === studentId).length;
    const postTestsCount = state.tests.filter(t => t.studentId === studentId).length;
    const postLogsCount = state.notificationLogs.filter(l => l.studentId === studentId).length;

    assert(postStudent === undefined, 'Student record completely removed from DB');
    assert(postFeesCount === 0, 'Cascading Delete: Associated fee records removed');
    assert(postTestsCount === 0, 'Cascading Delete: Associated test scores removed');
    assert(postLogsCount === 0, 'Cascading Delete: Associated notification logs removed');

    // 7. Final Cleanup
    console.log("\n--- 7. Cleanup ---");
    await fetchJson('/reset-demo', { method: 'POST' });
    console.log("✅ Database reset to clean demo state.");

  } catch (error) {
    console.error("\n❌ Test execution failed with error:", error);
  }

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
}

runTests();
