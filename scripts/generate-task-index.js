const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Determine the AI directory to scan
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

// 2. Process ChatGPT Reviews first
function checkReviews() {
  console.log('=== Checking for ChatGPT reviews/audits in state machine ===');
  const reviewFiles = safeReaddir(reviewDir).filter(f => f.endsWith('.md'));
  
  reviewFiles.forEach(file => {
    const taskId = file.replace('.md', '');
    const stateFile = path.join(stateDir, `${taskId}.json`);
    
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
      console.log(`Found review verdict file for ${taskId}: ${chatgptAuditPath}`);
      const reviewContent = fs.readFileSync(chatgptAuditPath, 'utf8');
      
      const hasPass = reviewContent.includes('VERDICT: PASS');
      const hasFail = reviewContent.includes('VERDICT: FAIL');

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
        if (target && target !== 'mindmap-app' && fs.existsSync(workDir)) {
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
        
        // Extract blocking issues/reasons from the review file
        const lines = reviewContent.split('\n');
        const blockingErrors = [];
        let capture = false;
        lines.forEach(line => {
          if (line.includes('VERDICT: FAIL')) {
            capture = true;
            return;
          }
          if (capture) {
            if (line.trim()) blockingErrors.push(line.trim());
          }
        });

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

          if (target && target !== 'mindmap-app' && fs.existsSync(workDir)) {
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
          state.status = 'pending';

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

          if (target && target !== 'mindmap-app' && fs.existsSync(workDir)) {
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
            } catch (e) {}
          }
        }
      }
    }
  });
}

// Execute checkReviews
checkReviews();

// 3. Scan files to find all task files
const tasksMap = {};

function scanDir(dirName, flags) {
  const dirPath = path.join(aiDir, dirName);
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    if (file.startsWith('task-') && file.endsWith('.md')) {
      const taskId = file.substring(0, file.length - 3).replace(/-fix$/, '');
      if (!tasksMap[taskId]) {
        tasksMap[taskId] = {
          taskId,
          title: taskId,
          target: null,
          fileExistsInInbox: false,
          markedDone: false,
          markedFailed: false,
          evidenceExists: false,
          status: 'pending',
          createdAt: null
        };
      }
      
      const filePath = path.join(dirPath, file);
      try {
        const stats = fs.statSync(filePath);
        const mtime = stats.mtime.toISOString();
        if (!tasksMap[taskId].createdAt || mtime < tasksMap[taskId].createdAt) {
          tasksMap[taskId].createdAt = mtime;
        }
      } catch (e) {
        // ignore
      }

      // Read file content for title and target
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find title
        const titleMatch = content.match(/^#\s*(.*)/m);
        if (titleMatch) {
          tasksMap[taskId].title = titleMatch[1].trim();
        }
        
        // Find target
        const targetMatch = content.match(/^target:\s*(.*)/mi);
        if (targetMatch) {
          tasksMap[taskId].target = targetMatch[1].trim();
        }
      } catch (e) {
        // ignore
      }
      
      if (flags.isInbox) tasksMap[taskId].fileExistsInInbox = true;
      if (flags.isDone) tasksMap[taskId].markedDone = true;
      if (flags.isFailed) tasksMap[taskId].markedFailed = true;
    }
  });
}

scanDir('inbox', { isInbox: true });
scanDir('done', { isDone: true });
scanDir('failed', { isFailed: true });
scanDir('running', {});
scanDir('review', {});
scanDir('fix', {});

// Also scan .ai/reports for taskId directories to check evidenceExists
if (fs.existsSync(reportsDir)) {
  const files = fs.readdirSync(reportsDir);
  files.forEach(file => {
    const fullPath = path.join(reportsDir, file);
    if (fs.statSync(fullPath).isDirectory() && file.startsWith('task-')) {
      const taskId = file;
      if (!tasksMap[taskId]) {
        tasksMap[taskId] = {
          taskId,
          title: taskId,
          target: null,
          fileExistsInInbox: false,
          markedDone: false,
          markedFailed: false,
          evidenceExists: false,
          status: 'pending',
          createdAt: null
        };
      }
      
      // Evidence exists if directory is not empty
      try {
        const reportContents = fs.readdirSync(fullPath);
        if (reportContents.length > 0) {
          tasksMap[taskId].evidenceExists = true;
        }
      } catch (e) {
        // ignore
      }
    }
  });
}

// Fetch states and processes to fill details
const runningProcesses = runCmd('ps aux', process.cwd());

