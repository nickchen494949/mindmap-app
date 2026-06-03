/* ── State ── */
// Workspaces (Tabs) state
let workspaces = [];
let activeWorkspaceId = null;

const state = {
  nodes: [],
  arrows: [],
  mode: 'add-node', // add-node | add-arrow | select
  selectedNode: null,
  selectedArrow: null,
  arrowStart: null,  // {nodeId, port}
  dragNode: null,
  dragOffset: { x: 0, y: 0 },
  didDrag: false,
  nextId: 1,
  // Zoom & Pan
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  spaceHeld: false,
  panMoved: false,
  wasPanning: false,
  arrowStyle: 'curve',
  arrowDirection: 'single', // 'single' | 'double'
  dragMode: 'branch', // 'node' | 'branch'
};

/* ── DOM refs ── */
const tabsContainer = document.getElementById('tabs-container');
const btnAddTab = document.getElementById('btn-add-tab');
const nodeLayer = document.getElementById('node-layer');
const arrowLayer = document.getElementById('arrow-layer');
const canvas = document.getElementById('canvas-container');
const transformGroup = document.getElementById('transform-group');
const statusText = document.getElementById('status-text');
const editorPanel = document.getElementById('node-editor');
const zoomInfo = document.getElementById('zoom-info');

/* ── SVG defs (arrowhead markers) ── */
function initSVG() {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '12');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '11');
  marker.setAttribute('refY', '4');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,0 L12,4 L0,8 L3,4 Z');
  path.setAttribute('fill', '#6366f1');
  marker.appendChild(path);
  defs.appendChild(marker);

  // Reverse arrowhead for bidirectional arrows
  const marker2 = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker2.setAttribute('id', 'arrowhead-start');
  marker2.setAttribute('markerWidth', '12');
  marker2.setAttribute('markerHeight', '8');
  marker2.setAttribute('refX', '1');
  marker2.setAttribute('refY', '4');
  marker2.setAttribute('orient', 'auto');
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M12,0 L0,4 L12,8 L9,4 Z');
  path2.setAttribute('fill', '#6366f1');
  marker2.appendChild(path2);
  defs.appendChild(marker2);

  arrowLayer.appendChild(defs);
}
initSVG();

/* ── Workspace & Tabs Logic ── */
function generateId() { return Math.random().toString(36).substr(2, 9); }

function saveCurrentWorkspaceState() {
  if (!activeWorkspaceId) return;
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  if (ws) {
    ws.state = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      arrows: JSON.parse(JSON.stringify(state.arrows)),
      nextId: state.nextId,
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY
    };
  }
}

function loadWorkspaceState(ws) {
  state.nodes = JSON.parse(JSON.stringify(ws.state.nodes || []));
  state.arrows = JSON.parse(JSON.stringify(ws.state.arrows || []));
  state.nextId = ws.state.nextId || 1;
  state.zoom = ws.state.zoom || 1;
  state.panX = ws.state.panX || 0;
  state.panY = ws.state.panY || 0;
  
  // Clear selection state
  state.selectedNode = null;
  state.selectedArrow = null;
  state.dragNode = null;
  editorPanel.classList.add('hidden');
  
  refreshNodes();
  refreshArrows();
  transformGroup.style.transform = `scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  zoomInfo.textContent = Math.round(state.zoom * 100) + '%';
  saveToLocalStorage();
}

function renderTabs() {
  tabsContainer.innerHTML = '';
  workspaces.forEach(ws => {
    const tab = document.createElement('div');
    tab.className = `tab ${ws.id === activeWorkspaceId ? 'active' : ''}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = ws.name;
    nameSpan.title = ws.name;
    
    nameSpan.ondblclick = (e) => {
      e.stopPropagation();
      const newName = prompt('重命名标签页', ws.name);
      if (newName && newName.trim() !== '') {
        ws.name = newName.trim();
        renderTabs();
        saveToLocalStorage();
      }
    };
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeWorkspace(ws.id);
    };
    
    tab.onclick = () => switchWorkspace(ws.id);
    
    // Show link indicator for sub-map tabs
    if (ws.parentWorkspaceId) {
      const indicator = document.createElement('span');
      indicator.textContent = '🔗 ';
      indicator.style.fontSize = '10px';
      indicator.style.opacity = '0.7';
      tab.insertBefore(indicator, tab.firstChild);
    }
    
    tab.appendChild(nameSpan);
    tab.appendChild(closeBtn);
    tabsContainer.appendChild(tab);
  });
}

function createWorkspace(name = '画布 ' + (workspaces.length + 1), data = null) {
  saveCurrentWorkspaceState();
  const id = generateId();
  const newWs = {
    id,
    name,
    state: data || { nodes: [], arrows: [], nextId: 1, zoom: 1, panX: 0, panY: 0 }
  };
  workspaces.push(newWs);
  activeWorkspaceId = id;
  loadWorkspaceState(newWs);
  renderTabs();
}

function switchWorkspace(id) {
  if (id === activeWorkspaceId) return;
  saveCurrentWorkspaceState();
  activeWorkspaceId = id;
  const ws = workspaces.find(w => w.id === id);
  if (ws) {
    loadWorkspaceState(ws);
    renderTabs();
  }
}

function closeWorkspace(id) {
  if (workspaces.length === 1) {
    if (confirm('确定要清空唯一的画布吗？')) {
      workspaces[0].state = { nodes: [], arrows: [], nextId: 1, zoom: 1, panX: 0, panY: 0 };
      loadWorkspaceState(workspaces[0]);
    }
    return;
  }

  const ws = workspaces.find(w => w.id === id);

  // Clean up: clear linkedWorkspaceId on parent node
  if (ws && ws.parentWorkspaceId && ws.parentNodeId) {
    const parentWs = workspaces.find(w => w.id === ws.parentWorkspaceId);
    if (parentWs && parentWs.state && parentWs.state.nodes) {
      const parentNode = parentWs.state.nodes.find(n => n.id === ws.parentNodeId);
      if (parentNode) parentNode.linkedWorkspaceId = null;
    }
    // Also clean live state if parent is the active workspace
    if (ws.parentWorkspaceId === activeWorkspaceId) {
      const liveNode = state.nodes.find(n => n.id === ws.parentNodeId);
      if (liveNode) {
        liveNode.linkedWorkspaceId = null;
        refreshNodes();
      }
    }
  }

  // Also recursively close any child sub-maps of this workspace
  const childWsIds = [];
  if (ws && ws.state && ws.state.nodes) {
    ws.state.nodes.forEach(n => {
      if (n.linkedWorkspaceId) childWsIds.push(n.linkedWorkspaceId);
    });
  }
  
  const idx = workspaces.findIndex(w => w.id === id);
  workspaces.splice(idx, 1);

  // Remove orphaned children
  childWsIds.forEach(cid => {
    const ci = workspaces.findIndex(w => w.id === cid);
    if (ci >= 0) workspaces.splice(ci, 1);
  });
  
  if (id === activeWorkspaceId) {
    const nextWs = workspaces[Math.max(0, idx - 1)];
    activeWorkspaceId = nextWs.id;
    loadWorkspaceState(nextWs);
  }
  renderTabs();
  saveToLocalStorage();
}

// Attach Add Tab event
if (btnAddTab) btnAddTab.onclick = () => createWorkspace();

/* ── Hyperlink Sub-Map (Drill Into Node) ── */
function drillIntoNode(nodeId) {
  const n = state.nodes.find(nd => nd.id === nodeId);
  if (!n) return;

  // If this node already has a linked workspace, navigate to it
  if (n.linkedWorkspaceId) {
    const existing = workspaces.find(w => w.id === n.linkedWorkspaceId);
    if (existing) {
      switchWorkspace(existing.id);
      return;
    }
    // Linked workspace was deleted, clear the stale reference
    n.linkedWorkspaceId = null;
  }

  // Create a new workspace linked to this node
  const id = generateId();
  n.linkedWorkspaceId = id; // Set link BEFORE saving parent state
  saveCurrentWorkspaceState(); // Now parent state includes the linkedWorkspaceId
  const newWs = {
    id,
    name: n.label + ' (子图)',
    parentWorkspaceId: activeWorkspaceId,
    parentNodeId: nodeId,
    state: { nodes: [], arrows: [], nextId: 1, zoom: 1, panX: 0, panY: 0 }
  };
  workspaces.push(newWs);
  activeWorkspaceId = id;
  loadWorkspaceState(newWs);
  renderTabs();

  triggerAutoSave();
  statusText.textContent = `已进入 "${n.label}" 的子图，可以在此继续展开分支`;
}

/* ── LocalStorage Auto-Save ── */
function saveToLocalStorage() {
  saveCurrentWorkspaceState();
  localStorage.setItem('sysMapWorkspaces', JSON.stringify(workspaces));
  localStorage.setItem('sysMapActiveId', activeWorkspaceId);
}

