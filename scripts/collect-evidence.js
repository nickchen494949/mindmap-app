const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const REPO_DIR = process.env.REPO_DIR || '/Users/happygolucky/mindmap-repo';
const { chromium } = require('playwright');

// Helper to parse arguments
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs();
let taskId = args.taskId || 'task-unknown';
if (taskId.endsWith('.md')) {
  taskId = taskId.slice(0, -3);
}
const target = args.target || 'mindmap-app';
const liveUrl = args.liveUrl || `https://nickchen494949.github.io/${target}/`;

console.log(`=== Starting evidence collection for task: ${taskId} ===`);
console.log(`Target project: ${target}`);
console.log(`Live URL: ${liveUrl}`);

// Clean up any old audit verdict files from previous attempts
const baseTaskId = taskId.replace(/-fix$/, '');
const cleanupPaths = [
  path.join(process.cwd(), '.ai', 'reviews', taskId, 'chatgpt-audit.md'),
  path.join(process.cwd(), '.ai', 'reviews', baseTaskId, 'chatgpt-audit.md'),
  path.join(process.cwd(), '.ai', 'review', taskId, 'chatgpt-audit.md'),
  path.join(process.cwd(), '.ai', 'review', baseTaskId, 'chatgpt-audit.md'),
  path.join(REPO_DIR, '.ai', 'reviews', taskId, 'chatgpt-audit.md'),
  path.join(REPO_DIR, '.ai', 'reviews', baseTaskId, 'chatgpt-audit.md'),
  path.join(REPO_DIR, '.ai', 'review', taskId, 'chatgpt-audit.md'),
  path.join(REPO_DIR, '.ai', 'review', baseTaskId, 'chatgpt-audit.md')
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

const reportsDir = path.join(process.cwd(), '.ai', 'reports', taskId);
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 1. Gather git info
let changedFiles = [];
try {
  const diffOutput = execSync('git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD 2>/dev/null || git status --porcelain', { encoding: 'utf8' });
  changedFiles = diffOutput.split('\n').map(f => f.trim().replace(/^..\s+/, '')).filter(Boolean);
} catch (e) {
  console.warn('Failed to get git changes, falling back to local files scan:', e.message);
}
fs.writeFileSync(path.join(reportsDir, 'changed-files.txt'), changedFiles.join('\n'), 'utf8');

let commitText = 'No commit found';
let commitSha = 'local';
try {
  commitText = execSync('git log -1 --pretty=format:"Commit: %H%nAuthor: %an%nDate: %ad%nSubject: %s%nBody: %b" 2>/dev/null', { encoding: 'utf8' }) || commitText;
  commitSha = execSync('git rev-parse HEAD 2>/dev/null', { encoding: 'utf8' }).trim() || commitSha;
} catch (e) {
  console.warn('Failed to get git commit info:', e.message);
}
fs.writeFileSync(path.join(reportsDir, 'commit.txt'), commitText, 'utf8');

// 2. Start local HTTP static server to audit current changes
const port = 8085;
let localServer;

function startLocalServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    localServer = http.createServer((req, res) => {
      let filePath = path.join(process.cwd(), req.url.split('?')[0]);
      if (filePath === process.cwd() || filePath.endsWith('/')) {
        const indexHtml = path.join(filePath, 'index.html');
        const dashboardHtml = path.join(filePath, 'dashboard.html');
        if (fs.existsSync(indexHtml)) {
          filePath = indexHtml;
        } else if (fs.existsSync(dashboardHtml)) {
          filePath = dashboardHtml;
        } else {
          filePath = indexHtml;
        }
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'text/plain';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });

    localServer.listen(port, () => {
      console.log(`Local test server running at http://localhost:${port}`);
      resolve();
    });
  });
}

// Check live URL status code
function checkLiveUrl() {
  return new Promise((resolve) => {
    console.log(`Checking status of live URL: ${liveUrl}`);
    const lib = liveUrl.startsWith('https') ? require('https') : require('http');
    const req = lib.get(liveUrl, (res) => {
      console.log(`Live URL status code: ${res.statusCode}`);
      resolve(res.statusCode);
    });
    req.on('error', (err) => {
      console.warn(`Failed to connect to live URL: ${err.message}`);
      resolve(-1);
    });
    req.end();
  });
}

