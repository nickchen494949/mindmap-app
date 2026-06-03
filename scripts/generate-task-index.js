const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine the AI directory to scan
let aiDir = '/Users/happygolucky/mindmap-repo/.ai';
if (!fs.existsSync(aiDir)) {
  aiDir = '/Users/happygolucky/projects/mindmap-app/.ai';
}
if (!fs.existsSync(aiDir)) {
  aiDir = path.join(process.cwd(), '.ai');
}

console.log(`Scanning AI directory: ${aiDir}`);

const inboxDir = path.join(aiDir, 'inbox');
const doneDir = path.join(aiDir, 'done');
const failedDir = path.join(aiDir, 'failed');
const reportsDir = path.join(aiDir, 'reports');
const runningDir = path.join(aiDir, 'running');
const logsDir = path.join(aiDir, 'logs');
const stateDir = path.join(aiDir, 'state');
const reviewDir = path.join(aiDir, 'review');
const reviewsDir = path.join(aiDir, 'reviews');
const fixDir = path.join(aiDir, 'fix');

// Helper to ensure directories exist
const safeMkdir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Ensure all dirs exist
const subDirs = ['inbox', 'done', 'failed', 'reports', 'running', 'logs', 'state', 'heartbeat', 'review', 'reviews', 'fix'];
subDirs.forEach(sd => {
  safeMkdir(path.join(aiDir, sd));
});

const safeReaddir = (dir) => {
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir);
  }
  return [];
};

function runCmd(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

// Robust audit file parser
function parseAuditFile(filePath) {
  if (!fs.existsSync(filePath)) return { verdict: null, issues: [] };
  const content = fs.readFileSync(filePath, 'utf8');
  let verdict = null;
  if (content.includes('VERDICT: PASS')) {
    verdict = 'PASS';
  } else if (content.includes('VERDICT: FAIL')) {
    verdict = 'FAIL';
  }

  const issues = [];
  if (verdict === 'FAIL') {
    const lines = content.split('\n');
    let collect = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('VERDICT: FAIL')) {
        collect = true;
        continue;
      }
      if (trimmed.toLowerCase().includes('blocking issues:')) {
        collect = true;
        continue;
      }
      if (collect && trimmed) {
        if (trimmed.toLowerCase().startsWith('verdict:') || trimmed.toLowerCase().startsWith('blocking issues:')) {
          continue;
        }
        let issue = trimmed.replace(/^[-*+]\s*/, '').replace(/^\d+[\s:.)]+\s*/, '').trim();
        if (issue) {
          issues.push(issue);
        }
      }
    }
  }
  return { verdict, issues };
}

function getBaseTaskId(filename) {
  let base = filename.replace(/\.md$/, '').replace(/\.json$/, '');
  base = base.replace(/-fix$/, '');
  base = base.replace(/-attempt-\d+$/, '');
  if (base.startsWith('task-task-')) {
    base = base.substring(5);
  }
  return base;
}

function findStateFile(taskId) {
  const cleanPath = path.join(stateDir, `${taskId}.json`);
  if (fs.existsSync(cleanPath)) return cleanPath;
  
  const files = safeReaddir(stateDir).filter(f => f.startsWith('task-') && f.endsWith('.json'));
  for (const file of files) {
    const fileTaskId = getBaseTaskId(file.replace('.json', ''));
    if (fileTaskId === taskId) {
      return path.join(stateDir, file);
    }
  }
  return cleanPath;
}

