import asyncio, sys, base64
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'p'
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1100, h=700)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }""")
        await page.wait_for_timeout(2500)
        # 名稱、相機（相對機器人）、看的高度、隊伍、狀態
        for nm, cx, cy, cz, ly, team, mode in [('crouchS', 2.2, 0.8, 0.0, 0.5, 'A', 'crouch'), ('crouchS2', -2.2, 0.8, 0.0, 0.5, 'A', 'crouch'), ('back', -0.7, 1.45, 2.0, 1.15, 'A', ''), ('side', 2.1, 1.3, 0.2, 1.1, 'A', ''), ('backB', 0.7, 1.45, 2.0, 1.15, 'B', ''), ('run2', -1.8, 1.2, 0.3, 1.0, 'A', 'run'), ('crouch2', -1.5, 0.9, -1.0, 0.7, 'B', 'crouch'), ('crouch', 1.1, 1.0, -1.7, 0.8, 'A', 'crouch'),
                                               ('run', 1.6, 1.2, -1.6, 1.0, 'B', 'run'), ('dead', 1.2, 1.3, -1.6, 0.2, 'A', 'dead'), ('up', 0.5, 1.5, -1.0, 1.35, 'A', ''), ('upB', -0.5, 1.5, -1.0, 1.35, 'B', '')]:
            url = await ev(f"""() => {{ const s = window.__strike, V = s.player.body.pos.constructor; for (const b of s.bots) {{ b.alive = false; b.g.visible = false; }}
              const cand = s.bots.filter((x) => x.team === '{team}' && !x.rageOnly); const b = cand[(window.__fi = (window.__fi || 0) + 1) % cand.length]; s.setHumanLook(b, 'grunt');
              s.player.body.pos.set(-30, 0.05, 20);
              b.alive = true; b.hp = 100; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; b.state = 'patrol'; b.target = null; b.phys.vel.set(0, 0, 0);
              const mode = '{mode}';
              if (mode === 'dead') s.damageBot(b, 9999, 'body', new V(0, 0, 1), s.player);
              for (let i = 0; i < (mode === 'dead' ? 90 : 24); i++) {{ if (mode !== 'dead') {{ b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; }} if (mode === 'crouch') b.crouch = true; if (mode === 'run') b.phys.vel.set(0, 0, 4.5);
                if (mode === 'dead') {{ s.step(1/60); s.humanPose(b, 1/60); }} else {{ s.step(1/60); b.phys.pos.set(-28, 0, 8); b.yaw = Math.PI; if (mode === 'crouch') {{ b.crouch = true; b.ck = 1; }} if (mode === 'run') b.phys.vel.set(0, 0, 4.5); s.humanPose(b, 1/60); }} }}
              const c = s.camera, P = b.phys.pos; c.position.set(P.x + {cx}, {cy}, P.z - ({cz})); c.lookAt(P.x, {ly}, P.z); c.updateMatrixWorld();
              s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/png'); }}""")
            open(f'{OUT}/pose_{TAG}_{nm}.png', 'wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
