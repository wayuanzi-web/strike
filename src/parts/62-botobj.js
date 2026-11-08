/* ===== 62-botobj：機器人在炸彈模式的目標與戰術（M7）
   攻方每回合選一種打法：
     集合強攻：先到集合點等人，時間到或到齊一起衝；有煙擋守方、進點前丟閃光。
     快攻：不集合，一開打全速衝。
     分兩路：一半從主要集合點、一半從另一個入口（自動算出來的第二集合點），兩路都到再一起進。
     佯攻：一個人先去另一個包點露臉、丟道具，讓守方轉點，主力幾秒後打真正的包點。
     慢打：在集合點多等一陣子（守方會以為不來），時間到才進。
   帶炸彈的去裝；裝好後散開在炸彈附近，看守方會來的方向。炸彈掉了，最近的去撿。
   守方：分兩邊守 A、B；看到攻方在某個包點附近就呼叫，另一邊大部分轉過去（「守點穩」的個性不轉）。
     炸彈裝好後：還有兩人以上就先在附近集合再一起回防；只剩一人對三人以上、時間又不夠，就放棄保槍。
   個性：衝鋒（進點第一個、比較敢往前）、狙擊手（錢夠就買狙擊、站著不動打）、守點穩（不轉點、守點反應更快）、
     道具手（多買多丟投擲物）、獨行（攻方時常常一個人去另一邊）。
   你可以對隊友下指令：跟我、打 A／守 A、打 B／守 B、守這裡、自由行動。 */
function yawTo(fx, fz, tx, tz) { return Math.atan2(-(tx - fx), -(tz - fz)); }
const TRAITS = { entry: '衝鋒', sniper: '狙擊手', anchor: '守點穩', support: '道具手', lurker: '獨行' };
const TRAIT_OF = { 曉鷹: 'entry', 青嵐: 'sniper', 石竹: 'anchor', 白鷺: 'support', 鐵狼: 'entry', 赤隼: 'sniper', 灰熊: 'anchor', 夜梟: 'lurker', 黑蠍: 'support' };
const TACTICS = { exec: '集合強攻', rush: '快攻', split: '分兩路', fake: '佯攻', slow: '慢打' };
const hasTrait = (b, t) => b.trait === t;

// ---------- 第二集合點：從另一個方向接近包點、守點看不到的地方（每張地圖第一次用到時算） ----------
function stage2Of(S) {
  if (S.stage2) return S.stage2;
  const dirA = Math.atan2(S.stage[1] - S.cz, S.stage[0] - S.cx);
  let best = null, bs = -1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length || n.y > 0.1) continue;
    const d = Math.hypot(n.x - S.cx, n.z - S.cz); if (d < 12 || d > 26) continue;
    if (siteAt(n.x, 0, n.z) || n.x > 26) continue;                      // 不要在包點裡、不要太靠守方出生點
    const ang = Math.abs(angDiff(dirA, Math.atan2(n.z - S.cz, n.x - S.cx)));
    if (ang < 0.7 || Math.hypot(n.x - S.stage[0], n.z - S.stage[1]) < 10) continue;
    let seen = 0; for (const h of S.holds) if (lineClear(_v1.set(h[0], 1.6, h[1]), _v2.set(n.x, 1.5, n.z))) seen++;
    const sc = -seen * 4 + Math.min(ang, 2) * 2 - Math.abs(d - 17) * 0.2;
    if (sc > bs) { bs = sc; best = [n.x, n.z]; }
  }
  return (S.stage2 = best || S.stage);
}

