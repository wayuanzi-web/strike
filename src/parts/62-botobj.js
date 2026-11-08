/* ===== 62-botobj：機器人在炸彈模式的目標——
   攻方：先到集合點等隊友（守方向的那個包點），時間到或人到齊就一起衝；有煙丟煙擋守方視線、快進包點時丟閃光；帶炸彈的去裝彈；
         裝好後散開在炸彈附近看著守方會來的方向。炸彈掉了，最近的去撿。
   守方：分兩邊守 A、B，各自站在掩體邊看入口；看到攻方在某個包點附近就呼叫，另一邊有一半的人轉過去；
         炸彈裝好後全部回去拆。 */
function yawTo(fx, fz, tx, tz) { return Math.atan2(-(tx - fx), -(tz - fz)); }
// 守方分配：輪流分到 A、B，每人站不同的守點
function assignPosts() {
  ROUND.defCall = null; ROUND.callN = 0;
  const def = otherTeam(ROUND.atk);
  const list = bots.filter((b) => b.active && b.team === def).sort(() => Math.random() - 0.5);
  const first = Math.random() < 0.5 ? 'A' : 'B', cnt = { A: 0, B: 0 };
  list.forEach((b, i) => { const s = i % 2 ? (first === 'A' ? 'B' : 'A') : first; b.post = s; b.holdIdx = cnt[s]++; b.rotN = -1; });
  // 攻方：每個人在集合點附近的位置錯開、裝彈點隨機
  bots.filter((b) => b.active && b.team === ROUND.atk).forEach((b, i) => { b.ofs = { x: rand(-2.5, 2.5), z: rand(-2.5, 2.5) }; b.plantIdx = (Math.random() * 3) | 0; b.postIdx = i; });
}
// 守方看到攻方：在哪個包點附近就呼叫
function defenderCall(pos) {
  for (const k in SITES) {
    const s = SITES[k];
    if (Math.hypot(pos.x - s.cx, pos.z - s.cz) < 19 && (!ROUND.defCall || ROUND.defCall.site !== k)) { ROUND.defCall = { site: k, t: game.t }; ROUND.callN++; }
  }
}
function onBombPlanted() {
  for (const b of bots) if (b.active && b.alive && (b.state === 'hold' || b.state === 'patrol' || b.state === 'search')) { b.state = 'patrol'; b.path = null; b.goalTag = null; b.holdObj = false; }
}
// 攻方什麼時候開始衝：時間到、剩下時間不多、或大部分人到了集合點
function updatePlan() {
  const P = ROUND.plan; if (!P || P.exec || ROUND.phase !== 'live') return;
  const S = SITES[P.site];
  const atk = bots.filter((b) => b.active && b.alive && b.team === ROUND.atk);
  const near = atk.filter((b) => Math.hypot(b.phys.pos.x - S.stage[0], b.phys.pos.z - S.stage[1]) < 9).length;
  if (ROUND.liveT > P.execAt || ROUND.t < 50 || (ROUND.liveT > 12 && atk.length && near >= Math.max(1, atk.length - 1))) {
    P.exec = true; P.execT = ROUND.liveT;
    if (player.alive && player.team === ROUND.atk) hudTip(isCarrier(player) ? `隊友衝 ${P.site} 點了：帶炸彈跟上去裝` : `隊友衝 ${P.site} 點了`, 3);
  }
}
// 炸彈附近的守點：5–12 公尺、看得到炸彈、不跟隊友擠在一起
function guardSpot(b) {
  const bp = BOMB.pos; let best = null, bs = -1e9;
  for (let k = 0; k < 40; k++) {
    const n = pick(NAV.nodes); if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - bp.x, n.z - bp.z); if (d < 4 || d > 13) continue;
    if (!lineClear(_v1.set(n.x, 1.5, n.z), _v2.set(bp.x, bp.y + 0.3, bp.z))) continue;
    const crowd = bots.some((o) => o !== b && o.guard && Math.hypot(o.guard[0] - n.x, o.guard[1] - n.z) < 4);
    const sc = -Math.abs(d - 8) - (crowd ? 6 : 0) + Math.random() * 2;
    if (sc > bs) { bs = sc; best = [n.x, n.z]; }
  }
  return best || [bp.x + rand(-3, 3), bp.z + rand(-3, 3)];
}
// 這隻機器人現在要去哪、到了做什麼（tag 改變就重新找路）
function objectiveGoal(b) {
  const atk = b.team === ROUND.atk, P = ROUND.plan || { site: 'A', exec: true }, p = b.phys.pos;
  const defSp = TEAM_SPAWN.def[0];
  if (BOMB.state === 'planted') {
    if (atk) {
      if (!b.guard || b.guardFor !== ROUND.num) { b.guard = guardSpot(b); b.guardFor = ROUND.num; }
      const lx = BOMB.pos.x + (defSp[0] - BOMB.pos.x) * 0.4, lz = BOMB.pos.z + (defSp[1] - BOMB.pos.z) * 0.4;
      return { tag: 'guard', x: b.guard[0], z: b.guard[1], kind: 'hold', yaw: yawTo(b.guard[0], b.guard[1], lx, lz) };
    }
    return { tag: 'defuse', x: BOMB.pos.x, z: BOMB.pos.z, kind: 'defuse' };
  }
  if (atk) {
    if (BOMB.state === 'dropped') {
      const cand = bots.filter((o) => o.active && o.alive && o.team === b.team);
      let nb = null, nd = 1e9; for (const o of cand) { const d = Math.hypot(o.phys.pos.x - BOMB.pos.x, o.phys.pos.z - BOMB.pos.z); if (d < nd) { nd = d; nb = o; } }
      if (nb === b) return { tag: 'pickup', x: BOMB.pos.x, z: BOMB.pos.z, kind: 'move' };
    }
    const S = SITES[P.site];
    if (!P.exec) return { tag: 'stage' + P.site, x: S.stage[0] + (b.ofs ? b.ofs.x : 0), z: S.stage[1] + (b.ofs ? b.ofs.z : 0), kind: 'hold', yaw: yawTo(S.stage[0], S.stage[1], S.cx, S.cz) };
    if (isCarrier(b)) { const pp = S.plants[(b.plantIdx || 0) % S.plants.length]; return { tag: 'plant' + P.site, x: pp[0], z: pp[1], kind: 'plant' }; }
    const pt = S.post[(b.postIdx || 0) % S.post.length];
    return { tag: 'site' + P.site, x: pt[0], z: pt[1], kind: 'hold', yaw: yawTo(pt[0], pt[1], defSp[0], defSp[1]) };
  }
  // 守方：被呼叫就有一半機率轉點（每次呼叫只決定一次）
  const call = ROUND.defCall;
  if (call && game.t - call.t < 25 && call.site !== b.post && b.rotN !== ROUND.callN) {
    b.rotN = ROUND.callN;
    if (Math.random() < 0.7) { b.post = call.site; b.holdIdx = 3 + (b.i % 2); }
  }
  const S = SITES[b.post || 'A'], h = S.holds[(b.holdIdx || 0) % S.holds.length];
  return { tag: 'post' + (b.post || 'A') + (b.holdIdx || 0), x: h[0], z: h[1], kind: 'hold', yaw: yawTo(h[0], h[1], h[2], h[3]) };
}
// 巡邏狀態在對戰時改成跑目標
function botObjective(b, dt) {
  if (ROUND.phase !== 'live') { b.yaw += Math.sin(game.t + b.i) * dt * 0.3; return; }
  const g = objectiveGoal(b), p = b.phys.pos;
  b.objT -= dt;
  if (b.goalTag !== g.tag || (!b.path && b.objT <= 0)) {
    b.goalTag = g.tag; b.objT = 1.5; setPath(b, g.x, g.z);
  }
  const rush = g.kind === 'defuse' || g.kind === 'plant' || g.tag === 'pickup' || (b.team === ROUND.atk && ROUND.plan && ROUND.plan.exec);
  const speed = (rush ? 4.7 : 3.9) * Math.min(1, b.wpn.speed || 1);
  if (followPath(b, speed, _wish)) { turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt); botMoveNades(b); return; }
  // 到了
  const d = Math.hypot(p.x - g.x, p.z - g.z);
  if (g.kind === 'plant') {
    if (isCarrier(b) && siteAt(p.x, p.y, p.z)) { b.state = 'plant'; b.useT = 0; return; }
    if (b.objT <= 0) { b.objT = 1.5; setPath(b, g.x, g.z); }
  } else if (g.kind === 'defuse') {
    if (d < 1.4) { b.state = 'defuse'; b.useT = 0; b.useNeed = b.kit ? DEFUSE_KIT : DEFUSE_TIME; return; }
    if (b.objT <= 0) { b.objT = 1.5; b.path = [[g.x, g.z]]; b.pi = 0; }     // 最後一段直接走過去
  } else if (g.kind === 'hold') {
    b.state = 'hold'; b.holdT = 999; b.holdYaw = g.yaw; b.holdCrouch = Math.random() < 0.35; b.holdObj = true; b.holdCheck = game.t + 0.4;
  } else if (b.objT <= 0) { b.objT = 1.5; b.path = [[g.x, g.z]]; b.pi = 0; }
}
// 進攻途中：剛開始衝的時候丟煙擋守方，快到包點時丟閃光
function botMoveNades(b) {
  const P = ROUND.plan; if (!P || !P.exec || b.team !== ROUND.atk || BOMB.planted) return;
  if (game.t - (b.thrownAt || -9) < 1.2 || game.t < (b.nadeTry || 0)) return;
  const S = SITES[P.site], p = b.phys.pos, dc = Math.hypot(p.x - S.cx, p.z - S.cz);
  b.nadeTry = game.t + 0.6;
  if (b.nades.smoke > 0 && !b.smoked) {
    const sm = S.smokes[(b.postIdx || 0) % S.smokes.length];
    if (Math.hypot(p.x - sm[0], p.z - sm[1]) < 30 && botThrow(b, 'smoke', sm[0], 0, sm[1])) { b.smoked = true; return; }
  }
  if (b.nades.flash > 0 && !b.flashed && dc > 9 && dc < 18) {
    if (botThrow(b, 'flash', S.cx, 2, S.cz)) { b.flashed = true; return; }
  }
}
// 守點時：看到攻方在附近衝過來（隊友呼叫），有手榴彈就丟過去
function botHoldNades(b) {
  if (b.team === ROUND.atk || !b.nades.he || game.t - (b.thrownAt || -9) < 5) return;
  const intel = TEAM_INTEL[b.team]; if (game.t - intel.t > 1.5) return;
  const d = Math.hypot(intel.pos.x - b.phys.pos.x, intel.pos.z - b.phys.pos.z);
  if (d > 8 && d < 24 && Math.random() < 0.5) botThrow(b, 'he', intel.pos.x, 0, intel.pos.z);
}
