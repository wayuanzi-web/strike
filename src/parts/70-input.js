/* ===== 70-input：觸控（主要）與鍵盤滑鼠（測試用備用） =====
   左半邊：手指按哪裡，搖桿就出現在哪裡。右半邊：拖曳轉視角。開火鍵按住時也能拖著瞄。 */
const INPUT = {
  mx: 0, mz: 0, lookDX: 0, lookDY: 0, fire: false, jump: false, crouch: false, mode: isTouch ? 'touch' : 'kb',
  looking: false, autoFire: false,
};
const touchEl = $('touch'), joyEl = $('joy'), joyK = $('joyK');
const T = { joyId: null, jx: 0, jy: 0, lookId: null, lx: 0, ly: 0, fireId: null, fx: 0, fy: 0 };
const joyR = () => Math.max(40, window.innerHeight * 0.13);
// 每像素轉幾度：靈敏度 1.0 時，手指橫掃整個螢幕寬度轉 180 度
const degPerPx = () => 180 / Math.max(320, window.innerWidth) * S.sens;

function setJoyIdle() {
  // 沒按的時候，左下角留一個淡淡的搖桿位置提示
  joyEl.style.left = (window.innerWidth * 0.16) + 'px'; joyEl.style.top = (window.innerHeight * 0.68) + 'px';
  joyK.style.transform = ''; joyEl.className = 'idle';
}
touchEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;         // 滑鼠交給下面的鍵鼠操作
  if (e.target !== touchEl) return;              // 按鈕自己處理
  e.preventDefault(); audioInit(); INPUT.mode = 'touch';
  const x = e.clientX, y = e.clientY;
  if (x < window.innerWidth * 0.45 && T.joyId === null) {
    T.joyId = e.pointerId; const r = joyR();
    T.jx = clamp(x, r + 8, window.innerWidth * 0.45); T.jy = clamp(y, r + 8, window.innerHeight - r - 8);
    joyEl.style.left = T.jx + 'px'; joyEl.style.top = T.jy + 'px'; joyEl.className = 'on';
    moveJoy(x, y);
  } else if (x >= window.innerWidth * 0.45) {
    T.lookId = e.pointerId; T.lx = x; T.ly = y; INPUT.looking = true;
  }
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) { /* 有些瀏覽器不支援，照樣能用 */ }
});
function moveJoy(x, y) {
  const r = joyR(); let dx = x - T.jx, dy = y - T.jy; const d = Math.hypot(dx, dy);
  // 手指拉太遠時，搖桿底座跟著手指走
  if (d > r * 1.25) { const ex = d - r * 1.25; T.jx += dx / d * ex; T.jy += dy / d * ex; joyEl.style.left = T.jx + 'px'; joyEl.style.top = T.jy + 'px'; dx = x - T.jx; dy = y - T.jy; }
  const dd = Math.hypot(dx, dy), k = Math.min(1, dd / r);
  const kx = dd > 0 ? dx / dd * k * r : 0, ky = dd > 0 ? dy / dd * k * r : 0;
  joyK.style.transform = `translate(${kx}px, ${ky}px)`;
  const dead = 0.12, mag = k < dead ? 0 : (k - dead) / (1 - dead);
  INPUT.mx = dd > 0 ? dx / dd * mag : 0; INPUT.mz = dd > 0 ? -dy / dd * mag : 0;
  joyEl.classList.toggle('run', mag > 0.92);
}
touchEl.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  if (e.pointerId === T.joyId) moveJoy(e.clientX, e.clientY);
  else if (e.pointerId === T.lookId) { lookBy(e.clientX - T.lx, e.clientY - T.ly); T.lx = e.clientX; T.ly = e.clientY; }
});
function touchEnd(e) {
  if (e.pointerId === T.joyId) { T.joyId = null; INPUT.mx = INPUT.mz = 0; setJoyIdle(); }
  if (e.pointerId === T.lookId) { T.lookId = null; INPUT.looking = T.fireId !== null; }
}
touchEl.addEventListener('pointerup', touchEnd); touchEl.addEventListener('pointercancel', touchEnd);
function lookBy(dx, dy) { const k = degPerPx(); INPUT.lookDX += dx * k; INPUT.lookDY += dy * k; }

// 開火鍵：按住開火，同時這根手指拖曳也能轉視角
const bFire = $('bFire');
bFire.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); audioInit(); INPUT.mode = 'touch';
  T.fireId = e.pointerId; T.fx = e.clientX; T.fy = e.clientY; INPUT.fire = true; INPUT.looking = true; bFire.classList.add('down');
  try { bFire.setPointerCapture(e.pointerId); } catch (err) { /* 略過 */ }
});
bFire.addEventListener('pointermove', (e) => {
  if (e.pointerId !== T.fireId) return;
  lookBy(e.clientX - T.fx, e.clientY - T.fy); T.fx = e.clientX; T.fy = e.clientY;
});
function fireUp(e) { if (e.pointerId !== T.fireId) return; T.fireId = null; INPUT.fire = false; INPUT.looking = T.lookId !== null; bFire.classList.remove('down'); }
bFire.addEventListener('pointerup', fireUp); bFire.addEventListener('pointercancel', fireUp); bFire.addEventListener('lostpointercapture', fireUp);

function tapBtn(id, fn) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(el); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
tapBtn('bJump', (el) => { INPUT.jump = true; el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 120); });
tapBtn('bCrouch', () => { INPUT.crouch = !INPUT.crouch; });
tapBtn('bAds', () => { if (!reloading()) player.ads = !player.ads; });
tapBtn('bReload', (el) => { startReload(); el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 150); });
tapBtn('bAuto', () => { S.autoFire = !S.autoFire; saveSettings(); syncSettingsUI(); hudTip(S.autoFire ? '自動開火：開（準星對到敵人就開槍）' : '自動開火：關', 1.6); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

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
  if (e.code === 'Escape') pauseGame();
});
window.addEventListener('keyup', (e) => {
  KEYS[e.code] = false;
  if (e.code === 'KeyC' || e.code === 'ControlLeft') INPUT.crouch = false;
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
  if (!pointerLocked()) { try { const p = lockTarget().requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* 不支援就算了 */ } return; }
  if (e.button === 0) INPUT.fire = true;
  if (e.button === 2 && !reloading()) player.ads = !player.ads;
}
function onMouseUp(e) { if (e.pointerType && e.pointerType !== 'mouse') return; if (e.button === 0 && INPUT.mode === 'kb') INPUT.fire = false; }
for (const el of [canvas, touchEl]) { el.addEventListener('pointerdown', onMouseDown); }
window.addEventListener('pointerup', onMouseUp);
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked()) return;
  INPUT.lookDX += e.movementX * 0.1 * S.sens; INPUT.lookDY += e.movementY * 0.1 * S.sens;
});
document.addEventListener('pointerlockchange', () => { if (!pointerLocked() && game.state === 'play' && INPUT.mode === 'kb') { INPUT.fire = false; pauseGame(); } });
