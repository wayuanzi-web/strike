/* ===== 69-tutorial：新手教學——10 步，每步一句說明、做到就自動下一步（可以跳過）
   移動 → 轉視角 → 開火 → 換彈 → 蹲與跳 → 開鏡打遠靶 → 換槍 → 丟手榴彈 → 購買 → 裝彈。
   靶子是不會還手的機器人；光柱標出要去或要看的地方。位置都從路點挑，所以每張地圖都能用。 */
const TUT = { on: false, i: 0, t: 0, okT: 0, dummy: null, target: new V3(), wasAlive: false, jumped: false, crouched: false };
// 光柱：一根半透明的黃色圓柱，會呼吸
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: '#ffc43c', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
beacon.visible = false; scene.add(beacon);
const isKb = () => INPUT.mode === 'kb';
// 從路點挑一個點：距離在範圍內、（需要的話）看得到
function tutSpot(minD, maxD, needLos) {
  const p = player.body.pos, e = eyePos(new V3()); let best = null, bs = -1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < minD || d > maxD) continue;
    if (needLos && !lineClear(e, _v1.set(n.x, 1.2, n.z))) continue;
    const front = -Math.cos(angDiff(player.yaw, Math.atan2(-(n.x - p.x), -(n.z - p.z))));
    const sc = (needLos ? -front : 0) + Math.random() * 0.5 - Math.abs(d - (minD + maxD) / 2) * 0.05;
    if (sc > bs) { bs = sc; best = n; }
  }
  return best ? new V3(best.x, 0, best.z) : new V3(p.x + minD, 0, p.z);
}
function tutDummy(at) {
  const b = bots.find((x) => x.team === 'B' && !x.alive) || bots[0];
  b.active = true; botSpawn(b, at.x, at.z, player.body.pos.x, player.body.pos.z); b.dummy = true; b.vest = b.helmet = false;
  TUT.dummy = b; return b;
}
const TUT_STEPS = [
  { title: '移動', text: () => isKb() ? 'WASD 移動，走到黃色光柱' : '左手按住螢幕左半邊拖曳移動（推到底是跑），走到黃色光柱',
    start() { TUT.target.copy(tutSpot(8, 13, false)); }, done: () => Math.hypot(player.body.pos.x - TUT.target.x, player.body.pos.z - TUT.target.z) < 1.8 },
  { title: '轉視角', text: () => isKb() ? '移動滑鼠轉視角，把準星對準光柱' : '右手在螢幕右半邊拖曳轉視角，把準星對準光柱',
    start() { const p = player.body.pos, a = player.yaw + Math.PI * 0.8; TUT.target.set(p.x - Math.sin(a) * 9, 0, p.z - Math.cos(a) * 9); },
    done() { const p = player.body.pos, want = Math.atan2(-(TUT.target.x - p.x), -(TUT.target.z - p.z)); return Math.abs(angDiff(player.yaw, want)) < 0.14; } },
  { title: '開火', text: () => isKb() ? '準星對準靶子，按滑鼠左鍵開火' : '準星對準靶子按開火鍵（按住會連發）。「自動開火」開著時，對到敵人就會自己開',
    start() { tutDummy(tutSpot(8, 13, true)); }, done: () => TUT.dummy && !TUT.dummy.alive },
  { title: '換彈', text: () => isKb() ? '按 R 換彈' : '按換彈鍵（圓形箭頭）。子彈打完也會自動換',
    start() { W.ammo = Math.min(W.ammo, 6); }, done: () => W.reloadT > 0 },
  { title: '蹲下、跳', text: () => isKb() ? '按 C 蹲下，再按空白鍵跳' : '按蹲鍵（再按一次站起來），再按跳鍵（往上的箭頭）',
    start() { TUT.crouched = TUT.jumped = false; }, done() { if (player.crouch) TUT.crouched = true; if (!player.body.onGround) TUT.jumped = true; return TUT.crouched && TUT.jumped; } },
  { title: '開鏡打遠靶', text: () => isKb() ? '按右鍵開鏡（放大、比較準），打倒遠處的靶子' : '按開鏡鍵（十字圈）放大、比較準，打倒遠處的靶子',
    start() { tutDummy(tutSpot(18, 30, true)); TUT.adsKill = false; },
    done() { if (TUT.dummy && !TUT.dummy.alive) { if (player.adsT > 0.5 || TUT.adsWas) return true; tutDummy(TUT.dummy.phys.pos.clone()); hudTip('要開鏡再打喔', 1.5); } TUT.adsWas = player.adsT > 0.5; return false; } },
  { title: '換槍', text: () => isKb() ? '按 2 或 Q 拿出手槍，再按 1 換回步槍' : '按「換槍」拿出手槍，再按一次換回步槍',
    start() { TUT.pistol = false; }, done() { if (INV.cur === 'secondary') TUT.pistol = true; return TUT.pistol && INV.cur === 'primary'; } },
  { title: '丟手榴彈', text: () => isKb() ? '按 G 拿出手榴彈，按左鍵丟出去（往上看會丟比較遠）' : '按「投擲」拿出手榴彈，按開火鍵丟出去（往上看會丟比較遠）',
    start() { INV.he = 1; TUT.thrown = false; }, done() { if (nadesLive.length) TUT.thrown = true; return TUT.thrown && INV.he === 0; } },
  { title: '購買', text: () => isKb() ? '按 B 打開購買選單，買一把衝鋒槍（教學裡免費）' : '按左上角「購買」，買一把衝鋒槍（教學裡免費）',
    start() {}, done: () => INV.primary && INV.primary.def === WEAPONS.smg },
  { title: '裝炸彈', text: () => isKb() ? `你帶著炸彈：走到光柱（包點 A 的黃框裡），按住 E 裝彈` : `你帶著炸彈：走到光柱（包點 A 的黃框裡），按住「裝彈」3 秒`,
    start() { closeBuy(); giveBomb(player); const s = SITES.A, pp = s.plants[0]; TUT.target.set(pp[0], 0, pp[1]); hudTip('', 0.01); },
    done: () => BOMB.state === 'planted' },
];
function startTutorial() {
  game.mode = 'tutorial'; setupBots('tutorial'); clearNades(); resetBomb();
  INV.primary = INV.secondary = null; INV.he = INV.flash = INV.smoke = 0;
  spawnPlayer(MAP.playerSpawns[0]); player.kills = player.deaths = player.heads = 0;
  TUT.on = true; TUT.i = -1; TUT.dummy = null;
  enterPlay(); $('tip').hidden = true; tipT = 0; $('tut').hidden = false; tutNext();
}
function tutNext() {
  TUT.i++; TUT.okT = 0; TUT.t = 0;
  for (const b of bots) if (b.dummy && b !== TUT.dummy) { b.alive = false; b.g.visible = false; }
  if (TUT.i >= TUT_STEPS.length) { tutFinish(); return; }
  const st = TUT_STEPS[TUT.i]; st.start();
  $('tutN').textContent = `${TUT.i + 1} / ${TUT_STEPS.length}`; $('tutT').textContent = st.title; $('tutX').textContent = st.text();
}
function tutFinish() {
  TUT.on = false; beacon.visible = false; $('tut').hidden = true;
  STATS.tutorialDone = true; saveStats(); resetBomb();
  hudBanner('教學完成！', '可以開始對戰了', 3, 'win'); sfx('win');
  $('tutDone').hidden = false; resetTouchState();
  if (pointerLocked()) document.exitPointerLock();
}
function updateTutorial(dt) {
  if (!TUT.on || game.mode !== 'tutorial') return;
  updatePlayerUse(dt);    // 按住裝彈（教學不跑回合，所以在這裡算）
  const st = TUT_STEPS[TUT.i]; if (!st) return;
  TUT.t += dt;
  // 光柱：在目標（或靶子）上
  const tg = TUT.dummy && TUT.dummy.alive && (TUT.i === 2 || TUT.i === 5) ? TUT.dummy.phys.pos : (TUT.i === 0 || TUT.i === 1 || TUT.i === 9) ? TUT.target : null;
  beacon.visible = !!tg && TUT.okT === 0;
  if (tg) { beacon.position.set(tg.x, 3.5, tg.z); beacon.material.opacity = 0.25 + 0.15 * Math.sin(game.t * 4); }
  if (TUT.t > 0.4 && TUT.okT === 0) $('tutX').textContent = st.text();   // 換了操作方式（觸控／鍵盤）說明跟著換
  if (TUT.okT > 0) { TUT.okT += dt; if (TUT.okT > 0.9) tutNext(); return; }
  if (st.done()) { TUT.okT = 0.001; sfx('go'); $('tutX').textContent = '✓ 很好！'; }
}
onTap($('tutSkip'), () => { if (TUT.on) { TUT.okT = 0.85; } });
onTap($('tutMatch'), () => { $('tutDone').hidden = true; startGame('match'); });
onTap($('tutMenu'), () => { $('tutDone').hidden = true; backToMenu(); });
