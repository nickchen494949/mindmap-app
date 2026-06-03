# Task 005: Add page title display

## Goal
Add a small text label at the top-left corner of the canvas that shows the current tab/workspace name.

## Read first
- `.ai/ROLES.md`
- `PROJECT_CONTEXT.md`  
- `.ai/RULES.md`

## What to do

In `app.js`, find where tabs are switched or loaded. When a tab is active, display its name in a small label on the canvas.

Add this CSS to `style.css`:
```css
#canvas-title {
  position: absolute;
  top: 60px;
  left: 16px;
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
  z-index: 100;
  pointer-events: none;
  letter-spacing: 0.5px;
}
```

Add a `<div id="canvas-title"></div>` element inside the `#canvas-container` in `index.html`.

In `app.js`, update the canvas title text whenever a tab is switched. Look for the tab switching logic and add:
```javascript
document.getElementById('canvas-title').textContent = currentTabName;
```

## Success check
- A small grey text appears top-left showing the current workspace/tab name
- Text updates when switching tabs
- Does NOT break any existing functionality

## Files to modify
- `style.css` — add CSS
- `index.html` — add div
- `app.js` — update on tab switch
