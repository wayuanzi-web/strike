import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        for id in ['dawn', 'market', 'rail']:
            r = await page.evaluate(f"""() => {{ const s = window.__strike; s.game.manual = true; const t0 = performance.now(); s.switchMap('{id}'); const load = performance.now() - t0; s.startGame('match');
              for (let i = 0; i < 60 * 12; i++) s.step(1/60); s.render(); const i = s.renderer.info;
              return [Math.round(load), i.render.calls, i.render.triangles, s.game.mapLoadMs]; }}""")
            print(id, '載入 ms, draws, tris =', r[:3])
        print([e for e in errors if '404' not in e]); await b.close()
asyncio.run(main())
