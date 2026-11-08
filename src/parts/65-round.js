/* ===== 65-round：對戰模式（炸彈模式）——5 對 5、一條命一回合、準備時間買東西、回合計時、先贏 7 回合；第 6 回合後換邊
   攻方：把炸彈裝在 A 或 B 點並守到爆炸，或殺光守方。守方：時間到前沒被裝彈、拆掉炸彈，或在裝彈前殺光攻方。 */
const TEAM_SPAWN = { atk: [], def: [] };
function loadTeamSpawns() { TEAM_SPAWN.atk = MAP.spawn.atk.slice(); TEAM_SPAWN.def = MAP.spawn.def.slice(); }
loadTeamSpawns();
const ROUND = { phase: 'none', t: 0, num: 0, score: { A: 0, B: 0 }, winTo: 7, half: 6, freeze: 8, length: 115, endT: 0, over: false, history: [],
  atk: 'A', loss: { A: 0, B: 0 }, liveT: 0, plan: null, swapped: false, log: [] };
const otherTeam = (t) => (t === 'A' ? 'B' : 'A');
function roundFrozen() { return game.mode === 'match' && ROUND.phase === 'freeze'; }
function aliveCount(team) {
  let n = team === 'A' && player.alive ? 1 : 0;
  for (const b of bots) if (b.active && b.alive && b.team === team) n++;
  return n;
}
function teamHp(team) {
  let h = team === 'A' && player.alive ? player.hp : 0;
  for (const b of bots) if (b.active && b.alive && b.team === team) h += b.hp;
  return h;
}
const matchUnits = () => [player].concat(bots.filter((b) => b.active));
function resetBotGear(b) { b.primary = null; b.vest = b.helmet = b.kit = false; b.nades = { he: 0, flash: 0, smoke: 0 }; }
function startMatch() {
  game.mode = 'match'; setupBots('match');
  ROUND.score = { A: 0, B: 0 }; ROUND.num = 0; ROUND.over = false; ROUND.history = []; ROUND.atk = 'A'; ROUND.loss = { A: 0, B: 0 }; ROUND.swapped = false; ROUND.log = [];
  player.kills = player.deaths = player.heads = 0; player.deathStreak = 0;
  for (const u of matchUnits()) { u.money = ECON.start; u.keep = false; if (u !== player) resetBotGear(u); }
  player.alive = false;
  startRound();
}
function swapSides() {
  ROUND.atk = otherTeam(ROUND.atk); ROUND.loss = { A: 0, B: 0 }; ROUND.swapped = true;
  for (const u of matchUnits()) { u.money = ECON.start; u.keep = false; if (u !== player) resetBotGear(u); }
}
function startRound() {
  // 上回合活下來的人保留裝備
  for (const u of matchUnits()) u.keep = !!u.alive && ROUND.num > 0;
  let halftime = false;
  if (ROUND.num === ROUND.half) { swapSides(); halftime = true; }
  ROUND.num++; ROUND.phase = 'freeze'; ROUND.t = ROUND.freeze; ROUND.liveT = 0;
  SHOOT_TOKENS.clear(); TEAM_INTEL.A.t = TEAM_INTEL.B.t = -99;
  clearNades(); resetBomb();
  const sideOf = (team) => (team === ROUND.atk ? TEAM_SPAWN.atk : TEAM_SPAWN.def);
  const face = (team) => (team === ROUND.atk ? 30 : -30);
  const pistolRound = ROUND.num === 1 || ROUND.num === ROUND.half + 1;
  for (const team of ['A', 'B']) {
    const list = bots.filter((b) => b.active && b.team === team), sp = sideOf(team), off = team === 'A' ? 1 : 0;
    const avg = list.reduce((a, b) => a + b.money, 0) / Math.max(1, list.length);   // 機器人自己的平均錢（不算你）
    list.forEach((b, i) => {
      const s = sp[i + off]; botSpawn(b, s[0], s[1], face(team), s[1]);
      if (!b.keep) resetBotGear(b);
      botBuy(b, avg, pistolRound);
      botArm(b);
    });
  }
  resetTouchState();
  spawnPlayer(sideOf('A')[0], player.keep); player.spawnT = 0;
  player.yaw = ROUND.atk === 'A' ? -Math.PI / 2 : Math.PI / 2;
  game.spec = 0; $('dead').hidden = true;
  // 炸彈：隨機給一個攻方
  ROUND.plan = { site: Math.random() < 0.5 ? 'A' : 'B', exec: false, execAt: rand(22, 34) };
  giveBomb(pick(matchUnits().filter((u) => u.team === ROUND.atk)));
  assignPosts();
  const last = ROUND.score.A + ROUND.score.B + 1 === ROUND.winTo * 2 - 1;
  const role = ROUND.atk === player.team ? '你們是攻方：把炸彈裝在 A 或 B 點' : '你們是守方：守住 A、B 兩個包點';
  hudBanner(halftime ? '換邊' : `第 ${ROUND.num} 回合`, (ROUND.num === 1 ? `「${MAP.name}」　` : '') + (last ? '決勝回合　' + role : role), 3);
  if (player.alive) openBuy();
}
// 有人陣亡：掉炸彈、檢查勝負（炸彈裝好之後，攻方全滅也要等守方拆掉才算贏）
function onUnitDied(u) {
  if (game.mode !== 'match') return;
  dropBomb(u);
  if (ROUND.phase !== 'live') return;
  const atk = ROUND.atk, def = otherTeam(atk);
  if (aliveCount(def) === 0) endRound(atk, '守方全滅', 'elim');
  else if (aliveCount(atk) === 0 && !BOMB.planted) endRound(def, '攻方全滅', 'elim');
}
function endRound(winner, reason, kind = 'elim') {
  if (ROUND.phase !== 'live' && ROUND.phase !== 'freeze') return;
  ROUND.phase = 'end'; ROUND.endT = 5;
  const loser = otherTeam(winner);
  ROUND.score[winner]++;
  ROUND.history.push(winner);
  ROUND.log.push({ n: ROUND.num, w: winner, kind, atk: ROUND.atk, site: BOMB.site, planted: BOMB.planted, t: +ROUND.liveT.toFixed(1) });
  ROUND.over = ROUND.score.A >= ROUND.winTo || ROUND.score.B >= ROUND.winTo;
  // 經濟：勝方每人 3250（炸掉、拆掉 3500）；敗方連敗補助；攻方裝了彈但輸了每人 +800
  const winPay = kind === 'bomb' || kind === 'defuse' ? ECON.winBomb : ECON.win;
  const losePay = ECON.loss[Math.min(ROUND.loss[loser], ECON.loss.length - 1)] + (loser === ROUND.atk && BOMB.planted ? ECON.plantBonus : 0);
  ROUND.loss[loser]++; ROUND.loss[winner] = Math.max(0, ROUND.loss[winner] - 1);
  for (const u of matchUnits()) addMoney(u, u.team === winner ? winPay : losePay, u.team === winner ? '回合勝利' : '回合補助');
  const title = winner === player.team ? '我方獲勝' : '敵方獲勝';
  const halfNote = ROUND.num === ROUND.half && !ROUND.over ? '　下回合換邊' : '';
  hudBanner(title, reason + `　${ROUND.score.A} : ${ROUND.score.B}` + halfNote, 4.5, winner === player.team ? 'win' : 'lose');
  sfx(winner === player.team ? 'win' : 'lose');
  closeBuy();
}
function updateRound(dt) {
  if (game.mode !== 'match') return;
  if (ROUND.phase === 'freeze') {
    ROUND.t -= dt;
    if (ROUND.t <= 0) { ROUND.phase = 'live'; ROUND.t = ROUND.length; hudBanner('開始！', '', 1.2); sfx('go'); closeBuy(); }
  } else if (ROUND.phase === 'live') {
    ROUND.liveT += dt;
    if (!BOMB.planted) {
      ROUND.t -= dt;
      if (ROUND.t <= 0) endRound(otherTeam(ROUND.atk), '時間到，沒有裝彈', 'time');
    }
  } else if (ROUND.phase === 'end') {
    ROUND.endT -= dt;
    if (ROUND.endT <= 0) { if (ROUND.over) showMatchOver(); else startRound(); }
  }
  updateBomb(dt);
  if (!buyEl.hidden && !buyOpen()) closeBuy();
}
// 陣亡後觀戰：鏡頭跟著還活著的隊友，點右半邊（或滑鼠點）換人
function spectateTarget() {
  const al = bots.filter((b) => b.active && b.alive && b.team === 'A');
  if (!al.length) return null;
  game.spec = ((game.spec % al.length) + al.length) % al.length;
  return al[game.spec];
}
function nextSpectate() { game.spec = (game.spec || 0) + 1; }
function showMatchOver() {
  ROUND.phase = 'over'; game.state = 'over';
  const win = ROUND.score.A > ROUND.score.B;
  const all = [{ name: '你', team: 'A', kills: player.kills, deaths: player.deaths, heads: player.heads, me: true }].concat(bots.filter((b) => b.active));
  const mvp = all.filter((u) => u.team === (win ? 'A' : 'B')).sort((a, b) => (b.kills - b.deaths * 0.3) - (a.kills - a.deaths * 0.3))[0];
  $('overT').textContent = win ? '勝利' : '落敗'; $('overT').className = win ? 'win' : 'lose';
  $('overS').textContent = `${ROUND.score.A} : ${ROUND.score.B}`;
  $('overM').textContent = mvp ? `本場最有價值：${mvp.name}（${mvp.kills} 殺 ${mvp.deaths} 死）` : '';
  $('overY').textContent = `你：${player.kills} 殺 · ${player.deaths} 死 · ${player.heads} 爆頭`;
  $('over').hidden = false; $('touch').hidden = true; resetTouchState(); closeBuy();
  if (pointerLocked()) document.exitPointerLock();
}
