import {
  state, createNode, createEdge, createGroup,
  selectItem, deleteSelected, getNodeById,
  isNodeInGroup, GROUP_HEADER_H,
  captureItemsInRect, autoSizeGroupChain, autoArrangeGroup, collapseGroupTree, deOverlapAllItems,
} from './state.js';
import {
  ghostMouseWorld, edgeHitTest,
  groupHeaderHitTest, groupCollapseBtnHitTest,
  hitResizeHandle, handleCursor, hitCollapsedGroup,
} from './render.js';
import { updateUI } from './ui.js';

// ─── Coordinate helpers ────────────────────────────────────────────────────
function screenToWorld(sx, sy) {
  return {
    x: (sx - state.camera.x) / state.camera.zoom,
    y: (sy - state.camera.y) / state.camera.zoom,
  };
}

// ─── Hit testing ──────────────────────────────────────────────────────────
function hitNode(wx, wy) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const n = state.nodes[i];
    // Respect visibility (inside collapsed group?)
    const visible = !state.groups.some(g => g.collapsed && isNodeInGroup(n, g));
    if (!visible) continue;
    if (wx >= n.x - n.width  / 2 && wx <= n.x + n.width  / 2 &&
        wy >= n.y - n.height / 2 && wy <= n.y + n.height / 2) return n;
  }
  return null;
}

function hitEdge(wx, wy) {
  for (const e of state.edges) {
    if (edgeHitTest(e, wx, wy, state.camera.zoom)) return e;
  }
  return null;
}

function hitGroupHeader(wx, wy) {
  // Iterate reverse so top-most group header wins
  for (let i = state.groups.length - 1; i >= 0; i--) {
    const g = state.groups[i];
    if (groupHeaderHitTest(g, wx, wy)) return g;
  }
  return null;
}

// ─── Mouse state ──────────────────────────────────────────────────────────
let isSpaceDown = false;

