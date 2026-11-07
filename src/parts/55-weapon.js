/* ===== 55-weapon：步槍——瞬間命中的射線、部位倍率、後座力花紋、散佈、換彈、手上的槍 =====
   數值參考 CS 的突擊步槍（子代理研究報告），手機上把跑步散佈減半、自動開火改成點放。 */
const RIFLE = {
  name: '步槍', dmg: 36, rate: 0.1, mag: 30, reserve: 90, reload: 2.45, range: 160,
  armorPen: 0.775,                   // 打穿護甲後剩多少（機器人有護甲＋頭盔）
  falloff: 0.98,                     // 每 12.7 公尺傷害乘這個
  base: 0.25,                        // 站定第一發散佈（度）
  move: 5.0,                         // 全速跑時加多少（CS 約 10 度，手機減半）
  air: 7.0, land: 1.5,               // 空中、落地瞬間
  bloomAdd: 0.45, bloomMax: 4.0,     // 連射每發加多少、上限
  crouch: 0.75, ads: 0.4,
};
// 後座力花紋（子彈落點的累積偏移 [往上, 往左右] 度）：前九發一路往上，接著先往左飄、再往右、再往左
const PATTERN = (function () {
  const out = [[0, 0]]; let p = 0, y = 0;
  for (let i = 0; i < 30; i++) {
    p += (i < 9 ? 0.55 - i * 0.03 : 0.06) * 1.35;
    y += i < 9 ? (i % 2 ? 0.06 : -0.05) : i < 18 ? -0.26 : i < 24 ? 0.34 : -0.18;
    out.push([p, y]);
  }
  return out;
})();
const NOISE = []; function rollNoise() { for (let i = 0; i <= 31; i++) NOISE[i] = [1 + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.16]; }
rollNoise();
function patternAt(f) {
  const i = Math.floor(f), t = f - i, a = PATTERN[Math.min(i, 30)], b = PATTERN[Math.min(i + 1, 30)];
  const na = NOISE[Math.min(i, 31)], nb = NOISE[Math.min(i + 1, 31)];
  return [lerp(a[0] * na[0], b[0] * nb[0], t), lerp(a[1] + na[1] * Math.min(i, 3) / 3, b[1] + nb[1] * Math.min(i + 1, 3) / 3, t)];
}
// rp/ry：子彈的後座偏移（度）；畫面只跟 45%（VIEW_TRACK），準星可以畫到真正落點
const VIEW_TRACK = 0.45;
const W = { ammo: 30, reserve: 90, reloadT: 0, cd: 0, bloom: 0, idx: 0, since: 9, rp: 0, ry: 0, vp: 0, vpv: 0, land: 0, spread: 0.2,
  kick: 0, kickV: 0, roll: 0, flashT: 0, emptyClick: 0, shots: 0, hits: 0, autoN: 0, autoPause: 0, deployT: 0, dragging: false };
function resetWeapon() {
  W.ammo = RIFLE.mag; W.reserve = RIFLE.reserve; W.reloadT = 0; W.cd = 0; W.bloom = 0; W.idx = 0; W.rp = 0; W.ry = 0; W.vp = 0; W.vpv = 0;
  W.kick = 0; W.kickV = 0; W.land = 0; W.autoN = 0; W.autoPause = 0; W.deployT = 0.6;
}
const reloading = () => W.reloadT > 0;
function startReload() {
  if (W.reloadT > 0 || W.ammo >= RIFLE.mag || W.reserve <= 0 || !player.alive) return;
  W.reloadT = RIFLE.reload; player.ads = false; sfx('magout'); W.magIn = false;
}
// 現在的散佈（度）：跑到 34%（手機 40%）速度以上才開始變大；空中、落地瞬間更大；蹲、開鏡變小；連射越來越散
function currentSpread() {
  const sp = playerSpeed() / RUN_SPEED, th = INPUT.mode === 'touch' ? 0.4 : 0.34;
  let s = RIFLE.base + RIFLE.move * Math.max(0, (sp - th) / (1 - th)) + (player.body.onGround ? 0 : RIFLE.air) + W.land + W.bloom;
  if (player.crouch && player.body.onGround) s *= RIFLE.crouch;
  s *= lerp(1, RIFLE.ads, player.adsT);
  return s;
}
// 子彈真正的方向（含後座力）
function aimDir(out, extraYaw = 0, extraPitch = 0) {
  const Y = player.yaw + W.ry * DEG + extraYaw, P = player.pitch + W.rp * DEG + extraPitch;
  return out.set(-Math.sin(Y) * Math.cos(P), Math.sin(P), -Math.cos(Y) * Math.cos(P));
}
function decayTo0(v, dt) { const d = (Math.abs(v) * 8 + 18) * dt; return Math.abs(v) <= d ? 0 : v - Math.sign(v) * d; }

