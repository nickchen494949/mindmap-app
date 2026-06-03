#!/bin/bash

# ═══════════════════════════════════════════════════════
# AI PIPELINE WATCHER — GATEKEEPER MODE v2
# This file MUST NOT be modified by agy.
# Location: /Users/happygolucky/mindmap-watcher.sh
# ═══════════════════════════════════════════════════════

export GITHUB_TOKEN="" 
export GH_TOKEN=""
set -eo pipefail

REPO_DIR="/Users/happygolucky/mindmap-repo"
PROJECTS_DIR="/Users/happygolucky/projects"
AGY="/Users/happygolucky/.local/bin/agy"
DESKTOP_APP="/Users/happygolucky/Desktop/系统图app"

cd "$REPO_DIR"
mkdir -p .ai/inbox .ai/outbox .ai/done .ai/failed .ai/running .ai/review .ai/fix .ai/reports .ai/state .ai/logs .ai/heartbeat generated

echo "$(date) === Watcher run started ==="

# ── Pull latest ──
echo "$(date) Pulling latest..."
git stash 2>/dev/null || true
git pull --rebase 2>&1 || echo "$(date) git pull failed"
git stash pop 2>/dev/null || true

# ── Find first unprocessed task ──
TASK_FILE=""
for f in $(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | sort); do
  b=$(basename "$f")
  [ ! -f ".ai/done/$b" ] && [ ! -f ".ai/failed/$b" ] && TASK_FILE="$f" && break
done

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No new task found."
  # Write heartbeat even when idle
  cat > .ai/heartbeat/watcher.json <<EOF
{"name":"watcher","lastSeen":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","lastScannedCommit":"$(git rev-parse HEAD 2>/dev/null)","inboxCount":$(find .ai/inbox -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"doneCount":$(find .ai/done -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"failedCount":$(find .ai/failed -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"status":"idle"}
EOF
  git add .ai/heartbeat 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "heartbeat update" 2>&1 || true
    git push 2>&1 || true
  fi
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
echo "$(date) Found task: $TASK_FILE"

# ── TARGET ROUTING (allowlist only) ──
TARGET=$(grep -i '^target:' "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')

if [ -n "$TARGET" ]; then
  case "$TARGET" in
    mindmap-app)
      WORK_DIR="$REPO_DIR"
      ;;
    us-macro-dashboard|chatgpt-pipeline-test)
      WORK_DIR="$PROJECTS_DIR/$TARGET"
      ;;
    *)
      # New project — allowed, but only in $PROJECTS_DIR
      WORK_DIR="$PROJECTS_DIR/$TARGET"
      echo "$(date) New target: $TARGET → $WORK_DIR"
      ;;
  esac
  echo "$(date) Target: $TARGET → $WORK_DIR"
else
  WORK_DIR="$REPO_DIR"
fi

