"""美術檢查：繪製次數、三角形繞向、載入時間，拍幾個角度。"""
import asyncio, time
from harness import *
SHOTS = [  # 名稱, 位置 x,z, yaw, pitch
  ('spawn', -32, 0, -1.5708, -0.02), ('hall', -12, 2, -1.5708, 0.0), ('yard', -20, 9, -0.6, -0.05),
  ('dock', 6, -16, -2.3, 0.02), ('inside', -6, -4, -0.9, -0.02), ('east', 20, 4, 1.4, -0.03),
]
async def main():
    async with async_playwright() as p:
        t0 = time.time()
        browser, page, errors = await open_game(p)
        print('load to ready', round(time.time() - t0, 1), 's')
        info = await page.evaluate("""() => { const s = window.__strike; s.game.manual = true;
          return { wind: s.mapMeshes.map(m => [m.name, s.checkWinding(m), m.geometry.attributes.position.count]) }; }""")
        print(info)
        await page.evaluate("() => { const s = window.__strike; s.startGame(); s.game.freezeBots = true; s.S.autoFire = false; }")
        await page.evaluate("""() => { const s = window.__strike; const pos = [[-14, 1.5], [-9, 10], [3, -16]]; s.bots.slice(0, 3).forEach((b, i) => { b.alive = true; b.g.visible = true; b.phys.pos.set(pos[i][0], 0, pos[i][1]); b.yaw = Math.PI / 2; }); s.game.freezeBots = false; s.step(0); s.game.freezeBots = true; }""")
        for name, x, z, yaw, pitch in SHOTS:
            await page.evaluate(f"() => {{ const s = window.__strike; s.player.body.pos.set({x}, 0, {z}); s.player.yaw = {yaw}; s.player.pitch = {pitch}; for (let i = 0; i < 40; i++) s.step(1/60); s.render(); }}")
            await page.screenshot(path=str(OUT / f'look-{name}.png'))
        draws = await page.evaluate("() => window.__strike.renderer.info.render.calls")
        print('draws', draws, 'ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
