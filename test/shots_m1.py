import asyncio
from playwright.async_api import async_playwright
from harness import open_game, OUT, SIM
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        await page.evaluate("() => { window.__strike.game.manual = true; window.__strike.startGame('match'); }")
        await page.evaluate(SIM, 1.0); await page.screenshot(path=str(OUT/'m1_freeze.png'))
        await page.evaluate(SIM, 9.0); await page.screenshot(path=str(OUT/'m1_live.png'))
        await page.evaluate("() => document.getElementById('bBoard').classList.add('on')")
        await page.evaluate(SIM, 0.5); await page.screenshot(path=str(OUT/'m1_board.png'))
        await page.evaluate("() => document.getElementById('bBoard').classList.remove('on')")
        await page.evaluate("() => { const s = window.__strike; s.player.hp = 1; const e = s.bots.find(b => b.team === 'B' && b.alive); s.player.alive = true; }")
        await page.evaluate("""() => { const s = window.__strike; const e = s.bots.find(b => b.team === 'B' && b.alive);
           s.player.alive = false; s.player.respawnT = Infinity; s.player.deaths++; s.onUnitDied(s.player); }""")
        await page.evaluate(SIM, 3.0); await page.screenshot(path=str(OUT/'m1_spec.png'))
        print(await page.evaluate("() => [window.__strike.ROUND.phase, document.getElementById('mtop').innerText.replace(/\\n/g,' ')]"))
        print([e for e in errors if '404' not in e]); await b.close()
asyncio.run(main())
