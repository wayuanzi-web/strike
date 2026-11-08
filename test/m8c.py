"""M8 第四張地圖「烈日工地」：機器人走樓梯上二樓、過天橋到鷹架平台、下到 A 點；你也走得上去；B 點平台。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        await ev("() => { window.__strike.game.manual = true; }")
        r = await ev("""() => { const s = window.__strike; s.switchMap('site'); s.startGame('practice'); s.S.autoFire = false; s.player.body.pos.set(-34, 0, -24); s.player.spawnT = 999;
          const b = s.bots[0]; for (const o of s.bots) if (o !== b) { o.phys.pos.set(34, 0, 24); o.blindT = 999; }
          b.phys.pos.set(-20, 0, 5); b.blindT = 999; b.state = 'patrol'; b.waitT = 0; let top = 0, onBridge = false;
          for (const [tx, tz, ty] of [[-3, -3, 3], [11, 15, 3]]) {
            const P = b.path = s.findPath(b.phys.pos.x, b.phys.pos.z, tx, tz, b.phys.pos.y, ty); b.pi = 0;
            for (let i = 0; i < 60 * 12; i++) { s.step(1/60); b.waitT = 0; top = Math.max(top, b.phys.pos.y); if (b.phys.pos.y > 2.9 && Math.abs(b.phys.pos.x - 6) < 1.6 && b.phys.pos.z > 7 && b.phys.pos.z < 12) onBridge = true; if (b.path !== P) break; }
          }
          const at1 = [+b.phys.pos.x.toFixed(1), +b.phys.pos.y.toFixed(1), +b.phys.pos.z.toFixed(1)];
          const P2 = b.path = s.findPath(b.phys.pos.x, b.phys.pos.z, 25, 17, b.phys.pos.y, 0); b.pi = 0;
          for (let i = 0; i < 60 * 14; i++) { s.step(1/60); b.waitT = 0; if (b.path !== P2) break; }
          return [+top.toFixed(2), onBridge, at1, [+b.phys.pos.x.toFixed(1), +b.phys.pos.y.toFixed(1), +b.phys.pos.z.toFixed(1)], s.NAV.upCount]; }""")
        ok('1 機器人：西邊樓梯上二樓 → 天橋 → 鷹架平台 → 東邊樓梯下到 A 點', r[0] > 2.9 and r[1] and r[2][1] > 2.9 and r[3][1] < 0.1 and abs(r[3][0] - 25) < 2 and abs(r[3][2] - 17) < 2, r)
        r = await ev("""() => { const s = window.__strike; s.game.freezeBots = true; s.player.alive = true; s.player.body.pos.set(-14, 0, 4.5); s.player.yaw = -Math.PI / 2; s.player.pitch = 0;
          s.INPUT.mz = 1; s.INPUT.mx = 0; for (let i = 0; i < 60 * 3; i++) { s.step(1/60); s.INPUT.mz = 1; } const y1 = s.player.body.pos.y;
          s.player.body.pos.set(12, 0, -20); s.player.yaw = -Math.PI / 2; for (let i = 0; i < 60 * 2.5; i++) { s.step(1/60); s.INPUT.mz = 1; } const y2 = s.player.body.pos.y;
          s.INPUT.mz = 0; return [+y1.toFixed(2), +y2.toFixed(2)]; }""")
        ok('2 你走得上二樓（3 公尺）和 B 點平台（1.2 公尺）', r[0] > 2.9 and abs(r[1] - 1.2) < 0.05, r)
        r = await ev("""() => { const s = window.__strike, M = s.getMap(); return [s.MAP_ORDER.length, M.name, document.querySelectorAll('#mapSel button').length, s.siteAt(24, 1.2, -19), s.siteAt(24, 3, 16)]; }""")
        ok('3 選單有四張地圖；B 點墊高平台上可以裝彈、二樓高度不算包點', r[0] == 4 and r[2] == 4 and r[3] == 'B' and r[4] is None, r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
