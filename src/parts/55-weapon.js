/* ===== 55-weapon：五把槍＋三種投擲物——瞬間命中的射線、部位倍率、護甲、後座力花紋、散佈、換彈、換槍、手上的槍
   數值參考 CS 的同類武器（名稱、外型都是原創），手機上把跑步散佈減半、自動開火改成點放。
   bot：機器人用這把槍時的射速、連發數、準度倍數（越小越準）、喜歡的交戰距離。 */
const WEAPONS = {
  pistol: { id: 'pistol', vm: 'pistol', slot: 'secondary', name: '隼式手槍', short: '手槍', price: 0, reward: 300,
    dmg: 34, rate: 0.15, semi: true, mag: 12, reserve: 36, reload: 2.2, deploy: 0.45, range: 120, armorPen: 0.5, falloff: 0.86,
    base: 0.45, move: 2.2, air: 6, land: 1.0, bloomAdd: 0.9, bloomMax: 3.6, crouch: 0.85, ads: 0.8, adsFov: 62, recoilK: 0.55, speed: 1.04,
    kick: 2.6, vkick: 13, snd: { rate: 1.3, vol: 0.62 }, bot: { rate: 0.32, burst: [1, 3], err: 1.15, pause: [0.25, 0.5], pref: [4, 18] } },
  smg: { id: 'smg', vm: 'smg', slot: 'primary', name: '蜂式衝鋒槍', short: '衝鋒槍', price: 1250, reward: 600,
    dmg: 27, rate: 0.075, mag: 30, reserve: 120, reload: 2.25, deploy: 0.5, range: 120, armorPen: 0.6, falloff: 0.84,
    base: 0.4, move: 2.0, air: 6, land: 1.2, bloomAdd: 0.32, bloomMax: 3.5, crouch: 0.8, ads: 0.7, adsFov: 58, recoilK: 0.62, speed: 1.04,
    kick: 1.8, vkick: 7, snd: { rate: 1.16, vol: 0.72 }, bot: { rate: 0.085, burst: [4, 8], err: 1.2, pause: [0.35, 0.7], pref: [3, 15] } },
  shotgun: { id: 'shotgun', vm: 'shotgun', slot: 'primary', name: '犀式霰彈槍', short: '霰彈槍', price: 1100, reward: 900,
    dmg: 21, pellets: 9, pelletSpread: 3.6, rate: 0.88, mag: 7, reserve: 28, reload: 2.9, deploy: 0.6, range: 60, armorPen: 0.8, falloff: 0.55,
    base: 0, move: 1.5, air: 5, land: 1.0, bloomAdd: 0, bloomMax: 0, crouch: 0.9, ads: 1, adsFov: 66, recoilK: 1.6, speed: 0.98,
    kick: 4.5, vkick: 30, snd: { rate: 0.78, vol: 1.0 }, bot: { rate: 0.95, burst: [1, 1], err: 1.0, pause: [0.05, 0.2], pref: [2, 9] } },
  rifle: { id: 'rifle', vm: 'rifle', slot: 'primary', name: '曙七步槍', short: '步槍', price: 2900, reward: 300,
    dmg: 36, rate: 0.1, mag: 30, reserve: 90, reload: 2.45, deploy: 0.6, range: 160, armorPen: 0.775, falloff: 0.98,
    base: 0.25, move: 5.0, air: 7.0, land: 1.5, bloomAdd: 0.45, bloomMax: 4.0, crouch: 0.75, ads: 0.4, adsFov: 48, recoilK: 1, speed: 1,
    kick: 2.2, vkick: 10.5, snd: { rate: 1, vol: 0.9 }, bot: { rate: 0.11, burst: null, err: 1, pause: null, pref: [6, 40] } },
  sniper: { id: 'sniper', vm: 'sniper', slot: 'primary', name: '鷲式狙擊槍', short: '狙擊槍', price: 4750, reward: 100,
    dmg: 115, rate: 1.45, mag: 5, reserve: 20, reload: 3.6, deploy: 0.8, range: 200, armorPen: 0.97, falloff: 0.99,
    base: 6.5, scopedBase: 0.05, scope: true, move: 8, air: 12, land: 3, bloomAdd: 0, bloomMax: 0, crouch: 0.8, ads: 1, adsFov: 20, recoilK: 2.2, speed: 0.86,
    kick: 5, vkick: 40, snd: { rate: 0.68, vol: 1.15 }, bot: { rate: 1.5, burst: [1, 1], err: 0.35, pause: [1.0, 1.6], pref: [14, 80] } },
  // 第二把步槍：射速快、傷害低、比較準、後座小（像 CS 的 M4，守方愛用）
  carbine: { id: 'carbine', vm: 'carbine', slot: 'primary', name: '嵐式卡賓槍', short: '卡賓槍', price: 2700, reward: 300,
    dmg: 31, rate: 0.088, mag: 25, reserve: 75, reload: 2.2, deploy: 0.55, range: 160, armorPen: 0.7, falloff: 0.97,
    base: 0.2, move: 4.2, air: 7, land: 1.4, bloomAdd: 0.36, bloomMax: 3.4, crouch: 0.75, ads: 0.4, adsFov: 50, recoilK: 0.8, speed: 1.02,
    kick: 1.8, vkick: 9, snd: { rate: 1.14, vol: 0.82 }, bot: { rate: 0.095, burst: null, err: 0.92, pause: null, pref: [6, 36] } },
  // 重手槍：一發很痛、爆頭戴頭盔也一發倒，射速慢、跳得兇
  deagle: { id: 'deagle', vm: 'deagle', slot: 'secondary', name: '雷式重手槍', short: '重手槍', price: 700, reward: 300,
    dmg: 63, rate: 0.3, semi: true, mag: 7, reserve: 35, reload: 2.2, deploy: 0.55, range: 140, armorPen: 0.93, falloff: 0.81,
    base: 0.35, move: 3.2, air: 8, land: 1.4, bloomAdd: 2.2, bloomMax: 5, crouch: 0.8, ads: 0.7, adsFov: 60, recoilK: 0.9, speed: 1.0,
    kick: 4.2, vkick: 22, snd: { rate: 0.82, vol: 1.0 }, bot: { rate: 0.5, burst: [1, 2], err: 1.0, pause: [0.35, 0.6], pref: [5, 25] } },
};
// 投擲物（price 價錢、max 最多帶幾個）
const NADES = {
  he: { id: 'he', vm: 'he', name: '手榴彈', short: '手榴彈', price: 300, max: 1, reward: 300 },
  flash: { id: 'flash', vm: 'flash', name: '閃光彈', short: '閃光彈', price: 200, max: 2 },
  smoke: { id: 'smoke', vm: 'smoke', name: '煙霧彈', short: '煙霧彈', price: 300, max: 1 },
  molotov: { id: 'molotov', vm: 'molotov', name: '燃燒彈', short: '燃燒彈', price: 500, max: 1, reward: 300 },
};
const NADE_ORDER = ['he', 'flash', 'smoke', 'molotov'];
const RIFLE = WEAPONS.rifle;
let WP = WEAPONS.rifle;      // 手上這把

