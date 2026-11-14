"""M15 聲音與光影：隔牆變悶、HRTF 方向、材質中彈聲、子彈掠過聲、多盞動態光、反光、夜間地圖「午夜港區」。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.audioInit(); if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const b of s.bots) { b.alive = false; b.g.visible = false; b.respawnT = Infinity; } window.__sfxLog = []; }""")
        # 1 隔牆變悶：倉庫牆後面的聲音 → 擋住、變小、高頻濾掉；空地上沒擋
        r = await ev("""() => { const s = window.__strike, pl = s.player, V = pl.body.pos.constructor; pl.body.pos.set(-12, 0.05, 0); pl.yaw = -Math.PI / 2; pl.pitch = 0; s.step(1/60);
          const open = s.spatial(new V(-12, 0, -8)), wall = s.spatial(new V(-4, 0, 5)), half = s.spatial(new V(-12, 0, 6));
          return [open.occ, +open.vol.toFixed(2), wall.occ, +wall.vol.toFixed(2), Math.round(wall.lp), Math.round(open.lp)]; }""")
        ok('1 隔牆（倉庫裡）的聲音：被擋住、音量變小、高頻濾到 700 Hz 左右；空地上不擋', r[0] == 0 and r[2] == 1 and r[3] < r[1] * 0.8 and r[4] <= 800 and r[5] > 5000, r)
        # 2 HRTF：右邊的聲音在右、背後的在後、上面的在上；同時最多 8 個；關掉就退回左右聲道
        r = await ev("""() => { const s = window.__strike, pl = s.player, V = pl.body.pos.constructor; s.S.hrtf = true; pl.yaw = 0; s.step(1/60); s.camera.updateMatrixWorld();
          const c = s.camera.position, mk = (dx, dy, dz) => { const p = s.panOut({ x: c.x + dx, y: c.y + dy - 1.3, z: c.z + dz }, 0.1); return p && p.positionX ? [+p.positionX.value.toFixed(2), +p.positionY.value.toFixed(2), +p.positionZ.value.toFixed(2)] : null; };
          const right = mk(5, 0, 0), back = mk(0, 0, 5), up = mk(0, 5, 0.01), front = mk(0, 0, -5);
          for (let i = 0; i < 20; i++) s.panOut({ x: c.x + 3, y: 0, z: c.z }, 2); const n = s.SND3.n;
          s.S.hrtf = false; const off = s.spatial(new V(c.x + 5, 0, c.z)); s.S.hrtf = true;
          return [right, back, up, front, n, typeof off.pan, off.pan > 0.5]; }""")
        ok('2 HRTF 方向：右邊在右（x>0）、背後在後（z>0）、上面在上、前面在前；最多 8 個；關掉退回左右', r[0][0] > 0.9 and r[1][2] > 0.9 and r[2][1] > 0.9 and r[3][2] < -0.9 and r[4] == 8 and r[5] == 'number' and r[6], r)
        # 3 材質：貨櫃＝金屬、木箱＝木頭、牆＝石材、地板＝地面；你開槍打到牆會出聲
        r = await ev("""() => { const s = window.__strike, B = s.BOXES, f = (c) => s.boxMat(B.findIndex((b) => b.c === c));
          const kinds = [f('rust'), f('crate'), f('wall'), f('floor')];
          window.__sfxLog = []; ['container', 'wood', 'brick', 'floor', 'gravel'].forEach((m) => s.impactSfx(s.player.body.pos, m));
          const lg = window.__sfxLog.slice();
          const pl = s.player; pl.body.pos.set(-12, 0.05, 3); pl.yaw = -Math.PI / 2; pl.pitch = 0; s.W.ammo = 30; s.W.cd = 0; window.__sfxLog = [];
          for (let i = 0; i < 120; i++) s.step(1/60); s.W.deployT = 0; s.INPUT.fire = true; s.step(1/60); s.step(1/60); s.INPUT.fire = false;
          return [kinds, lg, window.__sfxLog.filter((k) => k.startsWith('impact')).slice(0, 1)]; }""")
        ok('3 中彈聲依材質：金屬、木頭、石材、地面、碎石；你打到倉庫磚牆是石材聲', r[0] == ['container', 'wood', 'brick', 'floor'] and r[1] == ['impact:metal', 'impact:wood', 'impact:stone', 'impact:ground', 'impact:gravel'] and r[2] == ['impact:stone'], r)
        # 4 子彈從耳邊飛過：敵人的子彈 1 公尺內飛過有聲音；5 公尺外、隊友的、打在你前面停住的都沒有
        r = await ev("""() => { const s = window.__strike, c = s.camera.position, V = c.constructor; s.game.t += 1;
          const a = s.bulletWhiz(new V(c.x - 30, c.y, c.z + 1), new V(c.x + 30, c.y, c.z + 1), 'B'); s.game.t += 1;
          const b = s.bulletWhiz(new V(c.x - 30, c.y, c.z + 5), new V(c.x + 30, c.y, c.z + 5), 'B'); s.game.t += 1;
          const cc = s.bulletWhiz(new V(c.x - 30, c.y, c.z + 1), new V(c.x + 30, c.y, c.z + 1), s.player.team); s.game.t += 1;
          const d = s.bulletWhiz(new V(c.x - 30, c.y, c.z + 1), new V(c.x - 3, c.y, c.z + 1), 'B');
          return [a, b, cc, d]; }""")
        ok('4 子彈掠過聲：1m 內有、5m 外沒有、隊友沒有、子彈沒飛到你旁邊沒有', r == [True, False, False, False], r)
        # 5 動態光 4 盞：4 個地方同時亮；第 5 盞換掉最弱的；同一位置疊在一起
        r = await ev("""() => { const s = window.__strike, a = s.LIGHT_U.uFl.value, V = s.player.body.pos.constructor; for (const v of a) v.w = 0;
          [[0, 1, 0, 1.0], [5, 1, 0, 0.6], [10, 1, 0, 1.3], [15, 1, 0, 1.1]].forEach((q) => s.muzzleLight(new V(q[0], q[1], q[2]), q[3]));
          const four = a.filter((v) => v.w > 0).length; s.muzzleLight(new V(20, 1, 0), 1.5); const has20 = a.some((v) => v.x === 20), has5 = a.some((v) => v.x === 5 && v.w > 0);
          s.muzzleLight(new V(20.2, 1, 0), 2); const merged = a.filter((v) => Math.abs(v.x - 20) < 1).length;
          const lit = +s.flashAt(10, 1, 0).toFixed(2), far = +s.flashAt(10, 1, 30).toFixed(2); for (const v of a) v.w = 0;
          return [four, has20, has5, merged, lit > 1, far < 0.05]; }""")
        ok('5 動態光同時 4 盞、第 5 盞換掉最弱的、同一位置疊在一起、照得到附近照不到遠處', r == [4, True, False, 1, True, True], r)
        # 6 反光：貨櫃、金屬、舊城的玻璃窗有反光材質；白天地圖沒有路燈
        r = await ev("""() => { const s = window.__strike; const names = () => s.scene.children.filter((m) => m.name && m.name.startsWith('map-')).map((m) => m.name);
          const dawn = names(); s.switchMap('market'); const mk = names(); const keys = s.scene.children.filter((m) => m.name === 'map-glass' || m.name === 'map-container').map((m) => m.material.customProgramCacheKey());
          const lamp = s.LIGHT_U.uLampW.value.getHexString(); s.renderer.render(s.scene, s.camera);
          return [dawn.includes('map-container'), mk.includes('map-glass'), keys, lamp]; }""")
        ok('6 反光材質：曙光有貨櫃、舊城的窗戶是玻璃；白天沒有路燈光', r[0] and r[1] and any(k.endswith('glass') for k in r[2]) and r[3] == '000000', r)
        # 7 夜間地圖：路燈的光和影子烘進光照貼圖；路燈下亮、角落暗；燈在牆後就照不到
        r = await ev("""() => { const s = window.__strike; s.switchMap('night'); s.startGame('practice'); s.game.freezeBots = true;
          const L = (x, z) => { const q = s.lightAt(x, z); return +(q.warm + q.cool).toFixed(2); };
          const under = L(-34.5, 0), mid = L(-3, 16), shadow = L(-36.5 + 1, 0);
          let dark = 9, bright = 0; for (const n of s.NAV.nodes) { if (!n.ok || n.up) continue; const v = L(n.x, n.z); dark = Math.min(dark, v); bright = Math.max(bright, v); }
          // 倉庫北牆外的燈（-5, 7.15）：牆外亮、牆內（同一 x，倉庫裡）暗
          const outW = L(-5, 8.5), inW = L(-5, 5.5);
          return [s.getMap().theme.night, s.LM.ms, under, +dark.toFixed(2), +bright.toFixed(2), outW, inW, s.scene.children.some((m) => m.name === 'lampGlow')]; }""")
        ok('7 午夜港區：路燈下亮（>0.5）、最暗處接近 0、牆會擋路燈（牆外比牆內亮 3 倍以上）、有燈的光暈；烘焙 1 秒內', r[0] and r[1] < 1000 and r[2] > 0.5 and r[3] < 0.05 and r[4] > 0.7 and r[5] > r[6] * 3 and r[7], r)
        # 8 夜裡人物：站在路燈下被照亮、暗處不亮
        r = await ev("""() => { const s = window.__strike, b = s.bots.find((x) => x.team === 'B'); b.alive = true; b.active = true; b.g.visible = true;
          const at = (x, z) => { const c = s.lampColorAt(x, z, b.hm.mat.userData.lampU.value); return +(c.r + c.g + c.b).toFixed(2); };
          const lit = at(-34.5, 0); let dark = 9, best = null; for (const n of s.NAV.nodes) { if (!n.ok || n.up) continue; const q = s.lightAt(n.x, n.z), v = q.warm + q.cool; if (v < dark) { dark = v; best = n; } }
          const dk = at(best.x, best.z); b.alive = false; b.g.visible = false; return [lit, dk]; }""")
        ok('8 夜裡人物：路燈下被照亮、暗處不亮', r[0] > 0.6 and r[1] < 0.1, r)
        # 9 夜裡暗處看不到：全黑處 30 公尺外看不到你，路燈下看得到，開槍會暴露位置；白天同樣位置看得到
        r = await ev("""() => { const s = window.__strike, pl = s.player, b = s.bots.find((x) => x.team === 'B');
          let dk = null, dv = 9, bk = null, bv = 0; for (const n of s.NAV.nodes) { if (!n.ok || n.up) continue; const q = s.lightAt(n.x, n.z), v = q.warm + q.cool + q.sun * 0.12; if (v < dv) { dv = v; dk = n; } if (v > bv) { bv = v; bk = n; } }
          const test = (n) => { pl.body.pos.set(n.x, 40, n.z); pl.nightT = 0; pl.firedAt = -99; b.alive = true; b.active = true; b.state = 'attack'; b.phys.pos.set(n.x + 30, 40, n.z); b.yaw = Math.PI / 2; return s.canSeeUnit(b, pl); };
          const dark = test(dk), lit = test(bk); pl.body.pos.set(dk.x, 40, dk.z); b.phys.pos.set(dk.x + 30, 40, dk.z); pl.nightT = 0; pl.firedAt = s.game.t; const fired = s.canSeeUnit(b, pl);
          pl.firedAt = -99; pl.nightT = 0; const d1 = +s.nightSeeDist(pl).toFixed(1);
          s.switchMap('dawn'); const day = test(dk); b.alive = false; pl.body.pos.set(-30, 0.05, 0);
          return [dark, lit, fired, day, d1]; }""")
        ok('9 夜裡：暗處 30m 看不到你、路燈下看得到、開槍後看得到；白天看得到', r[0:4] == [False, True, True, True] and r[4] < 25, r)
        # 10 選單 5 張地圖；禁選：禁兩張後從剩下 3 張選
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); const cards = document.querySelectorAll('#mapSel button, #mapSel [data-map]').length;
          s.openRanked(); s.openVeto(); s.vetoTap('dawn'); return new Promise((res) => setTimeout(() => { const st = [...document.querySelectorAll('#vetoMaps .vmap')].map((b) => b.className.includes('ban'));
            const open = st.filter((x) => !x).length; document.getElementById('vetoX').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); s.RK.veto && (s.RK.veto = null); document.getElementById('rankVeto').hidden = true;
            res([cards, s.MAP_ORDER.length, open, document.getElementById('vetoMsg').textContent]); }, 1500)); }""")
        ok('10 選單有 5 張地圖；段位賽禁兩張後剩 3 張可選', r[0] >= 5 and r[1] == 5 and r[2] == 3 and '剩下' in r[3], r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
