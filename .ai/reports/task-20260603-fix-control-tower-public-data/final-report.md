Implemented: Created a public sanitized data mirror (control-tower-data.json) at the repo root and updated dashboard.html to fetch this mirror first, using its sanitized stats, tasks, and watcher heartbeat fields. Added warning banners for missing/stale public mirror, invalid done status, missing evidence, and tasks waiting for ChatGPT audit, and configured a legacy fallback mechanism to status.json and internal .ai/ folders to prevent showing zero tasks.
Files changed:
- scripts/generate-task-index.js
- dashboard.html
Public data path: control-tower-data.json
Dashboard data source: control-tower-data.json (primary), with fallbacks to status.json, .ai/task-index.json, and .ai/heartbeat/watcher.json
Heartbeat result: Exposes the sanitized heartbeat from watcher.json (alive/stale/missing, lastSeen, lastScannedCommit, and status stats counts)
Task count result: Total: 19, Pending: 1, Running: 1, Needs ChatGPT Audit: 1, Done: 0, Failed: 1, Invalid Done: 13
Commit SHA: c61f2693a2e45b894d9182b23030927a97e75ff7
Known limitations: Browser CORS security policies block client-side fetch requests to control-tower-data.json when opened directly via the file:// protocol. The dashboard displays a helpful instructions card to guide users to run a local web server (e.g. npx http-server) when file:// protocol is detected.
