/* ===== 74-modes：更多模式——個人死鬥、搶點、練槍場
   死鬥：你和 7 個機器人互打，陣亡 2.5 秒後重生；先到 25 殺或 5 分鐘到看排名。
   搶點：4 對 4，地圖中央一個圈，只有一隊在圈裡就每秒 +1 分，先到 100 分；陣亡 4 秒後在自己出生區重生。
   練槍場：30 個靶（前 15 個不動、後 15 個左右移動），每個 4 秒內打倒；看反應時間、命中率、爆頭。 */
const MODE = { kind: '', t: 0, over: false, score: { A: 0, B: 0 }, zone: null, owner: '', rg: null };
const MODE_NAME = { dm: '個人死鬥', koth: '搶點', range: '練槍場' };
const isMode = () => game.mode === 'dm' || game.mode === 'koth' || game.mode === 'range';
const DM = { goal: 25, limit: 300 }, KOTH = { goal: 100, limit: 360, r: 5 }, RANGE = { n: 30, timeout: 4, gap: 0.55 };
for (let i = 0; i < 12; i++) TEAM_INTEL['D' + i] = { t: -99, pos: new V3() };

function startMode(kind) {
  game.mode = kind; game.lastMode = kind; MODE.kind = kind; MODE.t = 0; MODE.over = false; MODE.score = { A: 0, B: 0 }; MODE.owner = '';
  player.team = 'A'; player.kills = player.deaths = player.heads = 0; player.money = 0; gainReset();
  setupBots(kind);
  removeZone();
  if (kind === 'koth') { loadTeamSpawns(); MODE.zone = kothZone(); buildZone(); }
  // 機器人上場
  for (const b of bots) if (b.active) { b.kills = b.deaths = b.heads = 0; modeLoadout(b); modeRespawn(b, true); }
  if (kind === 'range') { startRange(); }
  else spawnPlayer(modeSpawnFor(player));
  player.kills = player.deaths = player.heads = 0;
  W.shots = W.hits = 0;
  enterPlay();
  document.body.classList.add('mode');
  hudBanner(MODE_NAME[kind], kind === 'dm' ? `先到 ${DM.goal} 殺，人人都是敵人` : kind === 'koth' ? `站進中央的圈圈搶分，先到 ${KOTH.goal} 分` : `${RANGE.n} 個靶，越快打倒越好`, 3);
}
// 死鬥機器人每條命隨機拿一把主武器
function modeLoadout(b) {
  if (game.mode === 'dm') {
    const r = Math.random(); b.primary = r < 0.38 ? WEAPONS.rifle : r < 0.62 ? WEAPONS.carbine : r < 0.78 ? WEAPONS.smg : r < 0.9 ? WEAPONS.shotgun : WEAPONS.sniper;
    b.secondary = Math.random() < 0.3 ? WEAPONS.deagle : null; botArm(b);
  }
}
// 重生位置：搶點回自己出生區；死鬥挑離大家遠、沒人看得到的路點
function modeSpawnFor(u) {
  if (game.mode === 'koth') { const list = TEAM_SPAWN[u.team === 'A' ? 'atk' : 'def']; return list[(u === player ? 0 : (u.i % (list.length - 1)) + 1)] || list[0]; }
  if (game.mode === 'dm' || game.mode === 'duel') {
    let best = null, bs = -1e9;
    for (let k = 0; k < 40; k++) {
      const n = pick(NAV.nodes); if (!n.ok || !n.nb.length || n.up) continue;
      let d = 60, seen = false;
      for (const o of [player].concat(bots)) {
        if (o === u || !o.alive || (o !== player && !o.active)) continue;
        const op = o.body.pos; d = Math.min(d, Math.hypot(op.x - n.x, op.z - n.z));
        if (!seen && d < 40 && lineClear(_v1.set(op.x, op.y + 1.6, op.z), _v2.set(n.x, 1.5, n.z))) seen = true;
      }
      const sc = Math.min(d, 30) - (seen ? 40 : 0) + Math.random() * 4;
      if (sc > bs) { bs = sc; best = [n.x, n.z]; }
    }
    return best;
  }
  return undefined;
}
function modeRespawn(b, first) {
  if (game.mode !== 'dm' && game.mode !== 'koth') return false;
  if (!first) modeLoadout(b);
  const s = modeSpawnFor(b) || BOT_SPAWNS[0];
  const z = MODE.zone; botSpawn(b, s[0], s[1], z ? z.x : 0, z ? z.z : 0);
  return true;
}
const modeRespawnTime = () => (game.mode === 'dm' ? 2.5 : game.mode === 'koth' ? 4 : game.mode === 'practice' ? 4.5 : Infinity);

