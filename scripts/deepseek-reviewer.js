const fs = require('fs');
const path = require('path');

// Basic manual .env.local parser to avoid installing dotenv
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      // Remove quotes
      value = value.replace(/(^['"]|['"]$)/g, '').trim();
      process.env[key] = value;
    }
  });
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

const repoDir = '/Users/happygolucky/mindmap-repo';
const aiDir = path.join(repoDir, '.ai');
const reportsDir = path.join(aiDir, 'reports');
const reviewDir = path.join(aiDir, 'review');

function readIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return null;
}

function truncateString(str, maxLength) {
  if (!str) return str;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '\n...[TRUNCATED]';
}

async function runReview(taskId) {
  console.log(`[DeepSeek Reviewer] Starting review for task: ${taskId}`);

  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set in the environment. Aborting.');
    process.exit(1);
  }

  // 1. Gather task file
  let taskFile = path.join(reviewDir, `${taskId}.md`);
  if (!fs.existsSync(taskFile)) {
    taskFile = path.join(reviewDir, `${taskId}-fix.md`); // Try fix suffix
  }
  
  if (!fs.existsSync(taskFile)) {
    console.error(`[DeepSeek Reviewer] Task file not found in review for ${taskId}`);
    process.exit(1);
  }
  
  const taskContent = fs.readFileSync(taskFile, 'utf8');

  // 2. Gather evidence files
  const reportDir = path.join(reportsDir, taskId);
  if (!fs.existsSync(reportDir)) {
    console.error(`[DeepSeek Reviewer] Evidence directory not found: ${reportDir}`);
    process.exit(1);
  }

  const evidenceJsonStr = readIfExists(path.join(reportDir, 'evidence.json'));
  const summaryMd = readIfExists(path.join(reportDir, 'summary.md'));
  const changedFiles = readIfExists(path.join(reportDir, 'changed-files.txt'));
  const consoleErrors = readIfExists(path.join(reportDir, 'console-errors.txt'));
  const networkErrors = readIfExists(path.join(reportDir, 'network-errors.txt'));
  const pageText = readIfExists(path.join(reportDir, 'page-text.txt'));
  
  if (!evidenceJsonStr) {
    console.error(`[DeepSeek Reviewer] Missing evidence.json in ${reportDir}`);
    process.exit(1);
  }

  let evidenceData;
  try {
    evidenceData = JSON.parse(evidenceJsonStr);
  } catch (e) {
    console.error(`[DeepSeek Reviewer] Failed to parse evidence.json: ${e.message}`);
    process.exit(1);
  }

  // 3. Construct prompt
  const systemPrompt = `You are an automated code and pipeline reviewer. Your job is to audit a completed task based on its evidence packet and output a strict JSON verdict.

RULES:
1. You must output valid JSON ONLY, using the exact schema provided.
2. The user has provided the original task description and the evidence of execution.
3. If the task failed to fulfill its acceptance criteria, or if there are critical errors in the console/network logs, you must FAIL the task.
4. If it succeeded and the evidence supports it, you must PASS the task.
5. If the evidence is missing crucial pieces or you cannot determine success, you may output UNCERTAIN.
6. If you output FAIL, you MUST provide a \`fix_task\` property containing a markdown description of the fix task to be executed.
7. Be strict. Do not accept incomplete work.

SCHEMA:
{
  "verdict": "PASS|FAIL|UNCERTAIN",
  "confidence": 0.0 to 1.0,
  "blocking_issues": ["Issue 1", "Issue 2"], // required if FAIL or UNCERTAIN
  "non_blocking_notes": ["Note 1"],
  "fix_task": "target: mindmap-app\\n\\n# Fix Task\\n..." // required if FAIL
}`;

  const userPrompt = `TASK DESCRIPTION:
\`\`\`markdown
${taskContent}
\`\`\`

---
EXECUTION SUMMARY:
\`\`\`markdown
${truncateString(summaryMd, 5000) || 'None provided'}
\`\`\`

---
CHANGED FILES:
\`\`\`text
${truncateString(changedFiles, 2000) || 'None provided'}
\`\`\`

---
CONSOLE ERRORS:
\`\`\`text
${truncateString(consoleErrors, 5000) || 'None'}
\`\`\`

---
NETWORK ERRORS:
\`\`\`text
${truncateString(networkErrors, 5000) || 'None'}
\`\`\`

---
EXTRACTED PAGE TEXT (For QA checks):
\`\`\`text
${truncateString(pageText, 10000) || 'None'}
\`\`\`

---
EVIDENCE JSON METADATA:
\`\`\`json
${JSON.stringify(evidenceData, null, 2)}
\`\`\`

Evaluate this evidence against the task description. Output strict JSON only.`;

  console.log(`[DeepSeek Reviewer] Prompt constructed. Sending to API...`);

  // 4. Call API
  let responseText = '';
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    responseText = data.choices[0].message.content;
    console.log(`[DeepSeek Reviewer] API responded successfully.`);
  } catch (e) {
    console.error(`[DeepSeek Reviewer] API Error: ${e.message}`);
    process.exit(1);
  }

  // 5. Parse and Write JSON
  let verdictObj = null;
  try {
    verdictObj = JSON.parse(responseText);
  } catch (e) {
    console.error(`[DeepSeek Reviewer] Failed to parse JSON from API: ${responseText}`);
    verdictObj = {
      verdict: 'UNCERTAIN',
      confidence: 0,
      blocking_issues: ['DeepSeek API returned invalid JSON. Cannot parse verdict.'],
      non_blocking_notes: [],
      fix_task: null
    };
  }

  // Fallback structural checks
  if (!['PASS', 'FAIL', 'UNCERTAIN'].includes(verdictObj.verdict)) {
    verdictObj.verdict = 'UNCERTAIN';
    verdictObj.blocking_issues = verdictObj.blocking_issues || [];
    verdictObj.blocking_issues.push('API returned invalid verdict string.');
  }

  const reviewTaskDir = path.join(reviewDir, taskId);
  if (!fs.existsSync(reviewTaskDir)) {
    fs.mkdirSync(reviewTaskDir, { recursive: true });
  }

  const jsonOutputPath = path.join(reviewTaskDir, 'deepseek-audit.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(verdictObj, null, 2), 'utf8');
  console.log(`[DeepSeek Reviewer] Saved JSON verdict to ${jsonOutputPath}`);

  // 6. Convert to standard markdown format for backward compatibility
  const mdOutputPath = path.join(reviewTaskDir, 'chatgpt-audit.md');
  let mdContent = `VERDICT: ${verdictObj.verdict}\n\n`;
  
  if (verdictObj.blocking_issues && verdictObj.blocking_issues.length > 0) {
    mdContent += `Blocking issues:\n`;
    verdictObj.blocking_issues.forEach(issue => {
      mdContent += `- ${issue}\n`;
    });
    mdContent += `\n`;
  }
  
  if (verdictObj.non_blocking_notes && verdictObj.non_blocking_notes.length > 0) {
    mdContent += `Notes:\n`;
    verdictObj.non_blocking_notes.forEach(note => {
      mdContent += `- ${note}\n`;
    });
    mdContent += `\n`;
  }

  if (verdictObj.fix_task) {
    mdContent += `\n# Suggested Fix Task\n\`\`\`markdown\n${verdictObj.fix_task}\n\`\`\`\n`;
    // We optionally can let the watcher parse this fix_task field from the JSON directly later.
  }

  mdContent += `\nConfidence: ${verdictObj.confidence}\nReviewed by DeepSeek API.\n`;
  
  fs.writeFileSync(mdOutputPath, mdContent, 'utf8');
  console.log(`[DeepSeek Reviewer] Saved Markdown verdict to ${mdOutputPath}`);
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node deepseek-reviewer.js <taskId>");
  process.exit(1);
}

const taskIdArg = args[0];
runReview(taskIdArg).catch(err => {
  console.error(`[DeepSeek Reviewer] Unhandled error:`, err);
  process.exit(1);
});
