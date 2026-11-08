"""M4：新手教學 10 步全部走完（用真的觸控按鈕）、戰績記錄與畫面、左手模式按鈕對調、按鈕大小、第一次玩的提示。"""
import asyncio
from harness import *

AIM = """(part) => { const s = window.__strike, p = s.player, b = s.TUT.dummy, e = p.body.pos; const y = b.phys.pos.y + (part === 'head' ? 1.65 : 1.15);
  const dx = b.phys.pos.x - e.x, dz = b.phys.pos.z - e.z, dy = y - (e.y + p.eye); p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }"""

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        cdp = await page.context.new_cdp_session(page)
        async def touch(kind, pts): await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        async def center(sel): b = await page.locator(sel).bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        async def tap(sel, hold=0.0):
            x, y = await center(sel); await touch('touchStart', [(7, x, y)])
            if hold: await page.evaluate(SIM, hold)
            await touch('touchEnd', [])
        sim = lambda t: page.evaluate(SIM, t)
        step = lambda: page.evaluate("() => window.__strike.TUT.i")
        res = []
        hint = await page.evaluate("() => [!document.getElementById('firstHint').hidden, document.getElementById('bTut').classList.contains('go')]")
        res.append(('第一次玩：選單提示先教學', hint == [True, True], hint))
        await page.tap('#bTut')
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; }")
        seen = []
        async def wait_next(i, secs=1.2):
            await sim(secs); n = await step(); seen.append(n); return n > i
        # 1 移動、2 轉視角
        await page.evaluate("() => { const s = window.__strike; s.player.body.pos.copy(s.TUT.target); }"); ok1 = await wait_next(0)
        await page.evaluate("() => { const s = window.__strike, p = s.player.body.pos, t = s.TUT.target; s.player.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z)); }"); ok2 = await wait_next(1)
        # 3 開火：對準靶子按住開火鍵
        await page.evaluate(AIM, 'body'); x, y = await center('#bFire'); await touch('touchStart', [(5, x, y)])
        for _ in range(12):
            await page.evaluate(AIM, 'body'); await sim(0.1)
        await touch('touchEnd', []); ok3 = await wait_next(2)
        # 4 換彈
        await tap('#bReload'); ok4 = await wait_next(3)
        # 5 蹲、跳
        await tap('#bCrouch'); await sim(0.3); await tap('#bCrouch'); await sim(0.3); await tap('#bJump'); ok5 = await wait_next(4)
        # 6 開鏡打遠靶
        await sim(2.6)
        await tap('#bAds'); await sim(0.4); x, y = await center('#bFire'); await touch('touchStart', [(5, x, y)])
        for _ in range(25):
            await page.evaluate(AIM, 'body'); await sim(0.1)
        await touch('touchEnd', []); ok6 = await wait_next(5)
        await tap('#bAds')
        # 7 換槍兩次
        await tap('#bSwap'); await sim(0.7); await tap('#bSwap'); ok7 = await wait_next(6)
        # 8 投擲：拿出、按開火丟
        await tap('#bNade'); await sim(0.6); await tap('#bFire', 0.1); ok8 = await wait_next(7, 1.6)
        # 9 購買衝鋒槍
        await tap('#bBuy'); await sim(0.1); await tap('[data-buy=smg]'); await sim(0.1); await tap('#buyX'); ok9 = await wait_next(8)
        # 10 走到 A 點按住裝彈
        await page.evaluate("() => { const s = window.__strike; s.player.body.pos.copy(s.TUT.target); s.player.body.vel.set(0,0,0); }"); await sim(0.3)
        x, y = await center('#bUse'); await touch('touchStart', [(8, x, y)]); await sim(3.6); await touch('touchEnd', []); await sim(1.2)
        done = await page.evaluate("() => [!document.getElementById('tutDone').hidden, window.__strike.STATS().tutorialDone, window.__strike.TUT.on]")
        oks = [ok1, ok2, ok3, ok4, ok5, ok6, ok7, ok8, ok9]
        res.append(('教學 1–9 步依序完成', all(oks), [oks, seen]))
        res.append(('第 10 步裝彈後顯示「教學完成」、記住做過', done == [True, True, False], done))
        await page.screenshot(path=str(OUT / 'm4_tutdone.png'))
        print('progress', oks, seen, done, await page.evaluate("() => [window.__strike.TUT.i, document.getElementById('tutX').textContent, window.__strike.useAction(), window.__strike.BOMB.state, window.__strike.INV.primary && window.__strike.INV.primary.def.id]"))
        if done[0]: await tap('#tutMenu')
        else: await page.evaluate("() => { document.getElementById('tutDone').hidden = true; }"); await page.tap('#bPause'); await page.tap('#bMenu') if False else None
        await sim(0.2)
        hint2 = await page.evaluate("() => [document.getElementById('firstHint').hidden, document.getElementById('bMatch').classList.contains('go')]")
        res.append(('教學做完：提示消失、主按鈕回到對戰', hint2 == [True, True], hint2))
        # 戰績：打一場（直接結算）
        r = await page.evaluate("""() => { const s = window.__strike; s.startGame('match'); s.player.kills = 3; s.ROUND.score.A = 6; s.ROUND.num = 11; s.ROUND.phase = 'live';
          for (const b of s.bots) if (b.team === 'B') b.alive = false; s.onUnitDied(s.bots[0]); for (let i = 0; i < 400; i++) s.step(1/60);
          const st = s.STATS(); return [s.game.state, st.matches, st.wins, st.recent.length, st.maps[s.getMap().id].won, document.getElementById('overC').textContent]; }""")
        res.append(('對戰打完寫進戰績', r[0] == 'over' and r[1] == 1 and r[2] == 1 and r[3] == 1 and r[4] == 1 and '生涯' in r[5], r))
        await page.tap('#bMenu'); await sim(0.1); await page.tap('#bStats'); await sim(0.1)
        await page.screenshot(path=str(OUT / 'm4_stats.png'))
        r = await page.evaluate("() => [!document.getElementById('stats').hidden, document.getElementById('statBody').textContent.includes('最近 10 場')]")
        res.append(('戰績畫面', r == [True, True], r))
        await page.tap('#statX')
        # 左手模式、按鈕大小
        await page.evaluate("() => { const s = window.__strike; s.S.lefty = true; s.S.btnScale = '1.15'; applyHandHook(); s.startGame('practice'); }".replace('applyHandHook()', 's.applyHand()'))
        await sim(0.3)
        r = await page.evaluate("""() => { const f = document.getElementById('bFire').getBoundingClientRect(); return [f.left + f.width / 2 < innerWidth / 2, getComputedStyle(document.documentElement).getPropertyValue('--bs').trim()]; }""")
        x, y = 700, 250
        await touch('touchStart', [(3, x, y)]); await touch('touchMove', [(3, x, y - 80)]); await sim(0.5)
        mv = await page.evaluate("() => [window.__strike.INPUT.mz > 0.5, document.getElementById('joy').className]"); await touch('touchEnd', [])
        res.append(('左手模式：開火鍵在左、右半邊是搖桿；按鈕放大', r[0] and r[1] == '1.15' and mv[0], [r, mv]))
        await page.screenshot(path=str(OUT / 'm4_lefty.png'))
        for n, ok, info in res: print('PASS' if ok else 'FAIL', n, info)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
