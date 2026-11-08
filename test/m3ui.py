"""M3：選單點地圖會換圖、開打；畫質「自動」在卡的時候會降解析度。"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        res = []
        await page.tap('[data-map=rail]'); await page.wait_for_function("() => document.getElementById('boot').hidden", timeout=20000)
        r = await page.evaluate("() => { const s = window.__strike; return [s.getMap().id, document.querySelector('[data-map=rail]').getAttribute('aria-checked'), s.S.map, s.SITES.A.cx, s.bots.filter(b => b.active && b.alive).length]; }")
        res.append(('點「黃昏鐵道」就換圖、記住選擇', r[0] == 'rail' and r[1] == 'true' and r[2] == 'rail' and r[3] == 24 and r[4] == 4, r))
        pr0 = await page.evaluate("() => [window.__strike.game.autoPR, window.__strike.renderer.getPixelRatio()]")
        await page.tap('#bMatch'); await page.wait_for_timeout(9000)
        r = await page.evaluate("() => { const s = window.__strike; return [s.game.state, s.ROUND.num, s.game.fps.toFixed(1), s.game.autoPR, s.renderer.getPixelRatio()]; }")
        res.append(('對戰在新地圖開打', r[0] == 'play' and r[1] == 1, r))
        res.append(('畫質自動：太卡會降解析度', r[3] < pr0[0] or float(r[2]) >= 45, [pr0, r[2:]]))
        await page.screenshot(path=str(OUT / 'm3ui.png'))
        for n, ok, info in res: print('PASS' if ok else 'FAIL', n, info)
        print('ERRORS', [e for e in errors if '404' not in e]); await b.close()
asyncio.run(main())
