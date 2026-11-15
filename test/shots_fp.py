"""第一人稱：每把槍在遊戲中（白天地圖、手上），裁右下角放大"""
import asyncio, sys
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'f'
GUNS = ['rifle', 'carbine', 'smg', 'shotgun', 'sniper', 'deagle', 'pistol']
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1280, h=720)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; if (s.getMap().id !== 'market') s.switchMap('market'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
          s.player.yaw = 2.2; s.player.pitch = -0.05; for (let i = 0; i < 60; i++) s.step(1/60); }""")
        await page.wait_for_timeout(800)
        for g in GUNS:
            await ev(f"() => {{ const s = window.__strike; s.setViewmodel('{g}'); for (let i = 0; i < 50; i++) s.step(1/60); s.render(); }}")
            await page.screenshot(path=f'{OUT}/fp_{TAG}_{g}.png', clip={'x': 520, 'y': 300, 'width': 760, 'height': 420})
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
