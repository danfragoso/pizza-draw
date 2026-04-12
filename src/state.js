// ─── Node type registry ────────────────────────────────────────────────────
// icon: Material Symbols ligature name
// label: human-readable default label prefix
// size: canvas node box size (px in world space)
export const NODE_TYPES = {
  // ── Network ───────────────────────────────────────────────────────────────
  router:         { icon: 'router',                   label: 'Router',          size: 72, group: 'Network' },
  switch:         { icon: 'device_hub',               label: 'Switch',          size: 72, group: 'Network' },
  firewall:       { icon: 'security',                 label: 'Firewall',        size: 72, group: 'Network' },
  'access-point': { icon: 'wifi_tethering',           label: 'AP',              size: 72, group: 'Network' },
  modem:          { icon: 'settings_input_antenna',   label: 'Modem',           size: 72, group: 'Network' },
  vpn:            { icon: 'vpn_key',                  label: 'VPN',             size: 72, group: 'Network' },

  // ── Compute ───────────────────────────────────────────────────────────────
  server:         { icon: 'dns',                      label: 'Server',          size: 72, group: 'Compute' },
  workstation:    { icon: 'computer',                 label: 'Workstation',     size: 72, group: 'Compute' },
  laptop:         { icon: 'laptop',                   label: 'Laptop',          size: 72, group: 'Compute' },
  container:      { icon: 'widgets',                  label: 'Container',       size: 72, group: 'Compute' },

  // ── Services ──────────────────────────────────────────────────────────────
  cloud:          { icon: 'cloud',                    label: 'Cloud',           size: 88, group: 'Services' },
  database:       { icon: 'storage',                  label: 'Database',        size: 72, group: 'Services' },
  nas:            { icon: 'hard_drive',               label: 'NAS',             size: 72, group: 'Services' },
  'load-balancer':{ icon: 'balance',                  label: 'Load Balancer',   size: 72, group: 'Services' },
  cdn:            { icon: 'public',                   label: 'CDN',             size: 72, group: 'Services' },
  queue:          { icon: 'queue',                    label: 'Queue',           size: 72, group: 'Services' },
  proxy:          { icon: 'sync_alt',                 label: 'Proxy',           size: 72, group: 'Services' },
  monitoring:     { icon: 'monitor_heart',            label: 'Monitoring',      size: 72, group: 'Services' },

  // ── Endpoints ─────────────────────────────────────────────────────────────
  phone:          { icon: 'smartphone',               label: 'Phone',           size: 64, group: 'Endpoints' },
  tablet:         { icon: 'tablet',                   label: 'Tablet',          size: 64, group: 'Endpoints' },
  'iot-device':   { icon: 'sensors',                  label: 'IoT',             size: 64, group: 'Endpoints' },
  printer:        { icon: 'print',                    label: 'Printer',         size: 64, group: 'Endpoints' },
  camera:         { icon: 'videocam',                 label: 'Camera',          size: 64, group: 'Endpoints' },

  // ── Security ──────────────────────────────────────────────────────────────
  ids:            { icon: 'gpp_bad',                  label: 'IDS/IPS',         size: 72, group: 'Security' },
  siem:           { icon: 'manage_search',            label: 'SIEM',            size: 72, group: 'Security' },
  honeypot:       { icon: 'bug_report',               label: 'Honeypot',        size: 72, group: 'Security' },
};

// ─── Counters per type ─────────────────────────────────────────────────────
const counts = {};

// ─── Factories ────────────────────────────────────────────────────────────
export function createNode(type, x, y) {
  counts[type] = (counts[type] || 0) + 1;
  const def  = NODE_TYPES[type];
  const size = def?.size ?? 72;
  return {
    id:      crypto.randomUUID(),
    type,
    x,
    y,
    label:   `${def?.label ?? type} ${counts[type]}`,
    width:   size,
    height:  size,
    groupId: null,   // explicit group membership
  };
}

export function createEdge(fromId, toId) {
  return {
    id:           crypto.randomUUID(),
    from:         fromId,
    to:           toId,
    label:        '',
    animated:     true,
    speed:        1.0,   // 0.25 slow … 4.0 fast
    bidirectional: false,
  };
}

// ─── Group (subnet/zone/frame) ─────────────────────────────────────────────
// colorIndex: 0=green(primary), 1=blue, 2=pink, 3=purple, 4=orange
export function createGroup(cx, cy, width, height, colorIndex = 0) {
  return {
    id:         crypto.randomUUID(),
    type:       'group',
    x:          cx,
    y:          cy,
    width:      Math.max(width,  200),
    height:     Math.max(height, 160),
    label:      'Subnet',
    collapsed:  false,
    colorIndex: colorIndex % 5,
    icon:       'account_tree',
    groupId:    null,   // for nested groups
  };
}

