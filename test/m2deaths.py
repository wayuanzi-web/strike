import asyncio, collections, sys
from playwright.async_api import async_playwright
from harness import open_game
async def main():
    async with async_playwright() as p:
        b, page, errors = await open_game(p)
        await page.evaluate(f"() => {{ window.MAPID = '{sys.argv[1] if len(sys.argv)>1 else ''}'; }}")
        await page.evaluate("() => { const s = window.__strike; s.game.manual = true; if (window.MAPID) s.switchMap(window.MAPID); s.startGame('match'); window.D = []; }")
        for _ in range(60):
            r = await page.evaluate("""() => { const s = window.__strike, R = s.ROUND;
              for (let i = 0; i < 900; i++) { if (s.game.state === 'over') break;
                if (s.player.alive) { s.player.alive = false; s.player.respawnT = Infinity; s.onUnitDied(s.player); }
                const alive = s.bots.map(b => b.alive), st = s.bots.map(b => b.state);
                s.step(1/60);
                s.bots.forEach((b, k) => { if (b.active && alive[k] && !b.alive) {
                  let killer = null, kd = 1e9; for (const o of s.bots) if (o.active && o.alive && o.team !== b.team && o.firedAt > R.liveT - 99 && s.game.t - o.firedAt < 0.3) { const d = o.phys.pos.distanceTo(b.phys.pos); if (d < kd) { kd = d; killer = o; } }
                  window.D.push({ r: R.num, t: +R.liveT.toFixed(0), side: b.team === R.atk ? 'atk' : 'def', st: st[k], x: +b.phys.pos.x.toFixed(0), z: +b.phys.pos.z.toFixed(0), kst: killer ? killer.state : '?', kd: +kd.toFixed(0), planted: s.BOMB.planted, exec: R.plan && R.plan.exec });
                } });
              }
              return s.game.state; }""")
            if r == 'over': break
        D = await page.evaluate("() => window.D")
        await b.close()
    by = collections.Counter((d['side'], d['st'], d['kst']) for d in D)
    for k, v in by.most_common(20): print(v, k)
    print('dist', collections.Counter((d['side'], min(d['kd'] // 10 * 10, 60)) for d in D))
    print('pre-exec deaths', collections.Counter(d['side'] for d in D if not d['exec'] and not d['planted']))
    import collections as C
    print('pre-exec atk deaths by area', C.Counter((d['x']//8*8, d['z']//8*8) for d in D if d['side']=='atk' and not d['exec']).most_common(8))
    print('atk deaths after exec', C.Counter((d['x']//6*6, d['z']//6*6) for d in D if d['side']=='atk' and d['exec']).most_common(10))
    print('def deaths after exec', C.Counter((d['x']//6*6, d['z']//6*6) for d in D if d['side']=='def' and d['exec']).most_common(10))
    print('def deaths pre-exec', C.Counter((d['x']//8*8, d['z']//8*8) for d in D if d['side']=='def' and not d['exec']).most_common(8))
asyncio.run(main())
