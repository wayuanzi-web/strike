/* ===== 70-input：觸控（主要）與鍵盤滑鼠（測試用備用） =====
   左半邊：手指按哪裡，搖桿就出現在哪裡（按下的位置就是中立點）。右半邊：拖曳轉視角。
   開火鍵、跳、蹲按下後拖曳也能轉視角（跟主流手機射擊遊戲一樣）。 */
const INPUT = {
  mx: 0, mz: 0, lookDX: 0, lookDY: 0, fire: false, jumpT: 0, crouch: false, mode: isTouch ? 'touch' : 'kb',
  looking: false, fingerMoveT: 0, adsQueued: false, use: false,
};
Object.defineProperty(INPUT, 'jump', { get() { return INPUT.jumpT > 0; }, set(v) { INPUT.jumpT = v ? 0.12 : 0; } });   // 跳有 0.12 秒緩衝
const touchEl = $('touch'), joyEl = $('joy'), joyK = $('joyK');
const T = { joyId: null, ox: 0, oy: 0, jx: 0, jy: 0, fireId: null, fx: 0, fy: 0, lookers: new Map(), lookId: null };
const joyR = () => Math.max(40, window.innerHeight * 0.13);
// 每像素轉幾度：靈敏度 1.0 時，手指橫掃整個螢幕寬度轉 180 度（平板用高度換算，手指每公分轉的角度接近）
const degPerPx = () => 180 / Math.max(320, Math.min(window.innerWidth, window.innerHeight * 2.2)) * S.sens;
const VERT_K = 0.8;   // 上下拖比左右慢一點，手機上下距離短，容易拉過頭

// 左手模式：搖桿在右半邊、轉視角在左半邊，按鈕左右對調
const inJoyZone = (x) => (S.lefty ? x > window.innerWidth * 0.55 : x < window.innerWidth * 0.45);
function applyHand() {
  document.documentElement.style.setProperty('--bs', S.btnScale || 1); document.body.classList.toggle('lefty', !!S.lefty);
  for (const el of touchEl.querySelectorAll('.tb')) {
    el.style.left = ''; el.style.right = '';
    if (S.lefty) { const r = getComputedStyle(el).right; el.style.right = 'auto'; el.style.left = r; }
  }
  if (T.joyId === null) setJoyIdle();
}
function placeJoyBase() {
  // 底座畫在哪裡：不要被擠出畫面（中立點還是手指按下的位置）
  const r = joyR();
  joyEl.style.left = (S.lefty ? clamp(T.jx, window.innerWidth * 0.55, window.innerWidth - r - 6) : clamp(T.jx, r + 6, window.innerWidth * 0.45)) + 'px';
  joyEl.style.top = clamp(T.jy, r + 6, window.innerHeight - r - 6) + 'px';
}
function setJoyIdle() {
  joyEl.style.left = (window.innerWidth * (S.lefty ? 0.84 : 0.16)) + 'px'; joyEl.style.top = (window.innerHeight * 0.68) + 'px';
  joyK.style.transform = ''; joyEl.className = 'idle';
}
// 暫停、陣亡、重生、轉向時把所有按住的狀態清乾淨
function resetTouchState() {
  T.joyId = null; T.fireId = null; T.lookers.clear(); T.lookId = null;
  INPUT.mx = INPUT.mz = 0; INPUT.fire = false; INPUT.use = false; INPUT.looking = false; INPUT.lookDX = INPUT.lookDY = 0; INPUT.fingerMoveT = 0;
  $('bFire').classList.remove('down'); setJoyIdle();
}
function updateLooking() { INPUT.looking = T.lookers.size > 0 || T.fireId !== null; }
touchEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;         // 滑鼠交給下面的鍵鼠操作
  if (e.target !== touchEl) return;              // 按鈕自己處理
  e.preventDefault(); audioInit(); INPUT.mode = 'touch';
  const x = e.clientX, y = e.clientY;
  if (inJoyZone(x) && T.joyId === null) {
    T.joyId = e.pointerId; T.ox = T.jx = x; T.oy = T.jy = y;
    placeJoyBase(); joyEl.className = 'on'; moveJoy(x, y);
  } else if (!inJoyZone(x)) {
    if (!player.alive && game.mode === 'match') nextSpectate();
    T.lookers.set(e.pointerId, { x, y }); if (T.lookId === null) T.lookId = e.pointerId; updateLooking();
  }
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) { /* 有些瀏覽器不支援，照樣能用 */ }
});
function moveJoy(x, y) {
  const r = joyR(); let dx = x - T.ox, dy = y - T.oy; const d = Math.hypot(dx, dy);
  // 手指拉超過底座：中立點跟著手指走（反方向拉回來比較快）
  if (d > r) { const ex = d - r; T.ox += dx / d * ex; T.oy += dy / d * ex; T.jx = T.ox; T.jy = T.oy; placeJoyBase(); dx = x - T.ox; dy = y - T.oy; }
  const dd = Math.hypot(dx, dy), k = Math.min(1, dd / r);
  const kx = dd > 0 ? dx / dd * k * r : 0, ky = dd > 0 ? dy / dd * k * r : 0;
  // 搖桿頭畫在「底座實際畫的位置」＋偏移
  const bx = parseFloat(joyEl.style.left) - T.ox, by = parseFloat(joyEl.style.top) - T.oy;
  joyK.style.transform = `translate(${kx - bx}px, ${ky - by}px)`;
  const dead = 0.08, mag = k < dead ? 0 : (k - dead) / (1 - dead);
  INPUT.mx = dd > 0 ? dx / dd * mag : 0; INPUT.mz = dd > 0 ? -dy / dd * mag : 0;
  joyEl.classList.toggle('run', mag > 0.92);
}
touchEl.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  if (e.pointerId === T.joyId) { moveJoy(e.clientX, e.clientY); return; }
  const l = T.lookers.get(e.pointerId); if (!l) return;
  // 好幾根手指都在右半邊時，只有最先按的那根在轉；它放開後下一根接手
  if (e.pointerId === T.lookId) lookBy(e.clientX - l.x, e.clientY - l.y);
  l.x = e.clientX; l.y = e.clientY;
});
function touchEnd(e) {
  if (e.pointerId === T.joyId) { T.joyId = null; INPUT.mx = INPUT.mz = 0; setJoyIdle(); }
  if (T.lookers.delete(e.pointerId) && e.pointerId === T.lookId) { const nx = T.lookers.keys().next(); T.lookId = nx.done ? null : nx.value; }
  updateLooking(); if (!INPUT.looking) INPUT.fingerMoveT = 0;
}
touchEl.addEventListener('pointerup', touchEnd); touchEl.addEventListener('pointercancel', touchEnd);
function lookBy(dx, dy) {
  const k = degPerPx(); INPUT.lookDX += dx * k; INPUT.lookDY += dy * k * VERT_K;
  if (Math.abs(dx) + Math.abs(dy) > 0.5) INPUT.fingerMoveT = 0.1;   // 手指最近 0.1 秒有在動（瞄準輔助只在這時候拉）
}

