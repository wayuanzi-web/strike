import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=1100, h=520)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.P().xp = 1e6; s.P().ach.arms_win = '2026-11-15'; s.applyCosmetics(); }")
        for nm, js in [('a1', "s.equipArmory('skin', 'tiger'); s.equipArmory('charm', 'bear'); s.equipArmory('stk', 'flame', 0); s.equipArmory('stk', 'hs', 1); s.equipArmory('stk', 'skull', 2);"),
                       ('a2', "s.equipArmory('skin', 'neon'); s.equipArmory('charm', 'dice'); s.ARM.tab = 'charm';"),
                       ('a3', "s.equipArmory('skin', 'hex'); s.ARM.tab = 'stk'; s.ARM.gun = 'pistol'; s.setViewmodel('pistol');"),
                       ('a4', "s.equipArmory('skin', 'damascus'); s.ARM.gun = 'sniper'; s.setViewmodel('sniper');")]:
            await ev("() => { const s = window.__strike; if (!s.ARM.open) s.openArmory(); " + js + " s.renderArmory && 0; s.ARM.auto = true; s.renderArmory(); for (let i = 0; i < 40; i++) s.updateArmoryPreview(1/60); s.render(); }")
            await page.evaluate("() => { const s = window.__strike; s.closeArmory(); s.openArmory(); }") if False else None
            await page.screenshot(path=f'{OUT}/m16_{nm}.png')
        # 遊戲中：掛飾在手上的槍旁邊
        await ev("() => { const s = window.__strike; s.closeArmory(); s.equipArmory('skin', 'tiger'); s.equipArmory('charm', 'bear'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 90; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/m16_g1.png')
        await ev("() => { const s = window.__strike; s.reloadOrInspect(); for (let i = 0; i < 50; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=f'{OUT}/m16_g2.png')
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
