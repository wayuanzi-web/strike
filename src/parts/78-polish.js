/* ===== 78-polish：美術與打擊感——室內外殘響、聲音的畫面提示與字幕、色盲友善配色、命中回饋 */

// ---------- 殘響：腳步、槍聲、爆炸都會送一份到殘響；頭上有屋頂（室內、樓下、天橋下）殘響比較重 ----------
const REV = { send: null, conv: null, wet: 0.1, target: 0.1, indoor: 0, t: 0 };
function ensureReverb() {
  if (!AC || REV.send) return;
  try {
    const len = Math.floor(AC.sampleRate * 1.5), ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < len; i++) { const t = i / len; a[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.6) * (i < 600 ? i / 600 : 1); } }
    REV.conv = AC.createConvolver(); REV.conv.buffer = ir;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    REV.send = AC.createGain(); REV.send.gain.value = REV.wet;
    REV.send.connect(REV.conv); REV.conv.connect(lp); lp.connect(master);
  } catch (e) { REV.send = null; }
}
// 頭上（正上與四個斜上）10 公尺內有東西擋 → 算室內
function indoorAmount(x, y, z) {
  let hit = 0; const dirs = [[0, 1, 0], [0.5, 0.85, 0], [-0.5, 0.85, 0], [0, 0.85, 0.5], [0, 0.85, -0.5]];
  for (const d of dirs) if (bakeRay(x, y, z, d[0], d[1], d[2], 10) >= 0) hit++;
  return hit / dirs.length;
}
function updateReverb(dt) {
  if (!AC) return;
  ensureReverb(); if (!REV.send) return;
  if ((REV.t -= dt) <= 0) { REV.t = 0.4; const c = camera.position; REV.indoor = indoorAmount(c.x, c.y, c.z); REV.target = lerp(0.1, 0.5, REV.indoor); }
  REV.wet = lerp(REV.wet, REV.target, 1 - Math.exp(-3 * dt));
  REV.send.gain.setTargetAtTime(REV.wet, AC.currentTime, 0.1);
}

// ---------- 聲音的畫面提示（沒開聲音也知道）：準星周圍的方向弧＋下方字幕 ----------
const CUE = { last: {}, arcs: [] };
function dirWord(pos) {
  // rel：要轉多少才面對它（正＝往左轉，跟受傷方向指示一樣的算法）；畫面上的右邊是 rel < 0
  const pp = player.body.pos, rel = angDiff(player.yaw, Math.atan2(-(pos.x - pp.x), -(pos.z - pp.z))), a = Math.abs(rel);
  const fb = a < 0.6 ? '前方' : a > 2.5 ? '後方' : '', lr = a < 0.35 || a > 2.8 ? '' : rel < 0 ? '右' : '左';
  return { rel, word: (lr + fb) || (rel < 0 ? '右方' : '左方') };
}
function soundCue(kind, pos, extra = '') {
  if (game.state !== 'play') return;
  const pp = player.body.pos, d = pos ? Math.hypot(pos.x - pp.x, pos.z - pp.z) : 0;
  if (kind === 'step' && d > 22) return;
  if (kind === 'shot' && d > 60) return;
  const now = game.t, key = kind + (pos ? Math.round(dirWord(pos).rel * 2) : '');
  // 方向弧：腳步、槍聲
  if (S.soundViz && pos && (kind === 'step' || kind === 'shot')) {
    const { rel } = dirWord(pos);
    CUE.arcs.push({ rel, t: 0.9, k: kind, near: d < 10 });
  }
  if (!S.captions || now - (CUE.last[key] || -9) < (kind === 'beep' ? 4 : 1.6)) return;
  CUE.last[key] = now;
  let text = '';
  if (kind === 'step') { const { word } = dirWord(pos); text = `［腳步聲］${word}${d < 8 ? '・很近' : ''}`; }
  else if (kind === 'shot') { const { word } = dirWord(pos); text = `［槍聲］${word}${d > 35 ? '・遠' : ''}`; }
  else if (kind === 'beep') text = `［炸彈嗶嗶聲］${extra}`;
  else if (kind === 'plant') text = `［炸彈裝好了］${extra}`;
  else if (kind === 'defuse') text = '［有人在拆彈］';
  else if (kind === 'nade') { const { word } = dirWord(pos); text = `［投擲物落地］${word}`; }
  if (text) caption(text);
}
function caption(text) {
  const box = $('cap'), p = document.createElement('p'); p.textContent = text; p.dataset.t = '2.6'; box.appendChild(p);
  while (box.children.length > 3) box.firstChild.remove();
}
function updateCues(dt) {
  const box = $('cap');
  for (const p of [...box.children]) { const t = +p.dataset.t - dt; p.dataset.t = t; p.style.opacity = Math.min(1, t * 2); if (t <= 0) p.remove(); }
  const el = $('sv'); if (!S.soundViz || game.state !== 'play') { if (el.childElementCount) el.innerHTML = ''; CUE.arcs.length = 0; return; }
  for (const a of CUE.arcs) a.t -= dt;
  CUE.arcs = CUE.arcs.filter((a) => a.t > 0).slice(-8);
  while (el.childElementCount < CUE.arcs.length) el.appendChild(document.createElement('i'));
  while (el.childElementCount > CUE.arcs.length) el.lastChild.remove();
  CUE.arcs.forEach((a, i) => { const e = el.children[i]; e.className = a.k + (a.near ? ' near' : ''); e.style.transform = `rotate(${-a.rel}rad)`; e.style.opacity = Math.min(1, a.t * 2); });
}

