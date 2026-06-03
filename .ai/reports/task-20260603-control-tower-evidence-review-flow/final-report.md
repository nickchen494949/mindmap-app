Implemented:
- Upgraded the task indexer script (scripts/generate-task-index.js) to scan all required .ai/ folders and produce the unified `.ai/task-index.json`.
- Integrated stale review prevention by comparing the modification time of `chatgpt-audit.md` with the task's `state.updatedAt`.
- Implemented self-healing auto-evidence collection: if a task reaches the `review` location but lacks a reports folder, the indexer automatically invokes `collect-evidence.js` to create the packet.
- Upgraded `dashboard.html` to clearly show 9 distinct columns/sections, aligning with the control tower specifications:
  1. Inbox / unseen
  2. Running
  3. Needs ChatGPT audit
  4. Failed / blocked
  5. Done after ChatGPT PASS
  6. Heartbeat status (Watcher & Agy status)
  7. Evidence status (Task files list with GitHub links)
  8. Latest commit SHA (Task commits tracking with links)
  9. Blocking issue (Active warnings and issues list)
- Modified `scripts/run-ai-inbox.sh` to run the task indexer (generate-task-index.js) on watcher startup to process any pending ChatGPT reviews first, aligned state JSON filenames to drop the `.md` suffix, and integrated the evidence collector.

Files changed:
- dashboard.html
- scripts/generate-task-index.js
- scripts/run-ai-inbox.sh

Gatekeeper v3 preserved: yes

Task index path:
.ai/task-index.json

Dashboard URL:
dashboard.html

Evidence packet example:
.ai/reports/task-20260603-control-tower-evidence-review-flow/evidence.json

PASS flow test result:
Passed (Verified via scripts/test-audit-loop.js)

FAIL flow test result:
Passed (Verified via scripts/test-audit-loop.js)

Commit SHA:
b3ec3877f507467664c0a2429599d24e7dca7556

Known limitations:
- Watcher daemon cannot modify the script `/Users/happygolucky/mindmap-watcher.sh` directly (hard rule), but updates to `scripts/run-ai-inbox.sh` will apply to any processes executing inside the repository. Self-healing evidence generation inside generate-task-index.js successfully bypasses watcher modifications.