// ---------- 回合開始：攻方選打法、守方分配、清掉指令 ----------
function pickTactic() {
  const w = [['exec', 3], ['rush', 1.4], ['split', 2], ['fake', 1.6], ['slow', 1.4]];
  // 剛輸的打法換掉（同一種不要連著用）
  const last = ROUND.lastTactic, tot = w.reduce((a, [k, v]) => a + (k === last ? 0 : v), 0);
  let r = Math.random() * tot; for (const [k, v] of w) { if (k === last) continue; if ((r -= v) <= 0) return k; }
  return 'exec';
}
function assignPosts() {
  ROUND.defCall = null; ROUND.callN = 0; ROUND.order = null; ROUND.retake = null;
  const def = otherTeam(ROUND.atk);
  const list = bots.filter((b) => b.active && b.team === def).sort(() => Math.random() - 0.5);
  const first = Math.random() < 0.5 ? 'A' : 'B', cnt = { A: 0, B: 0 };
  list.forEach((b, i) => { const s = i % 2 ? (first === 'A' ? 'B' : 'A') : first; b.post = s; b.holdIdx = cnt[s]++; b.rotN = -1; });
  // 攻方：打法、分組、誰佯攻
  const P = ROUND.plan, type = P.type = pickTactic(); ROUND.lastTactic = type;
  P.otherSite = P.site === 'A' ? 'B' : 'A';
  if (type === 'rush') { P.exec = true; P.execAt = 0; }
  else if (type === 'slow') P.execAt = rand(48, 62);
  else if (type === 'fake') { P.fakeAt = rand(14, 20); P.execAt = P.fakeAt + rand(6, 9); }
  const atk = bots.filter((b) => b.active && b.team === ROUND.atk);
  // 進點順序：衝鋒的人排第一
  atk.sort((a, b) => (hasTrait(b, 'entry') ? 1 : 0) - (hasTrait(a, 'entry') ? 1 : 0));
  atk.forEach((b, i) => {
    b.ofs = { x: rand(-2.5, 2.5), z: rand(-2.5, 2.5) }; b.plantIdx = (Math.random() * 3) | 0; b.postIdx = i;
    b.group = type === 'split' && i % 2 ? 2 : 1; b.role = ''; b.faked = false;
  });
  const nonCarrier = atk.filter((b) => !isCarrier(b));
  if (type === 'fake' && nonCarrier.length > 1) { const f = nonCarrier.find((b) => hasTrait(b, 'lurker')) || nonCarrier[nonCarrier.length - 1]; f.role = 'fake'; }
  else if (type !== 'rush') { const l = nonCarrier.find((b) => hasTrait(b, 'lurker')); if (l && Math.random() < 0.6 && nonCarrier.length > 2) l.role = 'lurk'; }
  if (type === 'split') stage2Of(SITES[P.site]);
  // 你在攻方：告訴你隊友打算怎麼打
  if (player.team === ROUND.atk && ROUND.num > 0) ROUND.tipPlan = `隊友打算：${TACTICS[type]} ${P.site} 點`;
}
// 守方看到攻方：在哪個包點附近就呼叫
function defenderCall(pos) {
  for (const k in SITES) {
    const s = SITES[k];
    if (Math.hypot(pos.x - s.cx, pos.z - s.cz) < 19 && (!ROUND.defCall || ROUND.defCall.site !== k)) { ROUND.defCall = { site: k, t: game.t }; ROUND.callN++; }
  }
}
function onBombPlanted() {
  ROUND.retake = null;
  for (const b of bots) if (b.active && b.alive && (b.state === 'hold' || b.state === 'patrol' || b.state === 'search')) { b.state = 'patrol'; b.path = null; b.goalTag = null; b.holdObj = false; }
}
// 每一步：攻方什麼時候開始衝、守方回防什麼時候一起進
function updatePlan() {
  const P = ROUND.plan; if (!P || ROUND.phase !== 'live') return;
  if (!P.exec) {
    const S = SITES[P.site];
    const atk = bots.filter((b) => b.active && b.alive && b.team === ROUND.atk && b.role !== 'fake' && b.role !== 'lurk');
    const nearOf = (g, pt) => atk.filter((b) => (b.group || 1) === g && Math.hypot(b.phys.pos.x - pt[0], b.phys.pos.z - pt[1]) < 9).length;
    const n1 = nearOf(1, S.stage), n2 = P.type === 'split' ? nearOf(2, stage2Of(S)) : 0;
    const g1 = atk.filter((b) => (b.group || 1) === 1).length, g2 = atk.length - g1;
    const gathered = P.type === 'split' ? (n1 >= Math.max(1, g1 - 1) && n2 >= Math.max(1, g2 - 1)) : (atk.length && n1 >= Math.max(1, atk.length - 1));
    const minT = P.type === 'slow' ? P.execAt : P.type === 'fake' ? P.execAt : 12;
    if (ROUND.liveT > (P.execAt || 30) || ROUND.t < 45 || (ROUND.liveT > minT && gathered)) {
      P.exec = true; P.execT = ROUND.liveT;
      if (player.alive && player.team === ROUND.atk) hudTip(isCarrier(player) ? `隊友衝 ${P.site} 點了：帶炸彈跟上去裝` : `隊友衝 ${P.site} 點了`, 3);
    }
  }
  if (BOMB.state === 'planted') updateRetake();
}
// 守方回防：先在離炸彈 12–18 公尺、看不到炸彈的地方集合，人到齊（或時間不夠了）再一起進
function updateRetake() {
  const def = otherTeam(ROUND.atk), alive = bots.filter((b) => b.active && b.alive && b.team === def);
  const R = ROUND.retake || (ROUND.retake = { pt: null, go: false, save: false });
  const atkAlive = aliveCount(ROUND.atk), defAlive = alive.length + (def === player.team && player.alive ? 1 : 0);
  // 保槍：只剩一人對三人以上，而且時間不太夠
  R.save = defAlive === 1 && atkAlive >= 3 && BOMB.t < 18;
  if (!R.pt) R.pt = gatherPoint(alive);
  const need = Math.min(2, alive.length);
  const near = alive.filter((b) => Math.hypot(b.phys.pos.x - R.pt[0], b.phys.pos.z - R.pt[1]) < 6).length;
  const late = BOMB.t < DEFUSE_TIME + 8;
  if (!R.go && (near >= need || late || alive.length <= 1 || atkAlive === 0)) R.go = true;
}
function gatherPoint(list) {
  const bp = BOMB.pos; let cx = 0, cz = 0; for (const b of list) { cx += b.phys.pos.x; cz += b.phys.pos.z; }
  if (list.length) { cx /= list.length; cz /= list.length; } else { cx = TEAM_SPAWN.def[0][0]; cz = TEAM_SPAWN.def[0][1]; }
  let best = null, bs = -1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - bp.x, n.z - bp.z); if (d < 11 || d > 19) continue;
    const vis = lineClear(_v1.set(n.x, n.y + 1.5, n.z), _v2.set(bp.x, bp.y + 1, bp.z));
    const sc = -Math.hypot(n.x - cx, n.z - cz) * 0.5 - (vis ? 8 : 0);
    if (sc > bs) { bs = sc; best = [n.x, n.z]; }
  }
  return best || [cx, cz];
}
// 炸彈附近的守點：5–12 公尺、看得到炸彈、不跟隊友擠在一起
function guardSpot(b) {
  const bp = BOMB.pos; let best = null, bs = -1e9;
  for (let k = 0; k < 40; k++) {
    const n = pick(NAV.nodes); if (!n.ok || !n.nb.length) continue;
    const d = Math.hypot(n.x - bp.x, n.z - bp.z); if (d < 4 || d > 13) continue;
    if (!lineClear(_v1.set(n.x, n.y + 1.5, n.z), _v2.set(bp.x, bp.y + 0.3, bp.z))) continue;
    const crowd = bots.some((o) => o !== b && o.guard && Math.hypot(o.guard[0] - n.x, o.guard[1] - n.z) < 4);
    const sc = -Math.abs(d - 8) - (crowd ? 6 : 0) + Math.random() * 2;
    if (sc > bs) { bs = sc; best = [n.x, n.z]; }
  }
  return best || [bp.x + rand(-3, 3), bp.z + rand(-3, 3)];
}
// 你的指令（只對我方機器人）：跟我、打／守某點、守這裡
function orderGoal(b) {
  const O = ROUND.order; if (!O || b.team !== player.team) return null;
  const k = bots.filter((o) => o.active && o.team === b.team).indexOf(b), ang = player.yaw + Math.PI + (k - 1.5) * 0.55, r = 2.6 + (k % 2) * 1.2;
  if (O.type === 'follow') {
    if (!player.alive) return null;
    const p = player.body.pos, x = p.x - Math.sin(ang) * r, z = p.z - Math.cos(ang) * r;
    const tag = 'follow' + Math.round(p.x / 3) + ',' + Math.round(p.z / 3);
    return { tag, x, z, y: p.y, kind: 'hold', yaw: player.yaw + (k - 1.5) * 0.6 };
  }
  if (O.type === 'hold') {
    const a = O.yaw + Math.PI + (k - 1.5) * 0.7, x = O.x - Math.sin(a) * (2 + k * 0.6), z = O.z - Math.cos(a) * (2 + k * 0.6);
    return { tag: 'ordhold', x, z, y: O.y, kind: 'hold', yaw: O.yaw + (k - 1.5) * 0.5 };
  }
  return null;     // 打／守某點：改的是 plan.site 或 post，照一般目標走
}
// 這隻機器人現在要去哪、到了做什麼（tag 改變就重新找路）
function objectiveGoal(b) {
  const atk = b.team === ROUND.atk, P = ROUND.plan || { site: 'A', exec: true }, defSp = TEAM_SPAWN.def[0];
  const og = orderGoal(b); if (og) return og;
  if (!isCarrier(b) && BOMB.state !== 'planted') { const dg = dropGoalFor(b); if (dg) return dg; }   // 沒槍：先去撿地上的
  if (BOMB.state === 'planted') {
    if (atk) {
      if (!b.guard || b.guardFor !== ROUND.num) { b.guard = guardSpot(b); b.guardFor = ROUND.num; }
      const lx = BOMB.pos.x + (defSp[0] - BOMB.pos.x) * 0.4, lz = BOMB.pos.z + (defSp[1] - BOMB.pos.z) * 0.4;
      return { tag: 'guard', x: b.guard[0], z: b.guard[1], kind: 'hold', yaw: yawTo(b.guard[0], b.guard[1], lx, lz) };
    }
    if (!ROUND.retake) updateRetake();
    const R = ROUND.retake;
    if (R && R.save) { const s = TEAM_SPAWN.def[(b.i % 4) + 1]; return { tag: 'save', x: s[0], z: s[1], kind: 'hold', yaw: yawTo(s[0], s[1], 0, 0) }; }
    if (R && !R.go && R.pt) return { tag: 'gather', x: R.pt[0] + (b.i % 3 - 1) * 1.5, z: R.pt[1] + ((b.i >> 1) % 2) * 1.5, kind: 'hold', yaw: yawTo(R.pt[0], R.pt[1], BOMB.pos.x, BOMB.pos.z) };
    return { tag: 'defuse', x: BOMB.pos.x, z: BOMB.pos.z, y: BOMB.pos.y, kind: 'defuse' };
  }
  if (atk) {
    if (BOMB.state === 'dropped') {
      const cand = bots.filter((o) => o.active && o.alive && o.team === b.team);
      let nb = null, nd = 1e9; for (const o of cand) { const d = Math.hypot(o.phys.pos.x - BOMB.pos.x, o.phys.pos.z - BOMB.pos.z); if (d < nd) { nd = d; nb = o; } }
      if (nb === b) return { tag: 'pickup', x: BOMB.pos.x, z: BOMB.pos.z, y: BOMB.pos.y, kind: 'move' };
    }
    const S = SITES[P.site], O = SITES[P.otherSite || (P.site === 'A' ? 'B' : 'A')];
    // 佯攻的人：先到另一點的集合點，時間到往那個包點裡面推、丟道具；主力衝了以後回主點
    if (b.role === 'fake' && !P.exec) {
      if (ROUND.liveT < P.fakeAt) return { tag: 'fakestage', x: O.stage[0], z: O.stage[1], kind: 'hold', yaw: yawTo(O.stage[0], O.stage[1], O.cx, O.cz) };
      const pt = O.post[0]; return { tag: 'fakepush', x: pt[0], z: pt[1], kind: 'hold', yaw: yawTo(pt[0], pt[1], defSp[0], defSp[1]) };
    }
    // 獨行：一個人守在另一點，炸彈裝好前不動
    if (b.role === 'lurk') { const h = O.stage; return { tag: 'lurk', x: h[0], z: h[1], kind: 'hold', yaw: yawTo(h[0], h[1], O.cx, O.cz) }; }
    if (!P.exec) {
      const st = (b.group || 1) === 2 ? stage2Of(S) : S.stage;
      return { tag: 'stage' + P.site + (b.group || 1), x: st[0] + (b.ofs ? b.ofs.x : 0), z: st[1] + (b.ofs ? b.ofs.z : 0), kind: 'hold', yaw: yawTo(st[0], st[1], S.cx, S.cz) };
    }
    if (isCarrier(b)) { const pp = S.plants[(b.plantIdx || 0) % S.plants.length]; return { tag: 'plant' + P.site, x: pp[0], z: pp[1], kind: 'plant' }; }
    const pt = S.post[(b.postIdx || 0) % S.post.length];
    return { tag: 'site' + P.site, x: pt[0], z: pt[1], kind: 'hold', yaw: yawTo(pt[0], pt[1], defSp[0], defSp[1]) };
  }
  // 守方：被呼叫就轉點（每次呼叫只決定一次；守點穩的不轉）
  const call = ROUND.defCall;
  if (call && game.t - call.t < 25 && call.site !== b.post && b.rotN !== ROUND.callN && !(ROUND.order && b.team === player.team)) {
    b.rotN = ROUND.callN;
    if (!hasTrait(b, 'anchor') && Math.random() < 0.85) { b.post = call.site; b.holdIdx = 3 + (b.i % 2); }
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
    b.goalTag = g.tag; b.objT = 1.5; setPath(b, g.x, g.z, g.y);
  }
  const P = ROUND.plan;
  const rush = g.kind === 'defuse' || g.kind === 'plant' || g.tag === 'pickup' || g.tag.startsWith('follow') || (b.team === ROUND.atk && P && (P.exec || P.type === 'rush'));
  const speed = (rush ? 4.7 : 3.9) * Math.min(1, b.wpn.speed || 1) * (hasTrait(b, 'entry') ? 1.05 : 1);
  if (followPath(b, speed, _wish)) { turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt); botMoveNades(b); return; }
  // 到了
  const d = Math.hypot(p.x - g.x, p.z - g.z);
  if (g.kind === 'plant') {
    if (isCarrier(b) && siteAt(p.x, p.y, p.z)) { b.state = 'plant'; b.useT = 0; return; }
    if (b.objT <= 0) { b.objT = 1.5; setPath(b, g.x, g.z); }
  } else if (g.kind === 'defuse') {
    if (d < 1.4 && Math.abs(p.y - BOMB.pos.y) < 1.2) { b.state = 'defuse'; b.useT = 0; b.useNeed = b.kit ? DEFUSE_KIT : DEFUSE_TIME; return; }
    if (b.objT <= 0) { b.objT = 1.5; if (d < 4) { b.path = [[g.x, g.z, g.y || 0]]; b.pi = 0; } else setPath(b, g.x, g.z, g.y); }
  } else if (g.kind === 'hold') {
    b.state = 'hold'; b.holdT = 999; b.holdYaw = g.yaw; b.holdCrouch = Math.random() < (hasTrait(b, 'sniper') || hasTrait(b, 'anchor') ? 0.6 : 0.35); b.holdObj = true; b.holdCheck = game.t + 0.4;
    if (g.tag === 'fakepush' && !b.faked) { b.faked = true; botFakeNoise(b); }
  } else if (b.objT <= 0) { b.objT = 1.5; b.path = [[g.x, g.z, g.y || 0]]; b.pi = 0; }
}
// 佯攻的人到了另一點：丟個道具、開兩槍讓守方以為主力在這裡
function botFakeNoise(b) {
  const O = SITES[ROUND.plan.otherSite];
  for (const t of ['flash', 'he', 'smoke']) if (b.nades[t] > 0 && botThrow(b, t, O.cx, t === 'flash' ? 2 : 0, O.cz)) break;
  botsHearShot(b.phys.pos, b.team);
  const call = { site: O.id, t: game.t };
  // 守方「聽到」：跟看到一樣呼叫（會讓另一邊的人轉過來）
  if (!ROUND.defCall || ROUND.defCall.site !== O.id) { ROUND.defCall = call; ROUND.callN++; }
}
// 進攻途中：剛開始衝的時候丟煙擋守方，快到包點時丟閃光（道具手會多丟）
function botMoveNades(b) {
  const P = ROUND.plan; if (!P || !P.exec || b.team !== ROUND.atk || BOMB.planted) return;
  if (game.t - (b.thrownAt || -9) < 1.2 || game.t < (b.nadeTry || 0)) return;
  const S = SITES[P.site], p = b.phys.pos, dc = Math.hypot(p.x - S.cx, p.z - S.cz);
  b.nadeTry = game.t + 0.6;
  if (b.nades.smoke > 0 && !b.smoked) {
    const sm = S.smokes[(b.postIdx || 0) % S.smokes.length];
    if (Math.hypot(p.x - sm[0], p.z - sm[1]) < 30 && botThrow(b, 'smoke', sm[0], 0, sm[1])) { b.smoked = true; return; }
  }
  if (b.nades.flash > 0 && (!b.flashed || hasTrait(b, 'support')) && dc > 9 && dc < 18 && game.t - (b.thrownAt || -9) > 2) {
    if (botThrow(b, 'flash', S.cx, 2, S.cz)) { b.flashed = true; return; }
  }
  // 燃燒彈：燒守方愛躲的角落，逼他出來
  if (b.nades.molotov > 0 && dc > 8 && dc < 20 && S.holds && S.holds.length) {
    const h = S.holds[(b.i || 0) % S.holds.length];
    if (botThrow(b, 'molotov', h[0], 0, h[1])) return;
  }
}
// 守點時：看到攻方在附近衝過來（隊友呼叫），有手榴彈就丟過去
function botHoldNades(b) {
  if (b.team === ROUND.atk || !(b.nades.he || b.nades.molotov) || game.t - (b.thrownAt || -9) < 5) return;
  const intel = TEAM_INTEL[b.team]; if (game.t - intel.t > 1.5) return;
  const d = Math.hypot(intel.pos.x - b.phys.pos.x, intel.pos.z - b.phys.pos.z);
  if (!(d > 8 && d < 24) || Math.random() > (hasTrait(b, 'support') ? 0.8 : 0.5)) return;
  // 燃燒彈擋攻方的路，沒有就丟手榴彈
  if (b.nades.molotov > 0 && botThrow(b, 'molotov', intel.pos.x, 0, intel.pos.z)) return;
  if (b.nades.he > 0) botThrow(b, 'he', intel.pos.x, 0, intel.pos.z);
}

