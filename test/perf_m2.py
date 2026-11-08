import asyncio
from playwright.async_api import async_playwright
from harness import open_game, SIM
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; s.startGame('match'); }")
        await page.evaluate(SIM, 12)
        r = await page.evaluate("""() => { const s = window.__strike; s.render(); const i = s.renderer.info; const t0 = performance.now(); for (let k = 0; k < 120; k++) s.step(1/60); const dt = (performance.now() - t0) / 120;
          s.render(); return [i.render.calls, i.render.triangles, +dt.toFixed(3)]; }""")
        print('draws, tris, ms/step', r, [e for e in errors if '404' not in e])
        await b.close()
asyncio.run(main())
