"""量「換地圖後第一回合開打」那幾幀的時間（無頭瀏覽器、軟體繪圖，絕對值比手機慢，看前後比較）"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=900, h=520)
        import sys
        if len(sys.argv) > 1: await page.evaluate('() => { window.__noWarm = true; }')
        out = []
        for mid in ['market', 'rail', 'site', 'night', 'dawn']:
            r = await page.evaluate("""(mid) => { const s = window.__strike; s.game.manual = true; const t0 = performance.now(); s.switchMap(mid); const load = Math.round(performance.now() - t0); s.startGame('match');
              const ts = []; for (let i = 0; i < 6; i++) { const t = performance.now(); s.step(1/60); const t2 = performance.now(); s.renderOnce(); s.renderer.getContext().finish(); ts.push(Math.round(t2 - t) + '+' + Math.round(performance.now() - t2)); }
              s.game.manual = false; return [load, ts]; }""", mid)
            out.append((mid, r))
        for m, r in out: print(m, '換圖 ms', r[0], '前 6 幀 ms', r[1])
        print('ERR', [e for e in errors if '404' not in e][:3]); await browser.close()
asyncio.run(main())