// ---------- 搶點：圈圈 ----------
let zoneMesh = null;
function kothZone() {
  if (MAP.koth) return { x: MAP.koth[0], z: MAP.koth[1], y: 0 };
  const a = MAP.spawn.atk[0], d = MAP.spawn.def[0], mx = (a[0] + d[0]) / 2, mz = (a[1] + d[1]) / 2;
  let best = null, bd = 1e9;
  for (const n of NAV.nodes) { if (!n.ok || n.up || n.nb.length < 3) continue; const k = Math.hypot(n.x - mx, n.z - mz); if (k < bd) { bd = k; best = n; } }
  return best ? { x: best.x, z: best.z, y: 0 } : { x: 0, z: 0, y: 0 };
}
function buildZone() {
  const g = new THREE.RingGeometry(KOTH.r - 0.35, KOTH.r, 48); g.rotateX(-Math.PI / 2);
  zoneMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#f3ece0', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(KOTH.r - 0.35, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f3ece0', transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
  zoneMesh.add(fill); zoneMesh.position.set(MODE.zone.x, MODE.zone.y + 0.04, MODE.zone.z); scene.add(zoneMesh);
}
function removeZone() { if (zoneMesh) { scene.remove(zoneMesh); zoneMesh.geometry.dispose(); zoneMesh = null; } MODE.zone = null; }
const inZone = (u) => MODE.zone && u.alive && Math.abs(u.body.pos.y - MODE.zone.y) < 2.5 && Math.hypot(u.body.pos.x - MODE.zone.x, u.body.pos.z - MODE.zone.z) < KOTH.r;
function zoneCount() {
  const c = { A: 0, B: 0 };
  for (const u of [player].concat(bots.filter((b) => b.active))) if (inZone(u)) c[u.team]++;
  return c;
}
// 搶點的機器人：往圈裡走，到了守一下（面向敵方出生區）
function kothObjective(b, dt) {
  const z = MODE.zone; if (!z) return;
  const p = b.phys.pos, inside = Math.hypot(p.x - z.x, p.z - z.z) < KOTH.r - 1;
  if (inside && !b.path) {
    const es = TEAM_SPAWN[b.team === 'A' ? 'def' : 'atk'][0];
    b.state = 'hold'; b.holdT = rand(4, 9); b.holdObj = false; b.holdCrouch = Math.random() < 0.35;
    b.holdYaw = Math.atan2(-(es[0] - p.x), -(es[1] - p.z)) + rand(-0.8, 0.8); return;
  }
  if (!b.path || b.goalTag !== 'zone') {
    b.goalTag = 'zone'; const a = Math.random() * 6.283, r = Math.random() * (KOTH.r - 1.5);
    setPath(b, z.x + Math.cos(a) * r, z.z + Math.sin(a) * r, z.y);
  }
  if (!followPath(b, 3.4, _wish)) b.path = null;
  else turnTo(b, Math.atan2(-_wish.x, -_wish.z), 6, dt);
}

