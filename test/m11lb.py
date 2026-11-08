"""M11 排行榜（遊戲端）：沒設伺服器就不顯示；設了之後練槍場自動上傳（要自己打開）、生涯上傳、排行榜列表標出自己。用本機假伺服器（同一份 Worker 程式）測。"""
import asyncio, subprocess, pathlib, time
from harness import *
ROOT = pathlib.Path(__file__).resolve().parent

async def main():
    port = 18787
    srv = subprocess.Popen(['node', str(ROOT / 'lb-fake.mjs'), 'serve', str(port)], stdout=subprocess.PIPE, text=True)
    assert 'READY' in srv.stdout.readline()
    try:
        async with async_playwright() as p:
            browser, page, errors = await open_game(p)
            res = []; ok = lambda n, c, i='': res.append((n, c, i))
            ev = page.evaluate
            await ev("() => { window.__strike.game.manual = true; window.__strike.openProg(); }")
            r = await ev("() => [document.getElementById('pgLb').hidden, window.__strike.lbUrl()]")
            ok('1 沒有設排行榜伺服器：成長畫面不顯示排行榜、不連任何地方', r == [True, ''], r)
            await ev(f"() => {{ const s = window.__strike; s.S.lbUrl = 'http://127.0.0.1:{port}'; s.S.nick = '阿明'; s.closeProg(); s.openProg(); }}")
            await page.wait_for_function("document.getElementById('lbList').textContent !== '讀取中…'", timeout=10000)
            r = await ev("() => [document.getElementById('pgLb').hidden, document.getElementById('lbList').textContent]")
            ok('2 設了伺服器：顯示排行榜（一開始沒人）', r[0] is False and '還沒有人' in r[1], r)
            # 練槍場自動上傳：預設關 → 不送；打開 → 送出、顯示名次
            await ev("() => { document.getElementById('overC').textContent = ''; }")
            await ev("() => window.__strike.lbAfterRange({ hit: 26, miss: 4, avgMs: 480, bestMs: 300, acc: 0.72, heads: 5 })")
            await asyncio.sleep(0.5); off = await ev("() => document.getElementById('overC').textContent")
            await ev("() => { window.__strike.S.lbOn = true; document.getElementById('overC').textContent = ''; }")
            await ev("() => window.__strike.lbAfterRange({ hit: 26, miss: 4, avgMs: 480, bestMs: 300, acc: 0.72, heads: 5 })")
            await page.wait_for_function("document.getElementById('overC').textContent.includes('排行榜')", timeout=10000)
            on = await ev("() => document.getElementById('overC').textContent")
            ok('3 練槍場上傳要自己打開；打開後打完自動上傳、顯示名次', off == '' and '第 1 名' in on, [off, on])
            # 生涯：不到 10 場不給傳；夠了上傳成功；列表標出自己
            await ev("() => { const s = window.__strike; s.STATS().matches = 4; }")
            await page.click('#lbCareer'); m1 = await ev("() => document.getElementById('lbMsg').textContent")
            await ev("() => { const s = window.__strike; s.STATS().matches = 12; s.STATS().wins = 8; s.STATS().kills = 150; }")
            await page.click('#lbCareer')
            await page.wait_for_function("document.getElementById('lbMsg').textContent.includes('名')", timeout=10000)
            await page.wait_for_function("document.querySelector('#lbList li.me')", timeout=10000)
            m2 = await ev("() => [document.getElementById('lbMsg').textContent, document.querySelector('#lbList li.me').textContent, document.getElementById('lbMine').textContent]")
            await ev("() => { document.querySelector('#prog .card').scrollTop = 9999; }")
            await page.screenshot(path=str(OUT / 'm11_lb.png'))
            ok('4 生涯不到 10 場不給上傳；夠了上傳成功、列表標出自己', '10 場' in m1 and '第 1 名' in m2[0] and '阿明' in m2[1] and '67%' in m2[1], [m1, m2])
            # 伺服器掛了：顯示連不上，不會卡住
            srv.kill(); srv.wait()
            await ev("() => { window.__strike.closeProg(); window.__strike.openProg(); }")
            await page.wait_for_function("document.getElementById('lbList').textContent !== '讀取中…'", timeout=15000)
            r = await ev("() => document.getElementById('lbList').textContent")
            ok('5 伺服器連不上：顯示「連不上排行榜」，遊戲照常', '連不上' in r, r)
            for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
            print('ERRORS', [e for e in errors if '404' not in e and 'ERR_CONNECTION_REFUSED' not in e and 'Failed to load resource' not in e])
            await browser.close()
    finally:
        srv.kill()

asyncio.run(main())
