const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const aiDir = '/Users/happygolucky/mindmap-repo/.ai';
console.log('=== STARTING CONTROL TOWER INTEGRATION TESTS ===\n');

// Clean up helper
function cleanup() {
  console.log('Cleaning up test files...');
  const testTaskIds = [
    'task-test-inbox-visibility',
    'task-test-review-gate',
    'task-test-pass-flow',
    'task-test-fail-flow',
    'task-test-invalid-done'
  ];

  testTaskIds.forEach(id => {
    // Delete files in inbox, running, review, fix, done, failed, state, reports, reviews
    const paths = [
      path.join(aiDir, 'inbox', `${id}.md`),
      path.join(aiDir, 'inbox', `task-${id}-fix.md`),
      path.join(aiDir, 'running', `${id}.md`),
      path.join(aiDir, 'review', `${id}.md`),
      path.join(aiDir, 'done', `${id}.md`),
      path.join(aiDir, 'failed', `${id}.md`),
      path.join(aiDir, 'state', `${id}.json`),
      path.join(aiDir, 'reports', id),
      path.join(aiDir, 'reviews', id),
      path.join(aiDir, 'fix', `${id}-attempt-1.md`)
    ];

    paths.forEach(p => {
      if (fs.existsSync(p)) {
        if (fs.statSync(p).isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          fs.unlinkSync(p);
        }
      }
    });
  });
  console.log('Cleanup complete.\n');
}

