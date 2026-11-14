import asyncio
from harness import *
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        r = await page.evaluate("""() => { const s = window.__strike, b = s.bots[0]; const n = b.hm.mesh.geometry.attributes.position.count / 3; return n; }""")
        print('tris near', r, [e for e in errors if '404' not in e][:2]); await b.close()
asyncio.run(main())
