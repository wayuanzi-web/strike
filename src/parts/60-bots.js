/* ===== 60-bots：四個敵方機器人——巡邏、視線、反應時間、依距離決定準度、左右閃避 ===== */
const BOT_NAMES = ['鐵狼', '赤隼', '灰熊', '夜梟'];
const bots = [];
// 敵方「赤狼」：沙褐背心、橄欖色褲子、深灰頭盔，頭盔和左臂有鏽橘布條方便遠處辨識（原創配色）
const BOT_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
// 輪廓光：邊緣加一點暖光，遠處和陰影裡也看得出人形
function patchBotMat(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
    'outgoingLight += vec3(1.0, 0.75, 0.5) * pow(1.0 - abs(dot(normalize(normal), vec3(0.0, 0.0, 1.0))), 3.0) * 0.28;\n#include <opaque_fragment>'); };
  m.customProgramCacheKey = () => 'botrim'; return m;
}
const BOT_FLASH_MAT = new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const BOT_MUZZLE = new V3(0.16, 1.37, -0.84);
const BC = { vest: '#a08a62', plate: '#8c7852', shirt: '#7a7660', pants: '#5f6448', helmet: '#3e3f3a', skin: '#c08f6a', glove: '#2b2b2b',
  band: '#ff6a2a', boot: '#2a2622', gun: '#1f2226', pack: '#5b5442', goggle: '#16191d', pouch: '#6f5f45', belt: '#2f2b25' };
function makeBotModel() {
  const g = new THREE.Group(), mat = patchBotMat(BOT_MAT.clone());
  const body = new THREE.Group(); g.add(body);           // 蹲下時整個身體壓扁成蹲姿的高度
  const leg = (x) => {
    const L = new THREE.Group(); L.position.set(x, 0.85, 0); body.add(L);
    L.add(new THREE.Mesh(mergeParts([
      partBox(0.17, 0.44, 0.19, 0, -0.22, 0, BC.pants), partBox(0.15, 0.36, 0.17, 0, -0.62, 0.01, BC.pants),
      partBox(0.16, 0.11, 0.06, 0, -0.44, -0.1, BC.helmet), partBox(0.17, 0.1, 0.28, 0, -0.8, -0.04, BC.boot), partBox(0.18, 0.06, 0.08, 0, -0.08, -0.1, BC.pouch),
    ]), mat));
    return L;
  };
  const legL = leg(-0.11), legR = leg(0.11);
  const parts = [
    partBox(0.42, 0.62, 0.24, 0, 1.18, 0, BC.shirt), partBox(0.45, 0.38, 0.29, 0, 1.24, 0, BC.vest), partBox(0.4, 0.3, 0.02, 0, 1.25, -0.15, BC.plate),
    partBox(0.09, 0.11, 0.05, -0.11, 1.13, -0.17, BC.pouch), partBox(0.09, 0.11, 0.05, 0, 1.13, -0.17, BC.pouch), partBox(0.09, 0.11, 0.05, 0.11, 1.13, -0.17, BC.pouch),
    partBox(0.43, 0.06, 0.26, 0, 0.9, 0, BC.belt), partBox(0.28, 0.32, 0.12, 0, 1.22, 0.18, BC.pack), partBox(0.012, 0.28, 0.012, 0.09, 1.5, 0.2, '#3d4030'),
    partBox(0.22, 0.24, 0.23, 0, 1.63, 0, BC.skin),                                                    // 頭
    partBox(0.29, 0.13, 0.31, 0, 1.76, 0.01, BC.helmet), partBox(0.31, 0.03, 0.33, 0, 1.7, 0.01, BC.helmet),
    partBox(0.295, 0.035, 0.315, 0, 1.745, 0.01, BC.band),                                              // 頭盔布條
    partBox(0.05, 0.09, 0.09, -0.14, 1.64, 0, BC.helmet), partBox(0.05, 0.09, 0.09, 0.14, 1.64, 0, BC.helmet),
    partBox(0.2, 0.06, 0.03, 0, 1.66, -0.12, BC.goggle),
    // 手臂持槍：右手握握把、左手托護木
    partBox(0.11, 0.26, 0.11, 0.25, 1.36, -0.02, BC.shirt, 0.5), partBox(0.1, 0.1, 0.28, 0.2, 1.3, -0.2, BC.shirt, 0, 0.2), partBox(0.09, 0.08, 0.09, 0.16, 1.32, -0.34, BC.glove),
    partBox(0.11, 0.26, 0.11, -0.25, 1.36, -0.04, BC.shirt, 0.6), partBox(0.115, 0.06, 0.115, -0.25, 1.42, -0.03, BC.band, 0.6),
    partBox(0.1, 0.1, 0.32, -0.12, 1.32, -0.3, BC.shirt, 0, -0.45), partBox(0.09, 0.08, 0.09, -0.02, 1.35, -0.48, BC.glove),
    // 槍
    partBox(0.06, 0.09, 0.42, 0.16, 1.37, -0.38, BC.gun), partBox(0.035, 0.035, 0.26, 0.16, 1.39, -0.7, BC.gun), partBox(0.045, 0.16, 0.06, 0.16, 1.26, -0.42, BC.gun, 0.25),
    partBox(0.05, 0.08, 0.2, 0.16, 1.36, -0.08, '#3a342b'),
  ];
  const upper = new THREE.Group(); body.add(upper);       // 蹲下時上身整個往下移（不壓扁）
  upper.add(new THREE.Mesh(mergeParts(parts), mat));
  const fl = new THREE.Sprite(BOT_FLASH_MAT); fl.position.copy(BOT_MUZZLE); fl.scale.set(0.32, 0.32, 1); fl.visible = false; upper.add(fl);
  return { g, body, legL, legR, fl, upper, mat };
}