// 傷害：部位倍率 × 距離衰減；有防彈衣時身體打折、有頭盔時頭打折（腳沒有護甲）
function weaponDamage(w, part, dist, vest, helmet) {
  let d = w.dmg * PART_MUL[part] * Math.pow(w.falloff, dist / 12.7);
  if (part === 'head') { if (helmet) d *= w.armorPen * 0.94; }
  else if (part === 'body' && vest) d *= w.armorPen;
  return d;
}
// 護甲耐久：每件 100 點，擋掉的傷害扣在護甲上，扣完就沒有保護（頭盔跟著沒了）
const ARMOR_WEAR = 1;
const armorOf = (u) => (u === player ? INV : u);
function wearArmor(u, absorbed) {
  const A = armorOf(u); if (!(absorbed > 0)) return;
  if (A.armor == null) A.armor = 100;
  A.armor = Math.max(0, A.armor - absorbed * ARMOR_WEAR);
  if (A.armor <= 0) { A.vest = false; A.helmet = false; }
}
function giveArmor(u, helmet) { const A = armorOf(u); A.vest = true; if (helmet) A.helmet = true; A.armor = 100; }
// 子彈打到人：算傷害（含護甲），並扣護甲耐久
function hitDamage(w, part, dist, u) {
  const A = armorOf(u), vest = u === player ? INV.vest : A.vest !== false, helm = u === player ? INV.helmet : A.helmet !== false;
  const raw = weaponDamage(w, part, dist, false, false), d = weaponDamage(w, part, dist, vest, helm);
  if (d < raw) wearArmor(u, raw - d);
  return d;
}

