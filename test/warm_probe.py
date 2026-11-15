import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=900, h=520)
        r = await page.evaluate("""() => { const s = window.__strike, out = {};
          out.keys = Object.keys(s.HUMAN_GEO); for (const k of Object.keys(s.HUMAN_GEO)) delete s.HUMAN_GEO[k];
          const t0 = performance.now(); const g = s.humanGeo('A', 'grunt', 0, 2); out.firstNear = +(performance.now() - t0).toFixed(1);
          const t1 = performance.now(); s.humanGeo('B', 'grunt', 0, 3); out.secondNear = +(performance.now() - t1).toFixed(1);
          const t2 = performance.now(); s.humanGeo('B', 'grunt', 1, 3); out.far = +(performance.now() - t2).toFixed(1);
          out.cached = Object.keys(s.HUMAN_GEO || {}).length; return out; }""")
        print(r, [e for e in errors if '404' not in e][:3]); await browser.close()
asyncio.run(main())
