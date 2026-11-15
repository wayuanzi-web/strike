"""碎屑：開一槍打牆、一槍打機器人，拍命中後 0.05、0.3、1.0 秒"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=900, h=500)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud','touch']) { const e = document.getElementById(id); if (e) e.style.visibility='hidden'; } for (let i = 0; i < 60; i++) s.step(1/60);
          const g = s.sprayPicks()[0]; s.player.body.pos.set(g.cx + g.nx * 3 + g.nz * 0.9, 0, g.cz + g.nz * 3 - g.nx * 0.9); s.player.body.vel.set(0, 0, 0); s.player.yaw = Math.atan2(g.nx, g.nz); s.player.pitch = -0.1; s.step(1/60); }""")
        await page.wait_for_timeout(500)
        out = []
        for tgt in ['wall', 'bot']:
            await ev(f"""() => {{ const s = window.__strike, P = s.player.body.pos;
              if ('{tgt}' === 'bot') {{ const b = s.bots.find(x => x.team === 'B' && x.alive && !x.rageOnly); window.__tb = b; b.hp = 1000; const d = 2.2; b.phys.pos.set(P.x - Math.sin(s.player.yaw) * d, 0, P.z - Math.cos(s.player.yaw) * d); b.yaw = s.player.yaw; s.player.pitch = -0.08; }}
              else {{ s.player.pitch = -0.05; }}
              const a0 = s.W.ammo; s.INPUT.fire = true; for (let i = 0; i < 90 && s.W.ammo === a0; i++) {{ s.step(1/60); if (window.__tb) {{ window.__tb.hp = 1000; }} }} s.INPUT.fire = false; window.__shot = a0 - s.W.ammo; }}""")
            for t, n in [('a', 2), ('b', 15), ('c', 40)]:
                u = await ev(f"() => {{ const s = window.__strike; for (let i = 0; i < {n}; i++) {{ s.step(1/60); if (window.__tb) window.__tb.hp = 1000; }} s.render(); return s.renderer.domElement.toDataURL('image/png'); }}")
                import base64; open(f'{OUT}/deb_{tgt}_{t}.png', 'wb').write(base64.b64decode(u.split(',')[1])); print(tgt, t, await ev('() => window.__strike.debrisStat()'))
        print('shot', await ev('() => window.__shot')); print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
