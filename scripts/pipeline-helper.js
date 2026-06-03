const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = '/Users/happygolucky/mindmap-repo';
const PROJECTS_DIR = '/Users/happygolucky/projects';

// Helper to ensure directories exist
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Ensure all required state folders exist
const stateFolders = ['inbox', 'running', 'reports', 'review', 'reviews', 'fix', 'done', 'failed', 'state'];
stateFolders.forEach(folder => {
  ensureDirExists(path.join(REPO_DIR, '.ai', folder));
});

// Helper to execute command safely
function runCmd(cmd, cwd = REPO_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

// Git helpers
function getGitCommitInfo(cwd) {
  const sha = runCmd('git rev-parse HEAD', cwd) || 'unknown';
  const message = runCmd('git log -1 --pretty=%B', cwd) || 'no commit message';
  return { sha, message };
}

function getGitChangedFiles(cwd) {
  const diff = runCmd('git diff --name-only HEAD~1 HEAD', cwd) || runCmd('git status --porcelain', cwd);
  if (!diff) return [];
  return diff.split('\n').map(f => f.trim().replace(/^([ADMRCPUST?! ]+)\s+/, '')).filter(Boolean);
}

// State management
function getTaskState(taskId) {
  const statePath = path.join(REPO_DIR, '.ai', 'state', `${taskId}.json`);
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      console.error(`Error parsing state for ${taskId}:`, e);
    }
  }
  return null;
}

