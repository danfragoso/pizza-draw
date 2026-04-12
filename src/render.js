import { state, NODE_TYPES, GROUP_HEADER_H, GROUP_COLLAPSED_SIZE, GROUP_PADDING, isNodeVisible, isGroupVisible } from './state.js';
import { getColors, getThemeName } from './theme.js';

// ─── Canvas refs ──────────────────────────────────────────────────────────
let canvas, ctx, W, H, dpr;
let iconFontReady = false;

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  document.fonts.load('300 24px "Material Symbols Outlined"').then(() => {
    iconFontReady = true;
  });
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
}

// ─── Main render ──────────────────────────────────────────────────────────
export function render(timestamp) {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const c   = getColors();
  const cam = state.camera;

  drawBackground(c, cam);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.zoom, cam.zoom);

  drawExpandedGroups(c, cam.zoom);
  drawGroupGhost(c, cam.zoom);
  drawEdges(c, cam.zoom, timestamp);
  drawNodes(c, cam.zoom);
  drawCollapsedGroupsAsNodes(c, cam.zoom);
  drawConnectGhost(c, cam.zoom);

  ctx.restore();
  ctx.restore();
}

// ─── Background dots ──────────────────────────────────────────────────────
function drawBackground(c, cam) {
  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, W, H);

  const spacing = 24;
  const r = 1.4;
  const ox = ((cam.x % spacing) + spacing) % spacing;
  const oy = ((cam.y % spacing) + spacing) % spacing;

  ctx.fillStyle = c.dot;
  for (let x = ox; x < W; x += spacing) {
    for (let y = oy; y < H; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Group color tints ────────────────────────────────────────────────────
const GROUP_TINTS = {
  light: [
    { fill: 'hsla(75,58%,44%,0.06)',  header: 'hsla(75,58%,44%,0.12)',  border: 'hsla(75,58%,44%,0.45)',  text: 'hsl(75,50%,28%)' },
    { fill: 'hsla(210,60%,52%,0.06)', header: 'hsla(210,60%,52%,0.12)', border: 'hsla(210,60%,52%,0.45)', text: 'hsl(210,55%,28%)' },
    { fill: 'hsla(340,58%,52%,0.06)', header: 'hsla(340,58%,52%,0.12)', border: 'hsla(340,58%,52%,0.45)', text: 'hsl(340,50%,28%)' },
    { fill: 'hsla(278,48%,52%,0.06)', header: 'hsla(278,48%,52%,0.12)', border: 'hsla(278,48%,52%,0.45)', text: 'hsl(278,48%,28%)' },
    { fill: 'hsla(30,68%,50%,0.06)',  header: 'hsla(30,68%,50%,0.12)',  border: 'hsla(30,68%,50%,0.45)',  text: 'hsl(30,60%,24%)' },
  ],
  dark: [
    { fill: 'hsla(75,55%,52%,0.08)',  header: 'hsla(75,55%,52%,0.16)',  border: 'hsla(75,55%,52%,0.5)',   text: 'hsl(75,55%,68%)' },
    { fill: 'hsla(210,60%,60%,0.08)', header: 'hsla(210,60%,60%,0.16)', border: 'hsla(210,60%,60%,0.5)',  text: 'hsl(210,60%,72%)' },
    { fill: 'hsla(340,58%,60%,0.08)', header: 'hsla(340,58%,60%,0.16)', border: 'hsla(340,58%,60%,0.5)',  text: 'hsl(340,58%,72%)' },
    { fill: 'hsla(278,48%,60%,0.08)', header: 'hsla(278,48%,60%,0.16)', border: 'hsla(278,48%,60%,0.5)',  text: 'hsl(278,48%,72%)' },
    { fill: 'hsla(30,68%,58%,0.08)',  header: 'hsla(30,68%,58%,0.16)',  border: 'hsla(30,68%,58%,0.5)',   text: 'hsl(30,68%,68%)' },
  ],
};

// ─── Groups (expanded) ────────────────────────────────────────────────────
function drawExpandedGroups(c, zoom) {
  const theme  = getThemeName();
  const tints  = GROUP_TINTS[theme];

  for (const group of state.groups) {
    if (group.collapsed) continue;
    if (!isGroupVisible(group)) continue;

    const tint       = tints[group.colorIndex % tints.length];
    const isSelected = state.selected?.type === 'group' && state.selected.id === group.id;
    const isHovered  = state.hovered?.type  === 'group' && state.hovered.id  === group.id;

    const lx = group.x - group.width  / 2;
    const ty = group.y - group.height / 2;
    const r  = 12 / zoom;

    // Body fill
    ctx.beginPath();
    roundRect(ctx, lx, ty, group.width, group.height, r);
    ctx.fillStyle = tint.fill;
    ctx.fill();

    // Dashed border
    ctx.beginPath();
    roundRect(ctx, lx, ty, group.width, group.height, r);
    ctx.strokeStyle = isSelected ? c.primary
      : isHovered   ? tint.border.replace('0.45', '0.7').replace('0.5', '0.8')
      : tint.border;
    ctx.lineWidth = (isSelected ? 2 : 1.5) / zoom;
    ctx.setLineDash([7 / zoom, 4 / zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Header bar background
    ctx.beginPath();
    roundRectTop(ctx, lx, ty, group.width, GROUP_HEADER_H, r);
    ctx.fillStyle = isSelected
      ? tint.header.replace('0.12', '0.22').replace('0.16', '0.26')
      : tint.header;
    ctx.fill();

    // Label text + collapse button — world-unit sizes
    const fsz = 11;
    if (fsz * zoom >= 4) {
      ctx.font = `600 ${fsz}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = tint.text;
      ctx.fillText(group.label, lx + 14, ty + GROUP_HEADER_H / 2);
    }

    const btnSize = 16;
    if (btnSize * zoom >= 4 && iconFontReady) {
      const btnX = lx + group.width - btnSize - 8;
      const btnY = ty + GROUP_HEADER_H / 2;
      ctx.font = `${btnSize}px "Material Symbols Outlined"`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = tint.text;
      ctx.fillText('expand_less', btnX + btnSize / 2, btnY);
    }

    // Inner padding guide when selected
    if (isSelected) {
      const pad = GROUP_PADDING;
      ctx.beginPath();
      roundRect(ctx,
        lx + pad,
        ty + GROUP_HEADER_H + pad,
        group.width  - pad * 2,
        group.height - GROUP_HEADER_H - pad * 2,
        8,
      );
      ctx.strokeStyle = tint.border.replace('0.45', '0.25').replace('0.5', '0.25');
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

      drawResizeHandles(group, c.primary, c.card, zoom);
    }
  }
}

// ─── Groups (collapsed, rendered as node boxes) ────────────────────────────
function drawCollapsedGroupsAsNodes(c, zoom) {
  const theme = getThemeName();
  const tints = GROUP_TINTS[theme];

  for (const group of state.groups) {
    if (!group.collapsed) continue;
    if (!isGroupVisible(group)) continue;

    const tint       = tints[group.colorIndex % tints.length];
    const isSelected = state.selected?.type === 'group' && state.selected.id === group.id;
    const isHovered  = state.hovered?.type  === 'group' && state.hovered.id  === group.id;

    const s  = GROUP_COLLAPSED_SIZE;
    const hw = s / 2;
    const x  = group.x - hw;
    const y  = group.y - hw;
    const r  = NODE_RADIUS / zoom;

    // Shadow + card background
    ctx.save();
    ctx.shadowBlur    = Math.min(isSelected ? 16 / zoom : 6 / zoom, 40);
    ctx.shadowColor   = isSelected ? c.primaryGlow : c.shadow;
    ctx.shadowOffsetY = isSelected ? 0 : Math.min(2 / zoom, 8);
    ctx.beginPath();
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = c.card;
    ctx.fill();
    ctx.restore();

    // Dashed colored border
    ctx.beginPath();
    roundRect(ctx, x, y, s, s, r);
    ctx.strokeStyle = isSelected ? c.primary
      : isHovered   ? tint.border.replace('0.45', '0.8').replace('0.5', '0.85')
      : tint.border;
    ctx.lineWidth = isSelected ? 2 / zoom : 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      roundRect(ctx, x - 4/zoom, y - 4/zoom, s + 8/zoom, s + 8/zoom, (NODE_RADIUS + 4) / zoom);
      ctx.strokeStyle = c.primaryAlpha;
      ctx.lineWidth = 3 / zoom;
      ctx.stroke();
    }

    // Icon
    if (iconFontReady && group.icon) {
      const iconSize = s * 0.45;
      if (iconSize * zoom >= 4) {
        ctx.font = `300 ${iconSize}px "Material Symbols Outlined"`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = isSelected ? c.primary : tint.text;
        ctx.fillText(group.icon, group.x, group.y);
      }
    }

    // Label below
    if (group.label) {
      const fsz = 11;
      if (fsz * zoom >= 4) {
        ctx.font = `500 ${fsz}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = c.mutedFg;
        const lines = wrapText(ctx, group.label, s * 1.1);
        lines.forEach((line, i) => {
          ctx.fillText(line, group.x, group.y + hw + 6 + i * fsz * 1.3);
        });
      }
    }

    // Expand hint icon (top-right corner)
    if (iconFontReady && zoom > 0.3) {
      const hintSize = 12;
      if (hintSize * zoom >= 4) {
        ctx.font = `${hintSize}px "Material Symbols Outlined"`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = tint.text;
        ctx.globalAlpha  = 0.6;
        ctx.fillText('expand_content', group.x + hw - hintSize * 0.8, group.y - hw + hintSize * 0.8);
        ctx.globalAlpha  = 1;
      }
    }
  }
}

// ─── Group drawing ghost ──────────────────────────────────────────────────
function drawGroupGhost(c, zoom) {
  const g = state.drawingGroup;
  if (!g || g.width < 4) return;

  ctx.beginPath();
  roundRect(ctx, g.x, g.y, g.width, g.height, 12 / zoom);
  ctx.strokeStyle = c.primary;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([8 / zoom, 5 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = c.primaryAlpha;
  ctx.fill();
}

// ─── Edge geometry helpers ────────────────────────────────────────────────
function getPort(node, toX, toY) {
  const dx = toX - node.x, dy = toY - node.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: node.x, y: node.y };

  const hw = node.width  / 2;
  const hh = node.height / 2;

  if (node.type === 'router') {
    const r = hw + 4;
    return { x: node.x + (dx / dist) * r, y: node.y + (dy / dist) * r };
  }

  const scaleX = hw / Math.abs(dx);
  const scaleY = hh / Math.abs(dy);
  const scale  = Math.min(scaleX, scaleY);
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

function getQuadCP(sp, dp) {
  const mx = (sp.x + dp.x) / 2;
  const my = (sp.y + dp.y) / 2;
  const dist = Math.hypot(dp.x - sp.x, dp.y - sp.y);
  if (dist < 1) return { x: mx, y: my };
  const nx = -(dp.y - sp.y) / dist;
  const ny =  (dp.x - sp.x) / dist;
  const bend = Math.min(dist * 0.12, 40);
  return { x: mx + nx * bend, y: my + ny * bend };
}

// ─── Unified item lookup (nodes + groups) ─────────────────────────────────
function buildItemMap() {
  const m = new Map();
  for (const n of state.nodes) m.set(n.id, n);
  for (const g of state.groups) {
    if (g.collapsed) {
      m.set(g.id, { ...g, width: GROUP_COLLAPSED_SIZE, height: GROUP_COLLAPSED_SIZE });
    } else {
      m.set(g.id, g);
    }
  }
  return m;
}

// ─── Effective endpoint resolution ────────────────────────────────────────
// Returns the ID of the nearest visible ancestor for a hidden item.
// If the item is directly visible, returns its own ID.
function getEffectiveId(id) {
  const node = state.nodes.find(n => n.id === id);
  if (node) return isNodeVisible(node) ? id : climbToVisibleGroup(node.groupId);
  const grp  = state.groups.find(g => g.id === id);
  if (grp)  return isGroupVisible(grp)  ? id : climbToVisibleGroup(grp.groupId);
  return null;
}

// Walk up the groupId chain until we find a collapsed group that is itself visible.
function climbToVisibleGroup(groupId) {
  if (!groupId) return null;
  const g = state.groups.find(g => g.id === groupId);
  if (!g) return null;
  if (g.collapsed && isGroupVisible(g)) return g.id;
  return climbToVisibleGroup(g.groupId);
}

// ─── Edges ─────────────────────────────────────────────────────────────────
function drawEdges(c, zoom, timestamp) {
  const itemMap    = buildItemMap();
  const drawnPairs = new Set();   // deduplication for aggregated edges

  for (const edge of state.edges) {
    if (!itemMap.has(edge.from) && !state.nodes.find(n => n.id === edge.from)) continue;
    if (!itemMap.has(edge.to)   && !state.nodes.find(n => n.id === edge.to))   continue;

    // Resolve each endpoint to its nearest visible representative
    const effFromId = getEffectiveId(edge.from);
    const effToId   = getEffectiveId(edge.to);
    if (!effFromId || !effToId) continue;
    if (effFromId === effToId) continue;   // both ends inside same collapsed group

    // One aggregated edge per directed pair
    const pairKey = `${effFromId}→${effToId}`;
    if (drawnPairs.has(pairKey)) continue;
    drawnPairs.add(pairKey);

    const src = itemMap.get(effFromId);
    const dst = itemMap.get(effToId);
    if (!src || !dst) continue;

    const isAggregated = effFromId !== edge.from || effToId !== edge.to;

    const sp  = getPort(src, dst.x, dst.y);
    const dp  = getPort(dst, src.x, src.y);
    const cp  = getQuadCP(sp, dp);

    // Aggregated edges can't be individually selected/hovered
    const isSelected = !isAggregated && state.selected?.type === 'edge' && state.selected.id === edge.id;
    const isHovered  = !isAggregated && state.hovered?.type  === 'edge' && state.hovered.id  === edge.id;
    const lw = 2 / zoom;

    if (isSelected) {
      ctx.save();
      ctx.shadowBlur  = 12 / zoom;
      ctx.shadowColor = c.primaryGlow;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.quadraticCurveTo(cp.x, cp.y, dp.x, dp.y);
      ctx.strokeStyle = c.primary;
      ctx.lineWidth = lw * 2;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y);
    ctx.quadraticCurveTo(cp.x, cp.y, dp.x, dp.y);
    ctx.strokeStyle = isSelected ? c.primary : (isHovered ? c.borderHover : c.edgeBase);
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.stroke();

    if (edge.animated || isAggregated) {
      const speed   = edge.speed * 35;
      const dashLen = 6 / zoom, gapLen = 18 / zoom;
      const period  = dashLen + gapLen;
      const offset  = -((timestamp * speed / 1000) % period);

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.quadraticCurveTo(cp.x, cp.y, dp.x, dp.y);
      ctx.strokeStyle = c.primary;
      ctx.lineWidth = lw * 1.6;
      ctx.setLineDash([dashLen, gapLen]);
      ctx.lineDashOffset = offset;
      ctx.stroke();
      ctx.setLineDash([]);

      if (edge.bidirectional) {
        const offset2 = (timestamp * speed / 1000) % period;
        ctx.beginPath();
        ctx.moveTo(dp.x, dp.y);
        ctx.quadraticCurveTo(cp.x, cp.y, sp.x, sp.y);
        ctx.strokeStyle = c.primaryAlpha.replace('0.18', '0.65');
        ctx.lineWidth = lw * 1.2;
        ctx.setLineDash([dashLen * 0.7, gapLen * 1.2]);
        ctx.lineDashOffset = offset2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const arrowAngle = Math.atan2(dp.y - cp.y, dp.x - cp.x);
    drawArrow(dp.x, dp.y, arrowAngle, 10 / zoom,
      isSelected ? c.primary : c.edgeBase, lw);

    if (edge.label) {
      const fsz = 11; // world units
      if (fsz * zoom >= 4) {
        const mx = (sp.x + dp.x) / 2;
        const my = (sp.y + dp.y) / 2;
        ctx.font = `500 ${fsz}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(edge.label).width;
        ctx.fillStyle = c.card;
        ctx.fillRect(mx - tw / 2 - 4, my - fsz / 2 - 3, tw + 8, fsz + 6);
        ctx.fillStyle = c.mutedFg;
        ctx.fillText(edge.label, mx, my);
      }
    }
  }
}

function drawArrow(x, y, angle, size, color, lw) {
  const spread = Math.PI / 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - spread), y - size * Math.sin(angle - spread));
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle + spread), y - size * Math.sin(angle + spread));
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  ctx.stroke();
}

// ─── Nodes ─────────────────────────────────────────────────────────────────
const NODE_RADIUS = 12;

function drawNodes(c, zoom) {
  for (const node of state.nodes) {
    if (!isNodeVisible(node)) continue;

    const isSelected = state.selected?.type === 'node' && state.selected.id === node.id;
    const isHovered  = state.hovered?.type  === 'node' && state.hovered.id  === node.id;

    const hw = node.width  / 2;
    const hh = node.height / 2;
    const x  = node.x - hw;
    const y  = node.y - hh;

    ctx.save();
    ctx.shadowBlur    = Math.min(isSelected ? 16 / zoom : 6 / zoom, 40);
    ctx.shadowColor   = isSelected ? c.primaryGlow : c.shadow;
    ctx.shadowOffsetY = isSelected ? 0 : Math.min(2 / zoom, 8);

    ctx.beginPath();
    roundRect(ctx, x, y, node.width, node.height, NODE_RADIUS / zoom);
    ctx.fillStyle = c.card;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    roundRect(ctx, x, y, node.width, node.height, NODE_RADIUS / zoom);
    ctx.strokeStyle = isSelected ? c.primary : isHovered ? c.borderHover : c.border;
    ctx.lineWidth = isSelected ? 2 / zoom : 1.5 / zoom;
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      roundRect(ctx, x - 4 / zoom, y - 4 / zoom,
        node.width + 8 / zoom, node.height + 8 / zoom,
        (NODE_RADIUS + 4) / zoom);
      ctx.strokeStyle = c.primaryAlpha;
      ctx.lineWidth = 3 / zoom;
      ctx.stroke();
    }

    drawNodeIcon(node, c, zoom, isSelected);

    if (node.label) {
      const fsz = 11; // world units
      if (fsz * zoom >= 4) {
        ctx.font = `500 ${fsz}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = c.mutedFg;
        const maxWidth = node.width * 1.1;
        const lines    = wrapText(ctx, node.label, maxWidth);
        const lineH    = fsz * 1.3;
        lines.forEach((line, i) => {
          ctx.fillText(line, node.x, node.y + hh + 6 + i * lineH);
        });
      }
    }
  }
}

function drawNodeIcon(node, c, zoom, isSelected) {
  if (!iconFontReady) return;
  const def = NODE_TYPES[node.type];
  if (!def) return;

  // World-unit size — canvas transform handles zoom scaling.
  // Skip when the resulting screen size would be too small to see.
  const iconSize = node.width * 0.45;
  if (iconSize * zoom < 4) return;

  ctx.font = `300 ${iconSize}px "Material Symbols Outlined"`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = isSelected ? c.primary : c.mutedFg;
  ctx.fillText(def.icon, node.x, node.y);
}

// ─── Connect ghost line ────────────────────────────────────────────────────
export const ghostMouseWorld = { x: 0, y: 0 };

function drawConnectGhost(c, zoom) {
  if (state.tool !== 'connect' || !state.connectFrom) return;
  let src = state.nodes.find(n => n.id === state.connectFrom);
  if (!src) {
    const g = state.groups.find(g => g.id === state.connectFrom);
    if (g) src = g.collapsed
      ? { ...g, width: GROUP_COLLAPSED_SIZE, height: GROUP_COLLAPSED_SIZE }
      : g;
  }
  if (!src) return;

  const sp = getPort(src, ghostMouseWorld.x, ghostMouseWorld.y);
  const cp = getQuadCP(sp, ghostMouseWorld);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.y);
  ctx.quadraticCurveTo(cp.x, cp.y, ghostMouseWorld.x, ghostMouseWorld.y);
  ctx.strokeStyle = c.primary;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([6 / zoom, 10 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Hit-testing exports ───────────────────────────────────────────────────
export function edgeHitTest(edge, wx, wy, zoom) {
  const itemMap = buildItemMap();
  const src = itemMap.get(edge.from);
  const dst = itemMap.get(edge.to);
  if (!src || !dst) return false;

  const sp = getPort(src, dst.x, dst.y);
  const dp = getPort(dst, src.x, src.y);
  const cp = getQuadCP(sp, dp);

  const threshold = 8 / zoom;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const bx = mt * mt * sp.x + 2 * mt * t * cp.x + t * t * dp.x;
    const by = mt * mt * sp.y + 2 * mt * t * cp.y + t * t * dp.y;
    if (Math.hypot(wx - bx, wy - by) < threshold) return true;
  }
  return false;
}

// ─── Resize handles ────────────────────────────────────────────────────────
export function getGroupHandles(group) {
  const lx = group.x - group.width  / 2;
  const ty = group.y - group.height / 2;
  const rx = lx + group.width;
  const by = ty + group.height;
  const mx = group.x;
  const my = group.y;
  return {
    nw: { x: lx, y: ty }, n: { x: mx, y: ty }, ne: { x: rx, y: ty },
    w:  { x: lx, y: my },                        e:  { x: rx, y: my },
    sw: { x: lx, y: by }, s: { x: mx, y: by }, se: { x: rx, y: by },
  };
}

function drawResizeHandles(group, primaryColor, cardColor, zoom) {
  const handles = getGroupHandles(group);
  const size = 8 / zoom;
  const r    = 2 / zoom;

  for (const pos of Object.values(handles)) {
    ctx.beginPath();
    roundRect(ctx, pos.x - size / 2, pos.y - size / 2, size, size, r);
    ctx.fillStyle   = primaryColor;
    ctx.strokeStyle = cardColor;
    ctx.lineWidth   = 1.5 / zoom;
    ctx.fill();
    ctx.stroke();
  }
}

export function hitResizeHandle(group, wx, wy, zoom) {
  const handles = getGroupHandles(group);
  const threshold = 8 / zoom;
  for (const [name, pos] of Object.entries(handles)) {
    if (Math.abs(wx - pos.x) < threshold && Math.abs(wy - pos.y) < threshold) {
      return name; // e.g. 'se', 'nw', 'n', etc.
    }
  }
  return null;
}

// Cursor style for a given resize handle
export function handleCursor(handle) {
  return {
    nw: 'nw-resize', n: 'n-resize',  ne: 'ne-resize',
    w:  'w-resize',                   e:  'e-resize',
    sw: 'sw-resize', s: 's-resize',  se: 'se-resize',
  }[handle] ?? 'default';
}

// ─────────────────────────────────────────────────────────────────────────
// Hit the group header bar (expanded groups only)
export function groupHeaderHitTest(group, wx, wy) {
  if (group.collapsed) return false;
  const lx = group.x - group.width / 2;
  const ty = group.y - group.height / 2;
  return wx >= lx && wx <= lx + group.width &&
         wy >= ty && wy <= ty + GROUP_HEADER_H;
}

// Hit a collapsed group's node box
export function hitCollapsedGroup(wx, wy) {
  const s = GROUP_COLLAPSED_SIZE / 2;
  for (let i = state.groups.length - 1; i >= 0; i--) {
    const g = state.groups[i];
    if (!g.collapsed) continue;
    if (!isGroupVisible(g)) continue;
    if (wx >= g.x - s && wx <= g.x + s && wy >= g.y - s && wy <= g.y + s) return g;
  }
  return null;
}

// Hit the collapse/expand chevron button
// Uses world-unit coordinates — zoom-independent, matching the rendered button.
// Rendered icon center: (lx + group.width - 16, ty + GROUP_HEADER_H/2) in world units.
export function groupCollapseBtnHitTest(group, wx, wy) {
  if (group.collapsed) return false;
  const lx = group.x - group.width / 2;
  const ty = group.y - group.height / 2;
  // Generous hit zone: right 40 world-units of the header bar
  return wx >= lx + group.width - 40 && wx <= lx + group.width &&
         wy >= ty && wy <= ty + GROUP_HEADER_H;
}

// ─── Text wrapping ─────────────────────────────────────────────────────────
// Breaks `text` into lines that each fit within `maxWidth` (world units).
// Uses the current ctx.font for measurement.
function wrapText(ctx, text, maxWidth) {
  // Fast path: fits on one line
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If a single word is wider than maxWidth, push it as-is
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Utility ───────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Rounded rect with only top corners rounded (for group header)
function roundRectTop(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
