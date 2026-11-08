"""M8 武器：卡賓槍、重手槍、護甲耐久、燃燒彈（傷害、擋路、被煙悶熄）、掉槍撿槍丟槍、丟炸彈。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        cdp = await page.context.new_cdp_session(page)
        async def touch(kind, pts):
            await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in pts]})
        sim = lambda t: ev(SIM, t)
        await page.click('#bStart')
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.game.freezeBots = true; }")
        # 1 新槍數值
        r = await ev("""() => { const s = window.__strike, W = s.WEAPONS, b = s.bots[0]; b.vest = b.helmet = true; b.armor = 100;
          const dh = s.hitDamage(W.deagle, 'head', 10, b); b.armor = 100; b.vest = b.helmet = true; const db = s.hitDamage(W.deagle, 'body', 10, b);
          b.armor = 100; b.vest = b.helmet = true; const cb = s.hitDamage(W.carbine, 'body', 10, b); b.armor = 100; const rb = s.hitDamage(W.rifle, 'body', 10, b);
          return [Math.round(dh), Math.round(db), +cb.toFixed(1), +rb.toFixed(1), W.carbine.rate < W.rifle.rate, W.carbine.price, W.deagle.price]; }""")
        ok('1 重手槍爆頭戴頭盔一發倒、身體兩發；卡賓槍傷害比步槍低、射速快', r[0] >= 100 and 45 < r[1] < 100 and r[2] < r[3] and r[4], r)
        # 2 護甲耐久：一直打身體，護甲越來越少，打爛之後沒有保護
        r = await ev("""() => { const s = window.__strike, W = s.WEAPONS, b = s.bots[1]; b.vest = b.helmet = true; b.armor = 100; const out = [];
          for (let k = 0; k < 14; k++) { const d = s.hitDamage(W.rifle, 'body', 10, b); out.push([Math.round(b.armor), +d.toFixed(1)]); }
          return [out[0], out[6], out[13], b.vest, b.helmet]; }""")
        ok('2 護甲會被打掉：每發扣耐久，扣完頭盔跟著沒、傷害恢復原本', r[0][0] < 100 and r[2][0] == 0 and r[3] is False and r[2][1] > r[0][1], r)
        # 2b 你的護甲顯示在血量旁
        r = await ev("""() => { const s = window.__strike; s.INV.vest = s.INV.helmet = true; s.INV.armor = 100; s.step(1/60); const a = document.getElementById('ar');
          const before = [a.hidden, document.getElementById('arN').textContent]; s.wearArmor(s.player, 30); s.step(1/60); return before.concat([document.getElementById('arN').textContent]); }""")
        ok('2b 你的護甲數字顯示在血量旁、會跟著扣', r[0] is False and r[1] == '100' and r[2] == '70', r)
        # 3 燃燒彈：丟在機器人腳下 → 燒到；兩秒約 80 傷害
        r = await ev("""() => { const s = window.__strike, b = s.bots[2]; s.player.body.pos.set(-30, 0, 20); b.phys.pos.set(-20, 0, 20); b.hp = 100; b.alive = true; b.vest = false;
          const V = b.phys.pos.constructor; s.throwNade('molotov', new V(-20.5, 1.4, 20), new V(0.05, -1, 0).normalize(), s.player, null);
          for (let i = 0; i < 30; i++) s.step(1/60); const f1 = s.FIRES.length; for (let i = 0; i < 120; i++) s.step(1/60);
          return [f1, Math.round(b.hp), b.alive]; }""")
        ok('3 燃燒彈落地起火、站在火裡兩秒受到約 80 傷害', r[0] == 1 and r[1] <= 35, r)
        # 4 煙會把火蓋熄；燃燒彈丟進煙裡直接熄
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor; for (let i = 0; i < 60 * 8; i++) s.step(1/60); const n0 = s.FIRES.length;
          s.throwNade('molotov', new V(0, 1.4, -30), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 30; i++) s.step(1/60); const n1 = s.FIRES.length;
          s.throwNade('smoke', new V(0, 1.4, -30), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 60 * 3; i++) s.step(1/60); const n2 = s.FIRES.length;
          s.throwNade('molotov', new V(0, 1.4, -30), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 30; i++) s.step(1/60); const n3 = s.FIRES.length;
          return [n0, n1, n2, n3]; }""")
        ok('4 煙丟到火上會熄、燃燒彈丟進煙裡不會起火', r == [0, 1, 0, 0], r)
        # 5 火擋路：機器人要走過火，會停在火前面；火熄了才過去
        r = await ev("""() => { const s = window.__strike, V = s.player.body.pos.constructor; s.clearNades(); s.game.freezeBots = false;
          s.player.body.pos.set(-34, 0, 24); for (const o of s.bots) if (o !== s.bots[0]) { o.alive = false; o.g.visible = false; }
          const b = s.bots[0]; b.alive = true; b.hp = 100; b.blindT = 999; b.phys.pos.set(-10, 0, -24); b.state = 'patrol'; b.waitT = 0; b.path = [[10, -24, 0]]; b.pi = 0;
          s.throwNade('molotov', new V(0, 1.4, -24), new V(0.01, -1, 0).normalize(), s.player, null); for (let i = 0; i < 20; i++) s.step(1/60);
          let minD = 99; for (let i = 0; i < 60 * 4; i++) { s.step(1/60); b.waitT = 0; if (!b.path) { b.path = [[10, -24, 0]]; b.pi = 0; } minD = Math.min(minD, Math.abs(b.phys.pos.x)); }
          const x4 = b.phys.pos.x; for (let i = 0; i < 60 * 6; i++) { s.step(1/60); b.waitT = 0; if (!b.path || b.pi >= b.path.length) { b.path = [[10, -24, 0]]; b.pi = 0; } }
          return [+minD.toFixed(1), +x4.toFixed(1), +b.phys.pos.x.toFixed(1), Math.round(b.hp)]; }""")
        ok('5 火擋路：機器人停在火外、沒受傷；火熄了繼續走', r[0] > 2.5 and r[1] < -2.5 and r[2] > 5 and r[3] == 100, r)
        # 6 陣亡掉槍、空格自動撿
        r = await ev("""() => { const s = window.__strike; s.game.freezeBots = true; s.clearNades(); const b = s.bots[1]; b.alive = true; b.hp = 100; b.primary = s.WEAPONS.carbine; s.botArm(b);
          b.phys.pos.set(-20, 0, 10); s.damageBot(b, 200, 'body', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle);
          const n1 = s.DROPS.length, def = s.DROPS[0] && s.DROPS[0].def.id;
          s.INV.primary = null; s.equip('secondary', true); s.player.body.pos.set(s.DROPS[0].pos.x, 0, s.DROPS[0].pos.z); s.step(1/60);
          return [n1, def, s.INV.primary && s.INV.primary.def.id, s.DROPS.length, s.INV.cur]; }""")
        ok('6 機器人陣亡掉槍；你主武器空著走過去自動撿', r == [1, 'carbine', 'carbine', 0, 'primary'], r)
        # 7 按住換槍鍵丟槍；有槍時按「撿起」交換
        b = await page.locator('#bSwap').bounding_box(); x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        await touch('touchStart', [(1, x, y)]); await asyncio.sleep(0.8); await touch('touchEnd', [])
        r1 = await ev("() => { const s = window.__strike; return [s.INV.primary, s.DROPS.length, s.DROPS[0] && s.DROPS[0].def.id]; }")
        await touch('touchStart', [(1, x, y)]); await touch('touchEnd', [])
        r2 = await ev("""() => { const s = window.__strike; s.giveWeapon(s.WEAPONS.rifle, true); const d = s.DROPS[0]; s.player.body.pos.set(d.pos.x + 0.5, 0, d.pos.z); s.step(1/60);
          const act = s.useAction(), lbl = document.getElementById('bUse').textContent; s.INPUT.use = true; s.step(1/60); s.INPUT.use = false;
          return [act, lbl, s.INV.primary.def.id, s.DROPS.map((x) => x.def.id)]; }""")
        ok('7 按住換槍鍵丟槍、有槍時按「撿起」交換（舊的留在地上）', r1[0] is None and r1[1] == 1 and r1[2] == 'carbine' and r2[0] == 'pickup' and r2[2] == 'carbine' and r2[3] == ['rifle'], [r1, r2])
        # 8 對戰：沒錢的機器人去撿地上的槍；丟炸彈；買卡賓槍、重手槍、燃燒彈
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = false; R.phase = 'live'; R.t = 100; R.liveT = 5;
          const b = s.bots.find((x) => x.active && x.team === 'B'); b.primary = null; s.botArm(b); b.blindT = 999;
          for (const o of s.bots) if (o !== b && o.team !== 'B') { o.alive = false; o.g.visible = false; }
          s.player.alive = false; const p = b.phys.pos; s.spawnDrop(s.WEAPONS.rifle, 30, 90, p.x + 6, p.y, p.z + 2);
          for (let i = 0; i < 60 * 6; i++) s.step(1/60); const got = s.bots.filter((x) => x.active && x.primary === s.WEAPONS.rifle); return [got.length ? 'rifle' : null, s.DROPS.length]; }""")
        ok('8a 對戰：沒有主武器的機器人會去撿地上的槍', r == ['rifle', 0], r)
        r = await ev("""() => { const s = window.__strike, R = s.ROUND; s.startGame('match'); s.game.freezeBots = true; for (let i = 0; i < 30; i++) s.step(1/60);
          s.player.money = 5000; const out = [s.buyItem('carbine'), s.buyItem('deagle'), s.buyItem('molotov'), s.INV.primary.def.id, s.INV.secondary.def.id, s.INV.molotov, s.player.money];
          if (!s.INV.bomb) { s.giveBomb(s.player); } const had = s.INV.bomb; s.playerDropBomb(); return out.concat([had, s.INV.bomb, s.BOMB.state]); }""")
        ok('8b 買得到卡賓槍、重手槍、燃燒彈；攻方可以丟下炸彈', r[:7] == [True, True, True, 'carbine', 'deagle', 1, 5000 - 2700 - 700 - 500] and r[7] and not r[8] and r[9] == 'dropped', r)
        await page.screenshot(path=str(OUT / 'm8a.png'))
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
