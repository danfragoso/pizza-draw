import { state, NODE_TYPES, GROUP_ICONS, deleteSelected, autoArrangeGroup, autoSizeGroupChain, collapseGroupTree, deOverlapAllItems } from './state.js';
import { setTool, fitToScreen } from './input.js';
import { toggleTheme } from './theme.js';
import { saveToURL } from './share.js';

const GROUP_COLOR_NAMES = ['Green', 'Blue', 'Pink', 'Purple', 'Orange'];

// ─── Init ──────────────────────────────────────────────────────────────────
export function initUI() {
  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // Delete
  document.getElementById('delete-btn')?.addEventListener('click', () => {
    if (state.selected) { deleteSelected(); updateUI(); }
  });

  // Share button
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    const url = await saveToURL();
    try {
      await navigator.clipboard.writeText(url);
      showToast('check_circle', 'Link copied to clipboard');
    } catch {
      showToast('share', 'URL updated — copy from address bar');
    }
  });

  // Theme
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Fit
  document.getElementById('zoom-fit')?.addEventListener('click', fitToScreen);

  // Toolbar toggle (header button)
  document.getElementById('toolbar-toggle')?.addEventListener('click', () => {
    document.getElementById('toolbar')?.classList.toggle('toolbar-hidden');
  });

  // Panel close
  document.getElementById('panel-close')?.addEventListener('click', () => {
    import('./state.js').then(({ selectItem }) => { selectItem(null, null); updateUI(); });
  });

  // Toolbar section collapse
  document.querySelectorAll('.tool-section-header').forEach(btn => {
    const section = btn.closest('.tool-section');
    btn.addEventListener('click', () => {
      section?.classList.toggle('collapsed');
    });
  });

  // Tooltips
  document.querySelectorAll('[title]').forEach(el => {
    el.addEventListener('mouseenter', e => showTooltip(e, el.title));
    el.addEventListener('mouseleave', hideTooltip);
  });

  updateUI();
}

// ─── Update ────────────────────────────────────────────────────────────────
export function updateUI() {
  updateToolbar();
  updatePanel();
  updateDeleteButton();
  // Debounced URL sync so the diagram is always shareable
  import('./share.js').then(({ scheduleSave }) => scheduleSave());
}

function updateToolbar() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === state.tool);
  });
}

function updateDeleteButton() {
  const btn = document.getElementById('delete-btn');
  if (btn) btn.disabled = !state.selected;
}

// ─── Properties panel ─────────────────────────────────────────────────────
function updatePanel() {
  const panel   = document.getElementById('panel');
  const title   = document.getElementById('panel-title');
  const content = document.getElementById('panel-content');
  if (!panel || !title || !content) return;

  if (!state.selected) {
    panel.classList.add('panel-hidden');
    return;
  }

  panel.classList.remove('panel-hidden');

  if (state.selected.type === 'node')  renderNodePanel(title, content);
  else if (state.selected.type === 'edge')  renderEdgePanel(title, content);
  else if (state.selected.type === 'group') renderGroupPanel(title, content);
}

