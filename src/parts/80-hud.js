/* ===== 80-hud：準星、命中標記、受傷方向、血量彈藥、擊殺訊息、設定面板 ===== */
const xh = $('xh'), hm = $('hm'), vig = $('vig'), dirs = $('dirs');
let hmT = 0, vigT = 0, tipT = 0, gapNow = 8;
function hudHit(kind) {
  hm.className = kind; hmT = kind.includes('kill') ? 0.4 : kind.includes('head') ? 0.2 : 0.12;
  if (kind.includes('kill')) { xh.classList.add('pulse'); requestAnimationFrame(() => requestAnimationFrame(() => xh.classList.remove('pulse'))); }
}
function hudHurt(rel, dmg) {
  vigT = Math.min(0.9, 0.35 + dmg / 60);
  const b = document.createElement('b'); b.style.transform = `rotate(${-rel}rad)`; b.dataset.t = '1.2';
  dirs.appendChild(b); while (dirs.children.length > 4) dirs.firstChild.remove();
}
// 擊殺訊息：kTeam/vTeam 決定顏色（我方青、敵方紅、你自己琥珀），跟你有關的那條加框
function hudFeed(killer, victim, head, kTeam, vTeam, byPlayer, wpn) {
  const cls = (name, team) => name === '你' ? 'you' : team === 'A' ? 'ally' : 'bot';
  const p = document.createElement('p');
  const k = document.createElement('span'); k.className = cls(killer, kTeam); k.textContent = killer;
  const m = document.createElement('span'); m.className = 'hs'; m.textContent = (wpn ? '［' + wpn + '］' : '') + (head ? '◎ 爆頭 ›' : '›');
  const v = document.createElement('span'); v.className = cls(victim, vTeam); v.textContent = victim;
  p.append(k, m, v); p.dataset.t = '5'; if (killer === '你' || victim === '你') p.className = 'mine';
  const f = $('feed'); f.appendChild(p); while (f.children.length > 4) f.firstChild.remove();
}
// 賺錢的小提示（+$300 擊殺）
let cashT = 0;
function hudCash(n, why) {
  const c = $('cash'); c.innerHTML = `${n > 0 ? '+' : ''}$${n}<small>${why || ''}</small>`; c.style.opacity = 1; cashT = 2.2;
  if (n > 0) sfx('cash');
}
// 回合橫幅（第幾回合、勝負）
let bannerT = 0;
function hudBanner(title, sub, sec = 2.5, cls = '') {
  const b = $('banner'); $('bnT').textContent = title; $('bnS').textContent = sub || ''; b.className = cls; b.hidden = false; b.style.opacity = 1; bannerT = sec;
}
function fmtClock(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function pips(el, team) {
  const units = (team === 'A' ? [player] : []).concat(bots.filter((b) => b.active && b.team === team));
  const key = units.map((u) => u.alive ? 1 : 0).join('');
  if (el.dataset.k === key) return; el.dataset.k = key;
  el.innerHTML = units.map((u) => `<i class="${u.alive ? '' : 'dead'}"></i>`).join('');
}
// 計分板：兩隊每個人的擊殺、陣亡、爆頭
function drawBoard() {
  const gear = (u) => u === player ? (INV.primary ? INV.primary.def.short : '手槍') : (u.primary ? u.primary.short : '手槍');
  const row = (u, team) => `<tr class="${team}${u === player ? ' me' : ''}${u.alive ? '' : ' dead'}"><td>${u.name}${u.trait ? `<small class="tr">${TRAITS[u.trait]}</small>` : ''}${isCarrier(u) && team === 'A' ? '<small class="tr bomb">帶炸彈</small>' : ''}</td><td class="n">${u.kills}</td><td class="n">${u.deaths}</td><td class="n">${u.heads || 0}</td><td class="n">${u.alive ? Math.ceil(u.hp) : '—'}</td><td class="n">${team === 'A' ? '$' + (u.money || 0) : ''}</td><td>${team === 'A' && u.alive ? gear(u) : ''}</td></tr>`;
  const A = [player].concat(bots.filter((b) => b.active && b.team === 'A')).sort((a, b) => b.kills - a.kills);
  const B = bots.filter((b) => b.active && b.team === 'B').sort((a, b) => b.kills - a.kills);
  const side = (t) => (t === ROUND.atk ? '攻' : '守');
  const hd = `<th class="n">殺</th><th class="n">死</th><th class="n">爆頭</th><th class="n">血</th>`;
  $('board').innerHTML = `<table><tr><th>我方（${side('A')}）${ROUND.score.A}</th>${hd}<th class="n">錢</th><th>武器</th></tr>${A.map((u) => row(u, 'A')).join('')}
    <tr class="gap"><td colspan="7"></td></tr><tr><th>敵方（${side('B')}）${ROUND.score.B}</th>${hd}<th></th><th></th></tr>${B.map((u) => row(u, 'B')).join('')}</table>`;
}
let boardT = 0;
function hudMatch(dt) {
  if (game.mode === 'duel') { duelHud(); return; }
  if (isMode()) { modeHud(); return; }
  const m = game.mode === 'match';
  $('mtop').hidden = !m; $('ptop').hidden = m; $('bBoard').hidden = !m;
  if (!m) { $('board').hidden = true; $('spec').hidden = true; return; }
  const clk = $('clk');
  if (ROUND.phase === 'freeze') { clk.textContent = fmtClock(ROUND.t); clk.className = 'frz'; }
  else if (BOMB.state === 'planted') { clk.textContent = fmtClock(BOMB.t); clk.className = 'bomb'; }
  else if (ROUND.phase === 'live') { clk.textContent = fmtClock(ROUND.t); clk.className = ROUND.t < 15 ? 'low' : ''; }
  else clk.className = '';
  $('rnd').textContent = ROUND.phase === 'freeze' ? '準備・購買' : BOMB.state === 'planted' ? `炸彈在 ${BOMB.site} 點` : `第 ${ROUND.num} 回合・${ROUND.atk === 'A' ? '攻' : '守'}`;
  $('scA').textContent = ROUND.score.A; $('scB').textContent = ROUND.score.B;
  pips($('pipsA'), 'A'); pips($('pipsB'), 'B');
  const showBoard = $('bBoard').classList.contains('on');   // 回合結束不自動打開（會蓋住回合結果橫幅），要看就按住計分板鍵
  $('board').hidden = !showBoard;
  if (showBoard && (boardT -= dt) <= 0) { boardT = 0.25; drawBoard(); }
  const sp = !player.alive && ROUND.phase !== 'over' ? spectateTarget() : null;
  $('spec').hidden = !sp || killcamActive(); if (sp) $('specN').textContent = sp.name + `（${Math.ceil(sp.hp)}）`;
}
function hudTip(text, sec = 2.5) { const t = $('tip'); t.textContent = text; t.hidden = false; t.style.opacity = 1; tipT = sec; }

let lastHp = -1, lastAmmo = -1, lastK = -1, lastD = -1, lastH = -1;
function hudUpdate(dt) {
  // 準星大小跟著散佈：散佈角度換算成畫面上的像素
  const fov = camera.fov * DEG, half = window.innerHeight / 2;
  const target = Math.max(5, Math.tan(W.spread * DEG) / Math.tan(fov / 2) * half);
  gapNow = lerp(gapNow, target, 1 - Math.exp(-dt * 18));
  sty(xh, '--g', gapNow.toFixed(1) + 'px');
  // 準星跟著後座：畫到子彈真正的落點（畫面只轉了 45% 的後座）
  if (S.followRecoil) {
    const k = half / Math.tan(fov / 2);
    const dp = (W.rp * (1 - VIEW_TRACK) - W.vp - player.punchP) * DEG, dy = (W.ry * (1 - VIEW_TRACK) - player.punchY) * DEG;
    sty(xh, 'transform', `translate(${(-Math.tan(dy) * k).toFixed(1)}px, ${(-Math.tan(dp) * k).toFixed(1)}px)`);
  } else sty(xh, 'transform', '');
  tgl(xh, 'ads', player.adsT > 0.6);
  tgl(xh, 'lock', AIM.onTarget);
  hid(xh, !player.alive);
  if (hmT > 0) { hmT -= dt; sty(hm, 'opacity', String(Math.min(1, hmT * 6))); } else sty(hm, 'opacity', '0');
  if (vigT > 0) { vigT -= dt; sty(vig, 'opacity', Math.max(0, vigT).toFixed(2)); } else sty(vig, 'opacity', player.alive && player.hp < 30 ? (0.35 + Math.sin(performance.now() / 300) * 0.1).toFixed(2) : '0');
  if (dirs.childElementCount) for (const b of [...dirs.children]) { const t = +b.dataset.t - dt; b.dataset.t = t; b.style.opacity = Math.min(1, t); if (t <= 0) b.remove(); }
  const feedE = $('feed'); if (feedE.childElementCount) for (const p of [...feedE.children]) { const t = +p.dataset.t - dt; p.dataset.t = t; if (t < 0.5) p.style.opacity = Math.max(0, t * 2); if (t <= 0) p.remove(); }
  if (tipT > 0) { tipT -= dt; if (tipT < 0.5) $('tip').style.opacity = Math.max(0, tipT * 2); if (tipT <= 0) $('tip').hidden = true; }
  const hp = Math.ceil(player.hp);
  const specOn = !!game.specBot, deadNow = !player.alive && game.state === 'play'; hid($('hp'), specOn); hid($('ammo'), specOn || deadNow);
  tgl(document.body, 'specOn', deadNow && game.mode !== 'tutorial');
  const ar = INV.vest ? Math.ceil(INV.armor || 0) : 0, arE = $('ar');
  if (ar !== +arE.dataset.v || arE.classList.contains('helm') !== !!INV.helmet) { arE.dataset.v = ar; arE.hidden = !ar; $('arN').textContent = ar; arE.classList.toggle('helm', !!INV.helmet); }
  if (hp !== lastHp) { lastHp = hp; $('hpN').textContent = hp; $('hpI').style.width = hp + '%'; $('hp').classList.toggle('low', hp < 30); }
  if (W.isNade) { if (lastAmmo !== -2) { lastAmmo = -2; $('ammoN').textContent = INV[INV.nade]; $('ammoR').textContent = ''; $('ammo').classList.remove('low'); } }
  else if (W.ammo * 1000 + W.reserve !== lastAmmo) { lastAmmo = W.ammo * 1000 + W.reserve; $('ammoN').textContent = W.ammo; $('ammoR').textContent = '/ ' + W.reserve; $('ammo').classList.toggle('low', W.ammo <= 6); }
  drawRadar(dt); hudMatch(dt);
  if (bannerT > 0) { bannerT -= dt; if (bannerT < 0.4) $('banner').style.opacity = Math.max(0, bannerT / 0.4); if (bannerT <= 0) $('banner').hidden = true; }
  if (player.kills !== lastK) { lastK = player.kills; $('sK').textContent = player.kills; }
  if (player.deaths !== lastD) { lastD = player.deaths; $('sD').textContent = player.deaths; }
  if (player.heads !== lastH) { lastH = player.heads; $('sH').textContent = player.heads; }
  hid($('rl'), !(W.reloadT > 0));
  if (W.reloadT > 0) $('rlB').style.width = ((1 - W.reloadT / WP.reload) * 100).toFixed(0) + '%';
  hudGear(dt);
  tgl($('bAds'), 'on', player.ads);
  tgl($('bCrouch'), 'on', player.crouch);
  tgl($('bAuto'), 'on', S.autoFire);
}
// 裝備、金錢、裝彈拆彈、狙擊鏡、閃光、煙
let lastGear = '';
function hudGear(dt) {
  const m = game.mode === 'match';
  hid($('money'), !m || !!game.specBot);
  if (m) { const mt = '$ ' + (player.money || 0); if (hv($('moneyN'), 't', mt)) $('moneyN').textContent = mt; hid($('bombIco'), !INV.bomb || !player.alive); hid($('kitIco'), !INV.kit || !player.alive); }
  if (cashT > 0) { cashT -= dt; if (cashT < 0.5) $('cash').style.opacity = Math.max(0, cashT * 2); }
  const nm = W.isNade ? NADES[INV.nade].name : WP.name;
  const nh = NADE_ORDER.filter((k) => INV[k] > 0).map((k) => NADES[k].short[0] + INV[k]).join(' ');
  const key = nm + '|' + nh;
  if (key !== lastGear) { lastGear = key; $('wName').textContent = nm; $('nadeH').textContent = nh; }
  // 裝彈／拆彈：按鈕和進度條
  const act = useAction();
  const ub = $('bUse'); hid(ub, !act); if (act) { const ut = act === 'plant' ? '按住裝彈' : act === 'pickup' ? '撿起' + pickableDrop().def.short : '按住拆彈'; if (hv(ub, 't', ut)) ub.textContent = ut; tgl(ub, 'down', INPUT.use); }
  const pr = useProgress(); let ubox = pr > 0;
  if (pr > 0) { $('useT').textContent = (act === 'plant' ? '裝彈中' : '拆彈中') + '…'; $('useB').style.width = (pr * 100).toFixed(0) + '%'; }
  else if (act && !isTouch && player.alive) { ubox = true; $('useT').textContent = act === 'plant' ? '按住 E 裝彈' : '按住 E 拆彈'; $('useB').style.width = '0%'; }
  hid($('useBox'), !ubox);
  hid($('bBuy'), !buyOpen() || !$('buy').hidden);
  if (!$('buy').hidden) buyHead();
  hid($('bRadio'), !(m && player.alive && game.state === 'play') || !$('radio').hidden);
  tgl($('bNade'), 'on', W.isNade); sty($('bNade'), 'opacity', NADE_ORDER.some((k) => INV[k] > 0) ? '' : '.4');
  hid($('scope'), !(WP.scope && !W.isNade && player.alive && player.adsT > 0.85));
  const fl = player.flashT > 0 ? clamp(player.flashT / 1.2, 0, 1) : 0; sty($('flashOv'), 'opacity', fl.toFixed(2));
  sty($('smokeOv'), 'opacity', (smokeAtCamera() * 0.85).toFixed(2));
}
function showDead(by, head) {
  $('deadBy').textContent = '被「' + by + '」' + (head ? '爆頭' : '擊倒');
  const t = player.taken[by] || { dmg: 0, hits: 0 };
  $('deadRep').textContent = '這條命你造成 ' + Math.round(player.dealt) + ' 傷害（' + player.dealtHits + ' 發）· 受到「' + by + '」' + Math.round(t.dmg) + ' 傷害（' + t.hits + ' 發）';
  $('dead').hidden = false;
}

// ---------- 設定面板 ----------
function syncSettingsUI() {
  $('sSens').value = S.sens; $('oSens').textContent = (+S.sens).toFixed(2);
  $('sAds').value = S.adsSens; $('oAds').textContent = (+S.adsSens).toFixed(2);
  $('sGyro').value = S.gyroSens; $('oGyro').textContent = (+S.gyroSens).toFixed(2); for (const el of $('gyroRow').children) el.classList.toggle('dim', S.gyro === 'off');
  $('oLayout').textContent = S.layout && Object.keys(S.layout).length ? `已自訂 ${Object.keys(S.layout).length} 顆` : '預設';
  for (const seg of document.querySelectorAll('.seg')) {
    const k = seg.dataset.k, v = S[k];
    for (const b of seg.children) {
      const bv = b.dataset.v, on = typeof v === 'boolean' ? (bv === '1') === v : bv === v;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  $('fps').hidden = !S.showFps;
}
$('sSens').addEventListener('input', (e) => { S.sens = +e.target.value; saveSettings(); syncSettingsUI(); });
$('sAds').addEventListener('input', (e) => { S.adsSens = +e.target.value; saveSettings(); syncSettingsUI(); });
$('sGyro').addEventListener('input', (e) => { S.gyroSens = +e.target.value; saveSettings(); syncSettingsUI(); });
for (const seg of document.querySelectorAll('.seg')) {
  for (const btn of seg.children) onTap(btn, () => pickSeg(seg, btn));
}
function pickSeg(seg, b) {
  {
    const k = seg.dataset.k, cur = S[k];
    S[k] = typeof cur === 'boolean' ? b.dataset.v === '1' : b.dataset.v;
    saveSettings(); syncSettingsUI();
    if (k === 'quality') applySize();
    if (k === 'lefty' || k === 'btnScale') applyHand();
    if (k === 'joyMode' || k === 'runLock') { INPUT.runLock = false; setJoyIdle(); }
    if (k === 'gyro' && S.gyro !== 'off') askGyro();
    if (k === 'palette') applyPalette();
  }
}

// ---------- 雷達：以你為中心、跟著你轉；敵人在你看得到或剛開槍的 1.5 秒內才出現紅點 ----------
const radar = $('radar'), rctx = radar.getContext('2d');
const RADAR_R = 30;   // 雷達半徑代表幾公尺
let radarBase = null, radarT = 0;
function radarMap() {
  // 先把地圖俯視圖畫好一次（1 公尺 = 4 像素）
  const cv = document.createElement('canvas'); cv.width = 74 * 4; cv.height = 54 * 4; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(160,170,180,.18)'; c.fillRect(0, 0, cv.width, cv.height);
  for (let i = 1; i < BOXES.length; i++) {
    const b = BOXES[i]; c.fillStyle = b.max[1] > 1.5 ? 'rgba(230,220,200,.75)' : 'rgba(200,190,170,.45)';
    c.fillRect((b.min[0] + 37) * 4, (27 - b.max[2]) * 4, (b.max[0] - b.min[0]) * 4, (b.max[2] - b.min[2]) * 4);
  }
  // 包點：黃色框＋字
  c.strokeStyle = 'rgba(255,196,60,.8)'; c.lineWidth = 3; c.fillStyle = 'rgba(255,196,60,.9)'; c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const s of Object.values(SITES)) { c.strokeRect((s.x0 + 37) * 4, (27 - s.z1) * 4, (s.x1 - s.x0) * 4, (s.z1 - s.z0) * 4); c.fillText(s.id, (s.cx + 37) * 4, (27 - s.cz) * 4); }
  return cv;
}
function drawRadar(dt) {
  radarT -= dt; if (radarT > 0) return; radarT = 1 / 15;
  if (!radarBase) radarBase = radarMap();
  const W2 = radar.width, s = W2 / 2 / RADAR_R, p = camera.position;
  rctx.clearRect(0, 0, W2, W2); rctx.save();
  rctx.beginPath(); rctx.arc(W2 / 2, W2 / 2, W2 / 2 - 1, 0, Math.PI * 2); rctx.clip();
  const th = Math.PI - camera.rotation.y;   // 讓面對的方向朝上
  rctx.translate(W2 / 2, W2 / 2); rctx.rotate(th); rctx.scale(s / 4, s / 4);
  rctx.drawImage(radarBase, -(p.x + 37) * 4, -(27 - p.z) * 4);
  rctx.restore();
  // 隊友藍點（一直看得到）、敵人紅點（被我方任何人看到、或剛開槍 1.5 秒內）
  _v1.copy(camera.position);
  for (const b of bots) {
    if (!b.active || !b.alive) continue;
    const ally = b.team === 'A';
    const seen = ally || b.spottedT > 0 || game.t - (b.firedAt || -9) < 1.5 || (player.alive && lineClear(_v1, _v2.set(b.phys.pos.x, b.phys.pos.y + 1.5, b.phys.pos.z)));
    if (!seen) continue;
    const dx = b.phys.pos.x - p.x, my = -(b.phys.pos.z - p.z), c = Math.cos(th), sn = Math.sin(th);
    const rx = (dx * c - my * sn) * s, ry = (dx * sn + my * c) * s, d = Math.hypot(rx, ry), lim = W2 / 2 - 6;
    const kx = d > lim ? rx / d * lim : rx, ky = d > lim ? ry / d * lim : ry;
    rctx.fillStyle = ally ? pal().radarA : pal().radarE; rctx.beginPath(); rctx.arc(W2 / 2 + kx, W2 / 2 + ky, ally ? 4.5 : 5, 0, Math.PI * 2); rctx.fill();
    if (ally && isCarrier(b)) { rctx.strokeStyle = '#ff9a3d'; rctx.lineWidth = 2.5; rctx.stroke(); }
  }
  // 炸彈：掉在地上（攻方看得到）、裝好了（大家都看得到）
  if (game.mode === 'match' && (BOMB.state === 'planted' || (BOMB.state === 'dropped' && ROUND.atk === player.team))) {
    const dx = BOMB.pos.x - p.x, my = -(BOMB.pos.z - p.z), c = Math.cos(th), sn = Math.sin(th);
    let rx = (dx * c - my * sn) * s, ry = (dx * sn + my * c) * s; const d = Math.hypot(rx, ry), lim = W2 / 2 - 6; if (d > lim) { rx = rx / d * lim; ry = ry / d * lim; }
    rctx.fillStyle = BOMB.state === 'planted' && (game.t * 3 % 1) < 0.5 ? '#ff3020' : '#ff9a3d'; rctx.fillRect(W2 / 2 + rx - 5, W2 / 2 + ry - 4, 10, 8);
  }
  // 視野扇形與北方標記
  rctx.fillStyle = 'rgba(255,179,71,.14)'; rctx.beginPath(); rctx.moveTo(W2 / 2, W2 / 2);
  rctx.arc(W2 / 2, W2 / 2, W2 / 2 - 2, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); rctx.closePath(); rctx.fill();
  const nx = W2 / 2 + Math.sin(-th + Math.PI) * (W2 / 2 - 10), ny = W2 / 2 + Math.cos(-th + Math.PI) * (W2 / 2 - 10);
  rctx.fillStyle = '#f3ece0'; rctx.font = 'bold 15px system-ui, sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle'; rctx.fillText('N', nx, ny);
  // 自己：朝上的三角形
  rctx.fillStyle = '#ffb347'; rctx.beginPath(); rctx.moveTo(W2 / 2, W2 / 2 - 8); rctx.lineTo(W2 / 2 - 6, W2 / 2 + 6); rctx.lineTo(W2 / 2 + 6, W2 / 2 + 6); rctx.closePath(); rctx.fill();
}
// 結算畫面出來時：收掉陣亡卡、擊殺鏡頭、暫停鍵和購買鍵（不然會蓋在結算卡上、按了也沒反應）
function overClean() { tgl(document.body, 'specOn', false); $('dead').hidden = true; KC.on = false; $('kc').hidden = true; $('bPause').hidden = true; hid($('bBuy'), true); hid($('bRadio'), true); }
