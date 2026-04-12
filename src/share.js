import { state }          from './state.js';
import { session }         from './session.js';
import { updateDrawing }   from './api.js';

// ─── Serialize / deserialize diagram state ────────────────────────────────
export function serializeState() {
  return JSON.stringify({
    v:      2,
    nodes:  state.nodes,
    edges:  state.edges,
    groups: state.groups,
    camera: state.camera,
  });
}

export function deserializeState(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(data.nodes))  state.nodes  = data.nodes;
    if (Array.isArray(data.edges))  state.edges  = data.edges;
    if (Array.isArray(data.groups)) state.groups = data.groups;
    if (data.camera?.zoom)          state.camera = data.camera;
  } catch (e) {
    console.error('Failed to deserialize state:', e);
  }
}

// ─── Save current drawing to API ──────────────────────────────────────────
export async function saveDrawing() {
  if (!session.id || !session.unlocked) return;
  await updateDrawing(session.id, {
    drawing: serializeState(),
    title:   session.title,
  });
}

// ─── Debounced auto-save ──────────────────────────────────────────────────
let _saveTimer = null;

export function scheduleSave() {
  if (!session.id || !session.unlocked) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveDrawing().catch(console.error), 2000);
}