// ---------- 你的裝備：主武器、手槍、投擲物、防彈衣、頭盔、拆彈器、炸彈 ----------
const INV = { primary: null, secondary: null, cur: 'secondary', last: 'primary', he: 0, flash: 0, smoke: 0, molotov: 0, nade: 'he', vest: false, helmet: false, armor: 0, kit: false, bomb: false };
function newItem(def) { return { def, ammo: def.mag, reserve: def.reserve }; }
function stashCur() { const it = INV.cur !== 'nade' && INV[INV.cur]; if (it) { it.ammo = W.ammo; it.reserve = W.reserve; } }
function equip(slot, quiet) {
  if (slot === 'nade') { if (!INV[INV.nade]) { const n = NADE_ORDER.find((k) => INV[k] > 0); if (!n) return false; INV.nade = n; } }
  else if (!INV[slot]) return false;
  stashCur();
  if (INV.cur !== slot && INV.cur !== 'nade') INV.last = INV.cur;
  INV.cur = slot; W.reloadT = 0; W.throwT = 0; player.ads = false; INPUT.adsQueued = false;
  if (slot === 'nade') { WP = WEAPONS.pistol; setViewmodel(INV.nade); W.deployT = 0.35; W.isNade = true; }
  else { const it = INV[slot]; WP = it.def; W.ammo = it.ammo; W.reserve = it.reserve; setViewmodel(WP.vm); W.deployT = WP.deploy; W.isNade = false; }
  W.bloom = 0; W.idx = 0; W.rp = W.ry = 0; W.cd = Math.max(W.cd, 0);
  if (!quiet) sfx('magin', 0.5);
  return true;
}
// 換槍鍵：主武器 ↔ 手槍（拿著投擲物時回到上一把槍）
function swapWeapon() {
  if (INV.cur === 'nade') { equip(INV[INV.last] ? INV.last : INV.primary ? 'primary' : 'secondary'); return; }
  const to = INV.cur === 'primary' ? 'secondary' : 'primary';
  if (!equip(to)) hudTip(to === 'primary' ? '沒有主武器' : '沒有手槍', 1);
}
// 投擲物鍵：拿出投擲物；已經拿著就換下一種
function cycleNade() {
  const have = NADE_ORDER.filter((k) => INV[k] > 0);
  if (!have.length) { hudTip('沒有投擲物', 1); return; }
  if (INV.cur === 'nade') { const i = have.indexOf(INV.nade); INV.nade = have[(i + 1) % have.length]; setViewmodel(INV.nade); W.deployT = 0.25; return; }
  if (!INV[INV.nade]) INV.nade = have[0];
  equip('nade');
}
function giveWeapon(def, switchTo = true) {
  stashCur();
  INV[def.slot] = newItem(def);
  if (switchTo || INV.cur === def.slot) { INV.cur = '__'; equip(def.slot, true); }
}
function bestSlot() { return INV.primary ? 'primary' : 'secondary'; }
// 陣亡或換邊：只剩一把手槍
function resetLoadout(keep) {
  if (!keep) {
    INV.primary = null; INV.secondary = newItem(WEAPONS.pistol); INV.he = INV.flash = INV.smoke = INV.molotov = 0;
    INV.vest = INV.helmet = INV.kit = false; INV.armor = 0;
  } else {
    // 活下來：保留裝備，彈藥補滿（CS 的彈藥不補，這裡為了手機上好玩，回合開始補滿）
    for (const k of ['primary', 'secondary']) { const it = INV[k]; if (it) { it.ammo = it.def.mag; it.reserve = it.def.reserve; } }
  }
  INV.bomb = false; INV.cur = '__'; equip(bestSlot(), true);
}

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
  kick: 0, kickV: 0, roll: 0, flashT: 0, emptyClick: 0, shots: 0, hits: 0, autoN: 0, autoPause: 0, deployT: 0, dragging: false, throwT: 0, isNade: false, pumpT: 0 };
