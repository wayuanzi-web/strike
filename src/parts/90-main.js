/* ===== 90-main：遊戲狀態、瞄準輔助與自動開火、主迴圈、螢幕大小與方向 ===== */
const game = { state: 'menu', t: 0, fps: 60, fpsAcc: 0, fpsN: 0, menuT: 0 };
const AIM = { onTarget: false, onT: 0, offT: 0, bot: null, yawErr: 0, pitchErr: 0, near: false };

// ---------- 瞄準輔助、自動開火 ----------
const _ae = new V3(), _ad = new V3(), _ac = new V3();
function updateAim(dt) {
  AIM.bot = null; AIM.near = false;
  if (!player.alive) { AIM.onTarget = false; return; }
  eyePos(_ae); aimDir(_ad);
  // 準星正中央的射線有沒有打到看得到的敵人（命中框稍微放大一點，手機上比較好觸發）
  const w = rayWorld(_ae, _ad, RIFLE.range); const wallT = w ? w.t : RIFLE.range;
  let on = false;
  for (const b of bots) { const h = b.alive && rayBody(_ae, _ad, b.boxes, wallT, 0.06); if (h) { on = true; AIM.dist = h.t; break; } }
  if (on) { AIM.onT += dt; AIM.offT = 0; } else { AIM.offT += dt; AIM.onT = 0; }
  // 對到 0.06 秒才開火、離開 0.12 秒才停，避免一閃一閃
  if (on && AIM.onT > 0.06) AIM.onTarget = true; else if (!on && AIM.offT > 0.12) AIM.onTarget = false;
  // 輔助：準星附近（依距離決定的錐形內）而且看得到的最近敵人
  let best = null, ba = 1e9;
  for (const b of bots) {
    if (!b.alive) continue;
    const p = b.phys.pos; _ac.set(p.x, p.y + b.phys.h * 0.66, p.z);
    const dx = _ac.x - _ae.x, dy = _ac.y - _ae.y, dz = _ac.z - _ae.z, dist = Math.hypot(dx, dy, dz);
    if (dist > 90) continue;
    const yawTo = Math.atan2(-dx, -dz), pitchTo = Math.asin(dy / dist);
    const ye = angDiff(player.yaw + W.ry * DEG, yawTo), pe = pitchTo - (player.pitch + W.rp * DEG);
    const ang = Math.hypot(ye, pe), cone = clamp(Math.atan(1.0 / dist), 2.5 * DEG, 9 * DEG);
    if (ang > cone || ang > ba) continue;
    if (!lineClear(_ae, _ac)) continue;
    best = b; ba = ang; AIM.yawErr = ye; AIM.pitchErr = pe; AIM.near = ang < Math.atan(0.45 / dist) + 0.8 * DEG;
  }
  AIM.bot = best;
}

function startGame() {
  audioInit();
  try { const el = document.documentElement; const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 不能全螢幕也照玩 */ }
  try { const r = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (r && r.catch) r.catch(() => {}); } catch (e) { /* iPhone 不支援鎖方向 */ }
  for (const b of bots) if (!b.alive) respawnBot(b);
  spawnPlayer();
  player.kills = player.deaths = player.heads = 0;
  game.state = 'play';
  $('menu').hidden = true; $('hud').hidden = false; $('bPause').hidden = false; $('touch').hidden = !isTouch;
  setJoyIdle();
  hudTip(isTouch ? '左邊拖曳移動、右邊拖曳轉視角' : '點一下畫面鎖定滑鼠', 3);
}
function pauseGame() {
  if (game.state !== 'play') return;
  game.state = 'pause'; INPUT.fire = false; INPUT.mx = INPUT.mz = 0; T.joyId = T.lookId = T.fireId = null; $('bFire').classList.remove('down');
  syncSettingsUI(); $('pause').hidden = false;
  if (pointerLocked()) document.exitPointerLock();
}
function resumeGame() { if (game.state !== 'pause') return; $('pause').hidden = true; game.state = player.alive ? 'play' : 'dead'; if (game.state === 'dead') game.state = 'play'; }
$('bStart').addEventListener('click', startGame);
$('bSet1').addEventListener('click', () => { syncSettingsUI(); $('pause').hidden = false; $('bResume').textContent = '好了'; game.fromMenu = true; });
$('bResume').addEventListener('click', () => { if (game.fromMenu) { game.fromMenu = false; $('pause').hidden = true; $('bResume').textContent = '繼續'; return; } resumeGame(); });
$('bRespawn').addEventListener('click', () => {
  if (game.fromMenu) return;
  $('pause').hidden = true; $('dead').hidden = true; for (const b of bots) respawnBot(b); spawnPlayer(); game.state = 'play';
});
$('bPause').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); pauseGame(); });

