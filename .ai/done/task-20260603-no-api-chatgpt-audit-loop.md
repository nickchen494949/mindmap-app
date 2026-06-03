target: mindmap-app

# Task
Upgrade the ChatGPT → GitHub → Watcher → Antigravity pipeline into a no-API loop where ChatGPT is the final auditor.

## User command
The user wants no OpenAI API, no Claude API, and no external LLM API.

Important correction:
- Antigravity / agy should NOT be treated as the final judge.
- agy may run mechanical checks and collect evidence.
- ChatGPT must be the final auditor when the user asks ChatGPT to review the task.
- The system must make ChatGPT auditing easy by writing complete, machine-readable evidence files to GitHub.

## Hard constraints
- Do NOT use OpenAI API.
- Do NOT use Claude API.
- Do NOT add any external LLM API dependency.
- Do NOT require paid API keys.
- Do NOT automate ChatGPT web UI.
- Do NOT pretend ChatGPT can wake up in the background without API.
- Watcher must not guess task type.
- First line `target:` is the project routing source of truth.
- Watcher only routes tasks to the correct project / executor.
- agy reads the full task content and executes.
- ChatGPT does final audit by reading GitHub files/reports when the user calls ChatGPT back.

## Correct no-API architecture
Build this loop:

```text
User tells ChatGPT goal
→ ChatGPT writes task file to .ai/inbox/
→ watcher routes by target:
→ agy executes locally
→ agy commits/pushes code
→ agy runs mechanical evidence collection
→ agy writes audit packet to GitHub
→ agy marks task as NEEDS_CHATGPT_AUDIT, not done
→ user asks ChatGPT to audit, or opens ChatGPT with the task id
→ ChatGPT reads evidence packet + code + live URL
→ ChatGPT decides PASS / FAIL
→ if FAIL, ChatGPT writes a new fix task
→ agy executes fix
→ repeat until ChatGPT marks accepted
```

## State machine folders
Add or upgrade `.ai` workflow to support:

```text
.ai/inbox/        new tasks from ChatGPT/user
.ai/running/      tasks currently executing
.ai/reports/      evidence packets and final reports
.ai/review/       waiting for ChatGPT audit
.ai/fix/          fix tasks generated after ChatGPT audit fails
.ai/done/         accepted only after ChatGPT audit pass
.ai/failed/       failed after max attempts or unrecoverable error
.ai/state/        machine-readable task state JSON
```

## Critical rule: agy cannot mark final done
agy must not move a task to `.ai/done/` by itself for non-trivial code/web/data tasks.

Instead, after execution and evidence collection, agy must move task to:

```text
.ai/review/
```

and set state:

```json
{
  "status": "needs_chatgpt_audit"
}
```

Only after ChatGPT writes an acceptance file may the task be moved to `.ai/done/`.

## ChatGPT acceptance file
Define this file:

```text
.ai/reviews/<task-id>/chatgpt-audit.md
```

ChatGPT will write one of these verdicts:

```text
VERDICT: PASS
```

or

```text
VERDICT: FAIL
```

If FAIL, ChatGPT will include blocking issues and a fix task.

## Required task state file
Every task must have:

```text
.ai/state/<task-id>.json
```

Example:

```json
{
  "taskId": "task-20260603-example",
  "target": "us-macro-dashboard",
  "status": "needs_chatgpt_audit",
  "attempt": 1,
  "maxAttempts": 3,
  "startedAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "lastCommit": "commit SHA",
  "liveUrl": "https://...",
  "evidencePacketPath": ".ai/reports/<task-id>/",
  "chatgptAuditPath": null,
  "chatgptVerdict": null,
  "blockingErrors": [],
  "notes": []
}
```

## Evidence packet required for ChatGPT audit
For every non-trivial task, agy must write:

```text
.ai/reports/<task-id>/evidence.json
.ai/reports/<task-id>/summary.md
.ai/reports/<task-id>/changed-files.txt
.ai/reports/<task-id>/commit.txt
```

For web projects, also write:

```text
.ai/reports/<task-id>/live-audit.json
.ai/reports/<task-id>/page-text.txt
.ai/reports/<task-id>/screenshot.png
.ai/reports/<task-id>/console-errors.txt
.ai/reports/<task-id>/network-errors.txt
```

For data/dashboard projects, also write:

```text
.ai/reports/<task-id>/data-audit.json
.ai/reports/<task-id>/data-freshness.md
.ai/reports/<task-id>/data-source-status.md
```

## Evidence JSON shape
Use this shape:

```json
{
  "taskId": "...",
  "target": "...",
  "status": "needs_chatgpt_audit",
  "attempt": 1,
  "commitSha": "...",
  "liveUrl": "...",
  "changedFiles": [],
  "mechanicalChecks": {
    "buildPass": true,
    "livePageLoads": true,
    "consoleErrorCount": 0,
    "networkErrorCount": 0,
    "dataAuditPass": true
  },
  "knownRisks": [],
  "questionsForChatGPT": [],
  "screenshots": [".ai/reports/.../screenshot.png"],
  "pageTextPath": ".ai/reports/.../page-text.txt"
}
```

## Web evidence collection
Use Playwright or Puppeteer locally.

For a web project, collect:

- live URL status
- title
- visible page text
- screenshot
- console errors
- failed network requests
- main component counts
- whether page is 404
- whether page is blank
- whether page is stuck on Loading

## Data evidence collection
For macro/data dashboards, collect:

- real vs fallback vs stale per series
- latest date per series
- latest value per series
- unit per series
- obvious stale data flags
- obvious scale bugs
- UI text unit bugs

For `us-macro-dashboard`, explicitly detect and report:

- `RESBALNS` stale Aug 2020 bug
- `RESBALNS` showing around `0.003T` as if current
- ICSA text showing `209000k`
- missing Real FRED / Fallback / Stale badge
- fallback/mock data pretending to be real data

## Dashboard upgrade
Upgrade `dashboard.html` and `status.json` generation so the pipeline dashboard shows:

- pending
- running
- needs ChatGPT audit
- failed
- done
- latest commit SHA
- evidence packet link/path
- live URL
- retry/attempt count
- ChatGPT verdict if available
- blocking issues if failed

## Done definition
Final done means:

```text
agy execution complete
+ evidence packet exists
+ ChatGPT audit verdict = PASS
```

Without ChatGPT PASS, task is not done.

## No-API limitation must be documented
Update `.ai/PROJECT_CONTEXT.md` to clearly state:

```text
Without an LLM API, ChatGPT cannot wake itself in the background.
Therefore the no-API system works by making agy prepare evidence packets, then ChatGPT audits those packets when the user calls ChatGPT back.
```

## Test requirements
Create test flow examples:

### Test A: needs ChatGPT audit
A task completes mechanical checks and moves to `.ai/review/`, not `.ai/done/`.

### Test B: ChatGPT fail path
Simulate a ChatGPT audit FAIL file and confirm the system creates/accepts a fix task.

### Test C: ChatGPT pass path
Simulate a ChatGPT audit PASS file and confirm only then task moves to `.ai/done/`.

## Acceptance checks
Before final report:

1. Confirm no external LLM API was added.
2. Confirm agy cannot mark final done without ChatGPT PASS.
3. Confirm evidence packet is generated.
4. Confirm dashboard shows `needs_chatgpt_audit`.
5. Confirm state JSON tracks ChatGPT verdict.
6. Confirm fail verdict produces fix workflow.
7. Confirm pass verdict permits done.
8. Commit and push all changes.

## Final report
Write final report to:

```text
.ai/reports/task-20260603-no-api-chatgpt-audit-loop/final-report.md
```

Report exactly:

```text
Implemented:
Files changed:
No-API confirmation:
How ChatGPT audits:
Evidence packet paths:
Test A result:
Test B result:
Test C result:
Dashboard URL:
Commit SHA:
Known limitations:
```

If commit fails, write:

```text
No successful commit. Do not check watcher yet.
```