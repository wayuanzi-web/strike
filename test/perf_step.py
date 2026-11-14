"""每一步模擬的時間（毫秒）：白天 vs 夜間，聲音開著（HRTF、隔牆計算）。"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        for id in ['dawn', 'night']:
            r = await page.evaluate(f"""() => {{ const s = window.__strike; s.audioInit(); s.game.manual = true; s.switchMap('{id}'); s.startGame('match');
              for (let i = 0; i < 60 * 10; i++) s.step(1/60);
              const t0 = performance.now(); for (let i = 0; i < 60 * 20; i++) s.step(1/60); const st = (performance.now() - t0) / 1200;
              const t1 = performance.now(); for (let i = 0; i < 60; i++) s.render(); const rd = (performance.now() - t1) / 60;
              return [+st.toFixed(3), +rd.toFixed(2), s.SND3.n]; }}""")
            print(id, '每步 ms、每次畫面 ms、同時 HRTF =', r)
        print([e for e in errors if '404' not in e]); await b.close()
asyncio.run(main())
