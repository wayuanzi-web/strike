/* ===== 60-bots：四個敵方機器人——巡邏、視線、反應時間、依距離決定準度、左右閃避 ===== */
const BOT_NAMES = ['鐵狼', '赤隼', '灰熊', '夜梟'];
const bots = [];
const BOT_MAT = {
  vest: new THREE.MeshLambertMaterial({ color: '#b5402c' }), pants: new THREE.MeshLambertMaterial({ color: '#3b3a40' }),
  skin: new THREE.MeshLambertMaterial({ color: '#c99a72' }), helmet: new THREE.MeshLambertMaterial({ color: '#3f3b36' }),
  gun: new THREE.MeshLambertMaterial({ color: '#202328' }), boot: new THREE.MeshLambertMaterial({ color: '#2a2622' }),
};
const BOT_MUZZLE = new V3(0.16, 1.36, -0.78);
function makeBotModel() {
  const g = new THREE.Group(), m = BOT_MAT;
  const body = new THREE.Group(); g.add(body);           // 蹲下時整個身體壓扁成蹲姿的高度
  const leg = (x) => { const L = new THREE.Group(); L.position.set(x, 0.85, 0); body.add(L);
    boxMesh(0.17, 0.75, 0.2, 0, 0, -0.38, 0, L, m.pants); boxMesh(0.18, 0.1, 0.27, 0, 0, -0.8, -0.03, L, m.boot); return L; };
  const legL = leg(-0.11), legR = leg(0.11);
  boxMesh(0.48, 0.66, 0.28, 0, 0, 1.18, 0, body, m.vest);
  boxMesh(0.25, 0.27, 0.25, 0, 0, 1.64, 0, body, m.skin);
  boxMesh(0.3, 0.12, 0.3, 0, 0, 1.79, 0.01, body, m.helmet);
  boxMesh(0.2, 0.05, 0.03, 0, 0, 1.68, -0.13, body, m.helmet);   // 護目鏡，讓人看得出臉朝哪
  const armR = boxMesh(0.11, 0.11, 0.42, 0, 0.21, 1.33, -0.18, body, m.vest); armR.rotation.y = 0.15;
  const armL = boxMesh(0.11, 0.11, 0.46, 0, -0.14, 1.33, -0.26, body, m.vest); armL.rotation.y = -0.45;
  boxMesh(0.06, 0.09, 0.64, 0, 0.16, 1.36, -0.45, body, m.gun);
  return { g, body, legL, legR };
}

