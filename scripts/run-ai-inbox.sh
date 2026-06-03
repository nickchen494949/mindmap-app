#!/bin/bash

# Clear any stale token env vars BEFORE strict mode
export GITHUB_TOKEN="" 
export GH_TOKEN=""

set -eo pipefail

REPO_DIR="/Users/happygolucky/mindmap-repo"
PROJECTS_DIR="/Users/happygolucky/projects"
AGY="/Users/happygolucky/.local/bin/agy"
cd "$REPO_DIR"

mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs generated

echo "$(date) === Watcher run started ==="

# Step 0: Pull latest from GitHub
echo "$(date) Pulling latest..."
git pull --rebase 2>&1 || echo "$(date) git pull failed, continuing with local state"

# Step 1: Find the first unprocessed task (skip done ones)
TASK_FILE=""
for f in $(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | sort); do
  BASENAME=$(basename "$f")
  if [ ! -f ".ai/done/$BASENAME" ]; then
    TASK_FILE="$f"
    break
  fi
done

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No new task found. Sleeping."
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
DONE_FILE=".ai/done/$TASK_NAME"

echo "$(date) Found task: $TASK_FILE"

# Step 2: Check if task has a "target:" field (new project)
TARGET_PROJECT=$(grep -i '^target:' "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')

if [ -n "$TARGET_PROJECT" ]; then
  # ── New project mode ──
  WORK_DIR="$PROJECTS_DIR/$TARGET_PROJECT"
  echo "$(date) New project target: $TARGET_PROJECT → $WORK_DIR"
  
  if [ ! -d "$WORK_DIR" ]; then
    echo "$(date) Creating new project directory..."
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    git init 2>&1
    # Copy task file into the new project
    mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs
    cp "$REPO_DIR/.ai/ROLES.md" .ai/ 2>/dev/null || true
    cp "$REPO_DIR/.ai/RULES.md" .ai/ 2>/dev/null || true
    cp "$REPO_DIR/$TASK_FILE" ".ai/inbox/$TASK_NAME"
  else
    cd "$WORK_DIR"
    mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs
    cp "$REPO_DIR/$TASK_FILE" ".ai/inbox/$TASK_NAME"
  fi
  
  PROMPT="You are working inside a NEW project at $WORK_DIR.

Read the task file: .ai/inbox/$TASK_NAME

You are the EXECUTOR. Follow the task file exactly.
Build the project from scratch as specified in the task.
Create all necessary files (HTML, CSS, JS, etc).
Make it look professional and polished.

After finishing, briefly summarize what you did."

  echo "$(date) Running: agy --print (new project)..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

  # Create GitHub repo and push
  echo "$(date) Creating GitHub repo..."
  gh repo create "nickchen494949/$TARGET_PROJECT" --private --source=. --push 2>&1 || {
    # Repo might already exist, just push
    git remote add origin "https://github.com/nickchen494949/$TARGET_PROJECT.git" 2>/dev/null || true
    git add -A 2>/dev/null || true
    git commit -m "✅ initial: $TASK_NAME" 2>&1 || true
    git push -u origin main 2>&1 || git push -u origin master 2>&1 || echo "$(date) git push failed"
  }
  echo "$(date) New project pushed to GitHub."

  # Mark done in the command center repo
  cd "$REPO_DIR"
  cp "$TASK_FILE" "$DONE_FILE"
  git add -A 2>/dev/null || true
  git commit -m "✅ complete $TASK_NAME → new project: $TARGET_PROJECT" 2>&1 || true
  git push 2>&1 || echo "$(date) git push failed"

else
  # ── Normal mode (mindmap repo tasks) ──
  PROMPT="You are working inside the repository at $REPO_DIR.

Read these files first:
- .ai/ROLES.md
- PROJECT_CONTEXT.md
- .ai/RULES.md
- $TASK_FILE

You are the EXECUTOR. Follow the task file exactly. Do not freelance or add your own research.

If it is a mindmap generation task:
- Write the result JSON to .ai/outbox/ and generated/
- The JSON must be loadable by the mindmap app: { \"nodes\": [...], \"arrows\": [...] }

If it is a code modification task:
- Make the smallest safe change
- Do NOT delete user data

After finishing, briefly summarize what you did."

  echo "$(date) Running: agy --print ..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

  # Mark task as done
  cp "$TASK_FILE" "$DONE_FILE"
  echo "$(date) Completed: $TASK_NAME"

  # Commit and push
  echo "$(date) Pushing results to GitHub..."
  git add -A 2>/dev/null || true

  if git diff --cached --quiet 2>/dev/null; then
    echo "$(date) No changes to commit."
  else
    git commit -m "✅ complete $TASK_NAME" 2>&1
    git push 2>&1 || echo "$(date) git push failed"
    echo "$(date) Results pushed to GitHub."
  fi

  # Sync to Desktop app
  DESKTOP_APP="/Users/happygolucky/Desktop/系统图app"
  if [ -d "$DESKTOP_APP" ]; then
    echo "$(date) Syncing to Desktop app..."
    cp -R generated/* "$DESKTOP_APP/generated/" 2>/dev/null || true
    cp -R .ai/outbox/* "$DESKTOP_APP/.ai/outbox/" 2>/dev/null || true
    echo "$(date) Desktop app synced."
  fi
fi

echo "$(date) === Watcher run finished ==="
