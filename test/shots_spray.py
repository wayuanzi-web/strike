"""牆上的包點噴漆：每張圖每一處從正前方 3.6 公尺拍（每張分開一次 evaluate，避免拿到舊畫面）"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=640, h=360)
        ev = page.evaluate
        for mid in ['dawn', 'market', 'rail', 'site', 'night']:
            n = await ev(f"() => {{ const s = window.__strike; s.game.manual = true; s.switchMap('{mid}'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 10; i++) s.step(1/60); return s.sprayPicks().length; }}")
            await page.wait_for_timeout(300)
            for i in range(n):
                u = await ev(f"""() => {{ const s = window.__strike, g = s.sprayPicks()[{i}], c = s.camera; c.position.set(g.cx + g.nx * 3.6, 1.7, g.cz + g.nz * 3.6); c.lookAt(g.cx, 1.75, g.cz); c.updateMatrixWorld();
                  s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/jpeg', 0.85); }}""")
                open(f'{OUT}/spray_{mid}_{i}.jpg', 'wb').write(base64.b64decode(u.split(',')[1]))
            print(mid, n)
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
