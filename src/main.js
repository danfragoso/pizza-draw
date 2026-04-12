import './style.css';
import { initTheme, toggleTheme } from './theme.js';
import { clearState }             from './state.js';
import { initRenderer, render }   from './render.js';
import { initInput, fitToScreen } from './input.js';
import { initUI, updateLockState } from './ui.js';
import { session }                 from './session.js';
import { listDrawings, createDrawing, getDrawing } from './api.js';
import { deserializeState }        from './share.js';

// ─── Routing ───────────────────────────────────────────────────────────────
const DRAWING_ID = new URLSearchParams(window.location.search).get('id');

// ─── Shared escape helper ──────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════
async function initHome() {
  document.getElementById('home-screen').style.display = '';

  document.getElementById('home-theme-toggle')
    ?.addEventListener('click', toggleTheme);

  document.getElementById('new-drawing-btn')
    ?.addEventListener('click', async () => {
      const btn = document.getElementById('new-drawing-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined spin">progress_activity</span> Creating…';
      try {
        const record = await createDrawing({ title: 'Untitled Drawing' });
        const id = record.id ?? record.data?.id;
        window.location.href = `/?id=${id}`;
      } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">add</span> New Drawing';
      }
    });

  try {
    const drawings = await listDrawings();
    renderDrawingsList(drawings);
  } catch (e) {
    console.error(e);
    document.getElementById('drawings-grid').innerHTML =
      '<p class="drawings-empty">Could not load drawings.</p>';
  }
}

function renderDrawingsList(drawings) {
  const grid = document.getElementById('drawings-grid');
  if (!grid) return;

  if (!drawings.length) {
    grid.innerHTML = '<p class="drawings-empty">No drawings yet — create your first one above.</p>';
    return;
  }

  grid.innerHTML = [...drawings]
    .sort((a, b) => b.id - a.id)
    .map(d => `
      <a href="/?id=${d.id}" class="drawing-card">
        <div class="drawing-card-thumb">
          <span class="material-symbols-outlined">${d.password ? 'lock' : 'schema'}</span>
        </div>
        <div class="drawing-card-body">
          <span class="drawing-card-title">${escHtml(d.title || 'Untitled Drawing')}</span>
          <span class="drawing-card-meta">#${d.id}${d.password ? ' · Protected' : ''}</span>
        </div>
        <span class="material-symbols-outlined drawing-card-arrow">chevron_right</span>
      </a>
    `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAWING SCREEN
// ═══════════════════════════════════════════════════════════════════════════
async function initApp() {
  document.getElementById('app-screen').style.display = '';

  const canvas = document.getElementById('canvas');
  initRenderer(canvas);
  initInput(canvas);
  initUI();

  // Start render loop right away so the canvas is visible while loading
  let loopStarted = false;
  function loop(ts) { render(ts); requestAnimationFrame(loop); }
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(loop); }

  try {
    const row = await getDrawing(DRAWING_ID);

    session.id           = row.id;
    session.title        = row.title  || 'Untitled Drawing';
    session.hasPassword  = !!row.password;
    session.passwordHash = row.password || null;
    session.unlocked     = !row.password;

    clearState();
    if (row.drawing) deserializeState(row.drawing);

    const titleInput = document.getElementById('drawing-title');
    if (titleInput) titleInput.value = session.title;

    updateLockState();
    fitToScreen();
  } catch (e) {
    console.error('Failed to load drawing:', e);
    // Still usable as blank canvas; let the user know
    import('./ui.js').then(({ showToast }) =>
      showToast('error', 'Could not load drawing — starting blank'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  initTheme();
  if (DRAWING_ID) {
    await initApp();
  } else {
    await initHome();
  }
}

main().catch(console.error);
