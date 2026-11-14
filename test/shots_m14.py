import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, touch=True, w=844, h=390)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; const R = s.RKS(); Object.assign(R, { season: '2026-11', rating: 1263, peak: 1290, played: 9, wins: 6, placed: 5,
          hist: [{ d: 18, win: true, map: 'dawn', opp: 1270 }, { d: -14, win: false, map: 'rail', opp: 1210 }, { d: 22, win: true, map: 'site', opp: 1320 }],
          seasons: [{ id: '2026-10', final: 1180, peak: 1240, w: 11, n: 18, placed: true }] }); s.openRanked(); }""")
        await page.screenshot(path=f'{OUT}/m14_rank.png')
        await ev("() => window.__strike.openVeto()")
        await ev("() => window.__strike.vetoTap('dawn')"); await page.wait_for_timeout(1000)
        await page.screenshot(path=f'{OUT}/m14_veto.png')
        await ev("() => { const s = window.__strike; s.RK.veto && (s.RK.veto.step = 'x'); document.getElementById('rankVeto').hidden = true; s.startRanked('market'); s.ROUND.phase = 'live'; s.ROUND.score.A = 6; s.ROUND.score.B = 4; s.endRound('A', 't', 'elim'); for (let i = 0; i < 400 && s.game.state !== 'over'; i++) s.step(1/60); }")
        await page.screenshot(path=f'{OUT}/m14_over.png')
        await ev("() => { const s = window.__strike; s.backToMenu(); s.startGame('arms'); for (let i = 0; i < 90; i++) s.step(1/60); s.armsKill(s.player); s.armsKill(s.player); for (let i = 0; i < 30; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/m14_arms.png')
        await ev("() => { const s = window.__strike; s.backToMenu(); s.startGame('wingman'); for (let i = 0; i < 60; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/m14_wing.png')
        await ev("() => { const s = window.__strike; s.backToMenu(); }")
        await page.screenshot(path=f'{OUT}/m14_menu.png')
        print('ERR', [e for e in errors if '404' not in e][:3]); await browser.close()
asyncio.run(main())
