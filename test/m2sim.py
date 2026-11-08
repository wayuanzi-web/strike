"""M2 炸彈模式整場模擬：回合會走完、有裝彈／拆彈／爆炸、有買槍、有丟投擲物、沒有錯誤。
用法：python3 m2sim.py [場數] [ghost|idle]"""
import asyncio, json, sys
from playwright.async_api import async_playwright
from harness import open_game, OUT

PROBE = """(cfg) => {
  const s = window.__strike, R = s.ROUND;
  if (!window.M) {
    window.M = { nades: { he: 0, flash: 0, smoke: 0 }, buys: {}, kills: {}, stuck: 0, maxLive: 0, money: [] };
    const orig = s.throwNade; 
    if (cfg.map) s.switchMap(cfg.map);
    s.startGame('match');
    if (cfg.ghost) { const x = s.bots[4]; x.active = false; x.alive = false; x.g.visible = false; }   // 你不在場時，敵方也少一人（4 對 4）
  }
  const M = window.M;
  for (let i = 0; i < cfg.secs * 60; i++) {
    if (s.game.state === 'over') break;
    if (cfg.ghost && s.player.alive) { s.player.alive = false; s.player.respawnT = Infinity; s.onUnitDied(s.player); }
    const ph = R.phase;
    s.step(1/60);
    if (ph === 'freeze' && R.phase === 'live') {
      for (const b of s.bots) if (b.active) { const k = b.wpn.id; M.buys[k] = (M.buys[k] || 0) + 1; }
    }
    for (const n of s.nadesLive) if (!n.counted) { n.counted = true; M.nades[n.type]++; }
  }
  return { state: s.game.state, phase: R.phase, num: R.num, score: R.score, log: R.log, nades: M.nades, buys: M.buys };
}"""

MAPID = ''
async def match(p, ghost):
    browser, page, errors = await open_game(p)
    await page.evaluate("() => { window.__strike.game.manual = true; }")
    feed = []
    r = None
    for _ in range(240):
        r = await page.evaluate(PROBE, {'secs': 15, 'ghost': ghost, 'map': MAPID})
        if r['state'] == 'over': break
    await browser.close()
    return r, errors

async def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    mode = sys.argv[2] if len(sys.argv) > 2 else 'ghost'
    global MAPID; MAPID = sys.argv[3] if len(sys.argv) > 3 else ''
    async with async_playwright() as p:
        tot = {'atk': 0, 'def': 0, 'kinds': {}, 'plants': 0}
        for i in range(n):
            r, errors = await match(p, mode == 'ghost')
            print('match', i, r['state'], r['score'], 'rounds', len(r['log']))
            for x in r['log']:
                side = 'atk' if x['w'] == x['atk'] else 'def'; tot[side] += 1; tot['kinds'][x['kind']] = tot['kinds'].get(x['kind'], 0) + 1; tot['plants'] += x['planted']
            print('  ', ' '.join(f"{x['n']}:{x['w']}{'攻' if x['w']==x['atk'] else '守'}/{x['kind']}{'@'+x['site'] if x['planted'] else ''}({x['t']})" for x in r['log']))
            print('   nades', r['nades'], 'buys', r['buys'])
            errs = [e for e in errors if '404' not in e]
            if errs: print('   ERRORS', errs[:6])
        print('TOTAL', json.dumps(tot, ensure_ascii=False))

asyncio.run(main())
