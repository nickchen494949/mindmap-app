#!/bin/bash
# ═══════════════════════════════════════════════════════
# CI WATCHER — GitHub Actions version
# Runs inside GitHub Actions runner (Ubuntu)
# ═══════════════════════════════════════════════════════
set -eo pipefail

REPO_DIR="${REPO_DIR:-$(pwd)}"
cd "$REPO_DIR"

mkdir -p .ai/inbox .ai/outbox .ai/done .ai/failed .ai/running .ai/review .ai/fix .ai/reports .ai/state .ai/logs .ai/heartbeat generated

echo "$(date) === CI Watcher run started ==="

# ── Process existing reviews first ──
echo "$(date) Processing reviews and updating task index..."
node "$REPO_DIR/scripts/generate-task-index.js" || echo "$(date) Failed to process reviews"

# ── Find first unprocessed task ──
TASK_FILE=""
for f in $(find .ai/inbox -type f -name "task-*.md" 2>/dev/null | sort); do
  b=$(basename "$f")
  [ ! -f ".ai/done/$b" ] && [ ! -f ".ai/failed/$b" ] && TASK_FILE="$f" && break
done

if [ -z "${TASK_FILE:-}" ]; then
  echo "$(date) No new task found."
  cat > .ai/heartbeat/watcher.json <<EOF
{"name":"ci-watcher","lastSeen":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","lastScannedCommit":"$(git rev-parse HEAD 2>/dev/null)","inboxCount":$(find .ai/inbox -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"doneCount":$(find .ai/done -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"failedCount":$(find .ai/failed -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"status":"idle","runner":"github-actions"}
EOF
  exit 0
fi

TASK_NAME=$(basename "$TASK_FILE")
TASK_ID="${TASK_NAME%.md}"
echo "$(date) Found task: $TASK_FILE"

# ── Read target ──
TARGET=$(grep -i '^target:' "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^target:[[:space:]]*//' | tr -d '\r')
TARGET="${TARGET:-mindmap-app}"
WORK_DIR="$REPO_DIR"

echo "$(date) Target: $TARGET | Work dir: $WORK_DIR"

# ── Mark as running ──
cp "$TASK_FILE" ".ai/running/$TASK_NAME" 2>/dev/null || true
cat > ".ai/state/$TASK_ID.json" <<EOF
{"taskId":"$TASK_ID","status":"running","startedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"$TARGET","runner":"github-actions"}
EOF

# ── Read task content for aider prompt ──
TASK_CONTENT=$(cat "$TASK_FILE")

PROMPT="You are working inside: $WORK_DIR
Read and execute this task:

$TASK_CONTENT

HARD RULES — VIOLATION = IMMEDIATE FAILURE:
1. NEVER put tokens, secrets, passwords, or API keys in ANY file
2. NEVER commit node_modules/ — always add to .gitignore FIRST
3. NEVER modify scripts/ci-watcher.sh or .github/workflows/
4. Always create .gitignore with node_modules/ before npm install

After finishing, summarize what you did."

# ── Run Claude Code (replaces local agy) ──
echo "$(date) Running Claude Code..."
claude -p "$PROMPT" \
  --allowedTools "Edit,Write,Bash" \
  --yes \
  2>&1 | tee "$REPO_DIR/.ai/logs/$TASK_NAME.log" || echo "$(date) Claude Code exited with error"

# ═══════════════════════════════════════════════════════
# COMMIT FIREWALL
# ═══════════════════════════════════════════════════════
echo "$(date) === Commit firewall check ==="
FIREWALL_PASS=true
FIREWALL_ERRORS=""

# Remove node_modules from staging
git rm -r --cached node_modules 2>/dev/null || true
echo "node_modules/" >> .gitignore 2>/dev/null || true
git add -A 2>/dev/null || true

# Check node_modules
if git diff --cached --name-only 2>/dev/null | grep -q '^node_modules/'; then
  FIREWALL_PASS=false
  FIREWALL_ERRORS="${FIREWALL_ERRORS}node_modules staged; "
fi

# Scan for secrets
SECRET_PATTERNS='gho_[A-Za-z0-9]\{20,\}\|ghp_[A-Za-z0-9]\{20,\}\|github_pat_[A-Za-z0-9]\{20,\}\|sk-[A-Za-z0-9]\{20,\}\|AKIA[A-Z0-9]\{16\}\|xoxb-\|xoxp-\|npm_[A-Za-z0-9]\{20,\}'
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [ -n "$STAGED" ]; then
  SECRET_HIT=$(echo "$STAGED" | xargs grep -l "$SECRET_PATTERNS" 2>/dev/null || true)
  if [ -n "$SECRET_HIT" ]; then
    FIREWALL_PASS=false
    FIREWALL_ERRORS="${FIREWALL_ERRORS}secret in: $SECRET_HIT; "
  fi
fi

# Block watcher/workflow modification
if git diff --cached --name-only 2>/dev/null | grep -qiE 'ci-watcher|watcher\.yml'; then
  FIREWALL_PASS=false
  FIREWALL_ERRORS="${FIREWALL_ERRORS}watcher/workflow file modified; "
fi

if [ "$FIREWALL_PASS" = false ]; then
  echo "$(date) 🚫 COMMIT REJECTED: $FIREWALL_ERRORS"
  git reset HEAD 2>/dev/null || true
  rm -f ".ai/running/$TASK_NAME"
  cp "$TASK_FILE" ".ai/failed/$TASK_NAME"
  cat > ".ai/state/$TASK_ID.json" <<EOF
{"taskId":"$TASK_ID","status":"blocked","blockedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"$TARGET","errors":"$FIREWALL_ERRORS","runner":"github-actions"}
EOF
  git add -A 2>/dev/null || true
  exit 1
fi

echo "$(date) ✅ Firewall passed"

# ── Commit aider's work ──
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "✅ $TASK_ID (via CI)" 2>&1 || true
fi

# ── Route to review ──
rm -f ".ai/running/$TASK_NAME"
cp "$TASK_FILE" ".ai/review/$TASK_NAME"
cat > ".ai/state/$TASK_ID.json" <<EOF
{"taskId":"$TASK_ID","status":"needs_chatgpt_audit","completedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","target":"$TARGET","runner":"github-actions"}
EOF

# ── Collect evidence ──
echo "$(date) Generating evidence packet..."
node "$REPO_DIR/scripts/collect-evidence.js" --taskId "$TASK_ID" --target "$TARGET" 2>&1 || echo "$(date) Evidence collection failed"

# ── DeepSeek auto-review ──
echo "$(date) Running DeepSeek API Auto-Review..."
node "$REPO_DIR/scripts/deepseek-reviewer.js" "$TASK_ID" 2>&1 || echo "$(date) DeepSeek Review failed"

# ── Process review result (move to done/fail) ──
echo "$(date) Processing review results..."
node "$REPO_DIR/scripts/generate-task-index.js" || echo "$(date) Failed to process reviews"

# ── Write heartbeat ──
cat > .ai/heartbeat/watcher.json <<EOF
{"name":"ci-watcher","lastSeen":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","lastScannedCommit":"$(git rev-parse HEAD 2>/dev/null)","lastTask":"$TASK_NAME","inboxCount":$(find .ai/inbox -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"doneCount":$(find .ai/done -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"failedCount":$(find .ai/failed -name 'task-*.md' 2>/dev/null | wc -l | tr -d ' '),"status":"alive","runner":"github-actions"}
EOF

echo "$(date) === CI Watcher run finished ==="
