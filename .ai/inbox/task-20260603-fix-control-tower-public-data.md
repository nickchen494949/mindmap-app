target: mindmap-app

# Fix Task
Fix the Communication Control Tower dashboard showing zero tasks and missing watcher heartbeat even though the repository already has internal control tower data.

## Problem observed
Live dashboard shows:

- Total Tasks: 0
- No tasks found in workspace
- Watcher Heartbeat: STALE
- Last Seen: Never

But the repo contains internal data files:

- .ai/task-index.json
- .ai/heartbeat/watcher.json

So this is likely a dashboard data-source problem, not simply a watcher problem.

## Root cause to fix
The dashboard currently tries to fetch internal dot-folder paths from the live GitHub Pages site. Do not make the browser depend on dot-folder paths.

## Required fix
Create a public sanitized data mirror for the dashboard.

Generate this file at repo root:

```text
control-tower-data.json
```

The dashboard must use this as the primary source:

```text
control-tower-data.json
```

Keep internal .ai files for ChatGPT/GitHub audit, but do not rely on them as the primary live-page source.

## Public JSON shape
The public JSON should include only safe operational fields:

```json
{
  "generatedAt": "ISO timestamp",
  "watcher": {
    "status": "alive|stale|missing",
    "lastSeen": "ISO timestamp or null",
    "lastScannedCommit": "sha or null",
    "inboxCount": 0,
    "doneCount": 0,
    "failedCount": 0
  },
  "stats": {
    "total": 0,
    "pending": 0,
    "running": 0,
    "needsChatGPTAudit": 0,
    "done": 0,
    "failed": 0,
    "invalidDone": 0
  },
  "tasks": []
}
```

Each task item should include:

```json
{
  "taskId": "task-xxx",
  "target": "mindmap-app",
  "status": "inbox_unseen|running|needs_chatgpt_audit|blocked|failed|done|invalid_done",
  "location": "inbox|running|review|fix|done|failed",
  "evidenceExists": true,
  "chatgptVerdict": "PASS|FAIL|null",
  "lastCommit": "sha or null",
  "liveUrl": "url or null",
  "blockingIssues": []
}
```

## Logic requirements
1. If a task is in done but has no ChatGPT PASS audit, mark it as invalid_done, not done.
2. If watcher heartbeat exists internally, public data must expose the sanitized heartbeat.
3. If public data cannot load, dashboard should say data fetch failed, not watcher stale.
4. Dashboard should not show zero tasks when internal task index exists but public mirror was not generated.

## Dashboard requirements
Update dashboard.html:

- Fetch control-tower-data.json first.
- Use its stats/tasks/watcher fields.
- Show clear warnings for stale mirror, missing public data, invalid done, missing evidence, and tasks waiting for ChatGPT audit.
- Keep fallback to status.json only as legacy fallback.

## Watcher/helper requirements
After each watcher/helper run, generate and commit:

```text
control-tower-data.json
```

Also keep:

```text
.ai/task-index.json
```

for internal audit use.

## Preserve Gatekeeper v3
Do not weaken:

- target allowlist logic
- dangerous target blocking
- firewall fail to .ai/failed
- firewall pass to .ai/review
- needs_chatgpt_audit state

## Acceptance checks
1. control-tower-data.json exists at repo root.
2. Live dashboard shows non-zero tasks when tasks exist.
3. Live dashboard shows real watcher lastSeen from public data.
4. Live dashboard does not depend primarily on dot-folder fetches.
5. Done without ChatGPT PASS is flagged invalid_done.
6. Gatekeeper v3 protections remain intact.
7. Commit and push.
8. Move this task to review with evidence for ChatGPT audit.

## Final report
Write final report to:

```text
.ai/reports/task-20260603-fix-control-tower-public-data/final-report.md
```

Report:

```text
Implemented:
Files changed:
Public data path:
Dashboard data source:
Heartbeat result:
Task count result:
Commit SHA:
Known limitations:
```

If commit fails, write:

```text
No successful commit. Do not check watcher yet.
```