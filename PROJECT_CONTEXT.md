# 系统图 (System Dynamics Mindmap App)

## What is this project?
A browser-based visual mindmap/system dynamics diagram tool for personal knowledge management.

## Core Features
- Drag-and-drop nodes with labels, descriptions, colors
- Arrows with labels connecting nodes (curve/straight, single/bidirectional)
- Group nodes (dashed containers)
- Multi-tab workspaces with auto-save to localStorage
- Hyperlink sub-maps: any node can link to a deeper sub-diagram tab
- Export to PNG, Save/Load project as JSON (all tabs preserved)
- AI import: paste JSON to generate diagrams

## Tech Stack
- Pure HTML + CSS + JavaScript (no framework, no build step)
- Single page: `index.html`, `app.js`, `style.css`
- Runs by opening `index.html` in a browser

## File Structure
```
index.html          - UI structure
app.js              - All app logic (state, rendering, events, export, tabs)
style.css           - All styling
.ai/inbox/          - Task files for AI agent to pick up
.ai/outbox/         - AI agent writes results here
.ai/done/           - Completed tasks moved here
.ai/logs/           - Execution logs
.ai/RULES.md        - Rules the AI agent must follow
scripts/            - Automation scripts
```

## JSON Format for Mindmaps
```json
{
  "nodes": [
    { "id": 1, "x": 200, "y": 120, "label": "节点名", "desc": "", "bg": "#ffffff", "border": "#6366f1" }
  ],
  "arrows": [
    { "from": 1, "fromPort": "bottom", "to": 2, "toPort": "top", "label": "关系", "color": "#6366f1" }
  ]
}
```

## Multi-tab Project Format (version 2)
```json
{
  "version": 2,
  "activeWorkspaceId": "abc123",
  "workspaces": [
    { "id": "abc123", "name": "主图", "state": { "nodes": [], "arrows": [], "nextId": 1, "zoom": 1, "panX": 0, "panY": 0 } }
  ]
}
```

## Key Principles
- User is Chinese-speaking. Default language for labels and UI is Chinese.
- Keep the app simple. No build tools, no npm, no frameworks.
- AI agents should NOT modify app.js/index.html/style.css unless explicitly asked.
- AI-generated mindmaps go to `.ai/outbox/` as JSON files.
