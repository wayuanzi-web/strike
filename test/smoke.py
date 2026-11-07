"""冒煙測試：載入、沒有錯誤、開始遊戲、跑幾秒、截圖。"""
import asyncio, sys
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT / 'menu.png'))
        info = await page.evaluate("""() => { const s = window.__strike; s.game.manual = true;
          return { nodes: s.NAV.nodes.filter(n => n.ok).length, linked: s.NAV.nodes.filter(n => n.ok && n.nb.length).length, boxes: s.BOXES.length }; }""")
        print('nav', info)
        await page.evaluate("() => window.__strike.startGame()")
        await page.evaluate(SIM, 0.5)
        await page.screenshot(path=str(OUT / 'play.png'))
        st = await page.evaluate("""() => { const s = window.__strike; return { p: s.player.body.pos.toArray(), hp: s.player.hp,
            bots: s.bots.map(b => ({ n: b.name, st: b.state, pos: b.phys.pos.toArray().map(v => +v.toFixed(1)), path: b.path ? b.path.length : 0 })),
            draws: s.renderer.info.render.calls }; }""")
        print(st)
        await page.evaluate(SIM, 6)
        st2 = await page.evaluate("() => window.__strike.bots.map(b => ({ st: b.state, pos: b.phys.pos.toArray().map(v => +v.toFixed(1)) }))")
        print('after 6s', st2)
        print('ERRORS', errors)
        await browser.close()
asyncio.run(main())
