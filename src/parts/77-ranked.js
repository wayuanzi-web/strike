/* ===== 77-ranked：段位賽、2 對 2、軍備競賽（M14，參考 CS2 Premier／Wingman／Arms Race）
   段位賽：對電腦的 5 對 5 炸彈模式。數字評分（Elo：贏強隊加多、輸弱隊扣多，回合差另外加減），對手強度跟著你的分數走；
     開打前禁選地圖（你禁一張 → 對手禁一張 → 你從剩下的選 → 對手選邊）；每月一個賽季，換季時分數往 1000 拉回一半、重打 5 場定級。
     中途離開算輸。
   2 對 2：你＋1 個隊友對 2 個敵人，只有一個包點；攻方出生在包點外的集合點、守方在包點，回合短（1 分 30 秒、先贏 6 回合）。
   軍備競賽：8 人人人互打，每殺 2 人自動換下一把槍（步槍 → 卡賓 → 狙擊 → 衝鋒 → 霰彈 → 重手槍 → 手槍），最後一關用黃金手槍擊殺就贏。 */

// ---------- 段位與賽季 ----------
// [最低分, 名稱, 徽章樣式, 圖案數]
const RANK_TIERS = [[0, '二兵', 'pvt', 1], [800, '一兵', 'pvt', 2], [950, '上兵', 'pvt', 3], [1100, '下士', 'nco', 1], [1250, '中士', 'nco', 2], [1400, '上士', 'nco', 3],
  [1550, '少尉', 'lt', 1], [1700, '中尉', 'lt', 2], [1850, '上尉', 'lt', 3], [2000, '少校', 'maj', 1], [2150, '中校', 'maj', 2], [2300, '上校', 'maj', 3],
  [2500, '少將', 'gen', 1], [2700, '中將', 'gen', 2], [2900, '上將', 'gen', 3]];
