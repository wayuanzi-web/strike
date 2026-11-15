import asyncio, sys

from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=600, h=400)
        r = await page.evaluate("""() => { const s = window.__strike; s.game.manual = true; s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 30; i++) s.step(1/60);
          const b = s.bots.find(x => x.alive && x.team !== s.player.team); b.phys.pos.set(-20, 0, 10); b.hp = 100; s.humanPose(b, 1/60);
          const V = s.player.body.pos.constructor; const ch = () => +b.hm.mesh.skeleton.bones[7].rotation.x.toFixed(3);
          s.game.freezeBots = false; const c0 = ch(), hp0 = b.hp; let ckm = 0; s.throwNade('he', new V(-20, 0.3, 0), new V(0, -1, 0), s.player, null);
          let mx = 0; for (let i = 0; i < 120; i++) { s.step(1/60); s.humanPose(b, 1/60); mx = Math.max(mx, Math.abs(ch() - c0)); ckm = Math.max(ckm, b.ck); b.phys.pos.set(-20, 0, 10); }
          return { hp: hp0 - b.hp, chestSwing: +mx.toFixed(3), marks: b.mat.userData.hitN, ck: +ckm.toFixed(2) }; }""")
        print(r, [e for e in errors if '404' not in e][:3]); await browser.close()
asyncio.run(main())