export function initInput(canvas) {
  canvas.addEventListener('mousedown',   onMouseDown);
  canvas.addEventListener('mousemove',   onMouseMove);
  canvas.addEventListener('mouseup',     onMouseUp);
  canvas.addEventListener('mouseleave',  onMouseUp);
  canvas.addEventListener('wheel',       onWheel, { passive: false });
  canvas.addEventListener('dblclick',    onDblClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
}

// ─── Mouse down ───────────────────────────────────────────────────────────
function onMouseDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();

  const w    = screenToWorld(e.clientX, e.clientY);
  const tool = state.tool;

  // Middle button or space → always pan
  if (e.button === 1 || isSpaceDown) { startPan(e.clientX, e.clientY); return; }

  if (tool === 'pan')     { startPan(e.clientX, e.clientY); return; }
  if (tool === 'connect') { handleConnectClick(w); return; }

  // Add-node tools — place the node, then return to select
  if (tool.startsWith('add-')) {
    const type = tool.slice(4);
    const node = createNode(type, w.x, w.y);
    state.nodes.push(node);
    // Assign to any expanded group whose content area contains the drop point
    for (const g of state.groups) {
      if (g.collapsed) continue;
      const gx = g.x - g.width  / 2;
      const gy = g.y - g.height / 2 + GROUP_HEADER_H;
      if (w.x >= gx && w.x <= gx + g.width && w.y >= gy && w.y <= gy + g.height - GROUP_HEADER_H) {
        node.groupId = g.id;
        autoSizeGroupChain(g);
        break;
      }
    }
    selectItem('node', node.id);
    setTool('select');
    updateUI();
    return;
  }

  // Draw group tool
  if (tool === 'draw-group') {
    state.drawingGroup = { startX: w.x, startY: w.y, x: w.x, y: w.y, width: 0, height: 0 };
    setCursor('crosshair');
    return;
  }

  // ── Select tool ───────────────────────────────────────────────────────
  // Check group collapse button (expanded groups only)
  for (let i = state.groups.length - 1; i >= 0; i--) {
    const g = state.groups[i];
    if (g.collapsed) continue;
    if (groupCollapseBtnHitTest(g, w.x, w.y)) {
      collapseGroupTree(g);
      deOverlapAllItems();
      selectItem('group', g.id);
      updateUI();
      return;
    }
  }

  // Check resize handles (only for selected expanded group)
  if (state.selected?.type === 'group') {
    const selGrp = state.groups.find(g => g.id === state.selected.id);
    if (selGrp && !selGrp.collapsed) {
      const handle = hitResizeHandle(selGrp, w.x, w.y, state.camera.zoom);
      if (handle) {
        state.drag = {
          type: 'group-resize', id: selGrp.id, handle,
          startScreenX: e.clientX, startScreenY: e.clientY,
          startGX: selGrp.x, startGY: selGrp.y,
          startGW: selGrp.width, startGH: selGrp.height,
        };
        setCursor(handleCursor(handle));
        return;
      }
    }
  }

  // Check collapsed group (acts like a node)
  const cg = hitCollapsedGroup(w.x, w.y);
  if (cg) {
    selectItem('group', cg.id);
    updateUI();
    state.drag = {
      type: 'group', id: cg.id,
      startScreenX: e.clientX, startScreenY: e.clientY,
      startGX: cg.x, startGY: cg.y,
      childOffsets: collectChildOffsets(cg),
    };
    setCursor('grabbing');
    return;
  }

  // Check node
  const node = hitNode(w.x, w.y);
  if (node) {
    selectItem('node', node.id);
    updateUI();
    state.drag = {
      type: 'node', id: node.id,
      startScreenX: e.clientX, startScreenY: e.clientY,
      startNodeX: node.x, startNodeY: node.y,
    };
    setCursor('grabbing');
    return;
  }

  // Check edge
  const edge = hitEdge(w.x, w.y);
  if (edge) {
    selectItem('edge', edge.id);
    updateUI();
    return;
  }

  // Check expanded group header (for selection + drag)
  const grp = hitGroupHeader(w.x, w.y);
  if (grp) {
    selectItem('group', grp.id);
    updateUI();
    state.drag = {
      type: 'group', id: grp.id,
      startScreenX: e.clientX, startScreenY: e.clientY,
      startGX: grp.x, startGY: grp.y,
      childOffsets: collectChildOffsets(grp),
    };
    setCursor('grabbing');
    return;
  }

  // Empty canvas → deselect + pan
  selectItem(null, null);
  updateUI();
  startPan(e.clientX, e.clientY);
}

