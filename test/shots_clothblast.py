import asyncio, base64, sys

from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=800, h=450)
        ev = page.evaluate
        pt = await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('market'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 10; i++) s.step(1/60);
          const m = s.cloth(), P = m.geometry.attributes.position, W = m.geometry.attributes.aW; for (let i = 0; i < P.count; i += 25) if (W.getX(i) > 0.5) return [P.getX(i), P.getY(i), P.getZ(i)]; }""")
        x, y, z = pt
        for k, wait in enumerate([0, 150, 400, 2500]):
            if k == 1:
                await ev(f"() => {{ const s = window.__strike, V = s.player.body.pos.constructor; s.throwNade('he', new V({x}, 0.3, {z}), new V(0, -1, 0), s.player, null); for (let i = 0; i < 70; i++) {{ s.step(1/60); if (s.debrisStat()[0] > 0) break; }} }}")
            await page.wait_for_timeout(wait if k != 1 else 100)
            u = await ev(f"() => {{ const s = window.__strike, c = s.camera; c.position.set({x} + 4, 2.2, {z} + 4); c.lookAt({x}, {y} - 0.3, {z}); c.updateMatrixWorld(); s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/jpeg', 0.85); }}")
            open(f'{OUT}/cb_{k}.jpg', 'wb').write(base64.b64decode(u.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
