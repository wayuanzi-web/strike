import asyncio
from playwright.async_api import async_playwright
from harness import open_game, OUT, SIM
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; }")
        await page.screenshot(path=str(OUT/'m1_menu.png'))
        await page.tap('#bMatch'); await ev(SIM, 0.2)
        r1 = await ev("() => [window.__strike.game.mode, window.__strike.ROUND.phase, window.__strike.bots.filter(b=>b.active).length]")
        await ev("() => { const s = window.__strike; s.ROUND.score.B = 6; s.ROUND.phase='live'; s.endRound ? 0 : 0; for (const b of s.bots) if (b.team==='A') { b.alive=false; } s.player.alive=false; s.onUnitDied(s.player); }")
        await ev(SIM, 5)
        r2 = await ev("() => [window.__strike.game.state, document.getElementById('over').hidden]")
        await page.tap('#bAgain'); await ev(SIM, 0.2)
        r3 = await ev("() => [window.__strike.game.state, window.__strike.ROUND.score, window.__strike.ROUND.num]")
        await ev("() => { const s = window.__strike; s.ROUND.score.A = 6; for (const b of s.bots) if (b.team==='B') b.alive=false; s.ROUND.phase='live'; s.onUnitDied(s.bots[0]); }")
        await ev(SIM, 5)
        r4 = await ev("() => [document.getElementById('overT').textContent, document.getElementById('overS').textContent]")
        await page.tap('#bMenu'); await ev(SIM, 0.2)
        r5 = await ev("() => [window.__strike.game.state, window.__strike.game.mode, document.getElementById('menu').hidden, window.__strike.bots.filter(b=>b.active).length]")
        await page.tap('#bStart'); await ev(SIM, 0.2)
        r6 = await ev("() => [window.__strike.game.mode, window.__strike.player.alive, document.body.classList.contains('match')]")
        print(r1, r2, r3, r4, r5, r6, [e for e in errors if '404' not in e]); await b.close()
asyncio.run(main())
