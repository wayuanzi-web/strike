"""第一人稱動作：站著、走、全速跑（戰術跑）、側走；裁右下角"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1280, h=720)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud','touch']) { const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }
          s.player.yaw = -1.2; for (let i = 0; i < 60; i++) s.step(1/60); }""")
        await page.wait_for_timeout(600)
        res = []
        for name, mx, mz, n in [('idle', 0, 0, 60), ('walk', 0, 0.5, 47), ('sprint', 0, 1, 60), ('strafe', 1, 0, 40)]:
            r = await ev(f"""() => {{ const s = window.__strike; s.INPUT.mx = {mx}; s.INPUT.mz = {mz};
              for (let i = 0; i < {n}; i++) s.step(1/60); s.render(); const g = s.vm().rig; return [g.position.toArray().map(v=>+v.toFixed(3)), g.rotation.toArray().slice(0,3).map(v=>+v.toFixed(3))]; }}""")
            res.append((name, r))
            await page.screenshot(path=f'{OUT}/vmm_{name}.png', clip={'x': 480, 'y': 260, 'width': 800, 'height': 460})
            await ev("() => { const s = window.__strike; s.INPUT.mx = 0; s.INPUT.mz = 0; for (let i = 0; i < 60; i++) s.step(1/60); }")
        for r in res: print(r)
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
