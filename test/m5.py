"""M5：效能報告內容、跑分（三張地圖跑完、回到原本地圖）、換地圖記憶體不累積、iPhone 手勢擋掉、WebGL 被回收時提示、複製報告。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        res = []
        ok = lambda n, c, i='': res.append((n, c, i))
        # 1 實際玩一下（不是手動步進，真的跑畫面），報告要有遊玩幀數與裝置資訊
        await page.tap('#bStart'); await page.wait_for_timeout(4000)
        rep = await page.evaluate("() => window.__strike.perfReport()")
        ok('1 報告：版本、裝置、畫面、開機時間、遊玩幀數、記憶體', all(k in rep for k in ['版本 2', '裝置：', '畫面：', '開機', '實際遊玩（', '中位', '記憶體：幾何']), rep.split('\n')[:7])
        # 2 跑分：從設定進去按「跑分」
        await page.tap('#bPause'); await page.wait_for_timeout(200); await page.tap('#bPerf'); await page.wait_for_timeout(200)
        await page.tap('#perfBench')
        await page.wait_for_function("() => !window.__strike.PERF.bench && !document.getElementById('perf').hidden", timeout=240000)
        r = await page.evaluate("() => { const s = window.__strike; return [s.PERF.results.map(x => [x.id, x.s.med, x.s.n, x.draws]), s.getMap().id, document.getElementById('menu').hidden, document.getElementById('perfT').textContent.includes('跑分（每張地圖'), Object.keys(s.PERF.mapLoads).length]; }")
        ok('2 跑分每張地圖都有結果、回到原本地圖與選單、報告列出跑分', len(r[0]) == 4 and all(x[2] > 20 for x in r[0]) and r[1] == 'dawn' and r[2] is False and r[3] and r[4] >= 3, r)
        await page.screenshot(path=str(OUT / 'm5_perf.png'))
        # 3 複製報告
        await page.tap('#perfCopy'); await page.wait_for_timeout(300)
        clip = await page.evaluate("() => navigator.clipboard.readText()")
        ok('3 複製報告到剪貼簿', clip.startswith('破曉突擊 效能報告'), clip[:30])
        await page.tap('#perfX')
        # 4 換地圖記憶體：換兩輪，第二輪結束時幾何、貼圖數量不比第一輪多
        r = await page.evaluate("""() => { const s = window.__strike, m = s.renderer.info.memory, out = [];
          for (let k = 0; k < 2; k++) { for (const id of ['market', 'rail', 'dawn']) { s.switchMap(id); s.render(); } out.push([m.geometries, m.textures]); }
          return out; }""")
        ok('4 換地圖兩輪：幾何、貼圖數量沒有累積', r[1][0] <= r[0][0] + 2 and r[1][1] <= r[0][1], r)
        # 5 iPhone 手勢：雙指縮放、雙擊被擋掉
        r = await page.evaluate("""() => { const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g);
          const d = new MouseEvent('dblclick', { cancelable: true, bubbles: true }); document.body.dispatchEvent(d); return [g.defaultPrevented, d.defaultPrevented]; }""")
        ok('5 擋掉 Safari 雙指縮放、雙擊放大', r == [True, True], r)
        # 6 WebGL 被回收：出現提示
        await page.evaluate("() => { const gl = window.__strike.renderer.getContext(); gl.getExtension('WEBGL_lose_context').loseContext(); }")
        await page.wait_for_timeout(500)
        r = await page.evaluate("() => !document.getElementById('glLost').hidden")
        ok('6 畫面被系統回收：提示重新載入', r is True, r)
        await page.screenshot(path=str(OUT / 'm5_gllost.png'))
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e and 'CONTEXT_LOST' not in e and 'context' not in e.lower()])
        await browser.close()

asyncio.run(main())
