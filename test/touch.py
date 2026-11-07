"""真的用觸控事件（多指）操作：左手搖桿、右手轉視角、按住開火鍵拖曳瞄準、各按鈕。最後截幾張畫面。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        cdp = await page.context.new_cdp_session(page)
        async def touch(kind, pts):
            await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        await page.click('#bStart')
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.game.freezeBots = true; s.player.body.pos.set(-32, 0, 0); s.player.yaw = -Math.PI / 2; }")
        st0 = await page.evaluate("() => { const s = window.__strike; return [s.player.body.pos.x, s.player.yaw]; }")
        sim = lambda t: page.evaluate(SIM, t)
        # 左手按在 (150, 250)，往上推（前進）；右手在 (600, 200) 往左拖 120px
        await touch('touchStart', [(0, 150, 250)])
        await touch('touchMove', [(0, 150, 170)])
        await touch('touchStart', [(0, 150, 170), (1, 600, 200)])
        for k in range(1, 7):
            await touch('touchMove', [(0, 150, 170), (1, 600 - k * 20, 200)])
            await sim(0.05)
        await sim(1.0)
        st1 = await page.evaluate("() => { const s = window.__strike; return [s.player.body.pos.x, s.player.yaw, s.INPUT.mz, document.getElementById('joy').className]; }")
        await touch('touchEnd', [])
        await sim(0.2)
        moved = st1[0] - st0[0]; turned = (st1[1] - st0[1]) * 57.3
        print('搖桿前進', 'PASS' if moved > 3 else 'FAIL', round(moved, 2), 'm；右手左拖 120px 轉', round(turned, 1), '度', 'PASS' if 20 < turned < 40 else 'FAIL', st1[2:])
        # 開火鍵：按住、拖著往下（壓槍）
        box = await page.locator('#bFire').bounding_box(); fx, fy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        r0 = await page.evaluate("() => [window.__strike.W.ammo, window.__strike.player.pitch]")
        await touch('touchStart', [(5, fx, fy)])
        for k in range(1, 9):
            await touch('touchMove', [(5, fx, fy + k * 4)]); await sim(0.06)
        r1 = await page.evaluate("() => [window.__strike.W.ammo, window.__strike.player.pitch, window.__strike.INPUT.fire]")
        await page.screenshot(path=str(OUT / 'firing.png'))
        await touch('touchEnd', [])
        await sim(0.1)
        r2 = await page.evaluate("() => window.__strike.INPUT.fire")
        print('開火鍵按住連射', 'PASS' if r0[0] - r1[0] >= 4 else 'FAIL', r0[0] - r1[0], '發；拖著往下壓', 'PASS' if r1[1] < r0[1] else 'FAIL', round((r1[1] - r0[1]) * 57.3, 2), '度；放開停火', 'PASS' if r2 is False else 'FAIL')
        # 按鈕：跳、蹲、開鏡、換彈
        async def tap(sel):
            b = await page.locator(sel).bounding_box(); x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
            await touch('touchStart', [(9, x, y)]); await touch('touchEnd', [])
        await tap('#bJump'); await sim(0.1); jy = await page.evaluate("() => window.__strike.player.body.pos.y"); await sim(1)
        await tap('#bCrouch'); await sim(0.3); ch = await page.evaluate("() => window.__strike.player.crouch"); await tap('#bCrouch'); await sim(0.3)
        await tap('#bAds'); await sim(0.4); ads = await page.evaluate("() => window.__strike.player.adsT")
        await page.screenshot(path=str(OUT / 'ads.png'))
        await tap('#bAds'); await sim(0.3)
        await tap('#bReload'); await sim(0.6); rl = await page.evaluate("() => window.__strike.W.reloadT > 0")
        await page.screenshot(path=str(OUT / 'reload.png'))
        await tap('#bAuto'); af = await page.evaluate("() => window.__strike.S.autoFire")
        print('跳', 'PASS' if jy > 0.3 else 'FAIL', round(jy, 2), '蹲', 'PASS' if ch else 'FAIL', '開鏡', 'PASS' if ads > 0.9 else 'FAIL', '換彈', 'PASS' if rl else 'FAIL', '自動開火切換', 'PASS' if af else 'FAIL')
        # 戰鬥畫面：面對機器人
        await page.evaluate("""() => { const s = window.__strike; s.game.freezeBots = false; s.S.autoFire = true; s.W.ammo = 30;
            s.player.body.pos.set(-12, 0, 12); s.player.yaw = -Math.PI / 2; s.player.pitch = -0.02; s.player.hp = 100; s.player.alive = true;
            const b = s.bots[0]; b.alive = true; b.hp = 100; b.phys.pos.set(2, 0, 9); b.yaw = Math.PI / 2; b.state = 'patrol'; b.waitT = 99; b.path = null;
            const c = s.bots[1]; c.alive = true; c.hp = 100; c.phys.pos.set(1, 0, 14); c.yaw = Math.PI / 2; c.state = 'patrol'; c.waitT = 99; c.path = null; s.S.autoFire = false; }""")
        await sim(1.2)
        await page.screenshot(path=str(OUT / 'combat.png'))
        await page.evaluate("() => { const s = window.__strike; s.INPUT.mode = 'touch'; s.S.autoFire = true; }")
        await sim(1.0)
        await page.screenshot(path=str(OUT / 'combat2.png'))
        # 陣亡畫面
        await page.evaluate("() => { const s = window.__strike; s.player.hp = 1; }")
        await sim(2.5)
        await page.screenshot(path=str(OUT / 'dead.png'))
        # 直拿
        await page.set_viewport_size({'width': 390, 'height': 844}); await page.wait_for_timeout(300)
        await page.screenshot(path=str(OUT / 'portrait.png'))
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()
asyncio.run(main())
