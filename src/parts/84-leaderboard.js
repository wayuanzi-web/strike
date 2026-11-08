/* ===== 84-leaderboard：排行榜（選配）——練槍場最快反應、生涯勝率
   要先部署 server/leaderboard-worker.js（Cloudflare Worker，免費），把網址寫進 server/lb-url.txt 再建置；沒有網址就完全不顯示。
   上傳要自己打開（預設關）。只送暱稱、隨機玩家編號和分數，不送任何個資。 */
const LB_URL = '__LB_URL__';
const lbUrl = () => (S.lbUrl || (/^https?:/.test(LB_URL) ? LB_URL : '')).replace(/\/$/, '');
const LB = { board: 'range', last: null };
function lbId() { if (!/^[a-z0-9]{8,24}$/.test(S.lbId || '')) { S.lbId = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join(''); saveSettings(); } return S.lbId; }
async function lbFetch(path, body) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(lbUrl() + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
    const j = await r.json().catch(() => ({})); return r.ok ? j : { error: j.error || `伺服器回應 ${r.status}` };
  } catch (e) { return { error: '連不上排行榜' }; } finally { clearTimeout(t); }
}
async function lbSubmit(board, score) {
  if (!lbUrl()) return { error: '沒有排行榜' };
  return lbFetch('/submit', { board, id: lbId(), nick: (S.nick || '').trim() || ('玩家' + lbId().slice(0, 4)), score });
}
// 練槍場打完：有打開上傳就自動送
async function lbAfterRange(r) {
  if (!lbUrl() || !S.lbOn || !r || r.hit < 20) return;
  const res = await lbSubmit('range', { avgMs: r.avgMs, hit: r.hit, acc: r.acc, heads: r.heads });
  $('overC').textContent += res.error ? `　排行榜：${res.error}` : `　排行榜第 ${res.rank} 名${res.improved ? '' : '（沒有比你的最佳紀錄好）'}`;
}
async function lbRender() {
  const sec = $('pgLb'); sec.hidden = !lbUrl(); if (sec.hidden) return;
  $('lbNick').value = S.nick || ''; for (const b of sec.querySelectorAll('[data-board]')) b.classList.toggle('on', b.dataset.board === LB.board);
  $('lbList').innerHTML = '<li class="mute">讀取中…</li>';
  const j = await lbFetch(`/top?board=${LB.board}&id=${S.lbId || ''}`);
  if (j.error) { $('lbList').innerHTML = `<li class="mute">${j.error}</li>`; return; }
  const row = (e) => LB.board === 'range' ? `${e.avgMs} 毫秒・命中 ${Math.round(e.acc * 100)}%` : `勝率 ${Math.round(e.rate * 100)}%・${e.matches} 場`;
  $('lbList').innerHTML = j.top.length ? j.top.map((e) => `<li class="${e.me ? 'me' : ''}"><b>${e.rank}</b><span>${e.nick.replace(/[<>&]/g, '')}</span><small>${row(e)}</small></li>`).join('') : '<li class="mute">還沒有人上榜</li>';
  $('lbMine').textContent = j.myRank ? `你是第 ${j.myRank} 名（共 ${j.total} 人）` : '';
}
for (const b of document.querySelectorAll('#pgLb [data-board]')) onTap(b, () => { LB.board = b.dataset.board; lbRender(); });
onTap($('lbCareer'), async () => {
  S.nick = ($('lbNick').value || '').trim().slice(0, 12); saveSettings();
  if (STATS.matches < 10) { $('lbMsg').textContent = '生涯要打滿 10 場對戰才能上榜'; return; }
  const r = await lbSubmit('career', { matches: STATS.matches, wins: STATS.wins, kills: STATS.kills });
  $('lbMsg').textContent = r.error || `已上傳，生涯勝率第 ${r.rank} 名`; LB.board = 'career'; lbRender();
});
$('lbNick').addEventListener('change', () => { S.nick = ($('lbNick').value || '').trim().slice(0, 12); saveSettings(); });
