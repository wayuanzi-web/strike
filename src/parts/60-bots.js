/* ===== 60-bots：機器人——分成兩隊（A 隊＝你和隊友，B 隊＝敵人「赤狼」），巡邏、視線、反應時間、依距離決定準度、
   左右閃避、找掩體、包抄。打你的時候有公平性機制（警告射擊、同時開火上限、手下留情）；機器人互打則照同一套準度公式。 */
const ENEMY_NAMES = ['鐵狼', '赤隼', '灰熊', '夜梟', '黑蠍'];
const ALLY_NAMES = ['曉鷹', '青嵐', '石竹', '白鷺'];
const bots = [];                    // 前 5 隻是敵人（B 隊），後 4 隻是隊友（A 隊）；練習模式只用前 4 隻敵人
// 輪廓光：邊緣加一點光，遠處和陰影裡也看得出人形（隊友偏冷色、敵人偏暖色）
// 邊緣光：顏色放在 uniform 裡（隊友外框色可以在成長畫面換）
function patchBotMat(m, rim) {
  const U = m.userData.rimU = { value: new THREE.Color().setRGB(...rim.split(',').map(Number)) };
  m.onBeforeCompile = (sh) => { sh.uniforms.uRim = U; sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
    `outgoingLight += uRim * pow(1.0 - abs(dot(normalize(normal), vec3(0.0, 0.0, 1.0))), 3.0) * 0.28;\n#include <opaque_fragment>`); };
  m.customProgramCacheKey = () => 'botrim'; return m;
}
const BOT_FLASH_MAT = new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const BOT_MUZZLE = new V3(0.16, 1.37, -0.84);
// 敵人「赤狼」：沙褐背心、橄欖褲、鏽橘布條；隊友「曉隊」：石板藍、青色布條（原創配色）
const PALETTE = {
  B: { vest: '#a08a62', plate: '#8c7852', shirt: '#7a7660', pants: '#5f6448', helmet: '#3e3f3a', band: '#ff6a2a', pack: '#5b5442', pouch: '#6f5f45', rim: '1.0, 0.75, 0.5' },
  A: { vest: '#56677e', plate: '#4a596d', shirt: '#5f6873', pants: '#3f4854', helmet: '#33383f', band: '#2fd8e0', pack: '#434c58', pouch: '#4d5866', rim: '0.55, 0.8, 1.0' },
};
// 機器人手上的槍：每種一個幾何（全部機器人共用），換槍只換幾何；muzzle 是槍口位置
const BOT_GUNS = (function () {
  const G = '#1f2226', W = '#3a342b', out = {};
  const mk = (parts, mz) => ({ geo: mergeParts(parts), muzzle: new V3(0.16, 1.37, mz) });
  out.rifle = mk([partBox(0.06, 0.09, 0.42, 0.16, 1.37, -0.38, G), partBox(0.035, 0.035, 0.26, 0.16, 1.39, -0.7, G), partBox(0.045, 0.16, 0.06, 0.16, 1.26, -0.42, G, 0.25), partBox(0.05, 0.08, 0.2, 0.16, 1.36, -0.08, W)], -0.84);
  out.smg = mk([partBox(0.06, 0.09, 0.3, 0.16, 1.37, -0.36, G), partBox(0.03, 0.03, 0.12, 0.16, 1.39, -0.57, G), partBox(0.04, 0.15, 0.05, 0.16, 1.27, -0.36, G), partBox(0.03, 0.05, 0.16, 0.16, 1.37, -0.12, G)], -0.64);
  out.sniper = mk([partBox(0.06, 0.09, 0.5, 0.16, 1.37, -0.4, G), partBox(0.03, 0.03, 0.42, 0.16, 1.39, -0.86, G), partBox(0.055, 0.055, 0.26, 0.16, 1.46, -0.38, '#2c3036'), partBox(0.06, 0.1, 0.24, 0.16, 1.35, -0.06, '#4a4436')], -1.08);
  out.shotgun = mk([partBox(0.06, 0.09, 0.3, 0.16, 1.37, -0.32, G), partBox(0.045, 0.045, 0.42, 0.16, 1.4, -0.68, G), partBox(0.035, 0.035, 0.32, 0.16, 1.355, -0.62, W), partBox(0.05, 0.08, 0.22, 0.16, 1.35, -0.08, W)], -0.9);
  out.pistol = mk([partBox(0.04, 0.06, 0.18, 0.06, 1.37, -0.5, G), partBox(0.035, 0.1, 0.045, 0.06, 1.3, -0.44, G, 0.2)], -0.6);
  out.carbine = mk([partBox(0.055, 0.085, 0.38, 0.16, 1.37, -0.36, G), partBox(0.032, 0.032, 0.22, 0.16, 1.39, -0.64, G), partBox(0.04, 0.14, 0.05, 0.16, 1.27, -0.38, G, 0.15), partBox(0.045, 0.07, 0.2, 0.16, 1.36, -0.07, '#2a2e33'), partBox(0.03, 0.04, 0.1, 0.16, 1.44, -0.34, '#2c3036')], -0.76);
  out.deagle = mk([partBox(0.05, 0.075, 0.24, 0.06, 1.37, -0.52, '#5c6066'), partBox(0.042, 0.11, 0.05, 0.06, 1.29, -0.44, G, 0.2)], -0.65);
  out.pistol.muzzle.x = out.deagle.muzzle.x = 0.06;
  return out;
})();
const BC0 = { skin: '#c08f6a', glove: '#2b2b2b', boot: '#2a2622', gun: '#1f2226', goggle: '#16191d', belt: '#2f2b25' };
// 人物模型在 59-human（骨架蒙皮的擬真人物）；槍掛在胸骨上，槍口火光掛在槍上
function makeBotModel(team, look = 'grunt') {
  const H = makeHuman(team, look), chest = H.bones[HB.chest];
  const gunP = new THREE.Group(); gunP.position.set(...HUMAN_GUN_P); chest.add(gunP);
  const gunM = new THREE.Mesh(BOT_GUNS.rifle.geo, H.mat)   /* 同一份材質：跟人一起變暗、有邊緣光 */; gunM.position.set(-0.16, -1.3, 0.3); gunP.add(gunM);
  const fl = new THREE.Sprite(BOT_FLASH_MAT); fl.position.copy(BOT_MUZZLE); fl.scale.set(0.32, 0.32, 1); fl.visible = false; gunM.add(fl);
  return { g: H.g, hm: H, mat: H.mat, gunM, gunP, fl };
}
// 隊友頭上的名牌（CS 也會顯示隊友名字），隔牆也看得到
function nameTag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.font = 'bold 34px "PingFang TC","Noto Sans TC",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 6; c.strokeStyle = 'rgba(8,14,20,.85)'; c.strokeText(text, 128, 34); c.fillStyle = '#7fe9f0'; c.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, depthWrite: false, toneMapped: false, fog: false, transparent: true }));
  s.scale.set(0.9, 0.225, 1); s.position.set(0, 2.15, 0); s.renderOrder = 10; return s;
}

