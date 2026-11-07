/* ===== 55-weapon：步槍——瞬間命中的射線、部位倍率、後座力花紋、散佈、換彈、手上的槍 ===== */
const RIFLE = {
  name: '步槍', dmg: 30, rate: 0.1, mag: 30, reload: 2.3, range: 160,
  base: 0.22,      // 站著不動的第一發散佈（度）
  move: 2.6,       // 全速跑時加多少
  air: 5.5,        // 在空中加多少
  bloomAdd: 0.34, bloomMax: 3.0, bloomDecay: 5.5,
  crouch: 0.65, ads: 0.4,
};
// 後座力花紋（累積的 [往上, 往左右] 度數）：前十發一路往上，接著先往左飄、再往右飄
const PATTERN = (function () {
  const out = [[0, 0]]; let p = 0, y = 0;
  for (let i = 0; i < 30; i++) {
    p += i < 9 ? 0.55 - i * 0.03 : 0.06;
    y += i < 9 ? (i % 2 ? 0.06 : -0.05) : i < 18 ? -0.26 : i < 24 ? 0.34 : -0.18;
    out.push([p, y]);
  }
  return out;
})();
function patternAt(f) {
  const i = Math.floor(f), t = f - i, a = PATTERN[Math.min(i, 30)], b = PATTERN[Math.min(i + 1, 30)];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
const W = { ammo: 30, reloadT: 0, cd: 0, bloom: 0, idx: 0, since: 9, rp: 0, ry: 0, spread: 0.2, kick: 0, flashT: 0, emptyClick: 0, shots: 0, hits: 0 };
function resetWeapon() { W.ammo = RIFLE.mag; W.reloadT = 0; W.cd = 0; W.bloom = 0; W.idx = 0; W.rp = 0; W.ry = 0; W.kick = 0; }
const reloading = () => W.reloadT > 0;
function startReload() {
  if (W.reloadT > 0 || W.ammo >= RIFLE.mag || !player.alive) return;
  W.reloadT = RIFLE.reload; player.ads = false; sfx('magout'); W.magIn = false;
}
// 現在的散佈（度）：移動、跳躍會變大，蹲下、開鏡會變小，連射會越來越散
function currentSpread() {
  const sp = playerSpeed() / RUN_SPEED;
  let s = RIFLE.base + RIFLE.move * Math.max(0, (sp - 0.12) / 0.88) + (player.body.onGround ? 0 : RIFLE.air) + W.bloom;
  if (player.crouch && player.body.onGround) s *= RIFLE.crouch;
  s *= lerp(1, RIFLE.ads, player.adsT);
  return s;
}
// 準星正中央的方向（含後座力）
function aimDir(out, extraYaw = 0, extraPitch = 0) {
  const Y = player.yaw + W.ry * DEG + extraYaw, P = player.pitch + W.rp * DEG + extraPitch;
  return out.set(-Math.sin(Y) * Math.cos(P), Math.sin(P), -Math.cos(Y) * Math.cos(P));
}
function updateWeapon(dt, wantFire) {
  W.cd -= dt; W.since += dt; W.flashT -= dt; W.emptyClick -= dt;
  if (W.reloadT > 0) {
    W.reloadT -= dt;
    if (!W.magIn && W.reloadT < RIFLE.reload * 0.35) { W.magIn = true; sfx('magin'); }
    if (W.reloadT <= 0) { W.reloadT = 0; W.ammo = RIFLE.mag; }
  }
  if (wantFire && player.alive && W.reloadT <= 0) {
    if (W.ammo <= 0) { if (W.emptyClick <= 0) { sfx('empty'); W.emptyClick = 0.3; } startReload(); }
    else if (W.cd <= 0) { shoot(); W.cd += RIFLE.rate; if (W.cd < 0) W.cd = 0; }
  } else if (W.cd < 0) W.cd = 0;
  // 停火後回正：花紋的位置往回退，畫面跟著回到原位
  if (W.since > 0.11) W.idx = Math.max(0, W.idx - dt * 55);
  const t = patternAt(W.idx), k = 1 - Math.exp(-dt * (W.since < 0.11 ? 30 : 12));
  W.rp += (t[0] - W.rp) * k; W.ry += (t[1] - W.ry) * k;
  if (W.since > 0.09) W.bloom = Math.max(0, W.bloom - RIFLE.bloomDecay * dt);
  W.spread = currentSpread();
  W.kick *= Math.exp(-dt * 16);
}

const _o = new V3(), _d = new V3(), _hit = new V3(), _mz = new V3();
function shoot() {
  W.ammo--; W.since = 0; W.idx = Math.min(29, W.idx + 1); W.shots++;
  const spreadDeg = currentSpread();
  W.bloom = Math.min(RIFLE.bloomMax, W.bloom + RIFLE.bloomAdd);
  // 在散佈圓內均勻取一點
  const r = Math.sqrt(Math.random()) * spreadDeg * DEG, a = Math.random() * Math.PI * 2;
  eyePos(_o); aimDir(_d, Math.cos(a) * r, Math.sin(a) * r);
  const res = traceShot(_o, _d, RIFLE.range);
  _hit.copy(_o).addScaledVector(_d, res.t);
  if (res.bot) {
    W.hits++;
    damageBot(res.bot, RIFLE.dmg * PART_MUL[res.part], res.part, _d);
    spawnPuff(_hit, '#b3261e', 0.35, 0.35, 0.2);
  } else if (res.n) {
    addDecal(_hit, res.n); spawnPuff(_hit, '#cfc6b6', 0.4, 0.5, 0.5);
    if (Math.random() < 0.4) sfx('ping', 0.6);
  }
  // 彈道線從槍口出發
  muzzleWorld(_mz);
  spawnTracer(_mz, _hit, '#ffe0a0', 0.028);
  W.flashT = 0.045; W.kick = 1;
  sfx('shot');
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
  // 依開鏡程度在腰射位置與準心之間插值（攝影機空間）
  const k = player.adsT;
  out.set(lerp(0.2, 0, k), lerp(-0.16, -0.06, k), -0.95);
  camera.updateMatrixWorld();
  return camera.localToWorld(out);
}

// ---------- 手上的槍動畫：走路晃、轉向時甩、開火後座、換彈 ----------
const VM = { bobT: 0, swayX: 0, swayY: 0 };
const HIP = new V3(0.2, -0.205, -0.46), ADS = new V3(0, -0.09, -0.2);
function updateViewmodel(dt, lookDX, lookDY) {
  const sp = playerSpeed(), moving = player.body.onGround ? Math.min(1, sp / RUN_SPEED) : 0;
  VM.bobT += dt * (5 + sp * 1.2) * (moving > 0.05 ? 1 : 0);
  VM.swayX = lerp(VM.swayX, clamp(-lookDX * 0.004, -0.06, 0.06), 1 - Math.exp(-10 * dt));
  VM.swayY = lerp(VM.swayY, clamp(lookDY * 0.004, -0.05, 0.05), 1 - Math.exp(-10 * dt));
  const k = player.adsT, bobA = moving * (1 - k * 0.8);
  gunRig.position.lerpVectors(HIP, ADS, k);
  gunRig.position.x += Math.sin(VM.bobT) * 0.012 * bobA + VM.swayX * (1 - k) * 0.6;
  gunRig.position.y += -Math.abs(Math.cos(VM.bobT)) * 0.012 * bobA + VM.swayY * (1 - k) * 0.4 - (player.body.onGround ? 0 : 0.02);
  gunRig.position.z += W.kick * lerp(0.05, 0.025, k);
  gunRig.rotation.set(W.kick * lerp(0.07, 0.025, k) + VM.swayY, VM.swayX * 1.5, 0);
  // 換彈：槍往下歪、彈匣拔出再插回去
  const mag = gun.userData.mag;
  mag.position.y = -0.1; mag.visible = true;
  if (W.reloadT > 0) {
    const p = 1 - W.reloadT / RIFLE.reload, tilt = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    gunRig.rotation.z += tilt * 0.55; gunRig.rotation.x += tilt * 0.25; gunRig.position.y -= tilt * 0.06;
    if (p > 0.12 && p < 0.42) mag.position.y = -0.1 - (p - 0.12) / 0.3 * 0.3;
    else if (p >= 0.42 && p < 0.55) mag.visible = false;
    else if (p >= 0.55 && p < 0.68) mag.position.y = -0.1 - (0.68 - p) / 0.13 * 0.25;
  }
  // 火光
  flash.visible = W.flashT > 0;
  if (flash.visible) { flash.rotation.z = Math.random() * 6.28; const s = rand(0.8, 1.3); flash.scale.set(s, s, 1); }
}
