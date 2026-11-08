/* ===== 90-main：遊戲狀態、瞄準輔助與自動開火、主迴圈、螢幕大小與方向 ===== */
const game = { autoPR: isTouch ? 1.25 : 1.5, slowN: 0, state: 'menu', t: 0, fps: 60, fpsAcc: 0, fpsN: 0, menuT: 0, mode: 'practice', spec: 0 };
const AIM = { onTarget: false, onT: 0, offT: 0, bot: null, yawErr: 0, pitchErr: 0, near: false };

// ---------- 瞄準輔助、自動開火 ----------
const _ae = new V3(), _ad = new V3(), _ac = new V3();
function updateAim(dt) {
  AIM.bot = null; AIM.near = false;
  if (!player.alive) { AIM.onTarget = false; return; }
  eyePos(_ae); aimDir(_ad);
  // 準星正中央的射線有沒有打到看得到的敵人（命中框稍微放大一點，手機上比較好觸發）
  const w = rayWorld(_ae, _ad, WP.range); const wallT = w ? w.t : WP.range;
  let on = false;
  for (const b of bots) {
    if (!b.active || !b.alive || b.team !== 'B') continue;
    const inf = 0.06 + 0.004 * Math.hypot(b.phys.pos.x - _ae.x, b.phys.pos.z - _ae.z);   // 遠的敵人命中框放大多一點
    const h = rayBody(_ae, _ad, b.boxes, wallT, inf);
    if (h && !(SMOKES.length && smokeBlocks(_ae, _ac.copy(_ae).addScaledVector(_ad, h.t)))) { on = true; AIM.dist = h.t; break; }   // 隔著煙不自動開火
  }
  // 狙擊槍沒開鏡、投擲物：不自動開火
  if ((WP.scope && player.adsT < 0.85) || W.isNade) on = false;
  if (on) { AIM.onT += dt; AIM.offT = 0; } else { AIM.offT += dt; AIM.onT = 0; }
  // 對到 0.03 秒才開火、離開 0.05 秒就停
  if (on && AIM.onT > 0.03) AIM.onTarget = true; else if (!on && AIM.offT > 0.05) AIM.onTarget = false;
  // 輔助：準星附近（依距離決定的錐形內）而且看得到的最近敵人
  let best = null, ba = 1e9;
  for (const b of bots) {
    if (!b.active || !b.alive || b.team !== 'B') continue;
    const p = b.phys.pos; _ac.set(p.x, p.y + b.phys.h * 0.55, p.z);   // 磁吸對準胸口，不是頭
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

function enterPlay() {
  audioInit();
  try { const el = document.documentElement; const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 不能全螢幕也照玩 */ }
  try { const r = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (r && r.catch) r.catch(() => {}); } catch (e) { /* iPhone 不支援鎖方向 */ }
  game.state = 'play';
  $('menu').hidden = true; $('over').hidden = true; $('hud').hidden = false; $('bPause').hidden = false; $('touch').hidden = !isTouch;
  document.body.classList.toggle('match', game.mode === 'match');
  setJoyIdle();
  hudTip(isTouch ? '左邊拖曳移動、右邊拖曳轉視角' : '點一下畫面鎖定滑鼠', 3);
}
// 練習：4 個敵人，陣亡馬上重生
function startGame(mode = 'practice') {
  if (mode === 'tutorial') { clearNades(); resetBomb(); closeBuy(); startTutorial(); return; }
  TUT.on = false; beacon.visible = false; $('tut').hidden = true;
  clearNades(); resetBomb(); closeBuy(); INV.primary = INV.secondary = null; INV.he = INV.flash = INV.smoke = 0; INV.kit = false;
  if (mode === 'match') { startMatch(); enterPlay(); openBuy(); return; }
  game.mode = 'practice'; setupBots('practice');
  bots.filter((b) => b.active).forEach((b, i) => { const s = BOT_SPAWNS[i]; botSpawn(b, s[0], s[1]); });
  spawnPlayer();
  player.kills = player.deaths = player.heads = 0;
  enterPlay();
}
// 地圖選擇：在選單點了就馬上換（背景會變成那張地圖）
function menuBackdrop() {
  setupBots('practice'); bots.filter((b) => b.active).forEach((b, i) => { const s = BOT_SPAWNS[i]; botSpawn(b, s[0], s[1]); });
}
function buildMapMenu() {
  const el = $('mapSel'); el.innerHTML = '';
  for (const id of MAP_ORDER) {
    const m = MAPS[id], b = document.createElement('button'); b.setAttribute('role', 'radio'); b.dataset.map = id;
    b.innerHTML = `<b>${m.name}</b><small>${m.sub}</small>`;
    onTap(b, () => pickMap(id));
    el.appendChild(b);
  }
  syncMapMenu();
}
function syncMapMenu() { for (const b of $('mapSel').children) b.setAttribute('aria-checked', b.dataset.map === MAP.id ? 'true' : 'false'); }
function pickMap(id) {
  if (id === MAP.id) return;
  S.map = id; saveSettings();
  $('boot').textContent = '載入地圖中…'; $('boot').hidden = false;
  setTimeout(() => { if (switchMap(id)) PERF.mapLoads[id] = game.mapLoadMs; menuBackdrop(); syncMapMenu(); $('boot').hidden = true; }, 30);
}
// 選單提示：第一次玩建議先教學
function syncMenuHints() {
  const first = !STATS.tutorialDone && STATS.matches === 0;
  $('firstHint').hidden = !first; $('bTut').classList.toggle('go', first); $('bMatch').classList.toggle('go', !first);
}
function backToMenu() {
  clearNades(); resetBomb(); closeBuy(); TUT.on = false; beacon.visible = false; $('tut').hidden = true; $('tutDone').hidden = true; syncMenuHints();
  game.state = 'menu'; $('over').hidden = true; $('pause').hidden = true; $('dead').hidden = true; $('hud').hidden = true; $('bPause').hidden = true; $('bBoard').hidden = true; $('touch').hidden = true;
  game.mode = 'practice'; setupBots('practice'); bots.filter((b) => b.active).forEach((b, i) => { const s = BOT_SPAWNS[i]; botSpawn(b, s[0], s[1]); });
  player.alive = false; $('menu').hidden = false;
}
function pauseGame() {
  if (game.state !== 'play') return;
  closeBuy();
  game.state = 'pause'; resetTouchState();
  syncSettingsUI(); $('pause').hidden = false;
  if (pointerLocked()) document.exitPointerLock();
}
function resumeGame() { if (game.state !== 'pause') return; $('pause').hidden = true; game.state = player.alive ? 'play' : 'dead'; if (game.state === 'dead') game.state = 'play'; }
onTap($('bStart'), () => startGame('practice'));
onTap($('bTut'), () => startGame('tutorial'));
onTap($('bStats'), openStats);
onTap($('bPerf'), openPerf);
onTap($('bMatch'), () => startGame('match'));
onTap($('bAgain'), () => startGame('match'));
onTap($('bMenu'), backToMenu);
$('bBoard').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); $('bBoard').classList.toggle('on'); boardT = 0; });
onTap($('bSet1'), () => { syncSettingsUI(); $('pause').hidden = false; $('bResume').textContent = '好了'; $('bRespawn').hidden = true; game.fromMenu = true; });
onTap($('bResume'), () => { if (game.fromMenu) { game.fromMenu = false; $('pause').hidden = true; $('bResume').textContent = '繼續'; $('bRespawn').hidden = false; return; } resumeGame(); });
onTap($('bRespawn'), () => {
  if (game.fromMenu) return;
  $('pause').hidden = true; $('dead').hidden = true; resetTouchState(); startGame(game.mode);   // 重來：從頭開始這個模式
});
$('bBuy').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); openBuy(); });
onTap($('buyX'), closeBuy);
onTap($('buyAuto'), autoBuy);
$('bPause').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); pauseGame(); });

