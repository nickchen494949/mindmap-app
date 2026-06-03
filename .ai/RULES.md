# AI Agent Rules

## General
- Read the task file completely before starting.
- Do NOT modify app code (app.js, index.html, style.css) unless the task explicitly asks for code changes.
- Write output files to `.ai/outbox/` and/or `generated/`.
- Keep output JSON compatible with the mindmap app's load format: `{ "nodes": [...], "arrows": [...] }`.

## Mindmap Generation Rules
- Max 30 nodes per map unless told otherwise.
- Every arrow MUST have a label (verb or relationship).
- Use Chinese labels by default unless told otherwise.
- Avoid textbook dumps. Explain like talking to a smart friend.
- Center node should be the main topic.
- Use logical grouping with group nodes where appropriate.

## Layout Rules (CRITICAL - prevents visual chaos)
- Max 5 main branches. If topic has more, merge related branches.
- Each branch is a VERTICAL column: parent on top, children below.
- Column spacing: at least 300px between branch columns (x gap).
- Row spacing: at least 150px between rows (y gap).
- Center node at top center. Main branches spread below it.
- Children MUST be directly below their parent node (same x coordinate).
- Arrows between parent and child: use fromPort="bottom", toPort="top".
- NEVER draw arrows that cross another branch's column space.
- For horizontal relationships across branches: use fromPort="right", toPort="left" and place connected nodes at the SAME y level.
- Node width (nw): minimum 180px for readability.
- AVOID chain-only layouts. Use fan-out: one parent connecting to 3-5 children side by side.

## Node Format
Each node object: `{ "id": number, "x": number, "y": number, "label": "名字", "desc": "描述", "bg": "#ffffff", "border": "#6366f1" }`

## Arrow Format  
Each arrow object: `{ "from": nodeId, "fromPort": "bottom", "to": nodeId, "toPort": "top", "label": "关系动词", "color": "#6366f1" }`

## Safety
- Do NOT delete existing files unless asked.
- Do NOT expose secrets or API keys.
- Do NOT install packages unless asked.