function makeBot(i) {
  const mdl = makeBotModel(); scene.add(mdl.g);
  const b = {
    name: BOT_NAMES[i], i, g: mdl.g, bodyGroup: mdl.body, legL: mdl.legL, legR: mdl.legR, fl: mdl.fl, upper: mdl.upper, mat: mdl.mat, litS: 1, ck: 0, tagT: 0, flinchT: 0, stepT: 0, lit: 1, dealt: 0,
    phys: { pos: new V3(), vel: new V3(), r: 0.35, h: STAND_H, onGround: true, jumped: false },
    yaw: 0, hp: 100, alive: true, state: 'patrol', path: null, pi: 0, waitT: 0,
    react: 0, settle: 0, lastSeen: new V3(), lostT: 0, visible: false, seeT: Math.random() * 0.1,
    strafe: 0, strafeT: 0, burst: 0, fireCd: 0, pauseT: 0, crouch: false,
    stuckT: 0, lastP: new V3(), deadT: 0, respawnT: 0, boxes: newBoxes(), walk: 0, pvis: false, searchT: 0, lookYaw: 0,
  };
  b.body = b.phys;   // 物理身體：玩家程式用 bot.body，機器人程式用 bot.phys，是同一個
  bots.push(b);
  return b;
}
function botSpawn(b, sx, sz) {
  const p = b.phys.pos; p.set(sx, 0, sz); b.phys.vel.set(0, 0, 0); b.phys.h = STAND_H;
  b.hp = 100; b.alive = true; b.state = 'patrol'; b.path = null; b.waitT = rand(0, 1); b.visible = false;
  b.deadT = 0; b.crouch = false; b.burst = 0; b.pauseT = 0; b.react = 0;
  b.yaw = Math.atan2(-(0 - sx), -(0 - sz)) + rand(-0.5, 0.5);  // 面向地圖中央
  b.g.visible = true; b.g.rotation.set(0, b.yaw, 0); b.g.position.copy(p);
  b.bodyGroup.scale.set(1, 1, 1); b.ck = 0; b.upper.position.y = 0;
  b.lastP.copy(p); b.stuckT = 0;
  hitBoxes(p, b.phys.h, b.boxes);
}
function initBots() {
  for (let i = 0; i < 4; i++) {
    const b = makeBot(i);
    const s = BOT_SPAWNS[i]; botSpawn(b, s[0], s[1]);
  }
}
// 重生點：離玩家夠遠、玩家看不到的地方
// 某點看不看得到玩家（腳、腰、頭三個高度任一條視線通就算看得到）
function pointSeesPlayer(x, z, pe) {
  for (const h of [0.3, 1.0, 1.6]) if (lineClear(pe, _v2.set(x, h, z))) return true;
  return false;
}
function respawnBot(b) {
  const pe = eyePos(new V3()), pp = player.body.pos;
  const cands = BOT_SPAWNS.map((s) => ({ x: s[0], z: s[1] }));
  // 只在玩家另一邊的半場找：離玩家 22 公尺以上
  for (let k = 0; k < 40; k++) { const n = pick(NAV.nodes); if (n.ok && n.nb.length && Math.hypot(n.x - pp.x, n.z - pp.z) > 22) cands.push({ x: n.x, z: n.z }); }
  let best = null, bs = -1e9;
  for (const c of cands) {
    const d = Math.hypot(c.x - pp.x, c.z - pp.z);
    const seen = player.alive && pointSeesPlayer(c.x, c.z, pe);
    const behind = player.alive && Math.abs(angDiff(player.yaw, Math.atan2(-(c.x - pp.x), -(c.z - pp.z)))) > 120 * DEG && d < 30;
    const crowd = bots.some((o) => o !== b && o.alive && Math.hypot(o.phys.pos.x - c.x, o.phys.pos.z - c.z) < 3);
    const score = Math.min(d, 45) - (seen ? 100 : 0) - (behind ? 40 : 0) - (crowd ? 30 : 0) + Math.random() * 8;
    if (score > bs) { bs = score; best = c; }
  }
  botSpawn(b, best.x, best.z);
}

