"""M13 動畫 2.0：分段換彈（打光多拉槍機、比較久）、檢視武器、你可以側身探頭（牆會限制、命中框跟著偏、機器人看得到探出去的頭）、
機器人會在牆角探頭、側走／倒退各有步伐、原地轉身踏步、跳躍落地。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.startGame('practice'); s.game.freezeBots = true;
          for (const b of s.bots) { b.alive = false; b.g.visible = false; b.respawnT = Infinity; b.phys.pos.set(60, 0, 60); } window.__sfxLog = []; }""")
        # 1 戰術換彈（還有子彈）＝原本時間；打光才換 → 多 22%，並且多一聲拉槍機；換完子彈補滿
        r = await ev("""() => { const s = window.__strike, W = s.W, WP = s.getWP();
          W.ammo = 10; W.reserve = 90; s.startReload(); const tac = +W.reloadDur.toFixed(2), e1 = W.reloadEmpty;
          for (let i = 0; i < 60 * 3; i++) s.step(1/60); const full1 = W.ammo;
          W.ammo = 0; window.__sfxLog = []; s.startReload(); const emp = +W.reloadDur.toFixed(2);
          for (let i = 0; i < 60 * 3.5; i++) s.step(1/60);
          return [tac, +WP.reload.toFixed(2), e1, emp, W.reloadEmpty, full1, W.ammo, WP.mag, window.__sfxLog.filter((k) => k === 'magin').length]; }""")
        ok('1 還有子彈換＝原時間；打光換多 22%、多一聲拉槍機（magin×2）；換完都補滿', r[0] == r[1] and not r[2] and abs(r[3] - r[1] * 1.22) < 0.02 and r[4] and r[5] == r[7] and r[6] == r[7] and r[8] >= 2, r)
        # 2 分段動作：退彈匣時彈匣往下、拿新彈匣時看不到、插進去後回原位、最後拍一下（槍震）
        r = await ev("""() => { const s = window.__strike, W = s.W, WP = s.getWP(); W.ammo = 5; s.startReload();
          const out = []; const T = W.reloadDur;
          for (const q of [0.25, 0.38, 0.52, 0.7, 0.99]) { while (1 - W.reloadT / T < q && W.reloadT > 0) s.step(1/60);
            const g = s.vm().gun, m = g.userData.mag; out.push([+(m.position.y - g.userData.magY).toFixed(3), m.visible, +g.userData.leftArm.position.y.toFixed(3)]); }
          for (let i = 0; i < 60; i++) s.step(1/60);
          return [out, W.slap]; }""")
        o = r[0]
        ok('2 換彈分段：退出（彈匣往下、左手往下）→ 拿新的（看不到彈匣）→ 插進去 → 回原位、有拍底部', o[0][0] < -0.05 and o[0][2] < -0.1 and o[1][1] is False and -0.25 < o[2][0] < 0 and abs(o[3][0]) < 0.01 and r[1], r)
        # 3 檢視武器：彈匣滿時按換彈 → 不換彈、槍轉到側邊看；開槍就中斷
        r = await ev("""() => { const s = window.__strike, W = s.W, WP = s.getWP(); W.ammo = WP.mag; W.reloadT = 0; s.reloadOrInspect();
          const st = [W.inspectT > 0, W.reloadT]; let maxY = 0;
          for (let i = 0; i < 60; i++) { s.step(1/60); maxY = Math.max(maxY, Math.abs(s.vm().rig.rotation.y)); }
          s.INPUT.fire = true; s.step(1/60); s.step(1/60); s.INPUT.fire = false; const after = W.inspectT;
          return [st, +maxY.toFixed(2), after]; }""")
        ok('3 彈匣滿按換彈＝檢視武器（槍轉 >0.5 弧度）、不會換彈、開槍立刻中斷', r[0][0] and r[0][1] == 0 and r[1] > 0.5 and r[2] == 0, r)
        # 4 你側身：空地往右探 → 眼睛往右 0.38 公尺、畫面往右歪；頭的命中框跟著過去；放開收回
        r = await ev("""() => { const s = window.__strike, pl = s.player, V = pl.body.pos.constructor;
          // 找一塊四周 1.5 公尺內都沒牆的地面
          let spot = null; const P0 = pl.body.pos.clone(); for (let x = Math.round(P0.x) - 16; x <= P0.x + 16 && !spot; x += 1) for (let z = Math.round(P0.z) - 16; z <= P0.z + 16 && !spot; z += 1) {
            let free = s.BOXES.some((b) => x > b.min[0] + 1.5 && x < b.max[0] - 1.5 && z > b.min[2] + 1.5 && z < b.max[2] - 1.5 && Math.abs(b.max[1] - P0.y) < 0.15); for (let a = 0; a < 8; a++) { const ax = Math.cos(a * 0.785) * 1.5, az = Math.sin(a * 0.785) * 1.5;
              const st = s.BOXES.slice(1).some((b) => x + ax > b.min[0] - 0.4 && x + ax < b.max[0] + 0.4 && z + az > b.min[2] - 0.4 && z + az < b.max[2] + 0.4 && b.max[1] > 0.1 && b.min[1] < 2.2); if (st) free = false; }
            if (free) spot = [x, z]; }
          if (!spot) return ['nospot'];
          pl.body.pos.set(spot[0], P0.y + 0.02, spot[1]); pl.body.vel.set(0, 0, 0); pl.yaw = 0; pl.pitch = 0;
          for (let i = 0; i < 20; i++) s.step(1/60);
          const base = s.camera.position.clone(); s.INPUT.leanKey = 1; for (let i = 0; i < 40; i++) s.step(1/60);
          const off = s.camera.position.clone().sub(base), roll = s.camera.rotation.z, hb = pl.boxes[0], hx = (hb.min[0] + hb.max[0]) / 2 - pl.body.pos.x;
          s.INPUT.leanKey = 0; for (let i = 0; i < 40; i++) s.step(1/60); const back = s.camera.position.clone().sub(base).length();
          return [spot, +off.x.toFixed(2), +off.z.toFixed(2), +roll.toFixed(3), +hx.toFixed(2), +back.toFixed(3)]; }""")
        ok('4 往右探：眼睛往右 ~0.38m、畫面右歪、頭的命中框跟著偏、放開收回', r[0] and 0.33 < r[1] < 0.4 and abs(r[2]) < 0.05 and r[3] < -0.1 and 0.33 < r[4] < 0.4 and r[5] < 0.02, r)
        # 5 旁邊有牆：探不出去（眼睛不會穿牆）
        r = await ev("""() => { const s = window.__strike, pl = s.player, p = pl.body.pos;
          const box = { min: [p.x + 0.45, -1, p.z - 2], max: [p.x + 1.4, 4, p.z + 2] }; s.BOXES.push(box);
          s.INPUT.leanKey = 1; for (let i = 0; i < 40; i++) s.step(1/60); const lx = pl.leanX;
          s.INPUT.leanKey = 0; s.BOXES.splice(s.BOXES.indexOf(box), 1); for (let i = 0; i < 40; i++) s.step(1/60);
          return [+lx.toFixed(2)]; }""")
        ok('5 右邊 0.45m 有牆：只探得出去一部分、眼睛離牆至少 15cm（不會穿牆）', 0 < r[0] <= 0.3, r)
        # 6 牆角探頭雙向：你探出去 → 牆後的機器人看得到你；機器人自己也會探頭看你
        r = await ev("""() => { const s = window.__strike, pl = s.player, b = s.bots.find((x) => x.team === 'B');
          const box = { min: [0, 38, -2], max: [2, 44, 0] }; s.BOXES.push(box);
          b.alive = true; b.active = true; b.phys.pos.set(6, 40, -6); b.phys.vel.set(0, 0, 0); b.yaw = Math.atan2(-(1.5 - 6), -(0.5 + 6)); b.state = 'attack'; b.leanA = 0; b.leanW = 0; b.leanX = b.leanZ = 0; b.leanCk = 99;
          pl.body.pos.set(1.5, 40, 0.5); pl.yaw = 0; pl.leanX = 0; pl.leanZ = 0; const see0 = s.canSeeUnit(b, pl);
          pl.leanX = 0.38; const see1 = s.canSeeUnit(b, pl); pl.leanX = 0;
          // 換過來：機器人在牆角、你在牆後
          b.phys.pos.set(1.5, 40, 0.5); b.yaw = 0; b.phys.onGround = true; b.phys.crouched = false; b.reloadT = 0; b.target = pl; b.leanCk = 0; b.leanW = 0;
          pl.body.pos.set(6, 40, -6); const bs0 = s.canSeeUnit(b, pl);
          for (let i = 0; i < 40; i++) s.botLean(b, 1/60, 0);
          const bs1 = s.canSeeUnit(b, pl), lw = b.leanW, la = +b.leanA.toFixed(2);
          s.humanPose(b, 1/60); b.g.updateMatrixWorld(true); const hp = new pl.body.pos.constructor(); b.hm.bones[9].getWorldPosition(hp);
          s.BOXES.splice(s.BOXES.indexOf(box), 1); b.target = null; b.alive = false; pl.body.pos.set(0, 1, 0);
          return [see0, see1, bs0, bs1, lw, la, +(hp.x - 1.5).toFixed(2)]; }""")
        ok('6 牆角：你不探頭它看不到、探頭看得到；它在牆角時會往外探（頭真的往右偏）然後看得到你', r[0] is False and r[1] is True and r[2] is False and r[3] is True and r[4] == 1 and r[5] > 0.9 and r[6] > 0.2, r)
        # 7 機器人步伐：往右側走 → 腰轉向右、胸口仍朝前；倒退 → 腰不轉、步子變小；原地轉身 → 踏一步跟上；跳 → 縮腳、落地一沉
        r = await ev("""() => { const s = window.__strike, b = s.bots.find((x) => x.team === 'B'), V = b.phys.pos.constructor;
          b.alive = true; b.g.visible = true; b.phys.pos.set(0, 40, 0); b.yaw = 0; b.phys.onGround = true; b.leanA = 0; b.leanW = 0; b.ck = 0; b.state = 'attack';
          const fwdOf = (bone) => { const q = new b.g.quaternion.constructor(); bone.getWorldQuaternion(q); const v = new V(0, 0, -1).applyQuaternion(q); return Math.atan2(-v.x, -v.z); };
          b.phys.vel.set(3, 0, 0); for (let i = 0; i < 40; i++) { b.walk += 1/60 * 3 * 2.3; s.humanPose(b, 1/60); } b.g.updateMatrixWorld(true);
          const hipsSide = +fwdOf(b.hm.bones[1]).toFixed(2), chestSide = +fwdOf(b.hm.bones[7]).toFixed(2), hy = +b.hYaw.toFixed(2);
          b.phys.vel.set(0, 0, 3); for (let i = 0; i < 40; i++) { b.walk += 1/60 * 3 * 2.3; s.humanPose(b, 1/60); } const hyBack = +b.hYaw.toFixed(2);
          b.phys.vel.set(0, 0, 0); for (let i = 0; i < 60; i++) s.humanPose(b, 1/60);
          b.yaw = 0.8; s.humanPose(b, 1/60); const stepped = b.tStep > 0; for (let i = 0; i < 60; i++) s.humanPose(b, 1/60); const lag = +Math.abs(b.tLag).toFixed(2);
          b.phys.onGround = false; for (let i = 0; i < 30; i++) s.humanPose(b, 1/60); const air = +b.airK.toFixed(2), knee = +b.hm.bones[3].rotation.x.toFixed(2);
          b.phys.onGround = true; for (let i = 0; i < 4; i++) s.humanPose(b, 1/60); const land = +b.hs.ld.x.toFixed(3);
          b.alive = false; b.g.visible = false;
          return [hy, hipsSide, chestSide, hyBack, stepped, lag, air, knee, land]; }""")
        ok('7 側走腰轉（>0.5）胸口仍朝前（<0.35）、倒退腰不轉、原地轉身會踏步跟上、跳時縮腳、落地一沉',
           r[0] > 0.5 and abs(r[1]) > 0.4 and abs(r[2]) < 0.35 and abs(r[3]) < 0.15 and r[4] and r[5] < 0.2 and r[6] > 0.8 and r[7] < -0.6 and r[8] > 0.01, r)
        # 8 手機探頭鍵：點一下開（往右）、再點收回；按住往左滑＝往左探、放開收回；可在自訂按鍵裡拖
        r = await ev("""async () => { const s = window.__strike, el = document.getElementById('bLean'), rc = el.getBoundingClientRect(), cx = rc.x + rc.width / 2, cy = rc.y + rc.height / 2;
          const pe = (t, x, id = 7) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: cy, bubbles: true, pointerType: 'touch' }));
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          pe('pointerdown', cx); pe('pointerup', cx); const a = s.INPUT.lean, on = el.classList.contains('on');
          pe('pointerdown', cx); pe('pointerup', cx); const b = s.INPUT.lean;
          pe('pointerdown', cx); pe('pointermove', cx - 40); const c = s.INPUT.lean, d = el.dataset.d; await wait(350); pe('pointerup', cx - 40); const e = s.INPUT.lean;
          return [a, on, b, c, d, e, !!document.querySelector('#bLean .tbl')]; }""")
        ok('8 探頭鍵：點一下往右、再點收回、按住往左滑往左、放開收回', r == [1, True, 0, -1, 'L', 0, True], r)
        # 9 探頭時走比較慢
        r = await ev("""() => { const s = window.__strike, pl = s.player; pl.body.pos.set(0, 1, 0);
          const sp = () => { s.INPUT.mz = 1; for (let i = 0; i < 50; i++) s.step(1/60); const v = Math.hypot(pl.body.vel.x, pl.body.vel.z); s.INPUT.mz = 0; for (let i = 0; i < 30; i++) s.step(1/60); return v; };
          const v0 = sp(); s.INPUT.leanKey = 1; const v1 = sp(); s.INPUT.leanKey = 0; return [+v0.toFixed(2), +v1.toFixed(2)]; }""")
        ok('9 探頭時移動變慢（約 65–80%）', r[0] > 0 and 0.55 < r[1] / r[0] < 0.85, r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