function loadFromLocalStorage() {
  try {
    const savedWs = localStorage.getItem('sysMapWorkspaces');
    const savedActiveId = localStorage.getItem('sysMapActiveId');
    if (savedWs) {
      workspaces = JSON.parse(savedWs);
      activeWorkspaceId = savedActiveId || workspaces[0].id;
      const ws = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
      activeWorkspaceId = ws.id;
      loadWorkspaceState(ws);
      renderTabs();
      return true;
    }
  } catch(e) { console.error('Failed to load from local storage', e); }
  return false;
}

// Auto-save triggers are hooked up to state modification functions.
// We will intercept changes and call saveToLocalStorage().
// To keep it simple, we just hook saveToLocalStorage() into functions that mutate state.
function triggerAutoSave() {
  saveToLocalStorage();
}

/* ── Toolbar ── */
document.getElementById('btn-add-node').onclick = () => setMode('add-node');
document.getElementById('btn-add-arrow').onclick = () => setMode('add-arrow');
document.getElementById('btn-select').onclick = () => setMode('select');
document.getElementById('btn-add-group').onclick = () => setMode('add-group');
document.getElementById('btn-delete').onclick = deleteSelected;
document.getElementById('btn-clear').onclick = clearAll;
document.getElementById('btn-export').onclick = exportPNG;
document.getElementById('btn-save').onclick = saveJSON;
document.getElementById('btn-load').onclick = loadJSON;
document.getElementById('edit-apply').onclick = applyEdit;
document.getElementById('edit-drill').onclick = () => {
  if (state.selectedNode !== null) {
    applyEdit(); // save any pending edits first
    drillIntoNode(state.selectedNode);
  }
};
document.getElementById('btn-toggle-line').onclick = () => {
  state.arrowStyle = state.arrowStyle === 'curve' ? 'straight' : 'curve';
  document.querySelector('#btn-toggle-line').textContent = state.arrowStyle === 'curve' ? '曲线连线' : '直线连线';
  if (state.selectedArrow) {
    const a = state.arrows.find(ar => ar.id === state.selectedArrow);
    if (a) {
      a.isStraight = state.arrowStyle === 'straight';
      refreshArrows();
    }
  }
};
document.getElementById('btn-toggle-dir').onclick = () => {
  state.arrowDirection = state.arrowDirection === 'single' ? 'double' : 'single';
  const isDouble = state.arrowDirection === 'double';
  document.getElementById('btn-toggle-dir').textContent = isDouble ? '⇄ 双向' : '→ 单向';
  if (state.selectedArrow) {
    const a = state.arrows.find(ar => ar.id === state.selectedArrow);
    if (a) {
      a.bidir = isDouble;
      refreshArrows();
    }
  }
};
document.getElementById('btn-drag-mode').onclick = () => {
  state.dragMode = state.dragMode === 'branch' ? 'node' : 'branch';
  const btn = document.getElementById('btn-drag-mode');
  const isBranch = state.dragMode === 'branch';
  btn.querySelector('span').textContent = isBranch ? '整支移动' : '单节点';
  btn.classList.toggle('active', isBranch);
  statusText.textContent = isBranch ? '拖动时将移动整个分支' : '拖动时只移动单个节点';
};
document.getElementById('btn-zoom-in').onclick = () => zoomBy(0.15);
document.getElementById('btn-zoom-out').onclick = () => zoomBy(-0.15);
document.getElementById('zoom-info').onclick = resetView;

// Make zoom controls draggable
(function() {
  const zc = document.getElementById('zoom-controls');
  let drag = false, didDrag = false, sx, sy, sl, st;
  zc.addEventListener('mousedown', (e) => {
    if (e.target.closest('.zoom-btn')) return; // let buttons work
    drag = true; didDrag = false;
    const r = zc.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX-sx)>3||Math.abs(e.clientY-sy)>3) didDrag = true;
    if (didDrag) {
      zc.style.left = (sl + e.clientX - sx) + 'px';
      zc.style.top = (st + e.clientY - sy) + 'px';
      zc.style.right = 'auto'; zc.style.bottom = 'auto';
    }
  });
  document.addEventListener('mouseup', () => { drag = false; });
})();

/* ── Zoom & Pan ── */
function applyTransform() {
  transformGroup.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  zoomInfo.textContent = Math.round(state.zoom * 100) + '%';
}

function zoomBy(delta) {
  const oldZoom = state.zoom;
  state.zoom = Math.min(3, Math.max(0.2, state.zoom + delta));
  // Zoom toward center of canvas
  const cr = canvas.getBoundingClientRect();
  const cx = cr.width / 2, cy = cr.height / 2;
  state.panX = cx - (cx - state.panX) * (state.zoom / oldZoom);
  state.panY = cy - (cy - state.panY) * (state.zoom / oldZoom);
  applyTransform();
  refreshArrows();
}

function zoomAtPoint(delta, px, py) {
  const oldZoom = state.zoom;
  state.zoom = Math.min(3, Math.max(0.2, state.zoom + delta));
  state.panX = px - (px - state.panX) * (state.zoom / oldZoom);
  state.panY = py - (py - state.panY) * (state.zoom / oldZoom);
  applyTransform();
  refreshArrows();
  triggerAutoSave();
}

function resetView() {
  state.zoom = 1; state.panX = 0; state.panY = 0;
  applyTransform();
  refreshArrows();
  triggerAutoSave();
}

/* ── Locate & Highlight (for AI) ── */
function highlightNodes(labels) {
  const found = [];
  labels.forEach(label => {
    const n = state.nodes.find(nd => nd.label === label);
    if (!n) return;
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (el) { el.classList.add('ai-highlight'); found.push(n); }
  });
  return found;
}

// Trace full branch: ancestors (up) + descendants (down) + highlight arrows
function highlightBranch(label) {
  const n = state.nodes.find(nd => nd.label === label);
  if (!n) return [];

  const visited = new Set();
  const arrowIds = new Set();

  // Walk UP (find ancestors via incoming arrows)
  function walkUp(id) {
    if (visited.has(id)) return;
    visited.add(id);
    state.arrows.forEach(a => {
      if (a.to === id && !visited.has(a.from)) {
        arrowIds.add(a.id);
        walkUp(a.from);
      }
    });
  }

  // Walk DOWN (find descendants via outgoing arrows)
  function walkDown(id) {
    if (visited.has(id)) return;
    visited.add(id);
    state.arrows.forEach(a => {
      if (a.from === id && !visited.has(a.to)) {
        arrowIds.add(a.id);
        walkDown(a.to);
      }
    });
  }

  walkUp(n.id);
  visited.delete(n.id); // reset so walkDown includes it
  walkDown(n.id);

  // Highlight all nodes in the branch
  const found = [];
  visited.forEach(id => {
    const nd = state.nodes.find(x => x.id === id);
    if (!nd) return;
    const el = nodeLayer.querySelector(`[data-id="${id}"]`);
    if (el) { el.classList.add('ai-highlight'); found.push(nd); }
  });

  // Highlight arrows
  arrowIds.forEach(aid => {
    const g = arrowLayer.querySelector(`[data-id="${aid}"]`);
    if (g) g.classList.add('arrow-highlight');
  });

  return found;
}

