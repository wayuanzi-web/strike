import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate
        await page.click('#bStart')
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.game.freezeBots = false; s.S.autoFire = false; s.S.soundViz = true; s.S.captions = true;
          s.player.body.pos.set(-12, 0, 12); s.player.yaw = -Math.PI / 2; s.player.pitch = -0.03;
          const [a, b, c] = s.bots.filter((x) => x.active);
          for (const [x, z, o] of [[a, -4, 9.6], [b, -4, 12.6], [c, -3.5, 15.2]]) { x.phys.pos.set(z, 0, o); x.yaw = Math.PI / 2; x.blindT = 99; x.state = 'hold'; x.holdT = 99; x.holdYaw = Math.PI / 2; }
          a.reloadT = a.wpn.reload * 0.6; s.damageBot(c, 200, 'head', c.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); c.respawnT = 99;
          const V = s.player.body.pos.constructor; s.soundCue('step', new V(-12, 0, 20)); s.soundCue('shot', new V(-20, 0, 12));
          for (let i = 0; i < 24; i++) s.step(1/60); s.render(); }""")
        await page.screenshot(path=str(OUT / 'm10_anim.png'))
        await ev("() => { const s = window.__strike; s.S.palette = 'cb'; s.applyPalette(); s.S.soundViz = false; s.S.captions = false; for (let i = 0; i < 30; i++) s.step(1/60); s.render(); }")
        await page.screenshot(path=str(OUT / 'm10_cb.png'))
        await ev("() => { const s = window.__strike; s.S.palette = 'default'; s.applyPalette(); }")
        print('ERRORS', [e for e in errors if '404' not in e]); await browser.close()
asyncio.run(main())
