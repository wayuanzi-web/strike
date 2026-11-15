import asyncio, base64, sys

from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=960, h=540)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud','touch']) { const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }
          s.player.body.pos.set(-20, 0, 0); s.player.yaw = Math.PI / 2; s.player.pitch = -0.12; for (let i = 0; i < 30; i++) s.step(1/60);
          const V = s.player.body.pos.constructor; s.throwNade('he', new V(-27, 0.3, 0), new V(0, -1, 0), s.player, null); }""")
        for nm, n in [('a', 0), ('b', 6), ('c', 20), ('d', 70)]:
            r = await ev(f"""() => {{ const s = window.__strike; let k = 0, st = null; for (let i = 0; i < 200; i++) {{ s.step(1/60); const d = s.debrisStat(); if (d[0] > 0) {{ k++; if (k > {n}) {{ st = d; break; }} }} }}
              s.render(); return [st, s.renderer.domElement.toDataURL('image/jpeg', 0.85)]; }}""")
            print(nm, r[0]); open(f'{OUT}/he_{nm}.jpg', 'wb').write(base64.b64decode(r[1].split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