function unhighlightAll() {
  nodeLayer.querySelectorAll('.node.ai-highlight').forEach(el => el.classList.remove('ai-highlight'));
  arrowLayer.querySelectorAll('.arrow-highlight').forEach(el => el.classList.remove('arrow-highlight'));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') unhighlightAll(); });

function locateNode(label) {
  const n = state.nodes.find(nd => nd.label === label);
  if (!n) return false;
  const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
  if (!el) return false;
  // Pan to center the node on screen
  const cr = canvas.getBoundingClientRect();
  const nw = el.offsetWidth, nh = el.offsetHeight;
  const targetX = cr.width / 2 - (n.x + nw / 2) * state.zoom;
  const targetY = cr.height / 2 - (n.y + nh / 2) * state.zoom;
  // Smooth transition
  transformGroup.style.transition = 'transform 0.5s ease';
  state.panX = targetX;
  state.panY = targetY;
  applyTransform();
  setTimeout(() => { transformGroup.style.transition = ''; refreshArrows(); }, 550);
  // Highlight it
  highlightNodes([label]);
  return true;
}

/* ── Map API (for AI) ── */
window.mapAPI = {
  // Query
  getNodes() { return state.nodes.map(n => ({ id: n.id, label: n.label, desc: n.desc || '', x: n.x, y: n.y })); },
  getEdges() { return state.arrows.map(a => { const f = state.nodes.find(n=>n.id===a.from); const t = state.nodes.find(n=>n.id===a.to); return { from: f?.label, to: t?.label, label: a.label || '' }; }); },
  findNode(label) { return state.nodes.find(n => n.label === label); },

  // Create
  addNode(label, desc, nearLabel, color) {
    let x = 300 + Math.random()*200, y = 200 + Math.random()*200;
    if (nearLabel) { const ref = state.nodes.find(n=>n.label===nearLabel); if(ref){x=ref.x+160;y=ref.y+30;} }
    return createNode(x, y, label, desc||'', color||'#ffffff', '#6366f1');
  },
  addEdge(fromLabel, toLabel, label) {
    const f = state.nodes.find(n=>n.label===fromLabel), t = state.nodes.find(n=>n.label===toLabel);
    if(!f||!t) return null;
    const bp = bestPorts(f,t); return createArrow(f.id, bp.fromPort, t.id, bp.toPort, label||'');
  },

  // Modify
  editNode(label, props) {
    const n = state.nodes.find(nd=>nd.label===label); if(!n) return false;
    if(props.label) n.label = props.label;
    if(props.desc !== undefined) n.desc = props.desc;
    if(props.color) n.bg = props.color;
    if(props.border) n.border = props.border;
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if(el){ el.querySelector('.label').textContent=n.label; if(props.color)el.style.background=n.bg; if(props.border)el.style.borderColor=n.border; }
    return true;
  },

  // Delete
  deleteNode(label) {
    const n = state.nodes.find(nd=>nd.label===label); if(!n) return false;
    state.arrows = state.arrows.filter(a=>a.from!==n.id&&a.to!==n.id);
    state.nodes = state.nodes.filter(nd=>nd.id!==n.id);
    nodeLayer.querySelector(`[data-id="${n.id}"]`)?.remove();
    refreshArrows(); return true;
  },
  deleteEdge(fromLabel, toLabel) {
    const idx = state.arrows.findIndex(a=>{ const f=state.nodes.find(n=>n.id===a.from); const t=state.nodes.find(n=>n.id===a.to); return f?.label===fromLabel&&t?.label===toLabel; });
    if(idx<0) return false;
    const aid=state.arrows[idx].id; state.arrows.splice(idx,1); arrowLayer.querySelector(`[data-id="${aid}"]`)?.remove(); return true;
  },

  // Visual
  highlight(labels) { return highlightNodes(Array.isArray(labels)?labels:[labels]); },
  highlightBranch(label) { return highlightBranch(label); },
  unhighlight() { unhighlightAll(); },
  locate(label) { return locateNode(label); },

  // Bulk
  clear() { state.nodes=[]; state.arrows=[]; nodeLayer.innerHTML=''; arrowLayer.querySelectorAll('g').forEach(g=>g.remove()); },
  resetView() { resetView(); },
  refreshArrows() { refreshArrows(); },

  // Log (shows result in status bar)
  log(msg) { statusText.textContent = msg; }
};

// Convert screen coords to canvas coords (accounting for zoom+pan)
function screenToCanvas(clientX, clientY) {
  const cr = canvas.getBoundingClientRect();
  return {
    x: (clientX - cr.left - state.panX) / state.zoom,
    y: (clientY - cr.top - state.panY) / state.zoom
  };
}

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const map = { 'add-node': 'btn-add-node', 'add-arrow': 'btn-add-arrow', 'select': 'btn-select', 'add-group': 'btn-add-group' };
  if (map[m]) document.getElementById(map[m]).classList.add('active');
  document.body.classList.toggle('arrow-mode', m === 'add-arrow');
  canvas.style.cursor = m === 'select' ? 'default' : 'crosshair';
  const msgs = { 'add-node': '点击画布添加节点', 'add-arrow': '点击第一个节点开始连线', 'select': '点击选择节点或箭头', 'add-group': '点击画布添加分组容器' };
  statusText.textContent = msgs[m] || '就绪';
  deselectAll();
  state.arrowStart = null;
  removeTempArrow();
}

/* ── Auto-detect best ports based on relative positions ── */
function bestPorts(fromNode, toNode) {
  const fEl = nodeLayer.querySelector(`[data-id="${fromNode.id}"]`);
  const tEl = nodeLayer.querySelector(`[data-id="${toNode.id}"]`);
  const fCx = fromNode.x + fEl.offsetWidth / 2, fCy = fromNode.y + fEl.offsetHeight / 2;
  const tCx = toNode.x + tEl.offsetWidth / 2, tCy = toNode.y + tEl.offsetHeight / 2;
  const dx = tCx - fCx, dy = tCy - fCy;
  let fromPort, toPort;
  // STRICTLY use top/bottom for any vertical connection, as requested by user
  if (Math.abs(dy) > 30) {
    fromPort = dy > 0 ? 'bottom' : 'top';
    toPort = dy > 0 ? 'top' : 'bottom';
  } else {
    fromPort = dx > 0 ? 'right' : 'left';
    toPort = dx > 0 ? 'left' : 'right';
  }
  return { fromPort, toPort };
}

/* ── Create Node ── */
function createNode(x, y, label, desc, bg, border, id, isGroup, gw, gh, nw, nh) {
  const nid = id || state.nextId++;
  if (!id && nid >= state.nextId) state.nextId = nid + 1;
  const n = { id: nid, x, y, label: label || '新节点', desc: desc || '', bg: bg || '#ffffff', border: border || '#6366f1', isGroup: isGroup || false, gw: gw || 300, gh: gh || 200, nw: nw || 0, nh: nh || 0 };
  state.nodes.push(n);
  renderNode(n);
  return n;
}

function createGroup(x, y, label) {
  return createNode(x, y, label || '分组', '', 'rgba(99,102,241,0.04)', '#a5b4fc', null, true);
}

// Find nodes whose center is inside a group's bounds
function getChildrenOfGroup(group) {
  const el = nodeLayer.querySelector(`[data-id="${group.id}"]`);
  if (!el) return [];
  const gw = group.gw || el.offsetWidth;
  const gh = group.gh || el.offsetHeight;
  return state.nodes.filter(n => {
    if (n.id === group.id || n.isGroup) return false;
    const nel = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (!nel) return false;
    const cx = n.x + nel.offsetWidth / 2;
    const cy = n.y + nel.offsetHeight / 2;
    return cx >= group.x && cx <= group.x + gw && cy >= group.y && cy <= group.y + gh;
  });
}

/* ── Find all descendants of a node via outgoing arrows (recursive) ── */
function getDescendants(nodeId) {
  const result = [];
  const visited = new Set();
  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    state.arrows.forEach(a => {
      if (a.from === id && !visited.has(a.to)) {
        result.push(a.to);
        walk(a.to);
      }
    });
  }
  walk(nodeId);
  return state.nodes.filter(n => result.includes(n.id));
}