// 2. Process ChatGPT Reviews first
function checkReviews() {
  console.log('=== Checking for ChatGPT reviews/audits in state machine ===');
  const reviewFiles = safeReaddir(reviewDir).filter(f => f.endsWith('.md'));
  
  reviewFiles.forEach(file => {
    const taskId = getBaseTaskId(file);
    const stateFile = findStateFile(taskId);
    
    let state = null;
    if (fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } catch (e) {
        console.error(`Failed to parse state for ${taskId}:`, e.message);
      }
    }
    
    // Check both .ai/reviews/<task-id>/chatgpt-audit.md and .ai/review/<task-id>/chatgpt-audit.md
    let chatgptAuditPath = path.join(reviewsDir, taskId, 'chatgpt-audit.md');
    if (!fs.existsSync(chatgptAuditPath)) {
      chatgptAuditPath = path.join(reviewDir, taskId, 'chatgpt-audit.md');
    }

    if (fs.existsSync(chatgptAuditPath)) {
      if (state && state.updatedAt) {
        const auditStats = fs.statSync(chatgptAuditPath);
        const auditMtime = auditStats.mtime.getTime();
        const stateTime = new Date(state.updatedAt).getTime();
        if (auditMtime < stateTime - 2000) {
          console.log(`Audit file is stale for ${taskId} (modified: ${auditStats.mtime.toISOString()}, task updated: ${state.updatedAt}). Skipping review processing.`);
          return;
        }
      }
      console.log(`Found review verdict file for ${taskId}: ${chatgptAuditPath}`);
      
      const parsed = parseAuditFile(chatgptAuditPath);
      const hasPass = parsed.verdict === 'PASS';
      const hasFail = parsed.verdict === 'FAIL';

      if (!state) {
        state = {
          taskId,
          target: 'mindmap-app',
          status: 'needs_chatgpt_audit',
          attempt: 1,
          maxAttempts: 3,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastCommit: 'local',
          liveUrl: 'https://nickchen494949.github.io/mindmap-app/',
          evidencePacketPath: `.ai/reports/${taskId}/`,
          chatgptAuditPath: null,
          chatgptVerdict: null,
          blockingErrors: []
        };
      }

      const target = state.target || 'mindmap-app';
      const workDir = target ? path.join('/Users/happygolucky/projects', target) : '/Users/happygolucky/mindmap-repo';

      if (hasPass) {
        console.log(`Verdict for ${taskId}: PASS`);
        // Move task file from review to done
        fs.renameSync(
          path.join(reviewDir, file),
          path.join(doneDir, file)
        );

        // Update state
        state.status = 'done';
        state.chatgptVerdict = 'PASS';
        state.chatgptAuditPath = chatgptAuditPath.replace(aiDir + '/', '.ai/');
        state.updatedAt = new Date().toISOString();
        state.blockingErrors = [];
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

        // Sync to target project if applicable
        if (target && workDir !== '/Users/happygolucky/mindmap-repo' && fs.existsSync(workDir)) {
          try {
            safeMkdir(path.join(workDir, '.ai', 'done'));
            safeMkdir(path.join(workDir, '.ai', 'state'));
            if (fs.existsSync(path.join(workDir, '.ai', 'review', file))) {
              fs.renameSync(
                path.join(workDir, '.ai', 'review', file),
                path.join(workDir, '.ai', 'done', file)
              );
            }
            fs.copyFileSync(stateFile, path.join(workDir, '.ai', 'state', `${taskId}.json`));
          } catch (e) {
            console.error(`Syncing PASS to ${target} failed:`, e.message);
          }
        }
      } else if (hasFail) {
        console.log(`Verdict for ${taskId}: FAIL`);
        
        const blockingErrors = parsed.issues;

        state.chatgptVerdict = 'FAIL';
        state.chatgptAuditPath = chatgptAuditPath.replace(aiDir + '/', '.ai/');
        state.blockingErrors = blockingErrors;
        state.attempt += 1;
        state.updatedAt = new Date().toISOString();

        if (state.attempt > state.maxAttempts) {
          console.log(`Task ${taskId} exceeded max attempts (${state.maxAttempts}). Marking as FAILED.`);
          state.status = 'failed';
          
          // Move task file from review to failed
          fs.renameSync(
            path.join(reviewDir, file),
            path.join(failedDir, file)
          );

          fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

          if (target && workDir !== '/Users/happygolucky/mindmap-repo' && fs.existsSync(workDir)) {
            try {
              safeMkdir(path.join(workDir, '.ai', 'failed'));
              if (fs.existsSync(path.join(workDir, '.ai', 'review', file))) {
                fs.renameSync(
                  path.join(workDir, '.ai', 'review', file),
                  path.join(workDir, '.ai', 'failed', file)
                );
              }
              fs.copyFileSync(stateFile, path.join(workDir, '.ai', 'state', `${taskId}.json`));
            } catch (e) {}
          }
        } else {
          console.log(`Task ${taskId} failed. Retrying (Attempt ${state.attempt}).`);
          // Set status to failed_review as required
          state.status = 'failed_review';

          // Move task file from review to fix (acting as archive/history of previous attempt)
          const archiveName = `${taskId}-attempt-${state.attempt - 1}.md`;
          fs.renameSync(
            path.join(reviewDir, file),
            path.join(fixDir, archiveName)
          );

          // Create a new fix task file in inbox
          const fixTaskName = `task-${taskId}-fix.md`;
          const fixTaskPath = path.join(inboxDir, fixTaskName);
          
          let fixTaskContent = `target: ${target}\n\n`;
          fixTaskContent += `# Fix Task for ${taskId} (Attempt ${state.attempt})\n\n`;
          fixTaskContent += `The previous execution of this task was audited by ChatGPT and returned a **FAIL** verdict.\n\n`;
          fixTaskContent += `### ChatGPT Blocking Issues:\n`;
          if (blockingErrors.length > 0) {
            blockingErrors.forEach(err => {
              fixTaskContent += `- ${err}\n`;
            });
          } else {
            fixTaskContent += `- Please check \`.ai/reviews/\${taskId}/chatgpt-audit.md\` for details.\n`;
          }
          fixTaskContent += `\n### Task ID mapping:\n`;
          fixTaskContent += `Please reuse the same state file: ${taskId}.json\n`;
          
          fs.writeFileSync(fixTaskPath, fixTaskContent, 'utf8');
          console.log(`Created fix task in inbox: ${fixTaskPath}`);

          fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

          if (target && workDir !== '/Users/happygolucky/mindmap-repo' && fs.existsSync(workDir)) {
            try {
              safeMkdir(path.join(workDir, '.ai', 'fix'));
              safeMkdir(path.join(workDir, '.ai', 'inbox'));
              if (fs.existsSync(path.join(workDir, '.ai', 'review', file))) {
                fs.renameSync(
                  path.join(workDir, '.ai', 'review', file),
                  path.join(workDir, '.ai', 'fix', archiveName)
                );
              }
              fs.writeFileSync(path.join(workDir, '.ai', 'inbox', fixTaskName), fixTaskContent, 'utf8');
              fs.copyFileSync(stateFile, path.join(workDir, '.ai', 'state', `${taskId}.json`));
            } catch (e) {
              console.error(`Syncing FAIL to ${target} failed:`, e);
            }
          }
        }
      }
    }
  });
}

