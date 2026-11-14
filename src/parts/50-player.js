/* ===== 50-player：玩家移動（CS 式加速與摩擦、急停、跳、蹲、滑牆）、血量、受擊、陣亡重生 ===== */
const RUN_SPEED = 5.4, JUMP_V = 7.0, STAND_H = 1.8, CROUCH_H = 1.2;
// Source 引擎的地面移動：先摩擦、再加速（sv_accelerate 5.5、sv_friction 5.2、sv_stopspeed 80u≈2.03m/s）
const ACCEL = 5.5, FRICTION = 5.2, STOP_SPEED = 2.03;
const player = {
  body: { pos: new V3(), vel: new V3(), r: 0.35, h: STAND_H, onGround: false, jumped: false },
  yaw: -Math.PI / 2, pitch: 0, eye: 1.62, hp: 100, alive: false, crouch: false,
  ads: false, adsT: 0, boxes: newBoxes(), stepT: 0, stepSide: 1, landT: 0,
  kills: 0, deaths: 0, heads: 0, respawnT: 0, killer: '', hurtT: 0,
  tag: 1,                      // 被打中的減速（CS 的 tagging），1＝沒減速
  punchP: 0, punchPV: 0, punchY: 0, punchYV: 0,   // 被打中的視角抖動（彈簧）
  dealt: 0, dealtHits: 0, taken: {},              // 這條命的傷害統計
};
function eyePos(out) { const p = player.body.pos; return out.set(p.x, p.y + player.eye, p.z); }
function spawnPlayer(fixed, keep) {
  // 出生點：對戰時由回合指定；練習時挑離機器人遠、而且沒有機器人看得到的
  let best = fixed || PLAYER_SPAWNS[0], bd = -1e9;
  if (!fixed) for (const s of PLAYER_SPAWNS) {
    let d = 1e9, seen = false;
    for (const b of bots) if (b.active && b.alive && b.team !== player.team) {
      d = Math.min(d, Math.hypot(b.body.pos.x - s[0], b.body.pos.z - s[1]));
      if (!seen && lineClear(_v1.set(b.body.pos.x, 1.6, b.body.pos.z), _v2.set(s[0], 1.4, s[1]))) seen = true;
    }
    const sc = Math.min(d, 40) - (seen ? 50 : 0);
    if (sc > bd) { bd = sc; best = s; }
  }
  const b = player.body; b.pos.set(best[0], 0, best[1]); b.vel.set(0, 0, 0); b.h = STAND_H; b.onGround = true;
  player.yaw = -Math.PI / 2; player.pitch = 0; player.hp = 100; player.alive = true; player.crouch = false; player.eye = 1.62;
  player.ads = false; player.adsT = 0; INPUT.crouch = false; player.tag = 1; player.punchP = player.punchY = player.punchPV = player.punchYV = 0;
  player.dealt = 0; player.dealtHits = 0; player.taken = {}; player.spawnT = 1.5; player.deadT = 0;   // 重生後 1.5 秒機器人不開槍
  resetWeapon(keep);
}
function playerSpeed() { return Math.hypot(player.body.vel.x, player.body.vel.z); }

