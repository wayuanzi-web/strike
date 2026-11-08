/* ===== 57-nades：投擲物——手榴彈（範圍傷害）、閃光彈（看著它的人暫時看不見）、煙霧彈（擋住視線 17 秒）
   會彈牆、彈地。煙擋視線是在 lineClear 裡判斷的，所以機器人、雷達、自動開火都看不穿煙。 */
const NADE_G = 11;                 // 投擲物的重力（比人輕，拋物線比較長）
const NADE_SPEED = 16.5;
const nadesLive = [];
const NADE_COLORS = { he: '#5d6440', flash: '#c9cdd2', smoke: '#77808a', molotov: '#6b4a26' };
const nadePool = [];
(function () {
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 0.11, 8);
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#888' })); m.visible = false; scene.add(m); nadePool.push(m); }
})();
function throwNade(type, o, d, owner, inherit) {
  const v = new V3().copy(d).multiplyScalar(NADE_SPEED); v.y += 2.2;
  if (inherit) { v.x += inherit.x * 0.6; v.z += inherit.z * 0.6; }
  const p = new V3().copy(o).addScaledVector(d, 0.35);
  const w = rayWorld(o, d, 0.4); if (w) p.copy(o).addScaledVector(d, Math.max(0, w.t - 0.08));
  const mesh = nadePool.find((m) => !m.visible) || nadePool[0];
  mesh.material.color.set(NADE_COLORS[type]); mesh.visible = true; mesh.position.copy(p);
  nadesLive.push({ type, pos: p, vel: v, t: 0, owner, team: owner.team, mesh, still: 0 });
  if (owner !== player && owner.isPlayer !== true) owner.thrownAt = game.t;
  if (owner.team !== player.team && camera.position.distanceTo(p) < 25) sfx('ping', 0.5);
}
// 走一步：碰到牆就反彈（法線方向剩 45%，其他方向剩 75%）
const _nd = new V3(), _nn = new V3();
function nadeMove(n, dt) {
  n.vel.y -= NADE_G * dt;
  let rem = dt;
  for (let k = 0; k < 3 && rem > 0; k++) {
    const sp = n.vel.length(); if (sp < 1e-4) break;
    _nd.copy(n.vel).multiplyScalar(1 / sp);
    const dist = sp * rem, hit = rayWorld(n.pos, _nd, dist + 0.05);
    if (!hit) { n.pos.addScaledVector(_nd, dist); break; }
    n.pos.addScaledVector(_nd, Math.max(0, hit.t - 0.05));
    _nn.set(hit.n[0], hit.n[1], hit.n[2]);
    const vn = n.vel.dot(_nn);
    n.vel.addScaledVector(_nn, -vn); n.vel.multiplyScalar(0.75); n.vel.addScaledVector(_nn, -vn * 0.45);
    if (_nn.y > 0.7) n.ground = true;   // 燃燒彈：碰到地面就破
    if (_nn.y > 0.7 && Math.abs(n.vel.y) < 1.2) { n.vel.y = 0; n.vel.x *= 0.8; n.vel.z *= 0.8; }
    rem *= 1 - Math.min(1, hit.t / dist);
    if (n.sim !== true && sp > 3) sfx('clink', Math.min(1, sp / 12), { pos: n.pos });
  }
  if (n.pos.y < 0.04) { n.pos.y = 0.04; if (n.vel.y < 0) n.vel.y = 0; n.ground = true; }
}
function updateNades(dt) {
  for (let i = nadesLive.length - 1; i >= 0; i--) {
    const n = nadesLive[i]; n.t += dt;
    nadeMove(n, dt);
    n.mesh.position.copy(n.pos); n.mesh.rotation.x += dt * 9; n.mesh.rotation.z += dt * 5;
    const sp = n.vel.length(); n.still = sp < 0.3 ? n.still + dt : 0;
    let boom = false;
    if (n.type === 'he' && n.t > 1.6) boom = true;
    if (n.type === 'flash' && n.t > 1.45) boom = true;
    if (n.type === 'smoke' && ((n.t > 1.2 && n.still > 0.15) || n.t > 3.5)) boom = true;
    if (n.type === 'molotov' && ((n.ground && n.t > 0.1) || n.t > 2.4)) boom = true;
    if (boom) { nadesLive.splice(i, 1); n.mesh.visible = false; detonate(n); }
  }
  updateSmokes(dt); updateFires(dt); updateBooms(dt);
  if (player.flashT > 0) player.flashT -= dt;
}
function detonate(n) {
  if (n.type === 'he') explodeHE(n);
  else if (n.type === 'flash') popFlash(n);
  else if (n.type === 'molotov') igniteFire(n);
  else popSmoke(n);
}