// Execute checkReviews
checkReviews();

// 3. Scan files to find all task files and build task index map
const tasksMap = {};

const locationPriority = {
  'running': 1,
  'review': 2,
  'inbox': 3,
  'failed': 4,
  'done': 5,
  'fix': 6
};

// Scan a directory to register task files and locations
function scanDir(dirName) {
  const dirPath = path.join(aiDir, dirName);
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    if (file.startsWith('task-') && file.endsWith('.md')) {
      const taskId = getBaseTaskId(file);
      if (!tasksMap[taskId]) {
        tasksMap[taskId] = {
          taskId,
          locations: [],
          mtimes: []
        };
      }
      tasksMap[taskId].locations.push(dirName);
      
      try {
        const stats = fs.statSync(path.join(dirPath, file));
        tasksMap[taskId].mtimes.push(stats.mtime.toISOString());
      } catch (e) {}
    }
  });
}

const locations = ['inbox', 'running', 'review', 'fix', 'done', 'failed'];
locations.forEach(loc => scanDir(loc));

// Also check state directory for task JSONs that might not have active task files
const stateFiles = safeReaddir(stateDir).filter(f => f.startsWith('task-') && f.endsWith('.json'));
stateFiles.forEach(file => {
  const taskId = getBaseTaskId(file.replace('.json', ''));
  if (!tasksMap[taskId]) {
    tasksMap[taskId] = {
      taskId,
      locations: [],
      mtimes: []
    };
  }
});

// Build the array of formatted task entries
const tasksList = [];
const runningProcesses = runCmd('ps aux', process.cwd());

