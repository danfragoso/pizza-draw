const BASE_URL = '/api';

// ─── Raw query helper ──────────────────────────────────────────────────────
async function query(sql, params = []) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// Response format: { columns: [{name, type}], rows: [[v, v, ...], ...], ... }
// Rows are positional arrays — convert to objects using column names.
function parseRows(data) {
  const cols = (data.columns ?? []).map(c => c.name);
  return (data.rows ?? []).map(row =>
    Object.fromEntries(cols.map((col, i) => [col, row[i]])),
  );
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function listDrawings() {
  const data = await query(
    'SELECT id, title, password FROM drawings ORDER BY id DESC',
  );
  return parseRows(data);
}

export async function getDrawing(id) {
  const data = await query(
    'SELECT * FROM drawings WHERE id = ?', [Number(id)],
  );
  const rows = parseRows(data);
  if (!rows.length) throw new Error(`Drawing ${id} not found`);
  return rows[0];
}

export async function createDrawing(payload) {
  await query(
    'INSERT INTO drawings (title, drawing, password) VALUES (?, ?, ?)',
    [payload.title ?? 'Untitled Drawing', payload.drawing ?? null, payload.password ?? null],
  );
  // RETURNING isn't surfaced by this API — grab the last inserted id separately
  const idData = await query('SELECT max(id) AS id FROM drawings');
  const id = parseRows(idData)[0]?.id;
  return { id, ...payload };
}

export async function deleteDrawing(id) {
  await query('DELETE FROM drawings WHERE id = ?', [Number(id)]);
}

export async function updateDrawing(id, payload) {
  const fields      = Object.keys(payload);
  const setClauses  = fields.map(f => `${f} = ?`).join(', ');
  const values      = fields.map(f => payload[f]);
  await query(
    `UPDATE drawings SET ${setClauses} WHERE id = ?`,
    [...values, Number(id)],
  );
}
