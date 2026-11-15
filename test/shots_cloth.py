"""會動的布：舊城晾衣繩、其他地圖的旗子；同一處拍兩個時間點看有沒有在擺"""
import asyncio, base64
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=800, h=450)
        ev = page.evaluate
        for mid in ['market', 'dawn', 'rail']:
            info = await ev(f"""() => {{ const s = window.__strike; s.game.manual = true; s.switchMap('{mid}'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 10; i++) s.step(1/60);
              const m = s.cloth(); if (!m) return null; const P = m.geometry.attributes.position, W = m.geometry.attributes.aW, pts = [];
              for (let i = 0; i < P.count; i += 25) if (W.getX(i) > 0.5) pts.push([P.getX(i), P.getY(i), P.getZ(i)]);
              return [P.count, pts.slice(0, 1)[0], pts[Math.floor(pts.length / 2)]]; }}""")
            print(mid, info and info[0])
            if not info: continue
            for k, pt in enumerate(info[1:]):
                for t in range(2):
                    u = await ev(f"""() => {{ const s = window.__strike, c = s.camera, [x, y, z] = {pt}; c.position.set(x + 3.2, Math.max(1.7, y - 0.8), z + 3.2); c.lookAt(x, y, z); c.updateMatrixWorld();
                      s.renderer.render(s.scene, c); return s.renderer.domElement.toDataURL('image/jpeg', 0.85); }}""")
                    open(f'{OUT}/cloth_{mid}_{k}_{t}.jpg', 'wb').write(base64.b64decode(u.split(',')[1]))
                    await page.wait_for_timeout(400)
        print('ERR', [e for e in errors if '404' not in e][:5]); await browser.close()
asyncio.run(main())
