"""M6：自訂按鈕位置（拖曳、大小、透明度、存檔、重新整理後還在、左手對調）、按住／切換、固定搖桿、前進鎖定、轉視角加速曲線、陀螺儀。"""
import asyncio, time
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        cdp = await page.context.new_cdp_session(page)
        async def touch(kind, pts):
            await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        async def center(sel):
            b = await page.locator(sel).bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        async def tap(sel):
            x, y = await center(sel); await touch('touchStart', [(9, x, y)]); await touch('touchEnd', [])
        sim = lambda t: ev(SIM, t)
        await ev("() => { try { localStorage.removeItem('strike.settings'); } catch (e) {} }")
        await page.click('#bStart')
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.game.freezeBots = true; s.player.body.pos.set(-32, 0, 0); s.player.yaw = -Math.PI / 2; }")
        # 1 編輯模式：拖曳「跳」到畫面中間、調大小與透明度
        await tap('#bPause'); await sim(0.05); await tap('#bLayout')
        x0, y0 = await center('#bJump')
        await touch('touchStart', [(1, x0, y0)])
        for k in range(1, 11): await touch('touchMove', [(1, x0 + (420 - x0) * k / 10, y0 + (200 - y0) * k / 10)])
        await touch('touchEnd', [])
        await ev("""() => { for (const [id, v] of [['edSize', 1.4], ['edOp', 0.5]]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); } }""")
        r = await ev("() => { const s = window.__strike; return [s.ED.on, s.ED.sel, s.S.layout && s.S.layout.bJump, s.player.body.pos.y]; }")
        x1, y1 = await center('#bJump')
        ok('1 編輯模式：拖曳按鈕到新位置、調大小透明度、拖的時候不會真的跳', r[0] and r[1] == 'bJump' and abs(x1 - 420) < 4 and abs(y1 - 200) < 4 and r[2]['s'] == 1.4 and r[2]['o'] == 0.5 and r[3] < 0.05, [r, round(x1), round(y1)])
        # 拖搖桿
        jx, jy = await ev("() => window.__strike.joyHome()")
        await touch('touchStart', [(2, jx, jy)]); await touch('touchMove', [(2, jx + 40, jy - 30)]); await touch('touchEnd', [])
        await page.screenshot(path=str(OUT / 'm6_edit.png'))
        await tap('#edDone')
        r = await ev("() => { const s = window.__strike; return [s.ED.on, document.getElementById('pause').hidden, !!s.S.layout.joy, JSON.parse(localStorage.getItem('strike.settings')).layout]; }")
        ok('2 完成後回到設定、配置存進手機', (not r[0]) and (not r[1]) and r[2] and r[3]['bJump']['s'] == 1.4, r)
        # 3 重新整理後還在；左手模式左右對調
        await page.reload(); await page.wait_for_function('window.__strike', timeout=30000)
        await page.click('#bStart'); await ev("() => { const s = window.__strike; s.game.manual = true; s.game.freezeBots = true; }")
        x2, y2 = await center('#bJump'); op = await ev("() => getComputedStyle(document.getElementById('bJump')).opacity")
        await ev("() => { const s = window.__strike; s.S.lefty = true; s.applyHand(); }")
        x3, y3 = await center('#bJump'); jh = await ev("() => window.__strike.joyHome()")
        await ev("() => { const s = window.__strike; s.S.lefty = false; s.applyHand(); }")
        ok('3 重新整理後位置、透明度還在；左手模式自動左右對調', abs(x2 - 420) < 4 and abs(y2 - 200) < 4 and float(op) == 0.5 and abs(x3 - (844 - 420)) < 4 and jh[0] > 600, [round(x2), round(y2), op, round(x3), [round(v) for v in jh]])
        await ev("() => { const s = window.__strike; s.player.body.pos.set(-32, 0, 0); s.player.yaw = -Math.PI / 2; s.player.alive = true; s.game.state = 'play'; }")
        # 4 按住模式：開鏡、蹲
        await ev("() => { const s = window.__strike; s.S.adsMode = 'hold'; s.S.crouchMode = 'hold'; }")
        ax, ay = await center('#bAds'); cx, cy = await center('#bCrouch')
        await touch('touchStart', [(3, ax, ay), (4, cx, cy)]); await sim(0.4)
        a1 = await ev("() => [window.__strike.player.ads, window.__strike.player.crouch]")
        await touch('touchEnd', []); await sim(0.4)
        a2 = await ev("() => [window.__strike.player.ads, window.__strike.player.crouch]")
        await ev("() => { const s = window.__strike; s.S.adsMode = 'toggle'; s.S.crouchMode = 'toggle'; }")
        await tap('#bAds'); await sim(0.2); a3 = await ev("() => window.__strike.player.ads"); await tap('#bAds'); await sim(0.2)
        ok('4 開鏡、蹲「按住」：按著才有、放開就取消；「切換」照舊', a1 == [True, True] and a2 == [False, False] and a3 is True, [a1, a2, a3])
        # 5 固定搖桿：手指按在底座旁邊，馬上就往那個方向走（浮動則從零開始）
        await ev("() => { const s = window.__strike; s.S.layout = null; s.applyHand(); s.S.joyMode = 'fixed'; }")
        jx, jy = await ev("() => window.__strike.joyHome()")
        await touch('touchStart', [(5, jx, jy - 40)]); await sim(0.05)
        f1 = await ev("() => [window.__strike.INPUT.mz, document.getElementById('joy').style.left]")
        await touch('touchEnd', []); await ev("() => { window.__strike.S.joyMode = 'float'; }")
        await touch('touchStart', [(5, jx, jy - 40)]); await sim(0.05)
        f2 = await ev("() => window.__strike.INPUT.mz"); await touch('touchEnd', [])
        ok('5 固定搖桿：底座不動、按在上方就往前走；浮動搖桿按下時不動', f1[0] > 0.6 and abs(float(f1[1][:-2]) - jx) < 1 and abs(f2) < 0.01, [f1, f2])
        # 6 前進鎖定：推到底再往上拉、放開後一直往前；再按一下取消
        x0 = await ev("() => window.__strike.player.body.pos.x")
        await touch('touchStart', [(6, 150, 300)])
        for k in range(1, 9): await touch('touchMove', [(6, 150, 300 - k * 16)])
        cls = await ev("() => document.getElementById('joy').className")
        await touch('touchEnd', []); await sim(1.5)
        l1 = await ev("() => [window.__strike.INPUT.runLock, window.__strike.player.body.pos.x, document.getElementById('joy').className]")
        await touch('touchStart', [(6, 150, 300)]); await touch('touchEnd', []); await sim(0.5)
        x2 = await ev("() => window.__strike.player.body.pos.x"); await sim(0.5)
        l2 = await ev("() => [window.__strike.INPUT.runLock, window.__strike.player.body.pos.x]")
        ok('6 前進鎖定：上拉時提示、放開後自己往前走、再按一下停', 'arm' in cls and l1[0] and l1[1] - x0 > 3 and 'lock' in l1[2] and (not l2[0]) and abs(l2[1] - x2) < 0.3, [cls, l1, round(x0, 1), l2])
        # 7 轉視角曲線：慢慢拖比固定曲線轉得少、快甩轉得多
        drag = lambda curve, steps, px, ms: ev(f"""() => {{ const s = window.__strike; s.S.curve = '{curve}'; s.player.yaw = 0; s.INPUT.lookDX = 0; let t = 1e6; s.T.lastLook = t;
            for (let k = 0; k < {steps}; k++) {{ t += {ms}; s.lookBy(-{px}, 0, t); }} s.step(1/60); return s.player.yaw * 57.3; }}""")
        lin = await drag('linear', 10, 6, 30); slow = await drag('accel', 10, 6, 30); fast = await drag('accel', 6, 10, 4)
        ok('7 加速曲線：同樣 60px，慢拖轉得比固定少、快甩比固定多', slow < lin * 0.8 and fast > lin * 1.15, [round(lin, 1), round(slow, 1), round(fast, 1)])
        await ev("() => { window.__strike.S.curve = 'linear'; }")
        # 8 陀螺儀：橫拿往右轉 30 度／秒 0.5 秒 → 往右看約 15 度；「只在開鏡時」沒開鏡不轉
        async def spin(mode, ads, beta=-30, angle=90):
            await ev(f"() => {{ const s = window.__strike; s.S.gyro = '{mode}'; s.GYRO.angle = {angle}; s.player.ads = {str(ads).lower()}; s.player.adsT = 0; s.player.yaw = 0; s.player.pitch = 0; }}")
            for k in range(30):
                await ev(f"() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {{ rotationRate: {{ alpha: 0, beta: {beta}, gamma: 0 }}, interval: 16 }}))")
                time.sleep(0.017)
            await sim(1 / 60)
            return await ev("() => -window.__strike.player.yaw * 57.3")
        g1 = await spin('on', False); g2 = await spin('ads', False); g3 = await spin('on', False, -30, 270); ev_n = await ev("() => window.__strike.GYRO.events")
        ok('8 陀螺儀：右轉手機畫面往右轉、只在開鏡時模式不開鏡不動、反方向橫拿也對', g1 > 8 and abs(g2) < 0.01 and g3 < -8 and ev_n >= 90, [round(g1, 1), round(g2, 2), round(g3, 1), ev_n])
        await ev("() => { const s = window.__strike; s.S.gyro = 'off'; s.GYRO.angle = null; }")
        # 設定畫面截圖
        await tap('#bPause'); await sim(0.05); await page.screenshot(path=str(OUT / 'm6_settings.png'))
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
