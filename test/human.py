"""擬真人物：骨架蒙皮（每人 1 次繪製＋槍）、雙手握在槍上、中彈反應、順著子彈方向倒地、遠處簡化版；狂暴模式軍官服與一鍵換槍；暫停畫面有「調整按鈕位置」。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        setup = """() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; s.startGame('practice'); for (let i = 0; i < 10; i++) s.step(1/60);
          s.player.body.pos.set(0, 0, -24); s.player.yaw = Math.PI / 2;
          const bs = s.bots.filter((b) => b.active); bs.forEach((b, i) => { b.phys.pos.set(i === 0 ? -4 : 30 + i, 0, i === 0 ? -24 : 30); b.blindT = 99; b.yaw = -Math.PI / 2; b.state = 'hold'; b.holdT = 99; b.holdYaw = b.yaw; b.pitch = 0; });
          for (let i = 0; i < 30; i++) s.step(1/60); return bs[0].i; }"""
        bi = await ev(setup)
        # 1 骨架蒙皮：16 根骨頭、一個網格＋槍
        r = await ev("""(bi) => { const s = window.__strike, b = s.bots[bi]; return [b.hm.mesh.isSkinnedMesh, b.hm.bones.length, b.hm.mesh.geometry.attributes.skinIndex.count > 3000, b.gunM.parent && b.gunM.parent.parent === b.hm.bones[7]]; }""", bi)
        ok('1 人物是骨架蒙皮網格（16 根骨頭），槍掛在胸骨上', r == [True, 16, True, True], r)
        # 2 雙手握槍：右手、左手骨頭的位置離槍上的握點 12 公分內
        r = await ev("""(bi) => { const s = window.__strike, b = s.bots[bi], V = s.player.body.pos.constructor; b.g.updateMatrixWorld(true);
          const hr = b.hm.bones[15].getWorldPosition(new V()), hl = b.hm.bones[12].getWorldPosition(new V());
          const gr = b.gunM.localToWorld(new V(0.16, 1.27, -0.43)), gl = b.gunM.localToWorld(new V(0.16, 1.33, -0.64));
          return [+hr.distanceTo(gr).toFixed(3), +hl.distanceTo(gl).toFixed(3)]; }""", bi)
        ok('2 兩隻手握在槍上（握把、護木）', r[0] < 0.12 and r[1] < 0.12, r)
        # 3 中彈反應：身體被推、往後踉蹌
        r = await ev("""(bi) => { const s = window.__strike, b = s.bots[bi], V = s.player.body.pos.constructor; b.hp = 500;
          const x0 = b.phys.pos.x; s.damageBot(b, 30, 'body', new V(-1, 0, 0), s.player); let mx = 0;
          for (let i = 0; i < 12; i++) { s.step(1/60); mx = Math.max(mx, Math.abs(b.hs.sp.x) + Math.abs(b.hs.sy.x)); }
          return [+mx.toFixed(3), +(b.phys.pos.x - x0).toFixed(3)]; }""", bi)
        ok('3 中彈：上身被推一下、人往後退', r[0] > 0.05 and r[1] < -0.02, r)
        # 4 倒地：順著子彈方向倒（子彈往 -x 飛，頭最後在腳的 -x 邊，貼近地面）
        r = await ev("""(bi) => { const s = window.__strike, b = s.bots[bi], V = s.player.body.pos.constructor; s.damageBot(b, 9999, 'body', new V(-1, 0, 0), s.player);
          const hs = []; for (let i = 0; i < 100; i++) { s.step(1/60); if (i % 10 === 0) { b.g.updateMatrixWorld(true); hs.push(+b.hm.bones[9].getWorldPosition(new V()).y.toFixed(2)); } }
          b.g.updateMatrixWorld(true); const h = b.hm.bones[9].getWorldPosition(new V()); return [+(h.x - b.phys.pos.x).toFixed(2), +h.y.toFixed(2), hs]; }""", bi)
        ok('4 倒地：順著子彈方向倒下、頭貼近地面、是慢慢倒（不是瞬間）', r[0] < -0.9 and r[1] < 0.5 and r[2][1] > 1.0, r)
        # 5 遠處簡化：25 公尺外換成三角形少很多的版本
        r = await ev("""() => { const s = window.__strike; const b = s.bots.find((x) => x.active && x.alive); const near = b.hm.mesh.geometry;
          b.phys.pos.set(-4, 0, -24); b.blindT = 99; for (let i = 0; i < 3; i++) s.step(1/60); const n1 = b.hm.mesh.geometry.attributes.position.count;
          b.phys.pos.set(-33, 0, -24); for (let i = 0; i < 3; i++) s.step(1/60); const n2 = b.hm.mesh.geometry.attributes.position.count; return [n1, n2]; }""")
        ok('5 遠處的人換簡化模型（頂點少一半以上）', r[1] < r[0] * 0.5, r)
        await page.screenshot(path=str(OUT / 'human_close.png'))
        # 6 狂暴模式：精英、魔王換軍服；換槍鍵一按就換下一把、出槍很快
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); s.startGame('rage'); for (let i = 0; i < 60 * 4; i++) { s.player.hp = 100; s.step(1/60); }
          const b = s.bots.find((x) => x.active && x.alive); s.setHumanLook(b, 'boss'); for (let i = 0; i < 3; i++) s.step(1/60);
          const boss = [b.hm.look, b.hm.mesh.geometry.attributes.position.count];
          s.setHumanLook(b, 'elite'); for (let i = 0; i < 3; i++) s.step(1/60); const el = [b.hm.look, b.mat.userData.camoU[0].value.getHexString()];
          return [boss, el]; }""")
        ok('6 狂暴：魔王是軍官服、精英是黑色特戰服', r[0][0] == 'boss' and r[1][0] == 'elite' and r[1][1] == '2c2e31', r)
        w0 = await ev("() => window.__strike.W && window.__strike.INV.cur && window.__strike.INV[window.__strike.INV.cur].def.id")
        el = await page.query_selector('#bSwap'); bb = await el.bounding_box()
        cdp = await page.context.new_cdp_session(page)
        x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        r1 = await ev("() => { const s = window.__strike; return [s.INV[s.INV.cur].def.id, +s.W.deployT.toFixed(2)]; }")
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 2}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        r2 = await ev("() => { const s = window.__strike; return [s.INV[s.INV.cur].def.id, document.getElementById('tip') ? document.getElementById('tip').textContent : '']; }")
        ok('7 狂暴換槍：按下去就換下一把（步槍→卡賓→衝鋒槍）、出槍 0.15 秒', w0 == 'rifle' and r1[0] == 'carbine' and r1[1] <= 0.15 and r2[0] == 'smg', [w0, r1, r2])
        # 8 暫停畫面最上面有「調整按鈕位置」，按了進編輯
        await ev("() => document.getElementById('bPause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))")
        vis = await ev("() => !document.getElementById('bLayoutQ').hidden && document.getElementById('bLayoutQ').getBoundingClientRect().top < 120")
        await ev("() => document.getElementById('bLayoutQ').click()")
        r = await ev("() => [!document.getElementById('edit').hidden, document.getElementById('pause').hidden]")
        ok('8 暫停畫面上方有「調整按鈕位置」，按了直接進編輯', vis and r == [True, True], [vis, r])
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