// ─── Mouse move ────────────────────────────────────────────────────────────
function onMouseMove(e) {
  const w = screenToWorld(e.clientX, e.clientY);

  ghostMouseWorld.x = w.x;
  ghostMouseWorld.y = w.y;

  // Group drawing
  if (state.drawingGroup) {
    const dg = state.drawingGroup;
    dg.x      = Math.min(w.x, dg.startX);
    dg.y      = Math.min(w.y, dg.startY);
    dg.width  = Math.abs(w.x - dg.startX);
    dg.height = Math.abs(w.y - dg.startY);
    return;
  }

  // Node drag
  if (state.drag?.type === 'node') {
    const dx   = (e.clientX - state.drag.startScreenX) / state.camera.zoom;
    const dy   = (e.clientY - state.drag.startScreenY) / state.camera.zoom;
    const node = getNodeById(state.drag.id);
    if (node) {
      node.x = state.drag.startNodeX + dx;
      node.y = state.drag.startNodeY + dy;
    }
    return;
  }

  // Group resize
  if (state.drag?.type === 'group-resize') {
    const dx  = (e.clientX - state.drag.startScreenX) / state.camera.zoom;
    const dy  = (e.clientY - state.drag.startScreenY) / state.camera.zoom;
    const grp = state.groups.find(g => g.id === state.drag.id);
    if (grp) resizeGroup(grp, state.drag, dx, dy);
    return;
  }

  // Group drag (moves group + contained nodes + nested groups)
  if (state.drag?.type === 'group') {
    const dx  = (e.clientX - state.drag.startScreenX) / state.camera.zoom;
    const dy  = (e.clientY - state.drag.startScreenY) / state.camera.zoom;
    const grp = state.groups.find(g => g.id === state.drag.id);
    if (grp) {
      grp.x = state.drag.startGX + dx;
      grp.y = state.drag.startGY + dy;
      for (const { id, dx: ox, dy: oy, isGroup } of state.drag.childOffsets) {
        if (isGroup) {
          const g = state.groups.find(g => g.id === id);
          if (g) { g.x = grp.x + ox; g.y = grp.y + oy; }
        } else {
          const n = getNodeById(id);
          if (n) { n.x = grp.x + ox; n.y = grp.y + oy; }
        }
      }
    }
    return;
  }

  // Canvas pan
  if (state.drag?.type === 'canvas') {
    state.camera.x = state.drag.startCamX + (e.clientX - state.drag.startScreenX);
    state.camera.y = state.drag.startCamY + (e.clientY - state.drag.startScreenY);
    updateZoomDisplay();
    return;
  }

  // Hover detection
  // Collapsed groups (act like nodes)
  const hcg = hitCollapsedGroup(w.x, w.y);
  if (hcg) {
    state.hovered = { type: 'group', id: hcg.id };
    setCursor(state.tool === 'connect' ? 'cell' : 'pointer');
    return;
  }

  const node = hitNode(w.x, w.y);
  if (node) {
    state.hovered = { type: 'node', id: node.id };
    setCursor(state.tool === 'connect' ? 'cell' : 'pointer');
    return;
  }

  const edge = hitEdge(w.x, w.y);
  if (edge) {
    state.hovered = { type: 'edge', id: edge.id };
    setCursor('pointer');
    return;
  }

  // Hover over resize handles of selected expanded group
  if (state.selected?.type === 'group') {
    const selGrp = state.groups.find(g => g.id === state.selected.id);
    if (selGrp && !selGrp.collapsed) {
      const handle = hitResizeHandle(selGrp, w.x, w.y, state.camera.zoom);
      if (handle) { setCursor(handleCursor(handle)); return; }
    }
  }

  const grp = hitGroupHeader(w.x, w.y);
  if (grp) {
    state.hovered = { type: 'group', id: grp.id };
    setCursor('pointer');
    return;
  }

  state.hovered = null;
  updateCursor();
}

// ─── Mouse up ─────────────────────────────────────────────────────────────
function onMouseUp() {
  // Finish group drawing
  if (state.drawingGroup) {
    const dg = state.drawingGroup;
    if (dg.width > 40 && dg.height > GROUP_HEADER_H * 1.5) {
      const grp = createGroup(
        dg.x + dg.width  / 2,
        dg.y + dg.height / 2,
        dg.width,
        dg.height,
        state.groups.length % 5,
      );
      state.groups.push(grp);

      // Capture any unassigned nodes/groups inside the drawn rect
      const { nodes, groups } = captureItemsInRect(dg.x, dg.y, dg.width, dg.height, grp.id);
      nodes.forEach(n  => { n.groupId  = grp.id; });
      groups.forEach(g => { g.groupId  = grp.id; });

      // Fit the group around its members (or keep drawn size if empty)
      if (nodes.length > 0) autoSizeGroupChain(grp);

      selectItem('group', grp.id);
      updateUI();
    }
    state.drawingGroup = null;
  }

  // After node drag, re-fit its group and propagate up
  if (state.drag?.type === 'node') {
    const node = getNodeById(state.drag.id);
    if (node?.groupId) {
      const grp = state.groups.find(g => g.id === node.groupId);
      if (grp) autoSizeGroupChain(grp);
    }
  }

  state.drag = null;
  updateCursor();
}