function makeBot(name, team) {
  const mdl = makeBotModel(team); scene.add(mdl.g);
  const b = {
    name, team, i: bots.length, active: false, kills: 0, deaths: 0, heads: 0,
    g: mdl.g, hm: mdl.hm, fl: mdl.fl, mat: mdl.mat, litS: 1, ck: 0, tagT: 0, flinchT: 0, stepT: 0, lit: 1, dealt: 0,
    phys: { pos: new V3(), vel: new V3(), r: 0.35, h: STAND_H, onGround: true, jumped: false },
    yaw: 0, pitch: 0, hp: 100, alive: false, state: 'patrol', path: null, pi: 0, waitT: 0,
    target: null, react: 0, settle: 0, lastSeen: new V3(), lostT: 9, visible: false, seeT: Math.random() * 0.1,
    strafe: 0, strafeT: 0, burst: 0, fireCd: 0, pauseT: 0, crouch: false,
    stuckT: 0, lastP: new V3(), deadT: 0, respawnT: 0, boxes: newBoxes(), walk: 0, searchT: 0, spottedT: 0,
  };
  b.body = b.phys;   // 物理身體：玩家程式用 bot.body，機器人程式用 bot.phys，是同一個
  b.gunM = mdl.gunM; b.gunP = mdl.gunP; b.money = 0; b.trait = TRAIT_OF[name] || ''; b.nades = { he: 0, flash: 0, smoke: 0, molotov: 0 }; b.primary = WEAPONS.rifle; b.secondary = null; b.vest = b.helmet = true; b.armor = 100; b.kit = false;
  b.wpn = WEAPONS.rifle; b.mag = 30; b.reloadT = 0; b.blindT = 0; b.useT = 0;
  b.baseTeam = team; b.baseName = name;
  if (team === 'A') { b.tag = nameTag(name); b.g.add(b.tag); }
  b.g.visible = false;
  bots.push(b);
  return b;
}
function botSpawn(b, sx, sz, faceX = 0, faceZ = 0) {
  const p = b.phys.pos; p.set(sx, 0, sz); b.phys.vel.set(0, 0, 0); b.phys.h = STAND_H; b.phys.crouched = false;
  b.hp = 100; b.alive = true; b.state = 'patrol'; b.path = null; b.waitT = rand(0, 1); b.visible = false; b.target = null; b.lostT = 9;
  b.deadT = 0; b.crouch = false; b.burst = 0; b.pauseT = 0; b.react = 0; b.coverUsed = 0; b.flinchT = 0; b.tagT = 0; b.holdT = 0;
  b.blindT = 0; b.useT = 0; b.goalTag = null; b.holdObj = false; b.guard = null; b.objT = 0; b.reloadT = 0; b.mag = b.wpn.mag; b.nadeTry = 0; b.smoked = b.flashed = false;
  b.yaw = Math.atan2(-(faceX - sx), -(faceZ - sz)) + rand(-0.3, 0.3);
  if (game.mode !== 'match' && !b.dummy) { b.vest = b.helmet = true; b.armor = 100; }   // 對戰以外每次重生都是滿護甲
  b.g.visible = true; b.g.rotation.set(0, b.yaw, 0); b.g.position.copy(p);
  b.ck = 0; b.dd = null; if (b.hs) humanInit(b); b.gunP.position.set(...HUMAN_GUN_P); b.gunP.rotation.set(0, 0, 0);
  b.lastP.copy(p); b.stuckT = 0;
  hitBoxes(p, b.phys.h, b.boxes);
}
function initBots() {
  for (const n of ENEMY_NAMES) makeBot(n, 'B');
  for (const n of ALLY_NAMES) makeBot(n, 'A');
}
// 依模式啟用：練習＝4 隻敵人、可重生；對戰＝5 對 5（4 個隊友＋你）
function setupBots(mode) {
  SHOOT_TOKENS.clear();
  const cnt = { A: 0, B: 0 };
  for (const b of bots) {
    b.team = b.baseTeam;
    b.active = b.rageOnly ? mode === 'rage' : mode === 'rage' ? b.baseTeam === 'B' : mode === 'match' ? true : mode === 'tutorial' || mode === 'range' || mode === 'duel' ? false : mode === 'dm' ? b.i < 7 : mode === 'koth' ? cnt[b.team]++ < (b.team === 'A' ? 3 : 4) : (b.team === 'B' && b.i < 4); b.dummy = false;
    if (mode === 'dm') b.team = 'D' + b.i;   // 死鬥：每個人自己一隊
    b.kills = b.deaths = b.heads = 0;
    if (mode !== 'match') { b.primary = WEAPONS.rifle; b.secondary = null; b.vest = b.helmet = true; b.armor = 100; b.nades = { he: 0, flash: 0, smoke: 0, molotov: 0 }; botArm(b); }
    if (!b.active) { b.alive = false; b.g.visible = false; }
    if (b.hm && mode !== 'rage') setHumanLook(b, 'grunt');
  }
}
const activeBots = () => bots.filter((b) => b.active);
// 拿槍：有主武器拿主武器，沒有拿手槍；彈匣裝滿
function botArm(b) {
  b.wpn = b.primary || b.secondary || WEAPONS.pistol; b.mag = b.wpn.mag; b.reloadT = 0;
  const g = BOT_GUNS[b.wpn.id] || BOT_GUNS.rifle; b.gunM.geometry = g.geo; b.fl.position.copy(g.muzzle);
}

// ---------- 「單位」：你或機器人，給目標選擇、開槍共用 ----------
player.team = 'A'; player.isPlayer = true; player.name = '你';
function unitEye(u, out) { const p = u.body.pos; return u.isPlayer ? out.set(p.x, p.y + player.eye, p.z) : out.set(p.x, p.y + u.phys.h - 0.14, p.z); }
function unitSpeed(u) { return Math.hypot(u.body.vel.x, u.body.vel.z); }
function enemiesOf(team) {
  const out = [];
  if (team !== player.team && player.alive) out.push(player);
  for (const b of bots) if (b.active && b.alive && b.team !== team) out.push(b);
  return out;
}

