import asyncio, sys
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1280, h=720)
        ev = page.evaluate
        ids = await ev("() => window.__strike.MAP_ORDER || Object.keys(window.__strike.MAPS)")
        for mid in ids:
            await ev(f"""() => {{ const s = window.__strike; s.game.manual = true; s.switchMap('{mid}'); s.startGame('practice'); s.game.freezeBots = true;
              for (const id of ['hud','touch']) {{ const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }}
              s.vmScene && (s.vmScene.visible = false);
              for (let i = 0; i < 30; i++) s.step(1/60); s.render(); }}""")
            await page.wait_for_timeout(700)
            for k, yaw in enumerate([0, 1.6, 3.2]):
                await ev(f"() => {{ const s = window.__strike; s.player.yaw += {yaw if k==0 else 1.6}; s.player.pitch = -0.02; s.step(1/60); s.render(); }}")
                await page.screenshot(path=f'{OUT}/env_{TAG}_{mid}_{k}.png')
        print('MAPS', ids, 'ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