Object.keys(tasksMap).forEach(taskId => {
  const tInfo = tasksMap[taskId];
  
  // Determine location based on highest priority
  let location = 'unknown';
  if (tInfo.locations.length > 0) {
    tInfo.locations.sort((a, b) => {
      return (locationPriority[a] || 99) - (locationPriority[b] || 99);
    });
    location = tInfo.locations[0];
  }
  
  // Load state JSON if it exists
  const stateFile = findStateFile(taskId);
  let stateData = null;
  if (fs.existsSync(stateFile)) {
    try {
      stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch (e) {}
  }
  
  // Parse target from active task file or state file
  let target = stateData ? stateData.target : null;
  let title = taskId.replace('task-', '').replace(/-/g, ' ');
  let createdAt = tInfo.mtimes.length > 0 ? tInfo.mtimes.sort()[0] : (stateData ? stateData.startedAt : new Date().toISOString());

  // Try to find the file and extract target and title
  const fileSearchOrder = [
    path.join(runningDir, `${taskId}.md`),
    path.join(runningDir, `${taskId}-fix.md`),
    path.join(runningDir, `task-${taskId}.md`),
    path.join(runningDir, `task-${taskId}-fix.md`),
    path.join(reviewDir, `${taskId}.md`),
    path.join(reviewDir, `task-${taskId}.md`),
    path.join(inboxDir, `${taskId}.md`),
    path.join(inboxDir, `${taskId}-fix.md`),
    path.join(inboxDir, `task-${taskId}.md`),
    path.join(inboxDir, `task-${taskId}-fix.md`),
    path.join(doneDir, `${taskId}.md`),
    path.join(doneDir, `task-${taskId}.md`),
    path.join(failedDir, `${taskId}.md`),
    path.join(failedDir, `task-${taskId}.md`),
    path.join(fixDir, `${taskId}-attempt-1.md`),
    path.join(fixDir, `${taskId}-attempt-2.md`),
    path.join(fixDir, `task-${taskId}-attempt-1.md`),
    path.join(fixDir, `task-${taskId}-attempt-2.md`)
  ];

  for (const filePath of fileSearchOrder) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const targetMatch = content.match(/^target:\s*(.*)/mi);
        if (targetMatch && !target) {
          target = targetMatch[1].trim();
        }
        const titleMatch = content.match(/^#\s*(.*)/m);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        break;
      } catch (e) {}
    }
  }

  if (!target) target = 'mindmap-app';

  // Check evidence
  let hasEvidence = fs.existsSync(path.join(reportsDir, taskId, 'evidence.json'));
  const taskAttempt = stateData ? stateData.attempt : 1;

  if (location === 'review' && !hasEvidence && !process.env.IN_EVIDENCE_COLLECTION) {
    console.log(`Task ${taskId} is in review but missing evidence packet. Generating...`);
    try {
      const collectorPath = path.join(__dirname, 'collect-evidence.js');
      if (fs.existsSync(collectorPath)) {
        // Run collect-evidence synchronously, setting a flag to prevent infinite recursion
        execSync(`node "${collectorPath}" --taskId "${taskId}" --target "${target || 'mindmap-app'}" --attempt ${taskAttempt}`, { 
          stdio: 'inherit',
          env: { ...process.env, IN_ELECTION: 'true', IN_EVIDENCE_COLLECTION: 'true' }
        });
        hasEvidence = fs.existsSync(path.join(reportsDir, taskId, 'evidence.json'));
      }
    } catch (e) {
      console.error(`Failed to automatically generate evidence for ${taskId}:`, e.message);
    }
  }
  const evidencePath = hasEvidence ? `.ai/reports/${taskId}/evidence.json` : null;

  // Check ChatGPT audit file
  let chatgptAuditPath = path.join(reviewsDir, taskId, 'chatgpt-audit.md');
  if (!fs.existsSync(chatgptAuditPath)) {
    chatgptAuditPath = path.join(reviewDir, taskId, 'chatgpt-audit.md');
  }
  const hasAuditFile = fs.existsSync(chatgptAuditPath);
  const parsedAudit = hasAuditFile ? parseAuditFile(chatgptAuditPath) : { verdict: null, issues: [] };

  // Set chatgptVerdict and blockingIssues
  let chatgptVerdict = parsedAudit.verdict;
  if (!chatgptVerdict && stateData) {
    chatgptVerdict = stateData.chatgptVerdict || null;
  }
  
  let blockingIssues = [...parsedAudit.issues];
  if (blockingIssues.length === 0 && stateData && stateData.blockingErrors) {
    blockingIssues = [...stateData.blockingErrors];
  }

  // Load lastCommit and liveUrl
  const lastCommit = stateData ? (stateData.lastCommit || null) : null;
  const liveUrl = stateData ? (stateData.liveUrl || `https://nickchen494949.github.io/${target}/`) : `https://nickchen494949.github.io/${target}/`;

  // Determine status
  let status = 'unknown';
  if (location === 'done') {
    status = 'done';
    // Test 5: Red flag if done but no ChatGPT PASS
    if (chatgptVerdict !== 'PASS') {
      if (!blockingIssues.includes('Task is marked done but lacks ChatGPT PASS verdict')) {
        blockingIssues.push('Task is marked done but lacks ChatGPT PASS verdict');
      }
    }
  } else if (location === 'running') {
    status = 'running';
  } else if (location === 'review') {
    status = 'needs_chatgpt_audit';
  } else if (location === 'failed') {
    if (stateData && stateData.status === 'blocked') {
      status = 'blocked';
    } else {
      status = 'failed';
    }
  } else if (location === 'inbox') {
    if (stateData && stateData.status === 'blocked') {
      status = 'blocked';
    } else if (stateData && stateData.status === 'running') {
      status = 'running';
    } else {
      status = 'inbox_unseen';
    }
  } else if (location === 'fix') {
    status = 'failed';
  }

  // Read blocked errors if any
  if (stateData && stateData.status === 'blocked' && stateData.errors) {
    if (!blockingIssues.includes(stateData.errors)) {
      blockingIssues.push(stateData.errors);
    }
  }

  // Support for attempt counts in entry for UI
  const attempt = stateData ? stateData.attempt : 1;
  const maxAttempts = stateData ? stateData.maxAttempts : 3;

  // Add specific invalidDone property if applicable
  const invalidDone = (location === 'done' && chatgptVerdict !== 'PASS');

  // Push task entry
  tasksList.push({
    taskId,
    target,
    location,
    status,
    statePath: `.ai/state/${taskId}.json`,
    evidencePath,
    chatgptAuditPath: hasAuditFile ? chatgptAuditPath.replace(aiDir + '/', '.ai/') : null,
    chatgptVerdict,
    lastCommit,
    liveUrl,
    blockingIssues,
    
    // Compatibility fields
    title,
    attempt,
    maxAttempts,
    createdAt,
    evidenceExists: hasEvidence,
    invalidDone,
    blockingErrors: blockingIssues, // duplicate for compatibility
    evidencePacketPath: `.ai/reports/${taskId}/`
  });
});