// ---------- 全隊經濟：這回合全買／強起／半起／存錢 ----------
const ECO_NAME = { pistol: '手槍局', full: '全買', force: '強起', half: '半起', eco: '存錢' };
function teamEcoMode(team, pistolRound) {
  if (pistolRound) return 'pistol';
  const list = bots.filter((b) => b.active && b.team === team); if (!list.length) return 'full';
  const avg = list.reduce((a, b) => a + b.money + (b.primary ? 2900 : 0), 0) / list.length;   // 手上已經有槍的算進去
  const mine = ROUND.score[team], theirs = ROUND.score[otherTeam(team)];
  const mustWin = theirs === ROUND.winTo - 1 || ROUND.num === ROUND.half || ROUND.num === ROUND.half * 2;   // 對方賽點、半場最後一回合
  if (avg >= 4000) return 'full';
  if (mustWin && avg >= 1600) return 'force';
  if (ROUND.loss[team] >= 2 && avg >= 2600) return 'force';
  if (avg >= 2900) return 'half';
  return 'eco';
}
function botBuy(b, mode) {
  const m = () => b.money, pay = (n) => { b.money -= n; }, role = b.team === ROUND.atk ? 'atk' : 'def';
  const nades = (all) => {
    if (m() >= 300 && !b.nades.smoke && (all || Math.random() < 0.7)) { pay(300); b.nades.smoke = 1; }
    if (m() >= 200 && b.nades.flash < 2 && (all || Math.random() < 0.7)) { pay(200); b.nades.flash++; }
    if (all && m() >= 200 && b.nades.flash < 2) { pay(200); b.nades.flash++; }
    if (m() >= 300 && !b.nades.he && (all || Math.random() < 0.6)) { pay(300); b.nades.he = 1; }
  };
  const worn = () => b.vest && (b.armor ?? 100) < 60;   // 護甲被打爛了：重買
  const armor = () => { if ((!b.helmet || worn()) && m() >= 1000) { pay(b.vest && !worn() ? 350 : 1000); giveArmor(b, true); } else if ((!b.vest || worn()) && m() >= 650) { pay(650); giveArmor(b, false); } };
  b.ecoMode = mode;
  if (mode === 'pistol') {
    if (hasTrait(b, 'support')) nades(true);
    else if (Math.random() < 0.5 && m() >= 650) { pay(650); giveArmor(b, false); }
    else if (Math.random() < 0.45 && m() >= 700) { pay(700); b.secondary = WEAPONS.deagle; }
    else { if (m() >= 200) { pay(200); b.nades.flash++; } if (m() >= 300 && Math.random() < 0.5) { pay(300); b.nades.he++; } }
    return;
  }
  if (mode === 'eco') { if (hasTrait(b, 'support') && m() >= 2200) { pay(200); b.nades.flash++; } return; }
  if (!b.primary) {
    const sniperOk = !bots.some((o) => o !== b && o.active && o.team === b.team && o.primary === WEAPONS.sniper);
    if (mode === 'full' && sniperOk && m() >= 5750 && (hasTrait(b, 'sniper') || (m() >= 7000 && Math.random() < 0.15))) { pay(4750); b.primary = WEAPONS.sniper; }
    else if ((mode === 'full' && m() >= 2900) || (mode === 'force' && m() >= 2900 + 650)) {
      // 守方六成拿卡賓槍（便宜一點、比較準），攻方拿步槍
      const w = role === 'def' && Math.random() < 0.6 ? WEAPONS.carbine : WEAPONS.rifle; pay(w.price); b.primary = w;
    }
    else if (m() >= 1250) { const w = hasTrait(b, 'entry') || Math.random() < 0.3 ? WEAPONS.shotgun : WEAPONS.smg; if (m() >= w.price) { pay(w.price); b.primary = w; } }
    else if (mode === 'half' && !b.secondary && m() >= 700 && Math.random() < 0.6) { pay(700); b.secondary = WEAPONS.deagle; }
  }
  if (hasTrait(b, 'support') && mode === 'full') { armor(); nades(true); if (m() >= 500 && !b.nades.molotov) { pay(500); b.nades.molotov = 1; } }
  else { armor(); if (mode !== 'half') nades(false); else if (m() >= 200) { pay(200); b.nades.flash++; } }
  if (mode === 'full' && !b.nades.molotov && m() >= 1500 && Math.random() < (role === 'def' ? 0.25 : 0.45)) { pay(500); b.nades.molotov = 1; }
  if (role === 'def' && !b.kit && m() >= 400 && (mode === 'full' || Math.random() < 0.3)) { pay(400); b.kit = true; }
}

