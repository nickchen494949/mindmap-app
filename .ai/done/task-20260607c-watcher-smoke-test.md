target: mindmap-app

# Task
Run a minimal watcher smoke test.

## Goal
Verify that the watcher can read a task from `.ai/inbox/`, execute inside `mindmap-app`, create a report, and route the task to review.

## Instructions
Do not modify app source code.
Do not touch qqq-dashboard.
Do not install dependencies.

Create this file:

`.ai/reports/task-20260607c-watcher-smoke-test/final-report.md`

The report should contain:

```md
# Watcher Smoke Test

Status: success

This confirms the watcher can execute a basic task inside mindmap-app.
```

After creating the report, commit and push normally through the watcher pipeline.
