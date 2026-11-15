import asyncio, sys, base64
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'big'
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1500, h=900)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }""")
        await page.wait_for_timeout(2500)
        import os
        if os.environ.get("BLINK"): await ev("() => { window.__blink = %s }" % os.environ["BLINK"])
        for nm, cx, cy, cz, ly in [('a', 0.0, 1.67, -0.36, 1.665), ('b', -0.2, 1.67, -0.33, 1.66), ('c', 0.0, 1.67, -0.36, 1.665), ('d', 0.22, 1.66, -0.32, 1.66)]:
            url = await ev(f"""() => {{ const s = window.__strike; for (const b of s.bots) {{ b.alive = false; b.g.visible = false; }}
              const cand = s.bots.filter((x) => x.team === 'A' && !x.rageOnly); const b = cand[(window.__fi = (window.__fi || 0) + 1) % cand.length]; s.setHumanLook(b, 'grunt');
              s.player.body.pos.set(-30, 0.05, 20);
              b.alive = true; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; b.state = 'patrol'; b.target = null; b.phys.vel.set(0, 0, 0);
              for (let i = 0; i < 20; i++) {{ s.step(1/60); b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; s.humanPose(b, 1/60); }}
              const c = s.camera; c.position.set(-28 + {cx}, {cy}, 8 - ({cz})); c.lookAt(-28, {ly}, 8); c.updateMatrixWorld();
              if (window.__blink !== undefined) b.hm.mat.userData.blinkU.value = window.__blink; s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/png'); }}""")
            open(f'{OUT}/big_{TAG}_{nm}.png', 'wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
