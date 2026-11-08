// 破曉突擊 排行榜：Cloudflare Worker ＋ KV（免費方案就夠用）
// 部署步驟見 server/README.md。這個檔案也能在 Node 裡測試（test/lb-test.mjs）。
//
// 存什麼：暱稱、隨機玩家編號（遊戲第一次上傳時產生，不是帳號）、分數、日期。不存 IP、不存任何個資。
// 防亂填：
//   1. 每筆分數都檢查合不合理（練槍場反應 150 毫秒以上、打倒 20 個以上、命中率不超過 100%；生涯至少 10 場、勝場不超過場數…）。
//   2. 同一個 IP 每小時最多上傳 20 次（只拿來計數，1 小時後自動刪掉）。
//   3. 同一個玩家編號只留最好的一筆。
//   遊戲在瀏覽器裡跑，送出的分數一定可以被有心人偽造；這些檢查只擋得住「亂填」，擋不住「偽造得很像」。
//   想再嚴格可以加 Cloudflare Turnstile（免費的人機驗證），或排行榜只開放給朋友。

const BOARDS = {
  // 練槍場：平均反應越快越前面
  range: {
    check(d) {
      const avgMs = Math.round(+d.avgMs), hit = Math.round(+d.hit), acc = +d.acc, heads = Math.round(+d.heads || 0);
      if (!(avgMs >= 150 && avgMs <= 4000)) return null;
      if (!(hit >= 20 && hit <= 30)) return null;
      if (!(acc > 0 && acc <= 1)) return null;
      if (!(heads >= 0 && heads <= hit)) return null;
      return { avgMs, hit, acc: Math.round(acc * 1000) / 1000, heads };
    },
    better: (a, b) => a.avgMs < b.avgMs || (a.avgMs === b.avgMs && a.acc > b.acc),
  },
  // 生涯對戰：勝率（至少 10 場）
  career: {
    check(d) {
      const matches = Math.round(+d.matches), wins = Math.round(+d.wins), kills = Math.round(+d.kills || 0);
      if (!(matches >= 10 && matches <= 100000)) return null;
      if (!(wins >= 0 && wins <= matches)) return null;
      if (!(kills >= 0 && kills <= matches * 80)) return null;
      return { matches, wins, kills, rate: Math.round(wins / matches * 1000) / 1000 };
    },
    better: (a, b) => a.rate > b.rate || (a.rate === b.rate && a.matches > b.matches),
  },
};
const KEEP = 200, SHOW = 50, RATE = 20;
const BAD = ['幹', '操你', '靠北', 'fuck', 'shit'];   // 很粗略的髒話過濾
function cleanNick(n) {
  n = String(n || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').trim().slice(0, 12);
  if (n.length < 1 || BAD.some((w) => n.toLowerCase().includes(w))) return '';
  return n;
}
const cleanId = (id) => (/^[a-z0-9]{8,24}$/.test(String(id || '')) ? String(id) : '');

function cors(origin, allowed) {
  const ok = !allowed || allowed === '*' || allowed.split(',').map((s) => s.trim()).includes(origin);
  return { 'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...h } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '', H = cors(origin, env.ALLOWED_ORIGINS);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    if (req.method === 'GET' && url.pathname === '/top') {
      const board = url.searchParams.get('board'); if (!BOARDS[board]) return json({ error: 'board' }, 400, H);
      const list = JSON.parse((await env.LB.get('board:' + board)) || '[]');
      // 不回傳玩家編號（別人拿不到就冒用不了）；帶自己的編號來問，會標出哪一筆是你
      const me = cleanId(url.searchParams.get('id'));
      const top = list.slice(0, SHOW).map(({ id, ...e }, i) => ({ rank: i + 1, ...e, me: !!me && id === me }));
      const mine = me ? list.findIndex((e) => e.id === me) + 1 : 0;
      return json({ board, top, myRank: mine || null, total: list.length }, 200, { ...H, 'Cache-Control': 'no-store' });
    }
    if (req.method === 'POST' && url.pathname === '/submit') {
      let d; try { d = await req.json(); } catch (e) { return json({ error: '格式不對' }, 400, H); }
      const B = BOARDS[d.board]; if (!B) return json({ error: '沒有這個排行榜' }, 400, H);
      const id = cleanId(d.id), nick = cleanNick(d.nick); if (!id) return json({ error: '玩家編號不對' }, 400, H);
      if (!nick) return json({ error: '暱稱不能用（1–12 個字、不要髒話）' }, 400, H);
      const sc = B.check(d.score || {}); if (!sc) return json({ error: '分數不合理，沒有收' }, 422, H);
      // 每小時每個 IP 最多 20 次（IP 只當計數的鑰匙，1 小時自動過期）
      const ip = req.headers.get('CF-Connecting-IP') || 'local', hour = Math.floor(Date.now() / 3600000), rk = `rl:${ip}:${hour}`;
      const n = +((await env.LB.get(rk)) || 0); if (n >= RATE) return json({ error: '上傳太頻繁，等一下再試' }, 429, H);
      await env.LB.put(rk, String(n + 1), { expirationTtl: 3700 });
      const key = 'board:' + d.board, list = JSON.parse((await env.LB.get(key)) || '[]');
      const entry = { id, nick, ...sc, date: new Date().toISOString().slice(0, 10) };
      const i = list.findIndex((e) => e.id === id);
      let improved = true;
      if (i >= 0) { if (B.better(entry, list[i])) list.splice(i, 1); else improved = false; }   // 只留最好的一筆
      if (improved) { let at = list.findIndex((e) => B.better(entry, e)); if (at < 0) at = list.length; list.splice(at, 0, entry); }
      list.length = Math.min(list.length, KEEP);
      await env.LB.put(key, JSON.stringify(list));
      const rank = list.findIndex((e) => e.id === id) + 1;
      return json({ ok: true, improved, rank: rank || null, total: list.length }, 200, H);
    }
    return json({ error: 'not found' }, 404, H);
  },
};