// ─── Wheel / zoom ─────────────────────────────────────────────────────────
function onWheel(e) {
  e.preventDefault();
  const delta  = e.deltaY > 0 ? 0.9 : 1 / 0.9;
  const cam    = state.camera;
  const wx     = (e.clientX - cam.x) / cam.zoom;
  const wy     = (e.clientY - cam.y) / cam.zoom;
  const newZoom = Math.max(0.08, Math.min(4, cam.zoom * delta));
  cam.x    = e.clientX - wx * newZoom;
  cam.y    = e.clientY - wy * newZoom;
  cam.zoom = newZoom;
  updateZoomDisplay();
}

// ─── Double-click → expand collapsed group ────────────────────────────────
function onDblClick(e) {
  const w = screenToWorld(e.clientX, e.clientY);

  const cg = hitCollapsedGroup(w.x, w.y);
  if (cg) {
    cg.collapsed = false;
    autoArrangeGroup(cg);
    deOverlapAllItems();
    selectItem('group', cg.id);
    updateUI();
  }
}

// ─── Keyboard ──────────────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case 'v': case 'V':   setTool('select'); break;
    case 'h': case 'H':   setTool('pan');    break;
    case 'g': case 'G':   setTool('draw-group'); break;
    case 'c': case 'C':
      if (!e.ctrlKey && !e.metaKey) setTool('connect'); break;
    case 't': case 'T':   toggleToolbar(); break;
    case 'Escape':
      if (state.connectFrom) {
        state.connectFrom = null;
        setTool('select');
      } else if (state.drawingGroup) {
        state.drawingGroup = null;
        setTool('select');
      } else {
        selectItem(null, null);
        updateUI();
      }
      break;
    case 'Delete':
    case 'Backspace':
      if (state.selected) { deleteSelected(); updateUI(); }
      break;
    case ' ':
      isSpaceDown = true;
      setCursor('grab');
      e.preventDefault();
      break;
    case 'f': case 'F':
      fitToScreen(); break;
  }
}

function onKeyUp(e) {
  if (e.key === ' ') { isSpaceDown = false; updateCursor(); }
}

// ─── Connect tool ──────────────────────────────────────────────────────────
function handleConnectClick(w) {
  // Hit test: nodes first, then collapsed groups
  const node = hitNode(w.x, w.y);
  const cg   = !node ? hitCollapsedGroup(w.x, w.y) : null;
  const hitId = node?.id ?? cg?.id ?? null;

  if (!hitId) { state.connectFrom = null; setTool('select'); return; }

  if (!state.connectFrom) {
    state.connectFrom = hitId;
    document.getElementById('connect-hint')?.classList.remove('hidden');
    return;
  }

  if (state.connectFrom !== hitId) {
    const exists = state.edges.some(
      e => (e.from === state.connectFrom && e.to === hitId) ||
           (e.from === hitId && e.to === state.connectFrom),
    );
    if (!exists) {
      const edge = createEdge(state.connectFrom, hitId);
      state.edges.push(edge);
      selectItem('edge', edge.id);
      updateUI();
    }
  }

  state.connectFrom = null;
  document.getElementById('connect-hint')?.classList.add('hidden');
}

// ─── Pan ──────────────────────────────────────────────────────────────────
function startPan(sx, sy) {
  state.drag = {
    type: 'canvas', startScreenX: sx, startScreenY: sy,
    startCamX: state.camera.x, startCamY: state.camera.y,
  };
  setCursor('grabbing');
}