// ---------- 手榴彈：7.5 公尺內、沒被牆擋住的人受傷（不傷隊友） ----------
const _ue2 = new V3();
function explodeHE(n) {
  const p = n.pos, c = new V3(p.x, p.y + 0.3, p.z);   // 自己的向量（特效函式會用到共用的暫存向量）
  boomFx(p, 5.5, '#ffb45a');
  for (let k = 0; k < 7; k++) spawnPuff(_v2.set(p.x + rand(-1.2, 1.2), p.y + rand(0.2, 1.6), p.z + rand(-1.2, 1.2)), '#3d3a36', rand(1.2, 2.2), rand(0.7, 1.2), 0.8);
  spawnSparks(p, _v2.set(0, 1, 0), '#ffd27a', 18);
  addDecal(_v2.set(p.x, 0.005, p.z), [0, 1, 0], 9, _scorch);
  sfx('boom', 1, { pos: p });
  if (n.owner && n.owner.remote) return;   // 好友對戰：對手丟的手榴彈傷害由他那台算
  const units = [player].concat(bots.filter((b) => b.active));
  for (const u of units) {
    if (!u.alive) continue;
    if (u.team === n.team && u !== n.owner) continue;          // 不傷隊友
    const up = u.body.pos; _ue2.set(up.x, up.y + u.body.h * 0.6, up.z);
    const d = c.distanceTo(_ue2); if (d > 7.5) continue;
    if (!lineClearNoSmoke(c, _ue2)) continue;
    let dmg = 100 * Math.pow(1 - d / 7.5, 1.2);
    if (u === player ? INV.vest : u.vest) { wearArmor(u, dmg * 0.4); dmg *= 0.6; }
    if (u === n.owner) dmg *= 0.5;
    if (dmg < 1) continue;
    _v3.subVectors(_ue2, c).normalize();
    if (u === player) { if (n.owner !== player) damagePlayer(dmg, n.owner, 'body', NADES.he); else { player.hp = Math.max(1, player.hp - dmg); player.hurtT = 0.35; } }
    else damageBot(u, dmg, 'body', _v3.clone(), n.owner, NADES.he);
  }
  // 你在附近：鏡頭震一下
  const dc = camera.position.distanceTo(p);
  if (dc < 18 && player.alive) { player.punchPV += (18 - dc) * 2.2; player.punchYV += rand(-1, 1) * (18 - dc); }
}
const _scorch = new THREE.Color('#1c1a18');

// ---------- 閃光彈：看著它的人（越正對、越近越久）暫時看不見；煙和牆會擋 ----------
function popFlash(n) {
  const p = n.pos;
  boomFx(p, 3.5, '#ffffff', 0.12);
  sfx('bang', 1, { pos: p });
  const units = [player].concat(bots.filter((b) => b.active));
  for (const u of units) {
    if (!u.alive) continue;
    const eye = unitEye(u, _ue2), d = eye.distanceTo(p);
    if (d > 32 || !lineClear(eye, p)) continue;
    const yaw = u === player ? player.yaw : u.yaw, pitch = u === player ? player.pitch : (u.pitch || 0);
    const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
    const ang = Math.acos(clamp((fx * (p.x - eye.x) + fy * (p.y - eye.y) + fz * (p.z - eye.z)) / Math.max(0.01, d), -1, 1));
    const face = ang < 50 * DEG ? 1 : ang < 100 * DEG ? 0.5 : 0.18;
    let dur = 4.2 * face * clamp(1.25 - d / 32, 0, 1);
    if (u !== player && u.team === n.team) dur *= 0.35;      // 自己人丟的，隊友會轉頭（機器人）
    if (u === n.owner && u !== player) dur *= 0.2;
    if (dur < 0.2) continue;
    if (u === player) { player.flashT = Math.max(player.flashT, dur); player.flashMax = Math.max(player.flashT, 1); if (dur > 1.2) sfx('ring', Math.min(1, dur / 3)); }
    else { u.blindT = Math.max(u.blindT || 0, dur); }
  }
}

