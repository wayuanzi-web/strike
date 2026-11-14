/* ===== 75-rage：狂暴模式——發洩用
   你一個人對上一波接一波、越來越多也越來越強的敵人。
   你這邊：所有武器免費、隨時能買（左上「購買」）、子彈無限不用換彈、投擲物每 6 秒補一顆、擊殺回血、停火 2.5 秒後快速回血、3 條命。
   敵人：每波更多、血更厚、打得更準更痛；從第 3 波開始混進「精英」（血很厚、拿重武器）；每 5 波一隻「魔王」。
   爽度：每殺一個爆出金色聖光、連殺計數；連殺 8 次進入「狂暴」8 秒（傷害 2 倍、受傷減半、畫面金光）。
   3 條命用完就結束，看撐到第幾波、殺幾個、最高連殺。 */
const RAGE_NAMES = ['血牙', '鐵顎', '焚風', '裂骨', '黑鴉', '狂犀', '毒蠍', '碎岩', '赤眼', '怒獅', '暴鬣', '鬼鯊', '蠻牛'];
const RAGE = {
  wave: 0, left: 0, spawned: 0, total: 0, breakT: 0, lives: 3, deadSeen: false,
  combo: 0, comboT: 0, best: 0, frenzy: 0, regenT: 0, nadeT: 0, kills: 0, diff: null, overT: -1,
};
const RAGE_LIVES = 3, RAGE_FRENZY_AT = 8, RAGE_FRENZY_T = 8, RAGE_COMBO_T = 4;
// 第一次玩狂暴才多做 13 個敵人（其它模式用不到，不先佔記憶體）
function ensureRageBots() {
  if (bots.some((b) => b.rageOnly)) return;
  for (const n of RAGE_NAMES) { const b = makeBot(n, 'B'); b.rageOnly = true; }
}
// 一波：總人數、同時在場上限（省電畫質少一點）、血量倍數
const rageTotal = (w) => 8 + w * 4;
const rageMaxAlive = (w) => Math.min(S.quality === 'eco' ? 9 : 13, 5 + w);
const rageHp = (w) => 100 * (1 + 0.14 * (w - 1));
function rageDiffFor(w) {
  const k = Math.min(1, (w - 1) / 9);
  return Object.assign({}, DIFF.hard, { react: lerp(0.62, 0.32, k), base: lerp(1.5, 0.9, k), dmg: lerp(0.34, 0.8, k), maxShooters: w < 4 ? 2 : w < 8 ? 3 : 4, mercy: false, warn: w >= 3 ? 0 : 1 });
}
// 敵人有沒有比較強：給 botDiff 用
const rageDiff = () => RAGE.diff || DIFF.hard;

