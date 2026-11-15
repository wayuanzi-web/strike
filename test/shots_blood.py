import asyncio, base64, sys
sys.path.insert(0, '/home/claude/strike/test')
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=900, h=900)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 30; i++) s.step(1/60);
          const b = s.bots.find(x => x.team === 'B' && !x.rageOnly); window.__b = b; s.setHumanLook(b, 'grunt');
          b.alive = true; b.hp = 100; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; b.state = 'hold'; b.target = null;
          const V = s.player.body.pos.constructor;
          s.humanHit(b, 'body', new V(0, 0, -1), 36); s.humanHit(b, 'body', new V(0, 0, -1), 36); s.humanHit(b, 'legs', new V(0.3, 0, -1).normalize(), 27); s.humanHit(b, 'body', new V(0, 0, 1), 36);
          for (let i = 0; i < 90; i++) { s.step(1/60); b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; s.humanPose(b, 1/60); } }""")
        await page.wait_for_timeout(800)
        for nm, dz in [('front', 1.6), ('back', -1.6)]:
            url = await ev(f"""() => {{ const s = window.__strike, b = window.__b, c = s.camera, P = b.phys.pos; s.humanPose(b, 1/60);
              c.position.set(P.x + 0.3, 1.2, P.z + {dz}); c.lookAt(P.x, 1.0, P.z); c.updateMatrixWorld(); s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/png'); }}""")
            open(f'{OUT}/blood_{nm}.png', 'wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
