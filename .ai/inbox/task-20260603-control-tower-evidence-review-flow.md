target: mindmap-app

# Task
Upgrade the pipeline after Gatekeeper v3: dashboard control tower + evidence packet + ChatGPT PASS/FAIL review flow.

## Context
Gatekeeper v3 is accepted for commit safety:
- unknown target is blocked unless `allow_new_project: true`
- dangerous target names are blocked
- `target: mindmap-app` routes to `$REPO_DIR`
- firewall failure goes to `.ai/failed/`
- firewall pass goes to `.ai/review/` with `status: needs_chatgpt_audit`

Now finish the remaining workflow gap: make the dashboard and evidence/review system good enough so ChatGPT can audit without the user acting as messenger.

## Hard rules
- Do NOT use OpenAI API.
- Do NOT use Claude API.
- Do NOT add any external LLM API dependency.
- Do NOT automate ChatGPT web UI.
- Do NOT weaken Gatekeeper v3.
- Do NOT allow agy to move non-trivial tasks directly to `.ai/done/`.
- Keep `target:` as the first-line routing source of truth.

## Main goal
Turn the current dashboard from a simple done/pending board into a communication control tower.

It must answer:

```text
Did ChatGPT create the task?
Did watcher see it?
Did agy run it?
Did firewall pass or block it?
Is it waiting for ChatGPT audit?
Is there evidence for ChatGPT to review?
Did ChatGPT PASS or FAIL it?
Where is it stuck?
```

## Required work A — task index / control tower data
Create or upgrade a scanner that generates:

```text
.ai/task-index.json
```

The scanner must inspect real GitHub repo files/folders, not rely only on old `status.json`.

It must scan:

```text
.ai/inbox
.ai/running
.ai/review
.ai/fix
.ai/done
.ai/failed
.ai/state
.ai/reports
.ai/reviews
.ai/heartbeat
```

Each task entry should include:

```json
{
  "taskId": "task-xxx",
  "target": "mindmap-app",
  "location": "inbox|running|review|fix|done|failed",
  "status": "inbox_unseen|running|needs_chatgpt_audit|blocked|failed|done|unknown",
  "statePath": ".ai/state/task-xxx.json",
  "evidencePath": ".ai/reports/task-xxx/evidence.json",
  "chatgptAuditPath": ".ai/reviews/task-xxx/chatgpt-audit.md",
  "chatgptVerdict": "PASS|FAIL|null",
  "lastCommit": "commit sha or null",
  "liveUrl": "url or null",
  "blockingIssues": []
}
```

## Required work B — dashboard control tower UI
Upgrade `dashboard.html` to show these columns/sections:

1. Inbox / unseen
2. Running
3. Needs ChatGPT audit
4. Failed / blocked
5. Done after ChatGPT PASS
6. Heartbeat status
7. Evidence status
8. Latest commit SHA
9. Blocking issue

Dashboard must clearly show red flags:

```text
- task exists in inbox but no state file
- task in review but no evidence packet
- task in done but no ChatGPT PASS
- watcher heartbeat stale
- agy heartbeat missing/stale if available
- firewall blocked task
- unknown target blocked
```

Important: dashboard must not only read `status.json`. It should prefer `.ai/task-index.json`.

## Required work C — evidence packet
When a task reaches `.ai/review/`, create an evidence folder:

```text
.ai/reports/<task-id>/
```

At minimum write:

```text
.ai/reports/<task-id>/evidence.json
.ai/reports/<task-id>/summary.md
.ai/reports/<task-id>/changed-files.txt
.ai/reports/<task-id>/commit.txt
.ai/reports/<task-id>/log-tail.txt
```

Evidence JSON shape:

```json
{
  "taskId": "task-xxx",
  "target": "mindmap-app",
  "status": "needs_chatgpt_audit",
  "commitSha": "...",
  "changedFiles": [],
  "logTailPath": ".ai/reports/.../log-tail.txt",
  "knownRisks": [],
  "questionsForChatGPT": [],
  "generatedAt": "ISO timestamp"
}
```

For web/data projects, include optional fields when available:

```json
{
  "liveUrl": "...",
  "pageTextPath": "...",
  "screenshotPath": "...",
  "consoleErrorsPath": "...",
  "dataAuditPath": "..."
}
```

Do not fake evidence. If unavailable, explicitly write `null` or `not_available`.

## Required work D — ChatGPT PASS/FAIL review processor
Add support for ChatGPT audit files:

```text
.ai/reviews/<task-id>/chatgpt-audit.md
```

Format:

```text
VERDICT: PASS
```

or:

```text
VERDICT: FAIL

Blocking issues:
- issue 1
- issue 2
```

Watcher/helper script must process review files:

- If `VERDICT: PASS`, move task from `.ai/review/` to `.ai/done/`, update state to `done`, keep audit file, and update task-index.
- If `VERDICT: FAIL`, create a new fix task in `.ai/inbox/` or `.ai/fix/`, update original state to `failed_review`, keep audit file, and do NOT move to done.

Fix task must start with:

```text
target: <same target>
```

and must include the blocking issues from ChatGPT.

## Required work E — status.json compatibility
Keep `status.json` for backward compatibility, but update it to include:

```json
{
  "pendingTasks": 0,
  "runningTasks": 0,
  "reviewTasks": 0,
  "failedTasks": 0,
  "doneTasks": 0,
  "needsChatGPTAudit": [],
  "blocked": [],
  "heartbeat": {}
}
```

Do not let `status.json` say everything is done when `.ai/review/` has tasks waiting for ChatGPT audit.

## Required test cases
Create lightweight test artifacts or test script to prove:

### Test 1 — inbox visibility
A task in `.ai/inbox/` appears in dashboard/task-index even before watcher processes it.

### Test 2 — review gate
A task in `.ai/review/` appears as `needs_chatgpt_audit`, not done.

### Test 3 — PASS flow
A fake `chatgpt-audit.md` with `VERDICT: PASS` moves review task to done.

### Test 4 — FAIL flow
A fake `chatgpt-audit.md` with `VERDICT: FAIL` creates a fix task and does not mark done.

### Test 5 — invalid done red flag
If a task is in done without ChatGPT PASS, dashboard/task-index marks it as invalid done.

## Acceptance checks
Before final report:

1. `scripts/run-ai-inbox.sh` still has Gatekeeper v3 protections.
2. Unknown target still blocked unless `allow_new_project: true`.
3. Firewall fail still goes to `.ai/failed/`.
4. Firewall pass still goes to `.ai/review/`.
5. `.ai/task-index.json` is generated.
6. Dashboard reads `.ai/task-index.json` or equivalent control tower data.
7. Evidence packet is generated for tasks in review.
8. ChatGPT PASS moves task to done.
9. ChatGPT FAIL creates fix task and blocks done.
10. Commit and push.

## Final report
Write final report to:

```text
.ai/reports/task-20260603-control-tower-evidence-review-flow/final-report.md
```

Report exactly:

```text
Implemented:
Files changed:
Gatekeeper v3 preserved: yes/no
Task index path:
Dashboard URL:
Evidence packet example:
PASS flow test result:
FAIL flow test result:
Commit SHA:
Known limitations:
```

If commit fails, write:

```text
No successful commit. Do not check watcher yet.
```