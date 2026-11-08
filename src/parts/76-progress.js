/* ===== 76-progress：成長——等級與經驗、成就、每日挑戰、外觀（槍的塗裝、隊友外框色）、擊殺鏡頭、回合 MVP、戰績匯出匯入
   全部存在 STATS.prog（跟戰績一起存、一起匯出）。 */
const LV_MAX = 30;
function emptyProg() { return { xp: 0, ach: {}, daily: null, skin: 'base', team: 'cyan', c: { kills: 0, sniper: 0, nade: 0 } }; }
function ensureProg() { STATS.prog = Object.assign(emptyProg(), STATS.prog || {}); STATS.prog.c = Object.assign(emptyProg().c, STATS.prog.c); }
ensureProg();
const P = () => STATS.prog;
// 等級：第 n 級升 n+1 級要 250 + 50n 經驗
const lvNeed = (n) => 250 + 50 * n;
function levelOf(xp) {
  let lv = 1, rest = xp;
  while (lv < LV_MAX && rest >= lvNeed(lv)) { rest -= lvNeed(lv); lv++; }
  return { lv, into: rest, need: lv >= LV_MAX ? 0 : lvNeed(lv) };
}
// 這場拿到的經驗（結束畫面列出來）
const GAIN = { list: [], total: 0, lv0: 1 };
function gainReset() { GAIN.list = []; GAIN.total = 0; GAIN.lv0 = levelOf(P().xp).lv; }
function addXP(n, why) {
  if (!(n > 0)) return;
  const before = levelOf(P().xp).lv; P().xp += n; GAIN.total += n;
  const g = GAIN.list.find((x) => x[0] === why); if (g) { g[1] += n; g[2]++; } else GAIN.list.push([why, n, 1]);
  const after = levelOf(P().xp).lv;
  if (after > before) {
    const un = unlocksAt(after); sfx('win', 0.6);
    toast(`升到 ${after} 級！` + (un.length ? `解鎖：${un.join('、')}` : ''), 'lv');
    if (after >= 10) unlock('lv10');
  }
}

// ---------- 成就 ----------
const ACH = [
  ['tutorial', '新兵報到', '完成新手教學'], ['first_kill', '第一滴血', '第一次擊殺'], ['first_win', '首勝', '贏一場對戰'],
  ['first_plant', '裝彈手', '第一次裝好炸彈'], ['first_defuse', '拆彈專家', '第一次拆掉炸彈'], ['round3', '一回合三殺', '對戰的一個回合裡殺 3 人'],
  ['match15', '殺不停', '一場對戰殺 15 人'], ['head5', '神射手', '一場對戰爆頭 5 次'], ['pistol2', '手槍之王', '一場對戰兩個手槍局都贏'],
  ['clutch', '一打二', '隊上只剩你、對面還有 2 人以上，還是贏下回合'], ['deagle_head', '一槍斃命', '用重手槍爆頭擊殺'],
  ['nade_kill', '天降正義', '用手榴彈或燃燒彈擊殺'], ['sniper10', '鷹眼', '用狙擊槍累積擊殺 10 人'], ['kills100', '百人斬', '累積擊殺 100 人'],
  ['matches10', '老兵', '打完 10 場對戰'], ['all_maps', '四方征戰', '每張地圖都贏過對戰'], ['dm_win', '獨孤求敗', '個人死鬥拿第一'],
  ['koth_win', '寸土必爭', '贏一場搶點'], ['range_fast', '快手', '練槍場平均反應 500 毫秒內（打倒 20 個以上）'], ['lv10', '十級老手', '升到 10 級'],
];
function unlock(id) {
  if (P().ach[id]) return false;
  const a = ACH.find((x) => x[0] === id); if (!a) return false;
  const d = new Date(); P().ach[id] = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  toast(`成就達成：${a[1]}　+50 經驗`, 'ach'); addXP(50, '成就'); saveStats();
  return true;
}

