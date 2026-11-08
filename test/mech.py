"""機制測試：碰撞滑牆、樓梯、跳上箱子、蹲、部位倍率、後座力回正、散佈、換彈、機器人開槍、自動開火、瞄準輔助。"""
import asyncio, json, math
from harness import *

JS_HELPERS = """
window.T = {
  s: window.__strike,
  at(x, z, yaw = -Math.PI/2, pitch = 0) { const p = this.s.player; p.body.pos.set(x, 0, z); p.body.vel.set(0,0,0); p.yaw = yaw; p.pitch = pitch; p.body.onGround = true; },
  run(secs, fn) { for (let i = 0; i < Math.round(secs*60); i++) { if (fn) fn(i); this.s.step(1/60); } },
  input(o) { Object.assign(this.s.INPUT, o); },
  aimAt(x, y, z) { const p = this.s.player, e = p.body.pos; const dx = x - e.x, dy = y - (e.y + p.eye), dz = z - e.z;
    p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  bot(i, x, z, yaw = Math.PI/2) { const b = this.s.bots[i]; b.alive = true; b.hp = 100; b.phys.pos.set(x, 0, z); b.yaw = yaw; b.phys.h = 1.8; b.phys.crouched = false; const f = this.s.game.freezeBots; this.s.game.freezeBots = false; this.s.step(0); this.s.game.freezeBots = f; },
};
"""
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        await page.evaluate("() => { window.__strike.game.manual = true; window.__strike.startGame(); }")
        await page.add_script_tag(content=JS_HELPERS)
        res = {}
        async def ev(js): return await page.evaluate(js)
        ok = lambda name, cond, info='': res.__setitem__(name, ('PASS' if cond else 'FAIL') + (' ' + str(info) if info else ''))

        await ev("() => { const s = T.s; s.game.freezeBots = true; for (const b of s.bots) { b.phys.pos.set(30, 0, 22 - b.i); b.alive = true; } T.s.step(0); }")
        # A 撞牆、滑牆
        r = await ev("() => { T.at(-11, 4); T.input({mx: 0, mz: 1, mode: 'touch'}); T.run(1.5); const a = T.s.player.body.pos.x;"
                     " T.input({mx: -0.7, mz: 0.7}); const z0 = T.s.player.body.pos.z; T.run(0.6); const p = T.s.player.body.pos; T.input({mx:0, mz:0}); return [a, p.x, p.z - z0]; }")
        ok('A 撞牆停在牆外', abs(r[0] - (-9.35)) < 0.05, r[0]); ok('A 斜推沿牆滑', abs(r[1] - (-9.35)) < 0.05 and abs(r[2]) > 1.0, r)
        # B 上樓梯到卸貨平台
        r = await ev("() => { T.at(7.4, -22.5); T.input({mz: 1}); T.run(2.0); T.input({mz: 0}); T.run(0.3); const p = T.s.player.body.pos; return [p.x, p.y]; }")
        ok('B 走上樓梯', abs(r[1] - 2.4) < 0.01 and r[0] > 12, r)
        # B2 走下平台（從平台北緣跳下去）
        r = await ev("() => { T.at(13, -20, Math.PI); T.s.player.body.pos.y = 2.4; T.input({mz: 1}); T.run(1.5); T.input({mz: 0}); return T.s.player.body.pos.y; }")
        ok('B2 走出平台會掉下來', abs(r) < 0.01, r)
        # C 跳上箱子（0.9 公尺）
        r = await ev("() => { T.at(-16.9, 9.5); T.input({mz: 1}); T.run(0.2); T.input({jump: true}); T.run(0.35); T.input({mz: 0}); T.run(0.6); return T.s.player.body.pos.toArray(); }")
        ok('C 跳上箱子', abs(r[1] - 0.9) < 0.01, r)
        # C2 不跳走不上去
        r = await ev("() => { T.at(-16.6, 9.5); T.input({mz: 1}); T.run(1); T.input({mz: 0}); return T.s.player.body.pos.toArray(); }")
        ok('C2 不跳上不去', abs(r[1]) < 0.01 and r[0] < -15.4, r)
        # D 蹲：高度、速度、站起來
        r = await ev("() => { T.at(-30, -10); T.input({crouch: true, mz: 1}); T.run(1); const h = T.s.player.body.h, v = Math.hypot(T.s.player.body.vel.x, T.s.player.body.vel.z);"
                     " T.input({crouch: false, mz: 0}); T.run(0.3); return [h, v, T.s.player.body.h]; }")
        ok('D 蹲下高度與速度', r[0] == 1.2 and r[1] < 2.7 and r[2] == 1.8, r)
        # E 部位倍率：頭 120（一槍死）、身體 30、腳 22.5
        out = []
        for part, y in (('head', 1.66), ('body', 1.2), ('legs', 0.5)):
            r = await ev(f"""() => {{ T.at(-32, 0.3); T.s.W.bloom = 0; T.s.W.idx = 0; T.s.W.rp = T.s.W.ry = 0; T.s.W.cd = 0; T.s.W.since = 9; T.s.W.deployT = 0; T.s.S.autoFire = false; T.bot(0, -25.5, 0.3);
               T.aimAt(-25.5, {y}, 0.3); const before = T.s.bots[0].hp; T.input({{fire: true}}); T.s.step(1/60); T.input({{fire: false}});
               return [before - T.s.bots[0].hp, T.s.bots[0].alive]; }}""")
            out.append((part, r))
        ok('E 爆頭 4 倍×護甲（一槍倒）', out[0][1][1] is False, out[0]); ok('E 身體 36×護甲 0.775≈27.6', 27 < out[1][1][0] < 28, out[1]); ok('E 腳 36×0.75≈26.7（無護甲）', 26 < out[2][1][0] < 27.2, out[2])
        # F 後座力：連射 1 秒往上飄，停火 1 秒回正
        r = await ev("() => { T.at(-30, -10); T.s.W.ammo = 30; T.input({fire: true}); T.run(1.0); const up = T.s.W.rp, side = T.s.W.ry, shots = 30 - T.s.W.ammo; T.input({fire: false}); T.run(1.0); return [up, side, shots, T.s.W.rp, T.s.W.ry]; }")
        ok('F 連射往上飄（觸控自動補償一半）', r[0] > 2 and r[2] >= 9, r); ok('F 停火回正', abs(r[3]) < 0.05 and abs(r[4]) < 0.05, r)
        # G 散佈：站著小、跑步大、空中更大、蹲下與開鏡變小
        r = await ev("""() => { T.at(-30, -10); T.s.W.bloom = 0; T.run(0.3); const still = T.s.W.spread;
            T.input({mz: 1}); T.run(0.6); const run = T.s.W.spread; T.input({mz: 0, jump: true}); T.run(0.15); const air = T.s.W.spread; T.run(1.0);
            T.input({crouch: true}); T.run(0.5); const crouch = T.s.W.spread; T.input({crouch: false}); T.run(0.3);
            T.s.player.ads = true; T.run(0.5); const ads = T.s.W.spread; T.s.player.ads = false; T.run(0.5); return [still, run, air, crouch, ads]; }""")
        ok('G 散佈變化', r[1] > r[0] * 5 and r[2] > r[1] and r[3] < r[0] and r[4] < r[0], [round(x, 3) for x in r])
        # H 換彈：打光 30 發自動換彈，2.3 秒後補滿
        r = await ev("() => { T.at(-30, -10); T.s.W.ammo = 2; T.s.W.deployT = 0; T.input({fire: true}); T.run(0.5); const empty = T.s.W.ammo, rl = T.s.W.reloadT > 0; T.input({fire: false}); T.run(2.4); return [empty, rl, T.s.W.ammo]; }")
        ok('H 打光自動換彈', r[0] == 0 and r[1] and r[2] == 30, r)
        # I 自動開火：準星對到敵人身上就開槍
        r = await ev("() => { T.at(-32, 0.3); T.bot(1, -25.5, 0.3); T.s.W.ammo = 30; T.s.S.autoFire = true; T.input({mode: 'touch', fire: false}); T.aimAt(-25.5, 1.2, 0.3); T.run(0.4); return [30 - T.s.W.ammo, T.s.bots[1].hp]; }")
        ok('I 自動開火', r[0] >= 2, r)
        r = await ev("() => { T.bot(1, -25.5, 0.3); T.s.W.ammo = 30; T.s.S.autoFire = false; T.aimAt(-25.5, 1.2, 0.3); T.run(0.4); T.s.S.autoFire = true; return 30 - T.s.W.ammo; }")
        ok('I2 關掉就不會自己開', r == 0, r)
        # J 瞄準輔助：差 3 度、手指在轉視角時被慢慢拉過去
        r = await ev("""() => { T.at(-32, 0.3); T.bot(1, -24.5, 0.3); T.s.S.autoFire = false; T.s.S.aimAssist = true; T.aimAt(-24.5, 1.2, 0.3); T.s.player.yaw += 3 * Math.PI / 180;
            T.input({looking: true}); const y0 = T.s.player.yaw; T.run(0.3, () => { T.s.INPUT.fingerMoveT = 0.1; }); const pulled = (y0 - T.s.player.yaw) * 180 / Math.PI;
            T.aimAt(-24.5, 1.2, 0.3); T.s.player.yaw += 3 * Math.PI / 180; T.s.S.aimAssist = false; const y1 = T.s.player.yaw; T.run(0.3, () => { T.s.INPUT.fingerMoveT = 0.1; }); const off = (y1 - T.s.player.yaw) * 180 / Math.PI;
            T.s.S.aimAssist = true; T.input({looking: false}); T.s.S.autoFire = true; return [pulled, off]; }""")
        ok('J 瞄準輔助會拉、關掉不拉', r[0] > 1.0 and abs(r[1]) < 1e-6, [round(x, 2) for x in r])
        r = await ev("""() => { T.at(-32, 0.3); T.bot(1, -24.5, 0.3); T.s.S.autoFire = false; T.s.S.aimAssist = true; T.aimAt(-24.5, 1.2, 0.3); T.s.player.yaw += 3 * Math.PI / 180;
            T.input({looking: true, fingerMoveT: 0}); const y0 = T.s.player.yaw; T.run(0.5); T.input({looking: false}); T.s.S.autoFire = true; return (y0 - T.s.player.yaw) * 180 / Math.PI; }""")
        ok('J2 手指按著不動時瞄準輔助不拉', abs(r) < 1e-6, round(r, 3))
        r = await ev("""() => { T.at(-30, -10); const b = T.s.player.body; b.pos.y = 0.8; b.vel.y = 0; b.onGround = false; let pressed = -1, jumped = false;
            T.run(1.0, (i) => { if (pressed < 0 && !b.onGround && b.pos.y < 0.12) { T.s.INPUT.jump = true; pressed = i; } if (pressed >= 0 && b.vel.y > 1) jumped = true; }); return [pressed, jumped]; }""")
        ok('C3 落地前按跳會接著跳（緩衝）', r[0] >= 0 and r[1], r)
        # K 機器人：看得到你才開槍、會打中你
        r = await ev("""() => { const s = T.s; s.S.autoFire = false; s.game.freezeBots = false; s.player.hp = 100; s.player.alive = true;
            T.at(-14, 10); for (const b of s.bots) { b.phys.pos.set(30, 0, 24); b.state = 'patrol'; b.path = null; b.waitT = 99; }
            const b = s.bots[2]; b.phys.pos.set(-2, 0, 10); b.yaw = Math.PI/2; b.state = 'patrol'; b.waitT = 99; b.path = null;
            let firstShotT = -1; const hp0 = s.player.hp; let jump = null; let lp = b.phys.pos.clone(); T.run(5, (i) => { if (!jump && b.phys.pos.distanceTo(lp) > 1) jump = [i, lp.toArray(), b.phys.pos.toArray(), b.state, b.alive, b.hp]; lp.copy(b.phys.pos); if (firstShotT < 0 && s.player.hp < hp0) firstShotT = i / 60; if (window.DEATH === undefined && !s.player.alive) window.DEATH = i / 60; }); window.JUMP = jump;
            return [b.state, s.player.hp, firstShotT, b.alive, s.player.body.pos.toArray(), s.player.body.h, b.phys.pos.toArray(), b.yaw, b.seeT, s.player.alive, s.game.state, window.JUMP]; }""")
        r2 = await ev('() => window.DEATH')
        ok('K 機器人看到就開槍、會命中', r[2] > 0.3, f'首發命中 {r[2]:.2f}s，站著不動被打死 {r2}s')
        # L 牆後面看不到就不開槍：玩家躲在倉庫北牆後面
        r = await ev("""() => { const s = T.s; s.player.hp = 100; s.player.alive = true; T.at(-5, 9);
            for (const b of s.bots) { b.phys.pos.set(30, 0, 24); b.state = 'patrol'; b.waitT = 99; b.path = null; }
            const b = s.bots[2]; b.alive = true; b.hp = 100; b.phys.pos.set(-5, 0, 2); b.yaw = 0; b.state = 'patrol'; b.waitT = 99; b.path = null;
            let shots = 0; T.run(3); return [s.player.hp, b.state, b.visible]; }""")
        ok('L 隔牆不開槍', r[0] == 100 and r[2] is False, r)
        # M 巡邏：放著不管，機器人會沿路點走動、不卡住
        r = await ev("""() => { const s = T.s; T.at(-34, -24); s.player.alive = false; const st = s.bots.map(b => { b.waitT = 0; b.state = 'patrol'; b.path = null; b.alive = true; b.hp = 100; return b.phys.pos.clone(); });
            const dist = s.bots.map(() => 0); let prev = s.bots.map(b => b.phys.pos.clone());
            T.run(20, () => { s.bots.forEach((b, i) => { dist[i] += b.phys.pos.distanceTo(prev[i]); prev[i].copy(b.phys.pos); }); });
            s.player.alive = true; return dist.filter((d, i) => s.bots[i].active).map(d => +d.toFixed(1)); }""")
        ok('M 巡邏 20 秒都有走動', min(r) > 25, r)
        # N 效能：模擬一步（4 個機器人＋玩家）的時間
        r = await ev("() => { T.at(-30, 0); const t0 = performance.now(); T.run(5); return (performance.now() - t0) / 300; }")
        ok('N 每步模擬 < 2ms', r < 2, f'{r:.3f} ms')
        for k, v in res.items(): print(v.split()[0], k, *v.split()[1:])
        print('ERRORS', [e for e in errors if 'favicon' not in e and '404' not in e])
        await browser.close()
asyncio.run(main())