// ---------- 對隊友下指令（輪盤） ----------
const ORDER_TEXT = { follow: '跟我來', A: (atk) => (atk ? '打 A 點' : '守 A 點'), B: (atk) => (atk ? '打 B 點' : '守 B 點'), hold: '守這裡', free: '自由行動' };
function giveOrder(type) {
  if (game.mode !== 'match' || !player.alive) return;
  const atk = ROUND.atk === player.team, allies = bots.filter((b) => b.active && b.alive && b.team === player.team);
  if (type === 'free') ROUND.order = null;
  else if (type === 'A' || type === 'B') {
    ROUND.order = null;
    if (atk) { const P = ROUND.plan; P.site = type; P.otherSite = type === 'A' ? 'B' : 'A'; if (ROUND.phase === 'live') { P.exec = true; P.execT = ROUND.liveT; } for (const b of allies) b.role = ''; }
    else { const cnt = { A: 0, B: 0 }; for (const b of allies) { b.post = type; b.holdIdx = cnt[type]++; } }
  } else if (type === 'follow') ROUND.order = { type: 'follow', t: game.t };
  else if (type === 'hold') { const p = player.body.pos; ROUND.order = { type: 'hold', x: p.x, z: p.z, y: p.y, yaw: player.yaw, t: game.t }; }
  for (const b of allies) if (b.state === 'hold' || b.state === 'patrol' || b.state === 'search') { b.state = 'patrol'; b.path = null; b.goalTag = null; b.holdObj = false; }
  const txt = typeof ORDER_TEXT[type] === 'function' ? ORDER_TEXT[type](atk) : ORDER_TEXT[type];
  const who = allies.slice(0, 2).map((b) => b.name).join('、');
  hudTip(`你：${txt}${who ? `　${who}：收到` : ''}`, 2.2); sfx('ping');
  closeRadio();
}
function openRadio() {
  if (game.mode !== 'match' || !player.alive || game.state !== 'play') return;
  const atk = ROUND.atk === player.team;
  $('rA').textContent = ORDER_TEXT.A(atk); $('rB').textContent = ORDER_TEXT.B(atk);
  $('radio').hidden = false;
}
function closeRadio() { $('radio').hidden = true; }
for (const [id, t] of [['rFollow', 'follow'], ['rA', 'A'], ['rB', 'B'], ['rHold', 'hold'], ['rFree', 'free']]) onTap($(id), () => giveOrder(t));
onTap($('rX'), closeRadio);