function renderNode(n) {
  const el = document.createElement('div');
  el.className = n.isGroup ? 'node group-node' : 'node';
  el.dataset.id = n.id;
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';
  if (n.isGroup) {
    el.style.width = (n.gw || 300) + 'px';
    el.style.height = (n.gh || 200) + 'px';
    el.style.background = n.bg;
    el.style.borderColor = n.border;
  } else {
    el.style.background = n.bg;
    el.style.borderColor = n.border;
    if (n.nw) el.style.width = n.nw + 'px';
    if (n.nh) el.style.minHeight = n.nh + 'px';
  }
  el.innerHTML = `<span class="label">${n.label}</span>${n.desc && n.showDesc ? '<div class="desc">' + n.desc + '</div>' : ''}
    <div class="port top" data-port="top"></div>
    <div class="port bottom" data-port="bottom"></div>
    <div class="port left" data-port="left"></div>
    <div class="port right" data-port="right"></div>
    <div class="rh rh-n" data-rh="n"></div>
    <div class="rh rh-s" data-rh="s"></div>
    <div class="rh rh-e" data-rh="e"></div>
    <div class="rh rh-w" data-rh="w"></div>
    <div class="rh rh-ne" data-rh="ne"></div>
    <div class="rh rh-nw" data-rh="nw"></div>
    <div class="rh rh-se" data-rh="se"></div>
    <div class="rh rh-sw" data-rh="sw"></div>
    ${n.isGroup ? '<div class="resize-handle"></div>' : ''}
    ${n.linkedWorkspaceId ? '<div class="submap-badge" data-action="drill" title="点击进入子图">🔗</div>' : ''}`;

  // Click on submap badge to drill in
  const badge = el.querySelector('.submap-badge');
  if (badge) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      drillIntoNode(n.id);
    });
  }

  // Click node
  el.addEventListener('click', (e) => {
    // If we are in add-node mode and click on a group, we want to create a node inside it!
    // So we don't stop propagation, and we don't select the group.
    if (state.mode === 'add-node' && n.isGroup) {
      return; // Let it bubble to canvas
    }
    
    e.stopPropagation();
    if (state.didDrag) { state.didDrag = false; return; }
    
    // In these modes, clicking a node selects it
    if (state.mode === 'select' || state.mode === 'add-node' || state.mode === 'add-group') {
      selectNode(n.id);
      return;
    }
    if (state.mode !== 'add-arrow') return;
    const clickedPort = e.target.dataset.port;
    if (!state.arrowStart) {
      // First click — start arrow from this node
      state.arrowStart = { nodeId: n.id, port: clickedPort };
      el.classList.add('selected');
      statusText.textContent = `从 "${n.label}" 开始 → 点击目标节点或连接点完成连线`;
      // Start temp arrow from port center if a port was clicked, else node center
      let sx, sy;
      if (clickedPort && e.target.classList.contains('port')) {
        const rect = e.target.getBoundingClientRect();
        sx = rect.left + rect.width / 2;
        sy = rect.top + rect.height / 2;
      } else {
        const rect = el.getBoundingClientRect();
        sx = rect.left + rect.width / 2;
        sy = rect.top + rect.height / 2;
      }
      const fakeE = { clientX: sx, clientY: sy };
      startTempArrow(fakeE);
    } else if (state.arrowStart.nodeId !== n.id) {
      // Second click — finish arrow to this node
      const fromNode = state.nodes.find(nd => nd.id === state.arrowStart.nodeId);
      const autoPorts = bestPorts(fromNode, n);
      const fromPort = state.arrowStart.port || autoPorts.fromPort;
      const toPort = clickedPort || autoPorts.toPort;
      createArrow(state.arrowStart.nodeId, fromPort, n.id, toPort, '', document.getElementById('arrow-color').value, null, state.arrowStyle === 'straight', state.arrowDirection === 'double');
      // Reset for next arrow
      nodeLayer.querySelectorAll('.node.selected').forEach(e => e.classList.remove('selected'));
      state.arrowStart = null;
      removeTempArrow();
      statusText.textContent = '连线完成！点击下一个节点继续连线';
      triggerAutoSave();
    }
  });

  // Node drag (works in select and add-node modes)
  el.addEventListener('mousedown', (e) => {
    if (state.mode === 'add-arrow') return;
    if (e.target.classList.contains('port')) return;
    
    // Resize handles (8-point directional)
    if (e.target.dataset.rh) {
      state.resizingGroup = n.id;
      state.resizeDir = e.target.dataset.rh;
      state.resizeStart = screenToCanvas(e.clientX, e.clientY);
      const rel = nodeLayer.querySelector(`[data-id="${n.id}"]`);
      if (n.isGroup) {
        state.resizeOrigRect = { x: n.x, y: n.y, w: n.gw || 300, h: n.gh || 200 };
      } else {
        state.resizeOrigRect = { x: n.x, y: n.y, w: n.nw || (rel ? rel.offsetWidth : 100), h: n.nh || (rel ? rel.offsetHeight : 50) };
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Legacy resize handle for groups
    if (e.target.classList.contains('resize-handle') && n.isGroup) {
      state.resizingGroup = n.id;
      state.resizeDir = 'se';
      state.resizeStart = screenToCanvas(e.clientX, e.clientY);
      state.resizeOrigRect = { x: n.x, y: n.y, w: n.gw || 300, h: n.gh || 200 };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // If in add-node mode and clicking on a group, don't drag the group, let the canvas click handle it
    if (state.mode === 'add-node' && n.isGroup) {
      return;
    }
    
    state.dragNode = n.id;
    state.didDrag = false;
    const pt = screenToCanvas(e.clientX, e.clientY);
    state.dragOffset = { x: pt.x - n.x, y: pt.y - n.y };
    
    // Capture children before dragging (group: spatial children, regular: arrow descendants)
    if (n.isGroup) {
      state.dragGroupChildren = getChildrenOfGroup(n).map(c => ({ id: c.id, ox: c.x - n.x, oy: c.y - n.y }));
    } else if (state.dragMode === 'branch') {
      const descendants = getDescendants(n.id);
      state.dragGroupChildren = descendants.length > 0
        ? descendants.map(c => ({ id: c.id, ox: c.x - n.x, oy: c.y - n.y }))
        : null;
    } else {
      state.dragGroupChildren = null;
    }
    
    el.style.cursor = 'grabbing';
    e.preventDefault();
  });

  // Double-click to edit
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (state.mode === 'add-arrow') return;
    selectNode(n.id);
    showEditor(n);
  });

  nodeLayer.appendChild(el);
}

function refreshNodes() {
  nodeLayer.innerHTML = '';
  state.nodes.forEach(n => renderNode(n));
}

/* ── Arrow ── */
function createArrow(fromId, fromPort, toId, toPort, label, color, id, isStraight, bidir, mark) {
  const aid = id || 'a' + state.nextId++;
  const col = color || '#6366f1';
  const a = { id: aid, from: fromId, fromPort, to: toId, toPort, label: label || '', color: col, isStraight: isStraight || false, bidir: bidir || false, mark: mark || null };
  state.arrows.push(a);
  renderArrow(a);
  return a;
}

function renderArrow(a) {
  const pts = getArrowPoints(a);
  if (!pts) return;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.dataset.id = a.id;

  const curvePath = buildCurvePath(pts.x1, pts.y1, pts.x2, pts.y2, a.fromPort, a.toPort, a.isStraight, a.from, a.to);

  // Invisible wide hit-area for easy clicking
  const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  hitArea.setAttribute('d', curvePath);
  hitArea.setAttribute('stroke', 'transparent');
  hitArea.setAttribute('stroke-width', '24');
  hitArea.setAttribute('fill', 'none');
  hitArea.style.cursor = 'pointer';
  hitArea.style.pointerEvents = 'all';
  hitArea.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  hitArea.addEventListener('click', (e) => { e.stopPropagation(); selectArrow(a.id); });
  hitArea.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const pts2 = getArrowPoints(a);
    if (pts2) {
      const mid = getArrowMidpoint(a, pts2);
      showArrowLabelEditor(a, mid.x, mid.y);
    }
  });
  hitArea.addEventListener('mouseenter', () => {
    const p = g.querySelector('.arrow-line');
    if (p && !p.classList.contains('selected')) p.classList.add('hover-highlight');
  });
  hitArea.addEventListener('mouseleave', () => {
    const p = g.querySelector('.arrow-line');
    if (p) p.classList.remove('hover-highlight');
  });
  g.appendChild(hitArea);

  // Visible arrow
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', curvePath);
  path.setAttribute('class', 'arrow-line');
  path.setAttribute('stroke', a.color);
  path.setAttribute('marker-end', 'url(#arrowhead)');
  if (a.bidir) {
    path.setAttribute('marker-start', 'url(#arrowhead-start)');
  }
  g.appendChild(path);

  // Label
  const { x: mx, y: my } = getArrowMidpoint(a, pts);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', mx);
  txt.setAttribute('y', my - 8);
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('class', 'arrow-label');
  txt.textContent = a.label || '';
  txt.addEventListener('click', () => selectArrow(a.id));
  txt.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    showArrowLabelEditor(a, mx, my);
  });
  g.appendChild(txt);

  // Mark icon (✓ or ✗)
  if (a.mark) {
    const markG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markG.setAttribute('class', 'arrow-mark');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', mx);
    circle.setAttribute('cy', my + 10);
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', a.mark === 'tick' ? '#10b981' : '#ef4444');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2');
    markG.appendChild(circle);
    const markTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    markTxt.setAttribute('x', mx);
    markTxt.setAttribute('y', my + 15);
    markTxt.setAttribute('text-anchor', 'middle');
    markTxt.setAttribute('fill', '#fff');
    markTxt.setAttribute('font-size', '13');
    markTxt.setAttribute('font-weight', 'bold');
    markTxt.style.pointerEvents = 'none';
    markTxt.textContent = a.mark === 'tick' ? '✓' : '✗';
    markG.appendChild(markTxt);
    g.appendChild(markG);
  }

  arrowLayer.appendChild(g);
}

