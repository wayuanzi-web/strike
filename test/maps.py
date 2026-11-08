"""地圖檢查：每張地圖畫俯視圖（方塊、包點、出生點、守點、集合點、裝彈點），並檢查
1. 兩邊出生點之間有沒有直線看得到（取樣）  2. 裝彈點、守點、集合點、post 走得到、站得下
3. 路點全部連在一起  4. 每個地圖從各個角度截圖
用法：python3 maps.py [地圖 id ...]"""
import asyncio, base64, sys, json
from harness import *

DRAW = """(id) => {
  const s = window.__strike; s.switchMap(id); const M = s.getMap();
  const S = 12, cv = document.createElement('canvas'); cv.width = 74 * S; cv.height = 54 * S; const c = cv.getContext('2d');
  const P = (x, z) => [(x + 37) * S, (27 - z) * S];
  c.fillStyle = '#1e2229'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = 'rgba(120,200,120,.18)'; for (const n of s.NAV.nodes) if (n.ok && n.nb.length) { const [x, y] = P(n.x, n.z); c.fillRect(x - 3, y - 3, 6, 6); }
  for (let i = 1; i < s.BOXES.length; i++) { const b = s.BOXES[i]; const [x0, y0] = P(b.min[0], b.max[2]), [x1, y1] = P(b.max[0], b.min[2]);
    c.fillStyle = b.max[1] > 2 ? '#c9bfae' : b.max[1] > 1.2 ? '#9a8f7c' : '#6f6656'; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
  c.strokeStyle = '#555c66'; for (let x = -36; x <= 36; x += 4) { const [a] = P(x, 0); c.beginPath(); c.moveTo(a, 0); c.lineTo(a, cv.height); c.stroke(); }
  for (let z = -24; z <= 24; z += 4) { const [, b] = P(0, z); c.beginPath(); c.moveTo(0, b); c.lineTo(cv.width, b); c.stroke(); }
  c.fillStyle = '#fff'; c.font = '11px sans-serif'; for (let x = -36; x <= 36; x += 8) { const [a] = P(x, 0); c.fillText(x, a + 2, 12); } for (let z = -24; z <= 24; z += 8) { const [, b] = P(0, z); c.fillText(z, 2, b - 2); }
  const dot = (x, z, col, r = 5) => { const [a, b] = P(x, z); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); };
  for (const [k, st] of Object.entries(s.SITES)) {
    const [x0, y0] = P(st.x0, st.z1), [x1, y1] = P(st.x1, st.z0); c.strokeStyle = '#ffc43c'; c.lineWidth = 2; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = '#ffc43c'; c.font = 'bold 30px sans-serif'; const [cx, cy] = P(st.cx, st.cz); c.fillText(k, cx - 9, cy + 10);
    for (const p of st.plants) dot(p[0], p[1], '#ff5a3d', 6);
    for (const h of st.holds) { dot(h[0], h[1], '#7fe9f0', 6); const [a, b] = P(h[0], h[1]), [e, f] = P(h[2], h[3]); const L = Math.hypot(e - a, f - b); c.strokeStyle = '#7fe9f0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a, b); c.lineTo(a + (e - a) / L * 30, b + (f - b) / L * 30); c.stroke(); }
    for (const p of st.post) dot(p[0], p[1], '#ffb0ff', 4);
    for (const p of st.smokes) dot(p[0], p[1], '#bbbbbb', 7);
    dot(st.stage[0], st.stage[1], '#ff9a3d', 8);
  }
  for (const p of s.TEAM_SPAWN.atk) dot(p[0], p[1], '#ff8f80', 5);
  for (const p of s.TEAM_SPAWN.def) dot(p[0], p[1], '#5fd8ee', 5);
  // 檢查
  const V = s.camera.position.constructor, out = { id, boxes: s.BOXES.length, problems: [] };
  // 1. 出生點之間的直線視野（攻方出生區 12×14、守方出生區 12×14，各取 24 點，三種高度）
  let clear = 0, tot = 0; const lines = [];
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const a = new V(-34 + (i % 4) * 2.5, 1.6, -6 + Math.floor(i / 4) * 2.4), b = new V(26 + (j % 4) * 2.5, 1.6, -6 + Math.floor(j / 4) * 2.4);
    tot++; if (s.lineClear(a, b)) { clear++; if (lines.length < 12) lines.push([a.x, a.z, b.x, b.z]); }
  }
  out.spawnLines = clear + '/' + tot;
  c.strokeStyle = 'rgba(255,60,60,.8)'; c.lineWidth = 1; for (const l of lines) { const [a, b] = P(l[0], l[1]), [e, f] = P(l[2], l[3]); c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); }
  // 2. 走得到
  const reach = (x0, z0, x1, z1) => { const p = s.findPath(x0, z0, x1, z1); if (!p || !p.length) return false; const e = p[p.length - 1]; return Math.hypot(e[0] - x1, e[1] - z1) < 1.6; };
  const A0 = s.TEAM_SPAWN.atk[0], D0 = s.TEAM_SPAWN.def[0];
  for (const [k, st] of Object.entries(s.SITES)) {
    for (const p of st.plants) { if (!s.siteAt(p[0], 0, p[1])) out.problems.push(`${k} 裝彈點不在包點內 ${p}`); if (!reach(A0[0], A0[1], p[0], p[1])) out.problems.push(`${k} 裝彈點走不到 ${p}`); }
    for (const h of st.holds) if (!reach(D0[0], D0[1], h[0], h[1])) out.problems.push(`${k} 守點走不到 ${h}`);
    for (const p of st.post) if (!reach(A0[0], A0[1], p[0], p[1])) out.problems.push(`${k} post 走不到 ${p}`);
    if (!reach(A0[0], A0[1], st.stage[0], st.stage[1])) out.problems.push(`${k} 集合點走不到`);
    out['dist_atk_' + k] = Math.round(s.findPath(A0[0], A0[1], st.cx, st.cz).reduce((acc, p, i, arr) => acc + (i ? Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) : Math.hypot(p[0] - A0[0], p[1] - A0[1])), 0));
    out['dist_def_' + k] = Math.round(s.findPath(D0[0], D0[1], st.cx, st.cz).reduce((acc, p, i, arr) => acc + (i ? Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) : Math.hypot(p[0] - D0[0], p[1] - D0[1])), 0));
  }
  // 集合點：有沒有被守點看到、走到包點中心多遠
  const plen = (pa) => pa ? pa.reduce((acc, p, i, arr) => acc + (i ? Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) : 0), 0) : -1;
  for (const [k, st] of Object.entries(s.SITES)) {
    let seen = 0; for (const h of st.holds) for (const dx of [-1.5, 0, 1.5]) if (s.lineClear(new V(h[0], 1.6, h[1]), new V(st.stage[0] + dx, 1.5, st.stage[1]))) seen++;
    out['stage_' + k] = { seenBy: seen, toSite: Math.round(plen(s.findPath(st.stage[0], st.stage[1], st.cx, st.cz))) };
  }
  for (const p of s.TEAM_SPAWN.atk.concat(s.TEAM_SPAWN.def, s.PLAYER_SPAWNS, s.BOT_SPAWNS)) { const n = s.nearestNode(p[0], p[1]); if (!n || Math.hypot(n.x - p[0], n.z - p[1]) > 2) out.problems.push('出生點不在路點上 ' + p); }
  // 3. 路點連通
  const ok = s.NAV.nodes.filter((n) => n.ok && n.nb.length), seen = new Set([ok[0].id]), q = [ok[0]];
  while (q.length) { const n = q.pop(); for (const m of n.nb) if (!seen.has(m)) { seen.add(m); q.push(s.NAV.nodes[m]); } }
  out.nav = seen.size + '/' + ok.length;
  if (seen.size < ok.length) out.problems.push('路點沒有全部連在一起');
  out.png = cv.toDataURL('image/png');
  return out;
}"""

async def main():
    ids = sys.argv[1:] or ['dawn', 'market', 'rail', 'site']
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.evaluate("() => { window.__strike.game.manual = true; }")
        for id in ids:
            r = await page.evaluate(DRAW, id)
            open(OUT / f'map_{id}.png', 'wb').write(base64.b64decode(r.pop('png').split(',')[1]))
            print(json.dumps(r, ensure_ascii=False))
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