// ---------- 練槍場 ----------
function startRange() {
  // 挑一個看得到最多路點的出生點，靶都出現在前方 ±55 度、8–35 公尺
  let best = null, bs = -1;
  for (const s of PLAYER_SPAWNS.concat(MAP.spawn.atk, MAP.spawn.def)) {
    const eye = _v1.set(s[0], 1.62, s[1]), vis = [];
    for (const n of NAV.nodes) { if (!n.ok || n.up) continue; const d = Math.hypot(n.x - s[0], n.z - s[1]); if (d < 8 || d > 35) continue; if (lineClear(eye, _v2.set(n.x, 1.2, n.z))) vis.push(n); }
    if (vis.length > bs) { bs = vis.length; best = { s, vis }; }
  }
  const s = best.s; let ax = 0, az = 0; for (const n of best.vis) { ax += n.x - s[0]; az += n.z - s[1]; }
  const face = Math.atan2(-ax, -az);
  const pts = best.vis.filter((n) => Math.abs(angDiff(face, Math.atan2(-(n.x - s[0]), -(n.z - s[1])))) < 55 * DEG);
  MODE.rg = { at: s, face, pts: pts.length >= 6 ? pts : best.vis, i: 0, wait: 1.5, cur: null, appearT: 0, times: [], miss: 0, heads0: 0, moving: false, phase: 0, base: null, dir: null };
  spawnPlayer(s); player.yaw = face; player.pitch = 0;
  if (!INV.primary) INV.primary = newItem(WEAPONS.rifle);
}
function rangeNext() {
  const R = MODE.rg; R.i++; R.cur = null;
  if (R.i > RANGE.n) { endMode(); return; }
  const n = pick(R.pts), b = bots.find((x) => !x.alive && x.team === 'B') || bots[8];
  b.active = true; botSpawn(b, n.x, n.z, player.body.pos.x, player.body.pos.z); b.dummy = true; b.hp = 1; b.vest = b.helmet = false; b.armor = 0; b.respawnT = Infinity;
  R.cur = b; R.appearT = game.t; R.moving = R.i > RANGE.n / 2; R.phase = Math.random() * 6.283;
  R.base = new V3(n.x, 0, n.z);
  const tx = n.x - player.body.pos.x, tz = n.z - player.body.pos.z, tl = Math.hypot(tx, tz) || 1; R.dir = [-tz / tl, tx / tl];   // 跟你視線垂直的方向
  sfx('ping', 0.4);
}
function updateRange(dt) {
  const R = MODE.rg; if (!R) return;
  W.reserve = WP.reserve; player.hp = 100;     // 練槍場：子彈無限、不會死
  if (!R.cur) { R.wait -= dt; if (R.wait <= 0) rangeNext(); return; }
  const b = R.cur;
  if (!b.alive) { R.times.push(game.t - R.appearT); R.cur = null; R.wait = RANGE.gap; return; }
  if (game.t - R.appearT > RANGE.timeout) { R.miss++; b.alive = false; b.active = false; b.g.visible = false; R.cur = null; R.wait = RANGE.gap; hudTip('太慢了', 0.6); return; }
  if (R.moving) {   // 左右來回走（每秒約 2.4 公尺），走的時候不能卡進牆：撞到就回頭
    R.phase += dt * 1.1;
    const off = Math.sin(R.phase) * 2.6, x = R.base.x + R.dir[0] * off, z = R.base.z + R.dir[1] * off;
    if (cylinderFree(x, z, 0.35, 0.05, 1.8)) { b.phys.pos.x = x; b.phys.pos.z = z; } else R.phase += Math.PI;
    b.phys.vel.set(0, 0, 0);
  }
}
function rangeResult() {
  const R = MODE.rg, t = R.times, avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
  return { hit: t.length, miss: R.miss, avgMs: Math.round(avg * 1000), bestMs: t.length ? Math.round(Math.min(...t) * 1000) : 0, acc: W.shots ? W.hits / W.shots : 0, heads: player.heads };
}

// ---------- 每格更新、結束 ----------
function updateMode(dt) {
  if (!isMode() || MODE.over || game.state !== 'play') return;
  MODE.t += dt;
  if (game.mode === 'dm') {
    const lead = Math.max(player.kills, ...bots.filter((b) => b.active).map((b) => b.kills));
    if (lead >= DM.goal || MODE.t >= DM.limit) endMode();
  } else if (game.mode === 'koth') {
    const c = zoneCount(), own = c.A && !c.B ? 'A' : c.B && !c.A ? 'B' : c.A && c.B ? 'X' : '';
    if (own === 'A' || own === 'B') MODE.score[own] = Math.min(KOTH.goal, MODE.score[own] + dt);
    if (own !== MODE.owner) {
      MODE.owner = own;
      if (zoneMesh) { const col = own === 'A' ? '#5fd8e6' : own === 'B' ? '#ff8a6a' : own === 'X' ? '#ffd06a' : '#f3ece0'; zoneMesh.material.color.set(col); zoneMesh.children[0].material.color.set(col); }
      if (own === 'A' || own === 'B') sfx(own === player.team ? 'go' : 'ping', 0.5);
    }
    if (MODE.score.A >= KOTH.goal || MODE.score.B >= KOTH.goal || MODE.t >= KOTH.limit) endMode();
  } else if (game.mode === 'range') updateRange(dt);
}
const dmRanking = () => [{ name: '你', kills: player.kills, deaths: player.deaths, heads: player.heads, me: true }].concat(bots.filter((b) => b.active)).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
function endMode() {
  MODE.over = true; game.state = 'over';
  const kind = game.mode, ov = (id, t) => { $(id).textContent = t; };
  let win = false;
  if (kind === 'dm') {
    const rk = dmRanking(), me = rk.findIndex((u) => u.me) + 1; win = me === 1;
    $('overT').textContent = win ? '第一名' : `第 ${me} 名`; $('overT').className = win ? 'win' : 'lose';
    ov('overS', `${player.kills} 殺`); ov('overM', `最多擊殺：${rk[0].name}（${rk[0].kills} 殺）`);
    ov('overY', `你：${player.kills} 殺 · ${player.deaths} 死 · ${player.heads} 爆頭 · 命中率 ${pct(W.hits, W.shots)}`);
  } else if (kind === 'koth') {
    const a = Math.floor(MODE.score.A), b = Math.floor(MODE.score.B); win = a > b;
    $('overT').textContent = win ? '勝利' : a === b ? '平手' : '落敗'; $('overT').className = win ? 'win' : 'lose';
    ov('overS', `${a} : ${b}`); ov('overM', `圈內佔領時間：我方 ${a} 秒、敵方 ${b} 秒`);
    ov('overY', `你：${player.kills} 殺 · ${player.deaths} 死 · ${player.heads} 爆頭`);
  } else {
    const r = rangeResult(); win = true;
    $('overT').textContent = '練槍結果'; $('overT').className = 'win';
    ov('overS', `${r.avgMs} 毫秒`); ov('overM', `平均反應時間（最快 ${r.bestMs} 毫秒）`);
    ov('overY', `打倒 ${r.hit}／${RANGE.n}・漏掉 ${r.miss}・命中率 ${Math.round(r.acc * 100)}%・爆頭 ${r.heads}`);
    MODE.result = r;
  }
  statModeEnd(kind, win, kind === 'range' ? MODE.result : null);
  const M = STATS.modes[kind];
  ov('overC', kind === 'range' ? `練槍場紀錄：最快平均 ${M.bestMs || '—'} 毫秒、最高命中率 ${M.bestAcc ? Math.round(M.bestAcc * 100) + '%' : '—'}（${M.n} 次）`
    : `${MODE_NAME[kind]}：${M.n} 場 ${M.w} 勝`);
  overXpLine();
  $('over').hidden = false; $('touch').hidden = true; resetTouchState(); closeBuy();
  if (pointerLocked()) document.exitPointerLock();
  for (const b of bots) if (b.dummy) { b.alive = false; b.g.visible = false; }
}
function leaveMode() {
  removeZone(); MODE.rg = null; MODE.kind = ''; document.body.classList.remove('mode');
  for (const b of bots) { b.dummy = false; if (b.remote) { b.remote = false; b.name = b.baseName || b.name; } }
  if (typeof NET !== 'undefined') { NET.on = false; NET.remote = null; }
}