function buildCurvePath(x1, y1, x2, y2, fp, tp, isStraight, arrowFrom, arrowTo) {
  if (isStraight) {
    return `M${x1},${y1} L${x2},${y2}`;
  }
  const dist = Math.hypot(x2 - x1, y2 - y1);
  let curve = Math.min(dist * 0.4, 150);

  // Check if the basic curve would pass through any node and increase offset if so
  const padding = 20;
  for (const n of state.nodes) {
    if (n.id === arrowFrom || n.id === arrowTo) continue;
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (!el) continue;
    const nw = el.offsetWidth, nh = el.offsetHeight;
    const nx1 = n.x - padding, ny1 = n.y - padding;
    const nx2 = n.x + nw + padding, ny2 = n.y + nh + padding;
    // Sample 10 points along the basic bezier and check collision
    const offsets = { top: [0, -curve], bottom: [0, curve], left: [-curve, 0], right: [curve, 0] };
    const cx1t = x1 + (offsets[fp]?.[0] || 0), cy1t = y1 + (offsets[fp]?.[1] || 0);
    const cx2t = x2 + (offsets[tp]?.[0] || 0), cy2t = y2 + (offsets[tp]?.[1] || 0);
    let hit = false;
    for (let t = 0.1; t <= 0.9; t += 0.1) {
      const it = 1 - t;
      const px = it*it*it*x1 + 3*it*it*t*cx1t + 3*it*t*t*cx2t + t*t*t*x2;
      const py = it*it*it*y1 + 3*it*it*t*cy1t + 3*it*t*t*cy2t + t*t*t*y2;
      if (px > nx1 && px < nx2 && py > ny1 && py < ny2) { hit = true; break; }
    }
    if (hit) {
      curve = Math.min(curve * 2.5, 300);
      break;
    }
  }

  const offsets = { top: [0, -curve], bottom: [0, curve], left: [-curve, 0], right: [curve, 0] };
  const [cx1, cy1] = [x1 + (offsets[fp]?.[0] || 0), y1 + (offsets[fp]?.[1] || 0)];
  const [cx2, cy2] = [x2 + (offsets[tp]?.[0] || 0), y2 + (offsets[tp]?.[1] || 0)];
  return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

function getArrowPoints(a) {
  const fromNode = state.nodes.find(n => n.id === a.from);
  const toNode = state.nodes.find(n => n.id === a.to);
  if (!fromNode || !toNode) return null;
  const fromEl = nodeLayer.querySelector(`[data-id="${a.from}"]`);
  const toEl = nodeLayer.querySelector(`[data-id="${a.to}"]`);
  if (!fromEl || !toEl) return null;
  const fw = fromEl.offsetWidth, fh = fromEl.offsetHeight;
  const tw = toEl.offsetWidth, th = toEl.offsetHeight;
  const portOffsets = {
    top:    (w, h) => [w / 2, 0],
    bottom: (w, h) => [w / 2, h],
    left:   (w, h) => [0, h / 2],
    right:  (w, h) => [w, h / 2]
  };
  const [fox, foy] = portOffsets[a.fromPort](fw, fh);
  const [tox, toy] = portOffsets[a.toPort](tw, th);
  return {
    x1: fromNode.x + fox,
    y1: fromNode.y + foy,
    x2: toNode.x + tox,
    y2: toNode.y + toy
  };
}

function getArrowMidpoint(a, pts) {
  if (a.isStraight) {
    return { x: (pts.x1 + pts.x2) / 2, y: (pts.y1 + pts.y2) / 2 };
  }
  const dist = Math.hypot(pts.x2 - pts.x1, pts.y2 - pts.y1);
  const curve = Math.min(dist * 0.4, 80);
  const offsets = { top: [0, -curve], bottom: [0, curve], left: [-curve, 0], right: [curve, 0] };
  const cx1 = pts.x1 + (offsets[a.fromPort]?.[0] || 0);
  const cy1 = pts.y1 + (offsets[a.fromPort]?.[1] || 0);
  const cx2 = pts.x2 + (offsets[a.toPort]?.[0] || 0);
  const cy2 = pts.y2 + (offsets[a.toPort]?.[1] || 0);
  
  const mx = 0.125 * pts.x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * pts.x2;
  const my = 0.125 * pts.y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * pts.y2;
  return { x: mx, y: my };
}

function refreshArrows() {
  arrowLayer.querySelectorAll('g').forEach(g => g.remove());
  state.arrows.forEach(a => renderArrow(a));
}

/* ── Temp arrow for drawing ── */
let tempLine = null;
function startTempArrow(e) {
  tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tempLine.setAttribute('class', 'temp-arrow');
  const pt = screenToCanvas(e.clientX, e.clientY);
  tempLine.setAttribute('x1', pt.x);
  tempLine.setAttribute('y1', pt.y);
  tempLine.setAttribute('x2', pt.x);
  tempLine.setAttribute('y2', pt.y);
  arrowLayer.appendChild(tempLine);
}
function removeTempArrow() {
  if (tempLine) { tempLine.remove(); tempLine = null; }
}

/* ── Canvas events ── */
// Hit-test: find arrow near a canvas point
function findArrowAtPoint(canvasX, canvasY, threshold) {
  const thr = threshold || 15;
  let bestArrow = null, bestDist = Infinity;
  for (const a of state.arrows) {
    const pts = getArrowPoints(a);
    if (!pts) continue;
    // Compute bezier control points (same as buildCurvePath)
    if (a.isStraight) {
       // Simple distance from line segment
       const d = distToSegment(canvasX, canvasY, pts.x1, pts.y1, pts.x2, pts.y2);
       if (d < bestDist) { bestDist = d; bestArrow = a; }
    } else {
      const dist = Math.hypot(pts.x2 - pts.x1, pts.y2 - pts.y1);
      const curve = Math.min(dist * 0.4, 80);
      const offsets = { top: [0, -curve], bottom: [0, curve], left: [-curve, 0], right: [curve, 0] };
      const cx1 = pts.x1 + (offsets[a.fromPort]?.[0] || 0);
      const cy1 = pts.y1 + (offsets[a.fromPort]?.[1] || 0);
      const cx2 = pts.x2 + (offsets[a.toPort]?.[0] || 0);
      const cy2 = pts.y2 + (offsets[a.toPort]?.[1] || 0);
      // Sample cubic bezier
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const u = 1 - t;
        const bx = u*u*u*pts.x1 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*pts.x2;
        const by = u*u*u*pts.y1 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*pts.y2;
        const d = Math.hypot(canvasX - bx, canvasY - by);
        if (d < bestDist) { bestDist = d; bestArrow = a; }
      }
    }
  }
  return bestDist < thr ? bestArrow : null;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2-x1)**2 + (y2-y1)**2;
  if (l2 === 0) return Math.hypot(px-x1, py-y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

canvas.addEventListener('click', (e) => {
  if (e.detail >= 2) return; // ignore double-click (handled by dblclick event)
  if (state.wasPanning) { state.wasPanning = false; return; }
  
  const closestNode = e.target.closest('.node');
  const isGroupNodeClick = closestNode && closestNode.classList.contains('group-node');
  
  if ((closestNode && !isGroupNodeClick) || e.target.closest('.port')) return;
  if (e.target.closest('#zoom-controls')) return;
  if (e.target.closest('#toolbar')) return;

  const pt = screenToCanvas(e.clientX, e.clientY);

  // Check if clicking near an arrow
  if (state.mode === 'select' || state.mode === 'add-node') {
    const hitArrow = findArrowAtPoint(pt.x, pt.y, 20);
    if (hitArrow) {
      selectArrow(hitArrow.id);
      return;
    }
  }

  // If we clicked a group node but we are in select mode, we just want to select it, not create a node inside it
  if (isGroupNodeClick && state.mode === 'select') {
    return; // The node's own click handler already took care of selecting it
  }

  if (state.mode === 'add-node') {
    const n = createNode(pt.x - 50, pt.y - 20, '新节点');
    selectNode(n.id);
    showEditor(n);
    setTimeout(() => {
      const inp = document.getElementById('edit-label');
      inp.focus();
      inp.select();
    }, 50);
    triggerAutoSave();
  } else if (state.mode === 'add-group') {
    const g = createGroup(pt.x - 150, pt.y - 20);
    selectNode(g.id);
    showEditor(g);
    setTimeout(() => {
      const inp = document.getElementById('edit-label');
      inp.focus();
      inp.select();
    }, 50);
    triggerAutoSave();
  } else {
    deselectAll();
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (e.target.closest('.node') || e.target.closest('#zoom-controls') || e.target.closest('#toolbar')) return;
  // Don't start panning when clicking on arrow elements
  if (e.target.closest('#arrow-layer g')) return;
  if (e.button === 2) return; // ignore right-click
  e.preventDefault();
  state.isPanning = true;
  state.panMoved = false;
  state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
  canvas.classList.add('panning');
});

document.addEventListener('mousemove', (e) => {
  // Panning
  if (state.isPanning) {
    const dx = e.clientX - state.panStart.x - state.panX;
    const dy = e.clientY - state.panStart.y - state.panY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.panMoved = true;
    state.panX = e.clientX - state.panStart.x;
    state.panY = e.clientY - state.panStart.y;
    applyTransform();
    refreshArrows();
    return;
  }
  // Temp arrow
  if (tempLine) {
    const pt = screenToCanvas(e.clientX, e.clientY);
    tempLine.setAttribute('x2', pt.x);
    tempLine.setAttribute('y2', pt.y);
  }
  // Resize node (directional)
  if (state.resizingGroup) {
    const pt = screenToCanvas(e.clientX, e.clientY);
    const gn = state.nodes.find(n => n.id === state.resizingGroup);
    if (gn) {
      const dx = pt.x - state.resizeStart.x;
      const dy = pt.y - state.resizeStart.y;
      const orig = state.resizeOrigRect;
      const dir = state.resizeDir || 'se';
      let newX = orig.x, newY = orig.y, newW = orig.w, newH = orig.h;
      const minW = gn.isGroup ? 180 : 60;
      const minH = gn.isGroup ? 100 : 30;

      if (dir.includes('e')) newW = orig.w + dx;
      if (dir.includes('w')) { newW = orig.w - dx; newX = orig.x + dx; }
      if (dir.includes('s')) newH = orig.h + dy;
      if (dir.includes('n')) { newH = orig.h - dy; newY = orig.y + dy; }

      // Enforce minimums and fix position
      if (newW < minW) { if (dir.includes('w')) newX = orig.x + orig.w - minW; newW = minW; }
      if (newH < minH) { if (dir.includes('n')) newY = orig.y + orig.h - minH; newH = minH; }

      gn.x = newX;
      gn.y = newY;
      const gel = nodeLayer.querySelector(`[data-id="${gn.id}"]`);
      if (gn.isGroup) {
        gn.gw = newW; gn.gh = newH;
        if (gel) { gel.style.left = gn.x + 'px'; gel.style.top = gn.y + 'px'; gel.style.width = gn.gw + 'px'; gel.style.height = gn.gh + 'px'; }
      } else {
        gn.nw = newW; gn.nh = newH;
        if (gel) { gel.style.left = gn.x + 'px'; gel.style.top = gn.y + 'px'; gel.style.width = gn.nw + 'px'; gel.style.minHeight = gn.nh + 'px'; }
      }
      refreshArrows();
    }
    return;
  }
  // Drag node
  if (state.dragNode !== null) {
    const pt = screenToCanvas(e.clientX, e.clientY);
    const n = state.nodes.find(n => n.id === state.dragNode);
    if (!n) return;
    n.x = pt.x - state.dragOffset.x;
    n.y = pt.y - state.dragOffset.y;
    state.didDrag = true;
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    
    // Move group children
    if (state.dragGroupChildren) {
      state.dragGroupChildren.forEach(c => {
        const child = state.nodes.find(nd => nd.id === c.id);
        if (!child) return;
        child.x = n.x + c.ox;
        child.y = n.y + c.oy;
        const cel = nodeLayer.querySelector(`[data-id="${child.id}"]`);
        if (cel) { cel.style.left = child.x + 'px'; cel.style.top = child.y + 'px'; }
      });
    }
    
    refreshArrows();
  }
});

document.addEventListener('mouseup', (e) => {
  if (state.isPanning) {
    state.isPanning = false;
    state.wasPanning = state.panMoved;
    canvas.classList.remove('panning');
    return;
  }
  if (state.resizingGroup) {
    state.resizingGroup = null;
    return;
  }
  if (state.dragNode !== null) {
    const el = nodeLayer.querySelector(`[data-id="${state.dragNode}"]`);
    if (el) el.style.cursor = 'grab';
    state.dragNode = null;
    state.dragGroupChildren = null;
  }
});

// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const cr = canvas.getBoundingClientRect();
  const px = e.clientX - cr.left;
  const py = e.clientY - cr.top;
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  zoomAtPoint(delta, px, py);
}, { passive: false });

