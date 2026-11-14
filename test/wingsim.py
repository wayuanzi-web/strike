"""2 對 2 平衡模擬：你不在場，雙方各 2 個機器人。用法：python3 wingsim.py 場數 地圖"""
import asyncio, sys, json
from harness import *
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3; MAPS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['dawn']
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        tot = {}
        if len(sys.argv) > 3: await page.evaluate(f"() => {{ window.__ws = '{sys.argv[3]}'; }}")
        for mp in MAPS:
            for k in range(N):
                r = await page.evaluate("""async (mp) => { const s = window.__strike; s.game.manual = true; if (s.getMap().id !== mp) s.switchMap(mp); s.startGame('wingman');
                  const ex = s.bots.find((b) => b.baseTeam === 'A' && !b.active && !b.rageOnly); ex.active = true; ex.money = 800; s.ROUND.num = 0; s.ROUND.score = { A: 0, B: 0 }; s.ROUND.log = []; s.ROUND.history = []; s.ROUND.phase = 'none'; s.startRound();
                  let n = 0; while (s.game.state !== 'over' && n < 60 * 60 * 20) { if (s.player.alive) { s.player.alive = false; s.player.respawnT = Infinity; } s.step(1/60); n++; }
                  const L = s.ROUND.log; return { site: s.WING.site, score: s.ROUND.score, atk: L.filter((l) => l.w === l.atk).length, n: L.length, plants: L.filter((l) => l.planted).length, kinds: L.map((l) => l.kind).join(','), tac: L.map((l) => l.tactic).join(','), avgT: Math.round(L.reduce((a, l) => a + l.t, 0) / L.length) }; }""", mp)
                print(mp, json.dumps(r, ensure_ascii=False)); t = tot.setdefault(mp, [0, 0, 0]); t[0] += r['atk']; t[1] += r['n']; t[2] += r['plants']
        print('TOTAL', tot, 'ERR', [e for e in errors if '404' not in e][:3])
        await browser.close()
asyncio.run(main())