// Sort tasks: Active first, then done/failed. Within groups, sort by mtime/createdAt descending
const statusWeight = {
  'running': 0,
  'needs_chatgpt_audit': 1,
  'inbox_unseen': 2,
  'blocked': 3,
  'failed': 4,
  'done': 5,
  'unknown': 6
};

tasksList.sort((a, b) => {
  const wA = statusWeight[a.status] !== undefined ? statusWeight[a.status] : 99;
  const wB = statusWeight[b.status] !== undefined ? statusWeight[b.status] : 99;
  if (wA !== wB) return wA - wB;
  
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeB - timeA;
});

// Load Watcher Heartbeat
let heartbeat = {
  name: "watcher",
  lastSeen: new Date().toISOString(),
  lastScannedCommit: runCmd('git rev-parse HEAD', aiDir) || 'unknown',
  inboxCount: tasksList.filter(t => t.status === 'inbox_unseen').length,
  doneCount: tasksList.filter(t => t.status === 'done').length,
  status: "alive"
};

const hbFile = path.join(aiDir, 'heartbeat', 'watcher.json');
if (fs.existsSync(hbFile)) {
  try {
    const rawHb = JSON.parse(fs.readFileSync(hbFile, 'utf8'));
    heartbeat = { ...heartbeat, ...rawHb };
  } catch (e) {}
}