const RANK_START = 1000, PLACE_N = 5, RANK_K = 30;
function tierOf(r) { let i = 0; for (let k = 0; k < RANK_TIERS.length; k++) if (r >= RANK_TIERS[k][0]) i = k; const t = RANK_TIERS[i]; return { idx: i, min: t[0], name: t[1], kind: t[2], n: t[3] }; }
const seasonId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const seasonName = (id) => { const [y, m] = String(id).split('-'); return `${y} 年 ${+m} 月賽季`; };
const RKS = () => STATS.ranked;
const rankPlaced = () => RKS().placed >= PLACE_N;
// 換季：上一季的成績收進紀錄，分數往 1000 拉回一半，重打定級
function rankSeasonCheck(now) {
  const r = RKS(), id = seasonId(now);
  r.hist = r.hist.filter((h) => typeof h.d === 'number'); r.seasons = r.seasons.filter((s) => typeof s.final === 'number' && typeof s.id === 'string');   // 匯入的壞資料
  if (!r.season) { r.season = id; r.rating = RANK_START; r.peak = RANK_START; saveStats(); return false; }
  if (r.season === id) return false;
  if (r.played) r.seasons.unshift({ id: r.season, final: r.rating, peak: r.peak, w: r.wins, n: r.played, placed: r.placed >= PLACE_N });
  r.seasons = r.seasons.slice(0, 12);
  r.rating = Math.round(RANK_START + (r.rating - RANK_START) * 0.5); r.peak = r.rating;
  r.season = id; r.played = r.wins = r.placed = 0; r.hist = [];
  saveStats(); return true;
}
// 徽章：盾牌底色＋圖案。兵：V 形；士：V 形＋橫槓；尉：銀槓；校：金梅花；將：金星。定級中是問號
function rankBadge(rating, placed, px = 64) {
  const shield = 'M30 3 L56 12 V35 C56 51 44 62 30 67 C16 62 4 51 4 35 V12 Z';
  if (!placed) return `<svg class="rbadge" width="${px}" height="${px * 7 / 6}" viewBox="0 0 60 70" aria-label="定級中"><path d="${shield}" fill="#2a3340" stroke="#7d8a96" stroke-width="2.5"/><text x="30" y="45" text-anchor="middle" font-size="30" font-weight="800" fill="#9aa7b4">?</text></svg>`;
  const t = tierOf(rating), C = { pvt: ['#3a4450', '#c9d2dc'], nco: ['#1f3f5e', '#8fd0ff'], lt: ['#2c3440', '#e6ecf3'], maj: ['#3d2c12', '#ffd36a'], gen: ['#4a1414', '#ffd36a'] }[t.kind];
  let g = '';
  const xs = t.n === 1 ? [30] : t.n === 2 ? [21, 39] : [16, 30, 44];
  if (t.kind === 'pvt' || t.kind === 'nco') {
    for (let i = 0; i < t.n; i++) { const y = 22 + i * 9; g += `<path d="M15 ${y} L30 ${y + 9} L45 ${y}" fill="none" stroke="${C[1]}" stroke-width="4.5" stroke-linejoin="round"/>`; }
    if (t.kind === 'nco') g += `<rect x="16" y="${24 + t.n * 9}" width="28" height="4" rx="1.5" fill="${C[1]}"/>`;
  } else if (t.kind === 'lt') {
    for (const x of xs) g += `<rect x="${x - 3}" y="20" width="6" height="26" rx="1.5" fill="${C[1]}"/>`;
  } else if (t.kind === 'maj') {
    for (const x of xs) { for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.5708; g += `<circle cx="${(x + Math.cos(a) * 4.2).toFixed(1)}" cy="${(33 + Math.sin(a) * 4.2).toFixed(1)}" r="3.1" fill="${C[1]}"/>`; } g += `<circle cx="${x}" cy="33" r="2" fill="${C[0]}"/>`; }
  } else {
    for (const x of xs) { let d = ''; for (let k = 0; k < 10; k++) { const a = k * 0.6283 - 1.5708, rr = k % 2 ? 2.9 : 7; d += `${k ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(33 + Math.sin(a) * rr).toFixed(1)}`; } g += `<path d="${d}Z" fill="${C[1]}"/>`; }
  }
  return `<svg class="rbadge" width="${px}" height="${px * 7 / 6}" viewBox="0 0 60 70" aria-label="${t.name}"><path d="${shield}" fill="${C[0]}" stroke="${C[1]}" stroke-width="2.5"/>${g}</svg>`;
}
// 對手強度：照分數在 簡單（600）→ 普通（1000）→ 困難（1600）→ 精英（2600）之間內插；隊友從普通隊友內插到困難隊友
const DIFF_ELITE = Object.assign({}, DIFF.hard, { react: 0.3, base: 0.85, distK: 0.03, dmg: 0.82, turn: 8, maxShooters: 4, settleK: 2.0 });
const RANK_ANCH = [[600, DIFF.easy], [1000, DIFF.normal], [1600, DIFF.hard], [2600, DIFF_ELITE]];
function lerpDiff(a, b, k) {
  const o = {};
  for (const key in a) { const x = a[key], y = b[key]; o[key] = typeof x === 'number' ? lerp(x, y, k) : Array.isArray(x) ? x.map((v, i) => Math.round(lerp(v, y[i], k))) : (k < 0.5 ? x : y); }
  o.maxShooters = Math.round(o.maxShooters); o.warn = Math.round(o.warn); return o;
}
function diffForRating(r) {
  const A = RANK_ANCH; if (r <= A[0][0]) return lerpDiff(A[0][1], A[0][1], 0);
  for (let i = 0; i < A.length - 1; i++) if (r <= A[i + 1][0]) return lerpDiff(A[i][1], A[i + 1][1], (r - A[i][0]) / (A[i + 1][0] - A[i][0]));
  return lerpDiff(A[A.length - 1][1], A[A.length - 1][1], 0);
}
const allyForRating = (r) => lerpDiff(DIFF.ally, DIFF.allyHard, clamp((r - 1000) / 800, 0, 1));
const RK = { live: false, opp: 0, diff: null, ally: null, map: '', startAtk: 'A', veto: null, last: null, timers: [] };
// Elo：贏的時候至少 +5、輸的時候至少 -5；回合差每回合 ±1.2；定級賽 K 加倍
function rankDelta(win, roundDiff, placing) {
  const r = RKS().rating, E = 1 / (1 + Math.pow(10, (RK.opp - r) / 400)), K = placing ? RANK_K * 2 : RANK_K;
  let d = K * ((win ? 1 : 0) - E) + clamp(roundDiff, -7, 7) * 1.2;
  d = win ? Math.max(5, d) : Math.min(-5, d);
  return Math.round(d);
}
function rankApply(win, roundDiff, abandon) {
  const r = RKS(), placing = r.placed < PLACE_N, before = r.rating, tb = tierOf(before), wasPlaced = !placing;
  const d = rankDelta(win, roundDiff, placing) - (abandon ? 10 : 0);
  r.rating = Math.max(0, before + d); r.played++; if (win) r.wins++; if (placing) r.placed++;
  r.peak = Math.max(r.peak, r.rating); r.best = Math.max(r.best || 0, r.rating);
  r.hist.unshift({ d, win, map: RK.map || MAP.id, opp: RK.opp, ab: !!abandon }); r.hist = r.hist.slice(0, 10);
  const ta = tierOf(r.rating);
  RK.last = { before, after: r.rating, d, win, abandon: !!abandon, placedNow: !wasPlaced && r.placed >= PLACE_N, placing: r.placed < PLACE_N, up: wasPlaced && ta.idx > tb.idx, down: wasPlaced && ta.idx < tb.idx, tier: ta.name };
  RK.live = false;
  saveStats();
  if (RK.last.placedNow) progEvent('ranked', { placed: true });
  return RK.last;
}
// ---------- 段位賽畫面：段位、本季成績、最近變化 → 開始禁選 ----------
function renderRankOpt() {
  const r = RKS(), placed = rankPlaced(), t = tierOf(r.rating);
  const hist = r.hist.map((h) => `<li class="${h.win ? 'w' : 'l'}"><b>${h.d > 0 ? '+' : ''}${h.d}</b><span>${(MAPS[h.map] || { name: h.map }).name}${h.ab ? '・中途離開' : ''}</span></li>`).join('') || '<li><span>本季還沒打</span></li>';
  const past = r.seasons.slice(0, 4).map((s) => `<li>${rankBadge(s.final, s.placed, 26)}<span>${seasonName(s.id)}：${s.placed ? tierOf(s.final).name + ' ' + s.final + '（最高 ' + s.peak + '）' : '沒定級'}・${s.n} 場 ${s.w} 勝</span></li>`).join('');
  $('rankBody').innerHTML = `<div class="rkhead">${rankBadge(r.rating, placed, 84)}<div><b class="rkname">${placed ? t.name : '定級中'}</b>
    <strong class="rknum">${placed ? r.rating : `${r.placed} / ${PLACE_N}`}</strong><small>${placed ? `本季最高 ${r.peak}` : `再打 ${PLACE_N - r.placed} 場定級賽就會顯示段位`}</small></div></div>
    <p class="mnote">${seasonName(r.season)}・本季 ${r.played} 場 ${r.wins} 勝・每月 1 日換季（分數往 1000 拉回一半、重打定級）</p>
    <div class="rkcols"><section><h3>最近變化</h3><ul class="rkhist">${hist}</ul></section>${past ? `<section><h3>過去賽季</h3><ul class="rkpast">${past}</ul></section>` : ''}</div>
    <p class="mnote">對手強度跟著你的分數走（不用選難度）；贏強隊加多、輸弱隊扣多，回合差另外加減。中途離開算輸、多扣 10 分。</p>`;
}
function openRanked() { rankSeasonCheck(); renderRankOpt(); $('rankOpt').hidden = false; }
// ---------- 禁選地圖 ----------
function rankTimer(fn, ms) { RK.timers.push(setTimeout(fn, ms)); }
function openVeto() {
  $('rankOpt').hidden = true;
  RK.veto = { left: MAP_ORDER.slice(), banned: {}, step: 'ban', pick: '' };
  renderVeto(); $('rankVeto').hidden = false;
}
function closeVeto() { for (const t of RK.timers) clearTimeout(t); RK.timers = []; RK.veto = null; $('rankVeto').hidden = true; }
const VETO_MSG = { ban: '你先禁一張地圖（點一下）', aiban: '對手正在禁地圖…', pick: '從剩下的地圖選一張要打的', side: '對手選邊中…', go: '' };
function renderVeto() {
  const V = RK.veto; if (!V) return;
  $('vetoMsg').textContent = V.step === 'go' ? V.goMsg : VETO_MSG[V.step];
  const el = $('vetoMaps'); el.innerHTML = '';
  for (const id of MAP_ORDER) {
    const m = MAPS[id], st = STATS.maps[id] || { played: 0, won: 0 }, b = document.createElement('button');
    const ban = V.banned[id], picked = V.pick === id;
    b.className = 'vmap' + (ban ? ' ban' : '') + (picked ? ' pick' : ''); b.dataset.map = id;
    b.innerHTML = `<b>${m.name}</b><small>${m.sub}</small><small>你在這張：${st.played} 場・勝率 ${pct(st.won, st.played)}</small>${ban ? `<i>${ban === 'me' ? '你禁' : '對手禁'}</i>` : picked ? '<i>要打這張</i>' : ''}`;
    b.disabled = !!ban || !(V.step === 'ban' || V.step === 'pick') || picked;
    onTap(b, () => vetoTap(id));
    el.appendChild(b);
  }
}
// 對手禁你最拿手的地圖（勝率高、打得多），差不多時隨機
function aiBanChoice(left) {
  let best = left[0], bs = -1e9;
  for (const id of left) { const s = STATS.maps[id] || { played: 0, won: 0 }, sc = (s.won + 1) / (s.played + 2) + Math.min(s.played, 10) * 0.01 + Math.random() * 0.12; if (sc > bs) { bs = sc; best = id; } }
  return best;
}
function vetoTap(id) {
  const V = RK.veto; if (!V || V.banned[id]) return;
  if (V.step === 'ban') {
    V.banned[id] = 'me'; V.left = V.left.filter((x) => x !== id); V.step = 'aiban'; renderVeto(); sfx('ping', 0.4);
    rankTimer(() => { const a = aiBanChoice(V.left); V.banned[a] = 'ai'; V.left = V.left.filter((x) => x !== a); V.step = 'pick'; renderVeto(); sfx('ping', 0.4); }, 750);
  } else if (V.step === 'pick') {
    V.pick = id; V.step = 'side'; renderVeto(); sfx('go', 0.4);
    rankTimer(() => {
      RK.startAtk = Math.random() < 0.5 ? 'A' : 'B';
      V.step = 'go'; V.goMsg = `對手選擇先${RK.startAtk === 'A' ? '守' : '攻'}：你們上半場是${RK.startAtk === 'A' ? '攻方' : '守方'}`; renderVeto();
      rankTimer(() => startRanked(V.pick), 1100);
    }, 750);
  }
}
function startRanked(mapId) {
  closeVeto(); rankSeasonCheck();
  RK.map = mapId || MAP.id;
  if (MAP.id !== RK.map) { S.map = RK.map; saveSettings(); switchMap(RK.map); syncMapMenu(); }
  startGame('ranked-go');
}
// 開打（startGame 呼叫）：定對手分數與強度
function rankBegin() {
  const r = RKS().rating;
  RK.opp = Math.round(r + rand(-90, 90)); RK.diff = diffForRating(RK.opp); RK.ally = allyForRating(r); RK.live = true; RK.last = null;
}
// 中途離開：算輸、多扣 10 分
function rankAbandonCheck() {
  if (game.sub === 'ranked' && RK.live && ROUND.phase !== 'over') rankApply(false, -7, true);
}
// 結算畫面上的段位變化
function rankOverHtml() {
  const L = RK.last; if (!L) return '';
  const r = RKS(), placed = rankPlaced();
  const line = L.placing ? `定級賽 ${r.placed} / ${PLACE_N}（${L.win ? '勝' : '敗'}）` : L.placedNow ? `定級完成：${L.tier}　${L.after} 分` : `段位分 ${L.before} → ${L.after}（${L.d > 0 ? '+' : ''}${L.d}）`;
  const tag = L.up ? `<em class="up">升階！${L.tier}</em>` : L.down ? `<em class="down">降到 ${L.tier}</em>` : '';
  return `${rankBadge(L.after, placed, 46)}<span>${line}${tag}<small>對手 ${RK.opp} 分</small></span>`;
}
onTap($('bRanked'), openRanked);
onTap($('rankGo'), openVeto);
onTap($('rankX'), () => { $('rankOpt').hidden = true; });
onTap($('vetoX'), closeVeto);

