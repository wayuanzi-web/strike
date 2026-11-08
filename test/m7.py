"""M7：機器人走上平台、打法輪換、第二集合點、全隊經濟、個性、回防集合與保槍、你的指令（跟我、守這裡、打 B）。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []
        ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        await ev("() => { window.__strike.game.manual = true; }")
        # 1 機器人從地面走樓梯上卸貨平台（曙光倉區）
        r = await ev("""() => { const s = window.__strike; s.startGame('practice'); s.S.autoFire = false; s.player.body.pos.set(-34, 0, 24); s.player.spawnT = 999;
          const b = s.bots[0]; for (const o of s.bots) if (o !== b) { o.phys.pos.set(34, 0, 24); o.blindT = 999; }
          b.phys.pos.set(2, 0, -17); b.blindT = 999; b.state = 'patrol'; b.waitT = 0; b.path = s.findPath(2, -17, 19, -21, 0); b.pi = 0;
          for (let i = 0; i < 60 * 9; i++) { s.step(1/60); if (b.pi >= b.path.length - 1) break; } return [+b.phys.pos.y.toFixed(2), +b.phys.pos.x.toFixed(1), +b.phys.pos.z.toFixed(1), s.NAV.upCount]; }""")
        ok('1 機器人走樓梯上卸貨平台', r[0] > 2.3 and r[3] > 10, r)
        # 2 打法輪換：連續 10 回合至少 3 種、不會連續同一種
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = true; const out = [];
          for (let k = 0; k < 10; k++) { out.push(R.plan.type); R.phase = 'live'; s.endRound(R.atk, '測試', 'elim'); for (let i = 0; i < 330; i++) s.step(1/60); if (s.game.state === 'over') break; }
          return out; }""")
        ok('2 攻方打法輪換：10 回合至少 3 種、不連續重複', len(set(r)) >= 3 and all(a != b for a, b in zip(r, r[1:])), r)
        # 3 第二集合點：跟主要集合點方向不同、守點看不太到
        r = await ev("""() => { const s = window.__strike, out = {}; for (const id of s.MAP_ORDER) { s.switchMap(id); for (const k of ['A', 'B']) { const S = s.SITES[k], t = s.stage2Of(S);
            const a1 = Math.atan2(S.stage[1] - S.cz, S.stage[0] - S.cx), a2 = Math.atan2(t[1] - S.cz, t[0] - S.cx); let d = Math.abs(a1 - a2); if (d > Math.PI) d = 2 * Math.PI - d;
            out[id + k] = [t.map((v) => Math.round(v)), +d.toFixed(2)]; } } s.switchMap('dawn'); return out; }""")
        ok('3 第二集合點：每張地圖每個包點都有、方向跟主要集合點差 40 度以上', all(v[1] > 0.7 for v in r.values()), r)
        # 4 全隊經濟
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = true; R.num = 3; R.loss = { A: 0, B: 0 }; R.score = { A: 1, B: 1 };
          const B = s.bots.filter((b) => b.team === 'B'), set = (m, prim) => B.forEach((b) => { b.money = m; b.primary = prim ? s.WEAPONS.rifle : null; });
          set(800); const e1 = s.teamEcoMode('B', false); set(5200); const e2 = s.teamEcoMode('B', false); set(2700); R.loss.B = 2; const e3 = s.teamEcoMode('B', false);
          R.loss.B = 0; set(1800); R.score = { A: 6, B: 3 }; const e4 = s.teamEcoMode('B', false); return [e1, e2, e3, e4]; }""")
        ok('4 全隊經濟：沒錢存錢、有錢全買、連輸兩場強起、對方賽點強起', r == ['eco', 'full', 'force', 'force'], r)
        # 5 個性：狙擊手錢夠會買狙擊；存錢局不買槍
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; R.num = 3; R.score = { A: 1, B: 1 }; R.loss = { A: 0, B: 0 };
          for (const b of s.bots) { b.alive = true; b.money = 6500; b.primary = null; b.keep = false; } s.player.alive = true;
          R.num = 3; R.phase = 'live'; s.endRound('A', '測試', 'elim'); for (let i = 0; i < 330; i++) s.step(1/60);
          const sn = s.bots.find((b) => b.name === '青嵐'), tr = s.bots.map((b) => b.trait), snW = sn.primary && sn.primary.id, mateSn = s.bots.some((b) => b !== sn && b.team === sn.team && b.primary === s.WEAPONS.sniper);
          for (const b of s.bots) { b.alive = true; b.money = 300; b.primary = null; b.keep = false; }
          R.phase = 'live'; s.endRound('B', '測試', 'elim'); for (let i = 0; i < 330; i++) s.step(1/60);
          const ecoT = Object.keys(R.eco).find((t) => R.eco[t] === 'eco'), ecoGuns = s.bots.filter((b) => b.active && b.team === ecoT && b.primary).length;
          return [snW === 'sniper' || mateSn ? 'sniper' : snW, tr.filter(Boolean).length, ecoGuns, R.eco, sn.team, sn.active, s.bots.map((b) => b.primary && b.primary.id)]; }""")
        ok('5 個性：狙擊手買狙擊（隊上已經有人拿狙擊就不重複）；每隻都有個性；錢少的回合沒人買槍', r[0] == 'sniper' and r[1] == 9 and r[2] == 0 and 'eco' in r[3].values(), r)
        # 6 指令：跟我、守這裡、打 B
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = false; R.phase = 'live'; R.t = 100; R.liveT = 1;
          for (const b of s.bots) if (b.team === 'B') { b.phys.pos.set(34, 0, 24 - b.i); b.blindT = 999; b.alive = false; b.g.visible = false; }
          s.player.alive = true; s.player.body.pos.set(-20, 0, 6);
          s.giveOrder('follow'); for (let i = 0; i < 60 * 10; i++) { s.player.body.pos.set(-20, 0, 6); s.step(1/60); }
          const al = s.bots.filter((b) => b.team === 'A' && b.alive), d1 = al.map((b) => +Math.hypot(b.phys.pos.x + 20, b.phys.pos.z - 6).toFixed(1));
          s.player.body.pos.set(-10, 0, -10); s.player.yaw = 0; s.giveOrder('hold'); for (let i = 0; i < 60 * 12; i++) { s.player.body.pos.set(-30, 0, 0); s.step(1/60); }
          const d2 = al.map((b) => +Math.hypot(b.phys.pos.x + 10, b.phys.pos.z + 10).toFixed(1));
          s.giveOrder('B'); const pl = [R.plan.site, R.plan.exec, R.order];
          return [d1, d2, pl]; }""")
        ok('6a 指令「跟我來」：隊友 10 秒內都在你身邊 6 公尺內', all(d < 6 for d in r[0]), r[0])
        ok('6b 指令「守這裡」：隊友守在下指令的位置附近', all(d < 6 for d in r[1]), r[1])
        ok('6c 指令「打 B 點」（攻方）：目標改 B、馬上衝', r[2][0] == 'B' and r[2][1] is True and r[2][2] is None, r[2])
        # 7 回防：炸彈裝好、守方 3 人在 → 先集合；只剩 1 人對 3 人、時間不夠 → 保槍
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = true; R.phase = 'live'; R.t = 80; R.liveT = 30;
          const def = s.bots.filter((b) => b.team === 'B'), atk = s.bots.filter((b) => b.team === 'A');
          const spots = [[32, -20], [-20, -22], [2, -28], [-30, 10], [10, 0]]; def.forEach((b, i) => { b.alive = true; b.phys.pos.set(spots[i][0], 0, spots[i][1]); }); def[3].alive = false; def[4] && (def[4].alive = def[4].active ? true : false);
          const pl = atk[0]; pl.alive = true; s.giveBomb(pl); pl.phys.pos.set(20.8, 0, 20.3); s.plantBomb(pl);
          s.step(1/60); const g1 = def.filter((b) => b.alive).map((b) => s.objectiveGoal(b).tag);
          def.forEach((b, i) => { if (i > 0) b.alive = false; }); s.BOMB.t = 9; R.retake = null; s.step(1/60);
          const g2 = s.objectiveGoal(def[0]).tag; return [g1, g2, s.aliveCount('A')]; }""")
        ok('7 回防先集合；只剩 1 人對 3 人以上又沒時間就保槍', r[0].count('gather') >= 2 and r[1] == 'save', r)
        await page.screenshot(path=str(OUT / 'm7.png'))
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