// 重生（只有練習模式）：離你夠遠、你看不到、不在你背後
function pointSeesPlayer(x, z, pe) {
  for (const h of [0.3, 1.0, 1.6]) if (lineClear(pe, _v2.set(x, h, z))) return true;
  return false;
}
function respawnBot(b) {
  if (modeRespawn(b)) return;
  const pe = eyePos(new V3()), pp = player.body.pos;
  const cands = BOT_SPAWNS.map((s) => ({ x: s[0], z: s[1] }));
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

const _be = new V3(), _pt = new V3(), _bd = new V3(), _end = new V3(), _ue = new V3();
function botEye(b, out) { const p = b.phys.pos; return out.set(p.x, p.y + b.phys.h - 0.14, p.z); }
// 看不看得到某個敵人：距離、視野角度（巡邏 124 度、搜索 220 度、交戰中全方位）、視線有沒有被牆擋住
function canSeeUnit(b, u) {
  const pp = u.body.pos, bp = b.phys.pos;
  const dx = pp.x - bp.x, dz = pp.z - bp.z, dist = Math.hypot(dx, dz);
  if (dist > (game.mode === 'match' ? 50 : 85)) return false;
  const fov = b.state === 'patrol' || b.state === 'hold' ? 62 : b.state === 'search' ? 110 : 180;
  if (fov < 180 && dist > 3 && Math.abs(angDiff(b.yaw, Math.atan2(-dx, -dz))) > fov * DEG) return false;
  botEye(b, _be);
  if (lineClear(_be, _pt.set(pp.x, pp.y + u.body.h - 0.12, pp.z))) return true;
  if (lineClear(_be, _pt.set(pp.x, pp.y + u.body.h * 0.62, pp.z))) return true;
  return false;
}
// 挑目標：原本的目標還看得到就繼續打它，否則挑看得到的最近敵人
function findTarget(b) {
  if (b.blindT > 0.5) return null;      // 被閃到：看不見
  if (b.target && b.target.alive && canSeeUnit(b, b.target)) return b.target;
  let best = null, bd = 1e9;
  for (const u of enemiesOf(b.team)) {
    const d = u.body.pos.distanceTo(b.phys.pos); if (d >= bd) continue;
    if (canSeeUnit(b, u)) { best = u; bd = d; }
  }
  return best;
}
function botCanSee(b) { return !!findTarget(b); }   // 舊介面（測試用）
// 對戰時不要追太遠：守方（還沒裝彈）只在自己包點 20 公尺內追；攻方衝之前只追 14 公尺內的
function leashOK(b, pos) {
  if (game.mode === 'koth' && MODE.zone) return Math.hypot(pos.x - MODE.zone.x, pos.z - MODE.zone.z) < KOTH.r + 12;   // 搶點：不追離圈太遠
  if (game.mode !== 'match' || ROUND.phase !== 'live' || BOMB.planted) return true;
  if (b.team !== ROUND.atk) { const s = SITES[b.post || 'A']; return Math.hypot(pos.x - s.cx, pos.z - s.cz) < (hasTrait(b, 'entry') ? 18 : 14); }
  if (ROUND.plan && ROUND.plan.exec) { const s = SITES[ROUND.plan.site]; return Math.hypot(pos.x - s.cx, pos.z - s.cz) < 18 || Math.hypot(pos.x - b.phys.pos.x, pos.z - b.phys.pos.z) < 12; }
  return Math.hypot(pos.x - b.phys.pos.x, pos.z - b.phys.pos.z) < 14;
}
function setPath(b, x, z, y) {
  b.path = findPath(b.phys.pos.x, b.phys.pos.z, x, z, b.phys.pos.y, y); b.pi = 0; b.stuckT = 0; b.lastP.copy(b.phys.pos);
}
// 巡邏目的地：練習模式隨機；對戰時往敵方半場推進（A 隊往東、B 隊往西），偶爾往隊友回報的敵人位置去
const TEAM_INTEL = { A: { t: -99, pos: new V3() }, B: { t: -99, pos: new V3() } };
function pickPatrol(b) {
  if (game.mode === 'match') {
    const intel = TEAM_INTEL[b.team];
    if (game.t - intel.t < 8 && Math.random() < 0.6) { setPath(b, intel.pos.x + rand(-4, 4), intel.pos.z + rand(-4, 4)); if (b.path && b.path.length) { b.state = 'search'; b.searchT = 8; return; } }
    const dir = b.team === 'A' ? 1 : -1, x = b.phys.pos.x;
    for (let k = 0; k < 20; k++) {
      const n = pick(NAV.nodes);
      if (!n.ok || !n.nb.length) continue;
      const adv = (n.x - x) * dir;
      if (adv < 4 || adv > 26) continue;   // 往前推進 4–26 公尺
      setPath(b, n.x, n.z); if (b.path && b.path.length) return;
    }
  }
  // 有高處（二樓、平台）的地圖，四分之一的機會往高處走
  const ups = NAV.upCount && Math.random() < 0.25 ? NAV.nodes.filter((n) => n.ok && n.up && n.nb.length) : null;
  for (let k = 0; k < 12; k++) {
    const n = ups && ups.length ? pick(ups) : pick(NAV.nodes);
    if (!n.ok || !n.nb.length) continue;
    if (Math.hypot(n.x - b.phys.pos.x, n.z - b.phys.pos.z) < 12) continue;
    setPath(b, n.x, n.z, n.y); if (b.path && b.path.length) return;
  }
}
function followPath(b, speed, out) {
  out.set(0, 0, 0);
  if (!b.path || b.pi >= b.path.length) return false;
  const tgt = b.path[b.pi], p = b.phys.pos;
  // 燃燒彈：站在火裡就往外跑；下一個路點在火裡就停下來等（火擋路）
  if (FIRES.length) {
    const f = fireAt(p.x, p.z, p.y, 0.4);
    if (f) { const ax = p.x - f.x, az = p.z - f.z, ad = Math.hypot(ax, az) || 1; out.set(ax / ad * speed, 0, az / ad * speed); return true; }
    const ax = tgt[0] - p.x, az = tgt[1] - p.z, ad = Math.hypot(ax, az) || 1, k = Math.min(ad, 1.6) / ad;   // 往前看 1.6 公尺
    if (fireAt(p.x + ax * k, p.z + az * k, p.y, 0.5) || (ad < 3 && fireAt(tgt[0], tgt[1], tgt[2] || 0, 0.5))) {
      // 先試著繞路（每秒最多一次）；繞不過去才停下來等火熄
      if (game.t - (b.fireRepath || -9) > 1) { b.fireRepath = game.t; const e = b.path[b.path.length - 1]; const np = findPath(p.x, p.z, e[0], e[1], p.y, e[2]); if (np && np.length && !fireOnLine(p.x, p.z, np[0][0], np[0][1], p.y)) { b.path = np; b.pi = 0; return true; } }
      b.fireWait = game.t; return true;
    }
  }
  const dx = tgt[0] - p.x, dz = tgt[1] - p.z, d = Math.hypot(dx, dz);
  if (d < 0.5) { b.pi++; return b.pi < b.path.length; }
  out.set(dx / d * speed, 0, dz / d * speed);
  return true;
}
// 攻擊令牌：同時打你的機器人最多 D.maxShooters 隻，畫面內、比較近的優先（機器人互打不受限）
const SHOOT_TOKENS = new Set();
function inPlayerView(b) { const pp = player.body.pos; return Math.abs(angDiff(player.yaw, Math.atan2(-(b.phys.pos.x - pp.x), -(b.phys.pos.z - pp.z)))) < 75 * DEG; }
function tokenScore(b) { return Math.hypot(b.phys.pos.x - player.body.pos.x, b.phys.pos.z - player.body.pos.z) + (inPlayerView(b) ? 0 : 20); }
function wantToken(b, D) {
  for (const o of SHOOT_TOKENS) if (!o.alive || o.state !== 'combat' || !o.visible || o.target !== player) SHOOT_TOKENS.delete(o);
  if (SHOOT_TOKENS.has(b)) return true;
  if (SHOOT_TOKENS.size < D.maxShooters) { SHOOT_TOKENS.add(b); return true; }
  let worst = null; for (const o of SHOOT_TOKENS) if (!worst || tokenScore(o) > tokenScore(worst)) worst = o;
  if (worst && tokenScore(b) < tokenScore(worst) - 3) { SHOOT_TOKENS.delete(worst); worst.pauseT = Math.max(worst.pauseT, 0.4); SHOOT_TOKENS.add(b); return true; }
  return false;
}
function turnTo(b, yaw, rate, dt) { const d = angDiff(b.yaw, yaw); b.yaw += clamp(d, -rate * dt, rate * dt); }

// 聽到槍聲：另一隊 45 公尺內、還沒在交戰的機器人過去看看
function botsHearShot(pos, team = 'A') {
  for (const b of bots) {
    if (!b.active || !b.alive || b.team === team || b.state === 'combat' || b.state === 'cover' || b.state === 'flank') continue;
    if (b.state === 'search' && b.searchT > 3) continue;
    if (b.state === 'plant' || b.state === 'defuse') continue;
    const d = Math.hypot(pos.x - b.phys.pos.x, pos.z - b.phys.pos.z);
    if (d > 45 || !leashOK(b, pos)) continue;
    b.state = 'search'; b.searchT = 9; b.lastSeen.set(pos.x + rand(-3, 3), 0, pos.z + rand(-3, 3));
    setPath(b, b.lastSeen.x, b.lastSeen.z);
  }
}
// 機器人被打：attacker 是你或另一隻機器人
function damageBot(b, dmg, part, dir, attacker = player, weapon = null) {
  if (b.remote) { netHitRemote(b, dmg, part, weapon || WP); return; }   // 好友對戰：傷害交給對方那台算
  if (!b.alive) return;
  if (game.mode === 'rage' && attacker === player) dmg *= rageDmgMul();   // 狂暴中傷害 2 倍
  b.hp -= dmg;
  const byPlayer = attacker === player, w = weapon || (byPlayer ? WP : attacker.wpn) || WEAPONS.rifle;
  if (b.hp <= 0) {
    b.alive = false; b.hp = 0; b.deadT = 0; b.deaths++;
    humanDie(b, part, dir);   // 倒法：順著子彈方向倒；打腳往前跪倒
    b.respawnT = modeRespawnTime();
    SHOOT_TOKENS.delete(b);
    const enemy = attacker !== b && attacker.team !== b.team;
    if (byPlayer) {
      player.kills++; player.deathStreak = 0; if (part === 'head') player.heads++;
      if (game.mode !== 'match') W.reserve = Math.min(WP.reserve, W.reserve + 15);
      hudHit(part === 'head' ? 'kill head' : 'kill'); sfx('kill'); if (part === 'head') sfx('head'); statKill(w, part === 'head'); hitFeedback('kill', b, part === 'head');
    } else if (enemy) { attacker.kills++; if (part === 'head') attacker.heads++; }
    if (enemy) roundKill(attacker);
    if (enemy) addMoney(attacker, w.reward || 0, '擊殺');
    hudFeed(attacker === b ? '' : attacker.name, b.name, part === 'head', attacker.team, b.team, byPlayer, w.short);
    if (game.mode === 'rage' && byPlayer) rageOnKill(b, part === 'head');
    if (typeof onUnitDied === 'function') onUnitDied(b);
    return;
  }
  if (byPlayer) { hudHit(part === 'head' ? 'head' : 'hit'); sfx(part === 'head' ? 'head' : 'hit'); hitFeedback('hit', b, part === 'head', b.helmet !== false && b.armor > 0); }
  // 中彈硬直：準度變差、連發中斷，先打中的人佔優勢
  humanHit(b, part, dir, dmg);   // 中彈：身體被推一下（彈簧）、踉蹌半步
  b.hitPart = part; b.hitSide = dir ? Math.sign(dir.x * -Math.cos(b.yaw) - dir.z * -Math.sin(b.yaw)) || 1 : 1;   // 中彈部位、從哪一側
  b.flinchT = part === 'head' ? 0.6 : 0.35; b.tagT = 1.5; b.hitAnim = part === 'head' ? 0.2 : 0.15; b.hitHead = part === 'head'; b.settle = Math.min(1, b.settle + 0.5); if (b.burst > 1) b.burst = 1;
  if (game.mode !== 'rage' && b.hp < 55 && (b.coverUsed || 0) < 2 && b.state === 'combat' && Math.random() < 0.75) { if (seekCover(b, attacker)) return; }
  // 被打到：轉頭面向攻擊者，過去找
  if (b.state !== 'combat' && b.state !== 'plant' && b.state !== 'defuse' && leashOK(b, attacker.body.pos)) {
    b.lastSeen.copy(attacker.body.pos); b.state = 'search'; b.searchT = 8; setPath(b, b.lastSeen.x, b.lastSeen.z);
    b.alertYaw = Math.atan2(-(attacker.body.pos.x - b.phys.pos.x), -(attacker.body.pos.z - b.phys.pos.z));
  } else if (b.state === 'hold' || b.state === 'patrol') {
    // 太遠不追：原地轉向打它的人
    b.holdYaw = Math.atan2(-(attacker.body.pos.x - b.phys.pos.x), -(attacker.body.pos.z - b.phys.pos.z)); b.yaw = lerp(b.yaw, b.yaw + angDiff(b.yaw, b.holdYaw), 0.5);
  }
}

// 找掩體：10 公尺內、威脅者看不到、離威脅者比較遠的路點
function seekCover(b, threat) {
  const pe = unitEye(threat, _ue).clone(), tp = threat.body.pos, p = b.phys.pos; let best = null, bs = -1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 10 || d < 1.5) continue;
    if (pointSeesPlayer(n.x, n.z, pe)) continue;
    const dp = Math.hypot(n.x - tp.x, n.z - tp.z);
    const sc = -d * 1.2 + Math.min(dp, 25) * 0.4 + Math.random();
    if (sc > bs) { bs = sc; best = n; }
  }
  if (!best) return false;
  setPath(b, best.x, best.z); if (!b.path || !b.path.length) return false;
  b.state = 'cover'; b.coverT = 0; b.coverWait = rand(1.4, 2.6); b.coverUsed = (b.coverUsed || 0) + 1; SHOOT_TOKENS.delete(b);
  return true;
}
// 包抄：同隊已經有人在打這個目標時，從側面繞過去（每隊一次最多一隻）
function tryFlank(b, tgt) {
  if (bots.some((o) => o !== b && o.alive && o.team === b.team && o.state === 'flank')) return false;
  const pp = tgt.body.pos, p = b.phys.pos, ang = Math.atan2(p.z - pp.z, p.x - pp.x) + pick([-1, 1]) * rand(1.0, 1.4), r = clamp(Math.hypot(p.x - pp.x, p.z - pp.z), 9, 16);
  const tx = pp.x + Math.cos(ang) * r, tz = pp.z + Math.sin(ang) * r;
  const n = nearestNode(clamp(tx, -34, 34), clamp(tz, -24, 24)); if (!n) return false;
  setPath(b, n.x, n.z); if (!b.path || !b.path.length) return false;
  b.state = 'flank'; b.flankT = 9; b.lastSeen.copy(pp); SHOOT_TOKENS.delete(b);
  return true;
}
// 這隻機器人用的難度：敵人用你選的難度；隊友固定用「普通」但不手下留情
// 敵人用你選的難度；隊友跟著難度稍微變強（困難時隊友才打得過困難的敵人）
function botDiff(b) { return b.team !== player.team ? (game.mode === 'rage' ? rageDiff() : DIFF[S.difficulty] || DIFF.normal) : S.difficulty === 'hard' ? DIFF.allyHard : DIFF.ally; }