try {
  cleanup();

  // Run generate-task-index once to make sure we're in a clean state
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  // ==========================================
  // Test 1 — inbox visibility
  // ==========================================
  console.log('--- Test 1: Inbox Visibility ---');
  const task1Id = 'task-test-inbox-visibility';
  const inboxFile1 = path.join(aiDir, 'inbox', `${task1Id}.md`);
  fs.writeFileSync(inboxFile1, 'target: mindmap-app\n\n# Test 1 Title\n', 'utf8');

  // Generate task index
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  // Read task-index.json
  let taskIndex = JSON.parse(fs.readFileSync(path.join(aiDir, 'task-index.json'), 'utf8'));
  let task1 = taskIndex.find(t => t.taskId === task1Id);

  if (!task1) throw new Error('Test 1 failed: Task was not found in task-index.json');
  if (task1.location !== 'inbox') throw new Error(`Test 1 failed: Expected location 'inbox', got '${task1.location}'`);
  if (task1.status !== 'inbox_unseen') throw new Error(`Test 1 failed: Expected status 'inbox_unseen', got '${task1.status}'`);
  console.log('✅ Test 1 Passed: Inbox task is visible before processing.');

  // ==========================================
  // Test 2 — review gate
  // ==========================================
  console.log('\n--- Test 2: Review Gate ---');
  const task2Id = 'task-test-review-gate';
  const reviewFile2 = path.join(aiDir, 'review', `${task2Id}.md`);
  fs.writeFileSync(reviewFile2, 'target: mindmap-app\n\n# Test 2 Title\n', 'utf8');

  // Create state file
  const stateFile2 = path.join(aiDir, 'state', `${task2Id}.json`);
  fs.writeFileSync(stateFile2, JSON.stringify({
    taskId: task2Id,
    target: 'mindmap-app',
    status: 'needs_chatgpt_audit',
    attempt: 1,
    maxAttempts: 3
  }, null, 2), 'utf8');

  // Generate task index
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  taskIndex = JSON.parse(fs.readFileSync(path.join(aiDir, 'task-index.json'), 'utf8'));
  let task2 = taskIndex.find(t => t.taskId === task2Id);

  if (!task2) throw new Error('Test 2 failed: Task was not found in task-index.json');
  if (task2.location !== 'review') throw new Error(`Test 2 failed: Expected location 'review', got '${task2.location}'`);
  if (task2.status !== 'needs_chatgpt_audit') throw new Error(`Test 2 failed: Expected status 'needs_chatgpt_audit', got '${task2.status}'`);
  console.log('✅ Test 2 Passed: Review task stays in review with status needs_chatgpt_audit.');

  // ==========================================
  // Test 3 — PASS flow
  // ==========================================
  console.log('\n--- Test 3: PASS Flow ---');
  const task3Id = 'task-test-pass-flow';
  const reviewFile3 = path.join(aiDir, 'review', `${task3Id}.md`);
  fs.writeFileSync(reviewFile3, 'target: mindmap-app\n\n# Test 3 Title\n', 'utf8');

  const stateFile3 = path.join(aiDir, 'state', `${task3Id}.json`);
  fs.writeFileSync(stateFile3, JSON.stringify({
    taskId: task3Id,
    target: 'mindmap-app',
    status: 'needs_chatgpt_audit',
    attempt: 1,
    maxAttempts: 3,
    updatedAt: new Date(Date.now() - 5000).toISOString() // 5 seconds ago to ensure audit is not stale
  }, null, 2), 'utf8');

  // Write PASS audit verdict
  const reviewDir3 = path.join(aiDir, 'reviews', task3Id);
  fs.mkdirSync(reviewDir3, { recursive: true });
  fs.writeFileSync(path.join(reviewDir3, 'chatgpt-audit.md'), 'VERDICT: PASS\nLooks great!\n', 'utf8');

  // Generate task index
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  taskIndex = JSON.parse(fs.readFileSync(path.join(aiDir, 'task-index.json'), 'utf8'));
  let task3 = taskIndex.find(t => t.taskId === task3Id);

  if (!task3) throw new Error('Test 3 failed: Task was not found in task-index.json');
  if (task3.location !== 'done') throw new Error(`Test 3 failed: Expected location 'done', got '${task3.location}'`);
  if (task3.status !== 'done') throw new Error(`Test 3 failed: Expected status 'done', got '${task3.status}'`);
  if (task3.chatgptVerdict !== 'PASS') throw new Error(`Test 3 failed: Expected verdict 'PASS', got '${task3.chatgptVerdict}'`);
  if (fs.existsSync(reviewFile3)) throw new Error('Test 3 failed: Review file was not moved out of review/');
  if (!fs.existsSync(path.join(aiDir, 'done', `${task3Id}.md`))) throw new Error('Test 3 failed: Done file was not found in done/');
  console.log('✅ Test 3 Passed: PASS verdict successfully moves task to done and updates state.');

  // ==========================================
  // Test 4 — FAIL flow
  // ==========================================
  console.log('\n--- Test 4: FAIL Flow ---');
  const task4Id = 'task-test-fail-flow';
  const reviewFile4 = path.join(aiDir, 'review', `${task4Id}.md`);
  fs.writeFileSync(reviewFile4, 'target: mindmap-app\n\n# Test 4 Title\n', 'utf8');

  const stateFile4 = path.join(aiDir, 'state', `${task4Id}.json`);
  fs.writeFileSync(stateFile4, JSON.stringify({
    taskId: task4Id,
    target: 'mindmap-app',
    status: 'needs_chatgpt_audit',
    attempt: 1,
    maxAttempts: 3,
    updatedAt: new Date(Date.now() - 5000).toISOString()
  }, null, 2), 'utf8');

  // Write FAIL audit verdict
  const reviewDir4 = path.join(aiDir, 'reviews', task4Id);
  fs.mkdirSync(reviewDir4, { recursive: true });
  fs.writeFileSync(path.join(reviewDir4, 'chatgpt-audit.md'), 'VERDICT: FAIL\nBlocking issues:\n- Problem A\n- Problem B\n', 'utf8');

  // Generate task index
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  taskIndex = JSON.parse(fs.readFileSync(path.join(aiDir, 'task-index.json'), 'utf8'));
  let task4 = taskIndex.find(t => t.taskId === task4Id);

  if (!task4) throw new Error('Test 4 failed: Task was not found in task-index.json');
  if (task4.location !== 'inbox') throw new Error(`Test 4 failed: Expected location 'inbox', got '${task4.location}'`);
  if (task4.status !== 'inbox_unseen') throw new Error(`Test 4 failed: Expected status 'inbox_unseen', got '${task4.status}'`);
  if (task4.chatgptVerdict !== 'FAIL') throw new Error(`Test 4 failed: Expected verdict 'FAIL', got '${task4.chatgptVerdict}'`);

  const fixTaskFile = path.join(aiDir, 'inbox', `task-${task4Id}-fix.md`);
  if (!fs.existsSync(fixTaskFile)) throw new Error('Test 4 failed: Fix task file was not created in inbox/');

  const fixTaskContent = fs.readFileSync(fixTaskFile, 'utf8');
  if (!fixTaskContent.startsWith('target: mindmap-app')) throw new Error('Test 4 failed: Fix task file must start with target');
  if (!fixTaskContent.includes('Problem A') || !fixTaskContent.includes('Problem B')) {
    throw new Error('Test 4 failed: Fix task content must contain blocking issues');
  }

  // Load state JSON to verify status === 'failed_review'
  const state4 = JSON.parse(fs.readFileSync(stateFile4, 'utf8'));
  if (state4.status !== 'failed_review') throw new Error(`Test 4 failed: Expected state status 'failed_review', got '${state4.status}'`);
  console.log('✅ Test 4 Passed: FAIL verdict creates a fix task and moves original task state to failed_review.');

  // ==========================================
  // Test 5 — invalid done red flag
  // ==========================================
  console.log('\n--- Test 5: Invalid Done Red Flag ---');
  const task5Id = 'task-test-invalid-done';
  const doneFile5 = path.join(aiDir, 'done', `${task5Id}.md`);
  fs.writeFileSync(doneFile5, 'target: mindmap-app\n\n# Test 5 Title\n', 'utf8');

  // State has no PASS verdict
  const stateFile5 = path.join(aiDir, 'state', `${task5Id}.json`);
  fs.writeFileSync(stateFile5, JSON.stringify({
    taskId: task5Id,
    target: 'mindmap-app',
    status: 'done',
    chatgptVerdict: null
  }, null, 2), 'utf8');

  // Generate task index
  execSync('node scripts/generate-task-index.js', { stdio: 'ignore' });

  taskIndex = JSON.parse(fs.readFileSync(path.join(aiDir, 'task-index.json'), 'utf8'));
  let task5 = taskIndex.find(t => t.taskId === task5Id);

  if (!task5) throw new Error('Test 5 failed: Task was not found in task-index.json');
  if (!task5.invalidDone) throw new Error('Test 5 failed: Expected invalidDone to be true');
  if (!task5.blockingIssues.includes('Task is marked done but lacks ChatGPT PASS verdict')) {
    throw new Error('Test 5 failed: Expected specific warning in blockingIssues');
  }
  console.log('✅ Test 5 Passed: Lacking ChatGPT PASS on a done task triggers invalidDone and red flag warning.');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  cleanup();
  process.exit(0);
} catch (err) {
  console.error('\n❌ TEST RUN FAILED:', err.message);
  cleanup();
  process.exit(1);
}