// Header height in world units
export const GROUP_HEADER_H      = 32;
// Collapsed group renders as a node of this size
export const GROUP_COLLAPSED_SIZE = 72;
// Visual padding inside expanded group (around member nodes)
export const GROUP_PADDING        = 24;

// Selectable icons for groups
export const GROUP_ICONS = [
  'account_tree', 'lan', 'cloud', 'domain',
  'vpn_lock',     'security', 'dns', 'hub',
  'corporate_fare', 'fence', 'apartment', 'lock',
];

// ─── App state ─────────────────────────────────────────────────────────────
export const state = {
  nodes:  [],
  edges:  [],
  groups: [],

  selected: null,    // { type: 'node'|'edge'|'group', id }
  hovered:  null,

  tool: 'select',    // 'select'|'pan'|'connect'|'add-{type}'|'draw-group'
  connectFrom:  null,
  drawingGroup: null, // { startX, startY, x, y, width, height } while drawing

  camera: { x: 0, y: 0, zoom: 1 },
  drag: null,
};

// ─── Helpers ───────────────────────────────────────────────────────────────
export function getNodeById(id) {
  return state.nodes.find(n => n.id === id) ?? null;
}

export function deleteSelected() {
  if (!state.selected) return;
  const { type, id } = state.selected;
  if (type === 'node') {
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
  } else if (type === 'edge') {
    state.edges = state.edges.filter(e => e.id !== id);
  } else if (type === 'group') {
    state.groups = state.groups.filter(g => g.id !== id);
    // Clear membership for nodes and nested groups
    state.nodes.forEach(n  => { if (n.groupId  === id) n.groupId  = null; });
    state.groups.forEach(g => { if (g.groupId  === id) g.groupId  = null; });
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
  }
  state.selected = null;
}

// node.groupId === group.id
export function isNodeInGroup(node, group) {
  return node.groupId === group.id;
}

export function isNodeVisible(node) {
  if (!node.groupId) return true;
  const g = state.groups.find(g => g.id === node.groupId);
  if (!g) return true;
  if (g.collapsed) return false;   // direct parent collapsed
  return isGroupVisible(g);        // check ancestors too
}

// Returns false if this group or any ancestor is collapsed
export function isGroupVisible(group) {
  if (!group.groupId) return true;
  const outer = state.groups.find(g => g.id === group.groupId);
  if (!outer) return true;
  if (outer.collapsed) return false;
  return isGroupVisible(outer);    // recurse up the chain
}

export function selectItem(type, id) {
  state.selected = id ? { type, id } : null;
}

// Collapse a group and recursively collapse all descendant groups
export function collapseGroupTree(group) {
  group.collapsed = true;
  for (const g of state.groups) {
    if (g.groupId === group.id) collapseGroupTree(g);
  }
}

// ─── Positional capture (used when drawing a new group) ────────────────────
// Returns nodes/groups whose centers fall inside the drawn rect.
export function captureItemsInRect(rx, ry, rw, rh, excludeGroupId) {
  const nodes  = state.nodes.filter(n =>
    !n.groupId &&
    n.x >= rx && n.x <= rx + rw && n.y >= ry && n.y <= ry + rh,
  );
  const groups = state.groups.filter(g =>
    g.id !== excludeGroupId && !g.groupId &&
    g.x >= rx && g.x <= rx + rw && g.y >= ry && g.y <= ry + rh,
  );
  return { nodes, groups };
}

// ─── Auto-size: resize a group to tightly wrap all members (nodes + groups) ─
export function autoSizeGroup(group) {
  const memberNodes  = state.nodes.filter(n => n.groupId === group.id);
  const memberGroups = state.groups.filter(g => g.groupId === group.id);

  if (memberNodes.length === 0 && memberGroups.length === 0) {
    group.width  = 200;
    group.height = 160;
    return;
  }

  const PAD   = GROUP_PADDING + 8;
  const LABEL = 30;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const n of memberNodes) {
    minX = Math.min(minX, n.x - n.width  / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width  / 2);
    maxY = Math.max(maxY, n.y + n.height / 2 + LABEL);
  }

  for (const g of memberGroups) {
    if (g.collapsed) {
      const s = GROUP_COLLAPSED_SIZE / 2;
      minX = Math.min(minX, g.x - s);
      minY = Math.min(minY, g.y - s);
      maxX = Math.max(maxX, g.x + s);
      maxY = Math.max(maxY, g.y + s + LABEL);
    } else {
      minX = Math.min(minX, g.x - g.width  / 2);
      minY = Math.min(minY, g.y - g.height / 2);
      maxX = Math.max(maxX, g.x + g.width  / 2);
      maxY = Math.max(maxY, g.y + g.height / 2 + LABEL);
    }
  }

  group.width  = Math.max(200, (maxX - minX) + PAD * 2);
  group.height = Math.max(160, (maxY - minY) + PAD * 2 + GROUP_HEADER_H);
  group.x = (minX + maxX) / 2;
  group.y = (minY + maxY) / 2 - GROUP_HEADER_H / 2;
}

