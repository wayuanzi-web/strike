"""槍管冒煙：連開 15 發後停火，拍 0.3、0.8、1.5 秒"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=960, h=540)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud','touch']) { const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }
          s.player.body.pos.set(-20, 0, 0); s.player.yaw = Math.PI / 2; s.player.pitch = 0.1; for (let i = 0; i < 60; i++) s.step(1/60);
          s.INPUT.fire = true; for (let i = 0; i < 100; i++) s.step(1/60); s.INPUT.fire = false; }""")
        for nm, n in [('a', 18), ('b', 30), ('c', 42)]:
            u = await ev(f"() => {{ const s = window.__strike; for (let i = 0; i < {n}; i++) s.step(1/60); s.render(); return [s.W.heat + ' ' + JSON.stringify(s.bsmoke().slice(0,3)), s.renderer.domElement.toDataURL('image/jpeg', 0.88)]; }}")
            print(nm, u[0]); open(f'{OUT}/bs_{nm}.jpg', 'wb').write(base64.b64decode(u[1].split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
