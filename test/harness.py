"""測試共用：在 src/dist 開本機伺服器，用無頭 Chrome（軟體 WebGL）開 test.html。"""
import asyncio, functools, http.server, pathlib, threading
from playwright.async_api import async_playwright

DIST = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'dist'
OUT = pathlib.Path(__file__).resolve().parent / 'out'; OUT.mkdir(exist_ok=True)

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_port}/test.html'

async def open_game(p, touch=True, w=844, h=390):
    browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    srv, url = serve()
    await page.goto(url)
    await page.wait_for_function('window.__strike', timeout=30000)
    return browser, page, errors

# 在頁面裡推進模擬（不靠 requestAnimationFrame，速度穩定）
SIM = """(secs) => { const s = window.__strike; const n = Math.round(secs * 60); for (let i = 0; i < n; i++) s.step(1/60); s.render(); }"""
