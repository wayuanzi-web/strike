import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        r = await page.evaluate("""() => { const s = window.__strike; s.game.manual = true; s.startGame();
          const P = s.player; P.body.pos.set(-14,0,10); P.yaw = -Math.PI/2;
          for (const b of s.bots) { b.phys.pos.set(30, 0, 24); b.state = 'patrol'; b.waitT = 99; b.path = null; }
          const b = s.bots[2]; b.phys.pos.set(-2, 0, 10); b.yaw = Math.PI/2;
          const out = []; for (let i = 0; i < 60; i++) { s.step(1/60); if (i % 10 == 0) out.push([b.state, b.visible, b.yaw.toFixed(2), b.phys.pos.x.toFixed(2), P.alive, P.hp]); }
          return out; }""")
        print(r, errors)
        await browser.close()
asyncio.run(main())
