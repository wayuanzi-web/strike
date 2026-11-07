/* ===== 50-player：玩家移動（跑、跳、蹲、滑牆）、血量、陣亡重生 ===== */
const RUN_SPEED = 5.4, JUMP_V = 5.7, STAND_H = 1.8, CROUCH_H = 1.2;
const player = {
  body: { pos: new V3(), vel: new V3(), r: 0.35, h: STAND_H, onGround: false, jumped: false },
  yaw: -Math.PI / 2, pitch: 0, eye: 1.62, hp: 100, alive: false, crouch: false,
  ads: false, adsT: 0, boxes: newBoxes(), stepT: 0, airT: 0, fallV: 0,
  kills: 0, deaths: 0, heads: 0, respawnT: 0, killer: '', hurtT: 0,
};
function eyePos(out) { const p = player.body.pos; return out.set(p.x, p.y + player.eye, p.z); }
function spawnPlayer() {
  // 出生點挑離機器人最遠的那個
  let best = PLAYER_SPAWNS[0], bd = -1;
  for (const s of PLAYER_SPAWNS) {
    let d = 1e9; for (const b of bots) if (b.alive) d = Math.min(d, Math.hypot(b.body.pos.x - s[0], b.body.pos.z - s[1]));
    if (d > bd) { bd = d; best = s; }
  }
  const b = player.body; b.pos.set(best[0], 0, best[1]); b.vel.set(0, 0, 0); b.h = STAND_H; b.onGround = true;
  player.yaw = -Math.PI / 2; player.pitch = 0; player.hp = 100; player.alive = true; player.crouch = false; player.eye = 1.62;
  player.ads = false; player.adsT = 0; INPUT.crouch = false;
  resetWeapon();
}
function playerSpeed() { return Math.hypot(player.body.vel.x, player.body.vel.z); }

function updatePlayer(dt) {
  const b = player.body, p = b.pos;
  if (!player.alive) { b.vel.x *= 0.9; b.vel.z *= 0.9; moveBody(b, dt); player.eye = lerp(player.eye, 0.35, 1 - Math.exp(-6 * dt)); return; }
  // 蹲：放開時頭上要有空間才站得起來
  if (INPUT.crouch && !player.crouch) { player.crouch = true; b.h = CROUCH_H; }
  else if (!INPUT.crouch && player.crouch && headroom(p.x, p.z, b.r * 0.9, p.y + CROUCH_H, p.y + STAND_H)) { player.crouch = false; b.h = STAND_H; }
  player.eye = lerp(player.eye, player.crouch ? 1.05 : 1.62, 1 - Math.exp(-14 * dt));

  // 移動：搖桿的方向轉成世界座標，地上加速快，空中只能微調
  let mx = INPUT.mx, mz = INPUT.mz; const mh = Math.hypot(mx, mz);
  if (mh > 1) { mx /= mh; mz /= mh; }
  const maxS = RUN_SPEED * (player.crouch ? 0.48 : 1) * (player.ads ? 0.72 : 1) * (reloading() ? 0.9 : 1);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const wx = (cy * mx - sy * mz) * maxS, wz = (-sy * mx - cy * mz) * maxS;
  const ax = b.onGround ? 46 : 10;
  const dx = wx - b.vel.x, dz = wz - b.vel.z, dl = Math.hypot(dx, dz);
  if (dl > 1e-4) { const st = Math.min(dl, ax * dt); b.vel.x += dx / dl * st; b.vel.z += dz / dl * st; }
  if (INPUT.jump) { INPUT.jump = false; if (b.onGround && !player.crouch) { b.vel.y = JUMP_V; b.jumped = true; b.onGround = false; } else if (b.onGround && player.crouch && headroom(p.x, p.z, b.r * 0.9, p.y + CROUCH_H, p.y + STAND_H)) { INPUT.crouch = false; player.crouch = false; b.h = STAND_H; b.vel.y = JUMP_V; b.jumped = true; b.onGround = false; } }
  const wasGround = b.onGround, vy = b.vel.y;
  moveBody(b, dt);
  if (!wasGround && b.onGround && vy < -4) sfx('land');
  // 跟機器人互相推開（不會穿過去）
  for (const bot of bots) {
    if (!bot.alive) continue;
    const ex = p.x - bot.body.pos.x, ez = p.z - bot.body.pos.z, d = Math.hypot(ex, ez);
    if (d < 0.7 && d > 1e-4 && Math.abs(p.y - bot.body.pos.y) < 1.6) { p.x += ex / d * (0.7 - d); p.z += ez / d * (0.7 - d); resolveXZ(b); }
  }
  // 腳步聲
  const sp = playerSpeed();
  if (b.onGround && sp > 2.5 && !player.crouch) { player.stepT += sp * dt; if (player.stepT > 2.3) { player.stepT = 0; sfx('step', 0.8); } }
  hitBoxes(p, b.h, player.boxes);
  if (player.hurtT > 0) player.hurtT -= dt;
}

function damagePlayer(dmg, bot, part) {
  if (!player.alive) return;
  player.hp = Math.max(0, player.hp - dmg); player.hurtT = 0.35;
  sfx('hurt');
  const dx = bot.body.pos.x - player.body.pos.x, dz = bot.body.pos.z - player.body.pos.z;
  hudHurt(angDiff(player.yaw, Math.atan2(-dx, -dz)), dmg);
  if (player.hp <= 0) {
    player.alive = false; player.deaths++; player.killer = bot.name; player.respawnT = 3;
    player.ads = false; INPUT.fire = false;
    hudFeed(bot.name, '你', part === 'head', false);
    showDead(bot.name, part === 'head');
  }
}