// ---------- 煙霧彈：一團半徑 4 公尺的煙，17 秒，最後 2.5 秒散掉 ----------
const SMOKE_PTS = 26;
function popSmoke(n) {
  const p = n.pos;
  const N = S.quality === 'eco' ? 14 : SMOKE_PTS;   // 省電：煙的顆粒少一半
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), off = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()), h = Math.random();
    off.push([Math.cos(a) * r, 0.15 + h * 0.85, Math.sin(a) * r, rand(0.2, 0.6) * (Math.random() < 0.5 ? -1 : 1)]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 4.4, map: puffTex, color: '#b9bcbf', transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  SMOKES.push({ x: p.x, y: Math.max(0, p.y - 0.1), z: p.z, r: 0, t: 0, life: 17, pts, off, team: n.team });
  sfx('hiss', 1, { pos: p });
}
function updateSmokes(dt) {
  for (let i = SMOKES.length - 1; i >= 0; i--) {
    const s = SMOKES[i]; s.t += dt;
    const grow = Math.min(1, s.t / 1.2), fade = clamp((s.life - s.t) / 2.5, 0, 1);
    s.r = 4.1 * Math.sqrt(grow) * (0.6 + 0.4 * fade);
    const a = s.pts.geometry.attributes.position;
    for (let k = 0; k < s.off.length; k++) {
      const o = off3(s, k);
      a.array[k * 3] = s.x + o[0] * s.r; a.array[k * 3 + 1] = s.y + o[1] * 3.4 * Math.sqrt(grow); a.array[k * 3 + 2] = s.z + o[2] * s.r;
    }
    a.needsUpdate = true;
    s.pts.material.opacity = 0.92 * Math.min(1, s.t / 0.5) * fade; s.pts.material.size = 3.2 + 1.6 * grow;
    if (s.t >= s.life) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); SMOKES.splice(i, 1); }
  }
}
function off3(s, k) { const o = s.off[k], w = s.t * o[3] * 0.25; return [o[0] * Math.cos(w) - o[2] * Math.sin(w), o[1], o[0] * Math.sin(w) + o[2] * Math.cos(w)]; }
// 鏡頭在煙裡面：整個畫面蓋一層灰
function smokeAtCamera() {
  let k = 0; const c = camera.position;
  for (const s of SMOKES) {
    const dy = clamp(c.y - (s.y + 1.6), -1.8, 1.8), d = Math.hypot(c.x - s.x, (c.y - s.y - 1.6) - dy, c.z - s.z);
    k = Math.max(k, clamp(1.15 - d / Math.max(0.5, s.r), 0, 1) * s.pts.material.opacity);
  }
  return k;
}

// ---------- 燃燒彈：落地燒一片半徑 3 公尺、7 秒；站在火裡每秒約 40 傷害（不傷隊友，會燒到自己）
// 丟進煙裡會被悶熄；煙丟到火上也會把火蓋掉。機器人不會走進火裡（擋路），站在火裡會往外跑。
const FIRES = [];
const FIRE_R = 3, FIRE_LIFE = 7, FIRE_DPS = 40;
const smokeCovers = (x, z, extra = 0) => SMOKES.some((s) => s.t < s.life - 1 && Math.hypot(s.x - x, s.z - z) < Math.max(2.5, s.r) + extra);
function igniteFire(n) {
  const p = n.pos;
  if (smokeCovers(p.x, p.z)) { sfx('hiss', 0.6, { pos: p }); spawnPuff(p, '#8a8680', 1.2, 0.6, 0.6); return; }
  const N = S.quality === 'eco' ? 12 : 22, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), off = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()); off.push([Math.cos(a) * r, Math.sin(a) * r, Math.random(), rand(2, 4)]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, map: puffTex, color: '#ff8a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const y = Math.max(0, p.y - 0.05);
  FIRES.push({ x: p.x, y, z: p.z, r: 0, t: 0, life: FIRE_LIFE, tick: 0, team: n.team, owner: n.owner, pts, off });
  addDecal(_v2.set(p.x, y + 0.005, p.z), [0, 1, 0], 6, _scorch);
  boomFx(p, 2.5, '#ff9a3a', 0.3); sfx('boom', 0.35, { pos: p }); sfx('hiss', 0.5, { pos: p });
}
function removeFire(f) { scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose(); }
// 這個點在不在火裡（margin：多算幾公尺，給機器人繞路用）
function fireAt(x, z, y = 0, margin = 0) {
  for (const f of FIRES) if (f.t < f.life - 0.6 && Math.abs(y - f.y) < 1.6 && Math.hypot(x - f.x, z - f.z) < f.r + margin) return f;
  return null;
}
function updateFires(dt) {
  for (let i = FIRES.length - 1; i >= 0; i--) {
    const f = FIRES[i]; f.t += dt;
    f.r = FIRE_R * Math.min(1, f.t / 0.6) * (f.t > f.life - 1 ? Math.max(0.2, f.life - f.t) : 1);
    if (f.t > 0.4 && smokeCovers(f.x, f.z, 1)) f.life = Math.min(f.life, f.t + 0.5);   // 被煙蓋熄
    const a = f.pts.geometry.attributes.position;
    for (let k = 0; k < f.off.length; k++) {
      const o = f.off[k], h = (o[2] + f.t * o[3] * 0.35) % 1;
      a.array[k * 3] = f.x + o[0] * f.r; a.array[k * 3 + 1] = f.y + 0.15 + h * 1.3; a.array[k * 3 + 2] = f.z + o[1] * f.r;
    }
    a.needsUpdate = true;
    f.pts.material.opacity = 0.85 * Math.min(1, f.t / 0.3) * clamp(f.life - f.t, 0, 1);
    f.pts.material.size = 1.3 + 0.5 * Math.sin(f.t * 13);
    if ((game.t * 8 | 0) % 2 === 0 && f.t < f.life - 0.5) muzzleLight(_v2.set(f.x, f.y + 0.6, f.z), 1.4);
    // 傷害：每 0.25 秒算一次
    f.tick += dt;
    if (f.tick >= 0.25) {
      f.tick -= 0.25;
      if (f.owner && f.owner.remote) continue;   // 好友對戰：對手的火傷害由他那台算
      for (const u of [player].concat(bots.filter((b) => b.active))) {
        if (!u.alive || (u.team === f.team && u !== f.owner)) continue;
        const up = u.body.pos; if (Math.abs(up.y - f.y) > 1.2 || Math.hypot(up.x - f.x, up.z - f.z) > f.r) continue;
        const dmg = FIRE_DPS * 0.25 * (u === f.owner ? 0.6 : 1);
        if (u === player) { if (f.owner !== player) damagePlayer(dmg, f.owner, 'legs', NADES.molotov); else { player.hp = Math.max(1, player.hp - dmg); player.hurtT = 0.3; } }
        else damageBot(u, dmg, 'legs', _v3.set(0, 1, 0).clone(), f.owner, NADES.molotov);
      }
    }
    if (f.t >= f.life) { removeFire(f); FIRES.splice(i, 1); }
  }
}

