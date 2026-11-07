"""確認 Artifact 版（Three.js 從 jsDelivr 載入）真的跑得起來，順便量繪製次數。"""
import asyncio, os, pathlib
from harness import *
async def main():
    frag = (DIST / 'strike.html').read_text(encoding='utf8')
    (DIST / 'artifact-check.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + frag + '</body></html>', encoding='utf8')
    async with async_playwright() as p:
        proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, proxy={'server': proxy, 'bypass': '127.0.0.1,localhost'} if proxy else None,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'])
        ctx = await browser.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, ignore_https_errors=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        srv, url = serve()
        await page.goto(url.replace('test.html', 'artifact-check.html'))
        try:
            await page.wait_for_function('window.__strike', timeout=40000)
            await page.click('#bStart'); await page.wait_for_timeout(1500)
            info = await page.evaluate("() => { const s = window.__strike; s.S.showFps = true; return { calls: s.renderer.info.render.calls, tris: s.renderer.info.render.triangles, three: !!s.renderer }; }")
            print('CDN 版載入 OK', info)
        except Exception as e:
            print('CDN 版載入失敗', e)
        print('errors', errs)
        await browser.close()
asyncio.run(main())
