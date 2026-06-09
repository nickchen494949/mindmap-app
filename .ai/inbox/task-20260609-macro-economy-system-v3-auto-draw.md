target: mindmap-app

# Task
Re-run the macro economy system mindmap now that the app coding may support automatic drawing/import.

## Goal
Use the current updated app code to automatically draw/load the macro economy system diagram, not merely create a hidden JSON file.

## Source files to read first
- `PROJECT_CONTEXT.md`
- `.ai/RULES.md`
- `generated/macro-economy-system-v2.json`
- `.ai/outbox/macro-economy-system-v2.json`
- current `index.html`, `app.js`, `style.css`

## What to do
1. Inspect the current app code and find the new automatic drawing/import mechanism.
2. Use `generated/macro-economy-system-v2.json` as the canonical diagram content unless you find it invalid.
3. Make the macro economy diagram automatically available in the app using the new automation path.
4. If the app now supports auto-loading from a generated file, wire/load `generated/macro-economy-system-v2.json` through that path.
5. If the app expects a specific project/workspace format, create the needed wrapper file without changing the v2 source JSON.
6. Generate any new output under:
   - `.ai/outbox/`
   - `generated/`
   - or the app's current auto-load location, if the code clearly defines one.
7. Run the app or the available validation command to confirm the diagram loads/draws.
8. Capture evidence in `.ai/reports/task-20260609-macro-economy-system-v3-auto-draw/` if the existing evidence system is available.

## Important constraints
- Do NOT delete v1 or v2 files.
- Do NOT modify watcher scripts.
- Do NOT install packages.
- Do NOT touch secrets or tokens.
- Only modify app code if the existing automation path is broken and a minimal fix is necessary.
- Prefer configuration/data files over code changes.

## Expected visible result
After watcher runs, the user should be able to open the app and see/load the macro economy system diagram without manually hunting through folders.

## Required outputs
At minimum, produce or confirm one of these:
- `generated/macro-economy-system-v3-auto-draw.json`
- `.ai/outbox/macro-economy-system-v3-auto-draw.json`
- an app-recognized auto-load/project file that points to or contains the macro economy system diagram

## Diagram quality checks
The final drawn diagram should still answer:
一个国家为什么变强/变弱？风险最早从哪个主体、哪条链条露出来？

It must keep:
- `国家经济系统` as the entry point
- `比较筛选`
- `国内五主体`
- `四条传导链`
- `宏观状态输出`
- 企业 split: `强企业`, `弱企业/僵尸企业`
- 居民 split: `高级员工`, `普通员工`, `零工/失业边缘`
- color logic: 蓝=利率链, 绿=资金链, 橙=实体收入链, 红=风险链

## Final summary
When done, summarize:
1. which file was used as source,
2. which file was generated/updated,
3. how the app now auto-loads or auto-draws it,
4. whether validation passed.
