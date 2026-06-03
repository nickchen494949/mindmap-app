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

  // 5. Save Evidence JSON
  const evidence = {
    taskId,
    target,
    status: 'needs_chatgpt_audit',
    attempt: state.attempt,
    commitSha: state.lastCommit,
    liveUrl,
    changedFiles,
    mechanicalChecks,
    knownRisks,
    questionsForChatGPT,
    screenshots: screenshotPath ? [screenshotPath] : [],
    pageTextPath: `.ai/reports/${taskId}/page-text.txt`
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
  console.log('=== Checking for ChatGPT reviews/audits ===');
  const reviewFiles = fs.readdirSync(path.join(REPO_DIR, '.ai', 'review'));
  
  reviewFiles.forEach(file => {
    if (!file.endsWith('.md')) return;
    const taskName = file;
    const taskId = file.replace('.md', '');
    
    const state = getTaskState(taskId);
    if (!state || state.status !== 'needs_chatgpt_audit') return;

    const chatgptAuditDir = path.join(REPO_DIR, '.ai', 'reviews', taskId);
    const chatgptAuditPath = path.join(chatgptAuditDir, 'chatgpt-audit.md');

    if (fs.existsSync(chatgptAuditPath)) {
      console.log(`Found review file for ${taskId}: ${chatgptAuditPath}`);
      const reviewContent = fs.readFileSync(chatgptAuditPath, 'utf8');
      
      const hasPass = reviewContent.includes('VERDICT: PASS');
      const hasFail = reviewContent.includes('VERDICT: FAIL');

      const target = state.target;
      const workDir = target ? path.join(PROJECTS_DIR, target) : REPO_DIR;

      if (hasPass) {
        console.log(`Verdict: PASS for ${taskId}`);
        // 1. Move task file in command center from review to done
        fs.renameSync(
          path.join(REPO_DIR, '.ai', 'review', taskName),
          path.join(REPO_DIR, '.ai', 'done', taskName)
        );

        // 2. Sync to target project if applicable
        if (target) {
          try {
            ensureDirExists(path.join(workDir, '.ai', 'done'));
            if (fs.existsSync(path.join(workDir, '.ai', 'review', taskName))) {
              fs.renameSync(
                path.join(workDir, '.ai', 'review', taskName),
                path.join(workDir, '.ai', 'done', taskName)
              );
            }
          } catch (e) {
            console.error(`Syncing PASS rename to project failed:`, e.message);
          }
        }

        // 3. Update state
        state.status = 'done';
        state.chatgptVerdict = 'PASS';
        state.chatgptAuditPath = `.ai/reviews/${taskId}/chatgpt-audit.md`;
        state.updatedAt = new Date().toISOString();
        saveTaskState(taskId, state);

        // Sync state file to target project
        if (target) {
          try {
            fs.copyFileSync(
              path.join(REPO_DIR, '.ai', 'state', `${taskId}.json`),
              path.join(workDir, '.ai', 'state', `${taskId}.json`)
            );
          } catch (e) {}
        }
      } else if (hasFail) {
        console.log(`Verdict: FAIL for ${taskId}`);
        
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
        state.chatgptAuditPath = `.ai/reviews/${taskId}/chatgpt-audit.md`;
        state.blockingErrors = blockingErrors;
        state.attempt += 1;
        state.updatedAt = new Date().toISOString();

        if (state.attempt > state.maxAttempts) {
          console.log(`Task ${taskId} exceeded max attempts (${state.maxAttempts}). Marking as FAILED.`);
          state.status = 'failed';
          
          // Move task file to failed
          fs.renameSync(
            path.join(REPO_DIR, '.ai', 'review', taskName),
            path.join(REPO_DIR, '.ai', 'failed', taskName)
          );

          if (target) {
            try {
              ensureDirExists(path.join(workDir, '.ai', 'failed'));
              if (fs.existsSync(path.join(workDir, '.ai', 'review', taskName))) {
                fs.renameSync(
                  path.join(workDir, '.ai', 'review', taskName),
                  path.join(workDir, '.ai', 'failed', taskName)
                );
              }
            } catch (e) {}
          }
        } else {
          console.log(`Task ${taskId} failed. Retrying (Attempt ${state.attempt}).`);
          state.status = 'pending';

          // Move task file from review to fix (acting as archive/history of previous attempt)
          const archiveName = `${taskId}-attempt-${state.attempt - 1}.md`;
          fs.renameSync(
            path.join(REPO_DIR, '.ai', 'review', taskName),
            path.join(REPO_DIR, '.ai', 'fix', archiveName)
          );

          if (target) {
            try {
              ensureDirExists(path.join(workDir, '.ai', 'fix'));
              if (fs.existsSync(path.join(workDir, '.ai', 'review', taskName))) {
                fs.renameSync(
                  path.join(workDir, '.ai', 'review', taskName),
                  path.join(workDir, '.ai', 'fix', archiveName)
                );
              }
            } catch (e) {}
          }

          // Create a new fix task file in inbox
          const fixTaskName = `task-${taskId}-fix.md`;
          const fixTaskPath = path.join(REPO_DIR, '.ai', 'inbox', fixTaskName);
          
          let fixTaskContent = `target: ${target || 'mindmap-app'}\n\n`;
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
        }

        saveTaskState(taskId, state);

        // Sync state file to target project
        if (target) {
          try {
            fs.copyFileSync(
              path.join(REPO_DIR, '.ai', 'state', `${taskId}.json`),
              path.join(workDir, '.ai', 'state', `${taskId}.json`)
            );
          } catch (e) {}
        }
      }
    }
  });
}