const _be = new V3(), _pt = new V3(), _bd = new V3(), _end = new V3();
function botEye(b, out) { const p = b.phys.pos; return out.set(p.x, p.y + b.phys.h - 0.14, p.z); }
// 看不看得到玩家：距離、視野角度（巡邏 124 度、搜索 220 度、交戰中全方位）、視線有沒有被牆擋住
function botCanSee(b) {
  if (!player.alive) return false;
  const pp = player.body.pos, bp = b.phys.pos;
  const dx = pp.x - bp.x, dz = pp.z - bp.z, dist = Math.hypot(dx, dz);
  if (dist > 85) return false;
  const fov = b.state === 'patrol' ? 62 : b.state === 'search' ? 110 : 180;
  if (fov < 180 && dist > 3 && Math.abs(angDiff(b.yaw, Math.atan2(-dx, -dz))) > fov * DEG) return false;
  botEye(b, _be);
  if (lineClear(_be, _pt.set(pp.x, pp.y + player.body.h - 0.12, pp.z))) return true;
  if (lineClear(_be, _pt.set(pp.x, pp.y + player.body.h * 0.62, pp.z))) return true;
  return false;
}
function setPath(b, x, z) {
  b.path = findPath(b.phys.pos.x, b.phys.pos.z, x, z); b.pi = 0; b.stuckT = 0; b.lastP.copy(b.phys.pos);
}
function pickPatrol(b) {
  for (let k = 0; k < 12; k++) {
    const n = pick(NAV.nodes);
    if (!n.ok || !n.nb.length) continue;
    if (Math.hypot(n.x - b.phys.pos.x, n.z - b.phys.pos.z) < 12) continue;
    setPath(b, n.x, n.z); if (b.path && b.path.length) return;
  }
}
// 沿路徑走：回傳想要的速度向量（xz）
function followPath(b, speed, out) {
  out.set(0, 0, 0);
  if (!b.path || b.pi >= b.path.length) return false;
  const tgt = b.path[b.pi], p = b.phys.pos;
  const dx = tgt[0] - p.x, dz = tgt[1] - p.z, d = Math.hypot(dx, dz);
  if (d < 0.5) { b.pi++; return b.pi < b.path.length; }
  out.set(dx / d * speed, 0, dz / d * speed);
  return true;
}
// 攻擊令牌：同一時間最多 D.maxShooters 隻在開火，畫面內、比較近的優先
const SHOOT_TOKENS = new Set();
function inPlayerView(b) { const pp = player.body.pos; return Math.abs(angDiff(player.yaw, Math.atan2(-(b.phys.pos.x - pp.x), -(b.phys.pos.z - pp.z)))) < 75 * DEG; }
function tokenScore(b) { return Math.hypot(b.phys.pos.x - player.body.pos.x, b.phys.pos.z - player.body.pos.z) + (inPlayerView(b) ? 0 : 20); }
function wantToken(b, D) {
  for (const o of SHOOT_TOKENS) if (!o.alive || o.state !== 'combat' || !o.visible) SHOOT_TOKENS.delete(o);
  if (SHOOT_TOKENS.has(b)) return true;
  if (SHOOT_TOKENS.size < D.maxShooters) { SHOOT_TOKENS.add(b); return true; }
  let worst = null; for (const o of SHOOT_TOKENS) if (!worst || tokenScore(o) > tokenScore(worst)) worst = o;
  if (worst && tokenScore(b) < tokenScore(worst) - 3) { SHOOT_TOKENS.delete(worst); worst.pauseT = Math.max(worst.pauseT, 0.4); SHOOT_TOKENS.add(b); return true; }
  return false;
}
function turnTo(b, yaw, rate, dt) { const d = angDiff(b.yaw, yaw); b.yaw += clamp(d, -rate * dt, rate * dt); }