// 重生：練習模式拿步槍＋手槍；對戰模式由回合決定裝備（keep：上回合活下來，裝備保留）
function resetWeapon(keep) {
  W.reloadT = 0; W.cd = 0; W.bloom = 0; W.idx = 0; W.rp = 0; W.ry = 0; W.vp = 0; W.vpv = 0;
  W.kick = 0; W.kickV = 0; W.land = 0; W.autoN = 0; W.autoPause = 0; W.throwT = 0;
  if (game.mode !== 'match') {
    if (!INV.secondary) INV.secondary = newItem(WEAPONS.pistol);
    if (!INV.primary) INV.primary = newItem(WEAPONS.rifle);
    resetLoadout(true); giveArmor(player, true);
  } else resetLoadout(keep);
  W.deployT = 0.6;
}
const reloading = () => W.reloadT > 0;
function startReload() {
  if (W.isNade || W.reloadT > 0 || W.ammo >= WP.mag || W.reserve <= 0 || !player.alive) return;
  W.reloadT = WP.reload; player.ads = false; sfx('magout'); W.magIn = false;
}
// 現在的散佈（度）：跑到 34%（手機 40%）速度以上才開始變大；空中、落地瞬間更大；蹲、開鏡變小；連射越來越散
function currentSpread() {
  const sp = playerSpeed() / RUN_SPEED, th = INPUT.mode === 'touch' ? 0.4 : 0.34;
  // 狙擊槍：沒開鏡時很散（盲狙），開鏡後幾乎不散，但一動就散
  const base = WP.scope ? lerp(WP.base, WP.scopedBase, Math.pow(player.adsT, 3)) : WP.base;
  let s = base + WP.move * Math.max(0, (sp - th) / (1 - th)) + (player.body.onGround ? 0 : WP.air) + W.land + W.bloom;
  if (player.crouch && player.body.onGround) s *= WP.crouch;
  if (!WP.scope) s *= lerp(1, WP.ads, player.adsT);
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
  W.cd -= dt; W.since += dt; W.flashT -= dt; W.emptyClick -= dt; W.autoPause -= dt; if (W.pumpT > 0) W.pumpT -= dt;
  if (W.deployT > 0) W.deployT -= dt;
  if (roundFrozen() || (typeof plantBusy === 'function' && plantBusy())) wantFire = false;
  // 投擲物：按下開火就丟（拉環、揮手），丟完回到上一把槍
  if (W.isNade) {
    if (W.throwT > 0) {
      const before = W.throwT; W.throwT -= dt;
      if (before > 0.14 && W.throwT <= 0.14) {
        const k = INV.nade; INV[k]--; eyePos(_o); aimDir(_d);
        throwNade(k, _o, _d, player, player.body.vel); if (game.mode === 'duel') netNade(k, _o, _d, player.body.vel);
      }
      if (W.throwT <= 0) { W.throwT = 0; if (INV[INV.nade] > 0) { W.deployT = 0.35; } else if (NADE_ORDER.some((n) => INV[n] > 0)) cycleNade(); else equip(INV[INV.last] ? INV.last : bestSlot(), true); }
    } else if (wantFire && !auto && player.alive && W.deployT <= 0 && INV[INV.nade] > 0) { W.throwT = 0.42; sfx('magout', 0.6); }
    W.spread = 3; updateSpring(dt); return;
  }
  if (W.reloadT > 0) {
    W.reloadT -= dt;
    if (!W.magIn && W.reloadT < WP.reload * 0.45) { W.magIn = true; sfx('magin'); }
    if (W.reloadT <= 0) { W.reloadT = 0; const n = Math.min(WP.mag - W.ammo, W.reserve); W.ammo += n; W.reserve -= n; if (INPUT.adsQueued) { player.ads = true; INPUT.adsQueued = false; } }
  }
  // 自動開火的點放：中遠距離打 4 發停 0.28 秒，讓花紋與散佈回來；8 公尺內才全自動
  if (auto && dist > 8 && W.autoPause > 0) wantFire = false;
  if (!auto) W.autoN = 0;
  if (wantFire && player.alive && W.reloadT <= 0 && W.deployT <= 0) {
    if (W.ammo <= 0) {
      if (W.emptyClick <= 0) { sfx('empty'); W.emptyClick = 0.3; if (W.reserve <= 0) hudTip(game.mode === 'match' ? '沒子彈了：換手槍（換槍鍵）' : '沒子彈了：擊倒機器人補彈，或陣亡後補滿', 2); }
      startReload();
    } else if (W.cd <= 0) {
      // 半自動（手槍）：按住時每 0.2 秒一發
      shoot(); W.cd += WP.semi ? Math.max(WP.rate, auto ? WP.rate + 0.04 : 0.2) : WP.rate; if (W.cd < 0) W.cd = 0;
      if (auto && dist > 8 && ++W.autoN >= (dist > 25 ? 3 : 4)) { W.autoN = 0; W.autoPause = dist > 25 ? 0.35 : 0.28; }
    }
  } else if (W.cd < 0) W.cd = 0;
  // 後座力：開火中往花紋走；停火後指數＋線性回正（CS 的回正方式）
  if (W.since < 0.11) {
    // 觸控很難邊打邊往下拉：手指沒在拖時自動補償一半的上飄
    const comp = INPUT.mode === 'touch' ? (W.dragging ? 0.75 : 0.5) : 1;
    const t = patternAt(W.idx), k = 1 - Math.exp(-dt * 30);
    W.rp += (t[0] * comp * WP.recoilK - W.rp) * k; W.ry += (t[1] * WP.recoilK - W.ry) * k;
  } else {
    W.rp = decayTo0(W.rp, dt); W.ry = decayTo0(W.ry, dt);
    W.idx = Math.max(0, W.idx - dt * 45);
    if (W.idx === 0 && W.since > 0.5) rollNoise();
  }
  if (W.since > 0.1) W.bloom *= Math.exp(-dt / 0.12);
  W.land = Math.max(0, W.land - dt * WP.land / 0.25);
  updateSpring(dt);
  W.spread = currentSpread();
}
function updateSpring(dt) {
  // 每發額外的畫面小跳（只影響畫面，不影響子彈），彈簧回位
  W.vpv += (-260 * W.vp - 32 * W.vpv) * dt; W.vp += W.vpv * dt;
  // 手上的槍後座：臨界阻尼彈簧
  W.kickV += (-400 * W.kick - 40 * W.kickV) * dt; W.kick += W.kickV * dt; W.roll *= Math.exp(-dt * 14);
}

