"""M8 模式：個人死鬥、搶點、練槍場——每個模式都能從頭打到結束（自動模擬），結束畫面、戰績、再來一場。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        await ev("() => { window.__strike.game.manual = true; }")
        # 1 死鬥：選單按鈕進入；機器人互打、陣亡會重生；打到有人 25 殺或時間到
        await page.click('#bDM')
        r0 = await ev("""() => { const s = window.__strike; s.step(1/60); s.render(); const teams = new Set(s.bots.filter((b) => b.active).map((b) => b.team)); return [s.game.mode, s.bots.filter((b) => b.active).length, teams.size, document.getElementById('mtop').hidden]; }""")
        await page.screenshot(path=str(OUT / 'm8_dm.png'))
        r = await ev("""() => { const s = window.__strike; let n = 0, resp = 0, prevDead = new Set();
          s.player.alive = false; s.player.respawnT = 1e9; s.player.body.pos.set(0, -50, 0);   // 你在旁邊看：機器人自己打
          for (; n < 60 * 330 && s.game.state === 'play'; n++) { s.step(1/60);
            for (const b of s.bots) { if (b.active && !b.alive) prevDead.add(b); else if (prevDead.has(b) && b.alive) { resp++; prevDead.delete(b); } } }
          const rk = s.dmRanking(); return [Math.round(s.MODE.t), s.game.state, rk[0].name, rk[0].kills, resp, document.getElementById('overT').textContent, document.getElementById('overC').textContent]; }""")
        ok('1 死鬥：7 個機器人各自一隊、互打、陣亡會重生、打到結束有排名', r0[0] == 'dm' and r0[1] == 7 and r0[2] == 7 and not r0[3] and r[1] == 'over' and r[4] >= 5 and (r[3] >= 25 or r[0] >= 299), [r0, r])
        # 2 搶點：4 對 4、圈圈；機器人會進圈、會得分，打到 100 或時間到
        await ev("() => { const s = window.__strike; s.startGame('koth'); }")
        r0 = await ev("""() => { const s = window.__strike, a = s.bots.filter((b) => b.active); return [s.game.mode, a.filter((b) => b.team === 'A').length, a.filter((b) => b.team === 'B').length, s.MODE.zone && [Math.round(s.MODE.zone.x), Math.round(s.MODE.zone.z)]]; }""")
        await ev("() => { const s = window.__strike; for (let i = 0; i < 60 * 25; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'm8_koth.png'))
        r = await ev("""() => { const s = window.__strike; let inside = 0;
          for (let n = 0; n < 60 * 400 && s.game.state === 'play'; n++) { s.step(1/60); if (n % 60 === 0) { const c = s.zoneCount(); inside = Math.max(inside, c.A + c.B); } }
          return [Math.round(s.MODE.t), s.game.state, Math.floor(s.MODE.score.A), Math.floor(s.MODE.score.B), inside, document.getElementById('overS').textContent]; }""")
        ok('2 搶點：4 對 4（你＋3 隊友）、機器人會進圈搶分、打到結束', r0[1] == 3 and r0[2] == 4 and r0[3] and r[1] == 'over' and max(r[2], r[3]) > 30 and r[4] >= 2, [r0, r])
        # 3 練槍場：30 個靶；用「自動瞄準」模擬：每個靶出現 0.4 秒後對準頭開槍
        await ev("() => { const s = window.__strike; s.startGame('range'); }")
        await ev("() => { const s = window.__strike; for (let i = 0; i < 60 * 2; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'm8_range.png'))
        r = await ev("""() => { const s = window.__strike, M = s.MODE; let moved = 0;
          for (let n = 0; n < 60 * 200 && s.game.state === 'play'; n++) {
            const R = M.rg, b = R && R.cur;
            if (b && b.alive && s.game.t - R.appearT > 0.4 && R.i % 7 !== 0) {
              const e = s.player.body.pos, h = b.phys.pos, dx = h.x - e.x, dz = h.z - e.z, dy = (h.y + b.phys.h - 0.12) - (e.y + s.player.eye);
              s.player.yaw = Math.atan2(-dx, -dz); s.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); s.INPUT.fire = true;
              if (R.moving) moved++;
            } else s.INPUT.fire = false;
            s.step(1/60);
          }
          s.INPUT.fire = false; const r = s.rangeResult();
          return [s.game.state, r.hit, r.miss, r.avgMs, Math.round(r.acc * 100), moved > 0, document.getElementById('overS').textContent, s.STATS().modes.range]; }""")
        ok('3 練槍場：30 個靶都出現、打倒的算反應時間、太慢算漏掉、結束記最佳成績', r[0] == 'over' and r[1] + r[2] == 30 and r[2] >= 3 and 300 < r[3] < 900 and r[5] and r[7]['n'] == 1 and r[7]['bestMs'] > 0, r)
        await page.screenshot(path=str(OUT / 'm8_range_over.png'))
        # 4 再來一場：同一個模式；回選單後對戰模式隊伍還原
        await ev("() => { const s = window.__strike; s.startGame('dm'); s.endMode(); }")
        await page.click('#bAgain')
        r = await ev("() => window.__strike.game.mode")
        await page.click('#bPause'); await page.click('#bQuit') if await page.locator('#bQuit').count() else None
        r2 = await ev("""() => { const s = window.__strike; s.startGame('match'); const a = s.bots.filter((b) => b.active); return [a.length, a.filter((b) => b.team === 'A').length, a.filter((b) => b.team === 'B').length, s.MODE.zone]; }""")
        ok('4 再來一場還是同模式；之後打對戰，隊伍恢復 5v5、沒有圈圈', r == 'dm' and r2[:3] == [9, 4, 5] and r2[3] is None, [r, r2])
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