/* ── Selection ── */
function selectNode(id) {
  deselectAll();
  state.selectedNode = id;
  const el = nodeLayer.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('selected');
  statusText.textContent = `已选择节点: ${state.nodes.find(n => n.id === id)?.label || id}`;
}

function selectArrow(id) {
  deselectAll();
  state.selectedArrow = id;
  const g = arrowLayer.querySelector(`[data-id="${id}"]`);
  if (g) g.querySelector('path')?.classList.add('selected');
  const a = state.arrows.find(ar => ar.id === id);
  // Show mark buttons in status bar
  statusText.innerHTML = `已选择箭头 &nbsp;
    <button class="mark-btn mark-tick" title="标记 ✓">✓</button>
    <button class="mark-btn mark-x" title="标记 ✗">✗</button>
    <button class="mark-btn mark-clear" title="清除标记">○</button>`;
  statusText.querySelector('.mark-tick').onclick = () => { setArrowMark(id, 'tick'); };
  statusText.querySelector('.mark-x').onclick = () => { setArrowMark(id, 'x'); };
  statusText.querySelector('.mark-clear').onclick = () => { setArrowMark(id, null); };
}

function setArrowMark(id, mark) {
  const a = state.arrows.find(ar => ar.id === id);
  if (!a) return;
  a.mark = mark;
  refreshArrows();
  selectArrow(id);
}

function deselectAll() {
  state.selectedNode = null;
  state.selectedArrow = null;
  nodeLayer.querySelectorAll('.node.selected').forEach(e => e.classList.remove('selected'));
  arrowLayer.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
  editorPanel.classList.add('hidden');
  if (state.arrowStart) {
    state.arrowStart = null;
    removeTempArrow();
    if (state.mode === 'add-arrow') statusText.textContent = '点击第一个节点开始连线';
  }
}

/* ── Delete ── */
function deleteSelected() {
  if (state.selectedNode !== null) {
    const id = state.selectedNode;
    state.arrows = state.arrows.filter(a => a.from !== id && a.to !== id);
    state.nodes = state.nodes.filter(n => n.id !== id);
    nodeLayer.querySelector(`[data-id="${id}"]`)?.remove();
    refreshArrows();
    deselectAll();
    statusText.textContent = '节点已删除';
  } else if (state.selectedArrow) {
    const id = state.selectedArrow;
    state.arrows = state.arrows.filter(a => a.id !== id);
    arrowLayer.querySelector(`[data-id="${id}"]`)?.remove();
    deselectAll();
    statusText.textContent = '箭头已删除';
  }
  triggerAutoSave();
}

let clearPending = false;
function clearAll() {
  if (!clearPending) {
    clearPending = true;
    statusText.textContent = '⚠️ 再次点击"清空"确认清除所有内容';
    setTimeout(() => { clearPending = false; statusText.textContent = '已取消清空'; }, 3000);
    return;
  }
  clearPending = false;
  state.nodes = []; state.arrows = [];
  nodeLayer.innerHTML = '';
  arrowLayer.querySelectorAll('g').forEach(g => g.remove());
  deselectAll();
  statusText.textContent = '画布已清空';
  triggerAutoSave();
}

/* ── Editor Panel (Popup Window) ── */
// Drag popup by header
(function() {
  const header = document.getElementById('editor-header');
  let isDragging = false, startX, startY, startLeft, startTop;
  header.addEventListener('mousedown', (e) => {
    if (e.target.id === 'editor-close') return;
    isDragging = true;
    const rect = editorPanel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    editorPanel.style.left = (startLeft + dx) + 'px';
    editorPanel.style.top = (startTop + dy) + 'px';
    editorPanel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
})();

// Close button
document.getElementById('editor-close').onclick = () => {
  editorPanel.classList.add('hidden');
};

function showEditor(n) {
  editorPanel.classList.remove('hidden');
  document.getElementById('edit-label').value = n.label;
  document.getElementById('edit-desc').value = n.desc || '';
  document.getElementById('edit-show-desc').checked = !!n.showDesc;
  
  const colorRow = document.getElementById('edit-color-row');
  const sizeRow = document.getElementById('edit-size-row');
  if (n.isGroup) {
    colorRow.style.display = 'none';
    sizeRow.style.display = 'flex';
    document.getElementById('edit-width').value = Math.round(n.gw || 300);
    document.getElementById('edit-height').value = Math.round(n.gh || 200);
  } else {
    colorRow.style.display = 'block';
    sizeRow.style.display = 'flex';
    document.getElementById('edit-bg').value = n.bg;
    document.getElementById('edit-border').value = n.border;
    // Highlight active swatches
    document.querySelectorAll('#bg-swatches .swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === n.bg);
    });
    document.querySelectorAll('#border-swatches .swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === n.border);
    });
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    document.getElementById('edit-width').value = Math.round(n.nw || (el ? el.offsetWidth : 100));
    document.getElementById('edit-height').value = Math.round(n.nh || (el ? el.offsetHeight : 50));
  }

  // Update drill button
  const drillBtn = document.getElementById('edit-drill');
  if (n.linkedWorkspaceId && workspaces.find(w => w.id === n.linkedWorkspaceId)) {
    drillBtn.textContent = '🔗 进入子图 →';
    drillBtn.style.background = 'rgba(16,185,129,0.12)';
    drillBtn.style.borderColor = '#10b981';
    drillBtn.style.color = '#059669';
  } else {
    drillBtn.textContent = '🔗 创建子图';
    drillBtn.style.background = 'rgba(99,102,241,0.1)';
    drillBtn.style.borderColor = '#6366f1';
    drillBtn.style.color = '#6366f1';
  }
}

// Color swatch click handlers
document.querySelectorAll('#bg-swatches .swatch').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#bg-swatches .swatch').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('edit-bg').value = btn.dataset.color;
  };
});
document.querySelectorAll('#border-swatches .swatch').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#border-swatches .swatch').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('edit-border').value = btn.dataset.color;
  };
});

// Reset size button
document.getElementById('edit-reset-size').onclick = () => {
  const n = state.nodes.find(n => n.id === state.selectedNode);
  if (!n || n.isGroup) return;
  n.nw = 0;
  n.nh = 0;
  const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
  if (el) {
    el.style.width = '';
    el.style.minHeight = '';
  }
  refreshArrows();
  // Update the inputs to show actual size
  setTimeout(() => {
    const el2 = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (el2) {
      document.getElementById('edit-width').value = el2.offsetWidth;
      document.getElementById('edit-height').value = el2.offsetHeight;
    }
  }, 50);
  statusText.textContent = '已重置为自动大小';
};