// ---------- 每日挑戰：每天 3 個，用日期當種子（同一天每次打開都一樣） ----------
const DAILY = [
  { id: 'k_smg', t: '用衝鋒槍擊殺 10 人', n: 10, on: 'kill', ok: (d) => d.w && d.w.id === 'smg' },
  { id: 'k_rifle', t: '用步槍或卡賓槍擊殺 15 人', n: 15, on: 'kill', ok: (d) => d.w && (d.w.id === 'rifle' || d.w.id === 'carbine') },
  { id: 'k_sniper', t: '用狙擊槍擊殺 3 人', n: 3, on: 'kill', ok: (d) => d.w && d.w.id === 'sniper' },
  { id: 'k_shotgun', t: '用霰彈槍擊殺 6 人', n: 6, on: 'kill', ok: (d) => d.w && d.w.id === 'shotgun' },
  { id: 'k_pistol', t: '用手槍或重手槍擊殺 5 人', n: 5, on: 'kill', ok: (d) => d.w && d.w.slot === 'secondary' },
  { id: 'head', t: '爆頭擊殺 8 次', n: 8, on: 'kill', ok: (d) => d.head },
  { id: 'k_nade', t: '用手榴彈或燃燒彈擊殺 1 人', n: 1, on: 'kill', ok: (d) => d.w && (d.w.id === 'he' || d.w.id === 'molotov') },
  { id: 'plant', t: '對戰裝好炸彈 2 次', n: 2, on: 'plant', ok: () => true },
  { id: 'defuse', t: '對戰拆掉炸彈 1 次', n: 1, on: 'defuse', ok: () => true },
  { id: 'win_map', t: '在「{map}」贏一場對戰', n: 1, on: 'match', ok: (d, it) => d.win && d.map === it.map },
  { id: 'win_any', t: '贏 2 場對戰', n: 2, on: 'match', ok: (d) => d.win },
  { id: 'dm', t: '打完一場個人死鬥', n: 1, on: 'mode', ok: (d) => d.kind === 'dm' },
  { id: 'koth_win', t: '贏一場搶點', n: 1, on: 'mode', ok: (d) => d.kind === 'koth' && d.win },
  { id: 'range', t: '練槍場平均反應 650 毫秒內', n: 1, on: 'mode', ok: (d) => d.kind === 'range' && d.r && d.r.hit >= 15 && d.r.avgMs <= 650 },
];
const PROG = { dateOverride: null };
function today() { if (PROG.dateOverride) return PROG.dateOverride; const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ensureDaily() {
  const day = today(); if (P().daily && P().daily.date === day) return P().daily;
  let h = hashStr('strike' + day); const pick = []; const pool = DAILY.slice();
  while (pick.length < 3) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; const t = pool.splice(h % pool.length, 1)[0]; pick.push(t); }
  P().daily = { date: day, items: pick.map((t) => ({ id: t.id, p: 0, done: false, map: t.id === 'win_map' ? MAP_ORDER[h % MAP_ORDER.length] : undefined })) };
  saveStats(); return P().daily;
}
const dailyText = (it) => { const t = DAILY.find((x) => x.id === it.id); return t.t.replace('{map}', it.map ? MAPS[it.map].name : ''); };
function dailyEvent(on, d) {
  const D = ensureDaily();
  for (const it of D.items) {
    const t = DAILY.find((x) => x.id === it.id); if (!t || it.done || t.on !== on || !t.ok(d, it)) continue;
    it.p = Math.min(t.n, it.p + 1);
    if (it.p >= t.n) { it.done = true; toast(`每日挑戰完成：${dailyText(it)}　+150 經驗`, 'ach'); addXP(150, '每日挑戰'); }
  }
}