// 開打前的選項：一般／無敵、從第 1 波或從上次死掉的那一波繼續
function openRageOpt() {
  const last = STATS.modes.rage.lastWave || 0, el = $('rageOpt');
  for (const b of $('rageGodSeg').children) b.classList.toggle('on', (b.dataset.g === '1') === !!S.rageGod);
  $('rageGoN').hidden = last < 2; $('rageGoN').textContent = `從第 ${last} 波繼續`;
  $('rageOptNote').textContent = (S.rageGod ? '無敵：敵人照樣打你、看得到中彈方向，但不扣血、不會死。' : '一般：3 條命，打倒魔王多 1 條。') + '只有「一般、從第 1 波開始」的成績會記進紀錄。';
  $('menu').hidden = true; el.hidden = false;
}
for (const b of $('rageGodSeg').children) onTap(b, () => { S.rageGod = b.dataset.g === '1'; saveSettings(); openRageOpt(); });
onTap($('rageGo1'), () => { $('rageOpt').hidden = true; startGame('rage'); });
onTap($('rageGoN'), () => { $('rageOpt').hidden = true; RAGE.nextStart = STATS.modes.rage.lastWave || 1; startGame('rage'); });
onTap($('rageX'), () => { $('rageOpt').hidden = true; $('menu').hidden = false; });
onTap($('bRageCont'), () => { $('over').hidden = true; RAGE.nextStart = RAGE.wave || 1; startGame('rage'); });
function startRage() {
  ensureRageBots();
  const startWave = Math.max(1, RAGE.nextStart || 1); RAGE.nextStart = 0;
  game.mode = 'rage'; game.lastMode = 'rage'; MODE.kind = 'rage'; MODE.t = 0; MODE.over = false;
  player.team = 'A'; player.kills = player.deaths = player.heads = 0; player.money = 0; gainReset();
  setupBots('rage'); removeZone();
  for (const b of bots) if (b.active) { b.alive = false; b.g.visible = false; b.respawnT = Infinity; b.deadT = 9; b.rageKind = ''; b.name = b.baseName; }   // 全部先下場，由波次一個一個叫上來
  Object.assign(RAGE, { startWave, god: !!S.rageGod, wave: startWave - 1, left: 0, spawned: 0, total: 0, breakT: 2.5, lives: RAGE_LIVES, deadSeen: false, deathsSeen: 0, combo: 0, comboT: 0, best: 0, frenzy: 0, regenT: 0, nadeT: 0, kills: 0, overT: -1 });
  spawnPlayer(); rageGear(true); RAGE.wIdx = 0;
  W.shots = W.hits = 0;
  enterPlay();
  document.body.classList.add('mode');
  hudBanner('狂暴模式', (startWave > 1 ? `從第 ${startWave} 波繼續・` : '') + (RAGE.god ? '無敵・' : '') + '武器全免費、子彈無限、換槍鍵一按就換', 3, 'rage');
}
// 狂暴換槍：換槍鍵一按就換下一把，依序輪流；出槍很快（0.15 秒）
const RAGE_ARSENAL = ['rifle', 'carbine', 'smg', 'shotgun', 'sniper', 'deagle'];
function rageCycleWeapon(dir) {
  if (game.mode !== 'rage' || !player.alive) return;
  RAGE.wIdx = ((RAGE.wIdx || 0) + dir + RAGE_ARSENAL.length) % RAGE_ARSENAL.length;
  const def = WEAPONS[RAGE_ARSENAL[RAGE.wIdx]], slot = def.id === 'deagle' ? 'secondary' : 'primary';
  INV[slot] = newItem(def); INV.cur = ''; equip(slot, true); W.deployT = 0.15; sfx('magin', 0.6);
  const strip = RAGE_ARSENAL.map((k, i) => (i === RAGE.wIdx ? `【${WEAPONS[k].short}】` : WEAPONS[k].short)).join(' ');
  hudTip(strip, 1.2);
}
// 你的裝備：一開始給步槍＋重手槍＋全套投擲物；每條命都有滿護甲
function rageGear(fresh) {
  if (fresh || !INV.primary) INV.primary = newItem(WEAPONS.rifle);
  if (fresh || !INV.secondary) INV.secondary = newItem(WEAPONS.deagle);
  INV.he = Math.max(INV.he || 0, 2); INV.flash = Math.max(INV.flash || 0, 1); INV.molotov = Math.max(INV.molotov || 0, 1); INV.smoke = Math.max(INV.smoke || 0, 1);
  INV.vest = INV.helmet = true; player.armor = 100;
}
function rageNextWave() {
  RAGE.wave++; RAGE.total = rageTotal(RAGE.wave); RAGE.spawned = 0; RAGE.left = RAGE.total; RAGE.diff = rageDiffFor(RAGE.wave);
  const boss = RAGE.wave % 5 === 0;
  hudBanner(`第 ${RAGE.wave} 波`, `${RAGE.total} 個敵人${boss ? '・魔王出現' : RAGE.wave >= 3 ? '・有精英' : ''}`, 2.2, 'rage');
  sfx(boss ? 'ring' : 'go', 0.8);
}
// 叫一個敵人上場：挑離你遠、你看不到的地方
function rageSpawnOne() {
  const b = bots.find((x) => x.active && !x.alive && x.team === 'B' && (x.deadT > 1.5 || !x.g.visible)); if (!b) return false;   // 剛倒下的屍體先別拿來用
  const n = RAGE.spawned, w = RAGE.wave;
  const boss = w % 5 === 0 && n === Math.floor(RAGE.total / 2), elite = !boss && w >= 3 && Math.random() < Math.min(0.35, 0.08 + w * 0.03);
  const r = Math.random();
  b.primary = boss ? (Math.random() < 0.5 ? WEAPONS.shotgun : WEAPONS.rifle) : elite ? (r < 0.5 ? WEAPONS.rifle : r < 0.8 ? WEAPONS.sniper : WEAPONS.shotgun)
    : r < 0.4 ? WEAPONS.rifle : r < 0.6 ? WEAPONS.carbine : r < 0.82 ? WEAPONS.smg : r < 0.94 ? WEAPONS.shotgun : WEAPONS.sniper;
  b.secondary = WEAPONS.deagle; b.nades = { he: w >= 4 && Math.random() < 0.3 ? 1 : 0, flash: 0, smoke: 0, molotov: 0 }; botArm(b);
  b.respawnT = Infinity; respawnBot(b); b.respawnT = Infinity;
  b.hp = rageHp(w) * (boss ? 8 : elite ? 2.5 : 1); b.maxHp = b.hp; b.rageKind = boss ? 'boss' : elite ? 'elite' : '';
  setHumanLook(b, boss ? 'boss' : elite ? 'elite' : 'grunt');   // 精英穿黑色特戰服、魔王是高級軍官（大盤帽、金肩章）
  b.name = boss ? '魔王・' + b.baseName : elite ? '精英・' + b.baseName : b.baseName;
  b.state = 'patrol'; b.path = null; b.goalTag = null;
  RAGE.spawned++;
  return true;
}
// 敵人：直接朝你衝（知道你大概在哪）
function rageObjective(b, dt) {
  const pp = player.body.pos;
  if (!b.path || game.t > (b.huntT || 0)) {
    b.huntT = game.t + rand(1.5, 3); b.goalTag = 'hunt';
    const a = Math.random() * 6.283, r = rand(1, 5);
    setPath(b, pp.x + Math.cos(a) * r, pp.z + Math.sin(a) * r, pp.y);
  }
  if (!followPath(b, b.rageKind === 'boss' ? 3.0 : 3.8, _wish)) b.path = null;
  else turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt);
}

