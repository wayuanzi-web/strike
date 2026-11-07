/* ===== 80-hud：準星、命中標記、受傷方向、血量彈藥、擊殺訊息、設定面板 ===== */
const xh = $('xh'), hm = $('hm'), vig = $('vig'), dirs = $('dirs');
let hmT = 0, vigT = 0, tipT = 0, gapNow = 8;
function hudHit(kind) {
  hm.className = kind; hmT = kind.includes('kill') ? 0.4 : 0.22;
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
  p.append(k, m, v); p.dataset.t = '4';
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
  if (W.ammo !== lastAmmo) { lastAmmo = W.ammo; $('ammoN').textContent = W.ammo; $('ammo').classList.toggle('low', W.ammo <= 6); }
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
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = seg.dataset.k, cur = S[k];
    S[k] = typeof cur === 'boolean' ? b.dataset.v === '1' : b.dataset.v;
    saveSettings(); syncSettingsUI();
    if (k === 'quality') applySize();
  });
}