// ---------- 事件：各模式在這裡回報，給經驗、算成就和挑戰 ----------
function progEvent(ev, d = {}) {
  const m = game.mode, c = P().c;
  if (m === 'tutorial' && ev !== 'tutorial') return;
  if (ev === 'kill') {
    if (m === 'practice') addXP(2, '練習擊殺');
    else { addXP(m === 'match' ? 10 : 6, '擊殺'); if (d.head) addXP(5, '爆頭'); }
    c.kills++; if (d.w && d.w.id === 'sniper') c.sniper++; if (d.w && (d.w.id === 'he' || d.w.id === 'molotov')) c.nade++;
    unlock('first_kill');
    if (d.w && d.w.id === 'deagle' && d.head) unlock('deagle_head');
    if (c.nade >= 1) unlock('nade_kill');
    if (c.sniper >= 10) unlock('sniper10');
    if (c.kills >= 100) unlock('kills100');
    if (m === 'match') {
      ROUND.myK = (ROUND.myK || 0) + 1; if (ROUND.myK >= 3) unlock('round3');
      if (MSTAT.kills >= 15) unlock('match15'); if (MSTAT.heads >= 5) unlock('head5');
    }
    dailyEvent('kill', d);
  } else if (ev === 'plant') { addXP(15, '裝彈'); unlock('first_plant'); dailyEvent('plant', d); }
  else if (ev === 'defuse') { addXP(20, '拆彈'); unlock('first_defuse'); dailyEvent('defuse', d); }
  else if (ev === 'round') {
    if (d.win) addXP(10, '回合勝利');
    if (d.win && d.pistol) { ROUND.pistolW = (ROUND.pistolW || 0) + 1; if (ROUND.pistolW >= 2) unlock('pistol2'); }
    if (d.win && d.clutch) unlock('clutch');
  } else if (ev === 'match') {
    addXP(50, '打完一場'); if (d.win) { addXP(100, '勝利'); unlock('first_win'); } if (d.mvp) addXP(30, '本場 MVP');
    if (STATS.matches >= 10) unlock('matches10');
    if (MAP_ORDER.every((id) => STATS.maps[id] && STATS.maps[id].won > 0)) unlock('all_maps');
    dailyEvent('match', d);
  } else if (ev === 'mode') {
    addXP(40, '打完一場'); if (d.win && d.kind !== 'range') addXP(80, d.kind === 'dm' ? '第一名' : '勝利');
    if (d.kind === 'range' && d.r) addXP(Math.round(30 * clamp(1 - (d.r.avgMs - 400) / 600, 0, 1) + 20 * d.r.acc), '練槍成績');
    if (d.kind === 'dm' && d.win) unlock('dm_win');
    if (d.kind === 'koth' && d.win) unlock('koth_win');
    if (d.kind === 'range' && d.r && d.r.hit >= 20 && d.r.avgMs <= 500) unlock('range_fast');
    dailyEvent('mode', d);
  } else if (ev === 'tutorial') { addXP(100, '完成教學'); unlock('tutorial'); }
  saveStats();
}

// ---------- 外觀：槍的塗裝（手上的槍）、隊友外框色（隊友身上的光） ----------
const SKINS = [
  { id: 'base', name: '原廠', lv: 1, poly: '#ffffff', metal: '#ffffff' }, { id: 'desert', name: '沙漠', lv: 2, poly: '#e8c890', metal: '#f2e6d0' },
  { id: 'jungle', name: '叢林', lv: 4, poly: '#94ab6c', metal: '#ccd4bc' }, { id: 'midnight', name: '午夜', lv: 6, poly: '#6476a8', metal: '#a4b0d0' },
  { id: 'crimson', name: '赤紅', lv: 8, poly: '#d4604e', metal: '#efd8d2' }, { id: 'snow', name: '雪地', lv: 10, poly: '#ffffff', metal: '#ffffff', bright: 1.25 },
  { id: 'jade', name: '青花', lv: 13, poly: '#70b8cc', metal: '#dceff4' }, { id: 'dawn', name: '曙光', lv: 16, poly: '#ffb478', metal: '#ffe4c4' },
  { id: 'gold', name: '黃金', lv: 20, poly: '#f0c858', metal: '#ffdc7a' },
];
const TEAMC = [
  { id: 'cyan', name: '青藍', lv: 1, rim: [0.55, 0.8, 1.0], hex: '#8cccff' }, { id: 'green', name: '翠綠', lv: 3, rim: [0.45, 1.0, 0.55], hex: '#74ff8c' },
  { id: 'violet', name: '紫羅蘭', lv: 7, rim: [0.8, 0.55, 1.0], hex: '#cc8cff' }, { id: 'gold', name: '金色', lv: 12, rim: [1.0, 0.85, 0.35], hex: '#ffd85a' },
  { id: 'white', name: '雪白', lv: 15, rim: [1.0, 1.0, 1.0], hex: '#ffffff' },
];
function unlocksAt(lv) { return SKINS.filter((s) => s.lv === lv).map((s) => `塗裝「${s.name}」`).concat(TEAMC.filter((t) => t.lv === lv).map((t) => `隊友外框「${t.name}」`)); }
const myLv = () => levelOf(P().xp).lv;
function applyCosmetics() {
  const sk = SKINS.find((s) => s.id === P().skin && s.lv <= myLv()) || SKINS[0], k = sk.bright || 1;
  VM_TINT.poly.set(sk.poly).multiplyScalar(k); VM_TINT.metal.set(sk.metal).multiplyScalar(k);
  VM_MATS.poly.color.copy(VM_TINT.poly); VM_MATS.metal.color.copy(VM_TINT.metal);
  const tc = TEAMC.find((t) => t.id === P().team && t.lv <= myLv()) || TEAMC[0];
  for (const b of bots) if (b.mat && b.mat.userData.rimU) { if (b.baseTeam === 'A') b.mat.userData.rimU.value.setRGB(...tc.rim); }
}
function equipCosmetic(kind, id) {
  const list = kind === 'skin' ? SKINS : TEAMC, it = list.find((x) => x.id === id);
  if (!it || it.lv > myLv()) return false;
  P()[kind === 'skin' ? 'skin' : 'team'] = id; saveStats(); applyCosmetics(); return true;
}