// Generate ecosystem projects list
const PROJECTS_DIR = '/Users/happygolucky/projects';
let projects = ['mindmap-app'];
if (fs.existsSync(PROJECTS_DIR)) {
  try {
    const list = fs.readdirSync(PROJECTS_DIR).filter(f => {
      return fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory();
    });
    if (list.length > 0) projects = list;
  } catch (e) {}
}

// Generate activity logs from watcher.out.log if possible
let activityLog = [];
const watcherLogPath = '/Users/happygolucky/watcher.out.log';
if (fs.existsSync(watcherLogPath)) {
  try {
    const logLines = fs.readFileSync(watcherLogPath, 'utf8').split('\n').slice(-40);
    logLines.forEach(line => {
      const timeMatch = line.match(/^([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2})/);
      if (!timeMatch) return;
      const time = timeMatch[1];
      const action = line.replace(time, '').trim().replace(/^===|===$/g, '').trim();
      if (!action) return;
      
      let sender = 'watcher';
      if (action.includes('Running: agy') || action.includes('Audit completed') || action.includes('Running agy')) sender = 'agy';
      else if (action.includes('PASS') || action.includes('FAIL') || action.includes('audit') || action.includes('reviews')) sender = 'chatgpt';

      activityLog.push({ time, sender, action });
    });
  } catch (e) {}
}

// Build unified taskDetails map for status.json compatibility
const taskDetails = {};
tasksList.forEach(t => {
  taskDetails[t.taskId] = {
    title: t.title,
    target: t.target,
    status: t.status === 'inbox_unseen' ? 'pending' : t.status, // map status back to backward compatible value if needed
    completedAt: t.status === 'done' ? t.createdAt : '',
    summary: t.summary || 'Task index updated',
    attempt: t.attempt,
    maxAttempts: t.maxAttempts,
    lastCommit: t.lastCommit,
    liveUrl: t.liveUrl,
    evidencePacketPath: t.evidencePacketPath,
    chatgptVerdict: t.chatgptVerdict,
    blockingErrors: t.blockingIssues
  };
});

// Compile status.json with backward compatibility and Required work E
const statusJson = {
  // Required work E keys
  pendingTasks: tasksList.filter(t => t.status === 'inbox_unseen' || t.status === 'pending').length,
  runningTasks: tasksList.filter(t => t.status === 'running').length,
  reviewTasks: tasksList.filter(t => t.status === 'needs_chatgpt_audit').length,
  failedTasks: tasksList.filter(t => t.status === 'failed' || t.status === 'blocked').length,
  doneTasks: tasksList.filter(t => t.status === 'done').length,
  needsChatGPTAudit: tasksList.filter(t => t.status === 'needs_chatgpt_audit').map(t => t.taskId),
  blocked: tasksList.filter(t => t.status === 'blocked').map(t => t.taskId),
  heartbeat: heartbeat,

  // Compatibility keys
  lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
  totalTasks: tasksList.length,
  pending: tasksList.filter(t => t.status === 'inbox_unseen' || t.status === 'pending').map(t => t.taskId),
  running: tasksList.filter(t => t.status === 'running').map(t => t.taskId),
  review: tasksList.filter(t => t.status === 'needs_chatgpt_audit').map(t => t.taskId),
  failed: tasksList.filter(t => t.status === 'failed' || t.status === 'blocked').map(t => t.taskId),
  done: tasksList.filter(t => t.status === 'done').map(t => t.taskId),
  projects,
  taskDetails,
  activityLog
};

// Build public control tower data mirror
let watcherStatus = "missing";
let lastSeen = null;
if (heartbeat && heartbeat.lastSeen) {
  lastSeen = heartbeat.lastSeen;
  const hbElapsed = Date.now() - new Date(heartbeat.lastSeen).getTime();
  if (hbElapsed > 3 * 60 * 1000) {
    watcherStatus = "stale";
  } else {
    watcherStatus = "alive";
  }
}