// ---------- 2 對 2（Wingman）：一個包點、出生點就在包點附近 ----------
const WING = { site: 'A' };
const STD_ROUND = { winTo: 7, half: 6, freeze: 8, length: 115 }, WING_ROUND = { winTo: 6, half: 5, freeze: 6, length: 90 };
// 每張圖用哪一點：集合點離包點比較近的那一點（回合比較快）；地圖資料可以指定 wingSite
function wingSiteOf() {
  if (MAP.wing && SITES[MAP.wing.site]) return MAP.wing.site;
  let best = 'A', bd = 1e9; for (const k in SITES) { const s = SITES[k], d = Math.hypot(s.stage[0] - s.cx, s.stage[1] - s.cz); if (d < bd) { bd = d; best = k; } }
  return best;
}
// 出生點：守方在包點的守備位置；攻方在集合點附近（守點看不到的地方）挑 4 個互相隔開的路點
function wingSetup() {
  const site = WING.site = wingSiteOf(), S = SITES[site];
  const def = S.post.slice(0, 4).map((p) => [p[0], p[1]]);
  const st = S.stage, c = NAV.nodes.filter((n) => n.ok && !n.up && n.nb.length && Math.hypot(n.x - st[0], n.z - st[1]) < 9)
    .sort((a, b) => Math.hypot(a.x - st[0], a.z - st[1]) - Math.hypot(b.x - st[0], b.z - st[1]));
  const atk = [];
  for (const n of c) { if (atk.every((p) => Math.hypot(p[0] - n.x, p[1] - n.z) > 1.6)) atk.push([n.x, n.z]); if (atk.length >= 4) break; }
  while (atk.length < 4) atk.push([st[0] + atk.length * 0.8, st[1]]);
  while (def.length < 4) def.push(def[def.length - 1]);
  TEAM_SPAWN.atk = atk; TEAM_SPAWN.def = def;
}
// 出生時看的方向：攻方看包點、守方看集合點
function wingLook(team) { const S = SITES[WING.site]; return team === ROUND.atk ? [S.cx, S.cz] : [S.stage[0], S.stage[1]]; }