// ---------- 配色：預設（青／橘）、色盲友善（藍／黃）、高對比（白／洋紅） ----------
const PALETTES = {
  default: { ally: '#7fe9f0', enemy: '#ff8f80', radarA: '#5fd8ee', radarE: '#ff4a3d', tracerE: '#ff9a6a', tracerA: '#9fe6ff', rimE: [1.0, 0.75, 0.5], rimA: null },
  cb: { ally: '#5aa8ff', enemy: '#ffd23a', radarA: '#4a9cff', radarE: '#ffcc22', tracerE: '#ffe070', tracerA: '#8cc4ff', rimE: [1.6, 1.35, 0.2], rimA: [0.35, 0.6, 1.4] },
  hc: { ally: '#ffffff', enemy: '#ff3df0', radarA: '#ffffff', radarE: '#ff3df0', tracerE: '#ff70f4', tracerA: '#ffffff', rimE: [2.2, 0.4, 2.0], rimA: [1.2, 1.2, 1.2] },
};
const pal = () => PALETTES[S.palette] || PALETTES.default;
function applyPalette() {
  const P = pal(), r = document.documentElement.style;
  r.setProperty('--ally', P.ally); r.setProperty('--enemy', P.enemy);
  for (const b of bots) if (b.mat && b.mat.userData.rimU) {
    if (b.baseTeam === 'B') b.mat.userData.rimU.value.setRGB(...P.rimE);
    else if (P.rimA) b.mat.userData.rimU.value.setRGB(...P.rimA);
  }
  if (!P.rimA) applyCosmetics();   // 預設配色：隊友的光用成長畫面選的外框色
}

// ---------- 命中回饋：每一發打中準星都會跳一下；打到頭盔沒死「叮」一聲；爆頭擊殺多一層音效和白色碎片 ----------
function hitFeedback(kind, b, head, helmet) {
  xh.classList.remove('tick'); void xh.offsetWidth; xh.classList.add('tick');
  if (kind === 'hit' && head && helmet) { sfx('dink'); }
  if (kind === 'kill' && head && b) {
    const p = b.phys.pos, h = _v2.set(p.x, p.y + b.phys.h - 0.15, p.z);
    spawnSparks(h, _v3.set(0, 1, 0), '#ffffff', 10); spawnPuff(h, '#c8c2b8', 0.6, 0.45, 0.4);
    sfx('headkill');
  }
}
applyPalette();
