import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        print(await page.evaluate("() => window.__mapTiming"))
        await browser.close()
asyncio.run(main())
