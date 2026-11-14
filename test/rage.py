"""狂暴模式：開始、子彈無限不用換彈、一波一波出敵人（越來越多越強）、擊殺有聖光＋連殺＋回血、連殺 8 進狂暴（傷害 2 倍、受傷減半）、3 條命用完結束、紀錄寫進戰績。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; window.__sfxLog = []; }")
        # 1 從選單按「狂暴模式」
        await ev("() => document.getElementById('bRage').click()")
        opt = await ev("() => [!document.getElementById('rageOpt').hidden, document.getElementById('rageGoN').hidden]")
        await ev("() => document.getElementById('rageGo1').click()")
        r = await ev("""() => { const s = window.__strike; for (let i = 0; i < 60 * 4; i++) s.step(1/60);
          const act = s.bots.filter((b) => b.active), alive = act.filter((b) => b.alive);
          return [s.game.mode, s.game.state, s.RAGE.wave, s.RAGE.lives, act.length, alive.length, alive.every((b) => b.team === 'B'), document.getElementById('scB').textContent]; }""")
        ok('1 按狂暴模式先出現選項（沒玩過就沒有「繼續」），開始後 3 條命、第 1 波敵人上場', opt == [True, True] and r[0] == 'rage' and r[1] == 'play' and r[2] == 1 and r[3] == 3 and r[4] >= 18 and r[5] >= 4 and r[6] and r[7] == '1', r)
        # 2 子彈無限：一直開火，彈匣不會少、不會換彈
        r = await ev("""() => { const s = window.__strike; s.game.freezeBots = true; s.player.pitch = -1.2; s.INPUT.fire = true; for (let i = 0; i < 120; i++) s.step(1/60); s.INPUT.fire = false;
          return [s.W.shots, s.W.ammo, s.W.reloadT]; }""")
        ok('2 子彈無限：連射 2 秒，彈匣還是滿的、不用換彈', r[0] > 10 and r[1] == 30 and r[2] == 0, r)
        # 3 擊殺：聖光、連殺、回血、這波剩下的人數減少
        kill = """(n) => { const s = window.__strike; let k = 0; for (const b of s.bots) { if (k >= n) break; if (b.active && b.alive && b.team === 'B') { s.damageBot(b, 9999, 'head', null, s.player); k++; } } return k; }"""
        r = await ev("""(kill) => { const s = window.__strike; s.player.hp = 40; const left0 = s.RAGE.left; const n = eval(kill)(2); s.step(1/60);
          const c = document.getElementById('rageCombo'); return [n, s.RAGE.combo, !c.hidden, c.textContent, Math.round(s.player.hp), left0 - s.RAGE.left]; }""", kill)
        ok('3 擊殺：連殺計數出現、每殺一個回血、這波剩餘人數減少', r[0] == 2 and r[1] == 2 and r[2] and '2' in r[3] and r[4] >= 70 and r[5] == 2, r)
        # 4 連殺 8 → 狂暴：傷害 2 倍、受傷減半、畫面金光
        r = await ev("""(kill) => { const s = window.__strike; s.game.freezeBots = true; let n = 0, guard = 0;
          while (s.RAGE.combo < 8 && guard++ < 400) { n += eval(kill)(1); s.step(1/30); }
          const fr = s.RAGE.frenzy, cls = document.body.classList.contains('frenzy');
          let b = null; for (let i = 0; i < 120 && !b; i++) { s.step(1/30); b = s.bots.find((x) => x.active && x.alive && x.team === 'B'); } let dealt = null; if (b) { const h0 = b.hp; s.damageBot(b, 10, 'body', null, s.player); dealt = h0 - b.hp; }
          s.player.hp = 100; const e = s.bots.find((x) => x.active && x.team === 'B'); s.damagePlayer(20, e, 'body', s.WEAPONS.rifle); const taken = 100 - s.player.hp;
          return [s.RAGE.combo, fr > 7, cls, dealt, taken]; }""", kill)
        ok('4 連殺 8 次進入狂暴：傷害 2 倍、受傷大減、畫面金光', r[0] >= 8 and r[1] and r[2] and r[3] == 20 and r[4] == 7, r)
        # 5 清完一波 → 休息 → 第 2 波人更多、血更厚、打得更痛
        r = await ev("""(kill) => { const s = window.__strike; s.game.freezeBots = false; const t1 = s.RAGE.total, d1 = s.RAGE.diff.dmg; let guard = 0;
          while (s.RAGE.wave === 1 && guard++ < 2000) { eval(kill)(13); for (let i = 0; i < 6; i++) { s.player.hp = 100; s.step(1/30); } }
          for (let i = 0; i < 60; i++) s.step(1/30);
          const b = s.bots.find((x) => x.active && x.alive && x.team === 'B' && !x.rageKind);
          return [s.RAGE.wave, t1, s.RAGE.total, d1, s.RAGE.diff.dmg, b ? Math.round(b.hp) : null]; }""", kill)
        ok('5 清完一波進下一波：人數更多、血更厚、傷害更高', r[0] == 2 and r[2] > r[1] and r[4] > r[3] and r[5] and r[5] > 100, r)
        await page.screenshot(path=str(OUT / 'rage_play.png'))
        # 6 第 5 波有魔王（血很厚）
        r = await ev("""(kill) => { const s = window.__strike; let guard = 0, boss = null;
          while (s.RAGE.wave < 5 && guard++ < 6000) { eval(kill)(13); for (let i = 0; i < 6; i++) { s.player.hp = 100; s.step(1/30); } }
          for (let k = 0; k < 900 && !boss; k++) { s.player.hp = 100; s.step(1/30); boss = s.bots.find((b) => b.active && b.alive && b.rageKind === 'boss'); if (!boss && k % 3 === 0) eval(kill)(1); }
          return [s.RAGE.wave, boss ? boss.name : null, boss ? Math.round(boss.hp) : 0]; }""", kill)
        ok('6 第 5 波出現魔王（名字有「魔王」、血量是一般的 8 倍）', r[0] == 5 and r[1] and r[1].startswith('魔王') and r[2] > 1000, r)
        # 7 3 條命用完 → 結算畫面、紀錄寫進戰績
        r = await ev("""async () => { const s = window.__strike; const e = s.bots.find((x) => x.active && x.team === 'B');
          for (let life = 0; life < 3; life++) { for (let i = 0; i < 60 * 4 && !s.player.alive; i++) s.step(1/30); s.player.spawnT = 0; s.RAGE.frenzy = 0; s.damagePlayer(999, e, 'head', s.WEAPONS.rifle); s.step(1/60); }
          for (let i = 0; i < 120; i++) s.step(1/30);
          return [s.game.state, document.getElementById('overT').textContent, document.getElementById('overS').textContent, s.STATS().modes.rage.bestWave, s.STATS().modes.rage.n, s.RAGE.lives, s.player.alive, s.RAGE.overT, s.player.respawnT]; }""")
        await page.screenshot(path=str(OUT / 'rage_over.png'))
        ok('7 三條命用完就結束：顯示撐到第幾波、紀錄寫進戰績', r[0] == 'over' and '第 5 波' in r[2] and r[3] == 5 and r[4] == 1, r)
        # 9 結算有「從第 5 波繼續」：按了從第 5 波開打、3 條命；這場不算紀錄
        r = await ev("""() => { const s = window.__strike; const b = document.getElementById('bRageCont'); const t = b.hidden ? '' : b.textContent; b.click();
          for (let i = 0; i < 60 * 4; i++) { s.player.hp = 100; s.step(1/60); } return [t, s.RAGE.wave, s.RAGE.lives, s.RAGE.startWave]; }""")
        ok('9 死了可以從同一波繼續（不用從第 1 波重來）', r[0] == '從第 5 波繼續' and r[1] == 5 and r[2] == 3 and r[3] == 5, r)
        # 10 中途回選單：下次選單裡有「從第 5 波繼續」；無敵：被打不扣血、不會死
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); document.getElementById('bRage').click();
          const n = document.getElementById('rageGoN'), t = n.hidden ? '' : n.textContent;
          document.querySelector('#rageGodSeg [data-g="1"]').click(); n.click(); for (let i = 0; i < 60 * 4; i++) s.step(1/60);
          const e = s.bots.find((x) => x.active && x.team === 'B'); for (let k = 0; k < 5; k++) s.damagePlayer(80, e, 'head', s.WEAPONS.rifle);
          for (let i = 0; i < 30; i++) s.step(1/60); const res = [t, s.RAGE.god, s.player.alive, Math.round(s.player.hp), document.getElementById('pipsA').textContent, s.RAGE.wave];
          s.S.rageGod = false; return res; }""")
        ok('10 中途離開下次可以接著打；無敵模式被打不扣血、不會死', r[0] == '從第 5 波繼續' and r[1] is True and r[2] is True and r[3] == 100 and r[4] == '無敵' and r[5] == 5, r)
        # 8 回選單再打別的模式：狂暴專用的敵人不會跑出來
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.startGame('match'); for (let i = 0; i < 5; i++) s.step(1/60);
          return [s.bots.filter((b) => b.active).length, s.bots.filter((b) => b.rageOnly && b.active).length, document.body.classList.contains('frenzy')]; }""")
        ok('8 回到對戰：只有原本 9 個機器人、沒有狂暴的金光', r == [9, 0, False], r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
