"""試玩回報修正：死鬥打得到人、暫停有回選單、壞存檔不會讓遊戲開不起來、匯入換代碼要重新確認、陣亡觀戰收起按鈕、教學第 1 步面向光柱、搖桿區跟著搖桿換邊、購買選單顯示價錢。"""
import asyncio, json
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("() => { window.__strike.game.manual = true; }")
        # 1 壞存檔：每日挑戰是 null、靈敏度是字串、戰績表是 null → 重新整理還是開得起來
        await ev("""() => { localStorage.setItem('strike.stats', JSON.stringify({ v: 1, matches: 'x', recent: null, maps: null, weapons: null, modes: { dm: null }, prog: { xp: '100', ach: null, daily: { date: '2099-01-01', items: null }, c: null } }));
          localStorage.setItem('strike.settings', JSON.stringify({ sens: 'abc', map: 'nope', layout: 5 })); }""")
        await page.reload(); await page.wait_for_function('window.__strike', timeout=30000); await asyncio.sleep(0.5)
        r = await ev("""() => { const s = window.__strike; s.game.manual = true; s.openProg(); const pg = !document.getElementById('prog').hidden; s.closeProg(); s.renderStats();
          return [typeof s.S.sens, s.S.sens, typeof s.STATS().prog.xp, s.STATS().matches, Array.isArray(s.STATS().recent), pg, !document.getElementById('menu').hidden]; }""")
        ok('1 壞掉的存檔：照樣開得起來，壞值換成預設，成長、戰績畫面打得開', r == ['number', 1, 'number', 0, True, True, True], r)
        # 2 匯入別的版本的每日挑戰（不認得的 id）→ 不會丟錯、成長畫面打得開、重抽 3 項
        r = await ev("""() => { const s = window.__strike, d = { v: 1, stats: { matches: 3, prog: { xp: 500, daily: { date: s.today(), items: [{ id: 'future_x', p: 1, done: false }, { id: 'future_y', p: 0 }, { id: 'future_z', p: 0 }] } } }, settings: { sens: '2' } };
          let err = ''; try { s.applyImport(d); s.openProg(); } catch (e) { err = String(e); } s.closeProg();
          return [err, s.STATS().prog.daily.items.length, s.STATS().prog.daily.items.every((it) => s.DAILY.some((x) => x.id === it.id)), s.S.sens]; }""")
        ok('2 匯入別的版本的代碼：不認得的每日挑戰重抽、型別不對的設定不收', r == ['', 3, True, 1], r)
        # 3 匯入確認：貼 A 按一次、換貼 B 再按 → 不會直接匯入 B
        r = await ev("""async () => { const s = window.__strike; s.openProg(); const st = s.STATS(); const m0 = st.matches;
          const A = s.exportCode(); const keep = JSON.parse(JSON.stringify(st)); st.matches = 99; const B = s.exportCode(); st.matches = m0;
          const tap = () => document.getElementById('pgImport').click();
          const box = document.getElementById('pgCode'); box.value = A; tap(); box.value = B; tap();
          const after = s.STATS().matches, msg = document.getElementById('pgMsg').textContent; s.closeProg(); return [after, msg.includes('99 場')]; }""")
        ok('3 匯入要確認：中途換代碼要重新看一次摘要', r[0] != 99 and r[1], r)
        # 4 死鬥：瞄準一個機器人開槍，打得到
        r = await ev("""() => { const s = window.__strike; s.startGame('dm'); s.S.autoFire = false; s.game.freezeBots = true;
          for (let i = 0; i < 120; i++) s.step(1/60); const b = s.bots.find((x) => x.active && x.alive); s.player.body.pos.set(b.phys.pos.x + 5, b.phys.pos.y, b.phys.pos.z); const e = s.player.body.pos; b.blindT = 99; s.player.spawnT = 0;
          for (let i = 0; i < 5; i++) s.step(1/60);
          const h = b.phys.pos, dx = h.x - e.x, dz = h.z - e.z, dy = (h.y + 1.2) - (e.y + s.player.eye);
          s.player.yaw = Math.atan2(-dx, -dz); s.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); const hp0 = b.hp;
          s.INPUT.fire = true; for (let i = 0; i < 90; i++) s.step(1/60); s.INPUT.fire = false;
          return [hp0, Math.round(b.hp), b.alive, s.W.shots, s.W.hits, s.player.team, b.team, s.lineClear ? 1 : 0]; }""")
        ok('4 死鬥：對準機器人開槍會扣血', r[1] < r[0] or r[2] is False, r)
        # 5 暫停：對戰中有「回選單」、按兩次才回去
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.startGame('match'); for (let i = 0; i < 10; i++) s.step(1/60);
          document.getElementById('bPause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          return [s.game.state, !document.getElementById('bQuit').hidden]; }""")
        await ev("() => document.getElementById('bQuit').click()"); st1 = await ev("() => window.__strike.game.state")
        await ev("() => document.getElementById('bQuit').click()"); await asyncio.sleep(0.2); st2 = await ev("() => window.__strike.game.state")
        ok('5 對戰暫停有「回選單」，按兩次才離開', r == ['pause', True] and st1 == 'pause' and st2 == 'menu', [r, st1, st2])
        # 6 陣亡觀戰：操作按鈕收起來、彈藥不顯示
        r = await ev("""() => { const s = window.__strike; s.startGame('match'); for (let i = 0; i < 10; i++) s.step(1/60);
          s.damagePlayer(500, s.bots.find((b) => b.team !== s.player.team), 'body', s.WEAPONS.rifle); for (let i = 0; i < 20; i++) s.step(1/60);
          const f = getComputedStyle(document.getElementById('bFire')).visibility;
          return [s.player.alive, document.body.classList.contains('specOn'), f, document.getElementById('ammo').hidden]; }""")
        ok('6 陣亡觀戰：開火等按鈕收起來、彈藥欄隱藏', r == [False, True, 'hidden', True], r)
        # 7 教學第 1 步：一開始就面向光柱
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.startGame('tutorial'); for (let i = 0; i < 5; i++) s.step(1/60);
          const p = s.player.body.pos, t = s.TUT.target, want = Math.atan2(-(t.x - p.x), -(t.z - p.z)); let d = want - s.player.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          return [s.TUT.i, +Math.abs(d).toFixed(2), document.getElementById('tutArrow').hidden]; }""")
        ok('7 教學第 1 步：光柱在正前方，不用先學轉視角', r[0] == 0 and r[1] < 0.2 and r[2], r)
        # 8 光柱在背後時邊緣有箭頭
        r = await ev("""() => { const s = window.__strike; s.player.yaw += Math.PI * 0.6; for (let i = 0; i < 3; i++) s.step(1/60); const a = document.getElementById('tutArrow'); return [a.hidden, a.className]; }""")
        ok('8 光柱在畫面外：邊緣出現箭頭指方向', r[0] is False and r[1] in ('l', 'r'), r)
        # 9 固定搖桿拖到右邊：搖桿區跟著換到右邊
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.S.joyMode = 'fixed'; s.S.layout = { joy: { x: 0.8, y: 0.7 } }; s.applyLayout && s.applyLayout();
          const [hx] = s.joyHome(); s.S.layout = null; s.S.joyMode = 'float'; return [hx > innerWidth / 2]; }""")
        ok('9 自訂搖桿在右邊：搖桿位置算在右半邊', r == [True], r)
        # 10 購買選單：錢不夠時看得到價錢
        r = await ev("""() => { const s = window.__strike; s.startGame('match'); for (let i = 0; i < 5; i++) s.step(1/60); s.player.money = 100;
          document.getElementById('bBuy').click(); for (let i = 0; i < 2; i++) s.step(1/60);
          const em = document.querySelector('[data-buy="rifle"] em').textContent, head = document.getElementById('buyMoney').textContent; return [em, head]; }""")
        ok('10 購買選單：錢不夠也顯示價錢、上方顯示準備時間還剩幾秒', r[0].startswith('錢不夠 $') and '準備時間還有' in r[1], r)
        await page.screenshot(path=str(OUT / 'pt_buy.png'))
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