function updatePlayer(dt) {
  const b = player.body, p = b.pos;
  // 受擊視角抖動（彈簧回正）
  player.punchPV += (-220 * player.punchP - 30 * player.punchPV) * dt; player.punchP += player.punchPV * dt;
  player.punchYV += (-220 * player.punchY - 30 * player.punchYV) * dt; player.punchY += player.punchYV * dt;
  if (!player.alive) { b.vel.x *= 0.9; b.vel.z *= 0.9; moveBody(b, dt); player.eye = lerp(player.eye, 0.35, 1 - Math.exp(-6 * dt)); return; }
  // 蹲：放開時頭上要有空間才站得起來
  if (INPUT.crouch && !player.crouch) { player.crouch = true; b.h = CROUCH_H; }
  else if (!INPUT.crouch && player.crouch && headroom(p.x, p.z, b.r * 0.9, p.y + CROUCH_H, p.y + STAND_H)) { player.crouch = false; b.h = STAND_H; }
  player.eye = lerp(player.eye, player.crouch ? 1.05 : 1.62, 1 - Math.exp(-14 * dt));
  if (b.onGround && player.tag < 1) player.tag = Math.min(1, player.tag + 0.45 * dt);
  if (player.landT > 0) player.landT -= dt;
  if (player.spawnT > 0) player.spawnT -= dt;

  let mx = INPUT.mx, mz = INPUT.mz; if (roundFrozen()) mx = mz = 0;   // 回合開始的凍結時間不能動
  const mh = Math.hypot(mx, mz);
  if (mh > 1) { mx /= mh; mz /= mh; }
  const mag = Math.min(1, mh);
  const landK = player.landT > 0 ? 1 - player.landT / 0.4 * 0.2 : 1;   // 落地後 0.4 秒慢一點
  const maxS = RUN_SPEED * (player.crouch ? 0.34 : 1) * (player.ads ? 0.72 : 1) * (reloading() ? 0.9 : 1) * player.tag * landK * (W.isNade ? 1.04 : WP.speed) * (plantBusy() ? 0 : 1);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let wx = cy * mx - sy * mz, wz = -sy * mx - cy * mz; const wl = Math.hypot(wx, wz);
  if (wl > 1e-4) { wx /= wl; wz /= wl; }
  const wish = maxS * mag;
  if (b.onGround) {
    // 摩擦
    const sp = playerSpeed();
    if (sp > 1e-4) {
      // 觸控推一點點也能慢慢走：摩擦的下限不超過想走的速度
      const ctl = INPUT.mode === 'touch' && wish > 0 ? Math.max(sp, Math.min(STOP_SPEED, wish * 0.9)) : Math.max(sp, STOP_SPEED);
      let drop = ctl * FRICTION * dt;
      // 手機：搖桿放回中間就自動急停（觸控做不到 CS 的反向急停）
      if (INPUT.mode === 'touch' && mag < 0.02) drop += (30 + 5.2 * sp) * dt;
      const ns = Math.max(0, sp - drop) / sp; b.vel.x *= ns; b.vel.z *= ns;
    }
    // 加速
    if (wish > 0) {
      const cur = b.vel.x * wx + b.vel.z * wz, add = wish - cur;
      if (add > 0) { const a = Math.min(add, ACCEL * wish * dt * 1.1); b.vel.x += a * wx; b.vel.z += a * wz; }
    }
  } else if (wish > 0) {
    // 空中：只能微調方向
    const cur = b.vel.x * wx + b.vel.z * wz, add = Math.min(wish, 0.76) - cur;
    if (add > 0) { const a = Math.min(add, 10 * wish * dt); b.vel.x += a * wx; b.vel.z += a * wz; }
  }
  // 跳：按下後 0.12 秒內落地就會接著跳（緩衝）；剛走出邊緣 0.08 秒內還能跳（寬限）
  player.coyote = b.onGround ? 0.08 : (player.coyote || 0) - dt;
  if (INPUT.jumpT > 0) INPUT.jumpT -= dt;
  if (INPUT.jumpT > 0 && player.coyote > 0 && b.vel.y <= 0.1) {
    const jv = JUMP_V * (player.landT > 0 ? 0.85 : 1);
    if (player.crouch && headroom(p.x, p.z, b.r * 0.9, p.y + CROUCH_H, p.y + STAND_H)) { INPUT.crouch = false; player.crouch = false; b.h = STAND_H; }
    if (!player.crouch) { b.vel.y = jv; b.jumped = true; b.onGround = false; INPUT.jumpT = 0; player.coyote = 0; }
  }
  const wasGround = b.onGround, vy = b.vel.y;
  moveBody(b, dt);
  if (!wasGround && b.onGround) {
    player.landT = 0.4; b.vel.x *= 0.8; b.vel.z *= 0.8;
    W.land = WP.land; viewmodelLand(-vy);
    if (vy < -3) sfx('land', Math.min(1, -vy / 8));
  }
  // 跟機器人互相推開（不會穿過去）
  for (const bot of bots) {
    if (!bot.active || !bot.alive) continue;
    const ex = p.x - bot.body.pos.x, ez = p.z - bot.body.pos.z, d = Math.hypot(ex, ez);
    if (bot.active && d < 0.7 && d > 1e-4 && Math.abs(p.y - bot.body.pos.y) < 1.6) { p.x += ex / d * (0.7 - d); p.z += ez / d * (0.7 - d); resolveXZ(b); }
  }
  // 腳步聲：速度過半才有聲音（慢走、蹲走無聲），左右腳交替
  const sp = playerSpeed();
  if (b.onGround && sp > RUN_SPEED * 0.55 && !player.crouch) {
    player.stepT -= dt;
    if (player.stepT <= 0) { player.stepT = 0.34 * RUN_SPEED / sp; player.stepSide = -player.stepSide; sfx('step', 0.7, { pan: player.stepSide * 0.15, rate: 1 + player.stepSide * 0.04, surface: surfaceAt(p) }); }
  } else player.stepT = Math.min(player.stepT, 0.1);
  hitBoxes(p, b.h, player.boxes);
  if (player.hurtT > 0) player.hurtT -= dt;
}
// 腳下是什麼材質（腳步聲用）
function surfaceAt(p) {
  let best = 'floor', top = -1e9;
  for (let i = 0; i < BOXES.length; i++) { const bx = BOXES[i]; if (bx.max[1] <= p.y + 0.05 && bx.max[1] > top && overlapXZ(bx, p.x, p.z, 0.1)) { top = bx.max[1]; best = bx.c; } }
  return best;
}

