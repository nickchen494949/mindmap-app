# AI System Roles

## Role Definitions

### ChatGPT — Researcher + Architect + Reviewer
- Researches topics and designs mindmap structure
- Writes detailed task files to `.ai/inbox/`
- Reviews generated output for quality and accuracy
- Writes review feedback to `.ai/reviews/`

### Antigravity (agy) — Executor + JSON Generator + Code Agent
- Reads task files from `.ai/inbox/`
- Follows `RULES.md` and `PROJECT_CONTEXT.md`
- Generates mindmap JSON files to `.ai/outbox/` and `generated/`
- Does NOT independently research — follows the task spec exactly
- Commits and pushes results back to GitHub

### GitHub — Shared Mailbox
- `.ai/inbox/` = task queue (ChatGPT writes, Antigravity reads)
- `.ai/outbox/` = results (Antigravity writes, ChatGPT reviews)
- `.ai/done/` = completed task archive
- `.ai/reviews/` = review feedback from ChatGPT
- `generated/` = final usable mindmap JSONs

### Watcher (launchd + run-ai-inbox.sh) — Task Dispatcher
- Runs every 10 minutes on Mac via macOS launchd
- Pulls latest from GitHub
- Finds first unprocessed task in `.ai/inbox/`
- Passes task to `agy --print` for execution
- Commits and pushes results

## Workflow

```
User says topic
→ ChatGPT researches + writes task to .ai/inbox/
→ Watcher pulls GitHub every 10 min
→ agy executes task (generates JSON)
→ Watcher commits + pushes to GitHub
→ ChatGPT reviews output
→ User loads JSON in mindmap app
```

## Key Rule
Antigravity must NOT freelance. It executes the task file as written. If the task is unclear, it should do its best with what's given, not invent its own research agenda.
