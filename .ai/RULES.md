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

## Node Format
Each node object: `{ "id": number, "x": number, "y": number, "label": "名字", "desc": "描述", "bg": "#ffffff", "border": "#6366f1" }`

## Arrow Format  
Each arrow object: `{ "from": nodeId, "fromPort": "bottom", "to": nodeId, "toPort": "top", "label": "关系动词", "color": "#6366f1" }`

## Safety
- Do NOT delete existing files unless asked.
- Do NOT expose secrets or API keys.
- Do NOT install packages unless asked.