// ---------- 螢幕大小、解析度、方向 ----------
function applySize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, S.quality === 'auto' ? game.autoPR : QUALITY[S.quality] || 1.5);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
  document.documentElement.style.setProperty('--u', (Math.min(h, w * 0.6, 560) / 100).toFixed(2) + 'px');   // 平板上不要放太大
  const portrait = h > w * 1.05;
  $('rotate').hidden = !(portrait && isTouch);
  if (portrait && isTouch && game.state === 'play') pauseGame();
  if (T.joyId === null) setJoyIdle();
  applyHand();
}
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------- 主迴圈 ----------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  const raw = Math.min(1, Math.max(0.001, dt));      // 實際經過的時間（算幀數用）
  if (dt > 0.05) dt = 0.05; if (dt <= 0) dt = 0.001;
  if (!game.manual) step(dt);
  render();
  perfFrame(raw * 1000);
  game.fpsAcc += raw; game.fpsN++;
  if (game.fpsAcc >= 0.5) { game.fps = game.fpsN / game.fpsAcc; game.fpsAcc = 0; game.fpsN = 0; autoQuality(); if (S.showFps) $('fps').textContent = Math.round(game.fps) + ' fps · ' + renderer.info.render.calls + ' draws'; }
}
// 畫質「自動」：玩的時候連續 3 秒低於 45fps，就把解析度往下降一階（最低 0.85 倍）
function autoQuality() {
  if (S.quality !== 'auto' || game.state !== 'play' || document.hidden || game.manual || PERF.bench) { game.slowN = 0; return; }
  game.slowN = game.fps < 45 ? game.slowN + 1 : 0;
  if (game.slowN >= 6 && game.autoPR > 0.85) {
    game.slowN = 0; const was = game.autoPR; game.autoPR = Math.max(0.85, +(game.autoPR - 0.2).toFixed(2)); applySize();
    PERF.prChanges.push(`${was}→${game.autoPR}（${MAP.name}，${Math.round(game.fps)}fps）`);
    hudTip('畫面有點卡，自動降低解析度', 2);
  }
}
function step(dt) {
  game.t += dt;
  updateAmbience(dt);
  if (game.state === 'menu') {
    // 選單背景：鏡頭繞著倉庫慢慢轉
    game.menuT += dt * 0.06;
    camera.position.set(Math.sin(game.menuT) * 30, 12, Math.cos(game.menuT) * 30);
    camera.lookAt(0, 1, 0);
    for (const b of bots) updateBot(b, dt);
    updateNades(dt); updateTracers(dt); updatePuffs(dt); updateSparks(dt); updateBlobShadows(); updateMuzzleLight(dt);
    return;
  }
  if (game.state === 'pause' || game.state === 'over') return;
  updateRound(dt); updateTutorial(dt);
  keyboardMove();
  // 視角：開鏡時乘上開鏡靈敏度與視野比例；瞄準輔助在敵人身上時轉得慢一點
  let ldx = INPUT.lookDX, ldy = INPUT.lookDY; INPUT.lookDX = INPUT.lookDY = 0;
  W.dragging = Math.abs(ldx) + Math.abs(ldy) > 0.02;
  const adsFov = W.isNade ? BASE_FOV : WP.adsFov;
  const adsScale = lerp(1, S.adsSens * (adsFov / BASE_FOV) * (WP.scope ? 1.3 : 1.6), player.adsT);
  updateAim(dt);
  const assist = S.aimAssist && INPUT.mode === 'touch' && AIM.bot && player.alive;
  const friction = assist && AIM.near ? 0.65 : 1;
  if (INPUT.fingerMoveT > 0) INPUT.fingerMoveT -= dt;
  ldx *= adsScale * friction; ldy *= adsScale * friction;
  if (player.alive) {
    player.yaw -= ldx * DEG; player.pitch = clamp(player.pitch - ldy * DEG, -85 * DEG, 85 * DEG);
    // 磁吸：手指在轉視角、在移動或在開火時，才把準星慢慢帶向敵人（不碰螢幕不會自己瞄）
    const active = INPUT.fingerMoveT > 0 || Math.hypot(INPUT.mx, INPUT.mz) > 0.1 || INPUT.fire;
    if (assist && active) {
      const rate = (Math.hypot(INPUT.mx, INPUT.mz) > 0.1 ? 14 : 8) * DEG * dt;
      player.yaw += clamp(AIM.yawErr, -rate, rate); player.pitch += clamp(AIM.pitchErr, -rate * 0.6, rate * 0.6);
    }
  }
  player.adsT = clamp(player.adsT + (player.ads && player.alive ? 1 : -1) * dt * 7, 0, 1);
  updatePlayer(dt);
  const auto = !INPUT.fire && S.autoFire && INPUT.mode === 'touch' && AIM.onTarget && $('buy').hidden;
  updateWeapon(dt, (INPUT.fire || auto) && player.alive, auto, AIM.dist || 0);
  if (game.mode === 'match') updatePlan();
  if (!game.freezeBots) for (const b of bots) updateBot(b, dt);
  updateNades(dt);
  updateTracers(dt); updatePuffs(dt); updateSparks(dt); updateBlobShadows(); updateMuzzleLight(dt);
  // 攝影機：眼睛位置＋後座力（畫面只跟 45%，子彈落點靠準星的後座點顯示）＋每發小跳＋受擊抖動
  const p = player.body.pos;
  const spec = !player.alive && game.mode === 'match' && player.deadT > 2 ? spectateTarget() : null;
  game.specBot = spec;
  if (spec) {
    // 觀戰：從隊友眼睛看出去
    const sp = spec.phys.pos; camera.position.set(sp.x, sp.y + spec.phys.h - 0.12, sp.z);
    camera.rotation.set(spec.pitch || 0, spec.yaw, 0);
  } else {
    camera.position.set(p.x, p.y + player.eye, p.z);
    camera.rotation.set(player.pitch + (W.rp * VIEW_TRACK + W.vp + player.punchP) * DEG + (player.alive ? 0 : -0.12),
      player.yaw + (W.ry * VIEW_TRACK + player.punchY) * DEG, player.alive ? 0 : 0.25);
  }
  camera.fov = spec ? BASE_FOV : lerp(BASE_FOV, adsFov, player.adsT); camera.updateProjectionMatrix();
  updateViewmodel(dt, ldx, ldy); updateViewmodelLight(dt);
  if (!player.alive) {
    const kb = bots.find((b) => b.name === player.killer);
    if (kb) { const ty = Math.atan2(-(kb.phys.pos.x - p.x), -(kb.phys.pos.z - p.z)); player.yaw += angDiff(player.yaw, ty) * (1 - Math.exp(-3 * dt)); player.pitch *= 1 - Math.min(1, 3 * dt); }
    player.respawnT -= dt; player.deadT = (player.deadT || 0) + dt;
    if (game.mode === 'match') { $('deadT').textContent = '這回合不能重生，觀戰隊友中'; if (player.deadT > 2) $('dead').hidden = true; }
    else $('deadT').textContent = Math.max(0, player.respawnT).toFixed(1) + ' 秒後重生';
    if (player.respawnT <= 0) { $('dead').hidden = true; spawnPlayer(); }
  }
  hudUpdate(dt);
}
function render() {
  renderer.info.reset(); renderer.clear();
  const sb = game.specBot, sv = sb && sb.g.visible; if (sb) sb.g.visible = false;   // 觀戰時別看到自己身體的內側
  renderer.render(scene, camera);
  if (sb) sb.g.visible = sv;
  if (game.state !== 'menu' && player.alive) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}