// ---------- 螢幕大小、解析度、方向 ----------
function applySize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, QUALITY[S.quality] || 1.5);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
  document.documentElement.style.setProperty('--u', (Math.min(h, w * 0.6) / 100).toFixed(2) + 'px');
  const portrait = h > w * 1.05;
  $('rotate').hidden = !(portrait && isTouch);
  if (portrait && isTouch && game.state === 'play') pauseGame();
  if (!T.joyId) setJoyIdle();
}
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------- 主迴圈 ----------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.05) dt = 0.05; if (dt <= 0) dt = 0.001;
  if (!game.manual) step(dt);
  render();
  game.fpsAcc += dt; game.fpsN++;
  if (game.fpsAcc >= 0.5) { game.fps = game.fpsN / game.fpsAcc; game.fpsAcc = 0; game.fpsN = 0; if (S.showFps) $('fps').textContent = Math.round(game.fps) + ' fps · ' + renderer.info.render.calls + ' draws'; }
}
function step(dt) {
  game.t += dt;
  if (game.state === 'menu') {
    // 選單背景：鏡頭繞著倉庫慢慢轉
    game.menuT += dt * 0.06;
    camera.position.set(Math.sin(game.menuT) * 30, 12, Math.cos(game.menuT) * 30);
    camera.lookAt(0, 1, 0);
    for (const b of bots) updateBot(b, dt);
    updateTracers(dt); updatePuffs(dt); updateSparks(dt); updateBlobShadows(); updateMuzzleLight(dt);
    return;
  }
  if (game.state === 'pause') return;
  keyboardMove();
  // 視角：開鏡時乘上開鏡靈敏度與視野比例；瞄準輔助在敵人身上時轉得慢一點
  let ldx = INPUT.lookDX, ldy = INPUT.lookDY; INPUT.lookDX = INPUT.lookDY = 0;
  W.dragging = Math.abs(ldx) + Math.abs(ldy) > 0.02;
  const adsScale = lerp(1, S.adsSens * (ADS_FOV / BASE_FOV) * 1.6, player.adsT);
  updateAim(dt);
  const assist = S.aimAssist && INPUT.mode === 'touch' && AIM.bot && player.alive;
  const friction = assist && AIM.near ? 0.55 : 1;
  ldx *= adsScale * friction; ldy *= adsScale * friction;
  if (player.alive) {
    player.yaw -= ldx * DEG; player.pitch = clamp(player.pitch - ldy * DEG, -85 * DEG, 85 * DEG);
    // 磁吸：手指在轉視角、在移動或在開火時，才把準星慢慢帶向敵人（不碰螢幕不會自己瞄）
    const active = INPUT.looking || Math.hypot(INPUT.mx, INPUT.mz) > 0.1 || INPUT.fire;
    if (assist && active) {
      const rate = (Math.hypot(INPUT.mx, INPUT.mz) > 0.1 ? 14 : 8) * DEG * dt;
      player.yaw += clamp(AIM.yawErr, -rate, rate); player.pitch += clamp(AIM.pitchErr, -rate * 0.6, rate * 0.6);
    }
  }
  player.adsT = clamp(player.adsT + (player.ads && player.alive ? 1 : -1) * dt * 7, 0, 1);
  updatePlayer(dt);
  const auto = !INPUT.fire && S.autoFire && INPUT.mode === 'touch' && AIM.onTarget;
  updateWeapon(dt, (INPUT.fire || auto) && player.alive, auto, AIM.dist || 0);
  if (!game.freezeBots) for (const b of bots) updateBot(b, dt);
  updateTracers(dt); updatePuffs(dt); updateSparks(dt); updateBlobShadows(); updateMuzzleLight(dt);
  // 攝影機：眼睛位置＋後座力（畫面只跟 45%，子彈落點靠準星的後座點顯示）＋每發小跳＋受擊抖動
  const p = player.body.pos;
  camera.position.set(p.x, p.y + player.eye, p.z);
  camera.rotation.set(player.pitch + (W.rp * VIEW_TRACK + W.vp + player.punchP) * DEG + (player.alive ? 0 : -0.5),
    player.yaw + (W.ry * VIEW_TRACK + player.punchY) * DEG, player.alive ? 0 : 0.35);
  camera.fov = lerp(BASE_FOV, ADS_FOV, player.adsT); camera.updateProjectionMatrix();
  updateViewmodel(dt, ldx, ldy); updateViewmodelLight(dt);
  if (!player.alive) {
    player.respawnT -= dt;
    $('deadT').textContent = Math.max(0, player.respawnT).toFixed(1) + ' 秒後重生';
    if (player.respawnT <= 0) { $('dead').hidden = true; spawnPlayer(); }
  }
  hudUpdate(dt);
}
function render() {
  renderer.info.reset(); renderer.clear();
  renderer.render(scene, camera);
  if (game.state !== 'menu' && player.alive) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}

// ---------- 開始 ----------
buildNav();
initBots();
syncSettingsUI();
document.body.classList.toggle('kb', !isTouch);
applySize();
// 先把所有材質編譯好，開局時不會卡一下
try { renderer.compile(scene, camera); renderer.compile(vmScene, vmCam); } catch (e) { /* 舊瀏覽器略過 */ }
$('boot').hidden = true; $('menu').hidden = false;
requestAnimationFrame(frame);

// 自動測試用的把手（只有測試頁會用到）
window.__strike = { game, player, bots, W, S, INPUT, AIM, NAV, BOXES, renderer, camera, startGame, spawnPlayer, respawnBot, step, render,
  setView(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; }, traceShot, rayWorld, findPath, damageBot, PART_MUL, mapMeshes, checkWinding, DECOR };