// auto：自動開火觸發的（不是手按的），dist：準星上敵人的距離
function updateWeapon(dt, wantFire, auto, dist) {
  W.cd -= dt; W.since += dt; W.flashT -= dt; W.emptyClick -= dt; W.autoPause -= dt;
  if (W.deployT > 0) W.deployT -= dt;
  if (W.reloadT > 0) {
    W.reloadT -= dt;
    if (!W.magIn && W.reloadT < RIFLE.reload * 0.45) { W.magIn = true; sfx('magin'); }
    if (W.reloadT <= 0) { W.reloadT = 0; const n = Math.min(RIFLE.mag - W.ammo, W.reserve); W.ammo += n; W.reserve -= n; }
  }
  // 自動開火的點放：中遠距離打 4 發停 0.28 秒，讓花紋與散佈回來；8 公尺內才全自動
  if (auto && dist > 8 && W.autoPause > 0) wantFire = false;
  if (!auto) W.autoN = 0;
  if (wantFire && player.alive && W.reloadT <= 0 && W.deployT <= 0) {
    if (W.ammo <= 0) {
      if (W.emptyClick <= 0) { sfx('empty'); W.emptyClick = 0.3; if (W.reserve <= 0) hudTip('沒子彈了：擊倒機器人補彈，或陣亡後補滿', 2); }
      startReload();
    } else if (W.cd <= 0) {
      shoot(); W.cd += RIFLE.rate; if (W.cd < 0) W.cd = 0;
      if (auto && dist > 8 && ++W.autoN >= 4) { W.autoN = 0; W.autoPause = 0.28; }
    }
  } else if (W.cd < 0) W.cd = 0;
  // 後座力：開火中往花紋走；停火後指數＋線性回正（CS 的回正方式）
  if (W.since < 0.11) {
    // 觸控很難邊打邊往下拉：手指沒在拖時自動補償一半的上飄
    const comp = INPUT.mode === 'touch' ? (W.dragging ? 0.75 : 0.5) : 1;
    const t = patternAt(W.idx), k = 1 - Math.exp(-dt * 30);
    W.rp += (t[0] * comp - W.rp) * k; W.ry += (t[1] - W.ry) * k;
  } else {
    W.rp = decayTo0(W.rp, dt); W.ry = decayTo0(W.ry, dt);
    W.idx = Math.max(0, W.idx - dt * 45);
    if (W.idx === 0 && W.since > 0.5) rollNoise();
  }
  if (W.since > 0.1) W.bloom *= Math.exp(-dt / 0.12);
  W.land = Math.max(0, W.land - dt * RIFLE.land / 0.25);
  // 每發額外的畫面小跳（只影響畫面，不影響子彈），彈簧回位
  W.vpv += (-260 * W.vp - 32 * W.vpv) * dt; W.vp += W.vpv * dt;
  // 手上的槍後座：臨界阻尼彈簧
  W.kickV += (-400 * W.kick - 40 * W.kickV) * dt; W.kick += W.kickV * dt; W.roll *= Math.exp(-dt * 14);
  W.spread = currentSpread();
}

const _o = new V3(), _d = new V3(), _hit = new V3(), _mz = new V3();
function shoot() {
  W.ammo--; W.since = 0; W.idx = Math.min(29, W.idx + 1); W.shots++;
  const spreadDeg = currentSpread();
  W.bloom = Math.min(RIFLE.bloomMax, W.bloom + RIFLE.bloomAdd);
  // 散佈圓內取一點：半徑取「亂數×散佈」，落點集中在中心（CS 的做法）
  const r = Math.random() * spreadDeg * DEG, a = Math.random() * Math.PI * 2;
  eyePos(_o); aimDir(_d, Math.cos(a) * r, Math.sin(a) * r);
  const res = traceShot(_o, _d, RIFLE.range);
  _hit.copy(_o).addScaledVector(_d, res.t);
  if (res.bot) {
    W.hits++;
    let dmg = RIFLE.dmg * PART_MUL[res.part] * Math.pow(RIFLE.falloff, res.t / 12.7);
    if (res.part !== 'legs') dmg *= RIFLE.armorPen;
    player.dealt += Math.min(dmg, Math.max(0, res.bot.hp)); player.dealtHits++;
    damageBot(res.bot, dmg, res.part, _d);
    // 血噴到後面 2.5 公尺內的牆上
    const bw = rayWorld(_hit, _d, 2.5); if (bw) addBloodSplat(_v2.copy(_hit).addScaledVector(_d, bw.t), bw.n);
    spawnPuff(_hit, '#9e1d16', res.part === 'head' ? 0.55 : 0.35, 0.35, 0.2);
    if (res.part === 'head') spawnSparks(_hit, _d, '#ffd27a', 5);
  } else if (res.n) {
    addDecal(_hit, res.n); spawnPuff(_hit, '#cfc6b6', 0.4, 0.5, 0.5);
    spawnSparks(_hit, _v1.set(res.n[0], res.n[1], res.n[2]), '#ffcf86', 3);
  }
  muzzleWorld(_mz);
  spawnTracer(_mz, _hit, '#ffe0a0', 0.028);
  muzzleLight(_mz, 1.3);
  W.flashT = 0.045;
  W.kickV += 2.2; W.roll = (Math.random() - 0.5) * 0.04;
  W.vpv += 9 + Math.random() * 3;                 // 約 0.5 度的畫面小跳
  ejectShell();
  sfx('shot');
  try { if (navigator.vibrate && INPUT.mode === 'touch') navigator.vibrate(8); } catch (e) { /* iPhone 不支援震動 */ }
  botsHearShot(player.body.pos);
}
// 一條射線：先找打到的牆，再看有沒有更近的機器人
function traceShot(o, d, range) {
  const w = rayWorld(o, d, range);
  let t = w ? w.t : range, bot = null, part = null;
  for (const b of bots) {
    if (!b.alive) continue;
    const h = rayBody(o, d, b.boxes, t);
    if (h) { t = h.t; bot = b; part = h.part; }
  }
  return { t, bot, part, n: bot ? null : (w ? w.n : null) };
}
function muzzleWorld(out) {
  const k = player.adsT;
  out.set(lerp(0.2, 0, k), lerp(-0.16, -0.06, k), -0.95);
  camera.updateMatrixWorld();
  return camera.localToWorld(out);
}

