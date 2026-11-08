import asyncio
from playwright.async_api import async_playwright
from harness import open_game, OUT, SIM
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.startGame('match'); }")
        await ev(SIM, 0.5); await page.screenshot(path=str(OUT/'m2_buy.png'))
        await ev("() => { const s = window.__strike; s.player.money = 16000; s.buyItem('rifle'); s.buyItem('helm'); s.buyItem('smoke'); s.buyItem('flash'); s.buyItem('he'); }")
        await ev(SIM, 0.1); await page.screenshot(path=str(OUT/'m2_buy2.png'))
        await page.tap('#buyX'); await ev(SIM, 8.5)
        await page.screenshot(path=str(OUT/'m2_live.png'))
        # 各武器
        for w in ['pistol', 'smg', 'shotgun', 'sniper']:
            await ev(f"() => {{ const s = window.__strike; s.giveWeapon(s.WEAPONS.{w}); }}")
            await ev(SIM, 0.9); await page.screenshot(path=str(OUT/f'm2_w_{w}.png'))
        await ev("() => { const s = window.__strike; s.player.ads = true; }"); await ev(SIM, 0.5); await page.screenshot(path=str(OUT/'m2_scope.png'))
        await ev("() => { const s = window.__strike; s.player.ads = false; s.equip('nade'); }"); await ev(SIM, 0.5); await page.screenshot(path=str(OUT/'m2_nade.png'))
        # 煙：丟在前面
        await ev("""() => { const s = window.__strike, p = s.player.body.pos; s.throwNade('smoke', new p.constructor(p.x, 1.6, p.z), new p.constructor(1, 0.15, 0).normalize(), s.player, null); }""")
        await ev(SIM, 3.5); await page.screenshot(path=str(OUT/'m2_smoke.png'))
        await ev("""() => { const s = window.__strike, p = s.player.body.pos; s.throwNade('flash', new p.constructor(p.x, 1.6, p.z), new p.constructor(1, 0.3, 0.1).normalize(), s.player, null); }""")
        await ev(SIM, 1.55); await page.screenshot(path=str(OUT/'m2_flash.png'))
        await ev(SIM, 2.0)
        # 裝彈：把你移到 A 點
        await ev("""() => { const s = window.__strike; s.player.flashT = 0; if (!s.INV.bomb) s.giveBomb(s.player); s.player.body.pos.set(20.8, 0, 19.5); s.player.yaw = 0; s.player.pitch = -0.4; }""")
        await ev(SIM, 0.3)
        act = await ev("() => window.__strike.useAction()")
        await ev("() => { window.__strike.INPUT.use = true; }"); await ev(SIM, 1.5); await page.screenshot(path=str(OUT/'m2_planting.png'))
        await ev(SIM, 2.0)
        st = await ev("() => [window.__strike.BOMB.state, window.__strike.BOMB.site]")
        await ev("() => { window.__strike.INPUT.use = false; window.__strike.player.pitch = -0.6; }"); await ev(SIM, 0.5); await page.screenshot(path=str(OUT/'m2_planted.png'))
        print(act, st, [e for e in errors if '404' not in e])
        await b.close()
asyncio.run(main())