// ---------- 提示：右上角跳出來的成就、升級、挑戰 ----------
const TOASTS = []; let toastT = 0;
function toast(text, cls = '') { TOASTS.push([text, cls]); if (TOASTS.length > 4) TOASTS.shift(); if (toastT <= 0) nextToast(); }
function nextToast() { const el = $('toast'); const t = TOASTS.shift(); if (!t) { el.hidden = true; return; } el.textContent = t[0]; el.className = t[1]; el.hidden = false; toastT = 2.6; }
function updateToast(dt) { if (toastT > 0) { toastT -= dt; if (toastT <= 0) nextToast(); } }

// ---------- 擊殺鏡頭：錄最近 3 秒所有人的位置，陣亡時從殺你的人的眼睛重播 ----------
const KC = { buf: [], on: false, t: 0, frames: null, killer: null, avatar: null, k: 0 };
function kcRecord() {
  if (!S.killcam || !player.alive || (game.mode !== 'match' && game.mode !== 'practice')) return;
  if ((KC.k = (KC.k + 1) % 2)) return;   // 每秒 30 格
  const pp = player.body.pos;
  KC.buf.push({ p: [pp.x, pp.y, pp.z, player.yaw, player.crouch ? 1 : 0], b: bots.map((b) => [b.phys.pos.x, b.phys.pos.y, b.phys.pos.z, b.yaw, b.alive && b.active && b.g.visible ? 1 : 0, b.flashT > 0 ? 1 : 0]) });
  if (KC.buf.length > 100) KC.buf.shift();
}
function killcamStart(killer) {
  KC.on = false;
  if (!S.killcam || !killer || (game.mode !== 'match' && game.mode !== 'practice') || KC.buf.length < 20) return;
  KC.frames = KC.buf.slice(-90); KC.killer = killer; KC.t = -0.7; KC.on = true; KC.buf = [];
  if (game.mode === 'practice') player.respawnT = Math.max(player.respawnT, 0.7 + KC.frames.length / 30 + 0.4);
}
function killcamStop() { KC.on = false; $('kc').hidden = true; if (!player.alive && game.state === 'play' && !(game.mode === 'match' && player.deadT > 2)) $('dead').hidden = false; }
// 每格：回傳 true 表示這格的攝影機由擊殺鏡頭接管
function killcamCamera(dt) {
  if (!KC.on) return false;
  if (player.alive || game.state !== 'play') { killcamStop(); return false; }
  KC.t += dt; if (KC.t < 0) return false;
  const i = Math.min(KC.frames.length - 1, Math.floor(KC.t * 30)), f = KC.frames[i], ki = bots.indexOf(KC.killer), kb = f.b[ki];
  if (!kb || KC.t * 30 >= KC.frames.length) { killcamStop(); return false; }
  $('dead').hidden = true; $('kc').hidden = false; $('kcN').textContent = KC.killer.name;
  camera.position.set(kb[0], kb[1] + STAND_H - 0.14, kb[2]);
  camera.lookAt(f.p[0], f.p[1] + (f.p[4] ? 1.0 : 1.4), f.p[2]);
  camera.fov = BASE_FOV; camera.updateProjectionMatrix();
  return true;
}
// 重播時把每個人擺回當時的位置（畫完再放回去）；你用一個代替的人形
function killcamRender(draw) {
  const f = KC.frames[Math.min(KC.frames.length - 1, Math.floor(KC.t * 30))], saved = [];
  if (!KC.avatar) { KC.avatar = makeBotModel('A'); scene.add(KC.avatar.g); }
  bots.forEach((b, i) => { const s = f.b[i]; saved.push([b.g.position.clone(), b.g.rotation.y, b.g.visible, b.fl.visible]);
    b.g.position.set(s[0], s[1], s[2]); b.g.rotation.set(0, s[3], 0); b.g.visible = !!s[4] && b !== KC.killer; b.fl.visible = !!s[5] && b.g.visible; });
  const A = KC.avatar.g; A.visible = true; A.position.set(f.p[0], f.p[1], f.p[2]); A.rotation.set(0, f.p[3], 0);
  draw();
  A.visible = false;
  bots.forEach((b, i) => { const s = saved[i]; b.g.position.copy(s[0]); b.g.rotation.y = s[1]; b.g.visible = s[2]; b.fl.visible = s[3]; });
}
const killcamActive = () => KC.on && KC.t >= 0;