// ---------- 拋殼：黃銅小方塊從機匣右側彈出去（手上槍的場景裡） ----------
const shells = [];
(function () {
  const geo = new THREE.BoxGeometry(0.009, 0.009, 0.028), mat = new THREE.MeshLambertMaterial({ color: '#c99a3e', emissive: '#3a2608' });
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; vmScene.add(m); shells.push({ m, v: new V3(), w: new V3(), life: 0 }); }
})();
let shellI = 0;
function ejectShell() {
  const s = shells[shellI++ % shells.length];
  gunRig.updateMatrixWorld(true);
  s.m.position.copy(gun.localToWorld(_v1.set(0.045, 0.035, -0.12)));
  s.v.set(rand(0.9, 1.3), rand(0.9, 1.4), rand(0.1, 0.4)); s.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20));
  s.life = 0.6; s.m.visible = true;
}
function updateShells(dt) {
  for (const s of shells) {
    if (!s.m.visible) continue;
    s.life -= dt; if (s.life <= 0) { s.m.visible = false; continue; }
    s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
  }
}

// ---------- 手上的槍動畫：走路晃、跑步下沉、轉向甩、開火後座、落地下沉、出槍、換彈 ----------
const VM = { bobT: 0, swayX: 0, swayY: 0, landY: 0, landV: 0 };
const HIP = new V3(0.2, -0.205, -0.46), ADS = new V3(0, -0.09, -0.2);
function viewmodelLand(v) { VM.landV -= Math.min(0.5, v * 0.04); }
function updateViewmodel(dt, lookDX, lookDY) {
  const sp = playerSpeed(), moving = player.body.onGround ? Math.min(1, sp / RUN_SPEED) : 0;
  VM.bobT += dt * (5 + sp * 1.2) * (moving > 0.05 ? 1 : 0);
  VM.swayX = lerp(VM.swayX, clamp(-lookDX * 0.003, -0.04, 0.04), 1 - Math.exp(-8 * dt));
  VM.swayY = lerp(VM.swayY, clamp(lookDY * 0.003, -0.035, 0.035), 1 - Math.exp(-8 * dt));
  VM.landV += (-180 * VM.landY - 22 * VM.landV) * dt; VM.landY += VM.landV * dt;
  const k = player.adsT, bobA = moving * (1 - k * 0.8);
  gunRig.position.lerpVectors(HIP, ADS, k);
  gunRig.position.x += Math.sin(VM.bobT) * 0.012 * bobA + VM.swayX * (1 - k) * 0.6;
  gunRig.position.y += -Math.abs(Math.cos(VM.bobT)) * 0.012 * bobA + VM.swayY * (1 - k) * 0.4 - (player.body.onGround ? 0 : 0.02)
    - 0.015 * moving * (1 - k) + VM.landY * (1 - k * 0.7);
  gunRig.position.z += W.kick * lerp(0.04, 0.02, k);
  gunRig.rotation.set(W.kick * lerp(0.06, 0.02, k) + VM.swayY, VM.swayX * 1.5, W.roll);
  // 出槍：從畫面下方抬起來
  if (W.deployT > 0) { const d = W.deployT / 0.6; gunRig.position.y -= d * d * 0.25; gunRig.rotation.x -= d * d * 0.6; }
  // 換彈：槍往下歪、彈匣拔出再插回去
  const mag = gun.userData.mag;
  mag.position.y = -0.1; mag.visible = true;
  if (W.reloadT > 0) {
    const p = 1 - W.reloadT / RIFLE.reload, tilt = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    gunRig.rotation.z += tilt * 0.55; gunRig.rotation.x += tilt * 0.25; gunRig.position.y -= tilt * 0.06;
    if (p > 0.12 && p < 0.4) mag.position.y = -0.1 - (p - 0.12) / 0.28 * 0.3;
    else if (p >= 0.4 && p < 0.45) mag.visible = false;
    else if (p >= 0.45 && p < 0.56) mag.position.y = -0.1 - (0.56 - p) / 0.11 * 0.25;
  }
  flash.visible = W.flashT > 0;
  if (flash.visible) { flash.rotation.z = Math.random() * 6.28; const s = rand(0.8, 1.3); flash.scale.set(s, s, 1); }
  updateShells(dt);
}