// ─── Fit to screen ────────────────────────────────────────────────────────
export function fitToScreen() {
  const all = [
    ...state.nodes,
    ...state.groups.map(g => ({
      x: g.x, y: g.y, width: g.width, height: g.height,
    })),
  ];

  if (all.length === 0) {
    state.camera = { x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 };
    updateZoomDisplay();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of all) {
    minX = Math.min(minX, item.x - item.width  / 2);
    minY = Math.min(minY, item.y - item.height / 2);
    maxX = Math.max(maxX, item.x + item.width  / 2);
    maxY = Math.max(maxY, item.y + item.height / 2);
  }

  const pad  = 80;
  const bw   = maxX - minX + pad * 2;
  const bh   = maxY - minY + pad * 2;
  const vw   = window.innerWidth  - 80;
  const vh   = window.innerHeight - 60;
  const zoom = Math.max(0.08, Math.min(2, Math.min(vw / bw, vh / bh)));
  const cx   = (minX + maxX) / 2;
  const cy   = (minY + maxY) / 2;

  state.camera = {
    x:    window.innerWidth  / 2 - cx * zoom,
    y:    window.innerHeight / 2 - cy * zoom,
    zoom,
  };
  updateZoomDisplay();
}

// ─── Tool switching ────────────────────────────────────────────────────────
export function setTool(tool) {
  state.tool = tool;
  if (tool !== 'connect') {
    state.connectFrom = null;
    document.getElementById('connect-hint')?.classList.add('hidden');
  }
  if (tool !== 'draw-group') {
    state.drawingGroup = null;
  }
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  updateCursor();
}

// ─── Toolbar toggle ───────────────────────────────────────────────────────
function toggleToolbar() {
  const tb = document.getElementById('toolbar');
  if (tb) tb.classList.toggle('toolbar-hidden');
}


// ─── Recursive descendant collector for group drag ────────────────────────
// Returns offsets for ALL nodes and groups in the subtree rooted at `group`,
// relative to `group`'s current position.
function collectChildOffsets(group) {
  const offsets = [];
  function collect(grp) {
    for (const n of state.nodes) {
      if (n.groupId === grp.id)
        offsets.push({ id: n.id, dx: n.x - group.x, dy: n.y - group.y, isGroup: false });
    }
    for (const g of state.groups) {
      if (g.groupId === grp.id) {
        offsets.push({ id: g.id, dx: g.x - group.x, dy: g.y - group.y, isGroup: true });
        collect(g);
      }
    }
  }
  collect(group);
  return offsets;
}

// ─── Group resize math ────────────────────────────────────────────────────
const MIN_GW = 120, MIN_GH = GROUP_HEADER_H + 80;

function resizeGroup(grp, drag, dx, dy) {
  const { handle, startGX, startGY, startGW, startGH } = drag;

  let newW = startGW, newH = startGH, newX = startGX, newY = startGY;

  if (handle.includes('e')) { newW = Math.max(MIN_GW, startGW + dx); newX = startGX + (newW - startGW) / 2; }
  if (handle.includes('w')) { newW = Math.max(MIN_GW, startGW - dx); newX = startGX - (newW - startGW) / 2; }
  if (handle.includes('s')) { newH = Math.max(MIN_GH, startGH + dy); newY = startGY + (newH - startGH) / 2; }
  if (handle.includes('n')) { newH = Math.max(MIN_GH, startGH - dy); newY = startGY - (newH - startGH) / 2; }

  grp.width  = newW;
  grp.height = newH;
  grp.x      = newX;
  grp.y      = newY;
}

// ─── Cursor ───────────────────────────────────────────────────────────────
function setCursor(type) {
  const c = document.getElementById('canvas');
  c.className = '';
  if (type !== 'default' && type !== '') c.classList.add(`cursor-${type}`);
}

function updateCursor() {
  if (state.drag?.type === 'canvas')    { setCursor('grabbing');   return; }
  if (isSpaceDown || state.tool === 'pan') { setCursor('grab');    return; }
  if (state.tool === 'connect')         { setCursor(state.connectFrom ? 'cell' : 'crosshair'); return; }
  if (state.tool === 'draw-group')      { setCursor('crosshair');  return; }
  if (state.tool.startsWith('add-'))   { setCursor('crosshair');  return; }
  setCursor('default');
}

function updateZoomDisplay() {
  const el = document.getElementById('zoom-display');
  if (el) el.textContent = Math.round(state.camera.zoom * 100) + '%';
}
