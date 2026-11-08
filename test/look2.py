"""美術修正檢查：開鏡、換彈、機器人蹲姿與倒地、彈孔血跡。"""
import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate
        await ev("() => { const s = window.__strike; s.game.manual = true; s.startGame(); s.game.freezeBots = true; s.S.autoFire = false; s.W.deployT = 0; }")
        # 機器人：站、蹲、倒地
        await ev("""() => { const s = window.__strike; const P = [[-27, -1.2, 0], [-27, 0.6, 1], [-26.5, 2.2, 2]];
          P.forEach(([x, z, mode], i) => { const b = s.bots[i]; b.alive = true; b.hp = 100; b.g.visible = true; b.phys.pos.set(x, 0, z); b.yaw = Math.PI / 2; b.state = 'patrol'; b.waitT = 99; b.path = null;
            b.phys.crouched = mode === 1; b.phys.h = mode === 1 ? 1.2 : 1.8; });
          s.game.freezeBots = false; for (let i = 0; i < 30; i++) { s.bots.slice(0, 3).forEach((b, i) => { if (i < 2) { b.state = 'patrol'; b.waitT = 99; b.crouchWant = i === 1; } }); s.step(0); }
          s.bots[2].hp = 1; s.damageBot(s.bots[2], 50, 'body'); for (let i = 0; i < 60; i++) s.step(1/60); s.game.freezeBots = true;
          s.player.body.pos.set(-31, 0, 0.5); s.player.yaw = -Math.PI / 2; s.player.pitch = -0.08; s.bots[1].phys.crouched = true; s.bots[1].phys.h = 1.2; s.bots[1].ck = 1; s.step(1/60); s.render(); }""")
        await page.screenshot(path=str(OUT / 'fix-bots.png'))
        # 彈孔與血跡：對牆打幾發
        await ev("() => { const s = window.__strike; s.player.body.pos.set(-12, 0, 4); s.player.yaw = -Math.PI / 2; s.player.pitch = 0; s.W.deployT = 0; for (let k = 0; k < 40; k++) { s.INPUT.fire = true; s.step(1/60); } s.INPUT.fire = false; for (let i = 0; i < 40; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'fix-decals.png'))
        await ev("() => { const s = window.__strike; s.player.ads = true; for (let i = 0; i < 30; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'fix-ads.png'))
        await ev("() => { const s = window.__strike; s.player.ads = false; s.W.ammo = 10; for (let i = 0; i < 20; i++) s.step(1/60); document.getElementById('bReload').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); for (let i = 0; i < 45; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'fix-reload.png'))
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