function makeBot(i) {
  const mdl = makeBotModel(); scene.add(mdl.g);
  const b = {
    name: BOT_NAMES[i], i, g: mdl.g, bodyGroup: mdl.body, legL: mdl.legL, legR: mdl.legR,
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
  b.bodyGroup.scale.set(1, 1, 1);
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
function respawnBot(b) {
  const pe = eyePos(new V3());
  const cands = BOT_SPAWNS.map((s) => ({ x: s[0], z: s[1] }));
  for (let k = 0; k < 30; k++) { const n = pick(NAV.nodes); if (n.ok && n.nb.length) cands.push({ x: n.x, z: n.z }); }
  let best = null, bs = -1e9;
  for (const c of cands) {
    const d = Math.hypot(c.x - player.body.pos.x, c.z - player.body.pos.z);
    const seen = lineClear(pe, _v2.set(c.x, 1.5, c.z));
    const crowd = bots.some((o) => o !== b && o.alive && Math.hypot(o.phys.pos.x - c.x, o.phys.pos.z - c.z) < 2);
    const score = Math.min(d, 40) - (seen ? 60 : 0) - (crowd ? 30 : 0) + Math.random() * 6;
    if (score > bs) { bs = score; best = c; }
  }
  botSpawn(b, best.x, best.z);
}

const _be = new V3(), _pt = new V3(), _bd = new V3(), _end = new V3();
function botEye(b, out) { const p = b.phys.pos; return out.set(p.x, p.y + b.phys.h - 0.14, p.z); }
// 看不看得到玩家：距離、視野角度（警戒中是全方位）、視線有沒有被牆擋住
function botCanSee(b) {
  if (!player.alive) return false;
  const pp = player.body.pos, bp = b.phys.pos;
  const dx = pp.x - bp.x, dz = pp.z - bp.z, dist = Math.hypot(dx, dz);
  if (dist > 85) return false;
  const aware = b.state !== 'patrol';
  if (!aware && dist > 3) {
    const fwdYaw = b.yaw, toYaw = Math.atan2(-dx, -dz);
    if (Math.abs(angDiff(fwdYaw, toYaw)) > 62 * DEG) return false;
  }
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
function turnTo(b, yaw, rate, dt) { const d = angDiff(b.yaw, yaw); b.yaw += clamp(d, -rate * dt, rate * dt); }

function botsHearShot(pos) {
  for (const b of bots) {
    if (!b.alive || b.state === 'combat') continue;
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
    player.kills++; if (part === 'head') player.heads++;
    hudHit(part === 'head' ? 'kill head' : 'kill'); sfx('kill'); if (part === 'head') sfx('head');
    hudFeed('你', b.name, part === 'head', true);
    return;
  }
  hudHit(part === 'head' ? 'head' : 'hit'); sfx(part === 'head' ? 'head' : 'hit');
  // 被打到：轉頭面向槍聲，馬上進入交戰（反應時間縮短）
  if (b.state !== 'combat') {
    b.lastSeen.copy(player.body.pos); b.state = 'search'; b.searchT = 8; setPath(b, b.lastSeen.x, b.lastSeen.z);
    b.alertYaw = Math.atan2(-(player.body.pos.x - b.phys.pos.x), -(player.body.pos.z - b.phys.pos.z));
  }
}

const _wish = new V3();
function updateBot(b, dt) {
  const p = b.phys.pos, D = DIFF[S.difficulty] || DIFF.normal;
  if (!b.alive) {
    b.deadT += dt; b.respawnT -= dt;
    const k = Math.min(1, b.deadT / 0.45);
    b.g.rotation.set(0, b.yaw, 0); b.g.rotateX(k * k * 1.5 * (b.fallDir > 0 ? 1 : -1) * 0.9 + 0.0); b.g.rotateZ(k * 0.3 * b.fallDir);
    if (b.deadT > 2.5) b.g.position.y = p.y - (b.deadT - 2.5) * 0.8;
    if (b.deadT > 3.6) b.g.visible = false;
    if (b.respawnT <= 0) respawnBot(b);
    return;
  }
  // 感知：每 0.1 秒看一次
  b.seeT -= dt;
  if (b.seeT <= 0) {
    b.seeT = 0.1;
    const was = b.visible; b.visible = botCanSee(b);
    if (b.visible) {
      b.lastSeen.copy(player.body.pos); b.lostT = 0;
      if (b.state !== 'combat') {
        // 剛發現：反應時間，原本就在找你的反應快一點
        b.react = D.react * rand(0.8, 1.25) * (b.state === 'search' ? 0.7 : 1); b.settle = 1;
        b.state = 'combat'; b.strafeT = 0; b.burst = 0; b.pauseT = 0;
      } else if (!was) { b.react = Math.max(b.react, D.react * 0.45); b.settle = Math.max(b.settle, 0.6); }
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
    turnTo(b, Math.atan2(-(b.lastSeen.x - p.x), -(b.lastSeen.z - p.z)), 9, dt);
    // 左右閃避：每隔一小段時間換方向，偶爾站定、蹲下打
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe = pick([-1, 1, -1, 1, 0]); b.strafeT = rand(0.35, 1.1);
      b.crouch = b.strafe === 0 && Math.random() < 0.35;
    }
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    let adv = 0; if (dist > 30) adv = 0.7; else if (dist < 5) adv = -0.6;
    if (!b.visible) adv = 0.8;
    const sv = b.crouch ? 0 : 3.3;
    _wish.set(rx * b.strafe * sv + fx * adv * 3.5, 0, rz * b.strafe * sv + fz * adv * 3.5);
    if (!b.visible && b.lostT > 0.3) { b.crouch = false; }
    b.crouchWant = b.crouch && b.visible;
    // 開火
    if (b.visible && player.alive) {
      b.react -= dt; b.settle = Math.max(0, b.settle - dt * 1.3);
      if (b.react <= 0) {
        if (b.pauseT > 0) b.pauseT -= dt;
        else {
          if (b.burst <= 0) b.burst = Math.round(rand(D.burst[0], D.burst[1]));
          b.fireCd -= dt;
          if (b.fireCd <= 0 && Math.abs(angDiff(b.yaw, toYaw)) < 0.25) {
            botShoot(b, dist, D); b.burst--; b.fireCd = 0.11;
            if (b.burst <= 0) b.pauseT = rand(0.25, 0.65);
          }
        }
      }
    }
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
        if (b.state === 'combat') b.strafe = -b.strafe; else if (b.state === 'search') setPath(b, b.lastSeen.x, b.lastSeen.z); else { b.path = null; pickPatrol(b); }
      }
      b.stuckT = 0; b.lastP.copy(p);
    }
  }
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
  b.bodyGroup.scale.y = lerp(b.bodyGroup.scale.y, b.phys.h / STAND_H, 1 - Math.exp(-15 * dt));
  hitBoxes(p, b.phys.h, b.boxes);
}

// 機器人開槍：瞄準胸口，誤差 = 基本誤差 + 距離 × 係數 + 自己在動 + 你在動 + 剛發現時手還不穩
function botShoot(b, dist, D) {
  const pp = player.body.pos;
  botEye(b, _be);
  _pt.set(pp.x, pp.y + player.body.h * 0.7, pp.z);
  _bd.subVectors(_pt, _be).normalize();
  const moving = Math.hypot(b.phys.vel.x, b.phys.vel.z) > 1 ? 1 : 0;
  const errDeg = D.base + dist * D.distK + moving * 1.0 + (playerSpeed() / RUN_SPEED) * 1.3 + b.settle * 2.4 + (b.phys.crouched ? -0.2 : 0);
  const yaw = Math.atan2(-_bd.x, -_bd.z) + gauss() * errDeg * 0.5 * DEG;
  const pitch = Math.asin(clamp(_bd.y, -1, 1)) + gauss() * errDeg * 0.5 * DEG;
  _bd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const w = rayWorld(_be, _bd, 160);
  let t = w ? w.t : 160;
  const h = player.alive ? rayBody(_be, _bd, player.boxes, t) : null;
  if (h) t = h.t;
  const end = _end.copy(_be).addScaledVector(_bd, t);
  b.g.updateMatrixWorld();
  const mz = b.g.localToWorld(_v3.copy(BOT_MUZZLE).multiply(_v1.set(1, b.bodyGroup.scale.y, 1)));
  spawnTracer(mz, end, '#ff9a6a', 0.018, true);
  if (h) damagePlayer(25 * PART_MUL[h.part] * D.dmg, b, h.part);
  else if (w) addDecal(end, w.n);
  sfx('botshot', 1 / (1 + dist / 14));
  b.flashT = 0.05;
}