// ---------- 軍備競賽 ----------
const ARMS = { ladder: ['rifle', 'carbine', 'sniper', 'smg', 'shotgun', 'deagle', 'pistol', 'pistol'], per: [2, 2, 2, 2, 2, 2, 2, 1], limit: 420, win: null };
const ARMS_N = ARMS.ladder.length;
const armsFinal = (lv) => lv >= ARMS_N - 1;
const armsName = (lv) => (lv >= ARMS_N ? '完成' : armsFinal(lv) ? '黃金手槍' : WEAPONS[ARMS.ladder[lv]].name);
const armsUnits = () => [player].concat(bots.filter((b) => b.active));
function armsInit() { ARMS.win = null; ARMS.winT = 0; for (const u of armsUnits()) { u.armsLv = 0; u.armsK = 0; armsArm(u); } }
// 照關卡發槍：你手上只有這一把（子彈無限）；最後一關槍變金色
function armsArm(u) {
  const w = WEAPONS[ARMS.ladder[Math.min(u.armsLv || 0, ARMS_N - 1)]];
  if (u === player) {
    INV.primary = newItem(w); INV.secondary = null; INV.he = INV.flash = INV.smoke = INV.molotov = 0;
    equip('primary', true); W.deployT = Math.min(W.deployT, 0.3);
    if (armsFinal(u.armsLv)) armsGold(); else applyCosmetics();
  } else { u.primary = w; u.secondary = null; botArm(u); }
}
function armsGold() { const g = SKINS.find((s) => s.id === 'gold'); VM_TINT.poly.set(g.poly); VM_TINT.metal.set(g.metal); VM_MATS.poly.color.copy(VM_TINT.poly).multiply(VM_BASE.poly); VM_MATS.metal.color.copy(VM_TINT.metal).multiply(VM_BASE.metal); }
// 有人擊殺：殺滿這一關的數量就升一關；最後一關擊殺＝贏
function armsKill(killer) {
  if (game.sub !== 'arms' || ARMS.win || !killer) return;
  killer.armsK = (killer.armsK || 0) + 1;
  if (killer.armsK < ARMS.per[killer.armsLv || 0]) { if (killer === player) hudTip(`再殺 ${ARMS.per[player.armsLv] - player.armsK} 人換下一把`, 1.2); return; }
  killer.armsLv = (killer.armsLv || 0) + 1; killer.armsK = 0;
  if (killer.armsLv >= ARMS_N) { ARMS.win = killer; ARMS.winT = MODE.t; return; }
  if (killer === player) { player.armsDirty = true; hudTip(armsFinal(player.armsLv) ? '最後一關：用黃金手槍擊殺就贏！' : `升級：${armsName(player.armsLv)}（第 ${player.armsLv + 1}／${ARMS_N} 關）`, 2); sfx('go', 0.5); }
  else { armsArm(killer); if (armsFinal(killer.armsLv)) hudTip(`${killer.name} 到最後一關了`, 2); }
}
const armsRanking = () => armsUnits().map((u) => ({ name: u === player ? '你' : u.name, lv: u.armsLv || 0, k: u.armsK || 0, kills: u.kills, deaths: u.deaths, heads: u.heads, me: u === player }))
  .sort((a, b) => b.lv - a.lv || b.k - a.k || b.kills - a.kills || a.deaths - b.deaths);
onTap($('bWing'), () => startGame('wingman'));
onTap($('bArms'), () => startGame('arms'));