// ---------- 上方的分數列（借用對戰的版面）、死鬥的記分板 ----------
function modeHud() {
  $('mtop').hidden = false; $('ptop').hidden = true; $('bBoard').hidden = game.mode !== 'dm'; $('spec').hidden = true;
  $('pipsA').textContent = ''; $('pipsB').textContent = '';
  if (game.mode === 'dm') {
    const rk = dmRanking(), me = rk.findIndex((u) => u.me) + 1, top = rk[0].me ? rk[1] : rk[0];
    $('scA').textContent = player.kills; $('scB').textContent = top ? top.kills : 0;
    $('clk').textContent = fmtClock(Math.max(0, DM.limit - MODE.t)); $('clk').className = DM.limit - MODE.t < 30 ? 'low' : '';
    $('rnd').textContent = `你第 ${me} 名・對手最高 ${top ? top.name : ''}・先到 ${DM.goal}`;
    const show = $('bBoard').classList.contains('on'); $('board').hidden = !show; if (show) drawBoardFFA(rk);
  } else if (game.mode === 'koth') {
    $('scA').textContent = Math.floor(MODE.score.A); $('scB').textContent = Math.floor(MODE.score.B);
    $('clk').textContent = fmtClock(Math.max(0, KOTH.limit - MODE.t)); $('clk').className = '';
    const o = MODE.owner; $('rnd').textContent = o === 'A' ? '我方佔領中' : o === 'B' ? '敵方佔領中' : o === 'X' ? '爭奪中' : '沒人佔領'; $('board').hidden = true;
  } else {
    const R = MODE.rg, r = R ? rangeResult() : null;
    $('scA').textContent = r ? r.hit : 0; $('scB').textContent = r ? r.miss : 0;
    $('clk').textContent = `${Math.min(RANGE.n, R ? Math.max(1, R.i) : 1)}/${RANGE.n}`; $('clk').className = '';
    $('rnd').textContent = r && r.hit ? `平均 ${r.avgMs} 毫秒・命中率 ${Math.round(r.acc * 100)}%` : '打倒得越快越好'; $('board').hidden = true;
  }
}
function drawBoardFFA(rk) {
  const rows = rk.map((u, i) => `<tr class="${u.me ? 'A me' : 'B'}"><td>${i + 1}. ${u.name}</td><td class="n">${u.kills}</td><td class="n">${u.deaths}</td><td class="n">${u.heads || 0}</td></tr>`).join('');
  $('board').innerHTML = `<table><tr><th>個人死鬥</th><th>殺</th><th>死</th><th>爆頭</th></tr>${rows}</table>`;
}
onTap($('bDM'), () => startGame('dm'));
onTap($('bKoth'), () => startGame('koth'));
onTap($('bRange'), () => startGame('range'));