// 開火鍵：按住開火，同時這根手指拖曳也能轉視角
const bFire = $('bFire');
bFire.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); audioInit(); INPUT.mode = 'touch';
  T.fireId = e.pointerId; T.fx = e.clientX; T.fy = e.clientY; INPUT.fire = true; updateLooking(); bFire.classList.add('down');
  try { bFire.setPointerCapture(e.pointerId); } catch (err) { /* 略過 */ }
});
bFire.addEventListener('pointermove', (e) => {
  if (e.pointerId !== T.fireId) return;
  lookBy(e.clientX - T.fx, e.clientY - T.fy); T.fx = e.clientX; T.fy = e.clientY;
});
function fireUp(e) { if (e.pointerId !== T.fireId) return; T.fireId = null; INPUT.fire = false; updateLooking(); bFire.classList.remove('down'); }
bFire.addEventListener('pointerup', fireUp); bFire.addEventListener('pointercancel', fireUp); bFire.addEventListener('lostpointercapture', fireUp);

// 其它按鈕：按下觸發；drag：按住後拖曳也能轉視角（跳、蹲）
function tapBtn(id, fn, drag = false) {
  const el = $(id); let pid = null, px = 0, py = 0;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); audioInit(); fn(el);
    if (drag && e.pointerType !== 'mouse') { pid = e.pointerId; px = e.clientX; py = e.clientY; try { el.setPointerCapture(pid); } catch (err) { /* 略過 */ } }
  });
  if (drag) {
    el.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; lookBy(e.clientX - px, e.clientY - py); px = e.clientX; py = e.clientY; });
    const up = (e) => { if (e.pointerId === pid) pid = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
tapBtn('bJump', (el) => { INPUT.jump = true; el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 120); }, true);
tapBtn('bCrouch', () => { INPUT.crouch = !INPUT.crouch; }, true);
tapBtn('bSwap', (el) => { swapWeapon(); el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 150); });
tapBtn('bNade', () => cycleNade());
// 裝彈／拆彈：按住
(function () {
  const el = $('bUse'); let pid = null;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); pid = e.pointerId; INPUT.use = true; try { el.setPointerCapture(pid); } catch (err) { /* 略過 */ } });
  const up = (e) => { if (e.pointerId === pid) { pid = null; INPUT.use = false; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
})();
tapBtn('bAds', () => {
  if (W.isNade) return;
  if (reloading()) { INPUT.adsQueued = !INPUT.adsQueued; hudTip(INPUT.adsQueued ? '換彈完自動開鏡' : '取消換彈後開鏡', 1.2); return; }
  player.ads = !player.ads;
});
tapBtn('bReload', (el) => { startReload(); el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 150); });
tapBtn('bAuto', () => { S.autoFire = !S.autoFire; saveSettings(); syncSettingsUI(); hudTip(S.autoFire ? '自動開火：開（準星對到敵人就開槍）' : '自動開火：關', 1.6); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
// 選單、設定裡的按鈕：多指觸控時瀏覽器不會產生 click，所以用放開手指來觸發（鍵盤按 Enter 仍走 click）
function onTap(el, fn) {
  let downOn = null;
  el.addEventListener('pointerdown', (e) => { downOn = e.pointerId; });
  el.addEventListener('pointerup', (e) => { if (downOn === e.pointerId) { downOn = null; fn(e); } });
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

// ---------- 鍵盤＋滑鼠（電腦上測試用） ----------
const KEYS = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) { if (['Space'].includes(e.code)) e.preventDefault(); return; }
  KEYS[e.code] = true;
  if (game.state !== 'play') { if (e.code === 'Escape' && game.state === 'pause') resumeGame(); return; }
  INPUT.mode = 'kb';
  if (e.code === 'Space') { INPUT.jump = true; e.preventDefault(); }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyC' || e.code === 'ControlLeft') INPUT.crouch = true;
  if (e.code === 'Escape') { if (!$('buy').hidden) closeBuy(); else pauseGame(); }
  if (e.code === 'Digit1') equip('primary'); if (e.code === 'Digit2') equip('secondary');
  if (e.code === 'KeyQ') swapWeapon(); if (e.code === 'KeyG' || e.code === 'Digit3' || e.code === 'Digit4') cycleNade();
  if (e.code === 'KeyE') INPUT.use = true;
  if (e.code === 'KeyZ') { if ($('radio').hidden) openRadio(); else closeRadio(); }
  const ord = { Digit5: 'follow', Digit6: 'A', Digit7: 'B', Digit8: 'hold', Digit9: 'free' }[e.code]; if (ord) giveOrder(ord);
  if (e.code === 'KeyB') { if ($('buy').hidden) { openBuy(); if (!$('buy').hidden && pointerLocked()) document.exitPointerLock(); } else closeBuy(); }
});
window.addEventListener('keyup', (e) => {
  KEYS[e.code] = false;
  if (e.code === 'KeyC' || e.code === 'ControlLeft') INPUT.crouch = false;
  if (e.code === 'KeyE') INPUT.use = false;
});
function keyboardMove() {
  if (INPUT.mode !== 'kb') return;
  INPUT.mx = (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0);
  INPUT.mz = (KEYS.KeyW ? 1 : 0) - (KEYS.KeyS ? 1 : 0);
  if (KEYS.ShiftLeft) { INPUT.mx *= 0.5; INPUT.mz *= 0.5; }   // Shift 慢走
}
const pointerLocked = () => document.pointerLockElement === touchEl || document.pointerLockElement === canvas;
function lockTarget() { return touchEl.hidden ? canvas : touchEl; }
function onMouseDown(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  if (game.state !== 'play') return;
  INPUT.mode = 'kb'; audioInit();
  if (!player.alive && game.mode === 'match' && pointerLocked()) { nextSpectate(); return; }
  if (!pointerLocked()) { try { const p = lockTarget().requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* 不支援就算了 */ } return; }
  if (e.button === 0) INPUT.fire = true;
  if (e.button === 2 && !reloading() && !W.isNade) player.ads = !player.ads;
}
function onMouseUp(e) { if (e.pointerType && e.pointerType !== 'mouse') return; if (e.button === 0 && INPUT.mode === 'kb') INPUT.fire = false; }
for (const el of [canvas, touchEl]) { el.addEventListener('pointerdown', onMouseDown); }
window.addEventListener('pointerup', onMouseUp);
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked()) return;
  INPUT.lookDX += e.movementX * 0.1 * S.sens; INPUT.lookDY += e.movementY * 0.1 * S.sens;
});
document.addEventListener('pointerlockchange', () => { if (!pointerLocked() && game.state === 'play' && INPUT.mode === 'kb' && $('buy').hidden) { INPUT.fire = false; pauseGame(); } });
