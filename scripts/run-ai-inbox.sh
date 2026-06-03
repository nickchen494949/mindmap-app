#!/bin/bash

# ═══════════════════════════════════════════════════════
# AI PIPELINE WATCHER — GATEKEEPER MODE
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
WATCHER_PATH="/Users/happygolucky/mindmap-watcher.sh"

cd "$REPO_DIR"
mkdir -p .ai/inbox .ai/outbox .ai/done .ai/logs generated

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
  [ ! -f ".ai/done/$b" ] && TASK_FILE="$f" && break
done

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No new task found."
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
echo "$(date) Found task: $TASK_FILE"

# ── Detect target ──
TARGET=$(grep -i '^target:' "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')

if [ -n "$TARGET" ]; then
  WORK_DIR="$PROJECTS_DIR/$TARGET"
  echo "$(date) Target: $TARGET → $WORK_DIR"
  
  [ ! -d "$WORK_DIR" ] && mkdir -p "$WORK_DIR" && cd "$WORK_DIR" && git init 2>&1 || cd "$WORK_DIR"
  mkdir -p .ai/inbox .ai/done .ai/logs .ai/reports
  cp "$REPO_DIR/$TASK_FILE" ".ai/inbox/$TASK_NAME"
  
  # Ensure .gitignore exists
  echo -e "node_modules/\n.env\n.env.*\n*.log\n.DS_Store" > .gitignore 2>/dev/null

  PROMPT="You are working inside the project at $WORK_DIR.
GitHub username: nickchen494949.
Read task: .ai/inbox/$TASK_NAME
You are the EXECUTOR. Follow the task EXACTLY.

HARD RULES — VIOLATION = IMMEDIATE FAILURE:
1. NEVER put tokens, secrets, passwords, or API keys in ANY file
2. NEVER commit node_modules/ — always add to .gitignore
3. NEVER modify /Users/happygolucky/mindmap-watcher.sh
4. NEVER modify files outside $WORK_DIR
5. Always create .gitignore with node_modules/ before npm install

After finishing, summarize what you did."

  echo "$(date) Running agy..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1
else
  WORK_DIR="$REPO_DIR"
  
  PROMPT="You are working inside $REPO_DIR.
GitHub username: nickchen494949.
Read: .ai/ROLES.md, PROJECT_CONTEXT.md, .ai/RULES.md, $TASK_FILE
You are the EXECUTOR. Follow the task EXACTLY.

HARD RULES — VIOLATION = IMMEDIATE FAILURE:
1. NEVER put tokens, secrets, passwords, or API keys in ANY file
2. NEVER commit node_modules/ — always add to .gitignore
3. NEVER modify /Users/happygolucky/mindmap-watcher.sh
4. NEVER modify files outside $REPO_DIR
5. Always create .gitignore with node_modules/ before npm install

After finishing, summarize what you did."

  echo "$(date) Running agy..."
  script -q ".ai/logs/$TASK_NAME.log" $AGY --print "$PROMPT" --dangerously-skip-permissions 2>&1
fi

# ═══════════════════════════════════════════════════════
# COMMIT FIREWALL — runs AFTER agy, BEFORE commit
# ═══════════════════════════════════════════════════════
echo "$(date) === Commit firewall check ==="
cd "$WORK_DIR"
FIREWALL_PASS=true

# 1. Block node_modules
if find . -path './node_modules' -maxdepth 1 -type d 2>/dev/null | grep -q .; then
  git rm -r --cached node_modules 2>/dev/null || true
  echo "node_modules/" >> .gitignore 2>/dev/null || true
  echo "$(date) CLEANED: node_modules removed from staging"
fi

git add -A 2>/dev/null || true

# Check if node_modules still staged
if git diff --cached --name-only 2>/dev/null | grep -q '^node_modules/'; then
  echo "$(date) ❌ BLOCKED: node_modules still in staged files"
  FIREWALL_PASS=false
fi

# 2. Block secrets (scan all staged files)
SECRET_PATTERNS='gho_[A-Za-z0-9]\{20,\}\|ghp_[A-Za-z0-9]\{20,\}\|github_pat_[A-Za-z0-9]\{20,\}\|sk-[A-Za-z0-9]\{20,\}\|AKIA[A-Z0-9]\{16\}\|xoxb-\|xoxp-'
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)
if [ -n "$STAGED_FILES" ]; then
  SECRET_HIT=$(echo "$STAGED_FILES" | xargs grep -l "$SECRET_PATTERNS" 2>/dev/null || true)
  if [ -n "$SECRET_HIT" ]; then
    echo "$(date) ❌ BLOCKED: Secret detected in: $SECRET_HIT"
    FIREWALL_PASS=false
  fi
fi

# 3. Block watcher modification
if git diff --cached --name-only 2>/dev/null | grep -qi 'watcher'; then
  echo "$(date) ❌ BLOCKED: Watcher file modified"
  FIREWALL_PASS=false
fi

# 4. Decision
if [ "$FIREWALL_PASS" = false ]; then
  echo "$(date) 🚫 COMMIT REJECTED — firewall check failed"
  git reset HEAD 2>/dev/null || true
  
  # Still mark done to avoid infinite retry
  cd "$REPO_DIR"
  cp "$TASK_FILE" ".ai/done/$TASK_NAME"
  echo "FAILED: firewall rejected commit" >> ".ai/logs/$TASK_NAME.log"
  git add -A 2>/dev/null || true
  git commit -m "🚫 BLOCKED $TASK_NAME — firewall rejected" 2>&1 || true
  git push 2>&1 || true
  echo "$(date) === Watcher run finished (BLOCKED) ==="
  exit 1
fi

echo "$(date) ✅ Firewall passed"

# ═══════════════════════════════════════════════════════
# COMMIT & PUSH
# ═══════════════════════════════════════════════════════
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "✅ $TASK_NAME" 2>&1 || true
  
  if [ -n "$TARGET" ]; then
    unset GITHUB_TOKEN 2>/dev/null; unset GH_TOKEN 2>/dev/null
    gh repo create "nickchen494949/$TARGET" --public --source=. --remote=origin --push 2>&1 || {
      git push 2>&1 || echo "$(date) git push failed"
    }
  fi
fi

# Mark done in command center
cd "$REPO_DIR"
cp "$TASK_FILE" ".ai/done/$TASK_NAME"
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "✅ complete $TASK_NAME" 2>&1 || true
  git push 2>&1 || echo "$(date) git push failed"
fi

# Sync to Desktop (non-target tasks only)
if [ -z "$TARGET" ] && [ -d "$DESKTOP_APP" ]; then
  echo "$(date) Syncing to Desktop..."
  rsync -a --exclude='.git' --exclude='node_modules' "$REPO_DIR/" "$DESKTOP_APP/" 2>/dev/null || true
fi

echo "$(date) === Watcher run finished ==="
