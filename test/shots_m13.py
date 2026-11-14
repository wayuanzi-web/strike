import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, touch=True, w=844, h=390)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 30; i++) s.step(1/60); }""")
        async def at(js, name):
            await ev(js); await ev("() => window.__strike.render()"); await page.screenshot(path=f'{OUT}/m13_{name}.png')
        await ev("() => { const s = window.__strike; s.W.ammo = 0; s.startReload(); }")
        for q, n in [(0.22, 'r1_out'), (0.38, 'r2_grab'), (0.5, 'r3_in'), (0.88, 'r4_bolt')]:
            await at(f"() => {{ const s = window.__strike, W = s.W; while (1 - W.reloadT / W.reloadDur < {q} && W.reloadT > 0) s.step(1/60); }}", n)
        await ev("() => { const s = window.__strike; for (let i = 0; i < 120; i++) s.step(1/60); s.reloadOrInspect(); }")
        await at("() => { const s = window.__strike; for (let i = 0; i < 40; i++) s.step(1/60); }", 'insp1')
        await at("() => { const s = window.__strike; for (let i = 0; i < 70; i++) s.step(1/60); }", 'insp2')
        await at("() => { const s = window.__strike; for (let i = 0; i < 120; i++) s.step(1/60); s.INPUT.lean = 1; window.leanShow && window.leanShow(); for (let i = 0; i < 40; i++) s.step(1/60); }", 'lean')
        # 機器人：側走與探頭（擺在你前面 4 公尺）
        await ev("""() => { const s = window.__strike, pl = s.player; s.INPUT.lean = 0; for (let i = 0; i < 40; i++) s.step(1/60);
          const b = s.bots.find((x) => x.team === 'B'), p = pl.body.pos, fy = Math.sin(pl.yaw), fc = Math.cos(pl.yaw);
          b.alive = true; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.phys.pos.set(p.x - fy * 4, p.y, p.z - fc * 4); b.yaw = pl.yaw + Math.PI; b.phys.onGround = true; b.state = 'attack'; window.__b = b; }""")
        await at("() => { const s = window.__strike, b = window.__b; b.phys.vel.set(Math.cos(b.yaw) * 3, 0, -Math.sin(b.yaw) * 3); for (let i = 0; i < 25; i++) { b.walk += 1/60 * 6.9; s.humanPose(b, 1/60); } b.phys.vel.set(0,0,0); }", 'bot_strafe')
        await at("() => { const s = window.__strike, b = window.__b; b.leanW = 1; b.leanCk = 99; for (let i = 0; i < 40; i++) { s.botLean(b, 1/60, 0); s.humanPose(b, 1/60); } }", 'bot_lean')
        print('ERR', errors[:3]); await browser.close()
asyncio.run(main())
