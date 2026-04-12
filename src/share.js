import { state } from './state.js';

// ─── Compression helpers (deflate-raw + base64url) ────────────────────────
async function compress(str) {
  const bytes = new TextEncoder().encode(str);
  const cs    = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf    = await new Response(cs.readable).arrayBuffer();
  let binary   = '';
  for (const b of new Uint8Array(buf)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function decompress(encoded) {
  const b64    = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes  = Uint8Array.from(binary, c => c.charCodeAt(0));
  const ds     = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Response(ds.readable).text();
}

// ─── Encode / decode state ────────────────────────────────────────────────
export async function encodeCurrentState() {
  const payload = {
    v:      1,
    nodes:  state.nodes,
    edges:  state.edges,
    groups: state.groups,
    camera: state.camera,
  };
  return compress(JSON.stringify(payload));
}

export async function decodeFromHash(hash) {
  try {
    const encoded = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!encoded) return null;
    const json = await decompress(encoded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Save / load ──────────────────────────────────────────────────────────
export async function saveToURL() {
  const encoded = await encodeCurrentState();
  history.replaceState(null, '', '#' + encoded);
  return window.location.href;
}

export async function loadFromURL() {
  const hash = window.location.hash;
  if (!hash || hash === '#') return false;

  const data = await decodeFromHash(hash);
  if (!data) return false;

  if (Array.isArray(data.nodes))  state.nodes  = data.nodes;
  if (Array.isArray(data.edges))  state.edges  = data.edges;
  if (Array.isArray(data.groups)) state.groups = data.groups;
  if (data.camera && typeof data.camera.zoom === 'number') {
    state.camera = data.camera;
  }

  return true;
}

// ─── Auto-save (debounced, runs after state settles) ─────────────────────
let _saveTimer = null;

export function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveToURL, 1500);
}
