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

mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs generated

echo "$(date) === Watcher run started ==="

# Step 0: Pull latest from GitHub
echo "$(date) Pulling latest..."
git add -A 2>/dev/null || true
git stash 2>/dev/null || true
git pull --rebase 2>&1 || echo "$(date) git pull failed, continuing with local state"
git stash pop 2>/dev/null || true

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

# Step 2: Check if task has a "target:" field (new/existing external project)
TARGET_PROJECT=$(grep -i '^target:' "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')

if [ -n "$TARGET_PROJECT" ]; then
  # ── External project mode ──
  WORK_DIR="$PROJECTS_DIR/$TARGET_PROJECT"
  echo "$(date) External project: $TARGET_PROJECT → $WORK_DIR"
  
  if [ ! -d "$WORK_DIR" ]; then
    echo "$(date) Creating new project directory..."
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    git init 2>&1
    mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs
    cp "$REPO_DIR/.ai/ROLES.md" .ai/ 2>/dev/null || true
    cp "$REPO_DIR/.ai/RULES.md" .ai/ 2>/dev/null || true
  else
    cd "$WORK_DIR"
    # Pull latest if repo has a remote
    git pull --rebase 2>/dev/null || true
    mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs
  fi
  
  # Copy task into the project
  cp "$REPO_DIR/$TASK_FILE" ".ai/inbox/$TASK_NAME"

  # ── Let agy handle EVERYTHING ──
  PROMPT="You are working inside the project at $WORK_DIR.
The project list is at $PROJECTS_DIR.
The GitHub username is nickchen494949.

Read this task file completely: .ai/inbox/$TASK_NAME

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

  # Commit and push project changes
  git add -A 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "✅ $TASK_NAME" 2>&1 || true
    unset GITHUB_TOKEN 2>/dev/null || true
    unset GH_TOKEN 2>/dev/null || true
    # Create repo if it doesn't exist, otherwise just push
    gh repo create "nickchen494949/$TARGET_PROJECT" --public --source=. --remote=origin --push 2>&1 || {
      git push 2>&1 || echo "$(date) git push failed"
    }
  fi

  # Mark done in command center
  cd "$REPO_DIR"
  cp "$TASK_FILE" "$DONE_FILE"
  git add -A 2>/dev/null || true
  git commit -m "✅ complete $TASK_NAME → $TARGET_PROJECT" 2>&1 || true
  git push 2>&1 || echo "$(date) git push failed"

else
  # ── Mindmap repo mode (no target: field) ──
  PROMPT="You are working inside the repository at $REPO_DIR.
The GitHub username is nickchen494949.

Read these files first:
- .ai/ROLES.md
- PROJECT_CONTEXT.md
- .ai/RULES.md
- $TASK_FILE

You are the EXECUTOR. Follow the task file EXACTLY.

You have full permissions. You can:
- Generate mindmap JSON to .ai/outbox/ and generated/
- Modify app code (app.js, index.html, style.css)
- Run shell commands (git, gh, npm, curl, etc)
- Deploy if needed

Do whatever the task says. After finishing, briefly summarize what you did."

  echo "$(date) Running: agy --print ..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

  # Mark task as done
  cp "$TASK_FILE" "$DONE_FILE"
  echo "$(date) Completed: $TASK_NAME"

  # Commit and push
  echo "$(date) Pushing results to GitHub..."
  git add -A 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "✅ complete $TASK_NAME" 2>&1
    git push 2>&1 || echo "$(date) git push failed"
    echo "$(date) Results pushed to GitHub."
  fi

  # Sync to Desktop app
  if [ -d "$DESKTOP_APP" ]; then
    echo "$(date) Syncing to Desktop app..."
    cp -R generated/* "$DESKTOP_APP/generated/" 2>/dev/null || true
    cp -R .ai/outbox/* "$DESKTOP_APP/.ai/outbox/" 2>/dev/null || true
    echo "$(date) Desktop app synced."
  fi
fi

# ── Generate status.json for dashboard ──
cd "$REPO_DIR"
TOTAL=$(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | wc -l | tr -d ' ')
DONE_COUNT=$(find .ai/done -type f -name "task-*.md" 2>/dev/null | wc -l | tr -d ' ')
PENDING_COUNT=$((TOTAL - DONE_COUNT))
PENDING_LIST=$(for f in .ai/inbox/task-*.md; do b=$(basename "$f"); [ ! -f ".ai/done/$b" ] && echo "\"$b\""; done | paste -sd, -)
DONE_LIST=$(ls .ai/done/task-*.md 2>/dev/null | while read f; do echo "\"$(basename "$f")\""; done | paste -sd, -)
PROJ_LIST=$(ls -d "$PROJECTS_DIR"/*/ 2>/dev/null | while read d; do echo "\"$(basename "$d")\""; done | paste -sd, -)