// ---------- 回合 MVP：這回合勝方殺最多的人 ----------
function roundKill(u) { if (game.mode !== 'match' || ROUND.phase !== 'live') return; ROUND.rk = ROUND.rk || {}; ROUND.rk[u.name] = (ROUND.rk[u.name] || 0) + 1; }
function roundMvp(winner) {
  const rk = ROUND.rk || {}, units = matchUnits().filter((u) => u.team === winner);
  let best = null, bk = 0; for (const u of units) { const k = rk[u.name] || 0; if (k > bk) { bk = k; best = u; } }
  return best ? { name: best.name, k: bk, me: best === player } : null;
}

// ---------- 戰績匯出、匯入：一段代碼（戰績＋等級成就＋設定），換手機時貼上 ----------
function b64enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
function exportCode() { const json = JSON.stringify({ v: 1, stats: STATS, settings: S }); return 'DS1.' + b64enc(json) + '.' + hashStr(json).toString(36); }
function parseCode(code) {
  const m = String(code || '').trim().replace(/\s+/g, '').match(/^DS1\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/);
  if (!m) return { err: '代碼格式不對（應該是 DS1. 開頭的一長串）' };
  let json; try { json = b64dec(m[1]); } catch (e) { return { err: '代碼壞掉了，請重新複製' }; }
  if (hashStr(json).toString(36) !== m[2]) return { err: '代碼不完整或被改過，請重新複製' };
  try { const d = JSON.parse(json); if (d.v !== 1 || !d.stats) return { err: '不認得的代碼版本' }; return { data: d }; } catch (e) { return { err: '代碼內容讀不出來' }; }
}
function applyImport(d) {
  STATS = Object.assign(emptyStats(), d.stats); STATS.modes = Object.assign(emptyStats().modes, STATS.modes); ensureProg(); saveStats();
  if (d.settings) { Object.assign(S, d.settings); saveSettings(); syncSettingsUI(); applyHand(); }
  applyCosmetics(); syncMenuLevel();
$('kc').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); killcamStop(); });
}