function damagePlayer(dmg, bot, part, weapon) {
  if (!player.alive) return;
  if (game.mode === 'rage') dmg *= rageTakenMul();   // 狂暴中受傷減半
  player.hp = Math.max(0, player.hp - dmg); player.hurtT = 0.35;
  const t = player.taken[bot.name] || (player.taken[bot.name] = { dmg: 0, hits: 0 }); t.dmg += dmg; t.hits++;
  // CS 式受擊：視角往上抖、移動變慢
  player.punchPV += Math.min(3, dmg * 0.08) * 22; player.punchYV += rand(-1, 1) * 14;
  player.tag = Math.min(player.tag, 0.45);
  sfx('hurt');
  try { if (S.vibrate && navigator.vibrate && INPUT.mode === 'touch') navigator.vibrate(25); } catch (e) { /* iPhone 不支援 */ }
  const dx = bot.body.pos.x - player.body.pos.x, dz = bot.body.pos.z - player.body.pos.z;
  hudHurt(angDiff(player.yaw, Math.atan2(-dx, -dz)), dmg);
  if (player.hp <= 0) {
    resetTouchState();
    player.alive = false; player.deaths++; statDeath(); player.deathStreak = (player.deathStreak || 0) + 1; player.killer = bot.name; if (bot.team !== player.team) roundKill(bot);
    player.respawnT = game.mode === 'match' ? Infinity : game.mode === 'dm' || game.mode === 'duel' ? 2.5 : game.mode === 'koth' ? 4 : 3.5;
    killcamStart(bot);   // 擊殺鏡頭（練習模式會把重生延到播完）    // 對戰模式：這回合不重生，改觀戰
    player.ads = false; INPUT.fire = false; INPUT.use = false; player.useT = 0; closeBuy();
    const w = weapon || bot.wpn || WEAPONS.rifle;
    if (bot.team !== player.team) { bot.kills++; if (part === 'head') bot.heads++; addMoney(bot, w.reward || 0, '擊殺'); }
    hudFeed(bot.name, '你', part === 'head', bot.team, 'A', false, w.short);
    showDead(bot.name, part === 'head');
    if (game.mode === 'duel') netOnMyDeath(bot, part, w);
    onUnitDied(player);
  }
}
