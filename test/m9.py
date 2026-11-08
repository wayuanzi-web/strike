"""M9 成長與留存：經驗與等級、成就、每日挑戰、外觀、擊殺鏡頭、回合 MVP、匯出匯入（換一個乾淨的瀏覽器匯入，內容一致）。"""
import asyncio, json
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        await ev("() => { try { localStorage.clear(); } catch (e) {} }")
        await page.reload(); await page.wait_for_function('window.__strike', timeout=30000)
        await ev("() => { window.__strike.game.manual = true; }")
        # 1 等級公式
        r = await ev("() => { const s = window.__strike; return [s.levelOf(0), s.levelOf(299), s.levelOf(300), s.levelOf(300 + 350), s.levelOf(1e9).lv]; }")
        ok('1 等級：1 級升 2 級要 300 經驗、2 升 3 要 350，最高 30 級', r[0]['lv'] == 1 and r[1]['lv'] == 1 and r[2]['lv'] == 2 and r[3]['lv'] == 3 and r[4] == 30, r)
        # 2 真的打（死鬥；練習的擊殺不算成就）：擊殺給經驗、第一滴血成就、重手槍爆頭成就
        r = await ev("""() => { const s = window.__strike; s.startGame('dm'); s.game.freezeBots = true; const b = s.bots.find((x) => x.active);
          const x0 = s.STATS().prog.xp; s.damageBot(b, 200, 'head', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.deagle);
          return [s.STATS().prog.xp - x0, Object.keys(s.STATS().prog.ach), document.getElementById('toast').hidden, document.getElementById('toast').textContent]; }""")
        ok('2 擊殺給經驗、解鎖「第一滴血」「一槍斃命」、跳出提示', r[0] >= 2 and 'first_kill' in r[1] and 'deagle_head' in r[1] and r[2] is False, r)
        # 3 對戰：一回合殺 3 個 → 一回合三殺；回合 MVP 顯示在橫幅；打完結算有經驗明細
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = true; R.phase = 'live'; R.t = 90;
          const en = s.bots.filter((b) => b.active && b.team === 'B'); for (const b of en.slice(0, 3)) s.damageBot(b, 200, 'body', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle);
          const ach = Object.keys(s.STATS().prog.ach); for (const b of en.slice(3)) s.damageBot(b, 200, 'body', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle);
          const bn = document.getElementById('bnS').textContent; return [ach.includes('round3'), s.ROUND.mvp, bn]; }""")
        ok('3 一回合殺 3 人解鎖成就；回合結束橫幅顯示回合 MVP', r[0] and r[1] and r[1]['me'] and 'MVP' in r[2], r)
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; for (let k = 0; k < 40 && s.game.state !== 'over'; k++) { if (R.phase === 'live') s.endRound('A', '測試', 'elim'); for (let i = 0; i < 330; i++) s.step(1/60); }
          return [s.game.state, s.GAIN.total, document.getElementById('overX').textContent, Object.keys(s.STATS().prog.ach)]; }""")
        await page.screenshot(path=str(OUT / 'm9_over.png'))
        ok('3b 打完一場：結束畫面列出這場的經驗、勝利解鎖「首勝」、兩個手槍局都贏解鎖「手槍之王」', r[0] == 'over' and r[1] > 150 and '經驗' in r[2] and 'first_win' in r[3] and 'pistol2' in r[3], r[:3] + [r[3]])
        # 4 每日挑戰：同一天固定、換一天會換；打到目標完成給 150 經驗
        r = await ev("""() => { const s = window.__strike, P = s.PROG; P.dateOverride = '2026-11-08'; s.STATS().prog.daily = null; const a = s.ensureDaily().items.map((x) => x.id);
          s.STATS().prog.daily = null; const a2 = s.ensureDaily().items.map((x) => x.id); P.dateOverride = '2026-11-09'; const b = s.ensureDaily().items.map((x) => x.id);
          // 換成一定會有「爆頭 8 次」的挑戰來測進度
          s.STATS().prog.daily = { date: '2026-11-09', items: [{ id: 'head', p: 0, done: false }, { id: 'k_smg', p: 0, done: false }, { id: 'dm', p: 0, done: false }] };
          const x0 = s.STATS().prog.xp; s.startGame('dm'); s.game.freezeBots = true;
          for (let k = 0; k < 8; k++) { const t = s.bots.find((x) => x.active && x.alive); t.respawnT = 99; s.damageBot(t, 200, 'head', t.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); if (!s.bots.some((x) => x.active && x.alive)) for (const z of s.bots) if (z.active) { z.alive = true; z.hp = 100; } }
          const it = s.STATS().prog.daily.items; P.dateOverride = null;
          return [a, a2, b, it[0].p, it[0].done, it[1].p, s.STATS().prog.xp - x0]; }""")
        ok('4 每日挑戰：同一天不變、隔天換新；爆頭 8 次完成、衝鋒槍挑戰不會被步槍擊殺算進去、完成給 150', r[0] == r[1] and r[0] != r[2] and len(set(r[0])) == 3 and r[3] == 8 and r[4] and r[5] == 0 and r[6] >= 150, r)
        # 5 外觀：等級不夠不能換；夠了換塗裝會改手上的槍的顏色；隊友外框色改隊友的光
        r = await ev("""() => { const s = window.__strike, P = s.STATS().prog; const lv = s.levelOf(P.xp).lv; const locked = s.equipCosmetic('skin', 'gold');
          P.xp = 1e6; const c0 = s.VM_MATS.poly.color.getHexString(); const okSkin = s.equipCosmetic('skin', 'crimson'); s.startGame('practice'); for (let i = 0; i < 30; i++) s.step(1/60); const c1 = s.VM_MATS.poly.color.getHexString();
          const ally = s.bots.find((b) => b.baseTeam === 'A'), r0 = ally.mat.userData.rimU.value.toArray(); s.equipCosmetic('team', 'gold'); const r1 = ally.mat.userData.rimU.value.toArray();
          return [lv, locked, okSkin, c0, c1, r0, r1]; }""")
        ok('5 外觀：等級不夠換不了；塗裝改手上的槍、隊友外框色改隊友身上的光', r[1] is False and r[2] is True and r[3] != r[4] and r[5] != r[6], r)
        await ev("() => { const s = window.__strike; s.openProg(); }")
        await page.screenshot(path=str(OUT / 'm9_prog.png'))
        await ev("() => { const s = window.__strike; s.closeProg(); }")
        # 6 擊殺鏡頭：練習模式被機器人打死 → 從他的位置看你、播完回到陣亡畫面、照樣重生
        r = await ev("""() => { const s = window.__strike; s.startGame('practice'); s.game.freezeBots = false; s.S.autoFire = false;
          const b = s.bots.find((x) => x.active); for (const o of s.bots) if (o !== b) { o.alive = false; o.g.visible = false; o.respawnT = 999; }
          s.player.body.pos.set(-20, 0, 0); s.player.yaw = Math.PI / 2; b.phys.pos.set(-10, 0, 0); b.alive = true; b.hp = 100; b.blindT = 0;
          for (let i = 0; i < 60 * 3; i++) { s.step(1/60); s.player.hp = 100; }
          let on = false, camD = 99, frames = 0, n = 0; s.damagePlayer(200, b, 'body', b.wpn);
          frames = s.KC.frames ? s.KC.frames.length : 0;
          for (let i = 0; i < 60 * 6; i++) { s.step(1/60); if (s.killcamActive()) { on = true; const f = s.KC.frames[Math.min(s.KC.frames.length - 1, Math.floor(s.KC.t * 30))], kb = f.b[s.bots.indexOf(b)]; camD = Math.min(camD, Math.hypot(s.camera.position.x - kb[0], s.camera.position.z - kb[2])); if (i === 60) s.render(); } if (s.player.alive) break; }
          return [n, frames, on, +camD.toFixed(2), s.KC.on, s.player.alive, document.getElementById('kc').hidden]; }""")
        ok('6 擊殺鏡頭：被打死後從擊殺者的眼睛重播最後 3 秒、播完照樣重生', r[1] >= 60 and r[2] and r[3] < 0.3 and r[4] is False and r[5] and r[6], r)
        # 7 匯出 → 換一個乾淨的瀏覽器匯入 → 戰績、等級、成就、設定都一樣；被改過的代碼會被擋
        await ev("() => { const s = window.__strike; s.S.sens = 1.37; s.S.lefty = true; s.STATS().matches = 3; s.saveStats(); }")
        code = await ev("() => window.__strike.exportCode()")
        before = await ev("() => { const s = window.__strike; return JSON.stringify({ st: s.STATS(), sens: s.S.sens, lefty: s.S.lefty }); }")
        ctx2 = await browser.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
        p2 = await ctx2.new_page(); p2.on('pageerror', lambda e: errors.append('p2 ' + str(e)))
        await p2.goto(page.url); await p2.wait_for_function('window.__strike', timeout=30000)
        fresh = await p2.evaluate("() => window.__strike.STATS().prog.xp")
        await p2.evaluate("() => { window.__strike.game.manual = true; window.__strike.openProg(); }")
        await p2.fill('#pgCode', code[:-3] + ('a' if code[-3] != 'a' else 'b') + code[-2:])
        await p2.click('#pgImport'); bad = await p2.evaluate("() => document.getElementById('pgMsg').textContent")
        await p2.fill('#pgCode', code)
        await p2.click('#pgImport'); m1 = await p2.evaluate("() => document.getElementById('pgMsg').textContent")
        await p2.click('#pgImport'); m2 = await p2.evaluate("() => document.getElementById('pgMsg').textContent")
        after = await p2.evaluate("() => { const s = window.__strike; return JSON.stringify({ st: s.STATS(), sens: s.S.sens, lefty: s.S.lefty }); }")
        await p2.reload(); await p2.wait_for_function('window.__strike', timeout=30000)
        persisted = await p2.evaluate("() => { const s = window.__strike; return JSON.stringify({ st: s.STATS(), sens: s.S.sens, lefty: s.S.lefty }); }")
        await p2.screenshot(path=str(OUT / 'm9_import.png'))
        await ctx2.close()
        ok('7 匯出代碼在乾淨的瀏覽器匯入：內容完全一樣、重新整理還在；改過的代碼被擋、要按兩次才蓋掉', fresh == 0 and '被改過' in bad and '再按一次' in m1 and '完成' in m2 and json.loads(after) == json.loads(before) and json.loads(persisted) == json.loads(before), [fresh, bad, m1[:30], m2, len(code), json.loads(after) == json.loads(before)])
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
