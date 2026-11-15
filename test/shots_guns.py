"""七把槍：軍械庫預覽（原廠塗裝、不掛東西）＋遊戲中第一人稱"""
import asyncio, sys
from harness import *
TAG = sys.argv[1] if len(sys.argv) > 1 else 'g'
GUNS = ['rifle', 'carbine', 'smg', 'shotgun', 'sniper', 'deagle', 'pistol']
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1100, h=520)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.P().xp = 1e6; s.applyCosmetics(); s.equipArmory('skin', 'factory'); s.equipArmory('charm', 'none'); for (let i = 0; i < 3; i++) s.equipArmory('stk', 'none', i); }")
        for g in GUNS:
            await ev(f"() => {{ const s = window.__strike; if (!s.ARM.open) s.openArmory(); s.ARM.gun = '{g}'; s.setViewmodel('{g}'); s.ARM.auto = false; s.ARM.rot = 0.55; s.renderArmory(); for (let i = 0; i < 30; i++) s.updateArmoryPreview(1/60); s.render(); }}")
            await page.screenshot(path=f'{OUT}/gun_{TAG}_{g}.png', clip={'x': 0, 'y': 40, 'width': 640, 'height': 420})
        await ev("() => { const s = window.__strike; s.closeArmory(); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 90; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/gun_{TAG}_fp.png')
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
