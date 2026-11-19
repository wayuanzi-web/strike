"""氣氛：面向太陽（光暈）、太陽被牆擋住（光暈消失）、抬頭看鳥；每張圖用 page.screenshot（光暈是 DOM）"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1280, h=720)
        ev = page.evaluate
        for mid in ['dawn', 'site']:
            await ev(f"""() => {{ const s = window.__strike; s.game.manual = true; s.switchMap('{mid}'); s.startGame('practice'); s.game.freezeBots = true;
              for (const id of ['hud','touch']) {{ const e = document.getElementById(id); if (e) e.style.visibility='hidden'; }} }}""")
            for nm, setup in [('sun', "const d = s.SUN_DIR; s.player.body.pos.set(-25, 0, 0); s.player.yaw = Math.atan2(-d.x, -d.z) + 0.25; s.player.pitch = Math.asin(d.y) - 0.12;"),
                              ('sky', "s.player.body.pos.set(0, 0, 0); s.player.yaw = 0.6; s.player.pitch = 0.75;")]:
                await ev(f"() => {{ const s = window.__strike; {setup} for (let i = 0; i < 90; i++) s.step(1/60); s.render(); }}")
                await page.wait_for_timeout(200)
                await page.screenshot(path=f'{OUT}/amb_{mid}_{nm}.png')
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
