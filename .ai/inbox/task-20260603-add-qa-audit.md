# Task: Add automated live-page QA
target: us-macro-dashboard

## Goal
Add an automated audit script that opens the live page, takes a screenshot, checks for errors, and writes a report.

## What to create

### scripts/audit-live.js (using Playwright)

Install Playwright first:
```bash
npm init -y  # if no package.json
npx playwright install chromium
```

The script must:
1. Open https://nickchen494949.github.io/us-macro-dashboard/
2. Wait until dashboard fully renders (wait for network idle + 3 seconds)
3. Fail if page is 404 / blank / still shows "Loading"
4. Fail if console has JS errors
5. Fail if main title "US Macro Weather" not found in page text
6. Count macro indicator cards on page
7. Extract all visible page text → save to `.ai/reports/latest-page-text.txt`
8. Save full-page screenshot → `.ai/reports/latest-screenshot.png`
9. Save structured JSON result → `.ai/reports/latest-audit.json` with:
   - url
   - timestamp
   - pass (true/false)
   - errors (array of strings)
   - cardCount
   - pageTitle
   - weatherState (if detected)
10. Exit code 0 if pass, 1 if fail

### After creating the script, RUN IT immediately:
```bash
mkdir -p .ai/reports
node scripts/audit-live.js
```

### Then commit and push ALL results:
```bash
git add -A
git commit -m "add QA audit + first report"
git push
```

## Files to create/modify
- scripts/audit-live.js [NEW]
- .ai/reports/latest-audit.json [NEW - generated]
- .ai/reports/latest-page-text.txt [NEW - generated]
- .ai/reports/latest-screenshot.png [NEW - generated]
- package.json [MODIFY - add playwright dependency]

## Do NOT touch
- Do not modify any existing dashboard files (index.html, src/*, cache/*)
- Only ADD the audit script and reports