// ── Node panel ─────────────────────────────────────────────────────────────
function renderNodePanel(titleEl, contentEl) {
  const node = state.nodes.find(n => n.id === state.selected?.id);
  if (!node) return;
  const def = NODE_TYPES[node.type];
  titleEl.textContent = 'Node';

  contentEl.innerHTML = `
    <div class="node-info-icon">
      <span class="material-symbols-outlined">${def?.icon ?? 'circle'}</span>
    </div>

    <div class="panel-field">
      <label class="panel-label">Label</label>
      <input class="panel-input" id="node-label-input" type="text"
        value="${esc(node.label)}" placeholder="Node label" />
    </div>

    <div class="panel-field">
      <label class="panel-label">Type</label>
      <span class="type-badge">
        <span class="material-symbols-outlined">${def?.icon ?? 'circle'}</span>
        ${def?.label ?? node.type}
        ${def?.group ? `<span style="opacity:.55;font-size:10px;margin-left:2px">· ${def.group}</span>` : ''}
      </span>
    </div>

    <div class="panel-field">
      <label class="panel-label">Position</label>
      <span class="panel-value">${Math.round(node.x)}, ${Math.round(node.y)}</span>
    </div>

    <div class="panel-field">
      <label class="panel-label">Child of</label>
      <select class="panel-input panel-select" id="node-group-select">
        <option value="">— none —</option>
        ${state.groups.map(g => `<option value="${esc(g.id)}" ${node.groupId === g.id ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}
      </select>
    </div>
  `;

  contentEl.querySelector('#node-label-input')?.addEventListener('input', e => {
    node.label = e.target.value;
  });

  contentEl.querySelector('#node-group-select')?.addEventListener('change', e => {
    const oldId = node.groupId;
    const newId = e.target.value || null;
    node.groupId = newId;
    if (oldId) { const g = state.groups.find(g => g.id === oldId); if (g) autoSizeGroupChain(g); }
    if (newId) { const g = state.groups.find(g => g.id === newId); if (g) autoSizeGroupChain(g); }
  });
}

// ── Edge panel ─────────────────────────────────────────────────────────────
function renderEdgePanel(titleEl, contentEl) {
  const edge = state.edges.find(e => e.id === state.selected?.id);
  if (!edge) return;

  const srcNode = state.nodes.find(n => n.id === edge.from);
  const dstNode = state.nodes.find(n => n.id === edge.to);
  titleEl.textContent = 'Connection';

  contentEl.innerHTML = `
    <div class="panel-field">
      <label class="panel-label">Label</label>
      <input class="panel-input" id="edge-label-input" type="text"
        value="${esc(edge.label)}" placeholder="e.g. 1 Gbps" />
    </div>

    <div class="panel-field">
      <label class="panel-label">Path</label>
      <span class="panel-value">
        ${esc(srcNode?.label ?? '?')} → ${esc(dstNode?.label ?? '?')}
      </span>
    </div>

    <div class="panel-section">
      <div class="panel-section-title">Traffic Simulation</div>

      <div class="toggle-row">
        <span class="toggle-label">Animate flow</span>
        <label class="toggle">
          <input type="checkbox" id="edge-animated" ${edge.animated ? 'checked' : ''} />
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </div>

      <div class="toggle-row">
        <span class="toggle-label">Bidirectional</span>
        <label class="toggle">
          <input type="checkbox" id="edge-bidir" ${edge.bidirectional ? 'checked' : ''} />
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </div>

      <div class="panel-field">
        <label class="panel-label">Speed</label>
        <input type="range" class="slider" id="edge-speed"
          min="0.25" max="4" step="0.25" value="${edge.speed}" />
        <div class="speed-labels"><span>Slow</span><span>Fast</span></div>
      </div>
    </div>
  `;

  contentEl.querySelector('#edge-label-input')?.addEventListener('input', e => { edge.label = e.target.value; });
  contentEl.querySelector('#edge-animated')?.addEventListener('change',   e => { edge.animated = e.target.checked; });
  contentEl.querySelector('#edge-bidir')?.addEventListener('change',      e => { edge.bidirectional = e.target.checked; });
  contentEl.querySelector('#edge-speed')?.addEventListener('input',       e => { edge.speed = parseFloat(e.target.value); });
}

// ── Group panel ────────────────────────────────────────────────────────────
function renderGroupPanel(titleEl, contentEl) {
  const grp = state.groups.find(g => g.id === state.selected?.id);
  if (!grp) return;
  titleEl.textContent = 'Group / Subnet';

  contentEl.innerHTML = `
    <div class="node-info-icon">
      <span class="material-symbols-outlined">${esc(grp.icon ?? 'account_tree')}</span>
    </div>

    <div class="panel-field">
      <label class="panel-label">Label</label>
      <input class="panel-input" id="group-label-input" type="text"
        value="${esc(grp.label)}" placeholder="e.g. 192.168.1.0/24" />
    </div>

    <div class="panel-field">
      <label class="panel-label">Icon</label>
      <div class="icon-picker" id="group-icon-picker"></div>
    </div>

    <div class="panel-field">
      <label class="panel-label">Color</label>
      <div class="color-swatches" id="color-swatches"></div>
    </div>

    <div class="toggle-row" style="margin-top:4px">
      <span class="toggle-label">Collapsed</span>
      <label class="toggle">
        <input type="checkbox" id="group-collapsed" ${grp.collapsed ? 'checked' : ''} />
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
    </div>

    <div class="panel-field">
      <label class="panel-label">Child of</label>
      <select class="panel-input panel-select" id="group-parent-select">
        <option value="">— none —</option>
        ${state.groups.filter(g => g.id !== grp.id && g.groupId !== grp.id).map(g =>
          `<option value="${esc(g.id)}" ${grp.groupId === g.id ? 'selected' : ''}>${esc(g.label)}</option>`
        ).join('')}
      </select>
    </div>

    <div class="panel-field" style="margin-top:4px">
      <label class="panel-label">Size</label>
      <span class="panel-value">${Math.round(grp.width)} × ${Math.round(grp.height)}</span>
    </div>

    <button class="panel-action-btn" id="group-arrange-btn">
      <span class="material-symbols-outlined">grid_view</span>
      Auto-arrange nodes
    </button>
  `;

  // Icon picker
  const iconPickerEl = contentEl.querySelector('#group-icon-picker');
  if (iconPickerEl) {
    iconPickerEl.innerHTML = GROUP_ICONS.map(icon => `
      <button class="icon-pick-btn ${(grp.icon ?? 'account_tree') === icon ? 'active' : ''}"
        data-icon="${icon}" title="${icon}">
        <span class="material-symbols-outlined">${icon}</span>
      </button>
    `).join('');
    const nodeInfoIcon = contentEl.querySelector('.node-info-icon span');
    iconPickerEl.querySelectorAll('.icon-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grp.icon = btn.dataset.icon;
        if (nodeInfoIcon) nodeInfoIcon.textContent = btn.dataset.icon;
        iconPickerEl.querySelectorAll('.icon-pick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // Colour swatches
  const swatchEl = contentEl.querySelector('#color-swatches');
  if (swatchEl) {
    const colors = ['#7fba00','#2a79c9','#c9376c','#7c4dc9','#c97a2a'];
    swatchEl.innerHTML = colors.map((col, i) => `
      <button class="color-swatch ${grp.colorIndex === i ? 'active' : ''}"
        style="background:${col}" data-idx="${i}" title="${GROUP_COLOR_NAMES[i]}"></button>
    `).join('');
    swatchEl.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        grp.colorIndex = parseInt(btn.dataset.idx);
        swatchEl.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  contentEl.querySelector('#group-label-input')?.addEventListener('input', e => { grp.label = e.target.value; });
  contentEl.querySelector('#group-collapsed')?.addEventListener('change',  e => {
    if (e.target.checked) { collapseGroupTree(grp); deOverlapAllItems(); }
    else { grp.collapsed = false; autoArrangeGroup(grp); deOverlapAllItems(); }
  });
  contentEl.querySelector('#group-parent-select')?.addEventListener('change', e => {
    const oldId = grp.groupId;
    const newId = e.target.value || null;
    grp.groupId = newId;
    if (oldId) { const g = state.groups.find(g => g.id === oldId); if (g) autoSizeGroupChain(g); }
    if (newId) { const g = state.groups.find(g => g.id === newId); if (g) autoSizeGroupChain(g); }
  });
  contentEl.querySelector('#group-arrange-btn')?.addEventListener('click', () => {
    autoArrangeGroup(grp);
  });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────
let tooltipTimer;

function showTooltip(e, text) {
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    const el = document.getElementById('tooltip');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    const rect = (e.target ?? e).getBoundingClientRect();
    el.style.left = (rect.right + 10) + 'px';
    el.style.top  = (rect.top + rect.height / 2) - el.offsetHeight / 2 + 'px';
  }, 420);
}

function hideTooltip() {
  clearTimeout(tooltipTimer);
  const el = document.getElementById('tooltip');
  if (el) el.classList.add('hidden');
}

// ─── Toast ────────────────────────────────────────────────────────────────
let _toastTimer;

export function showToast(icon, message, durationMs = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${message}`;
  el.classList.remove('toast-hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('toast-hidden'), durationMs);
}

// ─── Utility ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