// ---------- 爆炸的閃光：一個大的加亮星形，很快淡掉 ----------
const booms = [];
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  s.visible = false; scene.add(s); booms.push({ s, life: 0, max: 0.2, size: 1 });
}
let boomI = 0;
function boomFx(p, size, color, life = 0.22) {
  const b = booms[boomI++ % booms.length]; b.s.position.set(p.x, p.y + 0.4, p.z); b.s.material.color.set(color);
  b.life = b.max = life; b.size = size; b.s.visible = true; muzzleLight(p, 6);
}
function updateBooms(dt) {
  for (const b of booms) {
    if (!b.s.visible) continue; b.life -= dt; if (b.life <= 0) { b.s.visible = false; continue; }
    const k = b.life / b.max; b.s.scale.setScalar(b.size * (1.4 - 0.4 * k)); b.s.material.opacity = k; b.s.material.rotation += dt * 3;
  }
}
function clearNades() {
  for (const n of nadesLive) n.mesh.visible = false; nadesLive.length = 0;
  for (const s of SMOKES) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); } SMOKES.length = 0;
  for (const f of FIRES) removeFire(f); FIRES.length = 0;
  if (typeof clearDrops === 'function') clearDrops();
  player.flashT = 0;
}

// ---------- 機器人丟投擲物：試幾個仰角，挑落點最接近目標的（模擬彈跳） ----------
const _sim = { pos: new V3(), vel: new V3(), sim: true };
function landPoint(o, yaw, pitch, fuse) {
  _sim.pos.copy(o); _sim.vel.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(NADE_SPEED); _sim.vel.y += 2.2;
  const st = 1 / 30;
  for (let t = 0; t < fuse; t += st) { nadeMove(_sim, st); if (_sim.vel.lengthSq() < 0.05 && t > 0.3) break; }
  return _sim.pos;
}
function botThrow(b, type, tx, ty, tz) {
  const o = botEye(b, new V3()), yaw = Math.atan2(-(tx - o.x), -(tz - o.z));
  const fuse = type === 'smoke' ? 2.6 : type === 'he' ? 1.6 : type === 'molotov' ? 2.0 : 1.45;
  let best = null, bd = 1e9;
  for (let pd = -12; pd <= 60; pd += 8) {
    const lp = landPoint(o, yaw, pd * DEG, fuse);
    const d = Math.hypot(lp.x - tx, lp.z - tz) + Math.abs(lp.y - ty) * (type === 'flash' ? 0 : 0.5);
    if (d < bd) { bd = d; best = pd; }
  }
  if (best === null || bd > (type === 'flash' ? 9 : 6)) return false;
  // 閃光彈要在空中炸：目標點往上抬一點
  const pitch = best * DEG;
  _d.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  throwNade(type, o, _d, b, null);
  b.nades[type]--; b.yaw = yaw;
  return true;
}
