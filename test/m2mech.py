"""M2 機制測試：各武器傷害、護甲、經濟獎金、購買限制、裝彈拆彈、炸彈爆炸、投擲物效果、換邊。"""
import asyncio
from harness import *

JS = """
window.T = {
  s: window.__strike,
  run(secs, fn) { for (let i = 0; i < Math.round(secs*60); i++) { if (fn) fn(i); this.s.step(1/60); } },
  at(x, z, yaw = -Math.PI/2, pitch = 0) { const p = this.s.player; p.body.pos.set(x, 0, z); p.body.vel.set(0,0,0); p.yaw = yaw; p.pitch = pitch; p.body.onGround = true; },
  aimAt(x, y, z) { const p = this.s.player, e = p.body.pos; const dx = x - e.x, dy = y - (e.y + p.eye), dz = z - e.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  park() { for (const b of this.s.bots) { b.phys.pos.set(34, 0, 24 - b.i * 0.9); b.state = 'patrol'; b.waitT = 99; b.path = null; } },
  bot(i, x, z, o = {}) { const b = this.s.bots[i]; b.alive = true; b.hp = 100; b.phys.pos.set(x, 0, z); b.yaw = Math.PI / 2; b.phys.h = 1.8; b.phys.crouched = false;
    b.vest = o.vest !== undefined ? o.vest : true; b.helmet = o.helmet !== undefined ? o.helmet : true; b.state = 'patrol'; b.waitT = 99;
    const f = this.s.game.freezeBots; this.s.game.freezeBots = false; this.s.step(0); this.s.game.freezeBots = f; return b; },
  // 站定、不散佈地開一槍打某個部位
  shootAt(w, b, part) { const s = this.s; s.giveWeapon(s.WEAPONS[w]); s.W.deployT = 0; s.W.cd = 0; s.W.bloom = 0; s.W.idx = 0; s.W.rp = s.W.ry = 0; s.player.adsT = w === 'sniper' ? 1 : 0; s.player.ads = w === 'sniper';
    const y = part === 'head' ? 1.68 : part === 'legs' ? 0.5 : 1.15; this.aimAt(b.phys.pos.x, y, b.phys.pos.z);
    const sp = s.W.spread; s.INPUT.fire = true; s.step(1/60); s.INPUT.fire = false; return b.hp; },
};
"""

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.evaluate("() => { window.__strike.game.manual = true; window.__strike.startGame(); }")
        await page.add_script_tag(content=JS)
        res = {}
        async def ev(js): return await page.evaluate(js)
        ok = lambda name, cond, info='': res.__setitem__(name, ('PASS' if cond else 'FAIL') + (' ' + str(info) if info else ''))
        await ev("() => { T.s.game.freezeBots = true; T.park(); T.s.S.autoFire = false; T.s.step(0); }")

        # 1 各武器：10 公尺、站定
        r = await ev("""() => { T.at(-30, 0); const o = {};
          for (const [w, part, vest, helm] of [['rifle','body',1,1],['rifle','head',1,1],['pistol','head',0,0],['pistol','head',1,1],['sniper','body',1,1],['smg','body',1,1],['shotgun','body',1,1]]) {
            const b = T.bot(0, -20, 0, { vest: !!vest, helmet: !!helm }); T.shootAt(w, b, part); o[w + '_' + part + (helm ? '_h' : '')] = Math.round(100 - Math.max(0, b.hp)) + (b.alive ? '' : ' 倒'); }
          return o; }""")
        ok('1a 步槍打身體（有甲）約 28', r['rifle_body_h'].startswith('2'), r)
        ok('1b 步槍爆頭（有頭盔）一發倒', '倒' in r['rifle_head_h'], r['rifle_head_h'])
        ok('1c 手槍爆頭（沒頭盔）一發倒', '倒' in r['pistol_head'], r['pistol_head'])
        ok('1d 手槍爆頭（有頭盔）不會一發倒', '倒' not in r['pistol_head_h'], r['pistol_head_h'])
        ok('1e 狙擊槍開鏡打身體一發倒', '倒' in r['sniper_body_h'], r['sniper_body_h'])
        ok('1f 霰彈槍 10 公尺打身體有傷害', int(r['shotgun_body_h'].split()[0]) > 20, r['shotgun_body_h'])
        # 2 霰彈槍近距離一發倒、遠距離打不死
        r = await ev("""() => { T.at(-30, 0); let b = T.bot(0, -27, 0); T.shootAt('shotgun', b, 'body'); const near = b.alive; b = T.bot(0, -5, 0); T.shootAt('shotgun', b, 'body'); return [near, b.alive, Math.round(100 - b.hp)]; }""")
        ok('2 霰彈槍：3 公尺一發倒、25 公尺不會', r[0] is False and r[1] is True, r)
        # 3 狙擊槍沒開鏡很散
        r = await ev("""() => { const s = T.s; s.giveWeapon(s.WEAPONS.sniper); s.player.ads = false; s.player.adsT = 0; s.step(1/60); const a = s.W.spread; s.player.ads = true; s.player.adsT = 1; s.step(1/60); return [a, s.W.spread]; }""")
        ok('3 狙擊槍：沒開鏡散佈大、開鏡幾乎不散', r[0] > 5 and r[1] < 0.3, r)
        # 4 換槍、彈藥各自保存
        r = await ev("""() => { const s = T.s; s.giveWeapon(s.WEAPONS.rifle); s.W.ammo = 7; s.equip('secondary'); const p = s.W.ammo; s.equip('primary'); return [p, s.W.ammo, s.INV.cur]; }""")
        ok('4 換槍：每把子彈分開記', r[1] == 7 and r[0] != 7 and r[2] == 'primary', r)

        # ---------- 對戰模式 ----------
        await ev("() => { const s = T.s; s.startGame('match'); s.game.freezeBots = true; T.park(); s.ROUND.t = 0.01; T.run(0.05); }")
        # 5 購買：開打後 20 秒外不能買；錢扣對
        r = await ev("""() => { const s = T.s, R = s.ROUND; const m0 = s.player.money; R.phase = 'freeze'; const ok1 = s.buyItem('vest'); const m1 = s.player.money;
          R.phase = 'live'; R.t = R.length - 30; const ok2 = s.buyItem('flash'); return [m0, ok1, m1, ok2]; }""")
        ok('5 購買：準備時間能買、扣 650；開打 30 秒後不能買', r == [800, True, 150, False], r)
        # 6 擊殺獎金：衝鋒槍 600
        r = await ev("""() => { const s = T.s; s.player.money = 0; s.giveWeapon(s.WEAPONS.smg); s.W.deployT = 0; T.at(-30, 0); const b = s.bots.find((x) => x.team === 'B'); T.bot(b.i, -27, 0, { vest: false, helmet: false });
          for (let k = 0; k < 8 && b.alive; k++) { s.W.cd = 0; T.aimAt(-27, 1.68, 0); s.INPUT.fire = true; s.step(1/60); s.INPUT.fire = false; }
          return [b.alive, s.player.money]; }""")
        ok('6 衝鋒槍擊殺 +$600', r == [False, 600], r)
        # 7 你裝彈、拆彈（守方、有拆彈器 5 秒）
        r = await ev("""() => { const s = T.s, R = s.ROUND; R.phase = 'live'; R.t = 60;
          for (const b of s.bots) if (b.active) { b.alive = true; b.hp = 100; } s.player.alive = true; s.player.hp = 100;
          s.giveBomb(s.player); T.at(20.8, 19.5); s.step(1/60); const act = s.useAction();
          s.INPUT.use = true; T.run(1.0); const mid = s.BOMB.state; T.run(2.4); s.INPUT.use = false; const st = s.BOMB.state, site = s.BOMB.site, t0 = s.BOMB.t;
          return [act, mid, st, site, Math.round(t0)]; }""")
        ok('7a 帶炸彈在包點：可以裝彈，3.2 秒後裝好', r[0] == 'plant' and r[1] == 'carried' and r[2] == 'planted' and r[3] == 'A', r)
        r = await ev("""() => { const s = T.s, R = s.ROUND; R.atk = 'B'; s.INV.kit = true; T.at(s.BOMB.pos.x + 0.6, s.BOMB.pos.z); s.step(1/60); const act = s.useAction(); const a0 = s.ROUND.score.A;
          s.INPUT.use = true; T.run(4.0); const mid = s.BOMB.state; T.run(1.2); s.INPUT.use = false; return [act, mid, s.BOMB.state, s.ROUND.score.A - a0, s.ROUND.phase]; }""")
        ok('7b 守方有拆彈器：5 秒拆掉、守方得分', r[0] == 'defuse' and r[1] == 'planted' and r[2] == 'defused' and r[3] == 1 and r[4] == 'end', r)
        # 8 炸彈爆炸：附近的人死、攻方贏、獎金 3500
        r = await ev("""() => { const s = T.s, R = s.ROUND; T.run(5.5); R.phase = 'live'; R.atk = 'A'; s.BOMB.state = 'none';
          s.player.alive = true; const b = s.bots.find((x) => x.team === 'B'); T.bot(b.i, 22, 20); s.player.money = 0;
          const pl = s.bots.find((x) => x.team === 'A'); pl.alive = true; s.giveBomb(pl); pl.phys.pos.set(20.8, 0, 19.5); s.plantBomb(pl); T.at(-30, 0);
          const sa = R.score.A; s.BOMB.t = 0.05; T.run(0.2); return [b.alive, R.score.A - sa, s.player.money, R.log[R.log.length - 1].kind]; }""")
        ok('8 炸彈爆炸：旁邊的敵人死、攻方得分、勝方 +3500', r[0] is False and r[1] == 1 and r[2] == 3500 and r[3] == 'bomb', r)
        # 9 手榴彈、閃光彈、煙
        r = await ev("""() => { const s = T.s; T.run(5.5); s.ROUND.phase = 'live'; s.ROUND.t = 60; s.game.freezeBots = true; T.park(); T.at(-30, 0);
          const b = s.bots.find((x) => x.team === 'B'); T.bot(b.i, -24, 0, { vest: false }); const V = s.player.body.pos.constructor;
          s.throwNade('he', new V(-24.5, 0.3, 0.5), new V(0, -1, 0), s.player, null); T.run(1.8); const heDmg = Math.round(100 - b.hp);
          T.bot(b.i, -24, 0); b.yaw = -Math.PI / 2; s.throwNade('flash', new V(-21, 1.6, 0), new V(0, -1, 0), s.player, null); T.run(1.6); const blind = b.blindT;
          s.throwNade('smoke', new V(-27, 0.3, 0), new V(0, -1, 0), s.player, null); T.run(3.0);
          const see1 = s.player.alive; return [heDmg, +blind.toFixed(1), s.SMOKES.length]; }""")
        ok('9a 手榴彈：腳邊爆炸傷害大', r[0] > 50, str(r[0]))
        ok('9b 閃光彈：正對的機器人看不見 2 秒以上', r[1] > 2, r[1])
        ok('9c 煙霧彈：會冒煙', r[2] == 1, r[2])
        r = await ev("""() => { const s = T.s, V = s.player.body.pos.constructor, sm = s.SMOKES[0], b2 = s.bots.find((x) => x.team === 'B');
          T.bot(b2.i, sm.x + 6, sm.z); b2.yaw = Math.PI / 2; b2.state = 'patrol'; b2.target = null; b2.blindT = 0; T.at(sm.x - 6, sm.z, -Math.PI / 2);
          s.game.freezeBots = false; T.run(0.5); const through = b2.visible; T.at(sm.x - 6, sm.z + 7, -Math.PI / 2); T.bot(b2.i, sm.x + 6, sm.z + 7); b2.yaw = Math.PI / 2; b2.state = 'patrol'; T.run(0.5);
          s.game.freezeBots = true; return [through, b2.visible]; }""")
        ok('9d 煙擋住視線：隔著煙看不到、旁邊看得到', r == [False, True], r)
        # 10 換邊：第 6 回合後攻守互換、錢回到 800
        r = await ev("""() => { const s = T.s, R = s.ROUND; T.run(0.1); R.num = 6; R.phase = 'live'; const atk0 = R.atk; s.endRound(atk0, '測試', 'elim'); T.run(5.2);
          return [atk0, R.atk, R.num, s.player.money, s.bots.filter((b) => b.active).every((b) => b.money <= 800)]; }""")
        ok('10 第 6 回合後換邊、錢回到 800（機器人買完 ≤800）', r[0] != r[1] and r[2] == 7 and r[3] == 800 and r[4], r)

        await page.screenshot(path=str(OUT / 'm2mech.png'))
        for k, v in res.items(): print(v.split(' ')[0], k, ' '.join(v.split(' ')[1:]))
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