const tasksList = Object.values(tasksMap);
tasksList.forEach(task => {
  const taskId = task.taskId;
  
  // Try to load state JSON if it exists
  const stateFile = path.join(stateDir, `${taskId}.json`);
  if (fs.existsSync(stateFile)) {
    try {
      const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      task.attempt = stateData.attempt;
      task.maxAttempts = stateData.maxAttempts;
      task.liveUrl = stateData.liveUrl;
      task.evidencePacketPath = stateData.evidencePacketPath;
      task.chatgptAuditPath = stateData.chatgptAuditPath;
      task.chatgptVerdict = stateData.chatgptVerdict;
      task.blockingErrors = stateData.blockingErrors;
      task.lastCommit = stateData.lastCommit;
      task.status = stateData.status;
      if (stateData.startedAt) {
        task.createdAt = stateData.startedAt;
      }
      if (stateData.target && !task.target) {
        task.target = stateData.target;
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallbacks for missing state properties
  task.attempt = task.attempt || 1;
  task.maxAttempts = task.maxAttempts || 3;
  task.liveUrl = task.liveUrl || `https://nickchen494949.github.io/${task.target || 'mindmap-app'}/`;
  task.evidencePacketPath = task.evidencePacketPath || `.ai/reports/${taskId}/`;
  task.blockingErrors = task.blockingErrors || [];

  // If reports directory exists, look for summary.md for a task summary
  const summaryFile = path.join(reportsDir, taskId, 'summary.md');
  if (fs.existsSync(summaryFile)) {
    try {
      task.summary = fs.readFileSync(summaryFile, 'utf8').trim();
    } catch (e) {
      // ignore
    }
  }
  
  // Set default flags if undefined
  task.fileExistsInInbox = task.fileExistsInInbox || false;
  task.markedDone = task.markedDone || false;
  task.markedFailed = task.markedFailed || false;
  task.evidenceExists = task.evidenceExists || false;
  
  // Determine status if not loaded from state JSON
  if (!task.status) {
    if (task.markedDone) {
      task.status = 'done';
    } else if (task.markedFailed) {
      task.status = 'failed';
    } else if (fs.existsSync(path.join(reviewDir, `${taskId}.md`))) {
      task.status = 'needs_chatgpt_audit';
    } else if (fs.existsSync(path.join(runningDir, `${taskId}.md`))) {
      task.status = 'running';
    } else {
      // Check if log file exists
      const logFile = path.join(logsDir, `${taskId}.md.log`);
      const logExists = fs.existsSync(logFile);
      
      if (logExists) {
        // Check if process is running
        const isProcessRunning = runningProcesses.includes(taskId) && (runningProcesses.includes('agy') || runningProcesses.includes('node'));
        if (isProcessRunning) {
          task.status = 'running';
        } else {
          task.status = 'pending';
        }
      } else {
        task.status = 'pending';
      }
    }
  }
});

// Sort tasks: Active first, then done/failed. Within groups, sort by createdAt descending (newest first)
const statusWeight = {
  'running': 0,
  'needs_chatgpt_audit': 1,
  'pending': 2,
  'failed': 3,
  'done': 4
};
tasksList.sort((a, b) => {
  const wA = statusWeight[a.status] !== undefined ? statusWeight[a.status] : 99;
  const wB = statusWeight[b.status] !== undefined ? statusWeight[b.status] : 99;
  if (wA !== wB) return wA - wB;
  
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeB - timeA; // Descending (newest first)
});

// Prepare watcher heartbeat
const gitSha = runCmd('git rev-parse HEAD', aiDir) || 'unknown';
const inboxCount = tasksList.filter(t => t.status === 'pending').length;
const doneCount = tasksList.filter(t => t.status === 'done').length;

const heartbeat = {
  name: "watcher",
  lastSeen: new Date().toISOString(),
  lastScannedCommit: gitSha,
  inboxCount,
  doneCount,
  status: "alive"
};

// Generate projects list
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
  } catch (e) {
    console.error('Error parsing watcher log:', e.message);
  }
}

// Build unified taskDetails map
const taskDetails = {};
tasksList.forEach(t => {
  taskDetails[t.taskId] = {
    title: t.title,
    target: t.target,
    status: t.status,
    completedAt: t.status === 'done' ? t.createdAt : '',
    summary: t.summary || 'Task index updated',
    attempt: t.attempt,
    maxAttempts: t.maxAttempts,
    lastCommit: t.lastCommit,
    liveUrl: t.liveUrl,
    evidencePacketPath: t.evidencePacketPath,
    chatgptVerdict: t.chatgptVerdict,
    blockingErrors: t.blockingErrors
  };
});

// Compile status.json
const statusJson = {
  lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
  totalTasks: tasksList.length,
  doneTasks: tasksList.filter(t => t.status === 'done').length,
  pendingTasks: tasksList.filter(t => t.status === 'pending' || t.status === 'running').length,
  pending: tasksList.filter(t => t.status === 'pending').map(t => t.taskId),
  running: tasksList.filter(t => t.status === 'running').map(t => t.taskId),
  review: tasksList.filter(t => t.status === 'needs_chatgpt_audit').map(t => t.taskId),
  failed: tasksList.filter(t => t.status === 'failed').map(t => t.taskId),
  done: tasksList.filter(t => t.status === 'done').map(t => t.taskId),
  projects,
  taskDetails,
  activityLog
};

// Write output to both local and mindmap-repo directories
const writeTargets = [
  {
    index: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'task-index.json'),
    status: path.join('/Users/happygolucky/mindmap-repo', 'status.json'),
    hb: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'heartbeat', 'watcher.json'),
    hbDir: path.join('/Users/happygolucky/mindmap-repo', '.ai', 'heartbeat')
  },
  {
    index: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'task-index.json'),
    status: path.join('/Users/happygolucky/projects/mindmap-app', 'status.json'),
    hb: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'heartbeat', 'watcher.json'),
    hbDir: path.join('/Users/happygolucky/projects/mindmap-app', '.ai', 'heartbeat')
  }
];

writeTargets.forEach(target => {
  try {
    // Write task-index
    fs.writeFileSync(target.index, JSON.stringify(tasksList, null, 2), 'utf8');
    console.log(`Successfully wrote task index to: ${target.index}`);
    
    // Write status.json
    fs.writeFileSync(target.status, JSON.stringify(statusJson, null, 2), 'utf8');
    console.log(`Successfully wrote status.json to: ${target.status}`);
    
    // Ensure heartbeat dir exists
    if (!fs.existsSync(target.hbDir)) {
      fs.mkdirSync(target.hbDir, { recursive: true });
    }
    // Write heartbeat
    fs.writeFileSync(target.hb, JSON.stringify(heartbeat, null, 2), 'utf8');
    console.log(`Successfully wrote heartbeat to: ${target.hb}`);
  } catch (err) {
    console.error(`Failed to write target files:`, err.message);
  }
});