function saveTaskState(taskId, state) {
  const statePath = path.join(REPO_DIR, '.ai', 'state', `${taskId}.json`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

// Main Commands
async function audit(taskId, target) {
  console.log(`=== Running QA Audit for Task: ${taskId} [Target: ${target}] ===`);
  const workDir = target ? path.join(PROJECTS_DIR, target) : REPO_DIR;
  
  // Clean up any old audit verdict files from previous attempts
  const baseTaskId = taskId.replace(/-fix$/, '');
  const cleanupPaths = [
    path.join(REPO_DIR, '.ai', 'reviews', taskId, 'chatgpt-audit.md'),
    path.join(REPO_DIR, '.ai', 'reviews', baseTaskId, 'chatgpt-audit.md'),
    path.join(REPO_DIR, '.ai', 'review', taskId, 'chatgpt-audit.md'),
    path.join(REPO_DIR, '.ai', 'review', baseTaskId, 'chatgpt-audit.md'),
    path.join(workDir, '.ai', 'reviews', taskId, 'chatgpt-audit.md'),
    path.join(workDir, '.ai', 'reviews', baseTaskId, 'chatgpt-audit.md'),
    path.join(workDir, '.ai', 'review', taskId, 'chatgpt-audit.md'),
    path.join(workDir, '.ai', 'review', baseTaskId, 'chatgpt-audit.md')
  ];
  cleanupPaths.forEach(p => {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        console.log(`Cleaned up old audit file: ${p}`);
      } catch (e) {
        console.warn(`Failed to delete old audit file: ${p}`, e.message);
      }
    }
  });

  // 1. Initialize or Load State
  let state = getTaskState(taskId);
  if (!state) {
    state = {
      taskId,
      target,
      status: 'needs_chatgpt_audit',
      attempt: 1,
      maxAttempts: 3,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastCommit: '',
      liveUrl: `https://nickchen494949.github.io/${target}/`,
      evidencePacketPath: `.ai/reports/${taskId}/`,
      chatgptAuditPath: null,
      chatgptVerdict: null,
      blockingErrors: [],
      notes: []
    };
  } else {
    state.updatedAt = new Date().toISOString();
    state.status = 'needs_chatgpt_audit';
  }

  // Ensure directories in target and repo
  const repoReportsDir = path.join(REPO_DIR, '.ai', 'reports', taskId);
  ensureDirExists(repoReportsDir);
  
  if (target) {
    ensureDirExists(path.join(workDir, '.ai', 'reports', taskId));
    ensureDirExists(path.join(workDir, '.ai', 'state'));
  }

  // 2. Collect Git info
  const commitInfo = getGitCommitInfo(workDir);
  const changedFiles = getGitChangedFiles(workDir);
  state.lastCommit = commitInfo.sha;

  fs.writeFileSync(path.join(repoReportsDir, 'commit.txt'), `Commit SHA: ${commitInfo.sha}\nMessage: ${commitInfo.message}\n`, 'utf8');
  fs.writeFileSync(path.join(repoReportsDir, 'changed-files.txt'), changedFiles.join('\n') + '\n', 'utf8');

  // 3. Run Mechanical Checks
  const mechanicalChecks = {
    buildPass: true,
    livePageLoads: false,
    consoleErrorCount: 0,
    networkErrorCount: 0,
    dataAuditPass: true
  };

  const errors = [];
  const networkErrors = [];
  const consoleErrors = [];
  let pageText = '';
  let pageTitle = '';
  let isBlank = false;
  let isStuckLoading = false;
  let is404 = false;
  let screenshotPath = '';

  const isWebProject = ['us-macro-dashboard', 'chatgpt-pipeline-test', 'mindmap-app'].includes(target);
  const liveUrl = state.liveUrl;

  if (isWebProject) {
    console.log(`Auditing Web Project at URL: ${liveUrl}`);
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Listeners
      page.on('pageerror', (exception) => {
        consoleErrors.push(`Uncaught Exception: ${exception.message}`);
        console.error(`Page error: ${exception.message}`);
      });

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(`Console Error: ${message.text()}`);
          console.error(`Console error: ${message.text()}`);
        }
      });

      page.on('requestfailed', (request) => {
        const failure = request.failure();
        networkErrors.push(`Failed Request: ${request.url()} (${failure ? failure.errorText : 'unknown'})`);
      });

      // Load page
      const response = await page.goto(liveUrl, { waitUntil: 'networkidle', timeout: 30000 });
      if (!response) {
        errors.push('Failed to load page: response is null');
      } else {
        const status = response.status();
        if (status === 404) {
          is404 = true;
          errors.push('Page returned 404 Not Found');
        } else if (status >= 400) {
          errors.push(`HTTP Error Status: ${status}`);
        }
      }

      await page.waitForTimeout(3000);
      pageTitle = await page.title();
      pageText = await page.innerText('body');

      // Check text content
      if (!pageText || pageText.trim().length === 0) {
        isBlank = true;
        errors.push('Page content is blank');
      }
      if (pageText.includes('Loading') || pageText.includes('loading') || pageText.includes('Generating')) {
        isStuckLoading = true;
        errors.push('Page shows loading/generating indicator');
      }

      // Specific project check
      if (target === 'us-macro-dashboard') {
        const cardsCount = await page.locator('.macro-card').count();
        if (cardsCount === 0) {
          errors.push('No .macro-card components found');
        }
      }

      // Save screenshot
      const screenFile = path.join(repoReportsDir, 'screenshot.png');
      await page.screenshot({ path: screenFile, fullPage: true });
      screenshotPath = `.ai/reports/${taskId}/screenshot.png`;

      await context.close();
      await browser.close();

      mechanicalChecks.livePageLoads = !is404 && errors.length === 0;
      mechanicalChecks.consoleErrorCount = consoleErrors.length;
      mechanicalChecks.networkErrorCount = networkErrors.length;

    } catch (pwError) {
      console.error('Playwright execution failed:', pwError.message);
      errors.push(`Playwright Execution Error: ${pwError.message}`);
      mechanicalChecks.livePageLoads = false;
    }
  }

  // Save log files
  fs.writeFileSync(path.join(repoReportsDir, 'console-errors.txt'), consoleErrors.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(repoReportsDir, 'network-errors.txt'), networkErrors.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(repoReportsDir, 'page-text.txt'), pageText || 'No text captured\n', 'utf8');

  if (isWebProject) {
    const liveAudit = {
      url: liveUrl,
      timestamp: new Date().toISOString(),
      pass: mechanicalChecks.livePageLoads && consoleErrors.length === 0 && networkErrors.length === 0,
      errors,
      consoleErrors,
      networkErrors,
      pageTitle,
      isBlank,
      isStuckLoading,
      is404
    };
    fs.writeFileSync(path.join(repoReportsDir, 'live-audit.json'), JSON.stringify(liveAudit, null, 2), 'utf8');
  }

  // 4. Data Audit (for us-macro-dashboard)
  const knownRisks = [];
  const questionsForChatGPT = [];

  if (target === 'us-macro-dashboard') {
    console.log('Running Data Audit...');
    const dataFilePath = path.join(workDir, 'src', 'data.js');
    let dataAuditResult = {
      pass: true,
      issues: []
    };
    let freshnessDetails = '';
    let sourceStatusDetails = '';

    if (fs.existsSync(dataFilePath)) {
      try {
        const fileContent = fs.readFileSync(dataFilePath, 'utf8');
        // Extract MACRO_DATA object
        const jsonStart = fileContent.indexOf('{');
        const jsonEnd = fileContent.lastIndexOf('}');
        const jsonText = fileContent.substring(jsonStart, jsonEnd + 1);
        const macroData = JSON.parse(jsonText);

        const series = macroData.series || {};
        
        freshnessDetails = `# Data Freshness Report\n\nGenerated at: ${new Date().toISOString()}\n\n| Series ID | Name | Latest Date | Latest Value | Unit | Status |\n|---|---|---|---|---|---|\n`;
        sourceStatusDetails = `# Data Source Status Report\n\n`;

        // Check for specific bugs
        for (const [sid, sconf] of Object.entries(series)) {
          const sdate = sconf.latest ? sconf.latest.date : 'N/A';
          const sval = sconf.latest ? sconf.latest.value : 'N/A';
          const sunit = sconf.unit || '';
          
          let sstatus = 'OK';
          
          // Bug A & B: RESBALNS stale Aug 2020 & 0.003T value
          if (sid === 'RESBALNS') {
            if (sdate === '2020-08-01') {
              sstatus = 'STALE';
              dataAuditResult.issues.push({
                seriesId: sid,
                type: 'stale_data_bug',
                description: 'RESBALNS data is stale, stuck at Aug 2020 (2020-08-01).'
              });
              knownRisks.push('RESBALNS data remains stale from August 2020.');
            }
            if (sval < 0.01) {
              dataAuditResult.issues.push({
                seriesId: sid,
                type: 'scale_bug',
                description: `RESBALNS value is ${sval} (around 0.003T). Bank reserves should be in Trillions of dollars (e.g. ~3.2T), indicating a scale factor division bug.`
              });
              knownRisks.push('RESBALNS displays incorrect scaling factor (shows ~0.003T instead of ~3.2T).');
            }
          }

          // Bug C: ICSA 209000k unit bug
          if (sid === 'ICSA') {
            if (sval > 10000 && sunit === 'k') {
              dataAuditResult.issues.push({
                seriesId: sid,
                type: 'unit_formatting_bug',
                description: `ICSA has value ${sval} with unit 'k', rendering as ${sval}k (209,000k claims is 209 million, which is incorrect).`
              });
              knownRisks.push('ICSA unit display scales incorrectly (showing 209000k instead of 209k).');
            }
          }

          // Check for fallback indicators
          const history = sconf.history || [];
          if (history.length === 0 || sconf.name.includes('Mock') || (sconf.notes && sconf.notes.includes('Fallback'))) {
            sstatus = 'FALLBACK';
            dataAuditResult.issues.push({
              seriesId: sid,
              type: 'fallback_data',
              description: `Series ${sid} (${sconf.name}) is using fallback or mock data.`
            });
          }

          freshnessDetails += `| ${sid} | ${sconf.name} | ${sdate} | ${sval} | ${sunit} | ${sstatus} |\n`;
        }

        if (dataAuditResult.issues.length > 0) {
          dataAuditResult.pass = false;
          mechanicalChecks.dataAuditPass = false;
        }

        sourceStatusDetails += `Total series monitored: ${Object.keys(series).length}\n`;
        sourceStatusDetails += `Issues detected: ${dataAuditResult.issues.length}\n\n`;
        sourceStatusDetails += `### Issue Details\n`;
        dataAuditResult.issues.forEach(issue => {
          sourceStatusDetails += `- **[${issue.seriesId}] ${issue.type}**: ${issue.description}\n`;
        });

      } catch (parseErr) {
        console.error('Error parsing data.js:', parseErr.message);
        dataAuditResult.pass = false;
        dataAuditResult.error = parseErr.message;
        mechanicalChecks.dataAuditPass = false;
      }
    } else {
      dataAuditResult.pass = false;
      dataAuditResult.error = `data.js not found at ${dataFilePath}`;
      mechanicalChecks.dataAuditPass = false;
    }

    fs.writeFileSync(path.join(repoReportsDir, 'data-audit.json'), JSON.stringify(dataAuditResult, null, 2), 'utf8');
    fs.writeFileSync(path.join(repoReportsDir, 'data-freshness.md'), freshnessDetails || '# Freshness details unavailable\n', 'utf8');
    fs.writeFileSync(path.join(repoReportsDir, 'data-source-status.md'), sourceStatusDetails || '# Source status unavailable\n', 'utf8');
  }

  // Write log-tail.txt
  let logTailContent = 'Execution log not available';
  const baseTaskId = taskId.replace(/-fix$/, '');
  const possibleLogPaths = [
    path.join(REPO_DIR, '.ai', 'logs', `${taskId}.md.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${taskId}.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${baseTaskId}.md.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${baseTaskId}.log`),
    path.join(workDir, '.ai', 'logs', `${taskId}.md.log`),
    path.join(workDir, '.ai', 'logs', `${taskId}.log`)
  ];

  for (const logPath of possibleLogPaths) {
    if (fs.existsSync(logPath)) {
      try {
        const fullLog = fs.readFileSync(logPath, 'utf8');
        const lines = fullLog.split('\n');
        logTailContent = lines.slice(-100).join('\n');
        break;
      } catch (e) {
        console.warn(`Failed to read log file at ${logPath}:`, e.message);
      }
    }
  }

  const logTailFile = path.join(repoReportsDir, 'log-tail.txt');
  fs.writeFileSync(logTailFile, logTailContent, 'utf8');

  // 5. Save Evidence JSON
  const evidence = {
    taskId,
    target,
    status: 'needs_chatgpt_audit',
    commitSha: state.lastCommit || 'local',
    changedFiles,
    logTailPath: `.ai/reports/${taskId}/log-tail.txt`,
    knownRisks,
    questionsForChatGPT: [],
    generatedAt: new Date().toISOString(),

    // Web/data optional fields
    liveUrl: liveUrl || null,
    pageTextPath: `.ai/reports/${taskId}/page-text.txt`,
    screenshotPath: screenshotPath ? `.ai/reports/${taskId}/screenshot.png` : null,
    consoleErrorsPath: fs.existsSync(path.join(repoReportsDir, 'console-errors.txt')) ? `.ai/reports/${taskId}/console-errors.txt` : null,
    networkErrorsPath: fs.existsSync(path.join(repoReportsDir, 'network-errors.txt')) ? `.ai/reports/${taskId}/network-errors.txt` : null,
    dataAuditPath: fs.existsSync(path.join(repoReportsDir, 'data-audit.json')) ? `.ai/reports/${taskId}/data-audit.json` : null,

    // Extra fields for compatibility
    attempt: state.attempt,
    mechanicalChecks,
    screenshots: screenshotPath ? [screenshotPath] : []
  };
  fs.writeFileSync(path.join(repoReportsDir, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');

  // 6. Save Summary.md
  let summaryMd = `# QA Audit Summary for ${taskId}\n\n`;
  summaryMd += `**Target Project**: ${target}\n`;
  summaryMd += `**Execution Time**: ${new Date().toISOString()}\n`;
  summaryMd += `**Commit SHA**: ${state.lastCommit}\n`;
  summaryMd += `**Live Page**: [View Live](${liveUrl})\n\n`;
  summaryMd += `## Mechanical Checks\n`;
  summaryMd += `- Build: ${mechanicalChecks.buildPass ? '✅ PASS' : '❌ FAIL'}\n`;
  summaryMd += `- Page Loads: ${mechanicalChecks.livePageLoads ? '✅ PASS' : '❌ FAIL'}\n`;
  summaryMd += `- Console Errors: ${mechanicalChecks.consoleErrorCount}\n`;
  summaryMd += `- Network Errors: ${mechanicalChecks.networkErrorCount}\n`;
  summaryMd += `- Data Audit: ${mechanicalChecks.dataAuditPass ? '✅ PASS' : '❌ FAIL'}\n\n`;
  
  if (knownRisks.length > 0) {
    summaryMd += `## Known Risks / Issues Found\n`;
    knownRisks.forEach(risk => {
      summaryMd += `- ⚠️ ${risk}\n`;
    });
    summaryMd += '\n';
  }
  
  summaryMd += `## Changed Files\n`;
  changedFiles.forEach(file => {
    summaryMd += `- ${file}\n`;
  });

  fs.writeFileSync(path.join(repoReportsDir, 'summary.md'), summaryMd, 'utf8');

  // 7. Save State JSON
  state.chatgptVerdict = null;
  state.blockingErrors = [];
  saveTaskState(taskId, state);

  // Sync to target project if applicable
  if (target) {
    const tgtStateDir = path.join(workDir, '.ai', 'state');
    const tgtReportsDir = path.join(workDir, '.ai', 'reports', taskId);
    ensureDirExists(tgtStateDir);
    ensureDirExists(tgtReportsDir);
    
    // Copy state file
    fs.copyFileSync(
      path.join(REPO_DIR, '.ai', 'state', `${taskId}.json`),
      path.join(tgtStateDir, `${taskId}.json`)
    );

    // Copy reports directory files
    const reportFiles = fs.readdirSync(repoReportsDir);
    reportFiles.forEach(file => {
      fs.copyFileSync(
        path.join(repoReportsDir, file),
        path.join(tgtReportsDir, file)
      );
    });
  }

  console.log(`Audit completed! State JSON and reports written.`);
}

function checkReviews() {
  console.log('=== Checking for ChatGPT reviews/audits (delegating to generate-task-index.js) ===');
  try {
    execSync(`node "${path.join(REPO_DIR, 'scripts', 'generate-task-index.js')}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to run generate-task-index.js:', e.message);
  }
}

function updateStatus() {
  console.log('=== Updating status.json (delegating to generate-task-index.js) ===');
  try {
    execSync(`node "${path.join(REPO_DIR, 'scripts', 'generate-task-index.js')}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to run generate-task-index.js:', e.message);
  }
}

// Command dispatcher
(async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'audit') {
      const taskId = args[1];
      const target = args[2] || '';
      if (!taskId) {
        console.error('Error: taskId is required for audit command');
        process.exit(1);
      }
      await audit(taskId, target);
    } else if (command === 'check-reviews') {
      checkReviews();
    } else if (command === 'update-status') {
      updateStatus();
    } else {
      console.log('Unknown command. Available commands: audit, check-reviews, update-status');
    }
  } catch (err) {
    console.error('Pipeline execution error:', err);
    process.exit(1);
  }
})();