const _o = new V3(), _d = new V3(), _hit = new V3(), _mz = new V3();
const _pel = new Map();
function shoot() {
  W.ammo--; W.since = 0; W.idx = Math.min(29, W.idx + 1); W.shots++;
  const spreadDeg = currentSpread(), n = WP.pellets || 1;
  W.bloom = Math.min(WP.bloomMax, W.bloom + WP.bloomAdd);
  eyePos(_o); muzzleWorld(_mz); _pel.clear();
  let decals = 0, anyHit = false;
  for (let k = 0; k < n; k++) {
    // 散佈圓內取一點：半徑取「亂數×散佈」，落點集中在中心（CS 的做法）；霰彈每顆另外在固定的圓錐裡平均分布
    const r = ((n > 1 ? Math.sqrt(Math.random()) * WP.pelletSpread : 0) + Math.random() * spreadDeg) * DEG, a = Math.random() * Math.PI * 2;
    aimDir(_d, Math.cos(a) * r, Math.sin(a) * r);
    const res = traceShot(_o, _d, WP.range);
    _hit.copy(_o).addScaledVector(_d, res.t);
    if (res.bot) {
      anyHit = true;
      const dmg = hitDamage(WP, res.part, res.t, res.bot);
      const e = _pel.get(res.bot) || { dmg: 0, part: 'legs', dir: _d.clone() }; e.dmg += dmg;
      if (res.part === 'head' || (res.part === 'body' && e.part === 'legs')) e.part = res.part;
      _pel.set(res.bot, e);
      if (k < 4) { const bw = rayWorld(_hit, _d, 2.5); if (bw) addBloodSplat(_v2.copy(_hit).addScaledVector(_d, bw.t), bw.n); }
      spawnPuff(_hit, '#9e1d16', res.part === 'head' ? 0.55 : 0.35, 0.35, 0.2);
      if (res.part === 'head') spawnSparks(_hit, _d, '#ffd27a', 5);
    } else if (res.n && decals < 4) {
      decals++; addDecal(_hit, res.n); spawnPuff(_hit, '#cfc6b6', n > 1 ? 0.25 : 0.4, 0.5, 0.5);
      spawnSparks(_hit, _v1.set(res.n[0], res.n[1], res.n[2]), '#ffcf86', n > 1 ? 1 : 3);
    }
    if (k < 3) spawnTracer(_mz, _hit, '#ffe0a0', n > 1 ? 0.018 : 0.028);
  }
  if (anyHit) W.hits++;
  if (game.mode === 'duel') netShot(_mz, _hit, decals > 0);
  for (const [bot, e] of _pel) {
    player.dealt += Math.min(e.dmg, Math.max(0, bot.hp)); player.dealtHits++;
    damageBot(bot, e.dmg, e.part, e.dir, player, WP);
  }
  muzzleLight(_mz, WP.scope || n > 1 ? 1.8 : 1.3);
  W.flashT = 0.045;
  W.kickV += WP.kick; W.roll = (Math.random() - 0.5) * 0.04 * WP.kick / 2.2;
  W.vpv += WP.vkick + Math.random() * 3;
  if (n > 1) W.pumpT = 0.55;
  if (!(n > 1) && !WP.scope) ejectShell();
  sfx('shot', 1, { w: WP });
  try { if (S.vibrate && navigator.vibrate && INPUT.mode === 'touch') navigator.vibrate(WP.scope || n > 1 ? 18 : 8); } catch (e) { /* iPhone 不支援震動 */ }
  botsHearShot(player.body.pos, 'A');
}
// 一條射線：先找打到的牆，再看有沒有更近的機器人
function traceShot(o, d, range) {
  const w = rayWorld(o, d, range);
  let t = w ? w.t : range, bot = null, part = null;
  if (SMOKES.length) smokeBullet(o, d, t);   // 子彈穿過煙：打出一條短暫的洞
  for (const b of bots) {
    if (!b.active || !b.alive || b.team === player.team) continue;   // 子彈會穿過隊友（不會誤傷）；死鬥每個機器人自己一隊
    const h = rayBody(o, d, b.boxes, t);
    if (h) { t = h.t; bot = b; part = h.part; }
  }
  return { t, bot, part, n: bot ? null : (w ? w.n : null) };
}
function muzzleWorld(out) {
  gunRig.updateMatrixWorld(true); camera.updateMatrixWorld();
  const m = gun.localToWorld(_v3.copy(gun.userData.muzzle)).project(vmCam);
  return out.set(m.x, m.y, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(1.2).add(camera.position);
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
const HIP = new V3(0.2, -0.205, -0.46), ADS = new V3(0, -0.078, -0.3);
// 各武器拿的位置（腰射、開鏡）
const VM_POS = {
  rifle: [HIP, ADS], smg: [new V3(0.19, -0.19, -0.42), new V3(0, -0.085, -0.3)], shotgun: [new V3(0.2, -0.2, -0.44), new V3(0, -0.095, -0.34)],
  sniper: [new V3(0.2, -0.21, -0.46), new V3(0, -0.11, -0.2)], pistol: [new V3(0.12, -0.13, -0.5), new V3(0, -0.085, -0.44)],
  he: [new V3(0.17, -0.13, -0.44), new V3(0.17, -0.13, -0.44)],
};
VM_POS.flash = VM_POS.smoke = VM_POS.molotov = VM_POS.he; VM_POS.carbine = VM_POS.rifle; VM_POS.deagle = VM_POS.pistol;
function viewmodelLand(v) { VM.landV -= Math.min(0.5, v * 0.04); }
function updateViewmodel(dt, lookDX, lookDY) {
  const sp = playerSpeed(), moving = player.body.onGround ? Math.min(1, sp / RUN_SPEED) : 0;
  VM.bobT += dt * (5 + sp * 1.2) * (moving > 0.05 ? 1 : 0);
  VM.swayX = lerp(VM.swayX, clamp(-lookDX * 0.003, -0.04, 0.04), 1 - Math.exp(-8 * dt));
  VM.swayY = lerp(VM.swayY, clamp(lookDY * 0.003, -0.035, 0.035), 1 - Math.exp(-8 * dt));
  VM.landV += (-180 * VM.landY - 22 * VM.landV) * dt; VM.landY += VM.landV * dt;
  const k = player.adsT, bobA = moving * (1 - k * 0.8);
  const vp = VM_POS[W.isNade ? INV.nade : WP.vm] || VM_POS.rifle;
  gunRig.position.lerpVectors(vp[0], vp[1], k);
  gunRig.position.x += Math.sin(VM.bobT) * 0.012 * bobA + VM.swayX * (1 - k) * 0.6;
  gunRig.position.y += -Math.abs(Math.cos(VM.bobT)) * 0.012 * bobA + VM.swayY * (1 - k) * 0.4 - (player.body.onGround ? 0 : 0.02)
    - 0.015 * moving * (1 - k) + VM.landY * (1 - k * 0.7);
  gunRig.position.z += W.kick * lerp(0.04, 0.02, k);
  gunRig.rotation.set(W.kick * lerp(0.06, 0.02, k) + VM.swayY, VM.swayX * 1.5, W.roll);
  // 出槍：從畫面下方抬起來
  if (W.deployT > 0) { const d = Math.min(1, W.deployT / 0.6); gunRig.position.y -= d * d * 0.25; gunRig.rotation.x -= d * d * 0.6; }
  // 換彈：槍往下歪、彈匣拔出再插回去
  const mag = gun.userData.mag, la = gun.userData.leftArm, my = gun.userData.magY;
  mag.position.y = my; mag.visible = true; la.position.set(0, 0, 0);
  gunRig.rotation.x += k * 0.05;
  if (W.reloadT > 0) {
    const p = 1 - W.reloadT / WP.reload, tilt = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    gunRig.rotation.z += tilt * 0.55; gunRig.rotation.x += tilt * 0.25; gunRig.position.y -= tilt * 0.06;
    if (p > 0.1 && p < 0.62) { const t = Math.sin((p - 0.1) / 0.52 * Math.PI); la.position.set(0.05 * t, -0.08 * t, 0.22 * t); }
    if (p > 0.12 && p < 0.4) mag.position.y = my - (p - 0.12) / 0.28 * 0.3;
    else if (p >= 0.4 && p < 0.45) mag.visible = false;
    else if (p >= 0.45 && p < 0.56) mag.position.y = my - (0.56 - p) / 0.11 * 0.25;
  }
  // 霰彈槍：開槍後拉一下泵動護木
  if (W.pumpT > 0 && WP.pellets > 1) { const t = Math.sin((1 - W.pumpT / 0.55) * Math.PI); la.position.z = 0.09 * t; }
  // 投擲物：往後拉、再往前甩出去
  if (W.isNade && W.throwT > 0) {
    const p = 1 - W.throwT / 0.42;
    if (p < 0.6) { const t = p / 0.6; gunRig.position.z += 0.12 * t; gunRig.position.y += 0.06 * t; gunRig.rotation.x += 0.5 * t; }
    else { const t = (p - 0.6) / 0.4; gunRig.position.z += 0.12 - 0.5 * t; gunRig.position.y += 0.06 - 0.3 * t; gunRig.rotation.x += 0.5 - 1.6 * t; }
    gun.visible = p < 0.68 || W.throwT <= 0;
  } else gun.visible = true;
  // 狙擊鏡：開鏡時看不到槍（畫瞄準鏡）
  if (WP.scope && !W.isNade && player.adsT > 0.85) gun.visible = false;
  flash.visible = W.flashT > 0;
  if (flash.visible) { flash.rotation.z = Math.random() * 6.28; const s = rand(0.8, 1.3) * lerp(1, 0.4, player.adsT); flash.scale.set(s, s, 1); }
  updateShells(dt);
}
