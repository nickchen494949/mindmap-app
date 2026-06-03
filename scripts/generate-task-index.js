const fs = require('fs');
const path = require('path');

// Determine AI folder to scan
let aiDir = '/Users/happygolucky/mindmap-repo/.ai';
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

// Ensure directories exist helper
const safeReaddir = (dir) => {
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir);
  }
  return [];
};

// Scan files
const inboxFiles = safeReaddir(inboxDir).filter(f => f.endsWith('.md'));
const doneFiles = safeReaddir(doneDir).filter(f => f.endsWith('.md'));
const failedFiles = safeReaddir(failedDir).filter(f => f.endsWith('.md'));
const runningFiles = safeReaddir(runningDir).filter(f => f.endsWith('.md'));

// Find all unique task IDs
const taskIds = new Set();
const allTaskFiles = [...inboxFiles, ...doneFiles, ...failedFiles, ...runningFiles];
allTaskFiles.forEach(file => {
  const taskId = path.basename(file, '.md');
  taskIds.add(taskId);
});

const taskList = [];

taskIds.forEach(taskId => {
  const taskFilename = `${taskId}.md`;
  
  // Find task file to read target
  let taskContent = '';
  const possiblePaths = [
    path.join(inboxDir, taskFilename),
    path.join(doneDir, taskFilename),
    path.join(failedDir, taskFilename),
    path.join(runningDir, taskFilename)
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      taskContent = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  // Parse target from target: field
  let target = 'unknown';
  if (taskContent) {
    const targetMatch = taskContent.match(/^target:\s*(.+)$/m);
    if (targetMatch) {
      target = targetMatch[1].trim();
    }
  }

  const fileExistsInInbox = fs.existsSync(path.join(inboxDir, taskFilename));
  const markedDone = fs.existsSync(path.join(doneDir, taskFilename));
  const markedFailed = fs.existsSync(path.join(failedDir, taskFilename));
  
  // Check if evidence exists in reports directory
  const taskReportDir = path.join(reportsDir, taskId);
  let evidenceExists = fs.existsSync(taskReportDir) && 
    (fs.existsSync(path.join(taskReportDir, 'evidence.json')) || safeReaddir(taskReportDir).length > 0);

  if (!evidenceExists && target && target !== 'unknown') {
    const projectReportDir = path.join('/Users/happygolucky/projects', target, '.ai', 'reports', taskId);
    evidenceExists = fs.existsSync(projectReportDir) && 
      (fs.existsSync(path.join(projectReportDir, 'evidence.json')) || safeReaddir(projectReportDir).length > 0);
  }

  // Determine status
  let status = 'inbox_unseen';
  if (markedFailed) {
    status = 'failed';
  } else if (markedDone) {
    status = 'done';
  } else if (evidenceExists) {
    status = 'needs_audit';
  } else if (fs.existsSync(path.join(runningDir, taskFilename))) {
    status = 'running';
  } else {
    // Check if seen by watcher (log file or state file exists)
    const logExists = fs.existsSync(path.join(logsDir, `${taskId}.md.log`)) || fs.existsSync(path.join(logsDir, `${taskId}.log`));
    const stateExists = fs.existsSync(path.join(stateDir, `${taskId}.json`));
    if (logExists || stateExists) {
      status = 'seen';
    } else {
      status = 'inbox_unseen';
    }
  }

  taskList.push({
    taskId,
    target,
    fileExistsInInbox,
    markedDone,
    evidenceExists,
    status
  });
});

// Sort by taskId
taskList.sort((a, b) => a.taskId.localeCompare(b.taskId));

const outputData = {
  lastUpdated: new Date().toISOString(),
  tasks: taskList
};

// Write output to both local and mindmap-repo .ai directories if possible
const writePaths = [
  path.join(aiDir, 'task-index.json'),
  path.join(process.cwd(), '.ai', 'task-index.json')
];

writePaths.forEach(outPath => {
  try {
    const parentDir = path.dirname(outPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`Successfully wrote task index to: ${outPath}`);
  } catch (err) {
    console.error(`Failed to write task index to ${outPath}:`, err.message);
  }
});
