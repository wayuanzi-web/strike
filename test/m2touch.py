"""M2 觸控：購買按鈕、選單點選、換槍鍵、投擲鍵（拿出、丟出去）、按住裝彈（放開會中斷）。"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        cdp = await page.context.new_cdp_session(page)
        async def touch(kind, pts):
            await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        async def center(sel):
            b = await page.locator(sel).bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        async def tap(sel, hold=0.0):
            x, y = await center(sel); await touch('touchStart', [(7, x, y)])
            if hold: await page.evaluate(SIM, hold)
            await touch('touchEnd', [])
        sim = lambda t: page.evaluate(SIM, t)
        await page.tap('#bMatch')
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.game.freezeBots = true; }")
        res = []
        vis = await page.evaluate("() => !document.getElementById('buy').hidden")
        await tap('[data-buy=flash]'); await tap('[data-buy=he]'); await sim(0.1)
        r = await page.evaluate("() => [window.__strike.INV.he, window.__strike.INV.flash, window.__strike.player.money]")
        res.append(('開局自動開購買選單、點了就買、扣錢', vis and r == [1, 1, 300], [vis] + r))
        await tap('#buyX'); await sim(0.1)
        hid = await page.evaluate("() => document.getElementById('buy').hidden")
        await tap('#bBuy'); await sim(0.1)
        re = await page.evaluate("() => !document.getElementById('buy').hidden")
        await tap('#buyX'); await sim(8.2)
        res.append(('「好了」關掉、「購買」再打開', hid and re, [hid, re]))
        # 換槍：只有手槍時提示；有步槍後在兩把之間切
        await page.evaluate("() => { const s = window.__strike; s.giveWeapon(s.WEAPONS.rifle); }")
        await tap('#bSwap'); await sim(0.1); a = await page.evaluate("() => window.__strike.INV.cur")
        await tap('#bSwap'); await sim(0.1); b = await page.evaluate("() => window.__strike.INV.cur")
        res.append(('換槍鍵：步槍↔手槍', a == 'secondary' and b == 'primary', [a, b]))
        # 投擲：拿出閃光彈、按開火丟出去、丟完回到步槍
        await tap('#bNade'); await sim(0.5); n1 = await page.evaluate("() => [window.__strike.INV.cur, window.__strike.INV.nade]")
        await tap('#bFire', 0.1); await sim(0.8)
        n2 = await page.evaluate("() => [window.__strike.INV.he, window.__strike.INV.cur]")
        await tap('#bNade'); await sim(0.4); n3 = await page.evaluate("() => [window.__strike.INV.cur, window.__strike.INV.nade]")
        await tap('#bFire', 0.1); await sim(0.8); n4 = await page.evaluate("() => [window.__strike.INV.flash, window.__strike.INV.cur]")
        res.append(('投擲鍵拿出、開火鍵丟出、丟完換下一顆、最後回到槍', n1 == ['nade', 'he'] and n2 == [0, 'nade'] and n4 == [0, 'primary'], n1 + n2 + n3 + n4))
        await sim(2.0)
        # 裝彈：移到 A 點，按住 1 秒放開（中斷）、再按住 3.4 秒（裝好）
        await page.evaluate("() => { const s = window.__strike; s.player.flashT = 0; if (!s.INV.bomb) s.giveBomb(s.player); s.player.body.pos.set(20.8, 0, 19.5); s.player.body.vel.set(0,0,0); }")
        await sim(0.2)
        shown = await page.evaluate("() => !document.getElementById('bUse').hidden")
        x, y = await center('#bUse')
        await touch('touchStart', [(8, x, y)]); await sim(1.0); await touch('touchEnd', []); await sim(0.1)
        mid = await page.evaluate("() => [window.__strike.BOMB.state, +window.__strike.player.useT.toFixed(2)]")
        await touch('touchStart', [(8, x, y)]); await sim(3.4); await touch('touchEnd', []); await sim(0.1)
        fin = await page.evaluate("() => window.__strike.BOMB.state")
        res.append(('裝彈鍵出現、放開會中斷、按滿 3.2 秒裝好', shown and mid == ['carried', 0] and fin == 'planted', [shown, mid, fin]))
        await page.screenshot(path=str(OUT / 'm2touch.png'))
        for n, ok, info in res: print('PASS' if ok else 'FAIL', n, info)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