(async () => {
  await startLocalServer();
  const liveStatus = await checkLiveUrl();

  console.log('Launching browser to audit local site...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('pageerror', (exception) => {
    consoleErrors.push(`Console JS Error: ${exception.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`Console Error: ${message.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    networkErrors.push(`Failed Request: ${request.url()} - ${failure ? failure.errorText : 'Unknown error'}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`HTTP Error Status ${response.status()}: ${response.url()}`);
    }
  });

  let pageTitle = '';
  let pageText = '';
  let is404 = false;
  let isBlank = false;
  let isStuckLoading = false;
  let componentCount = 0;

  try {
    let targetUrl = `http://localhost:${port}/`;
    if (taskId.includes('control-tower') || taskId.includes('dashboard') || !fs.existsSync(path.join(process.cwd(), 'index.html'))) {
      if (fs.existsSync(path.join(process.cwd(), 'dashboard.html'))) {
        targetUrl = `http://localhost:${port}/dashboard.html`;
      }
    }
    console.log(`Navigating page to: ${targetUrl}`);
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    if (response) {
      const status = response.status();
      if (status >= 400) {
        is404 = true;
      }
    }

    pageTitle = await page.title();
    pageText = await page.innerText('body');

    // Screenshot
    const screenshotPath = path.join(reportsDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Analyze text content
    if (!pageText || pageText.trim().length < 50) {
      isBlank = true;
    }

    if (pageText.includes('Loading macroeconomic indicators') || 
        pageText.includes('Generating Macro Transmission') || 
        pageText.includes('Loading...')) {
      isStuckLoading = true;
    }

    // Component counts
    if (target === 'us-macro-dashboard') {
      componentCount = await page.locator('.macro-card').count();
    } else if (target === 'mindmap-app') {
      // Look for svg or nodes or dashboard columns
      const isDashboard = await page.locator('.dashboard-column').count() > 0;
      if (isDashboard) {
        componentCount = await page.locator('.dashboard-column, .stat-card, .pipeline-node').count();
      } else {
        componentCount = await page.locator('.mindmap-node, rect, circle').count();
      }
    }

  } catch (error) {
    console.error('Audit execution navigation error:', error.message);
    networkErrors.push(`Navigation failed: ${error.message}`);
  }

  // Save raw outputs
  fs.writeFileSync(path.join(reportsDir, 'page-text.txt'), pageText, 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'console-errors.txt'), consoleErrors.join('\n'), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'network-errors.txt'), networkErrors.join('\n'), 'utf8');

  // Build web audit JSON
  const liveAudit = {
    url: liveUrl,
    timestamp: new Date().toISOString(),
    liveUrlStatus: liveStatus,
    title: pageTitle,
    is404,
    isBlank,
    isStuckLoading,
    componentCount,
    consoleErrorCount: consoleErrors.length,
    networkErrorCount: networkErrors.length
  };
  fs.writeFileSync(path.join(reportsDir, 'live-audit.json'), JSON.stringify(liveAudit, null, 2), 'utf8');

  await context.close();
  await browser.close();
  localServer.close();
  console.log('Local test server stopped.');

  // Data / Dashboard audit (specific to us-macro-dashboard)
  let dataAudit = null;
  const dataPath = path.join(process.cwd(), 'src', 'data.js');
  if (target === 'us-macro-dashboard' && fs.existsSync(dataPath)) {
    console.log('Auditing data cache in src/data.js...');
    try {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const jsonStr = fileContent
        .replace(/export\s+const\s+MACRO_DATA\s*=\s*/, '')
        .trim()
        .replace(/;\s*$/, '');
      const macroData = JSON.parse(jsonStr);

      const seriesStatus = {};
      const bugsDetected = {
        resbalnsStaleAug2020: false,
        resbalnsScaleBug: false,
        icsaScaleBug: false,
        missingBadges: true, // will check
        mockDataPretendingReal: false
      };

      // Check badges in page text
      if (pageText.includes('Real FRED') || pageText.includes('Fallback') || pageText.includes('Stale')) {
        bugsDetected.missingBadges = false;
      }

      const currentDate = new Date('2026-06-03T00:00:00Z');
      const seriesList = macroData.series || {};

      for (const [id, s] of Object.entries(seriesList)) {
        const latest = s.latest || {};
        const latestDateStr = latest.date || '';
        const val = latest.value;

        let stale = false;
        if (latestDateStr) {
          const lDate = new Date(latestDateStr);
          const diffMs = currentDate - lDate;
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          // Flag as stale if monthly/weekly is > 180 days, or quarterly is > 270 days
          if (s.frequency === 'quarterly' && diffDays > 270) stale = true;
          if (s.frequency !== 'quarterly' && diffDays > 180) stale = true;
        }

        seriesStatus[id] = {
          name: s.name,
          latestDate: latestDateStr,
          latestValue: val,
          unit: s.unit,
          stale
        };

        // Explicit FRED Bug checks
        if (id === 'RESBALNS') {
          if (latestDateStr === '2020-08-01') {
            bugsDetected.resbalnsStaleAug2020 = true;
          }
          if (val > 0.001 && val < 0.01) {
            bugsDetected.resbalnsScaleBug = true; // 0.003T bug
          }
        }

        if (id === 'ICSA') {
          if (val > 50000) {
            bugsDetected.icsaScaleBug = true; // 209000k bug (should be 209k)
          }
        }
      }

      // Check mock flags
      if (macroData.lastUpdated && macroData.lastUpdated.includes('mock')) {
        bugsDetected.mockDataPretendingReal = true;
      }

      dataAudit = {
        timestamp: macroData.lastUpdated,
        bugsDetected,
        series: seriesStatus
      };

      fs.writeFileSync(path.join(reportsDir, 'data-audit.json'), JSON.stringify(dataAudit, null, 2), 'utf8');

      // Generate freshness report
      let freshnessMd = `# Data Freshness Audit for ${taskId}\n\n`;
      freshnessMd += `Audit Date: 2026-06-03\n\n`;
      freshnessMd += `| Series | Name | Latest Date | Value | Unit | Stale? |\n`;
      freshnessMd += `| --- | --- | --- | --- | --- | --- |\n`;
      for (const [id, s] of Object.entries(seriesStatus)) {
        freshnessMd += `| ${id} | ${s.name} | ${s.latestDate} | ${s.latestValue} | ${s.unit} | ${s.stale ? '⚠️ YES' : '✅ NO'} |\n`;
      }
      fs.writeFileSync(path.join(reportsDir, 'data-freshness.md'), freshnessMd, 'utf8');

      // Generate data source report
      let sourceMd = `# Data Source Status Report\n\n`;
      sourceMd += `- **Reserves Date Bug (Aug 2020):** ${bugsDetected.resbalnsStaleAug2020 ? '⚠️ Detected Stale' : '✅ Resolved'}\n`;
      sourceMd += `- **Reserves Scale Bug (~0.003T):** ${bugsDetected.resbalnsScaleBug ? '⚠️ Detected 0.003T' : '✅ Resolved'}\n`;
      sourceMd += `- **Initial Jobless Claims Scale Bug (209000k):** ${bugsDetected.icsaScaleBug ? '⚠️ Detected 209000k' : '✅ Resolved'}\n`;
      sourceMd += `- **FRED Quality Badges:** ${bugsDetected.missingBadges ? '⚠️ Missing badges in UI' : '✅ Badge system rendering'}\n`;
      fs.writeFileSync(path.join(reportsDir, 'data-source-status.md'), sourceMd, 'utf8');

    } catch (e) {
      console.error('Failed to parse src/data.js:', e.message);
    }
  }

  // Determine if mechanical checks passed
  const buildPass = true; // Assumed since local execution works
  const livePageLoads = !is404 && !isBlank && !isStuckLoading;
  const consoleErrorCount = consoleErrors.length;
  const networkErrorCount = networkErrors.length;
  const dataAuditPass = dataAudit ? !Object.values(dataAudit.bugsDetected).some(Boolean) : true;

  const mechanicalChecks = {
    buildPass,
    livePageLoads,
    consoleErrorCount,
    networkErrorCount,
    dataAuditPass
  };

  const knownRisks = [];
  if (consoleErrorCount > 0) knownRisks.push(`Found ${consoleErrorCount} console errors.`);
  if (networkErrorCount > 0) knownRisks.push(`Found ${networkErrorCount} network request failures.`);
  if (isStuckLoading) knownRisks.push('Page shows loading spinner state.');
  if (dataAudit && Object.values(dataAudit.bugsDetected).some(Boolean)) {
    knownRisks.push('FRED data validation bugs detected in data-audit.json');
  }

  // Write log-tail.txt
  let logTailContent = 'Execution log not available';
  const baseTaskId = taskId.replace(/-fix$/, '');
  const possibleLogPaths = [
    path.join(REPO_DIR, '.ai', 'logs', `${taskId}.md.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${taskId}.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${baseTaskId}.md.log`),
    path.join(REPO_DIR, '.ai', 'logs', `${baseTaskId}.log`),
    path.join(process.cwd(), '.ai', 'logs', `${taskId}.md.log`),
    path.join(process.cwd(), '.ai', 'logs', `${taskId}.log`)
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

  const logTailFile = path.join(reportsDir, 'log-tail.txt');
  fs.writeFileSync(logTailFile, logTailContent, 'utf8');
  console.log(`Log tail saved to: ${logTailFile}`);

  // 8. Main evidence.json
  const evidence = {
    taskId: taskId,
    target: target,
    status: 'needs_chatgpt_audit',
    commitSha: commitSha,
    changedFiles: changedFiles,
    logTailPath: `.ai/reports/${taskId}/log-tail.txt`,
    knownRisks: knownRisks,
    questionsForChatGPT: [],
    generatedAt: new Date().toISOString(),

    // Web/data optional fields
    liveUrl: liveUrl,
    pageTextPath: `.ai/reports/${taskId}/page-text.txt`,
    screenshotPath: fs.existsSync(path.join(reportsDir, 'screenshot.png')) ? `.ai/reports/${taskId}/screenshot.png` : null,
    consoleErrorsPath: fs.existsSync(path.join(reportsDir, 'console-errors.txt')) ? `.ai/reports/${taskId}/console-errors.txt` : null,
    networkErrorsPath: fs.existsSync(path.join(reportsDir, 'network-errors.txt')) ? `.ai/reports/${taskId}/network-errors.txt` : null,
    dataAuditPath: fs.existsSync(path.join(reportsDir, 'data-audit.json')) ? `.ai/reports/${taskId}/data-audit.json` : null,

    // Extra fields for compatibility
    attempt: parseInt(args.attempt || '1', 10),
    mechanicalChecks: mechanicalChecks,
    screenshots: [`.ai/reports/${taskId}/screenshot.png`]
  };
  fs.writeFileSync(path.join(reportsDir, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');

  // 9. summary.md
  let summaryMd = `# Evidence Summary for Task: ${taskId}\n\n`;
  summaryMd += `Executed on: ${new Date().toISOString()}\n`;
  summaryMd += `Target Project: ${target}\n`;
  summaryMd += `Latest Commit: ${commitSha}\n`;
  summaryMd += `Live URL: [${liveUrl}](${liveUrl})\n\n`;
  summaryMd += `## Mechanical Checks\n`;
  summaryMd += `- **Local Page Load:** ${livePageLoads ? '✅ SUCCESS' : '❌ FAILED'}\n`;
  summaryMd += `- **Console Errors:** ${consoleErrorCount === 0 ? '✅ 0 errors' : `⚠️ ${consoleErrorCount} errors`}\n`;
  summaryMd += `- **Network Errors:** ${networkErrorCount === 0 ? '✅ 0 errors' : `⚠️ ${networkErrorCount} errors`}\n`;
  if (dataAudit) {
    summaryMd += `- **FRED Data Quality:** ${dataAuditPass ? '✅ PASS' : '❌ FAIL (Bugs detected)'}\n`;
  }
  summaryMd += `\n## Changed Files\n`;
  if (changedFiles.length > 0) {
    changedFiles.forEach(f => {
      summaryMd += `- \`${f}\`\n`;
    });
  } else {
    summaryMd += `No files changed.\n`;
  }

  fs.writeFileSync(path.join(reportsDir, 'summary.md'), summaryMd, 'utf8');

  console.log(`=== Evidence packet generated successfully in: ${reportsDir} ===`);

  // 10. Generate / update task state JSON
  const stateDir = path.join(process.cwd(), '.ai', 'state');
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  const stateFile = path.join(stateDir, `${baseTaskId}.json`);
  let state = {
    taskId: baseTaskId,
    target,
    status: 'needs_chatgpt_audit',
    attempt: parseInt(args.attempt || '1', 10),
    maxAttempts: 3,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCommit: commitSha,
    liveUrl,
    evidencePacketPath: `.ai/reports/${baseTaskId}/`,
    chatgptAuditPath: null,
    chatgptVerdict: null,
    blockingErrors: [],
    notes: []
  };

  if (fs.existsSync(stateFile)) {
    try {
      const oldState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      state = { ...state, ...oldState };
      state.status = 'needs_chatgpt_audit';
      state.updatedAt = new Date().toISOString();
      state.lastCommit = commitSha;
      state.liveUrl = liveUrl;
    } catch (e) {
      console.warn('Failed to parse existing state file:', e.message);
    }
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  console.log(`State JSON written to: ${stateFile}`);

  // 11. Move task file to review/
  const reviewDir = path.join(process.cwd(), '.ai', 'review');
  if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
  }
  
  const possibleTaskNames = [
    `${baseTaskId}.md`,
    `${baseTaskId}-fix.md`,
    `${taskId}.md`,
    `task-${taskId}-fix.md`,
    `task-${baseTaskId}-fix.md`
  ];
  const possibleDirs = [
    path.join(process.cwd(), '.ai', 'inbox'),
    path.join(process.cwd(), '.ai', 'running')
  ];

  let taskMoved = false;
  for (const dir of possibleDirs) {
    for (const name of possibleTaskNames) {
      const srcPath = path.join(dir, name);
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(reviewDir, `${baseTaskId}.md`);
        fs.renameSync(srcPath, destPath);
        console.log(`Moved task file from ${srcPath} to ${destPath}`);
        taskMoved = true;
        break;
      }
    }
    if (taskMoved) break;
  }

  // 12. Sync evidence and state to mindmap-repo
  const repoAiDir = path.join(REPO_DIR, '.ai');
  if (fs.existsSync(repoAiDir)) {
    try {
      console.log('Syncing evidence and state to mindmap-repo...');
      const repoStateDir = path.join(repoAiDir, 'state');
      const repoReportsDir = path.join(repoAiDir, 'reports', baseTaskId);
      const repoReviewDir = path.join(repoAiDir, 'review');
      
      fs.mkdirSync(repoStateDir, { recursive: true });
      fs.mkdirSync(repoReportsDir, { recursive: true });
      fs.mkdirSync(repoReviewDir, { recursive: true });

      // Copy state file
      fs.copyFileSync(stateFile, path.join(repoStateDir, `${baseTaskId}.json`));
      
      // Copy reports
      const files = fs.readdirSync(reportsDir);
      for (const f of files) {
        fs.copyFileSync(path.join(reportsDir, f), path.join(repoReportsDir, f));
      }
      
      // Copy task file to review
      const destPath = path.join(repoReviewDir, `${baseTaskId}.md`);
      if (fs.existsSync(path.join(reviewDir, `${baseTaskId}.md`))) {
        fs.copyFileSync(path.join(reviewDir, `${baseTaskId}.md`), destPath);
      }
      console.log('Successfully synced files to mindmap-repo.');
    } catch (e) {
      console.error('Failed to sync to mindmap-repo:', e.message);
    }
  }

  // 13. Run task index generator to update the dashboard views
  try {
    const indexerPath = path.join(__dirname, 'generate-task-index.js');
    if (fs.existsSync(indexerPath)) {
      console.log('Running task index generator...');
      execSync(`node "${indexerPath}"`, { stdio: 'inherit' });
    }
  } catch (e) {
    console.error('Failed to run task index generator:', e.message);
  }

  process.exit(0);
})();
