/* ===== 72-controls：操作進階——自訂按鈕位置（拖曳、大小、透明度）、陀螺儀瞄準
   配置存在設定裡（S.layout），位置用「右手模式」的螢幕比例記；左手模式左右對調。 */
const EDIT_IDS = ['joy', 'bFire', 'bAds', 'bCrouch', 'bJump', 'bReload', 'bAuto', 'bSwap', 'bNade', 'bUse'];
const EDIT_NAME = { joy: '搖桿', bFire: '開火', bAds: '開鏡', bCrouch: '蹲', bJump: '跳', bReload: '換彈', bAuto: '自動開火', bSwap: '換槍', bNade: '投擲', bUse: '裝彈／拆彈' };
const layoutOf = (id) => (S.layout && S.layout[id]) || null;
const joyScale = () => { const L = layoutOf('joy'); return L ? L.s : 1; };

// 套用配置：沒自訂的按鈕照預設位置（左手模式由 CSS 的 right 換成 left），自訂的用螢幕比例定位
function applyLayout() {
  const W0 = window.innerWidth, H0 = window.innerHeight;
  for (const id of EDIT_IDS) {
    const el = $(id), L = layoutOf(id);
    if (id === 'joy') {
      el.style.scale = L ? L.s : ''; el.style.setProperty('--op', L ? L.o : 1);
      continue;    // 位置由 setJoyIdle（joyHome）處理
    }
    el.style.setProperty('--op', L ? L.o : 1);
    if (!L) continue;
    el.style.left = (S.lefty ? 1 - L.x : L.x) * W0 + 'px'; el.style.top = L.y * H0 + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.translate = '-50% -50%';
    el.style.scale = `calc(var(--bs, 1) * ${L.s})`;
  }
  if (T.joyId === null) setJoyIdle();
}