function botsHearShot(pos) {
  for (const b of bots) {
    if (!b.alive || b.state === 'combat' || b.state === 'cover' || b.state === 'flank') continue;
    if (b.state === 'search' && b.searchT > 3) continue;     // 已經在找了，不要一直重設
    const d = Math.hypot(pos.x - b.phys.pos.x, pos.z - b.phys.pos.z);
    if (d > 45) continue;
    b.state = 'search'; b.searchT = 9; b.lastSeen.set(pos.x + rand(-3, 3), 0, pos.z + rand(-3, 3));
    setPath(b, b.lastSeen.x, b.lastSeen.z);
  }
}
function damageBot(b, dmg, part, dir) {
  if (!b.alive) return;
  b.hp -= dmg;
  if (b.hp <= 0) {
    b.alive = false; b.hp = 0; b.deadT = 0; b.respawnT = 4.5; b.fallDir = Math.sign(Math.random() - 0.5);
    player.kills++; player.deathStreak = 0; W.reserve = Math.min(RIFLE.reserve, W.reserve + 15); if (part === 'head') player.heads++; SHOOT_TOKENS.delete(b);
    hudHit(part === 'head' ? 'kill head' : 'kill'); sfx('kill'); if (part === 'head') sfx('head');
    hudFeed('你', b.name, part === 'head', true);
    return;
  }
  hudHit(part === 'head' ? 'head' : 'hit'); sfx(part === 'head' ? 'head' : 'hit');
  // 中彈硬直：準度變差、連發中斷，先打中的人佔優勢
  b.flinchT = part === 'head' ? 0.6 : 0.35; b.tagT = 1.5; b.hitAnim = part === 'head' ? 0.2 : 0.15; b.hitHead = part === 'head'; b.settle = Math.min(1, b.settle + 0.5); if (b.burst > 1) b.burst = 1;
  // 血少了就找掩體躲一下（每條命最多兩次）
  if (b.hp < 55 && (b.coverUsed || 0) < 2 && b.state === 'combat' && Math.random() < 0.75) { if (seekCover(b)) return; }
  // 被打到：轉頭面向槍聲，馬上進入交戰（反應時間縮短）
  if (b.state !== 'combat') {
    b.lastSeen.copy(player.body.pos); b.state = 'search'; b.searchT = 8; setPath(b, b.lastSeen.x, b.lastSeen.z);
    b.alertYaw = Math.atan2(-(player.body.pos.x - b.phys.pos.x), -(player.body.pos.z - b.phys.pos.z));
  }
}