# Build task details
TASK_DETAILS="{"
for f in .ai/inbox/task-*.md; do
  b=$(basename "$f")
  # Extract first line as title
  TITLE=$(head -1 "$f" | sed 's/^#[[:space:]]*//')
  # Extract target
  TGT=$(grep -i '^target:' "$f" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')
  # Check if done
  if [ -f ".ai/done/$b" ]; then
    STATUS="done"
    # Get completion time from git log
    CTIME=$(git log -1 --format="%ci" -- ".ai/done/$b" 2>/dev/null | cut -d' ' -f1,2)
    # Get summary from log file (last few meaningful lines)
    SUMMARY=$(tail -5 ".ai/logs/$b.log" 2>/dev/null | head -3 | tr '\n' ' ' | sed 's/"/\\"/g' | cut -c1-200)
  else
    STATUS="pending"
    CTIME=""
    SUMMARY=""
  fi
  TASK_DETAILS="$TASK_DETAILS\"$b\":{\"title\":\"$TITLE\",\"target\":\"${TGT:-}\",\"status\":\"$STATUS\",\"completedAt\":\"${CTIME:-}\",\"summary\":\"${SUMMARY:-}\"},"
done
TASK_DETAILS="${TASK_DETAILS%,}}"

# Build activity log from watcher log
ACTIVITY_LOG="["
tail -30 /Users/happygolucky/watcher.out.log 2>/dev/null | while IFS= read -r line; do
  TIME=$(echo "$line" | grep -oE '^[A-Z][a-z]{2} [A-Z][a-z]{2} +[0-9]+ [0-9:]+' | head -1)
  [ -z "$TIME" ] && continue
  ACTION=$(echo "$line" | sed "s/^.*[0-9] //" | sed 's/"/\\"/g')
  if echo "$ACTION" | grep -qi "Found task\|Running.*agy\|Completed\|pushed\|Syncing\|new project\|External project"; then
    SENDER="agy"
    echo "$ACTION" | grep -qi "Found task\|Pulling\|Syncing" && SENDER="watcher"
    echo "{\"time\":\"$TIME\",\"sender\":\"$SENDER\",\"action\":\"$ACTION\"},"
  fi
done > /tmp/activity_lines.txt
ACTIVITY_ENTRIES=$(cat /tmp/activity_lines.txt | tr -d '\n')
ACTIVITY_LOG="[${ACTIVITY_ENTRIES%,}]"

cat > status.json <<EOJSON
{
  "lastUpdate": "$(date '+%Y-%m-%d %H:%M:%S')",
  "totalTasks": $TOTAL,
  "doneTasks": $DONE_COUNT,
  "pendingTasks": $PENDING_COUNT,
  "pending": [${PENDING_LIST:-}],
  "done": [${DONE_LIST:-}],
  "projects": [${PROJ_LIST:-}],
  "taskDetails": $TASK_DETAILS,
  "activityLog": $ACTIVITY_LOG
}
EOJSON
echo "$(date) status.json updated"

echo "$(date) === Watcher run finished ==="
