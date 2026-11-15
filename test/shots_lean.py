"""探頭：不探、往左、往右，第一人稱整個畫面（看手上的槍有沒有跟著歪）"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=960, h=540)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud','touch']) { const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }
          s.player.body.pos.set(-20, 0, 0); s.player.yaw = -Math.PI / 2; s.player.pitch = -0.03; for (let i = 0; i < 60; i++) s.step(1/60); }""")
        await page.wait_for_timeout(500)
        for nm, v in [('none', 0), ('left', -1), ('right', 1)]:
            u = await ev(f"() => {{ const s = window.__strike; s.INPUT.leanKey = {v}; for (let i = 0; i < 40; i++) s.step(1/60); s.render(); return s.renderer.domElement.toDataURL('image/jpeg', 0.85); }}")
            open(f'{OUT}/lean_{nm}.jpg', 'wb').write(base64.b64decode(u.split(',')[1]))
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