// 你殺了一個：聖光、連殺、回血、狂暴
function rageOnKill(b, head) {
  RAGE.kills++; RAGE.left = Math.max(0, RAGE.left - 1);
  RAGE.combo++; RAGE.comboT = RAGE_COMBO_T; RAGE.best = Math.max(RAGE.best, RAGE.combo);
  const p = b.phys.pos, big = b.rageKind === 'boss' ? 3 : b.rageKind === 'elite' ? 1.7 : 1;
  const c = _v1.set(p.x, p.y + 1.1, p.z);
  boomFx(c, 2.6 * big * (RAGE.frenzy > 0 ? 1.4 : 1), RAGE.frenzy > 0 ? '#fff1a8' : '#ffd36a', 0.35);
  spawnSparks(c, _v2.set(0, 1, 0), '#ffe08a', Math.round(26 * big));
  if (head) spawnSparks(_v1.set(p.x, p.y + 1.7, p.z), _v2.set(0, 1, 0), '#ffffff', 14);
  player.hp = Math.min(100, player.hp + (RAGE.frenzy > 0 ? 30 : 15) + (b.rageKind ? 25 : 0));
  rageComboShow();
  if (RAGE.combo === RAGE_FRENZY_AT || (RAGE.combo > RAGE_FRENZY_AT && RAGE.combo % 10 === 0)) {
    RAGE.frenzy = RAGE_FRENZY_T; sfx('ring', 0.9); hudBanner('狂暴！', '傷害 2 倍・受傷減半', 1.6, 'rage');
  }
  if (b.rageKind === 'boss') hudBanner('魔王倒下', `+ 生命 1 條`, 2, 'rage'), RAGE.lives = Math.min(5, RAGE.lives + 1);
  b.name = b.baseName; b.rageKind = '';
}
function rageComboShow() {
  const el = $('rageCombo'); if (RAGE.combo < 2) { el.hidden = true; return; }
  el.hidden = false; el.innerHTML = `<b>${RAGE.combo}</b><small>連殺</small>`;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
// 傷害倍數（給 damageBot / damagePlayer 用）
const rageDmgMul = () => (RAGE.frenzy > 0 ? 2 : 1);
const rageTakenMul = () => (RAGE.frenzy > 0 ? 0.35 : 0.7);   // 平常就少吃 3 成傷害（是來發洩的），狂暴中再減半

function updateRage(dt) {
  if (game.mode !== 'rage' || MODE.over || game.state !== 'play') return;
  MODE.t += dt;
  // 子彈無限、不用換彈
  if (WP && !W.isNade) { W.ammo = WP.mag; W.reserve = WP.reserve; if (W.reloadT > 0) W.reloadT = 0; }
  for (const k of ['primary', 'secondary']) { const it = INV[k]; if (it) { it.ammo = it.def.mag; it.reserve = it.def.reserve; } }
  // 投擲物每 6 秒補一顆（各最多 3 顆）
  RAGE.nadeT += dt; if (RAGE.nadeT > 6) { RAGE.nadeT = 0; for (const k of ['he', 'flash', 'molotov', 'smoke']) INV[k] = Math.min(3, (INV[k] || 0) + (k === 'he' ? 1 : Math.random() < 0.5 ? 1 : 0)); }
  // 停火 2.5 秒沒被打就回血
  if (player.alive) {
    if (player.hurtT > 0) RAGE.regenT = 0; else RAGE.regenT += dt;
    if (RAGE.regenT > 2.5 && player.hp < 100) player.hp = Math.min(100, player.hp + 22 * dt);
  }
  // 連殺、狂暴倒數
  if (RAGE.comboT > 0) { RAGE.comboT -= dt; if (RAGE.comboT <= 0) { RAGE.combo = 0; rageComboShow(); } }
  if (RAGE.frenzy > 0) RAGE.frenzy = Math.max(0, RAGE.frenzy - dt);
  tgl(document.body, 'frenzy', RAGE.frenzy > 0);
  // 陣亡：扣一條命；命沒了就結束
  if (player.deaths > RAGE.deathsSeen) {   // 用陣亡次數算（就算重生後馬上又死也不會漏算）
    RAGE.deathsSeen = player.deaths; RAGE.deadSeen = true; RAGE.lives--; RAGE.combo = 0; rageComboShow(); RAGE.frenzy = 0;
    if (RAGE.lives <= 0) { player.respawnT = Infinity; RAGE.overT = 2.2; $('deadT').textContent = '命用完了'; }
    else { player.respawnT = 2.5; hudTip(`剩 ${RAGE.lives} 條命`, 2); }
  }
  if (player.alive && RAGE.deadSeen) { RAGE.deadSeen = false; rageGear(false); RAGE.regenT = 0; }
  if (RAGE.overT > 0) { RAGE.overT -= dt; if (RAGE.overT <= 0) { endRage(); return; } }
  // 波次
  if (RAGE.wave === RAGE.startWave - 1 || (RAGE.left <= 0 && RAGE.spawned >= RAGE.total)) {
    if (RAGE.breakT <= 0 && RAGE.wave >= RAGE.startWave) { RAGE.breakT = 4; hudTip(`第 ${RAGE.wave} 波清光！喘口氣`, 2.5); sfx('win', 0.6); player.hp = 100; }
    RAGE.breakT -= dt; if (RAGE.breakT <= 0) { rageNextWave(); RAGE.breakT = 0; }
    return;
  }
  const alive = bots.filter((b) => b.active && b.alive && b.team === 'B').length;
  RAGE.spawnCd = (RAGE.spawnCd || 0) - dt;
  if (alive < rageMaxAlive(RAGE.wave) && RAGE.spawned < RAGE.total && RAGE.spawnCd <= 0) { if (rageSpawnOne()) RAGE.spawnCd = 0.35; }
}
function endRage() {
  MODE.over = true; game.state = 'over';
  const M = STATS.modes.rage, prevBest = M.bestWave || 0, counts = RAGE.startWave === 1 && !RAGE.god;   // 從中間繼續或無敵的不算紀錄
  const win = counts && RAGE.wave > prevBest;
  if (!RAGE.god) M.lastWave = RAGE.wave;
  $('overT').textContent = win ? '新紀錄' : '狂暴結束'; $('overT').className = 'win';
  $('overS').textContent = `撐到第 ${RAGE.wave} 波`;
  $('overM').textContent = `殺了 ${RAGE.kills} 個・最高連殺 ${RAGE.best}・爆頭 ${player.heads}`;
  $('overY').textContent = `命中率 ${pct(W.hits, W.shots)}・玩了 ${fmtClock(MODE.t)}`;
  if (counts) { M.bestWave = Math.max(prevBest, RAGE.wave); M.bestKills = Math.max(M.bestKills || 0, RAGE.kills); M.bestCombo = Math.max(M.bestCombo || 0, RAGE.best); }
  statModeEnd('rage', win, null);
  $('overC').textContent = `狂暴紀錄：最高第 ${M.bestWave} 波・一場最多 ${M.bestKills} 殺・最高連殺 ${M.bestCombo}（${M.n} 場）` + (counts ? '' : '　這場從中間繼續或開了無敵，不算紀錄');
  $('bRageCont').hidden = false; $('bRageCont').textContent = `從第 ${RAGE.wave} 波繼續`; $('bAgain').textContent = '從第 1 波重來';
  overXpLine();
  $('over').hidden = false; $('touch').hidden = true; resetTouchState(); closeBuy(); overClean();
  $('rageCombo').hidden = true; tgl(document.body, 'frenzy', false);
  if (pointerLocked()) document.exitPointerLock();
}
function rageHud() {
  $('mtop').hidden = false; $('ptop').hidden = true; $('bBoard').hidden = true; $('spec').hidden = true; $('board').hidden = true;
  $('pipsA').textContent = RAGE.god ? '無敵' : '♥'.repeat(Math.max(0, RAGE.lives)); $('pipsB').textContent = '';
  $('scA').textContent = RAGE.kills; $('scB').textContent = RAGE.wave;
  $('clk').textContent = RAGE.wave ? `剩 ${RAGE.left}` : '準備'; $('clk').className = RAGE.frenzy > 0 ? 'low' : '';
  $('rnd').textContent = RAGE.frenzy > 0 ? `狂暴中 ${RAGE.frenzy.toFixed(1)} 秒` : `第 ${RAGE.wave} 波・連殺 ${RAGE.combo}・最高 ${RAGE.best}`;
}
onTap($('bRage'), openRageOpt);
