import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1100, h=520)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.switchMap('night'); s.startGame('practice'); s.game.freezeBots = true; }")
        for nm, js in [('b1', "pl.body.pos.set(-28, 0.05, -2); pl.yaw = -Math.PI / 2 + 0.15; place(b, -34, 0.5); place(b2, -20, 6);"),
                       ('b2', "pl.body.pos.set(10, 0.05, 20); pl.yaw = -1.2; place(b, 20.5, 18); place(b2, 26, 23);")]:
            r = await ev("""() => { const s = window.__strike, pl = s.player, bs = s.bots.filter((x) => x.team === 'B'), b = bs[0], b2 = bs[1];
              const place = (u, x, z) => { u.alive = true; u.active = true; u.g.visible = true; u.respawnT = Infinity; u.phys.pos.set(x, 0, z); u.yaw = Math.atan2(-(pl.body.pos.x - x), -(pl.body.pos.z - z)); u.lampT = 0; };
              """ + js + """ s.game.freezeBots = false; for (const u of s.bots) if (u !== b && u !== b2) { u.alive = false; u.g.visible = false; } for (const u of [b, b2]) { u.state = 'hold'; u.fireCd = 99; }
              for (let i = 0; i < 12; i++) s.step(1/60); s.game.freezeBots = true; for (let i = 0; i < 3; i++) s.step(1/60); s.render();
              const info = s.renderer.info.render; return [info.calls, info.triangles]; }""")
            print(nm, r); await page.screenshot(path=f'{OUT}/m15_{nm}.png')
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
