#!/bin/bash
set -euo pipefail

# ============================================
# AI Inbox Watcher - Antigravity CLI Edition
# ============================================

REPO_DIR="/Users/happygolucky/Desktop/系统图app"
AGY="/Users/happygolucky/.local/bin/agy"
cd "$REPO_DIR"

mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs

echo "$(date) === Watcher run started ==="

# Step 0: Pull latest from GitHub (in case tasks were added from phone)
echo "$(date) Pulling latest..."
git pull --rebase 2>&1 || echo "$(date) git pull failed, continuing with local state"

# Step 1: Find the first unprocessed task
TASK_FILE=$(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | sort | head -n 1)

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No task found. Sleeping."
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
DONE_FILE=".ai/done/$TASK_NAME"

# Skip if already done
if [ -f "$DONE_FILE" ]; then
  echo "$(date) Already done: $TASK_NAME"
  exit 0
fi

echo "$(date) Found task: $TASK_FILE"

# Step 2: Build prompt
PROMPT="You are working inside the repository at $REPO_DIR.

Read these files first:
- PROJECT_CONTEXT.md
- .ai/RULES.md
- $TASK_FILE

Complete the task described in the task file.

If it is a mindmap generation task:
- Write the result JSON to .ai/outbox/
- The JSON must be loadable by the mindmap app: { \"nodes\": [...], \"arrows\": [...] }
- Do NOT modify app.js, index.html, or style.css

If it is a code modification task:
- Make the smallest safe change
- Do NOT delete user data

After finishing, briefly summarize what you did."

# Step 3: Run agy in non-interactive print mode
# Use `script -q` to provide a pseudo-TTY (agy needs one even in --print mode)
echo "$(date) Running: agy --print ..."
script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

# Step 4: Mark task as done
cp "$TASK_FILE" "$DONE_FILE"
echo "$(date) Completed: $TASK_NAME"

# Step 5: Commit and push results back to GitHub
echo "$(date) Pushing results to GitHub..."
git add .ai/outbox .ai/done .ai/logs generated 2>/dev/null || true
git add -A 2>/dev/null || true

if git diff --cached --quiet 2>/dev/null; then
  echo "$(date) No changes to commit."
else
  git commit -m "✅ complete $TASK_NAME" 2>&1
  git push 2>&1 || echo "$(date) git push failed"
  echo "$(date) Results pushed to GitHub."
fi

echo "$(date) === Watcher run finished ==="
