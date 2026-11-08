"""M1 對戰模式整場模擬：回合會往下走、先到 7 勝結束、不卡住、機器人之間會互打。"""
import asyncio, json, sys
from playwright.async_api import async_playwright
from harness import open_game, OUT

PROBE = """(cfg) => {
  const s = window.__strike; const R = s.ROUND;
  if (!window.M) {
    window.M = { rounds: [], liveT: 0, botKills: 0, maxLive: 0, frozenMoves: 0, phases: {} };
    s.startGame('match');
  }
  const M = window.M;
  for (let i = 0; i < cfg.secs * 60; i++) {
    if (s.game.state === 'over') break;
    if (cfg.ghost && s.player.alive) { s.player.alive = false; s.player.respawnT = Infinity; s.player.body.pos.set(-40, 0, -30); s.onUnitDied && s.onUnitDied(s.player); }
    const ph = R.phase, num = R.num;
    const kb = s.bots.reduce((a, b) => a + (b.active ? b.kills : 0), 0);
    s.step(1/60);
    if (R.phase === 'live') { M.liveT += 1/60; M.maxLive = Math.max(M.maxLive, M.liveT); }
    if (ph === 'freeze' && R.phase === 'freeze') for (const b of s.bots) if (b.active && b.alive && b.phys.vel && Math.hypot(b.phys.vel.x, b.phys.vel.z) > 0.5) M.frozenMoves++;
    if (ph === 'live' && R.phase === 'end') { M.rounds.push({ n: num, w: R.history[R.history.length - 1], t: +M.liveT.toFixed(1), A: s.aliveCount('A'), B: s.aliveCount('B') }); M.liveT = 0; }
    M.botKills += s.bots.reduce((a, b) => a + (b.active ? b.kills : 0), 0) - kb;
  }
  return { state: s.game.state, phase: R.phase, num: R.num, score: R.score, rounds: M.rounds.length, botKills: M.botKills, maxLive: +M.maxLive.toFixed(1), frozenMoves: M.frozenMoves };
}"""

async def match(p, ghost, shot):
    browser, page, errors = await open_game(p)
    await page.evaluate("() => { window.__strike.game.manual = true; }")
    r = None
    for _ in range(200):          # 每次推進 15 秒，最多 50 分鐘
        r = await page.evaluate(PROBE, {'secs': 15, 'ghost': ghost})
        if r['state'] == 'over': break
    rounds = await page.evaluate('() => window.M.rounds')
    if shot:
        await page.evaluate('() => window.__strike.render()')
        await page.screenshot(path=str(OUT / f'{shot}.png'))
    await browser.close()
    return r, rounds, errors

async def main():
    bad = 0
    async with async_playwright() as p:
        for ghost, name in ((True, 'round_ghost'), (False, 'round_idle')):
            r, rounds, errors = await match(p, ghost, name + '_over')
            print(name, json.dumps(r, ensure_ascii=False))
            print('  ', ' '.join(f"{x['n']}:{x['w']}({x['t']}s {x['A']}v{x['B']})" for x in rounds))
            checks = [
                ('整場打完', r['state'] == 'over' and max(r['score'].values()) == 7),
                ('回合數合理', 7 <= r['rounds'] <= 13),
                ('沒有回合超時卡住', r['maxLive'] <= 156),
                ('機器人之間會互打', r['botKills'] >= r['rounds'] * 3),
                ('凍結時間機器人不動', r['frozenMoves'] == 0),
                ('沒有錯誤', not [e for e in errors if '404' not in e]),
            ]
            for n, ok in checks:
                print('  ', 'PASS' if ok else 'FAIL', n); bad += not ok
            if errors: print('   ERRORS', errors[:5])
    sys.exit(1 if bad else 0)

asyncio.run(main())
