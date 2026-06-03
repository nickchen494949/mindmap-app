#!/bin/bash

# Clear any stale token env vars BEFORE strict mode
export GITHUB_TOKEN="" 
export GH_TOKEN=""

set -eo pipefail

REPO_DIR="/Users/happygolucky/mindmap-repo"
PROJECTS_DIR="/Users/happygolucky/projects"
AGY="/Users/happygolucky/.local/bin/agy"
DESKTOP_APP="/Users/happygolucky/Desktop/系统图app"
cd "$REPO_DIR"

# Ensure all directories exist
mkdir -p .ai/inbox .ai/running .ai/reports .ai/review .ai/reviews .ai/fix .ai/done .ai/failed .ai/state .ai/logs generated

echo "$(date) === Watcher run started ==="

# Step 0: Pull latest from GitHub
echo "$(date) Pulling latest..."
git add -A 2>/dev/null || true
git stash 2>/dev/null || true
git pull --rebase 2>&1 || echo "$(date) git pull failed, continuing with local state"
git stash pop 2>/dev/null || true

# Step 1: Process reviews / audits first (converts PASS to done, FAIL to fix tasks)
echo "$(date) Checking for ChatGPT audits..."
node scripts/pipeline-helper.js check-reviews || echo "$(date) check-reviews failed"

# Step 2: Find the first unprocessed task in inbox
TASK_FILE=""
for f in $(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | sort); do
  TASK_FILE="$f"
  break
done

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No new task found. Updating status and sleeping."
  node scripts/pipeline-helper.js update-status || true
  
  # Push status.json updates if any
  git add status.json .ai/state/ .ai/done/ .ai/review/ .ai/reviews/ .ai/fix/ .ai/failed/ 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "📊 update status [no new tasks]" 2>&1 || true
    git push 2>&1 || echo "$(date) git push failed"
  fi
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
TASK_ID="${TASK_NAME%.md}"

echo "$(date) Found task: $TASK_FILE (ID: $TASK_ID)"

# Move task to running folder to mark as active execution
RUNNING_FILE=".ai/running/$TASK_NAME"
mv "$TASK_FILE" "$RUNNING_FILE"
git add "$TASK_FILE" "$RUNNING_FILE" 2>/dev/null || true

# Check if task has a "target:" field
TARGET_PROJECT=$(grep -i '^target:' "$RUNNING_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')

if [ -n "$TARGET_PROJECT" ]; then
  # ── External project mode ──
  WORK_DIR="$PROJECTS_DIR/$TARGET_PROJECT"
  echo "$(date) External project: $TARGET_PROJECT → $WORK_DIR"
  
  if [ ! -d "$WORK_DIR" ]; then
    echo "$(date) Creating new project directory..."
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    git init 2>&1
    mkdir -p .ai/inbox .ai/running .ai/reports .ai/review .ai/reviews .ai/fix .ai/done .ai/failed .ai/state .ai/logs
    cp "$REPO_DIR/.ai/ROLES.md" .ai/ 2>/dev/null || true
    cp "$REPO_DIR/.ai/RULES.md" .ai/ 2>/dev/null || true
  else
    cd "$WORK_DIR"
    # Pull latest if repo has a remote
    git pull --rebase 2>/dev/null || true
    mkdir -p .ai/inbox .ai/running .ai/reports .ai/review .ai/reviews .ai/fix .ai/done .ai/failed .ai/state .ai/logs
  fi
  
  # Copy running task into the project
  cp "$REPO_DIR/$RUNNING_FILE" ".ai/running/$TASK_NAME"

  # ── Let agy handle execution ──
  PROMPT="You are working inside the project at $WORK_DIR.
The project list is at $PROJECTS_DIR.
The GitHub username is nickchen494949.

Read this task file completely: .ai/running/$TASK_NAME

You are the EXECUTOR. Follow the task file EXACTLY.

You have full permissions. You can:
- Create files, folders, entire apps
- Modify existing code
- Run shell commands (npm, git, gh, curl, etc)
- Deploy (gh-pages, netlify, etc)
- Create GitHub repos with: gh repo create nickchen494949/NAME --public --source=. --remote=origin --push

Do whatever the task says. Make it professional and polished.
After finishing, briefly summarize what you did."

  echo "$(date) Running: agy --print (project: $TARGET_PROJECT)..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

  # Commit project changes first
  git add -A 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "🛠️ build/changes for $TASK_NAME" 2>&1 || true
    unset GITHUB_TOKEN 2>/dev/null || true
    unset GH_TOKEN 2>/dev/null || true
    # Create repo if it doesn't exist, otherwise just push
    gh repo create "nickchen494949/$TARGET_PROJECT" --public --source=. --remote=origin --push 2>&1 || {
      git push 2>&1 || echo "$(date) git push failed"
    }
  fi

  # Run mechanical checks & evidence collection
  echo "$(date) Running QA Audit and evidence collection..."
  cd "$REPO_DIR"
  node scripts/pipeline-helper.js audit "$TASK_ID" "$TARGET_PROJECT" || echo "$(date) audit failed"

else
  # ── Mindmap repo mode (no target: field) ──
  PROMPT="You are working inside the repository at $REPO_DIR.
The GitHub username is nickchen494949.

Read these files first:
- .ai/ROLES.md
- PROJECT_CONTEXT.md
- .ai/RULES.md
- $RUNNING_FILE

You are the EXECUTOR. Follow the task file EXACTLY.

You have full permissions. You can:
- Generate mindmap JSON to .ai/outbox/ and generated/
- Modify app code (app.js, index.html, style.css)
- Run shell commands (git, gh, npm, curl, etc)
- Deploy if needed

Do whatever the task says. After finishing, briefly summarize what you did."

  echo "$(date) Running: agy --print ..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

  # Run mechanical checks & evidence collection
  echo "$(date) Running QA Audit and evidence collection..."
  node scripts/pipeline-helper.js audit "$TASK_ID" "" || echo "$(date) audit failed"

  # Sync to Desktop app if applicable
  if [ -d "$DESKTOP_APP" ]; then
    echo "$(date) Syncing to Desktop app..."
    cp -R generated/* "$DESKTOP_APP/generated/" 2>/dev/null || true
    cp -R .ai/outbox/* "$DESKTOP_APP/.ai/outbox/" 2>/dev/null || true
    echo "$(date) Desktop app synced."
  fi
fi

# ── Update status.json and push results to GitHub ──
cd "$REPO_DIR"
echo "$(date) Updating status.json..."
node scripts/pipeline-helper.js update-status || echo "$(date) update-status failed"

echo "$(date) Pushing results to GitHub..."
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "⏳ review required for $TASK_ID" 2>&1
  git push 2>&1 || echo "$(date) git push failed"
  echo "$(date) Results pushed to GitHub."
fi

echo "$(date) === Watcher run finished ==="