// Resize group and propagate up through ancestor groups
export function autoSizeGroupChain(group) {
  autoSizeGroup(group);
  if (group.groupId) {
    const parent = state.groups.find(g => g.id === group.groupId);
    if (parent) autoSizeGroupChain(parent);
  }
}

// ─── Move a group and ALL its descendants by (dx, dy) ─────────────────────
function _moveGroupTree(group, dx, dy) {
  group.x += dx;
  group.y += dy;
  for (const n of state.nodes)  if (n.groupId  === group.id) { n.x += dx; n.y += dy; }
  for (const g of state.groups) if (g.groupId  === group.id)   _moveGroupTree(g, dx, dy);
}

// ─── Recompute every group's size bottom-up (leaves first) ────────────────
function refreshAllGroupSizes() {
  // Topological sort so children are sized before parents
  const sorted = [];
  const seen   = new Set();

  function visit(g) {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    for (const child of state.groups) {
      if (child.groupId === g.id) visit(child);
    }
    sorted.push(g);
  }

  for (const g of state.groups) visit(g);

  for (const g of sorted) autoSizeGroup(g);
}

// ─── Global de-overlap: push top-level items apart so nothing overlaps ────
// "Top-level" means: standalone nodes (no groupId) + top-level groups (no groupId).
// Collapsed groups use GROUP_COLLAPSED_SIZE; expanded groups use their full bbox.
// Runs iteratively until stable (or max iterations).
export function deOverlapAllItems() {
  // Ensure every group reflects its current contents before measuring
  refreshAllGroupSizes();
  const PADDING   = 24;   // minimum gap between item bounding boxes
  const MAX_ITERS = 80;

  // Build a list of moveable items with their current bounding boxes
  function getItems() {
    const items = [];

    for (const n of state.nodes) {
      if (n.groupId) continue;   // skip, handled by parent group
      items.push({
        kind: 'node', ref: n,
        get cx() { return n.x; },
        get cy() { return n.y; },
        get hw() { return n.width  / 2; },
        get hh() { return n.height / 2; },
        move(dx, dy) { n.x += dx; n.y += dy; },
      });
    }

    for (const g of state.groups) {
      if (g.groupId) continue;   // skip nested groups
      if (g.collapsed) {
        const s = GROUP_COLLAPSED_SIZE / 2;
        items.push({
          kind: 'group', ref: g,
          get cx() { return g.x; },
          get cy() { return g.y; },
          get hw() { return s; },
          get hh() { return s; },
          move(dx, dy) { _moveGroupTree(g, dx, dy); },
        });
      } else {
        items.push({
          kind: 'group', ref: g,
          get cx() { return g.x; },
          get cy() { return g.y; },
          get hw() { return g.width  / 2; },
          get hh() { return g.height / 2; },
          move(dx, dy) { _moveGroupTree(g, dx, dy); },
        });
      }
    }

    return items;
  }

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const items = getItems();
    let moved = false;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        const overlapX = (a.hw + b.hw + PADDING) - Math.abs(a.cx - b.cx);
        const overlapY = (a.hh + b.hh + PADDING) - Math.abs(a.cy - b.cy);

        if (overlapX <= 0 || overlapY <= 0) continue;   // no overlap

        // Push along the axis with smaller overlap
        let ax = 0, ay = 0, bx = 0, by = 0;
        if (overlapX < overlapY) {
          const push = overlapX / 2;
          if (a.cx < b.cx) { ax = -push; bx =  push; }
          else              { ax =  push; bx = -push; }
        } else {
          const push = overlapY / 2;
          if (a.cy < b.cy) { ay = -push; by =  push; }
          else              { ay =  push; by = -push; }
        }

        a.move(ax, ay);
        b.move(bx, by);
        moved = true;
      }
    }

    if (!moved) break;
  }
}

// ─── Auto-arrange: lay out member nodes in a grid, then auto-size ──────────
export function autoArrangeGroup(group) {
  const members = state.nodes.filter(n => n.groupId === group.id);
  if (members.length === 0) { autoSizeGroupChain(group); return; }

  const GAP   = 20;
  const LABEL = 30;
  const cols  = Math.max(1, Math.ceil(Math.sqrt(members.length)));

  let maxW = 0, maxH = 0;
  for (const n of members) {
    maxW = Math.max(maxW, n.width);
    maxH = Math.max(maxH, n.height);
  }

  const cellW = maxW + GAP;
  const cellH = maxH + GAP + LABEL;
  const gridW = cols * cellW - GAP;

  // Lay out grid centered on the group's current x; start below the header
  const startX = group.x - gridW / 2;
  const startY = group.y - group.height / 2 + GROUP_HEADER_H + GROUP_PADDING;

  members.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    node.x = startX + col * cellW + maxW / 2;
    node.y = startY + row * cellH + maxH / 2;
  });

  autoSizeGroupChain(group);
}
