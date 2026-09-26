import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.DATABASE_URL;
const databaseKey = process.env.DATABASE_KEY;
const distDir = resolve('dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

async function proxyQuery(req, res) {
  if (!databaseUrl || !databaseKey) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database is not configured' }));
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) {
      res.writeHead(413);
      res.end();
      return;
    }
    chunks.push(chunk);
  }

  try {
    const response = await fetch(databaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${databaseKey}`,
        'Content-Type': 'application/json',
      },
      body: Buffer.concat(chunks),
    });
    const body = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    });
    res.end(body);
  } catch (error) {
    console.error('Database request failed:', error);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database request failed' }));
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = resolve(distDir, `.${requestedPath}`);

  if (!filePath.startsWith(`${distDir}${sep}`)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/query') {
    await proxyQuery(req, res);
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(req, res);
    return;
  }
  res.writeHead(405, { Allow: 'GET, HEAD, POST' });
  res.end('Method not allowed');
}).listen(port, '0.0.0.0', () => {
  console.log(`PizzaDraw listening on port ${port}`);
});