// 找掩體：10 公尺內、玩家看不到、離玩家比較遠的路點
function seekCover(b) {
  const pe = eyePos(new V3()), p = b.phys.pos; let best = null, bs = -1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 10 || d < 1.5) continue;
    if (pointSeesPlayer(n.x, n.z, pe)) continue;
    const dp = Math.hypot(n.x - player.body.pos.x, n.z - player.body.pos.z);
    const sc = -d * 1.2 + Math.min(dp, 25) * 0.4 + Math.random();
    if (sc > bs) { bs = sc; best = n; }
  }
  if (!best) return false;
  setPath(b, best.x, best.z); if (!b.path || !b.path.length) return false;
  b.state = 'cover'; b.coverT = 0; b.coverWait = rand(1.4, 2.6); b.coverUsed = (b.coverUsed || 0) + 1; SHOOT_TOKENS.delete(b);
  return true;
}
// 包抄：另一隻已經在打的時候，從側面繞過去（一次最多一隻）
function tryFlank(b) {
  if (bots.some((o) => o !== b && o.alive && o.state === 'flank')) return false;
  const pp = player.body.pos, p = b.phys.pos, ang = Math.atan2(p.z - pp.z, p.x - pp.x) + pick([-1, 1]) * rand(1.0, 1.4), r = clamp(Math.hypot(p.x - pp.x, p.z - pp.z), 9, 16);
  const tx = pp.x + Math.cos(ang) * r, tz = pp.z + Math.sin(ang) * r;
  const n = nearestNode(clamp(tx, -34, 34), clamp(tz, -24, 24)); if (!n) return false;
  setPath(b, n.x, n.z); if (!b.path || !b.path.length) return false;
  b.state = 'flank'; b.flankT = 9; SHOOT_TOKENS.delete(b);
  return true;
}

