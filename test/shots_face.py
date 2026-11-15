import asyncio, sys
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=900, h=520)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }""")
        # 相機位置（相對機器人）、看的高度、隊伍、外觀、機器人朝向
        for nm, cx, cy, cz, ly, team, look in [('f1', 0.25, 1.67, -0.55, 1.62, 'B', 'grunt'), ('f2', 0.9, 1.4, -1.9, 1.15, 'B', 'grunt'), ('f3', -0.3, 1.66, -0.6, 1.6, 'A', 'grunt'), ('f7', 0.0, 1.68, -0.42, 1.66, 'A', 'grunt'), ('f8', 0.9, 1.4, -1.9, 1.15, 'A', 'grunt'),
                                               ('f4', 0.6, 1.5, -2.4, 1.2, 'B', 'boss'), ('fb', 23.0, 1.6, -3.0, 1.0, 'A', 'grunt'), ('f9', 0.28, 0.22, -0.42, 0.1, 'A', 'grunt'), ('fa', 0.7, 0.9, -1.1, 0.7, 'A', 'grunt'), ('f5', -1.2, 1.55, -0.6, 1.5, 'B', 'grunt'), ('f6', 1.5, 1.6, -6.5, 1.0, 'B', 'grunt')]:
            url = await ev(f"""() => {{ const s = window.__strike; for (const b of s.bots) {{ b.alive = false; b.g.visible = false; }}
              const cand = s.bots.filter((x) => x.team === '{team}' && !x.rageOnly); const b = cand[(window.__fi = (window.__fi || 0) + 1) % cand.length]; s.setHumanLook(b, '{look}');
              s.player.body.pos.set(-30, 0.05, 20);
              b.alive = true; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; b.state = 'patrol'; b.target = null; b.phys.vel.set(0, 0, 0);
              for (let i = 0; i < 20; i++) {{ s.step(1/60); b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; s.humanPose(b, 1/60); }}
              // 機器人朝 +z（yaw = π），相機在它前方
              const c = s.camera; c.position.set(-28 + {cx}, {cy}, 8 - ({cz})); c.lookAt(-28, {ly}, 8); c.updateMatrixWorld();
              s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/png'); }}""")
            import base64; open(f'{OUT}/face_{TAG}_{nm}.png', 'wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