// ---------- 開始 ----------
buildNav();
initBots();
setupBots('practice'); bots.filter((b) => b.active).forEach((b, i) => { const s = BOT_SPAWNS[i]; botSpawn(b, s[0], s[1]); });   // 選單背景
syncSettingsUI(); buildBuyMenu(); buildMapMenu(); syncMenuHints();
document.body.classList.toggle('kb', !isTouch);
applySize();
// 先把所有材質編譯好，開局時不會卡一下
try { renderer.compile(scene, camera); renderer.compile(vmScene, vmCam); } catch (e) { /* 舊瀏覽器略過 */ }
$('boot').hidden = true; $('menu').hidden = false; PERF.bootMs = Math.round(performance.now());
requestAnimationFrame(frame);

// 自動測試用的把手（只有測試頁會用到）
window.__strike = { game, player, bots, W, S, INPUT, AIM, NAV, BOXES, renderer, camera, startGame, spawnPlayer, respawnBot, step, render,
  setView(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; }, traceShot, rayWorld, findPath, damageBot, PART_MUL, mapMeshes, checkWinding, DECOR, ROUND, startMatch, aliveCount, setupBots, onUnitDied, spectateTarget,
  INV, WEAPONS, NADES, BOMB, TUT, applyHand, PERF, perfReport, runBench, frameStats, STATS: () => STATS, renderStats, SITES, MAPS, switchMap, menuBackdrop, MAP_ORDER, getMap: () => MAP, TEAM_SPAWN, PLAYER_SPAWNS, BOT_SPAWNS, lineClear, nearestNode, buildNav, SMOKES, buyItem, autoBuy, equip, giveWeapon, throwNade, botThrow, plantBomb, giveBomb, endRound, siteAt, useAction, objectiveGoal, botArm, nadesLive };