function applyEdit() {
  const n = state.nodes.find(n => n.id === state.selectedNode);
  if (!n) return;
  n.label = document.getElementById('edit-label').value;
  n.desc = document.getElementById('edit-desc').value;
  n.showDesc = document.getElementById('edit-show-desc').checked;
  
  if (!n.isGroup) {
    n.bg = document.getElementById('edit-bg').value;
    n.border = document.getElementById('edit-border').value;
  }

  // Apply size
  const newW = parseInt(document.getElementById('edit-width').value) || 0;
  const newH = parseInt(document.getElementById('edit-height').value) || 0;
  if (n.isGroup) {
    n.gw = Math.max(180, newW);
    n.gh = Math.max(100, newH);
  } else {
    n.nw = Math.max(60, newW);
    n.nh = Math.max(30, newH);
  }
  
  const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
  if (el) {
    el.querySelector('.label').textContent = n.label;
    let descEl = el.querySelector('.desc');
    if (n.desc && n.showDesc) {
      if (!descEl) { descEl = document.createElement('div'); descEl.className = 'desc'; el.insertBefore(descEl, el.querySelector('.port')); }
      descEl.textContent = n.desc;
    } else if (descEl) descEl.remove();
    
    if (n.isGroup) {
      el.style.width = n.gw + 'px';
      el.style.height = n.gh + 'px';
    } else {
      el.style.background = n.bg;
      el.style.borderColor = n.border;
      el.style.width = n.nw + 'px';
      el.style.minHeight = n.nh + 'px';
    }
  }
  editorPanel.classList.add('hidden');
  refreshArrows();
  statusText.textContent = '节点已更新';
  triggerAutoSave();
}

/* ── Save / Load ── */
function saveJSON() {
  saveCurrentWorkspaceState();
  const projectData = {
    version: 2,
    activeWorkspaceId: activeWorkspaceId,
    workspaces: workspaces
  };
  const data = JSON.stringify(projectData, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '动力图工程_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  statusText.textContent = '已保存全部 ' + workspaces.length + ' 个标签页';
}

function loadJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        
        if (data.version === 2 && data.workspaces) {
          // New multi-workspace format: restore all tabs
          saveCurrentWorkspaceState();
          data.workspaces.forEach(ws => {
            workspaces.push(ws);
          });
          const targetId = data.activeWorkspaceId || data.workspaces[0].id;
          activeWorkspaceId = targetId;
          const ws = workspaces.find(w => w.id === targetId) || workspaces[workspaces.length - 1];
          activeWorkspaceId = ws.id;
          loadWorkspaceState(ws);
          renderTabs();
          statusText.textContent = '已加载 ' + data.workspaces.length + ' 个标签页！';
        } else {
          // Old single-workspace format (backward compatible)
          let maxId = 0;
          (data.nodes || []).forEach(n => {
            if (n.id > maxId) maxId = n.id;
          });
          
          let tabName = file.name.replace('.json', '');
          if (tabName.includes('_')) tabName = tabName.split('_')[0];
          
          createWorkspace(tabName, {
            nodes: data.nodes || [],
            arrows: data.arrows || [],
            nextId: maxId + 1,
            zoom: 1,
            panX: 0,
            panY: 0
          });
          statusText.textContent = '加载成功，已在新标签页打开！';
        }
      } catch (err) { alert('文件格式错误: ' + err.message); }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ── Export PNG ── */
function exportPNG() {
  // Use html2canvas-like approach via SVG foreignObject
  const nodes = nodeLayer.querySelectorAll('.node');
  if (nodes.length === 0) { alert('画布为空'); return; }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.nodes.forEach(n => {
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (!el) return;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + el.offsetWidth);
    maxY = Math.max(maxY, n.y + el.offsetHeight);
  });
  const pad = 60;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;

  // Dynamically calculate scale to avoid browser canvas limits (max area ~268MP, max dim ~32767)
  let scale = 2; // preferred high-DPI
  const maxArea = 200_000_000;
  const maxDim = 32000;
  
  if (w * scale > maxDim || h * scale > maxDim || (w * scale * h * scale) > maxArea) {
    // reduce scale to fit
    const scaleDim = Math.min(maxDim / w, maxDim / h);
    const scaleArea = Math.sqrt(maxArea / (w * h));
    scale = Math.min(scale, scaleDim, scaleArea);
  }
  
  // Also, if scale ends up very small, at least try to give them something (though quality drops)
  scale = Math.max(scale, 0.1);

  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Draw arrows
  state.arrows.forEach(a => {
    const pts = getArrowPoints(a);
    if (!pts) return;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const cr = canvas.getBoundingClientRect();
    const x1 = pts.x1 - minX + pad, y1 = pts.y1 - minY + pad;
    const x2 = pts.x2 - minX + pad, y2 = pts.y2 - minY + pad;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(angle - 0.4), y2 - 12 * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - 12 * Math.cos(angle + 0.4), y2 - 12 * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fill();
    
    // Arrow Label
    if (a.label) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.fillText(a.label, midX, midY - 10);
    }
  });

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    let words = text.split('');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n];
      let metrics = context.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    let startY = y - (lines.length - 1) * lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      context.fillText(lines[i], x, startY + (i * lineHeight));
    }
  }

  // Draw nodes
  state.nodes.forEach(n => {
    const el = nodeLayer.querySelector(`[data-id="${n.id}"]`);
    if (!el) return;
    const nx = n.x - minX + pad, ny = n.y - minY + pad;
    const nw = el.offsetWidth, nh = el.offsetHeight;
    
    ctx.fillStyle = n.bg;
    ctx.strokeStyle = n.border;
    ctx.lineWidth = 2;
    if (n.isGroup) ctx.setLineDash([6, 6]);
    else ctx.setLineDash([]);
    
    roundRect(ctx, nx, ny, nw, nh, 12);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); // Reset
    
    ctx.fillStyle = '#111827';
    ctx.font = '500 15px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Padding inside node for text
    wrapText(ctx, n.label, nx + nw / 2, ny + nh / 2, nw - 20, 20);
  });

  const link = document.createElement('a');
  link.download = '动力图_' + new Date().toISOString().slice(0, 10) + '.png';
  link.href = c.toDataURL();
  link.click();
  
  statusText.textContent = '已导出PNG图片。源文件请点击“保存工程”。';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Keyboard ── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') e.target.blur();
    deselectAll();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  if (e.key === '1') setMode('add-node');
  if (e.key === '2') setMode('add-arrow');
  if (e.key === '3') setMode('select');
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(0.15); }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-0.15); }
  if (e.key === '0') { e.preventDefault(); resetView(); }
  if (e.key === ' ') { e.preventDefault(); state.spaceHeld = true; document.body.classList.add('space-held'); }
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ') { state.spaceHeld = false; document.body.classList.remove('space-held'); }
});

/* ── Helpers ── */
function adjustColor(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  const num = parseInt(c, 16);
  let r = Math.min(255, Math.max(0, (num >> 16) + amount));
  let g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  let b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ── Inline Arrow Label Editor ── */
function showArrowLabelEditor(a, svgX, svgY) {
  // Remove any existing inline editor
  const old = document.getElementById('arrow-label-editor');
  if (old) old.remove();

  const cr = canvas.getBoundingClientRect();
  const inp = document.createElement('input');
  inp.id = 'arrow-label-editor';
  inp.type = 'text';
  inp.value = a.label || '';
  inp.placeholder = '输入标签...';
  
  // Calculate actual screen coordinates
  const screenX = svgX * state.zoom + state.panX;
  const screenY = svgY * state.zoom + state.panY;

  inp.style.cssText = `
    position:absolute; left:${screenX - 60}px; top:${screenY - 24}px;
    width:120px; padding:4px 8px; background:#ffffff;
    border:1px solid #6366f1; border-radius:6px; color:#111827;
    font-size:13px; font-family:inherit; outline:none; z-index:300;
    text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.12);
  `;
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { a.label = inp.value; inp.remove(); refreshArrows(); triggerAutoSave(); }
    if (e.key === 'Escape') inp.remove();
  });
  inp.addEventListener('blur', () => { a.label = inp.value; inp.remove(); refreshArrows(); triggerAutoSave(); });
  canvas.appendChild(inp);
  inp.focus();
  inp.select();
}

/* ── Demo: recreate screenshot diagram ── */
function loadDemo() {
  createWorkspace('默认画布');
  const n1 = createNode(200, 120, '政府');
  const n2 = createNode(450, 120, '央行');
  const n3 = createNode(420, 280, '银行');
  const n4 = createNode(420, 420, '企业');
  const n5 = createNode(300, 540, '员工');
  createArrow(n2.id, 'left', n1.id, 'right', '', '#0f3460');
  createArrow(n1.id, 'bottom', n5.id, 'top', '', '#0f3460');
  createArrow(n3.id, 'bottom', n4.id, 'top', '', '#0f3460');
  setMode('select');
  triggerAutoSave();
}

if (!loadFromLocalStorage()) {
  loadDemo();
}
document.getElementById('btn-drag-mode').classList.add('active');

/* ── Presentation / Slideshow Mode ── */
let presMode = false;
let presOrder = [];   // ordered list of node IDs to present
let presIndex = -1;
let presSrtData = []; // for SRT export
let presAutoTimer = null; // auto-play timer
let presAutoPlaying = true; // auto-play state

