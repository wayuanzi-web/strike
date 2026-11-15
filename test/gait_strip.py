"""步態截圖：機器人在原地「跑步機」上以指定速度走，從側面拍一整個週期（8 張），並量腳底有沒有在地上滑"""
import asyncio, sys, base64
from harness import *
SP = float(sys.argv[1]) if len(sys.argv) > 1 else 1.6
TAG = sys.argv[2] if len(sys.argv) > 2 else 'g'
import os
DIRV = os.environ.get('DIRV', '0,0,1')
async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p, w=700, h=700)
        ev = page.evaluate
        await ev("""() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; if (s.getMap().id !== 'dawn') s.switchMap('dawn'); s.startGame('practice'); s.game.freezeBots = true;
          for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }""")
        await page.wait_for_timeout(2000)
        r = await ev(f"""() => {{ const s = window.__strike, SP = {SP}; for (const b of s.bots) {{ b.alive = false; b.g.visible = false; }}
          const b = s.bots.find((x) => x.team === 'A' && !x.rageOnly); s.setHumanLook(b, 'grunt'); s.player.body.pos.set(-30, 0.05, 20);
          b.alive = true; b.hp = 100; b.active = true; b.g.visible = true; b.respawnT = Infinity; b.yaw = Math.PI; b.state = 'patrol'; b.target = null;
          const P0 = new b.phys.pos.constructor(-28, 0, 8), out = [], foot = [];
          // 跑步機：每格讓機器人「往前走」SP 公尺／秒，但位置拉回原點，量腳踝在世界裡的移動（著地時應該不動＝往後移 SP）
          const fw = new b.phys.pos.constructor(); const step = () => {{ s.step(1/60); b.phys.vel.set({DIRV.split(',')[0]} * SP, 0, {DIRV.split(',')[2]} * SP); b.phys.pos.copy(P0); b.yaw = Math.PI; b.phys.onGround = true; s.humanPose(b, 1/60); }};
          for (let i = 0; i < 120; i++) step();
          const cyc = 1 / ((Math.min(3.3, Math.max(1.6, 1.55 + 0.42 * SP))) * 0.5), N = Math.round(cyc * 60);
          const c = s.camera, hid = [];
          for (let i = 0; i < N; i++) {{ step(); b.g.updateMatrixWorld(true);
            const fl = b.hm.bones[16].getWorldPosition(new b.phys.pos.constructor()), fr = b.hm.bones[17].getWorldPosition(new b.phys.pos.constructor());
            foot.push([+fl.y.toFixed(3), +fl.z.toFixed(3), +fr.y.toFixed(3), +fr.z.toFixed(3), +b.hm.bones[1].position.y.toFixed(3), +b.hm.bones[1].rotation.y.toFixed(3), +(b.hYaw||0).toFixed(3), +b.g.quaternion.y.toFixed(3), +(b.tLag||0).toFixed(3)]);
            if (i % Math.max(1, Math.round(N / 8)) === 0 && out.length < 8) {{ c.position.set(-28 - 2.6, 0.95, 8); c.lookAt(-28, 0.85, 8); c.updateMatrixWorld();
              const tmp = new s.scene.constructor(); tmp.background = s.scene.background; tmp.fog = null; const L = s.scene.children.filter((o) => o.isLight);
              for (const o of L) tmp.add(o); tmp.add(b.g); s.renderer.setRenderTarget(null); s.renderer.clear(true, true, true); s.renderer.render(tmp, c); for (const o of L) s.scene.add(o); s.scene.add(b.g); out.push(s.renderer.domElement.toDataURL('image/png')); }} }}
          for (const o of hid) o.visible = true; return [out, foot, N]; }}""")
        imgs, foot, N = r
        for i, u in enumerate(imgs): open(f'{OUT}/gait_{TAG}_{i}.png', 'wb').write(base64.b64decode(u.split(',')[1]))
        # 著地時（腳踝高度 < 0.1）腳踝的 z 每格應該往 +z 移 SP/60（身體往 +z 走，原地拉回 → 腳相對往 -z?）這裡只看「著地那段腳的速度」相對 SP
        import statistics
        for side, yi, zi in (('左', 0, 1), ('右', 2, 3)):
            v = [(foot[i + 1][zi] - foot[i][zi]) * 60 for i in range(len(foot) - 1) if foot[i][yi] < 0.095 and foot[i + 1][yi] < 0.095]
            print(side, '著地幀', len(v), '腳在世界中的速度（應接近 -' + str(SP) + '，身體不動、地面往後跑）', round(statistics.median(v), 2) if v else None)
        print('骨盆轉角、hYaw、整體轉向、tLag（每 6 幀）', [f[5:9] for f in foot[::6]]); hy = [f[4] for f in foot]; print('骨盆高度 最低', min(hy), '最高', max(hy), '週期幀數', N)
        print('ERR', [e for e in errors if '404' not in e][:3]); await browser.close()
asyncio.run(main())
