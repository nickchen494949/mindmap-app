target: mindmap-app

# Fix Task for task-20260603-control-tower-evidence-review-flow (Attempt 2)

The previous execution of this task was audited by ChatGPT and returned a **FAIL** verdict.

### ChatGPT Blocking Issues:
- Dashboard loads with 404 error: local page load failed, console and network errors present.
- Evidence packet generation might be complete, but the core deliverables (dashboard, task index, review flow) could not be verified due to deployment failure.
- Local server test failed to serve dashboard, making it impossible to confirm many of the acceptance criteria (e.g., red flags, columns, etc.).
- No explicit test results provided for Test 1-5 (inbox visibility, review gate, PASS/FAIL flows, invalid done red flag).
- Notes:
- Commit SHA 5311370d77ce2f70087e6cdc3733be3418d688f6 exists, showing code changes.
- Evidence JSON metadata is well-structured and includes necessary fields.
- The .ai/task-index.json and scripts/generate-task-index.js are present, indicating work on Required Work A.
- Files like dashboard.html, scripts/collect-evidence.js, scripts/test-audit-loop.js show progress on B, C, D.
- However, the execution summary reports local page load FAILED and the page text shows '404 Not Found', indicating the deployment/build is broken.
- # Suggested Fix Task
- ```markdown
- target: mindmap-app
- # Fix Task
- Fix the dashboard and evidence/review system deployment so it works locally and passes all acceptance criteria.
- ## Issues to Fix
- **Dashboard local page load failure**: The dashboard returns 404 when served locally. Ensure the HTML file is properly served and the server is configured correctly.
- **Console and network errors**: There is a 404 error for the page itself; verify the URL and file paths.
- **Red flags not verifiable**: Since the dashboard is not loading, red flags for stale heartbeat, missing evidence, etc., cannot be checked. Fix the deployment so these red flags are visible.
- **Test results missing**: Run the test script `scripts/test-audit-loop.js` and ensure all five test cases pass. Document results.
- **Final report incomplete**: The final report must include all required sections (files changed, Gatekeeper v3 preserved, task index path, dashboard URL, evidence packet example, PASS/FAIL test results, commit SHA, known limitations).
- ## Acceptance Criteria
- Dashboard loads without errors (no 404, no console/network errors).
- All red flags are displayed correctly.
- Test 1-5 pass.
- Final report written to `.ai/reports/task-20260603-control-tower-evidence-review-flow/final-report.md` with all required fields.
- All Gatekeeper v3 protections remain intact.
- ```
- Confidence: 0.95
- Reviewed by DeepSeek API.

### Task ID mapping:
Please reuse the same state file: task-20260603-control-tower-evidence-review-flow.json
