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
function hudFeed(killer, victim, head, you) {
  const p = document.createElement('p');
  const k = document.createElement('span'); k.className = you ? 'you' : 'bot'; k.textContent = killer;
  const m = document.createElement('span'); m.className = 'hs'; m.textContent = head ? '◎ 爆頭 ›' : '›';
  const v = document.createElement('span'); v.className = you ? 'bot' : 'you'; v.textContent = victim;
  p.append(k, m, v); p.dataset.t = '5'; p.className = 'mine';
  const f = $('feed'); f.appendChild(p); while (f.children.length > 4) f.firstChild.remove();
}
function hudTip(text, sec = 2.5) { const t = $('tip'); t.textContent = text; t.hidden = false; t.style.opacity = 1; tipT = sec; }

let lastHp = -1, lastAmmo = -1, lastK = -1, lastD = -1, lastH = -1;
function hudUpdate(dt) {
  // 準星大小跟著散佈：散佈角度換算成畫面上的像素
  const fov = camera.fov * DEG, half = window.innerHeight / 2;
  const target = Math.max(5, Math.tan(W.spread * DEG) / Math.tan(fov / 2) * half);
  gapNow = lerp(gapNow, target, 1 - Math.exp(-dt * 18));
  xh.style.setProperty('--g', gapNow.toFixed(1) + 'px');
  // 準星跟著後座：畫到子彈真正的落點（畫面只轉了 45% 的後座）
  if (S.followRecoil) {
    const k = half / Math.tan(fov / 2);
    const dp = (W.rp * (1 - VIEW_TRACK) - W.vp - player.punchP) * DEG, dy = (W.ry * (1 - VIEW_TRACK) - player.punchY) * DEG;
    xh.style.transform = `translate(${(-Math.tan(dy) * k).toFixed(1)}px, ${(-Math.tan(dp) * k).toFixed(1)}px)`;
  } else xh.style.transform = '';
  xh.classList.toggle('ads', player.adsT > 0.6);
  xh.classList.toggle('lock', !!AIM.onTarget);
  xh.hidden = !player.alive;
  if (hmT > 0) { hmT -= dt; hm.style.opacity = Math.min(1, hmT * 6); } else hm.style.opacity = 0;
  if (vigT > 0) { vigT -= dt; vig.style.opacity = Math.max(0, vigT); } else vig.style.opacity = player.alive && player.hp < 30 ? 0.35 + Math.sin(performance.now() / 300) * 0.1 : 0;
  for (const b of [...dirs.children]) { const t = +b.dataset.t - dt; b.dataset.t = t; b.style.opacity = Math.min(1, t); if (t <= 0) b.remove(); }
  for (const p of [...$('feed').children]) { const t = +p.dataset.t - dt; p.dataset.t = t; if (t < 0.5) p.style.opacity = Math.max(0, t * 2); if (t <= 0) p.remove(); }
  if (tipT > 0) { tipT -= dt; if (tipT < 0.5) $('tip').style.opacity = Math.max(0, tipT * 2); if (tipT <= 0) $('tip').hidden = true; }
  const hp = Math.ceil(player.hp);
  if (hp !== lastHp) { lastHp = hp; $('hpN').textContent = hp; $('hpI').style.width = hp + '%'; $('hp').classList.toggle('low', hp < 30); }
  if (W.ammo * 1000 + W.reserve !== lastAmmo) { lastAmmo = W.ammo * 1000 + W.reserve; $('ammoN').textContent = W.ammo; $('ammoR').textContent = '/ ' + W.reserve; $('ammo').classList.toggle('low', W.ammo <= 6); }
  drawRadar(dt);
  if (player.kills !== lastK) { lastK = player.kills; $('sK').textContent = player.kills; }
  if (player.deaths !== lastD) { lastD = player.deaths; $('sD').textContent = player.deaths; }
  if (player.heads !== lastH) { lastH = player.heads; $('sH').textContent = player.heads; }
  $('rl').hidden = !(W.reloadT > 0);
  if (W.reloadT > 0) $('rlB').style.width = ((1 - W.reloadT / RIFLE.reload) * 100).toFixed(0) + '%';
  $('bAds').classList.toggle('on', player.ads);
  $('bCrouch').classList.toggle('on', player.crouch);
  $('bAuto').classList.toggle('on', !!S.autoFire);
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
for (const seg of document.querySelectorAll('.seg')) {
  for (const btn of seg.children) onTap(btn, () => pickSeg(seg, btn));
}
function pickSeg(seg, b) {
  {
    const k = seg.dataset.k, cur = S[k];
    S[k] = typeof cur === 'boolean' ? b.dataset.v === '1' : b.dataset.v;
    saveSettings(); syncSettingsUI();
    if (k === 'quality') applySize();
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
  return cv;
}
function drawRadar(dt) {
  radarT -= dt; if (radarT > 0) return; radarT = 1 / 15;
  if (!radarBase) radarBase = radarMap();
  const W2 = radar.width, s = W2 / 2 / RADAR_R, p = player.body.pos;
  rctx.clearRect(0, 0, W2, W2); rctx.save();
  rctx.beginPath(); rctx.arc(W2 / 2, W2 / 2, W2 / 2 - 1, 0, Math.PI * 2); rctx.clip();
  const th = Math.PI - player.yaw;   // 讓你面對的方向朝上
  rctx.translate(W2 / 2, W2 / 2); rctx.rotate(th); rctx.scale(s / 4, s / 4);
  rctx.drawImage(radarBase, -(p.x + 37) * 4, -(27 - p.z) * 4);
  rctx.restore();
  // 敵人紅點
  eyePos(_v1);
  for (const b of bots) {
    if (!b.alive) continue;
    const seen = game.t - (b.firedAt || -9) < 1.5 || lineClear(_v1, _v2.set(b.phys.pos.x, b.phys.pos.y + 1.5, b.phys.pos.z));
    if (!seen) continue;
    const dx = b.phys.pos.x - p.x, my = -(b.phys.pos.z - p.z), c = Math.cos(th), sn = Math.sin(th);
    const rx = (dx * c - my * sn) * s, ry = (dx * sn + my * c) * s, d = Math.hypot(rx, ry), lim = W2 / 2 - 6;
    const kx = d > lim ? rx / d * lim : rx, ky = d > lim ? ry / d * lim : ry;
    rctx.fillStyle = '#ff4a3d'; rctx.beginPath(); rctx.arc(W2 / 2 + kx, W2 / 2 + ky, 5, 0, Math.PI * 2); rctx.fill();
  }
  // 視野扇形與北方標記
  rctx.fillStyle = 'rgba(255,179,71,.14)'; rctx.beginPath(); rctx.moveTo(W2 / 2, W2 / 2);
  rctx.arc(W2 / 2, W2 / 2, W2 / 2 - 2, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); rctx.closePath(); rctx.fill();
  const nx = W2 / 2 + Math.sin(-th + Math.PI) * (W2 / 2 - 10), ny = W2 / 2 + Math.cos(-th + Math.PI) * (W2 / 2 - 10);
  rctx.fillStyle = '#f3ece0'; rctx.font = 'bold 15px system-ui, sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle'; rctx.fillText('N', nx, ny);
  // 自己：朝上的三角形
  rctx.fillStyle = '#ffb347'; rctx.beginPath(); rctx.moveTo(W2 / 2, W2 / 2 - 8); rctx.lineTo(W2 / 2 - 6, W2 / 2 + 6); rctx.lineTo(W2 / 2 + 6, W2 / 2 + 6); rctx.closePath(); rctx.fill();
}
