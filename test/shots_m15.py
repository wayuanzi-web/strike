import asyncio, sys
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1100, h=520)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; }")
        shots = [('night', -30, 0, -1.57, 'n1'), ('night', 18, 12, 0.6, 'n2'), ('night', 0, -4, 0, 'n3'), ('rail', -10, 0, -1.2, 'd1'), ('market', 0, -5, 0.5, 'd2')]
        for mp, x, z, yaw, nm in shots:
            r = await ev(f"""() => {{ const s = window.__strike; s.switchMap('{mp}'); s.startGame('practice'); s.game.freezeBots = true;
              const pl = s.player; pl.body.pos.set({x}, 0.05, {z}); pl.yaw = {yaw}; pl.pitch = -0.05; for (let i = 0; i < 20; i++) s.step(1/60); s.render();
              return [s.getMap().id, window.__mapTiming, s.LM ? s.LM.ms : null]; }}""")
            print(nm, r)
            await page.screenshot(path=f'{OUT}/m15_{nm}.png')
        # 夜裡開槍：槍口火光照亮
        await ev("() => { const s = window.__strike; s.switchMap('night'); s.startGame('practice'); s.game.freezeBots = true; const pl = s.player; pl.body.pos.set(-25, 0.05, -8); pl.yaw = 0.3; for (let i = 0; i < 10; i++) s.step(1/60); s.INPUT.fire = true; for (let i = 0; i < 4; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/m15_fire.png')
        await ev("() => { window.__strike.INPUT.fire = false; }")
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