// ---------- 編輯模式 ----------
const ED = { on: false, sel: null, pid: null, dx: 0, dy: 0, wasHidden: {}, from: '' };
function centerOf(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
// 把目前畫面上的位置寫進配置（第一次拖預設按鈕時用）
function ensureEntry(id) {
  if (!S.layout) S.layout = {};
  if (!S.layout[id]) {
    const el = $(id); let [cx, cy] = centerOf(el);
    if (id === 'joy') [cx, cy] = joyHome();
    const x = cx / window.innerWidth;
    S.layout[id] = { x: +(S.lefty ? 1 - x : x).toFixed(4), y: +(cy / window.innerHeight).toFixed(4), s: 1, o: 1 };
  }
  return S.layout[id];
}
function openLayoutEdit() {
  ED.on = true; ED.sel = null; ED.from = game.fromMenu ? 'menu' : 'pause';
  $('pause').hidden = true; if (ED.from === 'menu') $('menu').hidden = true;
  ED.wasHidden = { touch: touchEl.hidden }; touchEl.hidden = false;
  for (const id of EDIT_IDS) ED.wasHidden[id] = $(id).hidden;
  document.body.classList.add('editing'); $('edit').hidden = false;
  resetTouchState(); applyLayout(); syncEditBar();
}
function closeLayoutEdit() {
  ED.on = false; document.body.classList.remove('editing'); $('edit').hidden = true;
  for (const id of EDIT_IDS) { const el = $(id); el.classList.remove('sel'); el.hidden = ED.wasHidden[id]; }
  touchEl.hidden = ED.wasHidden.touch;
  if (ED.from === 'menu') $('menu').hidden = false;
  saveSettings(); syncSettingsUI(); $('pause').hidden = false;
}
function selectEdit(id) {
  ED.sel = id; for (const k of EDIT_IDS) { $(k).classList.toggle('sel', k === id); $(k).classList.remove('overlap'); } syncEditBar(); editOverlap();
}
function syncEditBar() {
  const L = ED.sel && layoutOf(ED.sel);
  $('edName').textContent = ED.sel ? EDIT_NAME[ED.sel] : '點一顆按鈕來調整，直接拖曳移動';
  $('edSize').disabled = $('edOp').disabled = !ED.sel;
  $('edSize').value = L ? L.s : 1; $('edOp').value = L ? L.o : 1;
  $('oEdSize').textContent = Math.round((L ? L.s : 1) * 100) + '%'; $('oEdOp').textContent = Math.round((L ? L.o : 1) * 100) + '%';
}
function editTarget(t) {
  for (let el = t; el && el !== document.body; el = el.parentElement) if (EDIT_IDS.includes(el.id)) return el.id;
  return null;
}
// 編輯時攔下所有觸控，不讓按鈕真的作用
document.addEventListener('pointerdown', (e) => {
  if (!ED.on || $('edit').contains(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  const id = editTarget(e.target); if (!id) return;
  selectEdit(id);
  const [cx, cy] = id === 'joy' ? joyHome() : centerOf($(id));
  ED.pid = e.pointerId; ED.dx = cx - e.clientX; ED.dy = cy - e.clientY;
}, true);
document.addEventListener('pointermove', (e) => {
  if (!ED.on || e.pointerId !== ED.pid || !ED.sel) return;
  e.preventDefault(); e.stopPropagation();
  const L = ensureEntry(ED.sel), W0 = window.innerWidth, H0 = window.innerHeight;
  // 整顆按鈕都要留在畫面內（算半徑，不只算中心），也不能躲到上面的編輯列底下（不然再也點不到）
  const el = ED.sel === 'joy' ? null : $(ED.sel), rc = el && el.getBoundingClientRect(), r = Math.max(20, rc ? Math.max(rc.width, rc.height) / 2 : 60 * (S.btnScale || 1));
  const px = clamp(e.clientX + ED.dx, r, W0 - r), bar = $('edit').getBoundingClientRect();
  const under = px + r > bar.left && px - r < bar.right, top = under ? bar.bottom + r + 4 : r;
  const x = px / W0, y = clamp(e.clientY + ED.dy, Math.min(top, H0 - r), H0 - r) / H0;
  L.x = +(S.lefty ? 1 - x : x).toFixed(4); L.y = +y.toFixed(4);
  applyLayout(); editOverlap();
  if (performance.now() - (ED.savedAt || 0) > 400) { ED.savedAt = performance.now(); saveSettings(); }   // 拖到一半也存（重新整理不會掉）
}, true);
// 跟別顆按鈕疊在一起：編輯列提示、選中的按鈕變紅框（照樣可以放，只是提醒）
function editOverlap() {
  if (!ED.sel) return;
  const me = $(ED.sel).getBoundingClientRect(); let hit = '';
  for (const k of EDIT_IDS) {
    if (k === ED.sel) continue; const el = $(k); if (el.hidden || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect(), ox = Math.min(me.right, r.right) - Math.max(me.left, r.left), oy = Math.min(me.bottom, r.bottom) - Math.max(me.top, r.top);
    if (ox > 8 && oy > 8) { hit = EDIT_NAME[k]; break; }
  }
  $(ED.sel).classList.toggle('overlap', !!hit);
  $('edName').textContent = EDIT_NAME[ED.sel] + (hit ? `（和「${hit}」疊在一起，可能誤按）` : '');
}
document.addEventListener('pointerup', (e) => { if (ED.on && e.pointerId === ED.pid) { ED.pid = null; saveSettings(); } }, true);
for (const [id, k, out] of [['edSize', 's', 'oEdSize'], ['edOp', 'o', 'oEdOp']]) {
  $(id).addEventListener('input', (e) => {
    if (!ED.sel) return; const L = ensureEntry(ED.sel); L[k] = +e.target.value;
    $(out).textContent = Math.round(L[k] * 100) + '%'; applyLayout(); saveSettings();
  });
}
onTap($('edReset'), () => { S.layout = null; saveSettings(); applyHand(); selectEdit(null); hudTip('按鈕位置已恢復預設', 1.2); });
onTap($('edDone'), closeLayoutEdit);
onTap($('bLayout'), openLayoutEdit); onTap($('bLayoutQ'), openLayoutEdit);   // 暫停畫面最上面也有一顆，不用往下找
window.addEventListener('resize', () => setTimeout(applyLayout, 50));

// ---------- 陀螺儀瞄準 ----------
// 橫拿手機：手機左右轉（像方向盤以外的「原地轉身」）＝左右看，上下仰＝上下看。iPhone 要使用者按一下同意。
const GYRO = { last: 0, ok: false, events: 0 };
async function askGyro() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') { S.gyro = 'off'; saveSettings(); syncSettingsUI(); hudTip('沒有取得動作感測權限，陀螺儀已關閉', 2); return false; }
    }
  } catch (e) { /* 不支援就當作可用，沒有事件就不會動 */ }
  GYRO.ok = true; return true;
}
function screenAngle() {
  if (GYRO.angle != null) return GYRO.angle;   // 測試用
  const a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 90);
  return ((a % 360) + 360) % 360;
}
function onGyro(rr, dtSec) {
  if (S.gyro === 'off' || game.state !== 'play' || !player.alive) return;
  if (S.gyro === 'ads' && !player.ads) return;
  const dz = (v) => (Math.abs(v || 0) < 1 ? 0 : v);    // 每秒 1 度以下當作手抖
  const beta = dz(rr.beta), gamma = dz(rr.gamma), a = screenAngle();
  let yaw, pitch;   // 每秒幾度：yaw 正＝往右看，pitch 正＝往下看
  if (a === 270) { yaw = beta; pitch = -gamma; }
  else if (a === 0 || a === 180) { const sg = a === 0 ? 1 : -1; yaw = -gamma * sg; pitch = -beta * sg; }   // 直拿（遊戲會要求橫拿，只是備用）
  else { yaw = -beta; pitch = gamma; }
  const k = S.gyroSens * (S.gyroInv ? -1 : 1) * dtSec;
  INPUT.gyroDX += yaw * k; INPUT.gyroDY += pitch * k * VERT_K;
}
window.addEventListener('devicemotion', (e) => {
  GYRO.events++;
  const now = performance.now(), dt = clamp((now - (GYRO.last || now)) / 1000, 0, 0.05); GYRO.last = now;
  if (e.rotationRate && dt > 0) onGyro(e.rotationRate, dt);
});