const _wish = new V3();
function updateBot(b, dt) {
  const p = b.phys.pos, D = DIFF[S.difficulty] || DIFF.normal;
  if (!b.alive) {
    b.deadT += dt; b.respawnT -= dt;
    const k = Math.min(1, b.deadT / 0.45);
    b.g.rotation.set(0, b.yaw, 0); b.g.rotateX(k * k * 1.57 * (b.fallDir > 0 ? 1 : -1)); b.g.rotateZ(k * 0.15 * b.fallDir);
    b.g.position.set(p.x, p.y + 0.12 * k, p.z);
    if ((b.deadT > 3.6 && !inPlayerView(b)) || b.deadT > 6) b.g.visible = false;   // 不在你視線內才收掉，不會看到屍體沉進地板
    b.fl.visible = false;
    if (b.respawnT <= 0) respawnBot(b);
    return;
  }
  if (b.flinchT > 0) b.flinchT -= dt;
  b.offT = inPlayerView(b) ? 0 : (b.offT || 0) + dt;
  // 感知：每 0.1 秒看一次
  b.seeT -= dt;
  if (b.seeT <= 0) {
    b.seeT = 0.1;
    const was = b.visible; b.visible = botCanSee(b);
    if (b.visible) {
      b.lastSeen.copy(player.body.pos); b.lostT = 0;
      const hiding = b.state === 'cover' && b.coverT < b.coverWait && b.phys.pos.distanceTo(player.body.pos) > 6;
      if (b.state !== 'combat' && !hiding) {
        // 剛發現：反應時間；背對你的要多花轉身的時間
        const need = Math.abs(angDiff(b.yaw, Math.atan2(-(player.body.pos.x - b.phys.pos.x), -(player.body.pos.z - b.phys.pos.z))));
        b.react = D.react * rand(0.8, 1.25) * (b.state === 'search' ? 0.85 : 1) + need / Math.PI * 0.45; b.settle = 1;
        b.state = 'combat'; b.strafeT = 0; b.burst = 0; b.pauseT = 0; b.warnLeft = D.warn;
        b.flankCheck = rand(1.0, 2.0);
      } else if (!was) {
        // 你躲起來再出來：要重新瞄準，躲得久還會再給一次警告射擊
        const hid = b.lostT;
        b.react = Math.max(b.react, D.react * (hid > 0.4 ? 0.8 : 0.45)); b.settle = Math.max(b.settle, hid > 0.4 ? 1 : 0.6);
        if (hid > 1.5) b.warnLeft = D.warn;
      }
    }
  }
  let speed = 0; _wish.set(0, 0, 0);
  const pp = player.body.pos, dx = pp.x - p.x, dz = pp.z - p.z, dist = Math.hypot(dx, dz);
  const toYaw = Math.atan2(-dx, -dz);
  b.crouchWant = false;

  if (b.state === 'combat') {
    if (!b.visible) {
      b.lostT += dt;
      if (b.lostT > 0.9 || !player.alive) { b.state = player.alive ? 'search' : 'patrol'; b.searchT = 7; if (player.alive) setPath(b, b.lastSeen.x, b.lastSeen.z); else b.path = null; }
    }
    turnTo(b, Math.atan2(-(b.lastSeen.x - p.x), -(b.lastSeen.z - p.z)), D.turn, dt);
    // 左右閃避：每隔一小段時間換方向，偶爾站定、蹲下打
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe = pick([-1, 1, -1, 1, 0]); b.strafeT = rand(0.35, 1.1);
      b.crouch = b.strafe === 0 && Math.random() < 0.35;
    }
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    let adv = 0; if (dist > 30) adv = 0.7; else if (dist < 5) adv = -0.6;
    if (!b.visible) adv = b.lostT > 1.5 ? 0.8 : 0;   // 你剛躲起來：先守著掩體邊緣，過一會兒才追
    const sv = b.crouch ? 0 : 3.3;
    _wish.set(rx * b.strafe * sv + fx * adv * 3.5, 0, rz * b.strafe * sv + fz * adv * 3.5);
    if (!b.visible && b.lostT > 0.3) { b.crouch = false; }
    b.crouchWant = b.crouch && b.visible;
    // 開火
    // 一直排不到開火（別人在打）就有機會去包抄
    if (b.flankCheck !== undefined && (b.flankCheck -= dt) <= 0) {
      b.flankCheck = undefined;
      if (!SHOOT_TOKENS.has(b) && SHOOT_TOKENS.size > 0 && dist > 8 && Math.random() < 0.6) tryFlank(b);
    }
    if (b.state === 'combat' && b.visible && player.alive) {
      b.react -= dt; b.settle = Math.max(0, b.settle - dt * 0.7);
      if (playerSpeed() > RUN_SPEED * 0.6) b.settle = Math.min(1, b.settle + dt * 0.5);   // 你一直跑，它就一直瞄不穩
      if (b.react <= 0 && wantToken(b, D)) {
        if (b.pauseT > 0) b.pauseT -= dt;
        else {
          if (b.burst <= 0) b.burst = Math.round(rand(D.burst[0], D.burst[1]));
          b.fireCd -= dt;
          if (b.fireCd <= 0 && Math.abs(angDiff(b.yaw, toYaw)) < 0.12) {
            botShoot(b, dist, D); b.burst--; b.fireCd = 0.11;
            if (b.burst <= 0) { b.pauseT = rand(D.pause[0], D.pause[1]); if (Math.random() < 0.3) SHOOT_TOKENS.delete(b); }
          }
        }
      }
    } else SHOOT_TOKENS.delete(b);
  } else if (b.state === 'cover') {
    // 跑去掩體、蹲著等一下（像在換彈），再探頭找你
    b.coverT += dt;
    if (followPath(b, 4.8, _wish)) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 8, dt);
    else { b.crouchWant = true; turnTo(b, Math.atan2(-(b.lastSeen.x - p.x), -(b.lastSeen.z - p.z)), 5, dt); }
    if (b.coverT > b.coverWait + 2.5 || (!b.path || b.pi >= b.path.length) && b.coverT > b.coverWait) {
      b.state = 'search'; b.searchT = 7; setPath(b, b.lastSeen.x, b.lastSeen.z);
    }
  } else if (b.state === 'flank') {
    b.flankT -= dt;
    if (followPath(b, 4.6, _wish)) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 7, dt);
    if (!b.path || b.pi >= b.path.length || b.flankT <= 0) { b.state = 'search'; b.searchT = 6; b.lastSeen.copy(player.body.pos); setPath(b, b.lastSeen.x, b.lastSeen.z); }
  } else if (b.state === 'search') {
    b.searchT -= dt;
    if (b.alertYaw !== undefined) { turnTo(b, b.alertYaw, 8, dt); if (Math.abs(angDiff(b.yaw, b.alertYaw)) < 0.1) b.alertYaw = undefined; }
    if (followPath(b, 4.4, _wish)) { if (b.alertYaw === undefined) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 7, dt); }
    else { b.yaw += dt * 1.6; }   // 到了就原地轉一圈看
    if (b.searchT <= 0) { b.state = 'patrol'; b.path = null; }
  } else {
    // 巡邏：沿路點圖走到隨機的遠處，偶爾停下來看看
    if (b.waitT > 0) { b.waitT -= dt; b.yaw += Math.sin(b.waitT * 2) * dt * 0.8; }
    else if (!followPath(b, 2.9, _wish)) { if (b.path) b.waitT = rand(0.6, 2); b.path = null; pickPatrol(b); }
    else turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt);
  }

  // 卡住了就換路
  if (_wish.lengthSq() > 0.5) {
    b.stuckT += dt;
    if (b.stuckT > 1.2) {
      if (p.distanceTo(b.lastP) < 0.4) {
        b.stuckN = (b.stuckN || 0) + 1;
        if (b.state === 'combat') b.strafe = -b.strafe;
        else if ((b.state === 'search' || b.state === 'flank' || b.state === 'cover') && b.stuckN < 2) setPath(b, b.lastSeen.x, b.lastSeen.z);
        else { b.state = 'patrol'; b.path = null; b.stuckN = 0; pickPatrol(b); }
      } else b.stuckN = 0;
      b.stuckT = 0; b.lastP.copy(p);
    }
  }
  // 被打中會變慢（CS 的 tagging），1.5 秒慢慢恢復
  if (b.tagT > 0) { b.tagT -= dt; const k2 = 0.35 + 0.65 * (1 - b.tagT / 1.5); _wish.x *= k2; _wish.z *= k2; }
  // 蹲
  if (b.crouchWant && !b.phys.crouched) { b.phys.h = CROUCH_H; b.phys.crouched = true; }
  else if (!b.crouchWant && b.phys.crouched && headroom(p.x, p.z, 0.3, p.y + CROUCH_H, p.y + STAND_H)) { b.phys.h = STAND_H; b.phys.crouched = false; }
  // 移動
  const k = 1 - Math.exp(-12 * dt);
  b.phys.vel.x += (_wish.x - b.phys.vel.x) * k; b.phys.vel.z += (_wish.z - b.phys.vel.z) * k;
  if (moveBody(b.phys, dt) && b.state === 'combat') { b.strafe = -b.strafe; b.strafeT = rand(0.3, 0.7); }
  // 機器人彼此推開
  for (const o of bots) {
    if (o === b || !o.alive) continue;
    const ex = p.x - o.phys.pos.x, ez = p.z - o.phys.pos.z, d = Math.hypot(ex, ez);
    if (d < 0.75 && d > 1e-4) { p.x += ex / d * (0.75 - d) * 0.5; p.z += ez / d * (0.75 - d) * 0.5; resolveXZ(b.phys); }
  }
  // 模型
  b.g.position.copy(p); b.g.rotation.set(0, b.yaw, 0);
  const sp = Math.hypot(b.phys.vel.x, b.phys.vel.z);
  b.walk += dt * sp * 2.6;
  const sw = Math.sin(b.walk) * Math.min(1, sp / 3) * 0.6;
  b.legL.rotation.x = sw; b.legR.rotation.x = -sw;
  // 中彈後仰、左右閃避時身體往移動方向傾
  if (b.hitAnim > 0) b.hitAnim -= dt;
  const lean = clamp((b.phys.vel.x * Math.cos(b.yaw) - b.phys.vel.z * Math.sin(b.yaw)) * -0.03, -0.12, 0.12);
  b.bodyGroup.rotation.set(Math.max(0, b.hitAnim || 0) * (b.hitHead ? 1.6 : 1.0), 0, lean);
  // 腳步聲（30 公尺內聽得到，有方位）
  if (sp > 2.6 && b.phys.onGround) { b.stepT -= dt; if (b.stepT <= 0) { b.stepT = 0.36 * RUN_SPEED / sp; if (p.distanceTo(player.body.pos) < 30) sfx('step', 0.9, { pos: p, surface: surfaceAt(p) }); } }
  // 槍口火光
  if (b.flashT > 0) { b.flashT -= dt; b.fl.visible = true; b.fl.material.rotation = Math.random() * 6; const fs = rand(0.26, 0.38); b.fl.scale.set(fs, fs, 1); } else b.fl.visible = false;
  // 是否在陽光下（影子長短用），每 0.25 秒算一次
  if ((b.litT = (b.litT || 0) - dt) <= 0) { b.litT = 0.25; b.lit = bakeRay(p.x, p.y + 0.3, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0; b.litC = bakeRay(p.x, p.y + 1.3, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0; }
  b.ck = lerp(b.ck, b.phys.crouched ? 1 : 0, 1 - Math.exp(-15 * dt));
  b.upper.position.y = -0.6 * b.ck;
  b.legL.position.y = b.legR.position.y = 0.85 - 0.55 * b.ck;
  b.legL.rotation.x = sw * (1 - b.ck) - 1.2 * b.ck; b.legR.rotation.x = -sw * (1 - b.ck) + 0.9 * b.ck;   // 一腳往前、一腳跪
  // 受光：在陰影裡就暗一點
  b.litS = lerp(b.litS, b.litC === undefined ? 1 : b.litC, 1 - Math.exp(-4 * dt)); b.mat.color.setScalar(lerp(0.55, 1, b.litS));
  hitBoxes(p, b.phys.h, b.boxes);
}

// 機器人開槍：瞄準胸口，誤差 = 基本誤差 + 距離 × 係數 + 自己在動 + 你在動 + 剛發現時手還不穩
function botShoot(b, dist, D) {
  const pp = player.body.pos;
  botEye(b, _be);
  // 開火前再確認一次看得到（感知 0.1 秒才更新一次，避免你剛躲起來還朝牆打）
  if (!lineClear(_be, _pt.set(pp.x, pp.y + player.body.h - 0.12, pp.z)) && !lineClear(_be, _pt.set(pp.x, pp.y + player.body.h * 0.62, pp.z))) { b.visible = false; return; }
  if (player.spawnT > 0) return;       // 你剛重生的保護時間
  _pt.set(pp.x, pp.y + player.body.h * 0.7, pp.z);
  // 警告射擊：剛發現你、或你在它背後畫面外的前 1 秒，子彈從你頭邊飛過
  let forceMiss = false;
  if (b.warnLeft > 0) { b.warnLeft--; forceMiss = true; }
  if (D.mercy && b.offT > 0 && b.offT < 1.0) forceMiss = true;
  if (forceMiss) {
    const side = Math.random() < 0.5 ? -1 : 1, rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), off = rand(0.6, 0.95);
    _pt.x += rx * side * off; _pt.z += rz * side * off; _pt.y = pp.y + player.body.h + rand(0.15, 0.45);
  }
  _bd.subVectors(_pt, _be).normalize();
  const moving = Math.hypot(b.phys.vel.x, b.phys.vel.z) > 1 ? 1 : 0;
  let errDeg = D.base + dist * D.distK + moving * 1.0 + (playerSpeed() / RUN_SPEED) * D.pMoveK + b.settle * D.settleK + (b.phys.crouched ? -0.2 : 0) + (b.flinchT > 0 ? 3.5 : 0);
  if (D.mercy && b.offT > 0) errDeg *= 1.6;
  // 你血少、連死時，機器人手會抖一點（動態難度，困難沒有）
  if (D.mercy) {
    const hpK = player.hp < 40 ? 1 + (40 - player.hp) / 40 * 0.5 : 1, streakK = 1 + Math.min(player.deathStreak || 0, 3) * 0.12;
    errDeg *= hpK * streakK;
  }
  if (forceMiss) errDeg = Math.min(errDeg, 1.2);
  const yaw = Math.atan2(-_bd.x, -_bd.z) + gauss() * errDeg * 0.5 * DEG;
  const pitch = Math.asin(clamp(_bd.y, -1, 1)) + gauss() * errDeg * 0.5 * DEG;
  _bd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const w = rayWorld(_be, _bd, 160);
  let t = w ? w.t : 160;
  const h = player.alive && !forceMiss ? rayBody(_be, _bd, player.boxes, t) : null;
  if (h) t = h.t;
  const end = _end.copy(_be).addScaledVector(_bd, t);
  b.g.updateMatrixWorld();
  const mz = b.fl.getWorldPosition(_v3);
  spawnTracer(mz, end, '#ff9a6a', 0.018, true);
  if (h) {
    let dmg = 25 * (h.part === 'head' ? D.headMul : PART_MUL[h.part]) * D.dmg;
    if (D.mercy && player.hp > 50 && player.hp - dmg <= 0) dmg = player.hp - 1;   // 血量一半以上時不會被一發打死（困難沒有）
    damagePlayer(dmg, b, h.part);
  }
  else if (w) addDecal(end, w.n);
  sfx('botshot', 1, { pos: b.phys.pos });
  muzzleLight(mz, 1.0);
  b.flashT = 0.05; b.firedAt = game.t;
}
