import './env.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { respond, approve, resetProduction, resetMeter, status } from './lab.js';
import { vlog, C, newRid, withRid } from './log.js';

const PORT = process.env.PORT || 3001;
const INDEX = fileURLToPath(new URL('./public/index.html', import.meta.url));
// Límite alto a propósito: LLM10 necesita poder mandar un "documento enorme"
const MAX_BODY = 300_000;

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) throw Object.assign(new Error('muy grande'), { code: 413 }); }
  return JSON.parse(raw || '{}');
}

const server = http.createServer((req, res) => {
  // Usa el x-request-id entrante si es válido; si no, genera uno.
  const inc = req.headers['x-request-id'];
  const rid = typeof inc === 'string' && /^[\w-]{1,64}$/.test(inc) ? inc : newRid();
  res.setHeader('x-request-id', rid);

  withRid(rid, async () => {
    const t0 = performance.now();
    const isPost = req.method === 'POST';
    try {
      if (req.method === 'GET' && req.url === '/') return send(res, 200, await readFile(INDEX, 'utf8'), 'text/html');
      if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, await status());
      if (isPost && req.url === '/api/chat') return send(res, 200, { ...(await respond(await readJson(req))), requestId: rid });
      if (isPost && req.url === '/api/approve') { const b = await readJson(req); return send(res, 200, approve(String(b.id), !!b.ok)); }
      if (isPost && req.url === '/api/reset') {
        const b = await readJson(req);
        return send(res, 200, b.what === 'meter' ? { meter: resetMeter(String(b.session)) } : { prod: resetProduction() });
      }
      send(res, 404, { error: 'no encontrado' });
    } catch (e) {
      vlog(`💥 Error: ${e.message || e}`, C.red);
      send(res, e.code === 413 ? 413 : 500, { error: String(e.message || e), requestId: rid });
    } finally {
      if (isPost) vlog(`⏱  ${req.method} ${req.url} → ${res.statusCode} · ${(performance.now() - t0).toFixed(0)} ms`, C.dim);
    }
  });
});

// Solo localhost: el lab tiene vulnerabilidades a propósito.
server.listen(PORT, '127.0.0.1', () => console.log(`Lab LLM 2 en http://127.0.0.1:${PORT}`));