# ── Mark as running ──
cp "$TASK_FILE" ".ai/running/$TASK_NAME" 2>/dev/null || true
cat > ".ai/state/$TASK_NAME.json" <<EOF
{"taskId":"$TASK_NAME","status":"running","startedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"${TARGET:-mindmap-repo}","workDir":"$WORK_DIR"}
EOF

# ── Setup work directory ──
if [ "$WORK_DIR" != "$REPO_DIR" ]; then
  if [ ! -d "$WORK_DIR" ]; then
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    git init 2>&1
    mkdir -p .ai/inbox .ai/done .ai/logs .ai/reports
    cp "$REPO_DIR/.ai/ROLES.md" .ai/ 2>/dev/null || true
    cp "$REPO_DIR/.ai/RULES.md" .ai/ 2>/dev/null || true
  else
    cd "$WORK_DIR"
    git pull --rebase 2>/dev/null || true
    mkdir -p .ai/inbox .ai/done .ai/logs .ai/reports
  fi
  cp "$REPO_DIR/$TASK_FILE" ".ai/inbox/$TASK_NAME"
  echo -e "node_modules/\n.env\n.env.*\n*.log\n.DS_Store" > .gitignore 2>/dev/null
fi

# ── Run agy ──
PROMPT="You are working inside: $WORK_DIR
GitHub username: nickchen494949.
Read task: $([ "$WORK_DIR" != "$REPO_DIR" ] && echo ".ai/inbox/$TASK_NAME" || echo "$TASK_FILE")
You are the EXECUTOR. Follow the task EXACTLY.

HARD RULES — VIOLATION = IMMEDIATE FAILURE:
1. NEVER put tokens, secrets, passwords, or API keys in ANY file
2. NEVER commit node_modules/ — always add to .gitignore FIRST
3. NEVER modify /Users/happygolucky/mindmap-watcher.sh
4. NEVER modify files outside $WORK_DIR
5. Always create .gitignore with node_modules/ before npm install

After finishing, summarize what you did."

echo "$(date) Running agy..."
cd "$WORK_DIR"
script -q "$REPO_DIR/.ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1

# ═══════════════════════════════════════════════════════
# COMMIT FIREWALL — runs AFTER agy, BEFORE commit
# ═══════════════════════════════════════════════════════
echo "$(date) === Commit firewall check ==="
cd "$WORK_DIR"
FIREWALL_PASS=true
FIREWALL_ERRORS=""

# 1. Remove node_modules from staging
git rm -r --cached node_modules 2>/dev/null || true
echo "node_modules/" >> .gitignore 2>/dev/null || true
git add -A 2>/dev/null || true

# Check node_modules still staged
if git diff --cached --name-only 2>/dev/null | grep -q '^node_modules/'; then
  FIREWALL_PASS=false
  FIREWALL_ERRORS="${FIREWALL_ERRORS}node_modules staged; "
fi

# 2. Scan ALL staged files for secrets
SECRET_PATTERNS='gho_[A-Za-z0-9]\{20,\}\|ghp_[A-Za-z0-9]\{20,\}\|github_pat_[A-Za-z0-9]\{20,\}\|sk-[A-Za-z0-9]\{20,\}\|AKIA[A-Z0-9]\{16\}\|xoxb-\|xoxp-\|npm_[A-Za-z0-9]\{20,\}'
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [ -n "$STAGED" ]; then
  SECRET_HIT=$(echo "$STAGED" | xargs grep -l "$SECRET_PATTERNS" 2>/dev/null || true)
  if [ -n "$SECRET_HIT" ]; then
    FIREWALL_PASS=false
    FIREWALL_ERRORS="${FIREWALL_ERRORS}secret in: $SECRET_HIT; "
  fi
fi

# 3. Block watcher modification
if git diff --cached --name-only 2>/dev/null | grep -qi 'mindmap-watcher'; then
  FIREWALL_PASS=false
  FIREWALL_ERRORS="${FIREWALL_ERRORS}watcher file modified; "
fi

# 4. Decision
if [ "$FIREWALL_PASS" = false ]; then
  echo "$(date) 🚫 COMMIT REJECTED: $FIREWALL_ERRORS"
  git reset HEAD 2>/dev/null || true
  
  # Move to FAILED, not done
  cd "$REPO_DIR"
  rm -f ".ai/running/$TASK_NAME"
  cp "$TASK_FILE" ".ai/failed/$TASK_NAME"
  cat > ".ai/state/$TASK_NAME.json" <<EOF
{"taskId":"$TASK_NAME","status":"blocked","blockedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"${TARGET:-mindmap-repo}","errors":"$FIREWALL_ERRORS"}
EOF
  git add -A 2>/dev/null || true
  git commit -m "🚫 BLOCKED $TASK_NAME — $FIREWALL_ERRORS" 2>&1 || true
  git push 2>&1 || true
  echo "$(date) === Watcher run finished (BLOCKED) ==="
  exit 1
fi

echo "$(date) ✅ Firewall passed"

# ═══════════════════════════════════════════════════════
# COMMIT & PUSH (firewall passed)
# ═══════════════════════════════════════════════════════
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "✅ $TASK_NAME" 2>&1 || true
  
  if [ "$WORK_DIR" != "$REPO_DIR" ] && [ -n "$TARGET" ]; then
    unset GITHUB_TOKEN 2>/dev/null; unset GH_TOKEN 2>/dev/null
    gh repo create "nickchen494949/$TARGET" --public --source=. --remote=origin --push 2>&1 || {
      git push --set-upstream origin main 2>&1 || git push 2>&1 || echo "$(date) git push failed"
    }
  fi
fi

# ── Mark done + update state in command center ──
cd "$REPO_DIR"
rm -f ".ai/running/$TASK_NAME"
cp "$TASK_FILE" ".ai/done/$TASK_NAME"
cat > ".ai/state/$TASK_NAME.json" <<EOF
{"taskId":"$TASK_NAME","status":"done","completedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"${TARGET:-mindmap-repo}","workDir":"$WORK_DIR"}
EOF

# ── Write heartbeat ──
cat > .ai/heartbeat/watcher.json <<EOF
{"name":"watcher","lastSeen":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","lastScannedCommit":"$(git rev-parse HEAD 2>/dev/null)","lastTask":"$TASK_NAME","inboxCount":$(find .ai/inbox -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"doneCount":$(find .ai/done -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"failedCount":$(find .ai/failed -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"status":"alive"}
EOF

git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "✅ complete $TASK_NAME" 2>&1 || true
  git push 2>&1 || echo "$(date) git push failed"
fi

# ── Sync to Desktop (mindmap-repo tasks only) ──
if [ -z "$TARGET" ] && [ -d "$DESKTOP_APP" ]; then
  echo "$(date) Syncing to Desktop..."
  rsync -a --exclude='.git' --exclude='node_modules' "$REPO_DIR/" "$DESKTOP_APP/" 2>/dev/null || true
fi

echo "$(date) === Watcher run finished ==="
