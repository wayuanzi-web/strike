"""M14 段位賽（參考 CS2 Premier）、2 對 2（Wingman）、軍備競賽（Arms Race）。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        tap = lambda sel: ev(f"""() => {{ const el = document.querySelector('{sel}'); const r = el.getBoundingClientRect(), o = {{ pointerId: 3, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, pointerType: 'touch', isPrimary: true }};
            el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); el.click && 0; }}""")
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; }")
        # 1 段位與徽章：15 階、邊界正確、每種樣式都畫得出來；定級中是問號
        r = await ev("""() => { const s = window.__strike; const names = [0, 799, 800, 1000, 1100, 1549, 1550, 2000, 2499, 2500, 3500].map((x) => s.tierOf(x).name);
          const kinds = new Set([0, 1100, 1550, 2000, 2500].map((x) => s.tierOf(x).kind)); const svgs = [0, 1100, 1550, 2000, 2900].map((x) => s.rankBadge(x, true).length);
          return [names, kinds.size, Math.min(...svgs) > 200, s.rankBadge(1000, false).includes('?')]; }""")
        ok('1 段位 15 階（二兵…上將）、5 種徽章樣式都畫得出來、定級中是問號', r[0] == ['二兵', '二兵', '一兵', '上兵', '下士', '上士', '少尉', '少校', '上校', '少將', '上將'] and r[1] == 5 and r[2] and r[3], r)
        # 2 Elo：同分贏約 +15、贏強隊加更多、輸弱隊扣更多、回合差加減、贏至少 +5、定級賽加倍
        r = await ev("""() => { const s = window.__strike, R = s.RKS(); R.rating = 1200; const d = (opp, win, rd, pl) => { s.RK.opp = opp; return s.rankDelta(win, rd, pl); };
          return [d(1200, true, 0), d(1400, true, 0), d(1000, true, 0), d(1000, false, 0), d(1400, false, 0), d(1200, true, 6) - d(1200, true, 0), d(2400, false, -7), d(200, true, 0), d(1200, true, 0, true)]; }""")
        ok('2 評分：同分贏 +15、贏強隊多、輸弱隊扣多、回合差有影響、贏至少 +5、定級賽 ×2', r[0] == 15 and r[1] > r[0] > r[2] and r[3] < r[4] < 0 and r[5] >= 6 and r[6] <= -5 and r[7] >= 5 and r[8] == 30, r)
        # 3 換季：上一季收進紀錄、分數往 1000 拉回一半、重打定級
        r = await ev("""() => { const s = window.__strike, R = s.RKS(); Object.assign(R, { season: '2026-10', rating: 1600, peak: 1700, played: 12, wins: 8, placed: 5, hist: [{ d: 10, win: true, map: 'dawn' }] });
          const ch = s.rankSeasonCheck(new Date(2026, 10, 15)); const same = s.rankSeasonCheck(new Date(2026, 10, 20));
          return [ch, same, R.season, R.rating, R.placed, R.played, R.hist.length, R.seasons[0].final, R.seasons[0].peak, R.seasons[0].placed]; }""")
        ok('3 換季（每月）：上季 1600 → 新季 1300、重打定級、上季紀錄留著；同一季不重設', r == [True, False, '2026-11', 1300, 0, 0, 0, 1600, 1700, True], r)
        # 4 對手強度：600＝簡單、1000＝普通、1600＝困難、2600 比困難更強；中間內插
        r = await ev("""() => { const s = window.__strike, D = (x) => s.diffForRating(x);
          return [D(600).react, D(1000).react, D(1300).react, D(1600).react, D(2600).react, D(1000).mercy, D(1600).mercy, D(2600).maxShooters, D(1300).dmg]; }""")
        ok('4 對手強度跟著分數：簡單 → 普通 → 困難 → 精英連續變化', abs(r[0] - 0.9) < 1e-6 and abs(r[1] - 0.64) < 1e-6 and r[1] > r[2] > r[3] > r[4] and r[5] and not r[6] and r[7] == 4 and 0.56 < r[8] < 0.72, r)
        # 5 禁選：用畫面上的按鈕。你禁一張 → 對手禁你勝率最高的 → 你選 → 對手選邊 → 在選的地圖開打
        await ev("""() => { const s = window.__strike, R = s.RKS(); Object.assign(R, { rating: 1000, peak: 1000, placed: 0, played: 0, wins: 0, hist: [] });
          const st = s.STATS(); st.maps.rail = { played: 10, won: 9 }; st.maps.site = { played: 4, won: 0 }; st.maps.market = { played: 4, won: 1 }; s.openRanked(); }""")
        vis1 = await ev("() => !document.getElementById('rankOpt').hidden && document.getElementById('rankBody').textContent.includes('定級中')")
        await tap('#rankGo')
        await tap('#vetoMaps .vmap[data-map="dawn"]')
        await page.wait_for_timeout(1100)
        mid = await ev("() => [...document.querySelectorAll('#vetoMaps .vmap')].map((b) => [b.dataset.map, b.className.replace('vmap', '').trim(), b.disabled])")
        await tap('#vetoMaps .vmap[data-map="market"]')
        await page.wait_for_function("() => window.__strike.game.sub === 'ranked'", timeout=15000)
        r = await ev("""() => { const s = window.__strike; return [s.getMap().id, s.game.mode, s.game.sub, s.ROUND.atk === s.RK.startAtk, s.RK.live, s.RK.opp > 800 && s.RK.opp < 1200, s.botDiff(s.bots.find((b) => b.active && b.team === 'B')) === s.RK.diff, document.getElementById('rankVeto').hidden]; }""")
        ok('5 禁選：你禁曙光、對手禁你勝率最高的鐵道、你選舊城 → 在舊城開打、對手強度照分數、對手決定攻守', vis1 and dict((m, c) for m, c, _ in mid) == {'dawn': 'ban', 'market': '', 'rail': 'ban', 'site': '', 'night': ''} and r == ['market', 'match', 'ranked', True, True, True, True, True], [vis1, mid, r])
        # 6 打完：段位分變化顯示在結算、定級進度 +1、最近變化有一筆
        r = await ev("""() => { const s = window.__strike; s.ROUND.phase = 'live'; s.ROUND.score.A = 6; s.ROUND.score.B = 2; s.endRound('A', '測試', 'elim');
          for (let i = 0; i < 60 * 6 && s.game.state !== 'over'; i++) s.step(1/60);
          const R = s.RKS(); return [s.game.state, R.placed, R.played, R.wins, R.hist.length, R.rating > 1000, !document.getElementById('overR').hidden, document.getElementById('overR').textContent]; }""")
        ok('6 段位賽打完：結算顯示「定級賽 1/5」、分數加了、紀錄一筆', r[0] == 'over' and r[1:5] == [1, 1, 1, 1] and r[5] and r[6] and '定級賽 1 / 5' in r[7], r)
        # 7 中途離開：算輸、多扣 10 分；不能「重來」
        r = await ev("""() => { const s = window.__strike, R = s.RKS(); s.startRanked('market'); const before = R.rating;
          s.pauseGame && s.pauseGame(); const noRe = document.getElementById('bRespawn').hidden;
          s.backToMenu(); return [before, R.rating, R.hist[0].ab, R.hist[0].win, R.played, noRe, s.RK.live]; }""")
        ok('7 段位賽中途離開＝輸、多扣分（紀錄標「中途離開」）、暫停畫面沒有「重來」', r[1] < r[0] - 10 and r[2] is True and r[3] is False and r[4] == 2 and r[5] is True and r[6] is False, r)
        # 8 定級完成：第 5 場打完顯示段位、成就「定級完成」；之後升階會顯示
        r = await ev("""() => { const s = window.__strike, R = s.RKS(); R.placed = 4; s.RK.live = true; s.RK.opp = R.rating; s.game.sub = 'ranked';
          const L = s.rankApply(true, 5); const ach = !!s.P().ach.placed; R.rating = 1095; s.RK.live = true; s.RK.opp = 1300; const L2 = s.rankApply(true, 7); s.game.sub = '';
          return [L.placedNow, R.placed, ach, L2.up, L2.tier, L2.after >= 1100]; }""")
        ok('8 第 5 場定級完成（成就）；之後跨過 1100 分顯示「升階！下士」', r == [True, 5, True, True, '下士', True], r)
        # 9 2 對 2：你＋1 對 2、只有一個包點能裝、出生在包點附近、回合 1:30 先贏 6
        r = await ev("""() => { const s = window.__strike; s.startGame('wingman'); const S = s.SITES[s.WING.site], other = s.WING.site === 'A' ? 'B' : 'A', O = s.SITES[other];
          const act = s.bots.filter((b) => b.active), A = act.filter((b) => b.team === 'A').length, B = act.filter((b) => b.team === 'B').length;
          const p = s.player.body.pos, dStage = Math.hypot(p.x - S.stage[0], p.z - S.stage[1]);
          const defs = act.filter((b) => b.team !== s.ROUND.atk), dDef = Math.max(...defs.map((b) => Math.hypot(b.phys.pos.x - S.cx, b.phys.pos.z - S.cz)));
          return [A, B, s.ROUND.winTo, s.ROUND.length, s.ROUND.plan.site === s.WING.site, defs.every((b) => b.post === s.WING.site), s.siteAt(S.cx, 0.1, S.cz), s.siteAt(O.cx, 0.1, O.cz), +dStage.toFixed(1), +dDef.toFixed(1)]; }""")
        ok('9 2 對 2：你＋1 對 2、先贏 6、1:30、只有一點能裝、攻方出生在集合點旁、守方在包點', r[0:6] == [1, 2, 6, 90, True, True] and r[6] is not None and r[7] is None and r[8] < 10 and r[9] < 16, r)
        # 10 2 對 2 整場打得完（你不在場）：每回合有勝負、計入 2 對 2 戰績、不算進對戰生涯
        r = await ev("""() => { const s = window.__strike, st = s.STATS(), m0 = st.matches, w0 = st.modes.wingman.n; s.game.freezeBots = false;
          let n = 0; while (s.game.state !== 'over' && n < 60 * 60 * 14) { if (s.player.alive) { s.player.alive = false; s.player.respawnT = Infinity; } s.step(1/60); n++; }
          return [s.game.state, s.ROUND.score.A + ':' + s.ROUND.score.B, s.ROUND.log.length, st.modes.wingman.n - w0, st.matches - m0, Math.round(n / 60 / Math.max(1, s.ROUND.log.length)), s.ROUND.log.map((l) => l.kind).join(',')]; }""")
        ok('10 2 對 2 機器人打完整場、每回合 90 秒內分出勝負、記進 2 對 2 戰績（不算對戰生涯）', r[0] == 'over' and r[3] == 1 and r[4] == 0 and r[2] >= 6 and r[5] < 100, r)
        # 11 軍備競賽：8 人；只有關卡的槍、不能買、子彈無限；殺 2 人升級換槍；機器人升級也換槍
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.startGame('arms'); s.game.freezeBots = true;
          const n = 1 + s.bots.filter((b) => b.active).length, w0 = s.getWP().id, sec = !!s.INV.secondary, buy = s.buyOpen();
          s.armsKill(s.player); const lv1 = s.player.armsLv; s.armsKill(s.player); s.step(1/60); s.step(1/60);
          const b = s.bots.find((x) => x.active); s.armsKill(b); s.armsKill(b);
          s.W.reserve = 0; s.step(1/60); return [n, w0, sec, buy, lv1, s.player.armsLv, s.getWP().id, b.armsLv, b.primary.id, s.W.reserve > 0]; }""")
        ok('11 軍備競賽：8 人、開局只有步槍、不能買、殺 2 人換卡賓槍（機器人也一樣）、子彈無限', r == [8, 'rifle', False, False, 0, 1, 'carbine', 1, 'carbine', True], r)
        # 12 最後一關黃金手槍；用它擊殺就贏 → 冠軍、記戰績、成就
        r = await ev("""() => { const s = window.__strike, st = s.STATS(); s.player.armsLv = 6; s.player.armsK = 1; s.armsKill(s.player); s.step(1/60); s.step(1/60);
          const final = [s.player.armsLv, s.getWP().id, '#' + s.VM_TINT.poly.getHexString()];
          s.armsKill(s.player); for (let i = 0; i < 5; i++) s.step(1/60);
          return [final, s.game.state, document.getElementById('overT').textContent, st.modes.arms.n, st.modes.arms.w, !!s.P().ach.arms_win, st.modes.arms.best > 0]; }""")
        ok('12 第 8 關拿黃金手槍、用它擊殺就奪冠（戰績、最快時間、成就「軍火大師」）', r[0] == [7, 'pistol', '#f0c858'] and r[1] == 'over' and r[2] == '冠軍' and r[3:] == [1, 1, True, True], r)
        # 13 離開後槍的顏色恢復；選單有新按鈕；戰績頁顯示段位、2 對 2、軍備競賽
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); const tint = '#' + s.VM_TINT.poly.getHexString(); s.renderStats(); const t = document.getElementById('statBody').textContent;
          return [tint !== '#f0c858', ['bRanked', 'bWing', 'bArms'].every((id) => document.getElementById(id)), t.includes('段位賽'), t.includes('2 對 2'), t.includes('軍備競賽')]; }""")
        ok('13 離開軍備競賽槍色恢復；選單有段位賽、2 對 2、軍備競賽；戰績頁有三項紀錄', all(r), r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
