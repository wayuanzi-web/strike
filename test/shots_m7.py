import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.startGame('match'); for (let i = 0; i < 60 * 9; i++) s.step(1/60); s.render && s.render(); }")
        await page.tap('#bRadio'); await ev("() => { const s = window.__strike; s.step(1/60); s.render && s.render(); }")
        await page.screenshot(path=str(OUT / 'm7_radio.png'))
        await page.tap('#rFollow'); await ev("() => { const s = window.__strike; for (let i = 0; i < 20; i++) s.step(1/60); s.render && s.render(); }")
        await page.screenshot(path=str(OUT / 'm7_order.png'))
        await page.dispatch_event('#bBoard', 'pointerdown'); await ev("() => { const s = window.__strike; s.step(1/60); s.render && s.render(); }")
        await page.screenshot(path=str(OUT / 'm7_board.png'))
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
