const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const aiDir = '/Users/happygolucky/projects/mindmap-app/.ai';
const taskId = 'task-test-audit';

console.log('=== STARTING AUDIT LOOP STATE MACHINE TEST ===\n');

// Clean up helper
function cleanup() {
  console.log('Cleaning up previous test artifacts...');
  const dirsToClean = ['inbox', 'running', 'review', 'done', 'failed', 'state', 'reports', 'reviews', 'fix'];
  
  const cleanDirectory = (targetAiDir) => {
    if (!fs.existsSync(targetAiDir)) return;
    dirsToClean.forEach(dirName => {
      const dirPath = path.join(targetAiDir, dirName);
      if (!fs.existsSync(dirPath)) return;
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        if (item.includes(taskId)) {
          const fullPath = path.join(dirPath, item);
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
          } catch (e) {}
        }
      });
    });
  };

  cleanDirectory(aiDir);
  cleanDirectory('/Users/happygolucky/mindmap-repo/.ai');
  console.log('Cleanup finished.\n');
}

try {
  cleanup();

  // Make sure directories exist
  const dirs = ['inbox', 'running', 'review', 'reviews', 'done', 'failed', 'state', 'reports', 'fix'];
  dirs.forEach(d => {
    const p = path.join(aiDir, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // ==========================================
  // TEST A: Needs ChatGPT Audit
  // ==========================================
  console.log('--- Test A: Starting execution of task-test-audit ---');
  
  // 1. Write task to inbox
  const inboxFile = path.join(aiDir, 'inbox', `${taskId}.md`);
  fs.writeFileSync(inboxFile, 'target: mindmap-app\n\n# Test Task: Verify Audit Loop\nThis task verifies the PASS/FAIL state machine.\n', 'utf8');
  console.log('Created task file in inbox.');

  // 2. Move to running (watcher simulation)
  const runningFile = path.join(aiDir, 'running', `${taskId}.md`);
  fs.renameSync(inboxFile, runningFile);
  console.log('Simulated watcher moving task to running.');

  // 3. Execute collect-evidence.js (agy simulation)
  console.log('Executing evidence collection...');
  execSync(`node /Users/happygolucky/mindmap-repo/scripts/collect-evidence.js --taskId ${taskId} --target mindmap-app --attempt 1`, { cwd: '/Users/happygolucky/projects/mindmap-app', stdio: 'inherit' });

  // 4. Verify results of Test A
  const reviewFile = path.join(aiDir, 'review', `${taskId}.md`);
  const stateFile = path.join(aiDir, 'state', `${taskId}.json`);
  const evidenceFile = path.join(aiDir, 'reports', taskId, 'evidence.json');

  if (!fs.existsSync(reviewFile)) throw new Error('Test A failed: task file was not moved to review/');
  if (fs.existsSync(path.join(aiDir, 'done', `${taskId}.md`))) throw new Error('Test A failed: task was incorrectly moved to done/ without audit!');
  if (!fs.existsSync(stateFile)) throw new Error('Test A failed: state JSON file was not generated');
  
  const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (stateData.status !== 'needs_chatgpt_audit') throw new Error(`Test A failed: status is ${stateData.status}, expected needs_chatgpt_audit`);
  if (!fs.existsSync(evidenceFile)) throw new Error('Test A failed: evidence.json was not generated in reports/');

  console.log('✅ TEST A PASSED: Task moved to review, not done, and state is needs_chatgpt_audit.\n');

  // ==========================================
  // TEST B: ChatGPT Fail Path
  // ==========================================
  console.log('--- Test B: Simulating ChatGPT audit FAIL verdict ---');

  // 1. Simulate ChatGPT writing a FAIL verdict in reviews/
  const chatgptVerdictDir = path.join(aiDir, 'reviews', taskId);
  if (!fs.existsSync(chatgptVerdictDir)) {
    fs.mkdirSync(chatgptVerdictDir, { recursive: true });
  }
  
  const repoVerdictDir = path.join('/Users/happygolucky/mindmap-repo/.ai/reviews', taskId);
  if (fs.existsSync('/Users/happygolucky/mindmap-repo') && !fs.existsSync(repoVerdictDir)) {
    fs.mkdirSync(repoVerdictDir, { recursive: true });
  }

  const verdictContent = 'VERDICT: FAIL\nBlocking issue 1: Page loading is fine but UI lacks visual polish.\nBlocking issue 2: Check standard badges rendering.\n';
  fs.writeFileSync(path.join(chatgptVerdictDir, 'chatgpt-audit.md'), verdictContent, 'utf8');
  if (fs.existsSync(repoVerdictDir)) {
    fs.writeFileSync(path.join(repoVerdictDir, 'chatgpt-audit.md'), verdictContent, 'utf8');
  }
  console.log('Simulated ChatGPT writing a FAIL audit report.');

  // 2. Run index generator (loop simulation)
  console.log('Running index generator to process audit reviews...');
  execSync(`node scripts/generate-task-index.js`, { stdio: 'inherit' });

  // 3. Verify results of Test B
  const archiveFile = path.join(aiDir, 'fix', `${taskId}-attempt-1.md`);
  const fixTaskInboxFile = path.join(aiDir, 'inbox', `task-${taskId}-fix.md`);
  
  if (fs.existsSync(reviewFile)) throw new Error('Test B failed: task was not moved out of review/ after FAIL');
  if (!fs.existsSync(archiveFile)) throw new Error('Test B failed: previous attempt file not archived in fix/ folder');
  if (!fs.existsSync(fixTaskInboxFile)) throw new Error('Test B failed: new fix task was not created in inbox/');
  
  const stateDataB = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (stateDataB.status !== 'failed_review') throw new Error(`Test B failed: status is ${stateDataB.status}, expected failed_review`);
  if (stateDataB.attempt !== 2) throw new Error(`Test B failed: attempt is ${stateDataB.attempt}, expected 2`);
  if (stateDataB.chatgptVerdict !== 'FAIL') throw new Error('Test B failed: chatgptVerdict was not updated to FAIL');
  if (stateDataB.blockingErrors.length !== 2) throw new Error('Test B failed: failed to extract blocking errors from verdict');

  console.log('✅ TEST B PASSED: FAIL verdict successfully archived old attempt, updated state, and generated fix task in inbox.\n');

  // ==========================================
  // TEST C: ChatGPT Pass Path
  // ==========================================
  console.log('--- Test C: Simulating fix execution and ChatGPT PASS verdict ---');

  // 1. Move fix task to running (watcher simulation)
  const runningFixFile = path.join(aiDir, 'running', `task-${taskId}-fix.md`);
  fs.renameSync(fixTaskInboxFile, runningFixFile);
  console.log('Simulated watcher moving fix task to running.');

  // 2. Execute collect-evidence.js (agy simulation for attempt 2)
  console.log('Executing evidence collection for fix task...');
  execSync(`node /Users/happygolucky/mindmap-repo/scripts/collect-evidence.js --taskId ${taskId} --target mindmap-app --attempt 2`, { cwd: '/Users/happygolucky/projects/mindmap-app', stdio: 'inherit' });

  // 3. Verify task is back in review
  if (!fs.existsSync(reviewFile)) throw new Error('Test C failed: task file was not moved back to review/ after execution');

  // 4. Simulate ChatGPT writing a PASS verdict in reviews/
  const passVerdictContent = 'VERDICT: PASS\nAll issues resolved! Visual design looks highly premium.\n';
  fs.writeFileSync(path.join(chatgptVerdictDir, 'chatgpt-audit.md'), passVerdictContent, 'utf8');
  if (fs.existsSync(repoVerdictDir)) {
    fs.writeFileSync(path.join(repoVerdictDir, 'chatgpt-audit.md'), passVerdictContent, 'utf8');
  }
  console.log('Simulated ChatGPT writing a PASS audit report.');

  // 5. Run index generator to process PASS verdict
  console.log('Running index generator to process audit reviews...');
  execSync(`node scripts/generate-task-index.js`, { stdio: 'inherit' });

  // 6. Verify results of Test C
  const finalDoneFile = path.join(aiDir, 'done', `${taskId}.md`);
  if (!fs.existsSync(finalDoneFile)) throw new Error('Test C failed: task file was not moved to done/');
  if (fs.existsSync(reviewFile)) throw new Error('Test C failed: task file is still in review/ after PASS');

  const stateDataC = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (stateDataC.status !== 'done') throw new Error(`Test C failed: status is ${stateDataC.status}, expected done`);
  if (stateDataC.chatgptVerdict !== 'PASS') throw new Error('Test C failed: chatgptVerdict is not PASS');
  if (stateDataC.blockingErrors.length !== 0) throw new Error('Test C failed: blocking errors were not cleared');

  console.log('✅ TEST C PASSED: PASS verdict successfully moved task to done/ and updated status to done.');
  console.log('\n=== ALL AUDIT LOOP STATE MACHINE TESTS PASSED ===');

} catch (err) {
  console.error('\n❌ TEST RUN FAILED:', err.message);
  process.exit(1);
}
