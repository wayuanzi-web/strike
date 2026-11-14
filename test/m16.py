"""M16 軍械庫：花紋塗裝、會晃的掛飾、貼紙、解鎖條件、軍械庫畫面。"""
import asyncio
from harness import *

async def main():
    async with async_playwright() as p:
        browser, page, errors = await open_game(p)
        ev = page.evaluate; res = []; ok = lambda n, c, i='': res.append((n, c, i))
        await ev("() => { const s = window.__strike; s.game.manual = true; s.S.autoFire = false; }")
        # 1 解鎖：1 級只有原廠、不掛、不貼；鎖住的裝不上；升到 30 級大部分解開，但成就、段位的還沒有
        r = await ev("""() => { const s = window.__strike, P = s.P(); P.xp = 0; s.applyCosmetics();
          const a = [s.equipArmory('skin', 'tiger'), s.equipArmory('charm', 'bear'), s.equipArmory('stk', 'flame', 0), P.skin, P.charm];
          P.xp = 1e7; const b = [s.equipArmory('skin', 'tiger'), s.equipArmory('charm', 'bear'), s.equipArmory('stk', 'flame', 0), s.equipArmory('skin', 'champion'), s.equipArmory('charm', 'badge'), s.equipArmory('skin', 'officer')];
          P.ach.arms_win = '2026-11-15'; s.RKS().placed = 5; s.RKS().rating = s.RKS().best = 1600; const c = [s.equipArmory('skin', 'champion'), s.equipArmory('charm', 'badge'), s.equipArmory('skin', 'officer')];
          return [a, b, c, P.stk]; }""")
        ok('1 解鎖：1 級裝不了虎紋、小熊、火焰；30 級可以，但冠軍金紋（成就）、段位徽章（定級）、軍官藍（段位少尉）要另外達成', r[0] == [False, False, False, 'base', 'none'] and r[1] == [True, True, True, False, False, False] and r[2] == [True, True, True] and r[3].startswith('flame|'), r)
        # 2 花紋塗裝：裝上會把花紋編號與三個顏色送進著色器；換回純色就關掉；軍備競賽的黃金手槍暫時蓋掉花紋、離開後恢復
        r = await ev("""() => { const s = window.__strike; s.equipArmory('skin', 'tiger'); const a = [s.PAT_U.uPat.value, s.PAT_U.uPA.value.getHexString()];
          s.equipArmory('skin', 'jade'); const b = s.PAT_U.uPat.value; s.equipArmory('skin', 'hex');
          s.startGame('arms'); s.player.armsLv = 6; s.player.armsK = 1; s.armsKill(s.player); s.step(1/60); s.step(1/60); const gold = s.PAT_U.uPat.value; s.backToMenu(); const back = s.PAT_U.uPat.value;
          s.renderer.compile(s.vmScene || s.scene, s.camera); return [a, b, gold, back]; }""")
        ok('2 花紋：虎紋送進著色器（編號 2、橘色）、換純色關掉、黃金手槍時暫停、離開軍備競賽恢復蜂巢（4）', r == [[2, 'd98a2b'], 0, 0, 4], r)
        # 3 貼紙：貼在槍身左側的平面上（射線打到表面），三個位置不重疊；每把槍都找得到位置
        r = await ev("""() => { const s = window.__strike; s.equipArmory('stk', 'flame', 0); s.equipArmory('stk', 'hs', 1); s.equipArmory('stk', 'skull', 2);
          const out = {}; for (const k of ['rifle', 'carbine', 'smg', 'shotgun', 'sniper', 'deagle', 'pistol']) { const g = s.VMODELS[k], sp = s.stickerSpots(g); out[k] = [sp.length, (g.userData.stk || []).length, sp.every((q) => q.n.x < -0.85), sp.length < 2 || Math.abs(sp[1].p.z - sp[0].p.z) > 0.03]; }
          return out; }""")
        ok('3 貼紙：每把槍左側都找到朝外的平面（步槍 3 個位置、不重疊），貼紙真的貼上', all(v[2] and v[3] and v[1] == min(3, v[0]) and v[0] >= 1 for v in r.values()) and r['rifle'][0] == 3, r)
        # 4 掛飾會晃：遊戲中槍一晃（開槍後座、轉身），鏈子角度變大，幾秒後回到垂下來
        r = await ev("""() => { const s = window.__strike; s.equipArmory('charm', 'bear'); s.startGame('practice'); s.game.freezeBots = true; for (let i = 0; i < 180; i++) s.step(1/60);
          const rest = +s.CHARM.ang.toFixed(3); let mx = 0; s.W.deployT = 0; s.INPUT.fire = true; for (let i = 0; i < 20; i++) { s.step(1/60); mx = Math.max(mx, s.CHARM.ang); } s.INPUT.fire = false;
          for (let i = 0; i < 400; i++) s.step(1/60); const settle = +s.CHARM.ang.toFixed(3);
          const hang = s.CHARM.mesh.position.y < s.CHARM.chain.position.y; return [rest, +mx.toFixed(3), settle, hang, s.CHARM.mesh.visible]; }""")
        ok('4 掛飾：開槍時甩起來（角度變大）、停下來幾秒後垂回去、在吊點下面', r[1] > r[0] + 0.15 and r[2] < 0.15 and r[3] and r[4], r)
        # 5 不掛：掛飾整個拿掉；切到狙擊開鏡（槍藏起來）掛飾也藏起來
        r = await ev("""() => { const s = window.__strike; s.equipArmory('charm', 'none'); const off = !s.CHARM.on && !s.scene.children.includes(s.CHARM.mesh); s.equipArmory('charm', 'dice'); s.step(1/60);
          s.getGun().visible = false; s.updateCharm(1/60); const hid = !s.CHARM.mesh.visible; s.getGun().visible = true; s.updateCharm(1/60); return [off, hid, s.CHARM.mesh.visible]; }""")
        ok('5 選「不掛」就拿掉；槍藏起來（狙擊開鏡）時掛飾也藏', r == [True, True, True], r)
        # 6 軍械庫畫面：主選單按鈕打開、選單藏起來、手上的槍畫在左邊；分頁、切換槍、點選裝上；關掉回選單
        r = await ev("""() => { const s = window.__strike; s.backToMenu(); const tap = (el) => { const o = { bubbles: true, pointerId: 5, pointerType: 'touch', isPrimary: true }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
          tap(document.getElementById('bArmory')); const open = !document.getElementById('armory').hidden && document.getElementById('menu').hidden;
          s.updateArmoryPreview(1/60); s.render(); const calls = s.renderer.info.render.calls;
          tap(document.querySelector('#arTabs [data-tab="charm"]')); tap(document.querySelector('#arList [data-id="star"]')); const charm = s.P().charm;
          tap(document.querySelector('#arGuns [data-gun="sniper"]')); const g = s.getGun() === s.VMODELS.sniper;
          tap(document.querySelector('#arTabs [data-tab="stk"]')); tap(document.querySelector('#arList [data-slot="2"]')); tap(document.querySelector('#arList [data-id="gg"]')); const stk = s.P().stk;
          const locked = document.querySelectorAll('#arList .sk[disabled]').length;
          tap(document.getElementById('arX')); const closed = document.getElementById('armory').hidden && !document.getElementById('menu').hidden;
          return [open, calls > 3, charm, g, stk.split('|')[2], closed, locked]; }""")
        ok('6 軍械庫：主選單打開（槍放大在左邊）、分頁、切換狙擊、點掛飾金星、貼紙位置 3 換 GG、關掉回選單', r[0] and r[1] and r[2] == 'star' and r[3] and r[4] == 'gg' and r[5], r)
        # 7 匯出、匯入帶著軍械庫的設定
        r = await ev("""() => { const s = window.__strike; const code = s.exportCode(); const P = s.P(); const keep = [P.skin, P.charm, P.stk]; P.skin = 'base'; P.charm = 'none'; P.stk = 'none|none|none';
          s.applyImport(s.parseCode(code).data); const Q = s.P(); return [keep, [Q.skin, Q.charm, Q.stk], s.CHARM.id]; }""")
        ok('7 匯出／匯入帶著塗裝、掛飾、貼紙', JSON.stringify if False else (r[0] == r[1] and r[2] == r[1][1]), r)
        for n, c, i in res: print('PASS' if c else 'FAIL', n, i)
        print('ERRORS', [e for e in errors if '404' not in e][:5])
        await browser.close()

asyncio.run(main())
