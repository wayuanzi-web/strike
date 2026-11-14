"""M10 美術與打擊感：光照貼圖（三角形大減、影子位置正確）、人物動作（換彈、裝彈、中彈、倒地）、命中回饋、室內外殘響、聲音提示與字幕、配色。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        res = []; ok = lambda n, c, i='': res.append((n, c, i))
        ev = page.evaluate
        await ev("() => { window.__strike.game.manual = true; }")
        # 1 光照貼圖：每張地圖三角形 < 1.5 萬、烘焙時間、地板上隨機 300 點的明暗跟直接打一條射線的結果一致
        r = await ev("""() => { const s = window.__strike, out = {};
          for (const id of s.MAP_ORDER) { s.switchMap(id); let tris = 0; for (const m of s.mapMeshes) tris += m.geometry.index.count / 3;
            const L = s.LM, F = L.floor, W = L.size[0]; let agree = 0, n = 0;
            for (let k = 0; k < 300; k++) { const i = Math.floor(Math.random() * F.tw), j = Math.floor(Math.random() * F.th);
              const x = F.x0 + F.lu * (i + 0.5) / F.tw, z = F.z0 + F.lv * (j + 0.5) / F.th, sun = s.bakeRay(x, 0.03, z, s.SUN_DIR.x, s.SUN_DIR.y, s.SUN_DIR.z, 70) < 0;
              const v = L.data[((F.ay0 + 1 + j) * W + F.ax0 + 1 + i) * 4] / 255; n++; if ((v > 0.5) === sun) agree++; }
            out[id] = [tris, L.ms, L.size.join('x'), +(agree / n).toFixed(2)]; }
          s.switchMap('dawn'); return out; }""")
        ok('1 光照貼圖：每張地圖三角形 1.5 萬以下、地板影子跟實際射線 9 成以上一致', all(v[0] < 15000 and v[3] >= 0.9 for v in r.values()), r)
        await page.click('#bStart')
        await ev("() => { const s = window.__strike; s.game.manual = true; s.game.freezeBots = true; s.S.autoFire = false; window.__sfxLog = []; }")
        # 2 人物動作（裝彈的姿勢在真的對戰裡測）
        await ev("""() => { const s = window.__strike; s.startGame('match'); const R = s.ROUND; R.phase = 'live'; R.t = 90; s.game.freezeBots = false;
          const b = s.bots.find((x) => x.active && x.team === R.atk); s.giveBomb(b); const S = s.SITES.A; b.phys.pos.set(S.plants[0][0], 0, S.plants[0][1]); b.state = 'plant'; b.useT = 0; b.blindT = 99;
          for (let i = 0; i < 40; i++) s.step(1/60); window.__usePose = [+b.gunP.rotation.x.toFixed(2), +(-b.hm.bones[6].rotation.x).toFixed(2), b.state]; s.startGame('practice'); s.game.freezeBots = true; }""")
        r = await ev("""() => { const s = window.__strike, b = s.bots.find((x) => x.active); const st = (n) => { for (let i = 0; i < n; i++) s.step(1/60); };
          s.game.freezeBots = false; b.blindT = 99; b.state = 'hold'; b.holdT = 99; b.holdYaw = 0; b.reloadT = b.wpn.reload; st(40); const rl = [+b.gunP.rotation.x.toFixed(2), +(-b.hm.bones[6].rotation.x).toFixed(2)];
          b.reloadT = 0; const use = window.__usePose; s.damageBot(b, 5, 'legs', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); st(2); const legs = +(b.hm.bones[1].position.y - 0.95).toFixed(3);
          s.damageBot(b, 5, 'body', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); st(2); const body = +b.hs.sy.x.toFixed(2);
          const kinds = new Set(); for (let k = 0; k < 30; k++) { const c = s.bots[k % 4]; c.alive = true; c.hp = 1; s.damageBot(c, 9, ['head', 'body', 'legs'][k % 3], c.phys.pos.clone().set(Math.cos(k), 0, Math.sin(k)), s.player, s.WEAPONS.rifle); kinds.add(Math.round(((c.dd.ang % 6.283) + 6.283) % 6.283 * 2)); }
          const d = s.bots[0]; d.alive = true; d.hp = 1; s.damageBot(d, 9, 'body', d.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); d.respawnT = 99; st(10); const early = +(d.hm.bones[1].position.y - 0.95).toFixed(2); st(60);
          const tilt = d.dd.th; s.game.freezeBots = true;
          return [rl, use, legs, body, [...kinds], early, +tilt.toFixed(2)]; }""")
        ok('2 人物動作：換彈槍往下、拆彈彎腰槍朝下、打腳身子一沉、打身體會轉、順著子彈方向往不同方向倒、先腿軟再倒地', r[0][0] < -0.3 and r[1][0] < -0.8 and r[1][1] > 0.15 and r[2] < -0.02 and abs(r[3]) > 0.04 and len(r[4]) >= 3 and r[5] < -0.1 and r[6] > 1.2, r)
        # 3 命中回饋：準星每發都跳、打到頭盔沒死「叮」、爆頭擊殺多一層聲音
        r = await ev("""() => { const s = window.__strike, b = s.bots.find((x) => x.active); window.__sfxLog = []; b.alive = true; b.hp = 100; b.helmet = true; b.armor = 100;
          s.damageBot(b, 20, 'head', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); const tick = document.getElementById('xh').classList.contains('tick');
          s.damageBot(b, 200, 'head', b.phys.pos.clone().set(1, 0, 0), s.player, s.WEAPONS.rifle); return [tick, window.__sfxLog.slice()]; }""")
        ok('3 命中回饋：準星跳、打到頭盔「叮」、爆頭擊殺多一層音效', r[0] and 'dink' in r[1] and 'headkill' in r[1] and 'kill' in r[1], r)
        # 4 殘響：工地二樓底下算室內、空地算室外；室內殘響比較重
        r = await ev("""() => { const s = window.__strike; s.switchMap('site'); const a = s.indoorAmount(0, 1.6, -3), b = s.indoorAmount(-25, 1.6, 15);
          s.player.body.pos.set(0, 0, -3); s.step(1/60); for (let i = 0; i < 60; i++) s.step(1/60); const t1 = s.REV.target;
          s.player.body.pos.set(-25, 0, 15); for (let i = 0; i < 60; i++) s.step(1/60); const t2 = s.REV.target; return [a, b, +t1.toFixed(2), +t2.toFixed(2), !!s.REV.send]; }""")
        ok('4 室內外殘響：樓下、天橋下殘響重，空地輕', r[0] >= 0.8 and r[1] <= 0.2 and r[2] > r[3] and r[4], r)
        # 5 聲音提示與字幕：敵人在右邊走 → 準星旁有方向弧、字幕寫「右」；炸彈嗶聲字幕
        r = await ev("""() => { const s = window.__strike; s.S.soundViz = true; s.S.captions = true; s.player.body.pos.set(-20, 0, 0); s.player.yaw = 0; s.player.alive = true;
          const V = s.player.body.pos.constructor; s.soundCue('step', new V(-12, 0, 0)); s.step(1/60);
          const arcs = document.querySelectorAll('#sv i').length, cap = document.getElementById('cap').textContent;
          s.soundCue('beep', new V(0, 0, 0), '剩 9 秒'); const cap2 = document.getElementById('cap').textContent;
          const V2 = s.player.body.pos.constructor; s.player.yaw = -Math.PI / 2; s.CUE.last = {}; s.soundCue('step', new V2(-20, 0, -8)); const capN = document.getElementById('cap').lastChild.textContent;
          s.S.soundViz = false; s.step(1/60); const arcsOff = document.querySelectorAll('#sv i').length; return [arcs, cap, cap2, arcsOff, capN]; }""")
        await page.screenshot(path=str(OUT / 'm10_cues.png'))
        ok('5 聲音提示：腳步方向弧、字幕寫出方向（右邊、左邊各測一次）；炸彈嗶聲有字幕；關掉就不顯示', r[0] >= 1 and '腳步聲' in r[1] and '右' in r[1] and '炸彈' in r[2] and r[3] == 0 and '左' in r[4], r)
        # 6 配色：色盲友善 → 介面敵我顏色、雷達、敵人身上的光都換
        r = await ev("""() => { const s = window.__strike; const e = s.bots.find((b) => b.baseTeam === 'B'), r0 = e.mat.userData.rimU.value.toArray();
          s.S.palette = 'cb'; s.applyPalette(); const css = getComputedStyle(document.documentElement).getPropertyValue('--enemy').trim(), r1 = e.mat.userData.rimU.value.toArray();
          const radar = s.pal().radarE; s.S.palette = 'default'; s.applyPalette(); return [css, radar, r0, r1]; }""")
        ok('6 配色切換：介面、雷達、敵人身上的光都跟著換', r[0] == '#ffd23a' and r[1] == '#ffcc22' and r[2] != r[3], r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e])
        await browser.close()

asyncio.run(main())