const sanitizedWatcher = {
  status: watcherStatus,
  lastSeen: lastSeen,
  lastScannedCommit: heartbeat ? (heartbeat.lastScannedCommit || null) : null,
  inboxCount: tasksList.filter(t => t.status === 'inbox_unseen').length,
  doneCount: tasksList.filter(t => t.status === 'done' && t.chatgptVerdict === 'PASS').length,
  failedCount: tasksList.filter(t => t.status === 'failed' || t.status === 'blocked').length
};

const sanitizedTasks = tasksList.map(t => {
  let finalStatus = t.status;
  if (t.location === 'done' && t.chatgptVerdict !== 'PASS') {
    finalStatus = 'invalid_done';
  }
  return {
    taskId: t.taskId,
    target: t.target || 'mindmap-app',
    status: finalStatus,
    location: t.location,
    evidenceExists: !!t.evidenceExists,
    chatgptVerdict: t.chatgptVerdict || null,
    lastCommit: t.lastCommit || null,
    liveUrl: t.liveUrl || null,
    blockingIssues: t.blockingIssues || []
  };
});

const stats = {
  total: sanitizedTasks.length,
  pending: sanitizedTasks.filter(t => t.status === 'inbox_unseen' || t.status === 'pending').length,
  running: sanitizedTasks.filter(t => t.status === 'running').length,
  needsChatGPTAudit: sanitizedTasks.filter(t => t.status === 'needs_chatgpt_audit').length,
  done: sanitizedTasks.filter(t => t.status === 'done').length,
  failed: sanitizedTasks.filter(t => t.status === 'failed' || t.status === 'blocked').length,
  invalidDone: sanitizedTasks.filter(t => t.status === 'invalid_done').length
};

const publicControlTowerData = {
  generatedAt: new Date().toISOString(),
  watcher: sanitizedWatcher,
  stats: stats,
  tasks: sanitizedTasks
};

// Write output to both local and mindmap-repo directories
const writeTargets = [
  {
    index: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'task-index.json'),
    status: path.join('/Users/happygolucky/mindmap-repo', 'status.json'),
    ctd: path.join('/Users/happygolucky/mindmap-repo', 'control-tower-data.json'),
    hb: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'heartbeat', 'watcher.json'),
    hbDir: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'heartbeat')
  },
  {
    index: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'task-index.json'),
    status: path.join('/Users/happygolucky/projects/mindmap-app', 'status.json'),
    ctd: path.join('/Users/happygolucky/projects/mindmap-app', 'control-tower-data.json'),
    hb: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'heartbeat', 'watcher.json'),
    hbDir: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'heartbeat')
  }
];

writeTargets.forEach(target => {
  try {
    // Ensure index folder exists
    const idxDir = path.dirname(target.index);
    if (fs.existsSync(path.dirname(idxDir))) {
      safeMkdir(idxDir);
      fs.writeFileSync(target.index, JSON.stringify(tasksList, null, 2), 'utf8');
      console.log(`Successfully wrote task index to: ${target.index}`);
    }
    
    // Ensure status folder exists
    const statDir = path.dirname(target.status);
    if (fs.existsSync(statDir)) {
      fs.writeFileSync(target.status, JSON.stringify(statusJson, null, 2), 'utf8');
      console.log(`Successfully wrote status.json to: ${target.status}`);
    }

    // Ensure control-tower-data.json root folder exists
    const ctdDir = path.dirname(target.ctd);
    if (fs.existsSync(ctdDir)) {
      fs.writeFileSync(target.ctd, JSON.stringify(publicControlTowerData, null, 2), 'utf8');
      console.log(`Successfully wrote control-tower-data.json to: ${target.ctd}`);
    }
    
    // Ensure heartbeat folder exists
    if (fs.existsSync(path.dirname(target.hbDir))) {
      safeMkdir(target.hbDir);
      fs.writeFileSync(target.hb, JSON.stringify(heartbeat, null, 2), 'utf8');
      console.log(`Successfully wrote heartbeat to: ${target.hb}`);
    }
  } catch (err) {
    console.error(`Failed to write target files:`, err.message);
  }
});
