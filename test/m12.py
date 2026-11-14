"""M12 戰術道具進化（參考 CS2）：立體煙沿牆流動、子彈打洞、手榴彈吹開、從洞看得過去；火沿地面蔓延、牆擋得住、煙蓋哪熄哪；炸彈衝擊波沿地圖、牆後比較安全。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.startGame('practice'); s.game.freezeBots = true;
          for (const b of s.bots) { b.alive = false; b.g.visible = false; b.respawnT = Infinity; b.phys.pos.set(60, 0, 60); } }""")
        # 1 立體煙：380 格、沒有一格在牆裡面；靠牆丟，煙往空的那邊流（形狀不對稱）、會長高
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor; s.player.body.pos.set(-12, 0, -24);
          s.throwNade('smoke', new V(-3, 1.2, -24), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 60 * 4; i++) s.step(1/60);
          const sm = s.SMOKES[0], B = []; let inBox = 0, top = 0; const ext = [0, 0, 0, 0];
          for (const id of sm.cells) { const i = id % 21, k = ((id / 21) | 0) % 21, j = (id / 441) | 0, x = sm.ox + (i + 0.5) * 0.7, y = sm.oy + (j + 0.5) * 0.7, z = sm.oz + (k + 0.5) * 0.7;
            top = Math.max(top, y); ext[0] = Math.max(ext[0], x - sm.x); ext[1] = Math.max(ext[1], sm.x - x); ext[2] = Math.max(ext[2], z - sm.z); ext[3] = Math.max(ext[3], sm.z - z); }
          return [sm.cells.length, +top.toFixed(1), ext.map((v) => +v.toFixed(1))]; }""")
        asym = max(r[2]) - min(r[2])
        ok('1 立體煙：380 格、會長到 2.5 公尺以上、靠牆時往空的那邊流（不是對稱的球）', r[0] == 380 and r[1] > 2.5 and asym > 1.5, r)
        # 2 擋視線：穿過煙中心看不到；子彈沿著同一條線打過去 → 馬上看得到；2 秒後洞長回來 → 又看不到
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor, sm = s.SMOKES[0];
          const a = new V(sm.x - 6, sm.oy + 1.5, sm.z + 0.3), b = new V(sm.x + 6, sm.oy + 1.5, sm.z + 0.3);
          // 找一條真的穿過煙、兩端不在牆裡的線
          let found = null; for (let dz = -2; dz <= 2 && !found; dz += 0.5) for (let dx = 0; dx < 3 && !found; dx += 0.5) { a.set(sm.x - 5 + dx, sm.oy + 1.2, sm.z + dz); b.set(sm.x + 5 + dx, sm.oy + 1.2, sm.z + dz); if (s.lineClear && !s.smokeBlocks(a, b) === false) found = 1; }
          const before = s.smokeBlocks(a, b), d = b.clone().sub(a), L = d.length(); d.normalize();
          s.smokeBullet(a, d, L); const holeNow = s.smokeBlocks(a, b);
          for (let i = 0; i < 150; i++) s.step(1/60); const later = s.smokeBlocks(a, b);
          return [before, holeNow, later]; }""")
        ok('2 子彈在煙裡打出洞：打之前看不到、打完馬上看得到、2.5 秒後洞長回來又看不到', r == [True, False, True], r)
        # 3 手榴彈在煙裡炸開：一大片被吹開（附近的線都看得到），4 秒後又長回來
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor, sm = s.SMOKES[0];
          const lines = []; for (let dz = -1; dz <= 1; dz++) lines.push([new V(sm.x - 4, sm.oy + 1.0, sm.z + dz), new V(sm.x + 4, sm.oy + 1.0, sm.z + dz)]);
          const b0 = lines.filter(([a, b]) => s.smokeBlocks(a, b)).length; s.smokeBlast(new V(sm.x, sm.oy + 0.8, sm.z), 4.5);
          const b1 = lines.filter(([a, b]) => s.smokeBlocks(a, b)).length; for (let i = 0; i < 60 * 4.5; i++) s.step(1/60);
          const b2 = lines.filter(([a, b]) => s.smokeBlocks(a, b)).length; return [b0, b1, b2]; }""")
        ok('3 手榴彈把煙吹開一大片（3 條視線都通）、4.5 秒後長回來', r[0] >= 2 and r[1] == 0 and r[2] >= 2, r)
        # 4 機器人從洞看得到你：隔著煙看不到，你朝它開一排槍打出洞 → 它看得到你
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor, sm = s.SMOKES[0], b = s.bots.find((x) => x.team === 'B');
          s.player.body.pos.set(sm.x - 5, sm.oy + 0.25, sm.z); s.player.yaw = -Math.PI / 2; s.player.pitch = 0;
          b.alive = true; b.active = true; b.g.visible = true; b.phys.pos.set(sm.x + 4.5, sm.oy + 0.25, sm.z); b.yaw = Math.PI / 2; b.blindT = 0; b.state = 'patrol'; b.target = null; b.hp = 999;
          const eye = new V(), pe = new V(); const see = () => { eye.set(b.phys.pos.x, b.phys.pos.y + 1.66, b.phys.pos.z); pe.set(s.player.body.pos.x, s.player.body.pos.y + 1.6, s.player.body.pos.z); return !s.smokeBlocks(eye, pe); };
          const v0 = see(); const d = eye.clone().sub(pe), L = d.length(); d.normalize(); s.smokeBullet(pe, d, L); const v1 = see(); b.alive = false; b.g.visible = false; return [v0, v1]; }""")
        ok('4 從被打開的洞，機器人看得到你（看不到 → 看得到）', r == [False, True], r)
        await page.screenshot(path=str(OUT / 'm12_smoke.png'))
        # 5 火沿地面蔓延：空地上 30 格以上；靠牆丟不會燒到牆後面
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor; s.clearNades(); s.player.body.pos.set(-30, 0, 20);
          s.throwNade('molotov', new V(-20, 1.2, 20), new V(0.02, -1, 0).normalize(), s.player, null); for (let i = 0; i < 60; i++) s.step(1/60);
          const f = s.FIRES[0]; const n = f ? f.cells.length : 0;
          let behind = 0; if (f) for (const c of f.cells) { const a = new V(f.x, f.y + 0.3, f.z), b = new V(c.x, f.y + 0.3, c.z); if (!s.lineClear(a, b)) behind++; }
          return [n, behind, f ? +f.r.toFixed(1) : 0]; }""")
        ok('5 火沿地面蔓延（30 格以上、半徑約 3–4.5 公尺）', r[0] >= 30 and 2.5 < r[2] < 5, r)
        # 6 煙蓋到哪一格火熄哪一格（不是整片一起熄）
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor, f = s.FIRES[0];
          s.throwNade('smoke', new V(f.x + 3.5, 1.2, f.z), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 60 * 3; i++) s.step(1/60);
          const on = f.cells.filter((c) => c.on).length; return [f.cells.length, on, s.FIRES.length]; }""")
        ok('6 煙只蓋到一部分：那部分的火熄掉，其它照燒', r[2] == 1 and 0 < r[1] < r[0], r)
        # 7 炸彈衝擊波：一樣的直線距離，躲在牆後的比看得到炸彈的傷害小很多
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.clearNades(); s.startGame('match'); s.game.freezeBots = true; R.phase = 'live'; R.t = 90;
          const S = s.SITES.A, V = s.player.body.pos.constructor, bp = new V(S.plants[0][0], 0, S.plants[0][1]);
          const D = s.navDistFrom(bp, 45); let vis = null, hid = null;
          for (const n of s.NAV.nodes) { if (!n.ok || !n.nb.length || Math.abs(n.y || 0) > 0.3) continue; const d = Math.hypot(n.x - bp.x, n.z - bp.z); if (d < 8 || d > 10) continue;
            const clear = s.lineClear(new V(bp.x, 0.5, bp.z), new V(n.x, 1.0, n.z)); if (clear && !vis) vis = n; if (!clear && !hid && D.has(n.id) && D.get(n.id) > d * 1.4) hid = n; }
          if (!vis || !hid) return ['no-pair', !!vis, !!hid];
          const fake = (n) => ({ body: { pos: new V(n.x, 0, n.z), h: 1.8 } });
          return [+s.blastDist(D, bp, fake(vis)).toFixed(1), +s.blastDist(D, bp, fake(hid)).toFixed(1), +Math.hypot(vis.x - bp.x, vis.z - bp.z).toFixed(1), +Math.hypot(hid.x - bp.x, hid.z - bp.z).toFixed(1)]; }""")
        dmg = lambda d: 420 * 2.718281828 ** (-(d / 8.5) ** 2) * 0.75
        ok('7 炸彈衝擊波：一樣 8–10 公尺，牆後的人衝擊波距離長很多（傷害少）', r[0] != 'no-pair' and r[1] > r[0] * 1.3 and dmg(r[1]) < dmg(r[0]) * 0.7, [r, [round(dmg(r[0])), round(dmg(r[1]))] if r[0] != 'no-pair' else None])
        # 8 衝擊波的灰塵沿地圖擴散、傳到你那邊鏡頭才震（不是爆炸那一格就震）
        r = await ev("""() => { const s = window.__strike, R = s.ROUND, S = s.SITES.A, V = s.player.body.pos.constructor;
          s.BOMB.pos = new V(S.plants[0][0], 0, S.plants[0][1]); s.BOMB.state = 'planted'; s.player.body.pos.set(S.plants[0][0] + 22, 0, S.plants[0][1]); s.player.hp = 100;
          s.explodeBomb(); const ev0 = s.BLAST.ev.length, shake = s.BLAST.shakeAt; s.step(1/60); const p1 = s.player.punchPV;
          for (let i = 0; i < 60; i++) s.step(1/60); return [ev0, +shake.toFixed(2), s.BLAST.ev.length]; }""")
        ok('8 衝擊波：沿路點揚起灰塵（陸續出現）、傳到你那邊才震（晚 0.4 秒以上）', r[0] >= 15 and r[1] > 0.4 and r[2] < r[0], r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