// ---------- 成長畫面 ----------
function renderProg() {
  const L = levelOf(P().xp), D = ensureDaily();
  $('pgLv').textContent = L.lv; $('pgXp').textContent = L.need ? `${L.into} / ${L.need} 經驗` : '滿級';
  $('pgBar').style.width = (L.need ? L.into / L.need * 100 : 100) + '%';
  $('pgDaily').innerHTML = D.items.map((it) => { const t = DAILY.find((x) => x.id === it.id); return `<li class="${it.done ? 'done' : ''}"><b>${dailyText(it)}</b><span class="pb"><i style="width:${it.p / t.n * 100}%"></i></span><small>${it.done ? '完成 +150' : `${it.p} / ${t.n}`}</small></li>`; }).join('');
  const got = Object.keys(P().ach).length;
  $('pgAchN').textContent = `${got} / ${ACH.length}`;
  $('pgAch').innerHTML = ACH.map(([id, n, t]) => `<li class="${P().ach[id] ? 'done' : ''}"><b>${P().ach[id] ? '✓ ' : ''}${n}</b><small>${t}${P().ach[id] ? '・' + P().ach[id] : ''}</small></li>`).join('');
  const sw = (list, kind, cur) => list.map((x) => `<button class="sk${x.id === cur ? ' on' : ''}" data-kind="${kind}" data-id="${x.id}" ${x.lv > L.lv ? 'disabled' : ''}><i style="background:${kind === 'skin' ? `linear-gradient(135deg, ${x.poly} 50%, ${x.metal} 50%)` : x.hex}"></i><b>${x.name}</b><small>${x.lv > L.lv ? `${x.lv} 級解鎖` : x.id === cur ? '使用中' : '可用'}</small></button>`).join('');
  $('pgSkin').innerHTML = sw(SKINS, 'skin', P().skin); $('pgTeam').innerHTML = sw(TEAMC, 'team', P().team);
  for (const b of $('prog').querySelectorAll('.sk')) onTap(b, () => { if (equipCosmetic(b.dataset.kind, b.dataset.id)) { sfx('cash'); renderProg(); } });
}
function openProg() { renderProg(); $('pgCode').value = ''; $('pgMsg').textContent = ''; $('prog').hidden = false; }
function closeProg() { $('prog').hidden = true; syncMenuLevel(); }
function syncMenuLevel() { const L = levelOf(P().xp); $('mLv').textContent = `${L.lv} 級`; $('mXp').style.width = (L.need ? L.into / L.need * 100 : 100) + '%'; const D = ensureDaily(); $('mDaily').textContent = `每日挑戰 ${D.items.filter((x) => x.done).length}/3`; }
let importArm = -1e9;
onTap($('bProg'), openProg); onTap($('pgX'), closeProg);
onTap($('pgExport'), () => { const c = exportCode(); $('pgCode').value = c; $('pgMsg').textContent = `代碼 ${c.length} 字，已選起來；按「複製」或長按自己複製，到新手機的這裡貼上按「匯入」。`; try { $('pgCode').select(); } catch (e) { /* 略過 */ } });
onTap($('pgCopy'), () => { const c = $('pgCode').value || exportCode(); $('pgCode').value = c;
  const ok = () => { $('pgMsg').textContent = '已複製'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(ok, () => { $('pgCode').select(); $('pgMsg').textContent = '請長按代碼自己複製'; }); else { $('pgCode').select(); try { document.execCommand('copy'); ok(); } catch (e) { $('pgMsg').textContent = '請長按代碼自己複製'; } } });
onTap($('pgImport'), () => {
  const r = parseCode($('pgCode').value);
  if (r.err) { $('pgMsg').textContent = r.err; importArm = -1e9; return; }
  // 按兩次才匯入（會蓋掉這台手機的戰績）
  if (performance.now() - importArm > 15000) { importArm = performance.now(); const L = levelOf(r.data.stats.prog ? r.data.stats.prog.xp : 0); $('pgMsg').textContent = `代碼正確：${L.lv} 級、${r.data.stats.matches || 0} 場對戰。再按一次「匯入」會蓋掉這台手機現在的紀錄。`; return; }
  applyImport(r.data); importArm = -1e9; renderProg(); $('pgMsg').textContent = '匯入完成！'; sfx('win', 0.5);
});

// ---------- 結束畫面：這場拿到多少經驗 ----------
function overXpLine() {
  const L = levelOf(P().xp), parts = GAIN.list.map(([w, n, k]) => `${w}${k > 1 ? '×' + k : ''} +${n}`).join('、');
  const D = ensureDaily(), dd = D.items.filter((x) => x.done).length;
  $('overX').innerHTML = `<b>+${GAIN.total} 經驗</b>　${L.lv > GAIN.lv0 ? `升到 ${L.lv} 級！` : `${L.lv} 級（${L.need ? L.into + '/' + L.need : '滿級'}）`}<br><small>${parts || '—'}・每日挑戰 ${dd}/3</small>`;
}
applyCosmetics(); syncMenuLevel();
$('kc').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); killcamStop(); });