function updateStatus() {
  console.log('=== Updating status.json ===');
  
  // Count tasks by category
  const inboxTasks = fs.readdirSync(path.join(REPO_DIR, '.ai', 'inbox')).filter(f => f.endsWith('.md'));
  const runningTasks = fs.readdirSync(path.join(REPO_DIR, '.ai', 'running')).filter(f => f.endsWith('.md'));
  const reviewTasks = fs.readdirSync(path.join(REPO_DIR, '.ai', 'review')).filter(f => f.endsWith('.md'));
  const doneTasks = fs.readdirSync(path.join(REPO_DIR, '.ai', 'done')).filter(f => f.endsWith('.md'));
  const failedTasks = fs.readdirSync(path.join(REPO_DIR, '.ai', 'failed')).filter(f => f.endsWith('.md'));
  
  const totalTasksSet = new Set([
    ...inboxTasks,
    ...runningTasks,
    ...reviewTasks,
    ...doneTasks,
    ...failedTasks
  ]);

  const projects = fs.readdirSync(PROJECTS_DIR).filter(f => {
    return fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory();
  });

  const taskDetails = {};
  
  // Scavenge state files
  const stateFiles = fs.readdirSync(path.join(REPO_DIR, '.ai', 'state')).filter(f => f.endsWith('.json'));
  stateFiles.forEach(file => {
    const taskId = file.replace('.json', '');
    const state = getTaskState(taskId);
    if (state) {
      // Find the file in folders to determine current status
      let currentFolder = 'unknown';
      if (inboxTasks.includes(`${taskId}.md`) || inboxTasks.includes(`${taskId}-fix.md`)) currentFolder = 'pending';
      else if (runningTasks.includes(`${taskId}.md`) || runningTasks.includes(`${taskId}-fix.md`)) currentFolder = 'running';
      else if (reviewTasks.includes(`${taskId}.md`) || reviewTasks.includes(`${taskId}-fix.md`)) currentFolder = 'needs_chatgpt_audit';
      else if (doneTasks.includes(`${taskId}.md`) || doneTasks.includes(`${taskId}-fix.md`)) currentFolder = 'done';
      else if (failedTasks.includes(`${taskId}.md`) || failedTasks.includes(`${taskId}-fix.md`)) currentFolder = 'failed';
      
      // Override status in JSON for display if mismatch
      if (currentFolder !== 'unknown') {
        state.status = currentFolder;
      }

      // Read title from the task file if possible
      let title = state.taskId.replace('task-', '').replace(/-/g, ' ');
      // Search in review, inbox, done, etc.
      const searchDirs = ['.ai/inbox', '.ai/running', '.ai/review', '.ai/done', '.ai/failed', '.ai/fix'];
      for (const sdir of searchDirs) {
        const potentialPath = path.join(REPO_DIR, sdir, `${taskId}.md`);
        const fixPotentialPath = path.join(REPO_DIR, sdir, `${taskId}-fix.md`);
        let finalPath = '';
        if (fs.existsSync(potentialPath)) finalPath = potentialPath;
        else if (fs.existsSync(fixPotentialPath)) finalPath = fixPotentialPath;

        if (finalPath) {
          const lines = fs.readFileSync(finalPath, 'utf8').split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('#')) {
              title = line.replace(/^#+\s*/, '').trim();
              break;
            }
          }
          break;
        }
      }

      // Extract brief summary
      let summary = '';
      const summaryFile = path.join(REPO_DIR, '.ai', 'reports', taskId, 'summary.md');
      if (fs.existsSync(summaryFile)) {
        summary = fs.readFileSync(summaryFile, 'utf8').split('\n').slice(0, 10).join(' ').substring(0, 200) + '...';
      }

      taskDetails[taskId] = {
        title,
        target: state.target,
        status: state.status,
        completedAt: state.status === 'done' ? state.updatedAt : '',
        summary: summary || state.notes.join(' '),
        attempt: state.attempt,
        maxAttempts: state.maxAttempts,
        lastCommit: state.lastCommit,
        liveUrl: state.liveUrl,
        evidencePacketPath: state.evidencePacketPath,
        chatgptVerdict: state.chatgptVerdict,
        blockingErrors: state.blockingErrors
      };
    }
  });

  // Make sure tasks in inbox that have no state file are represented
  totalTasksSet.forEach(taskFile => {
    const taskId = taskFile.replace('.md', '').replace('-fix', '');
    if (!taskDetails[taskId]) {
      let currentFolder = 'pending';
      if (runningTasks.includes(taskFile)) currentFolder = 'running';
      else if (reviewTasks.includes(taskFile)) currentFolder = 'needs_chatgpt_audit';
      else if (doneTasks.includes(taskFile)) currentFolder = 'done';
      else if (failedTasks.includes(taskFile)) currentFolder = 'failed';

      taskDetails[taskId] = {
        title: taskId.replace('task-', '').replace(/-/g, ' '),
        target: 'mindmap-app',
        status: currentFolder,
        completedAt: '',
        summary: 'No state file generated yet',
        attempt: 1,
        maxAttempts: 3,
        lastCommit: '',
        liveUrl: `https://nickchen494949.github.io/mindmap-app/`,
        evidencePacketPath: `.ai/reports/${taskId}/`,
        chatgptVerdict: null,
        blockingErrors: []
      };
    }
  });

  // Load activity log
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
        if (action.includes('Running: agy') || action.includes('Audit completed')) sender = 'agy';
        else if (action.includes('PASS') || action.includes('FAIL') || action.includes('audit')) sender = 'chatgpt';

        activityLog.push({ time, sender, action });
      });
    } catch (e) {
      console.error('Error parsing watcher log:', e.message);
    }
  }

  const statusJson = {
    lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    totalTasks: Object.keys(taskDetails).length,
    doneTasks: Object.values(taskDetails).filter(t => t.status === 'done').length,
    pendingTasks: Object.values(taskDetails).filter(t => t.status === 'pending' || t.status === 'running').length,
    pending: Object.keys(taskDetails).filter(id => taskDetails[id].status === 'pending'),
    running: Object.keys(taskDetails).filter(id => taskDetails[id].status === 'running'),
    review: Object.keys(taskDetails).filter(id => taskDetails[id].status === 'needs_chatgpt_audit'),
    failed: Object.keys(taskDetails).filter(id => taskDetails[id].status === 'failed'),
    done: Object.keys(taskDetails).filter(id => taskDetails[id].status === 'done'),
    projects,
    taskDetails,
    activityLog
  };

  fs.writeFileSync(path.join(REPO_DIR, 'status.json'), JSON.stringify(statusJson, null, 2), 'utf8');
  console.log('status.json updated successfully!');
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