function buildPresOrder() {
  const childSet = new Set(state.arrows.map(a => a.to));
  const parentSet = new Set(state.arrows.map(a => a.from));

  // Root = nodes that are parents but not children, or if none, the topmost node
  let roots = state.nodes.filter(n => parentSet.has(n.id) && !childSet.has(n.id));
  if (roots.length === 0 && state.nodes.length > 0) {
    roots = [state.nodes.reduce((a, b) => a.y < b.y ? a : b)];
  }

  const order = [];
  const visited = new Set();

  function dfs(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    order.push(nodeId);
    // Find children (nodes this connects TO)
    const children = state.arrows.filter(a => a.from === nodeId).map(a => a.to);
    // Sort children left to right by x position
    const childNodes = children
      .map(id => state.nodes.find(n => n.id === id))
      .filter(Boolean);
    childNodes.sort((a, b) => a.x - b.x);
    childNodes.forEach(cn => dfs(cn.id));
  }

  // Sort roots left to right
  roots.sort((a, b) => a.x - b.x);
  roots.forEach(r => dfs(r.id));

  // Add any unvisited nodes
  state.nodes.forEach(n => {
    if (!visited.has(n.id)) order.push(n.id);
  });

  return order;
}

function startPresentation() {
  if (state.nodes.length === 0) {
    statusText.textContent = '⚠️ 画布为空，无法演示';
    return;
  }

  presMode = true;
  presOrder = buildPresOrder();
  presIndex = -1;
  presSrtData = [];

  // Add overlay
  const overlay = document.createElement('div');
  overlay.id = 'pres-overlay';
  overlay.className = 'pres-overlay';
  document.body.appendChild(overlay);

  // Add subtitle bar
  const subtitle = document.createElement('div');
  subtitle.id = 'pres-subtitle';
  subtitle.className = 'pres-subtitle';
  subtitle.textContent = '';
  document.body.appendChild(subtitle);

  // Add slide counter
  const counter = document.createElement('div');
  counter.id = 'pres-counter';
  counter.className = 'pres-counter';
  counter.textContent = '0 / ' + presOrder.length;
  document.body.appendChild(counter);

  // Add controls
  const controls = document.createElement('div');
  controls.id = 'pres-controls';
  controls.className = 'pres-controls';
  controls.innerHTML =
    '<button id="pres-btn-prev" title="上一步 (←)">⬅ 上一步</button>' +
    '<button id="pres-btn-pause" title="暂停/继续">⏸ 暂停</button>' +
    '<button id="pres-btn-next" title="下一步 (→/空格)">下一步 ➡</button>' +
    '<button id="pres-btn-stop" title="退出 (Esc)">✕ 退出</button>' +
    '<button id="pres-btn-srt" title="导出字幕文件">📄 导出SRT</button>';
  document.body.appendChild(controls);

  // Wire control buttons
  document.getElementById('pres-btn-prev').addEventListener('click', function() { presStopAuto(); presGo(-1); });
  document.getElementById('pres-btn-next').addEventListener('click', function() { presStopAuto(); presGo(1); });
  document.getElementById('pres-btn-pause').addEventListener('click', function() { presToggleAuto(); });
  document.getElementById('pres-btn-stop').addEventListener('click', function() { stopPresentation(); });
  document.getElementById('pres-btn-srt').addEventListener('click', function() { exportSRT(); });

  // Add canvas transition class
  transformGroup.classList.add('pres-mode');

  // Hide toolbar and tabs
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('tabs-bar').style.display = 'none';
  document.getElementById('zoom-controls').style.display = 'none';
  document.getElementById('status-bar').style.display = 'none';

  // Hide editor if open
  editorPanel.classList.add('hidden');

  // Dim all nodes
  nodeLayer.querySelectorAll('.node').forEach(function(el) {
    el.classList.add('pres-dimmed');
  });

  // Start auto-play
  presAutoPlaying = true;
  presGo(1);
  presStartAuto();
}

function presStartAuto() {
  if (presAutoTimer) clearInterval(presAutoTimer);
  presAutoPlaying = true;
  var pauseBtn = document.getElementById('pres-btn-pause');
  if (pauseBtn) pauseBtn.textContent = '⏸ 暂停';
  presAutoTimer = setInterval(function() {
    if (presIndex >= presOrder.length - 1) {
      presStopAuto();
      return;
    }
    presGo(1);
  }, 4000);
}

function presStopAuto() {
  if (presAutoTimer) { clearInterval(presAutoTimer); presAutoTimer = null; }
  presAutoPlaying = false;
  var pauseBtn = document.getElementById('pres-btn-pause');
  if (pauseBtn) pauseBtn.textContent = '▶ 继续';
}

function presToggleAuto() {
  if (presAutoPlaying) { presStopAuto(); } else { presStartAuto(); }
}

function presGo(direction) {
  if (!presMode) return;

  var newIndex = presIndex + direction;
  if (newIndex < 0 || newIndex >= presOrder.length) return;

  // Un-highlight previous
  if (presIndex >= 0) {
    var prevId = presOrder[presIndex];
    var prevEl = nodeLayer.querySelector('[data-id="' + prevId + '"]');
    if (prevEl) prevEl.classList.remove('pres-highlight');
  }

  presIndex = newIndex;
  var nodeId = presOrder[presIndex];
  var node = state.nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;

  var el = nodeLayer.querySelector('[data-id="' + nodeId + '"]');
  if (!el) return;

  // Highlight current node
  el.classList.add('pres-highlight');
  el.classList.remove('pres-dimmed');

  // Also un-dim all previously visited nodes
  for (var i = 0; i <= presIndex; i++) {
    var visitedEl = nodeLayer.querySelector('[data-id="' + presOrder[i] + '"]');
    if (visitedEl) visitedEl.classList.remove('pres-dimmed');
  }

  // Re-dim nodes after current index when going backwards
  for (var j = presIndex + 1; j < presOrder.length; j++) {
    var futureEl = nodeLayer.querySelector('[data-id="' + presOrder[j] + '"]');
    if (futureEl) {
      futureEl.classList.add('pres-dimmed');
      futureEl.classList.remove('pres-highlight');
    }
  }

  // Zoom to this node — center it on screen
  var container = canvas; // canvas-container
  var cw = container.clientWidth;
  var ch = container.clientHeight;
  var nw = el.offsetWidth;
  var nh = el.offsetHeight;
  var targetZoom = 1.5;
  var targetPanX = cw / 2 - (node.x + nw / 2) * targetZoom;
  var targetPanY = ch / 2 - (node.y + nh / 2) * targetZoom;

  state.zoom = targetZoom;
  state.panX = targetPanX;
  state.panY = targetPanY;
  transformGroup.style.transform = 'translate(' + state.panX + 'px, ' + state.panY + 'px) scale(' + state.zoom + ')';

  // Update counter
  var counterEl = document.getElementById('pres-counter');
  if (counterEl) counterEl.textContent = (presIndex + 1) + ' / ' + presOrder.length;

  // Show subtitle
  var subtitleEl = document.getElementById('pres-subtitle');
  var title = node.label || '';
  var desc = node.desc || '';
  if (subtitleEl) {
    subtitleEl.innerHTML = '<strong>' + title + '</strong>' + (desc ? '<br>' + desc : '');
  }

  // Record SRT data
  var startTime = presIndex * 4; // 4 seconds per node
  var endTime = startTime + 4;
  presSrtData.push({
    index: presIndex + 1,
    start: formatSRTTime(startTime),
    end: formatSRTTime(endTime),
    text: title + (desc ? '\n' + desc : '')
  });
}

function stopPresentation() {
  presMode = false;

  // Stop auto-play timer
  if (presAutoTimer) { clearInterval(presAutoTimer); presAutoTimer = null; }

  // Remove overlay, subtitle, controls, counter
  var overlay = document.getElementById('pres-overlay');
  if (overlay) overlay.remove();
  var subtitle = document.getElementById('pres-subtitle');
  if (subtitle) subtitle.remove();
  var controls = document.getElementById('pres-controls');
  if (controls) controls.remove();
  var counter = document.getElementById('pres-counter');
  if (counter) counter.remove();

  // Remove canvas transition
  transformGroup.classList.remove('pres-mode');

  // Show toolbar, tabs, zoom controls, status bar
  document.getElementById('toolbar').style.display = '';
  document.getElementById('tabs-bar').style.display = '';
  document.getElementById('zoom-controls').style.display = '';
  document.getElementById('status-bar').style.display = '';

  // Un-dim and un-highlight all nodes
  nodeLayer.querySelectorAll('.node').forEach(function(el) {
    el.classList.remove('pres-dimmed');
    el.classList.remove('pres-highlight');
  });

  // Reset zoom
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
  refreshArrows();

  statusText.textContent = '演示结束';
}

function formatSRTTime(seconds) {
  var h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  var m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  var s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return h + ':' + m + ':' + s + ',000';
}

function exportSRT() {
  if (presSrtData.length === 0) {
    alert('请先播放演示再导出字幕');
    return;
  }
  var srt = '';
  presSrtData.forEach(function(item) {
    srt += item.index + '\n' + item.start + ' --> ' + item.end + '\n' + item.text + '\n\n';
  });
  var blob = new Blob([srt], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mindmap-subtitles.srt';
  a.click();
}

// Keyboard shortcuts for presentation (capture phase to intercept before other handlers)
document.addEventListener('keydown', function(e) {
  if (!presMode) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); presStopAuto(); presGo(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); presStopAuto(); presGo(-1); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stopPresentation(); }
}, true);


// Wire up the present button
document.getElementById('btn-present').addEventListener('click', startPresentation);
