/* ===== 65-round：對戰模式——5 對 5、一條命一回合、凍結時間、回合計時、先贏 7 回合、陣亡後觀戰隊友 ===== */
const TEAM_SPAWN = {
  A: [[-32.5, 0], [-32.5, -2.2], [-32.5, 2.2], [-30.5, -6], [-30.5, 6]],
  B: [[32.5, 0], [32.5, -2.2], [32.5, 2.2], [30.5, -6.5], [31.5, 6.8]],
};
const ROUND = { phase: 'none', t: 0, num: 0, score: { A: 0, B: 0 }, winTo: 7, freeze: 4, length: 115, endT: 0, over: false, history: [] };
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
function startMatch() {
  game.mode = 'match'; setupBots('match');
  ROUND.score = { A: 0, B: 0 }; ROUND.num = 0; ROUND.over = false; ROUND.history = [];
  player.kills = player.deaths = player.heads = 0; player.deathStreak = 0;
  startRound();
}
function startRound() {
  ROUND.num++; ROUND.phase = 'freeze'; ROUND.t = ROUND.freeze;
  SHOOT_TOKENS.clear(); TEAM_INTEL.A.t = TEAM_INTEL.B.t = -99;
  const allies = bots.filter((b) => b.active && b.team === 'A'), enemies = bots.filter((b) => b.active && b.team === 'B');
  allies.forEach((b, i) => { const s = TEAM_SPAWN.A[i + 1]; botSpawn(b, s[0], s[1], 0, s[1]); });
  enemies.forEach((b, i) => { const s = TEAM_SPAWN.B[i]; botSpawn(b, s[0], s[1], 0, s[1]); });
  resetTouchState();
  spawnPlayer(TEAM_SPAWN.A[0]); player.spawnT = 0;
  game.spec = 0; $('dead').hidden = true;
  const last = ROUND.score.A + ROUND.score.B + 1 === ROUND.winTo * 2 - 1;
  hudBanner(`第 ${ROUND.num} 回合`, last ? '決勝回合' : `先贏 ${ROUND.winTo} 回合獲勝`, 2.6);
}
// 有人陣亡時檢查是否分出勝負
function onUnitDied(u) {
  if (game.mode !== 'match' || ROUND.phase !== 'live') return;
  if (aliveCount('A') === 0) endRound('B', '我方全滅');
  else if (aliveCount('B') === 0) endRound('A', '敵方全滅');
}
function endRound(winner, reason) {
  ROUND.phase = 'end'; ROUND.endT = 4.5;
  if (winner) ROUND.score[winner]++;
  ROUND.history.push(winner || '-');
  ROUND.over = ROUND.score.A >= ROUND.winTo || ROUND.score.B >= ROUND.winTo;
  const title = winner === 'A' ? '我方獲勝' : winner === 'B' ? '敵方獲勝' : '平手';
  hudBanner(title, reason + `　${ROUND.score.A} : ${ROUND.score.B}`, 4, winner === 'A' ? 'win' : winner === 'B' ? 'lose' : '');
  sfx(winner === 'A' ? 'win' : 'lose');
}
function updateRound(dt) {
  if (game.mode !== 'match') return;
  if (ROUND.phase === 'freeze') {
    ROUND.t -= dt;
    if (ROUND.t <= 0) { ROUND.phase = 'live'; ROUND.t = ROUND.length; hudBanner('開始！', '', 1.2); }
  } else if (ROUND.phase === 'live') {
    ROUND.t -= dt;
    if (ROUND.t <= 0) {
      // 時間到：活著的人多的那隊贏；一樣多就比剩下的血量
      const a = aliveCount('A'), b = aliveCount('B');
      const w = a > b ? 'A' : b > a ? 'B' : teamHp('A') > teamHp('B') ? 'A' : teamHp('B') > teamHp('A') ? 'B' : null;
      endRound(w, '時間到');
    }
  } else if (ROUND.phase === 'end') {
    ROUND.endT -= dt;
    if (ROUND.endT <= 0) { if (ROUND.over) showMatchOver(); else startRound(); }
  }
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
  $('over').hidden = false; $('touch').hidden = true; resetTouchState();
  if (pointerLocked()) document.exitPointerLock();
}
