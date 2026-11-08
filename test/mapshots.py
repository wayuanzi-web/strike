"""每張地圖從幾個位置截圖：攻方出生點、中路、包點 A、包點 B、高處俯瞰。"""
import asyncio, sys
from harness import *
VIEWS = {
  'dawn': [(-30, 0, -90, 0), (0, 12, -120, 0), (21, 14, 0, -5), (14, -12, -150, -5)],
  'market': [(-30, 0, -90, 2), (-8, -7, -55, 8), (12, 15, -75, -2), (14, -14, -110, -3)],
  'rail': [(-30, 0, -90, 0), (-8, 12, -100, 0), (14, 9, -55, -2), (14, -9, -125, -3)],
  'site': [(-30, 0, -90, 2), (-16, -9, -60, 10), (0, 18, -70, 4), (12, -10, -125, -2)],
}
async def main():
    ids = sys.argv[1:] or ['dawn', 'market', 'rail', 'site']
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.evaluate("() => { window.__strike.game.manual = true; }")
        for id in ids:
            await page.evaluate(f"() => {{ const s = window.__strike; s.switchMap('{id}'); s.startGame('practice'); s.game.freezeBots = true; document.getElementById('hud').style.opacity = 0.0; document.getElementById('touch').hidden = true; }}")
            for k, (x, z, yaw, pitch) in enumerate(VIEWS[id]):
                await page.evaluate(f"() => {{ const s = window.__strike; s.player.body.pos.set({x}, 0, {z}); s.player.body.vel.set(0,0,0); s.player.yaw = {yaw} * Math.PI / 180; s.player.pitch = {pitch} * Math.PI / 180; for (let i = 0; i < 20; i++) s.step(1/60); s.render(); }}")
                await page.screenshot(path=str(OUT / f'ms_{id}_{k}.png'))
            # 高處俯瞰
            await page.evaluate("() => { const s = window.__strike, c = s.camera; s.game.state = 'menu'; s.game.menuT = 0.9; s.step(1/60); c.position.set(-34, 26, -30); c.lookAt(6, 0, 4); s.render(); }")
            await page.screenshot(path=str(OUT / f'ms_{id}_top.png'))
            await page.evaluate("() => { window.__strike.game.state = 'play'; }")
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
