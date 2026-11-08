// 測試用：假的 KV（記憶體）＋把 Worker 包成本機 HTTP 伺服器
import http from 'node:http';
import worker from '../server/leaderboard-worker.js';
export function fakeKV() {
  const m = new Map();
  return { m, async get(k) { const v = m.get(k); if (!v) return null; if (v.exp && v.exp < Date.now()) { m.delete(k); return null; } return v.val; },
    async put(k, val, o = {}) { m.set(k, { val, exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); } };
}
export function serveWorker(port, env) {
  const srv = http.createServer(async (req, res) => {
    const body = await new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
    const r = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? undefined : body });
    const out = await worker.fetch(r, env);
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(await out.text());
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok(srv)));
}
if (process.argv[2] === 'serve') { const port = +process.argv[3]; await serveWorker(port, { LB: fakeKV(), ALLOWED_ORIGINS: '*' }); console.log('READY ' + port); }
