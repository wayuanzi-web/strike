import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; s.STATS().prog.xp = 2600; s.STATS().prog.ach = { first_kill: '2026/11/8', first_win: '2026/11/8', round3: '2026/11/8' }; s.saveStats(); s.backToMenu && s.backToMenu(); }")
        await page.wait_for_timeout(300); await page.screenshot(path=str(OUT / 'm9_menu.png'))
        await page.evaluate("() => window.__strike.openProg()"); await page.wait_for_timeout(200)
        await page.evaluate("() => { document.querySelector('#prog .card').scrollTop = 330; }"); await page.screenshot(path=str(OUT / 'm9_prog2.png'))
        print('ERRORS', [e for e in errors if '404' not in e]); await browser.close()
asyncio.run(main())
