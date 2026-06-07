#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -z "$TASK_ID" ]; then
  echo "Usage: bash scripts/ai-status.sh <task-id-or-task-file>"
  echo "Example: bash scripts/ai-status.sh task-20260607d-china-nasdaq-premium-backtest"
  echo ""
  echo "Recent task files:"
  find .ai/inbox .ai/running .ai/review .ai/failed .ai/done -type f -name 'task-*.md' 2>/dev/null | sort | tail -20 || true
  exit 0
fi

TASK_ID="${TASK_ID%.md}"
TASK_FILE="$TASK_ID.md"

echo "=== AI Task Status ==="
echo "Task: $TASK_FILE"
echo "Repo: $ROOT"
echo "Time: $(date)"
echo ""

status="unknown"
location=""

check_file() {
  local label="$1"
  local path="$2"
  if [ -f "$path" ]; then
    status="$label"
    location="$path"
    return 0
  fi
  return 1
}

check_file "RUNNING" ".ai/running/$TASK_FILE" || \
check_file "NEEDS_REVIEW" ".ai/review/$TASK_FILE" || \
check_file "FAILED" ".ai/failed/$TASK_FILE" || \
check_file "DONE" ".ai/done/$TASK_FILE" || \
check_file "QUEUED" ".ai/inbox/$TASK_FILE" || true

state_path=".ai/state/$TASK_ID.json"
report_path=".ai/reports/$TASK_ID/final-report.md"
log_path=".ai/logs/$TASK_FILE.log"

echo "Status: $status"
[ -n "$location" ] && echo "Location: $location"
[ -f "$state_path" ] && echo "State: $state_path"
[ -f "$report_path" ] && echo "Report: $report_path"
[ -f "$log_path" ] && echo "Log: $log_path"
echo ""

if [ -f "$state_path" ]; then
  echo "--- State JSON ---"
  cat "$state_path"
  echo ""
  echo ""
fi

if [ -f "$log_path" ]; then
  echo "--- Log tail ---"
  tail -60 "$log_path"
  echo ""
fi

if [ -f "$report_path" ]; then
  echo "--- Report head ---"
  sed -n '1,80p' "$report_path"
  echo ""
fi

echo "--- Git status ---"
git status --short || true