const _wish = new V3();
function updateBot(b, dt) {
  if (!b.active) return;
  const p = b.phys.pos, D = botDiff(b);
  if (!b.alive) {
    b.deadT += dt; b.respawnT -= dt;
    if (b.g.visible) humanPose(b, dt);   // 倒地動作在 59-human
    if (game.mode !== 'match' && ((b.deadT > 3.6 && !inPlayerView(b)) || b.deadT > 6)) b.g.visible = false;   // 對戰模式屍體留到回合結束
    b.fl.visible = false; if (b.tag) b.tag.visible = false;
    if (b.respawnT <= 0) respawnBot(b);
    return;
  }
  if (b.tag) b.tag.visible = b.team === player.team;
  if (b.remote) { netDriveRemote(b, dt); botModel(b, dt); return; }   // 好友對戰：對手的位置來自網路
  // 教學的靶子：不會看、不會開槍，一直面向你
  if (b.dummy) { b.state = 'hold'; b.holdT = 99; b.holdObj = false; b.blindT = 99; b.target = null; b.visible = false; b.path = null; b.holdYaw = Math.atan2(-(player.body.pos.x - b.phys.pos.x), -(player.body.pos.z - b.phys.pos.z)); b.holdCrouch = false; }
  if (b.flinchT > 0) b.flinchT -= dt;
  if (b.blindT > 0) b.blindT -= dt;
  if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) { b.reloadT = 0; b.mag = b.wpn.mag; } }
  b.offT = inPlayerView(b) ? 0 : (b.offT || 0) + dt;
  if (b.spottedT > 0) b.spottedT -= dt;
  const frozen = typeof roundFrozen === 'function' && roundFrozen();
  // 感知：每 0.1 秒看一次
  b.seeT -= dt;
  if (b.seeT <= 0) {
    b.seeT = 0.1;
    const was = b.visible, prev = b.target;
    const tgt = frozen ? null : findTarget(b);
    b.visible = !!tgt;
    if (tgt) {
      b.target = tgt; b.lastSeen.copy(tgt.body.pos); b.lostT = 0;
      const intel = TEAM_INTEL[b.team]; intel.t = game.t; intel.pos.copy(tgt.body.pos);
      if (!tgt.isPlayer) tgt.spottedT = 1.5;
      const hiding = b.state === 'cover' && b.coverT < b.coverWait && p.distanceTo(tgt.body.pos) > 6;
      const committed = b.state === 'defuse' && b.useT > (b.useNeed || 10) * 0.55;   // 快拆完了就不管了
      if (game.mode === 'match' && b.team !== ROUND.atk) defenderCall(tgt.body.pos);
      if (committed) { b.visible = false; }
      else if (b.state !== 'combat' && !hiding) {
        b.useT = 0;
        // 剛發現：反應時間；背對的要多花轉身的時間
        const need = Math.abs(angDiff(b.yaw, Math.atan2(-(tgt.body.pos.x - p.x), -(tgt.body.pos.z - p.z))));
        b.react = D.react * rand(0.8, 1.25) * (b.state === 'search' ? 0.85 : 1) + need / Math.PI * 0.45; b.settle = 1;
        // 守點中（槍已經對著入口）：反應快、手比較穩
        if (b.state === 'hold' && b.holdObj) { b.react *= (hasTrait(b, 'anchor') ? 0.5 : 0.6) * (b.team !== ROUND.atk && MAP.defEdge || 1); b.settle = 0.45; }
        b.state = 'combat'; b.strafeT = 0; b.burst = 0; b.pauseT = 0; b.warnLeft = tgt.isPlayer ? D.warn : 0;
        b.flankCheck = rand(1.0, 2.0);
      } else if (!was || prev !== tgt) {
        // 目標躲起來再出來、或換了目標：要重新瞄準
        const hid = b.lostT;
        b.react = Math.max(b.react, D.react * (hid > 0.4 || prev !== tgt ? 0.8 : 0.45)); b.settle = Math.max(b.settle, hid > 0.4 ? 1 : 0.6);
        if (hid > 1.5 && tgt.isPlayer) b.warnLeft = D.warn;
      }
    }
  }
  _wish.set(0, 0, 0);
  const tg = b.target && b.target.alive ? b.target : null;
  const tp = tg ? tg.body.pos : b.lastSeen;
  const dx = tp.x - p.x, dz = tp.z - p.z, dist = Math.hypot(dx, dz);
  const toYaw = Math.atan2(-dx, -dz);
  b.crouchWant = false;

  if (frozen) {
    // 回合開始的凍結時間：站著不動
  } else if (b.state === 'combat') {
    if (!b.visible) {
      b.lostT += dt;
      if (b.lostT > 0.9 || !tg) {
        if (tg && leashOK(b, b.lastSeen)) { b.state = 'search'; b.searchT = 7; setPath(b, b.lastSeen.x, b.lastSeen.z); }
        else { b.state = 'patrol'; b.path = null; b.goalTag = null; if (!tg) b.target = null; }
      }
    }
    turnTo(b, Math.atan2(-(b.lastSeen.x - p.x), -(b.lastSeen.z - p.z)), D.turn, dt);
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      const holding = game.mode === 'match' && b.team !== ROUND.atk && !BOMB.planted;   // 守方守點：少跑動、多蹲
      b.strafe = pick(holding ? [0, 0, -1, 1] : [-1, 1, -1, 1, 0]); b.strafeT = rand(0.35, 1.1);
      b.crouch = b.strafe === 0 && Math.random() < (holding ? 0.6 : 0.35);
    }
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const pref = b.wpn.bot.pref; let adv = 0; if (dist > Math.max(pref[1], 12)) adv = 0.7; else if (dist < pref[0]) adv = -0.6;
    if ((b.wpn.scope || hasTrait(b, 'sniper')) && b.visible) { b.strafe = 0; }
    if (hasTrait(b, 'entry') && adv === 0 && dist > 9 && leashOK(b, p)) adv = 0.35;
    if (adv > 0 && (!leashOK(b, p) || (game.mode === 'match' && b.team !== ROUND.atk && !BOMB.planted))) adv = 0;
    if (!b.visible) adv = b.lostT > 1.5 ? 0.8 : 0;   // 對方剛躲起來：先守著掩體邊緣，過一會兒才追
    const sv = b.crouch ? 0 : 3.3;
    _wish.set(rx * b.strafe * sv + fx * adv * 3.5, 0, rz * b.strafe * sv + fz * adv * 3.5);
    // 搶點：邊打邊往圈裡擠（圈外的人才會）
    if (game.mode === 'koth' && MODE.zone) { const zx = MODE.zone.x - p.x, zz = MODE.zone.z - p.z, zd = Math.hypot(zx, zz); if (zd > KOTH.r - 1.2) { _wish.x += zx / zd * 2.6; _wish.z += zz / zd * 2.6; } }
    if (!b.visible && b.lostT > 0.3) b.crouch = false;
    b.crouchWant = b.crouch && b.visible;
    // 同隊有人在打這個目標、自己排不到（打你時的令牌）就有機會去包抄
    if (b.flankCheck !== undefined && (b.flankCheck -= dt) <= 0) {
      b.flankCheck = undefined;
      const mates = bots.some((o) => o !== b && o.alive && o.team === b.team && o.state === 'combat' && o.target === tg);
      const blocked = tg === player ? !SHOOT_TOKENS.has(b) && SHOOT_TOKENS.size > 0 : mates;
      if (tg && blocked && dist > 8 && Math.random() < 0.6 && leashOK(b, tg.body.pos)) tryFlank(b, tg);
    }
    if (b.state === 'combat' && b.visible && tg) {
      b.react -= dt; b.settle = Math.max(0, b.settle - dt * 0.7);
      if (unitSpeed(tg) > RUN_SPEED * 0.6) b.settle = Math.min(1, b.settle + dt * 0.5);   // 目標一直跑，就一直瞄不穩
      if (b.react <= 0 && b.reloadT <= 0 && (tg !== player || wantToken(b, D))) {
        if (b.pauseT > 0) b.pauseT -= dt;
        else {
          const bw = b.wpn.bot, bu = bw.burst || D.burst, pa = bw.pause || D.pause;
          if (b.burst <= 0) b.burst = Math.round(rand(bu[0], bu[1]));
          b.fireCd -= dt;
          if (b.fireCd <= 0 && Math.abs(angDiff(b.yaw, toYaw)) < 0.12) {
            botShoot(b, tg, dist, D); b.burst--; b.fireCd = bw.rate; b.mag--;
            if (b.mag <= 0) { b.reloadT = b.wpn.reload; b.burst = 0; }
            if (b.burst <= 0) { b.pauseT = rand(pa[0], pa[1]); if (Math.random() < 0.3) SHOOT_TOKENS.delete(b); }
          }
        }
      } else if (b.reloadT > 0) SHOOT_TOKENS.delete(b);
      // 對方躲起來一陣子、自己有手榴彈：丟過去
    } else if (b.state === 'combat' && !b.visible && b.lostT > 0.8 && b.nades.he > 0 && dist > 6 && dist < 24 && game.t - (b.thrownAt || -9) > 4) {
      botThrow(b, 'he', b.lastSeen.x, b.lastSeen.y, b.lastSeen.z);
    } else SHOOT_TOKENS.delete(b);
  } else if (b.state === 'cover') {
    b.coverT += dt;
    if (followPath(b, 4.8, _wish)) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 8, dt);
    else { b.crouchWant = true; turnTo(b, Math.atan2(-(b.lastSeen.x - p.x), -(b.lastSeen.z - p.z)), 5, dt); }
    if (b.coverT > b.coverWait + 2.5 || (!b.path || b.pi >= b.path.length) && b.coverT > b.coverWait) {
      b.state = 'search'; b.searchT = 7; setPath(b, b.lastSeen.x, b.lastSeen.z);
    }
  } else if (b.state === 'flank') {
    b.flankT -= dt;
    if (followPath(b, 4.6, _wish)) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 7, dt);
    if (!b.path || b.pi >= b.path.length || b.flankT <= 0) {
      b.state = 'search'; b.searchT = 6; if (tg) b.lastSeen.copy(tg.body.pos); setPath(b, b.lastSeen.x, b.lastSeen.z);
    }
  } else if (b.state === 'search' && game.mode === 'koth') {
    b.state = 'patrol'; b.path = null; b.goalTag = null;   // 搶點：不到處找人，回圈裡
  } else if (b.state === 'search') {
    b.searchT -= dt;
    if (b.alertYaw !== undefined) { turnTo(b, b.alertYaw, 8, dt); if (Math.abs(angDiff(b.yaw, b.alertYaw)) < 0.1) b.alertYaw = undefined; }
    if (followPath(b, 4.4, _wish)) { if (b.alertYaw === undefined) turnTo(b, Math.atan2(-_wish.x, -_wish.z), 7, dt); }
    else b.yaw += dt * 1.6;   // 到了就原地轉一圈看
    if (b.searchT <= 0) { b.state = 'patrol'; b.path = null; }
  } else if (b.state === 'hold') {
    // 守點：蹲或站在掩體旁，左右看
    b.holdT -= dt; b.crouchWant = b.holdCrouch;
    turnTo(b, b.holdYaw + Math.sin(game.t * 0.7 + b.i) * 0.5, 3, dt);
    if (b.holdT <= 0) { b.state = 'patrol'; b.path = null; }
    // 對戰：目標換了（開始進攻、炸彈裝好了、要轉點）就離開
    if (b.holdObj && game.t > (b.holdCheck || 0)) { b.holdCheck = game.t + 0.4; if (objectiveGoal(b).tag !== b.goalTag) { b.state = 'patrol'; b.path = null; b.holdObj = false; } else botHoldNades(b); }
  } else if (b.state === 'plant') {
    b.crouchWant = true; b.useT += dt;
    if (!isCarrier(b) || ROUND.phase !== 'live') { b.state = 'patrol'; b.useT = 0; }
    else if (b.useT >= PLANT_TIME) { b.useT = 0; plantBomb(b); b.state = 'patrol'; b.path = null; }
  } else if (b.state === 'defuse') {
    b.crouchWant = true; b.useT += dt; turnTo(b, Math.atan2(-(BOMB.pos.x - p.x), -(BOMB.pos.z - p.z)), 4, dt);
    if (BOMB.state !== 'planted' || ROUND.phase !== 'live') { b.state = 'patrol'; b.useT = 0; }
    else if (b.useT >= b.useNeed) { b.useT = 0; b.state = 'patrol'; defuseBomb(b); }
  } else if (game.mode === 'match') {
    botObjective(b, dt);
  } else if (game.mode === 'koth') {
    kothObjective(b, dt);
  } else if (game.mode === 'rage') {
    rageObjective(b, dt);
  } else {
    // 巡邏：練習模式走到隨機遠處；對戰時往前推進，到了有時守一下
    if (b.waitT > 0) { b.waitT -= dt; b.yaw += Math.sin(b.waitT * 2) * dt * 0.8; }
    else if (!followPath(b, game.mode === 'match' ? 3.6 : 2.9, _wish)) {
      if (b.path && game.mode === 'match' && Math.random() < 0.45) {
        b.state = 'hold'; b.holdT = rand(3, 8); b.holdCrouch = Math.random() < 0.4;
        b.holdYaw = b.team === 'A' ? -Math.PI / 2 : Math.PI / 2;   // 面向敵方
        b.path = null;
      } else { if (b.path) b.waitT = rand(0.6, 2); b.path = null; pickPatrol(b); }
    } else turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt);
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
  if (b.tagT > 0) { b.tagT -= dt; const k2 = 0.35 + 0.65 * (1 - b.tagT / 1.5); _wish.x *= k2; _wish.z *= k2; }
  if (b.crouchWant && !b.phys.crouched) { b.phys.h = CROUCH_H; b.phys.crouched = true; }
  else if (!b.crouchWant && b.phys.crouched && headroom(p.x, p.z, 0.3, p.y + CROUCH_H, p.y + STAND_H)) { b.phys.h = STAND_H; b.phys.crouched = false; }
  const k = 1 - Math.exp(-12 * dt);
  b.phys.vel.x += (_wish.x - b.phys.vel.x) * k; b.phys.vel.z += (_wish.z - b.phys.vel.z) * k;
  if (b.kbT > 0) { const f = b.kbT / 0.25; b.phys.vel.x = lerp(b.phys.vel.x, b.kbX, f); b.phys.vel.z = lerp(b.phys.vel.z, b.kbZ, f); b.kbT -= dt; }   // 中彈踉蹌：被子彈推退一小段
  if (moveBody(b.phys, dt) && b.state === 'combat') { b.strafe = -b.strafe; b.strafeT = rand(0.3, 0.7); }
  for (const o of bots) {
    if (o === b || !o.active || !o.alive) continue;
    const ex = p.x - o.phys.pos.x, ez = p.z - o.phys.pos.z, d = Math.hypot(ex, ez);
    if (d < 0.75 && d > 1e-4) { p.x += ex / d * (0.75 - d) * 0.5; p.z += ez / d * (0.75 - d) * 0.5; resolveXZ(b.phys); }
  }
  // 看的高低（觀戰鏡頭用）
  b.pitch = tg && b.visible ? Math.atan2(tg.body.pos.y + tg.body.h * 0.7 - (p.y + b.phys.h - 0.14), dist) : b.pitch * 0.9;
  botModel(b, dt);
}
// 模型：位置、走路、蹲、中彈與動作、腳步聲、槍口火光、明暗、命中框（好友對戰的對手也用這個）
function botModel(b, dt) {
  const p = b.phys.pos;
  const sp = Math.hypot(b.phys.vel.x, b.phys.vel.z);
  b.walk += dt * sp * 2.3;
  b.ck = lerp(b.ck, b.phys.crouched ? 1 : 0, 1 - Math.exp(-15 * dt));
  if (b.g.visible) humanPose(b, dt);   // 擬真人物的骨頭（59-human）
  // 腳步聲（離聽的人 30 公尺內聽得到，有方位）
  if (sp > 2.6 && b.phys.onGround) { b.stepT -= dt; if (b.stepT <= 0) { b.stepT = 0.36 * RUN_SPEED / sp; if (p.distanceTo(camera.position) < 30) { sfx('step', b.team === 'A' ? 0.5 : 0.9, { pos: p, surface: surfaceAt(p) }); if (b.team !== player.team) soundCue('step', p); } } }
  if (b.flashT > 0) { b.flashT -= dt; b.fl.visible = true; b.fl.material.rotation = Math.random() * 6; const fs = rand(0.26, 0.38); b.fl.scale.set(fs, fs, 1); } else b.fl.visible = false;
  if ((b.litT = (b.litT || 0) - dt) <= 0) { b.litT = 0.25; b.lit = bakeRay(p.x, p.y + 0.3, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0; b.litC = bakeRay(p.x, p.y + 1.3, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0; }
  b.litS = lerp(b.litS, b.litC === undefined ? 1 : b.litC, 1 - Math.exp(-4 * dt)); b.mat.color.setScalar(lerp(0.55, 1, b.litS));
  hitBoxes(p, b.phys.h, b.boxes);
}

// 機器人開槍：瞄準目標胸口，誤差 = （基本誤差 + 距離 × 係數 + 自己在動 + 目標在動 + 剛發現時手還不穩）× 武器準度
function botShoot(b, tg, dist, D) {
  const pp = tg.body.pos, isP = tg === player, w = b.wpn, n = w.pellets || 1;
  botEye(b, _be);
  // 開火前再確認一次看得到（感知 0.1 秒才更新一次）
  if (!lineClear(_be, _pt.set(pp.x, pp.y + tg.body.h - 0.12, pp.z)) && !lineClear(_be, _pt.set(pp.x, pp.y + tg.body.h * 0.62, pp.z))) { b.visible = false; return; }
  if (isP && player.spawnT > 0) return;       // 你剛重生的保護時間
  _pt.set(pp.x, pp.y + tg.body.h * 0.7, pp.z);
  // 打你時的警告射擊：剛發現你、或你在它背後畫面外的前 1 秒，子彈從你頭邊飛過
  let forceMiss = false;
  if (isP) {
    if (b.warnLeft > 0) { b.warnLeft--; forceMiss = true; }
    if (D.mercy && b.offT > 0 && b.offT < 1.0) forceMiss = true;
  }
  if (forceMiss) {
    const side = Math.random() < 0.5 ? -1 : 1, rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), off = rand(0.6, 0.95);
    _pt.x += rx * side * off; _pt.z += rz * side * off; _pt.y = pp.y + tg.body.h + rand(0.15, 0.45);
  }
  _bd.subVectors(_pt, _be).normalize();
  const moving = Math.hypot(b.phys.vel.x, b.phys.vel.z) > 1 ? 1 : 0;
  let errDeg = D.base + dist * D.distK + moving * (w.scope ? 6 : 1.0) + (unitSpeed(tg) / RUN_SPEED) * D.pMoveK + b.settle * D.settleK + (b.phys.crouched ? -0.2 : 0) + (b.flinchT > 0 ? 3.5 : 0);
  errDeg *= w.bot.err;
  if (b.blindT > 0) errDeg += 14;
  if (isP && D.mercy) {
    if (b.offT > 0) errDeg *= 1.6;
    const hpK = player.hp < 40 ? 1 + (40 - player.hp) / 40 * 0.5 : 1, streakK = 1 + Math.min(player.deathStreak || 0, 3) * 0.12;
    errDeg *= hpK * streakK;
  }
  if (forceMiss) errDeg = Math.min(errDeg, 1.2);
  const yaw0 = Math.atan2(-_bd.x, -_bd.z) + gauss() * errDeg * 0.5 * DEG;
  const pitch0 = Math.asin(clamp(_bd.y, -1, 1)) + gauss() * errDeg * 0.5 * DEG;
  b.g.updateMatrixWorld();
  const mz = b.fl.getWorldPosition(_v3);
  const hits = new Map(); let lastEnd = null;
  for (let k = 0; k < n; k++) {
    let yaw = yaw0, pitch = pitch0;
    if (n > 1) { const r = Math.sqrt(Math.random()) * w.pelletSpread * DEG, a = Math.random() * 6.283; yaw += Math.cos(a) * r; pitch += Math.sin(a) * r; }
    _bd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const wl = rayWorld(_be, _bd, 160);
    let t = wl ? wl.t : 160;
    // 子彈打到這條線上最近的敵隊單位（不一定是瞄的那個）
    let hitU = null, hitPart = null;
    if (!forceMiss) for (const u of enemiesOf(b.team)) { const h = rayBody(_be, _bd, u.boxes, t); if (h) { t = h.t; hitU = u; hitPart = h.part; } }
    const end = _end.copy(_be).addScaledVector(_bd, t);
    if (k < 2) spawnTracer(mz, end, b.team === player.team ? pal().tracerA : pal().tracerE, 0.018, hitU === player);
    if (hitU) {
      let dmg = hitDamage(w, hitPart, t, hitU);
      if (hitU === player) { if (hitPart === 'head') dmg *= D.headMul / 4; dmg *= D.dmg * 0.9; }
      const e = hits.get(hitU) || { dmg: 0, part: 'legs' }; e.dmg += dmg;
      if (hitPart === 'head' || (hitPart === 'body' && e.part === 'legs')) e.part = hitPart;
      hits.set(hitU, e);
      if (hitU !== player && k < 3) spawnPuff(end, '#9e1d16', 0.3, 0.3, 0.2);
    } else if (wl && k < 3) addDecal(end, wl.n);
  }
  for (const [u, e] of hits) {
    if (u === player) {
      let dmg = e.dmg;
      if (D.mercy && player.hp > 50 && player.hp - dmg <= 0) dmg = player.hp - 1;   // 血量一半以上時不會被一發打死（困難沒有）
      damagePlayer(dmg, b, e.part, w);
    } else damageBot(u, e.dmg, e.part, _bd.clone(), b, w);
  }
  sfx('botshot', 1, { pos: b.phys.pos, w });
  if (b.team !== player.team) soundCue('shot', b.phys.pos);
  muzzleLight(mz, 1.0);
  b.flashT = 0.05; b.firedAt = game.t;
  botsHearShot(b.phys.pos, b.team);
}
