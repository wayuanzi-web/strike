/* ===== 68-stats：戰績——存在這台手機的瀏覽器裡（localStorage），換手機或清瀏覽器資料就沒了
   對戰：場數、勝敗、回合、擊殺、陣亡、爆頭、命中率、裝彈拆彈、最有價值、各地圖、各武器擊殺、最近 10 場。練習只記擊殺。 */
const STATS_KEY = 'strike.stats';
function emptyStats() {
  return { v: 1, matches: 0, wins: 0, losses: 0, roundsW: 0, roundsL: 0, kills: 0, deaths: 0, heads: 0, shots: 0, hits: 0,
    plants: 0, defuses: 0, mvp: 0, bestKills: 0, practiceKills: 0, tutorialDone: false, maps: {}, weapons: {}, recent: [],
    modes: { dm: { n: 0, w: 0, best: 0 }, koth: { n: 0, w: 0 }, range: { n: 0, bestMs: 0, bestAcc: 0 }, rage: { n: 0, w: 0, bestWave: 0, bestKills: 0, bestCombo: 0, lastWave: 0 } } };
}
let STATS = emptyStats();
// 讀進來的戰績照 emptyStats 的樣子清一遍（prog 另外在 76-progress 清）
function cleanStats(d) { const out = cleanLike(d, emptyStats()); out.prog = isObj(d) && isObj(d.prog) ? d.prog : undefined; return out; }
try { const raw = localStorage.getItem(STATS_KEY); if (raw) STATS = cleanStats(JSON.parse(raw)); } catch (e) { /* 讀不到就從零開始 */ }
// 死鬥、搶點、練槍場的紀錄（不算進對戰的勝率）
function statModeEnd(kind, win, r) {
  const M = STATS.modes[kind]; M.n++; if (win) M.w = (M.w || 0) + 1;
  if (kind === 'dm') M.best = Math.max(M.best || 0, player.kills);
  if (r && r.hit >= RANGE.n / 2) { if (!M.bestMs || r.avgMs < M.bestMs) M.bestMs = r.avgMs; M.bestAcc = Math.max(M.bestAcc || 0, r.acc); }
  saveStats();
  progEvent('mode', { kind, win, r });
}
function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch (e) { /* 存不了也照玩 */ } }
// 這場比賽的暫存（打完才寫進生涯）
const MSTAT = { kills: 0, deaths: 0, heads: 0, shots0: 0, hits0: 0, plants: 0, defuses: 0, weapons: {} };
function statMatchStart() { Object.assign(MSTAT, { kills: 0, deaths: 0, heads: 0, shots0: W.shots, hits0: W.hits, plants: 0, defuses: 0, weapons: {} }); }
function statKill(weapon, head) {
  progEvent('kill', { w: weapon, head });
  if (game.mode === 'match') { MSTAT.kills++; if (head) MSTAT.heads++; const k = (weapon && weapon.short) || '其它'; MSTAT.weapons[k] = (MSTAT.weapons[k] || 0) + 1; }
  else if (game.mode === 'practice') { STATS.practiceKills++; saveStats(); }
}
function statDeath() { if (game.mode === 'match') MSTAT.deaths++; }
function statPlant() { if (game.mode === 'match') { MSTAT.plants++; progEvent('plant'); } }
function statDefuse() { if (game.mode === 'match') { MSTAT.defuses++; progEvent('defuse'); } }
// 比賽打完：寫進生涯
function statMatchEnd(win, scoreA, scoreB, mvpIsYou) {
  const s = STATS;
  s.matches++; if (win) s.wins++; else s.losses++;
  s.roundsW += scoreA; s.roundsL += scoreB;
  s.kills += MSTAT.kills; s.deaths += MSTAT.deaths; s.heads += MSTAT.heads;
  s.shots += W.shots - MSTAT.shots0; s.hits += W.hits - MSTAT.hits0;
  s.plants += MSTAT.plants; s.defuses += MSTAT.defuses; if (mvpIsYou) s.mvp++;
  s.bestKills = Math.max(s.bestKills, MSTAT.kills);
  const m = s.maps[MAP.id] || (s.maps[MAP.id] = { played: 0, won: 0 }); m.played++; if (win) m.won++;
  for (const [k, n] of Object.entries(MSTAT.weapons)) s.weapons[k] = (s.weapons[k] || 0) + n;
  const d = new Date();
  s.recent.unshift({ t: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, map: MAP.id, a: scoreA, b: scoreB, win, k: MSTAT.kills, d: MSTAT.deaths, h: MSTAT.heads, diff: S.difficulty });
  s.recent = s.recent.slice(0, 10);
  saveStats();
  progEvent('match', { win, mvp: mvpIsYou, map: MAP.id });
}
// ---------- 戰績畫面 ----------
const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) + '%' : '—');
function renderStats() {
  const s = STATS, kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills ? s.kills.toFixed(2) : '—';
  const DIFF_NAME = { easy: '簡單', normal: '普通', hard: '困難' };
  const big = [['場數', s.matches], ['勝率', pct(s.wins, s.matches)], ['擊殺', s.kills], ['K/D', kd], ['爆頭率', pct(s.heads, s.kills)], ['命中率', pct(s.hits, s.shots)]];
  const small = [['勝／敗', `${s.wins}／${s.losses}`], ['回合勝／敗', `${s.roundsW}／${s.roundsL}`], ['陣亡', s.deaths], ['裝彈', s.plants], ['拆彈', s.defuses], ['MVP 次數', s.mvp], ['單場最多擊殺', s.bestKills], ['練習擊殺', s.practiceKills],
    ['死鬥', `${s.modes.dm.n} 場・${s.modes.dm.w} 次第一・最多 ${s.modes.dm.best || 0} 殺`], ['搶點', `${s.modes.koth.n} 場 ${s.modes.koth.w} 勝`], ['練槍場最快平均', s.modes.range.bestMs ? s.modes.range.bestMs + ' 毫秒' : '—'], ['練槍場最高命中率', s.modes.range.bestAcc ? Math.round(s.modes.range.bestAcc * 100) + '%' : '—'], ['狂暴', s.modes.rage.n ? `${s.modes.rage.n} 場・最高第 ${s.modes.rage.bestWave} 波・最多 ${s.modes.rage.bestKills} 殺` : '—']];
  const maps = MAP_ORDER.map((id) => { const m = s.maps[id] || { played: 0, won: 0 }; return `<li><b>${MAPS[id].name}</b><span>${m.played} 場・勝率 ${pct(m.won, m.played)}</span></li>`; }).join('');
  const wk = Object.entries(s.weapons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<li><b>${k}</b><span>${n} 殺</span></li>`).join('') || '<li><span>還沒有</span></li>';
  const rec = s.recent.map((r) => `<tr class="${r.win ? 'w' : 'l'}"><td>${r.t}</td><td>${(MAPS[r.map] || { name: r.map }).name}</td><td>${r.win ? '勝' : '敗'} ${r.a}:${r.b}</td><td>${r.k}／${r.d}／${r.h}</td><td>${DIFF_NAME[r.diff] || ''}</td></tr>`).join('');
  $('statBody').innerHTML = `<div class="sbig">${big.map(([k, v]) => `<div><strong>${v}</strong><small>${k}</small></div>`).join('')}</div>
    <div class="ssmall">${small.map(([k, v]) => `<div${String(v).length > 10 ? ' class="wide"' : ''}><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="scols"><section><h3>地圖</h3><ul>${maps}</ul></section><section><h3>武器擊殺</h3><ul>${wk}</ul></section></div>
    <section><h3>最近 10 場</h3>${rec ? `<table><tr><th>時間</th><th>地圖</th><th>結果</th><th>殺／死／爆頭</th><th>難度</th></tr>${rec}</table>` : '<p class="mnote">還沒打過對戰。</p>'}</section>`;
}
let clearArm = 0;
function openStats() { renderStats(); $('stats').hidden = false; clearArm = 0; $('statClear').textContent = '清除戰績'; }
function closeStats() { $('stats').hidden = true; }
onTap($('statX'), closeStats);
onTap($('statClear'), () => {
  // 按兩次才清除（避免誤觸）
  if (performance.now() - clearArm > 3000) { clearArm = performance.now(); $('statClear').textContent = '再按一次清除（等級、成就也會清掉）'; return; }
  const done = STATS.tutorialDone; STATS = emptyStats(); STATS.tutorialDone = done; ensureProg(); saveStats(); applyCosmetics(); syncMenuLevel(); renderStats(); $('statClear').textContent = '已清除'; clearArm = 0;
});
