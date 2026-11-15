"""地面細節：每張圖從 6 公尺高斜看兩處"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=800, h=450)
        ev = page.evaluate
        for mid in ['dawn', 'market', 'rail', 'site', 'night']:
            await ev(f"() => {{ const s = window.__strike; s.game.manual = true; s.switchMap('{mid}'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 10; i++) s.step(1/60); }}")
            await page.wait_for_timeout(300)
            for i, (cx, cz, tx, tz) in enumerate([(-25, -18, -15, -8), (5, 18, 15, 8)]):
                u = await ev(f"() => {{ const s = window.__strike, c = s.camera; c.position.set({cx}, 5, {cz}); c.lookAt({tx}, 0, {tz}); c.updateMatrixWorld(); s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/jpeg', 0.85); }}")
                open(f'{OUT}/gd_{mid}_{i}.jpg', 'wb').write(base64.b64decode(u.split(',')[1]))
            print(mid, await ev("() => window.__strike.groundCount()"))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
