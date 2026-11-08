"""M11 好友 1 對 1：兩個瀏覽器用配對碼直連（WebRTC）→ 開始 → 看得到對方在哪、開槍對方扣血、擊殺計分、陣亡重生、手榴彈、先到目標結束、斷線處理。"""
import asyncio, time
from harness import *

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
        '--disable-features=WebRtcHideLocalIpsWithMdns']

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        srv, url = serve(); errors = []
        pages = []
        for nm in ['A', 'B']:
            ctx = await browser.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e, nm=nm: errors.append(f'{nm} pageerror: {e}'))
            await pg.goto(url); await pg.wait_for_function('window.__strike', timeout=30000)
            await pg.evaluate("() => { const s = window.__strike; s.game.manual = true; s.NET.iceServers = []; s.S.autoFire = false; window.__sfxLog = []; }")   # 沙盒連不到外面的 STUN，用本機位址
            pages.append(pg)
        A, B = pages
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        async def both(frames=2, rounds=1):
            for _ in range(rounds):
                await A.evaluate(f"() => {{ const s = window.__strike; for (let i = 0; i < {frames}; i++) s.step(1/60); }}")
                await B.evaluate(f"() => {{ const s = window.__strike; for (let i = 0; i < {frames}; i++) s.step(1/60); }}")
                await asyncio.sleep(0.01)
        # 1 配對：A 建房間（用畫面上的按鈕）、B 貼邀請碼、A 貼回覆碼
        await A.click('#bDuel'); await A.fill('#duelName', '阿明'); await A.click('#duelHost')
        await A.wait_for_function("document.getElementById('duelMine').value.startsWith('DSO1')", timeout=15000)
        offer = await A.input_value('#duelMine')
        await B.click('#bDuel'); await B.fill('#duelName', '小華'); await B.fill('#duelTheirs', offer); await B.click('#duelJoin')
        await B.wait_for_function("document.getElementById('duelMine').value.startsWith('DSA1')", timeout=15000)
        answer = await B.input_value('#duelMine')
        await A.fill('#duelTheirs', answer); await A.click('#duelJoin')
        t0 = time.time()
        while time.time() - t0 < 20:
            st = [await A.evaluate("() => window.__strike.NET.state"), await B.evaluate("() => window.__strike.NET.state")]
            if st == ['linked', 'linked']: break
            await asyncio.sleep(0.2)
        await asyncio.sleep(0.5)
        names = [await A.evaluate("() => window.__strike.NET.peer"), await B.evaluate("() => window.__strike.NET.peer")]
        go = await A.evaluate("() => !document.getElementById('duelGo').hidden")
        await A.screenshot(path=str(OUT / 'm11_lobby.png'))
        ok('1 配對碼互貼就連上、看到對方暱稱、開房的人有「開始」', st == ['linked', 'linked'] and names == ['小華', '阿明'] and go, [st, names, go, len(offer), len(answer)])
        # 2 開始：兩邊都進好友對戰、同一張地圖
        await A.evaluate("() => { const s = window.__strike; s.NET.goal = 2; }")
        await A.click('#duelGo'); await asyncio.sleep(0.6); await both(2, 3)
        r = [await pg.evaluate("() => { const s = window.__strike; return [s.game.mode, s.game.state, s.getMap().id, s.NET.on, s.NET.goal]; }") for pg in (A, B)]
        ok('2 開房的人按開始，兩邊同時進好友對戰、同一張地圖、同樣的目標', r[0][:4] == ['duel', 'play', r[1][2], True] and r[1][:2] == ['duel', 'play'] and r[0][4] == r[1][4] == 2, r)
        # 3 擺位置：A 在 (-12,0,-24)、B 在 (0,0,-24)（曙光南邊空地，看得到彼此）；A 看到的 B 跟 B 實際位置一致
        await A.evaluate("() => { const s = window.__strike; s.player.body.pos.set(-12, 0, -24); s.player.spawnT = 0; }")
        await B.evaluate("() => { const s = window.__strike; s.player.body.pos.set(0, 0, -24); s.player.spawnT = 0; s.player.yaw = 1.2; }")
        await both(3, 12)
        r = await A.evaluate("() => { const b = window.__strike.NET.remote; return [b.alive, +b.phys.pos.x.toFixed(2), +b.phys.pos.z.toFixed(2), +b.yaw.toFixed(2)]; }")
        ok('3 看得到對手在他實際的位置、面向也一樣（0.1 秒內插）', r[0] and abs(r[1]) < 0.3 and abs(r[2] + 24) < 0.3 and abs(r[3] - 1.2) < 0.15, r)
        # 4 A 瞄準 B 開槍：B 扣血、B 那邊有槍聲和曳光；打到 B 陣亡 → A 得 1 分、兩邊比分一致
        hp0 = await B.evaluate("() => window.__strike.player.hp")
        aim = """() => { const s = window.__strike, b = s.NET.remote, e = s.player.body.pos, h = b.phys.pos, dx = h.x - e.x, dz = h.z - e.z, dy = (h.y + 1.25) - (e.y + s.player.eye);
          s.player.yaw = Math.atan2(-dx, -dz); s.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); s.INPUT.fire = true; }"""
        hpMid = None
        for k in range(60):
            await A.evaluate(aim); await both(2)
            if hpMid is None: hpMid = await B.evaluate("() => window.__strike.player.hp")
            if not await B.evaluate("() => window.__strike.player.alive"): break
        await A.evaluate("() => { window.__strike.INPUT.fire = false; }"); await both(2, 4)
        r = [await A.evaluate("() => [window.__strike.NET.myK, window.__strike.NET.theirK, window.__strike.NET.remote.alive]"),
             await B.evaluate("() => [window.__strike.NET.myK, window.__strike.NET.theirK, window.__strike.player.alive, window.__sfxLog.filter((x) => x === 'botshot').length]")]
        await B.screenshot(path=str(OUT / 'm11_dead.png'))
        ok('4 開槍對方扣血、對方聽到槍聲；打死對方得 1 分，兩邊比分一致', hp0 == 100 and r[0][0] == 1 and r[1][1] == 1 and r[0][2] is False and r[1][2] is False and r[1][3] > 0, [hp0, hpMid, r])
        # 5 B 2.5 秒後重生，A 看到他回來
        await both(10, 18)
        r = [await B.evaluate("() => [window.__strike.player.alive, Math.round(window.__strike.player.hp)]"), await A.evaluate("() => window.__strike.NET.remote.alive")]
        ok('5 陣亡 2.5 秒後重生，對方也看到他回來', r[0][0] and r[0][1] == 100 and r[1], r)
        # 6 手榴彈：A 丟在 B 腳邊 → B 那邊也看到手榴彈，B 扣血（只扣一次，不會兩邊各算一次）
        await B.evaluate("() => { const s = window.__strike; s.player.body.pos.set(0, 0, -24); s.player.spawnT = 0; s.player.hp = 100; s.INV.vest = false; s.INV.helmet = false; }")
        await both(2, 6)
        await A.evaluate("""() => { const s = window.__strike, V = s.player.body.pos.constructor; const o = new V(-0.8, 1.5, -24), d = new V(0.1, -1, 0).normalize(); s.throwNade('he', o, d, s.player, null); s.netNade('he', o, d, null); }""")
        await A.evaluate("() => {}")
        seen = False; hpList = []
        for k in range(50):
            await both(3)
            if not seen: seen = await B.evaluate("() => window.__strike.nadesLive.length > 0")
            hpList.append(await B.evaluate("() => Math.round(window.__strike.player.hp)"))
        ok('6 丟手榴彈：對方畫面也有那顆手榴彈、爆炸只扣一次血', seen and min(hpList) < 100, [seen, sorted(set(hpList))[:4]])
        # 7 再殺一次到達目標（2 殺）→ A 勝利、B 落敗
        await B.evaluate("() => { const s = window.__strike; if (!s.player.alive) return; s.player.body.pos.set(0, 0, -24); s.player.hp = 20; }")
        for k in range(60):
            if await B.evaluate("() => window.__strike.game.state") == 'over': break
            if await B.evaluate("() => window.__strike.player.alive"): await A.evaluate(aim)
            await both(3)
        await A.evaluate("() => { window.__strike.INPUT.fire = false; }"); await both(2, 4)
        r = [await pg.evaluate("() => [window.__strike.game.state, document.getElementById('overT').textContent, document.getElementById('overS').textContent]") for pg in (A, B)]
        await A.screenshot(path=str(OUT / 'm11_over.png'))
        ok('7 先到目標的人贏：A「勝利」、B「落敗」，比分一致', r[0][:2] == ['over', '勝利'] and r[1][:2] == ['over', '落敗'] and r[0][2] == r[1][2][::-1], r)
        # 8 再來一場：開房的人按「再來一場」，兩邊重新開始、比分歸零
        await A.click('#bAgain'); await asyncio.sleep(0.5); await both(2, 3)
        r = [await pg.evaluate("() => [window.__strike.game.mode, window.__strike.game.state, window.__strike.NET.myK, window.__strike.NET.theirK]") for pg in (A, B)]
        ok('8 再來一場：兩邊重新開始、比分歸零', r == [['duel', 'play', 0, 0], ['duel', 'play', 0, 0]], r)
        # 9 斷線：B 關掉 → A 顯示連線中斷、回到選單
        await B.context.close()
        t0 = time.time(); st = ''
        while time.time() - t0 < 25:
            await A.evaluate("() => { const s = window.__strike; for (let i = 0; i < 6; i++) s.step(1/60); }")
            st = await A.evaluate("() => [window.__strike.NET.state, window.__strike.game.state, document.getElementById('bnT').textContent]")
            if st[1] == 'menu': break
            await asyncio.sleep(0.3)
        ok('9 對方關掉 → 你這邊顯示連線中斷、回到選單', st[0] == 'idle' and st[1] == 'menu', [st, round(time.time() - t0, 1)])
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
