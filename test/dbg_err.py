import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await browser.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e) + ' ' + str(getattr(e, 'stack', ''))[:400]))
        srv, url = serve(); await page.goto(url); await page.wait_for_timeout(6000)
        print(errors[:3]); await browser.close()
asyncio.run(main())
