# Task: Upgrade dashboard to Communication Control Tower
target: mindmap-app

## Goal
The dashboard must supervise both sides:
- ChatGPT task creation side
- Watcher / Antigravity execution side

## Required

### 1. Generate .ai/task-index.json
Add a script `scripts/generate-task-index.sh` that scans real files and generates `.ai/task-index.json`:

Scan these directories:
- .ai/inbox
- .ai/done
- .ai/failed
- .ai/reports
- .ai/heartbeat

For each task file found, record:
- taskId
- target (from target: field)
- fileExistsInInbox (bool)
- markedDone (bool - exists in .ai/done/)
- evidenceExists (bool - exists in .ai/reports/)
- status: one of inbox_unseen, seen, running, needs_audit, done, failed

The watcher must call this script at the end of every run.

### 2. Add heartbeat files
The watcher must write `.ai/heartbeat/watcher.json` on every run:
```json
{
  "name": "watcher",
  "lastSeen": "ISO timestamp",
  "lastScannedCommit": "git SHA",
  "inboxCount": number,
  "doneCount": number,
  "status": "alive"
}
```

### 3. Upgrade dashboard.html
Replace the current dashboard.html with a control tower that reads:
- status.json (existing)
- .ai/task-index.json (new)
- .ai/heartbeat/watcher.json (new)

Dashboard must show for EACH task:
1. ✅/❌ Task exists in GitHub
2. ✅/❌ Watcher saw it
3. ✅/❌ Agy executed it
4. ✅/❌ Evidence/report exists
5. ✅/❌ Marked done
6. Blocking issue (if any)

### 4. Red flag alerts
Dashboard auto-shows red warnings:
- Task in inbox > 5 min but not seen → "Watcher 没看到"
- Watcher heartbeat > 3 min stale → "Watcher 可能死了"
- Done but no evidence → "缺少验收报告"

### 5. Task status pipeline (7 states)
```
INBOX_UNSEEN → SEEN → RUNNING → NEEDS_AUDIT → DONE
                                              → FAILED
```

### 6. Show the communication flow visually
At the top, show a horizontal pipeline:
```
ChatGPT 写任务 → GitHub 收到 → Watcher 扫到 → Agy 执行 → 验收报告 → 完成
```
Each step lights up green when done for the current/latest task.

## Files to create/modify
- scripts/generate-task-index.sh [NEW]
- dashboard.html [MODIFY - full rewrite]
- .ai/task-index.json [GENERATED]
- .ai/heartbeat/watcher.json [GENERATED]

## Also update mindmap-watcher.sh
At the end of every watcher run:
1. Write .ai/heartbeat/watcher.json
2. Run scripts/generate-task-index.sh
3. Commit and push status.json + task-index.json + heartbeat

## Acceptance
- A task in inbox MUST appear on dashboard even if watcher hasn't processed it
- Dashboard must NOT say done unless .ai/done/ file exists
- Must show INBOX_UNSEEN state clearly
- Commit and push all changes
