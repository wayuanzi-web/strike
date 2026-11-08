/* ===== 82-net：好友 1 對 1——兩支手機的瀏覽器直接連線（WebRTC），不需要遊戲伺服器、不需要帳號
   配對：開房的人產生「邀請碼」→ 用 LINE 之類傳給朋友 → 朋友貼上後產生「回覆碼」傳回來 → 開房的人貼上就連上。
   連線時會問公開的 STUN 伺服器「我在網路上的位址」，雙方會看到彼此的 IP（不經過我們的伺服器、也不存任何資料）。
   有些網路（例如雙方都在行動網路、公司防火牆）會直連失敗；那需要中繼伺服器（TURN），目前沒有。
   規則：先到 10 殺；陣亡 2.5 秒後重生；裝備在購買選單免費挑（練習模式那套）。
   誰打中誰：開槍的那台算有沒有打中、打中哪裡，把傷害傳給被打的那台扣血（朋友之間玩，不防作弊）。 */
const NET = {
  on: false, pc: null, rel: null, fast: null, role: '', state: 'idle', name: '', peer: '對手', remote: null,
  goal: 10, myK: 0, theirK: 0, rtt: 0, pingT: 0, sendT: 0, lastRecv: 0, iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }],
  buf: [], seq: 0, log: [],
};
// ---------- 配對碼：連線資訊（SDP）壓縮後轉成一串字 ----------
async function packCode(prefix, desc) {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  let bytes = new TextEncoder().encode(json), z = 'n';
  if (typeof CompressionStream === 'function') {
    try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); z = 'z'; } catch (e) { /* 不壓縮 */ }
  }
  let bin = ''; for (const c of bytes) bin += String.fromCharCode(c);
  return `${prefix}${z}.` + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpackCode(code, prefix) {
  const m = String(code || '').trim().replace(/\s+/g, '').match(new RegExp(`^${prefix}([nz])\\.([A-Za-z0-9_-]+)$`));
  if (!m) return null;
  let s = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  let bytes; try { bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); } catch (e) { return null; }
  if (m[1] === 'z') { try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; } }
  try { const d = JSON.parse(new TextDecoder().decode(bytes)); return { type: d.t, sdp: d.s }; } catch (e) { return null; }
}
// 等候選位址收集完（最多 4 秒），配對碼才帶得到
function gathered(pc) {
  return new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
function newPeer() {
  netClose(true);
  const pc = new RTCPeerConnection({ iceServers: NET.iceServers });
  pc.addEventListener('connectionstatechange', () => {
    const s = pc.connectionState; netStatus();
    if (NET.pc !== pc) return;   // 舊的連線（重建房間後）關掉時不要連新的一起關
    if ((s === 'failed' || s === 'disconnected' || s === 'closed') && NET.state !== 'idle') netLost(s === 'failed' ? '連不上（這兩個網路可能不能直連，換 Wi-Fi 再試）' : '連線中斷');
  });
  NET.pc = pc; return pc;
}
function wireChannels(rel, fast) {
  NET.rel = rel; NET.fast = fast;
  const onmsg = (e) => { try { netRecv(JSON.parse(e.data)); } catch (err) { /* 收到看不懂的就丟掉 */ } };
  rel.onmessage = onmsg; fast.onmessage = onmsg;
  rel.onopen = () => { NET.state = 'linked'; NET.lastRecv = performance.now(); netSend({ t: 'hi', name: NET.name, v: BUILD }); netStatus(); sfx('ping', 0.6); };
  rel.onclose = () => { if (NET.rel === rel && NET.state !== 'idle') netLost('對方離開了'); };   // 只理會現在這條通道
  if (rel.readyState === 'open') rel.onopen();   // 加入的那邊收到通道時可能已經開好了
}
async function netHost() {
  const pc = newPeer(); NET.role = 'host'; NET.state = 'offer';
  const rel = pc.createDataChannel('rel', { ordered: true }), fast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
  wireChannels(rel, fast);
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  const code = await packCode('DSO1', pc.localDescription); netStatus(); return code;
}
async function netJoin(offerCode) {
  const offer = await unpackCode(offerCode, 'DSO1'); if (!offer) return { err: '邀請碼不對（應該是 DSO1 開頭）' };
  const pc = newPeer(); NET.role = 'guest'; NET.state = 'answer';
  const ch = {}; pc.ondatachannel = (e) => { ch[e.channel.label] = e.channel; if (ch.rel && ch.fast) wireChannels(ch.rel, ch.fast); };
  try { await pc.setRemoteDescription(offer); await pc.setLocalDescription(await pc.createAnswer()); }
  catch (e) { netClose(); return { err: '邀請碼內容壞掉了，請朋友重新建立房間再傳一次' }; }
  await gathered(pc);
  netStatus(); return { code: await packCode('DSA1', pc.localDescription) };
}
async function netAccept(answerCode) {
  const ans = await unpackCode(answerCode, 'DSA1'); if (!ans) return '回覆碼不對（應該是 DSA1 開頭）';
  if (!NET.pc || NET.role !== 'host') return '請先建立房間';
  if (NET.state === 'linked' || NET.state === 'playing') return '已經連上了，不用再貼';
  try { await NET.pc.setRemoteDescription(ans); } catch (e) { return '這個回覆碼不是這個房間的'; }
  NET.state = 'connecting'; netStatus(); return '';
}
function netSend(m, fast = false) { const ch = fast ? NET.fast : NET.rel; if (ch && ch.readyState === 'open') { try { ch.send(JSON.stringify(m)); } catch (e) { /* 塞車就丟 */ } } }
function netClose(silent) {
  for (const k of ['rel', 'fast']) { try { NET[k] && NET[k].close(); } catch (e) { /* 略過 */ } NET[k] = null; }
  try { NET.pc && NET.pc.close(); } catch (e) { /* 略過 */ } NET.pc = null;
  if (!silent) { NET.state = 'idle'; NET.on = false; }
}
function netLost(why) {
  const wasPlaying = NET.on; NET.state = 'idle'; NET.on = false; netClose(true); netStatus(why);
  if (wasPlaying && game.state === 'play') { hudBanner('連線中斷', why, 3); setTimeout(() => { if (game.mode === 'duel') backToMenu(); }, 2500); }
}

// ---------- 對戰 ----------
function netRecv(m) {
  NET.lastRecv = performance.now();
  if (m.t === 'hi') { NET.peer = String(m.name || '對手').slice(0, 12); netStatus(); }
  else if (m.t === 'start') {
    // 只有在好友對戰畫面或對戰結算時才接受「開始」，不然正在打練習的人會被直接拉進去
    if (!$('duel').hidden || (game.mode === 'duel' && game.state !== 'play')) startDuel(m.map, m.goal, false); else netSend({ t: 'busy' });
  } else if (m.t === 'busy') {
    if (game.mode === 'duel' && NET.on) { NET.on = false; NET.state = 'linked'; backToMenu(); openDuelUI(); netStatus(`${NET.peer} 不在對戰畫面，等他按「好友對戰」回來再按開始`); }
  } else if (m.t === 'end') { if (game.mode === 'duel') endDuel(!!m.win, true); return; }
  else if (m.t === 'ping') netSend({ t: 'pong', k: m.k });
  else if (m.t === 'pong') NET.rtt = Math.round(performance.now() - m.k);
  else if (game.mode !== 'duel' || (!NET.on && m.t !== 'x')) return;   // 結束後還是要收對方的陣亡（同時互殺時分數才會對）
  const b = NET.remote; if (!b) return;
  if (m.t === 's') {   // 對手的狀態（每秒 30 次）
    if (m.q < (NET.lastQ || 0)) return; NET.lastQ = m.q;
    NET.buf.push({ at: performance.now(), p: m.p, y: m.y, c: m.c }); if (NET.buf.length > 20) NET.buf.shift();
    if (m.w && (!b.wpn || b.wpn.id !== m.w) && WEAPONS[m.w]) { if (WEAPONS[m.w].slot === 'primary') { b.primary = WEAPONS[m.w]; b.secondary = null; } else { b.primary = null; b.secondary = WEAPONS[m.w]; } botArm(b); }
    b.hp = m.h; b.reloadT = m.r ? 0.5 : 0; if (m.r) b.wpn.reload = Math.max(b.wpn.reload, 0.5);
    NET.theirK = Math.max(NET.theirK, m.k | 0);   // 延遲時舊封包帶的舊分數不要蓋掉新的
    if (!m.a && b.alive) { b.alive = false; b.hp = 0; b.deadT = 0; b.fallDir = 1; b.deathKind = 'fwd'; b.respawnT = Infinity; }   // 自己炸死自己之類
    if (m.a && !b.alive) { const s = m.p; botSpawn(b, s[0], s[2]); b.phys.pos.y = s[1]; b.respawnT = Infinity; b.blindT = 999; }
  } else if (m.t === 'f') {   // 對手開槍：曳光、槍口火光、槍聲
    const o = _v1.fromArray(m.o), e = _v2.fromArray(m.e);
    spawnTracer(o, e, pal().tracerE, 0.02, false); b.flashT = 0.05; sfx('botshot', 1, { pos: b.phys.pos, w: WEAPONS[m.w] || WEAPONS.rifle }); soundCue('shot', b.phys.pos);
    if (m.n) { spawnPuff(e, '#cfc6b6', 0.35, 0.5, 0.5); }
  } else if (m.t === 'n') {   // 對手丟投擲物：這邊也模擬一顆（只有畫面和閃光，傷害由丟的那邊算）
    throwNade(m.k, new V3().fromArray(m.o), new V3().fromArray(m.d), b, m.i ? new V3().fromArray(m.i) : null);
  } else if (m.t === 'h') {   // 對手打中我
    if (player.alive && player.spawnT <= 0) damagePlayer(m.d, b, m.p, WEAPONS[m.w] || NADES[m.w] || WEAPONS.rifle);
  } else if (m.t === 'x') {   // 對手陣亡（被我殺）
    if (b.alive) {
      b.alive = false; b.hp = 0; b.deadT = 0; b.fallDir = Math.sign(Math.random() - 0.5); b.deathKind = m.p === 'head' ? 'back' : pick(['fwd', 'side', 'spin']); b.respawnT = Infinity;
      if (m.by === 'me') { NET.myK = m.k; player.kills = m.k; if (m.p === 'head') player.heads++; hudFeed('你', NET.peer, m.p === 'head', 'A', 'B', true, WEAPONS[m.w] || NADES[m.w]); hudHit(m.p === 'head' ? 'kill head' : 'kill'); sfx('kill'); statKill(WEAPONS[m.w] || NADES[m.w], m.p === 'head'); }
      onUnitDied(b);
    }
  }
}
// 我打中對手：把傷害傳過去（對方扣血、判斷死亡）
function netHitRemote(b, dmg, part, w) {
  if (!b.alive) return;
  netSend({ t: 'h', d: Math.round(dmg * 10) / 10, p: part, w: w && w.id });
  hudHit(part === 'head' ? 'head' : 'hit'); sfx(part === 'head' ? 'head' : 'hit'); hitFeedback('hit', b, part === 'head', false);
  b.hitAnim = 0.15; b.hitPart = part; b.hitSide = 1;
}
// 我陣亡：告訴對方是他殺的
function netOnMyDeath(by, part, w) {
  if (!NET.on) return;
  netSend({ t: 'x', by: by && by.remote ? 'me' : 'other', p: part, w: w && w.id, k: (NET.theirK = (NET.theirK || 0) + (by && by.remote ? 1 : 0)) });
  if (NET.theirK >= NET.goal) { netSend({ t: 'end', win: true }); endDuel(false); }
}
function netShot(o, e, hitSomething) { if (NET.on) netSend({ t: 'f', o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], e: [+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)], w: WP.id, n: hitSomething ? 1 : 0 }); }
function netNade(type, o, d, inherit) { if (NET.on) netSend({ t: 'n', k: type, o: o.toArray().map((v) => +v.toFixed(2)), d: d.toArray().map((v) => +v.toFixed(3)), i: inherit ? inherit.toArray().map((v) => +v.toFixed(2)) : null }); }
// 每格：送自己的狀態、把對手放到 0.1 秒前的位置（內插，看起來比較順）
function netUpdate(dt) {
  if (!NET.on) return;
  if ((NET.sendT -= dt) <= 0) {
    NET.sendT = 1 / 30; const p = player.body.pos;
    netSend({ t: 's', q: ++NET.seq, p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], y: +player.yaw.toFixed(3), c: player.crouch ? 1 : 0, w: WP.id, h: Math.round(player.hp), a: player.alive ? 1 : 0, k: NET.myK, r: reloading() ? 1 : 0 }, true);
  }
  if ((NET.pingT -= dt) <= 0) { NET.pingT = 2; netSend({ t: 'ping', k: performance.now() }); }
  if (performance.now() - NET.lastRecv > 8000) netLost('對方沒有回應');
}
const _ri = new V3();
function netDriveRemote(b, dt) {
  const B = NET.buf; if (!B.length) return;
  const at = performance.now() - 100; let a = B[0], c = B[B.length - 1];
  for (let i = 0; i < B.length - 1; i++) if (B[i].at <= at && B[i + 1].at >= at) { a = B[i]; c = B[i + 1]; break; }
  const k = c.at > a.at ? clamp((at - a.at) / (c.at - a.at), 0, 1) : 1;
  _ri.set(lerp(a.p[0], c.p[0], k), lerp(a.p[1], c.p[1], k), lerp(a.p[2], c.p[2], k));
  const p = b.phys.pos; b.phys.vel.set((_ri.x - p.x) / Math.max(dt, 1e-3), 0, (_ri.z - p.z) / Math.max(dt, 1e-3)); b.phys.vel.clampLength(0, 8);
  p.copy(_ri); b.phys.onGround = true;
  b.yaw = a.y + angDiff(a.y, c.y) * k;
  const cr = !!c.c; if (cr !== b.phys.crouched) { b.phys.crouched = cr; b.phys.h = cr ? CROUCH_H : STAND_H; }
  if (b.reloadT > 0) b.reloadT = Math.max(0.01, b.reloadT - dt);
  b.visible = false; b.target = null;
}
// 開始對戰（開房的人按「開始」，地圖用開房的人選的）
function startDuel(mapId, goal, iAmHost) {
  if (iAmHost) netSend({ t: 'start', map: S.map, goal: NET.goal });
  if (mapId && MAPS[mapId] && mapId !== MAP.id) { S.map = mapId; switchMap(mapId); }
  NET.goal = goal || 10; NET.myK = NET.theirK = 0; NET.buf = []; NET.lastQ = 0; NET.seq = 0;
  closeDuelUI();
  game.mode = 'duel'; game.lastMode = 'duel'; leaveMode(); gainReset();
  setupBots('duel');
  const b = NET.remote = bots[0]; b.active = true; b.remote = true; b.team = 'B'; b.name = NET.peer; b.kills = b.deaths = 0;
  b.primary = WEAPONS.rifle; botArm(b); botSpawn(b, 0, 0); b.alive = false; b.g.visible = false; b.respawnT = Infinity;
  player.team = 'A'; player.kills = player.deaths = player.heads = 0;
  resetLoadout(true); giveArmor(player, true);
  spawnPlayer(modeSpawnFor(player) || PLAYER_SPAWNS[0]);
  NET.on = true; NET.state = 'playing'; NET.lastRecv = performance.now();
  enterPlay(); document.body.classList.add('mode');
  hudBanner('好友對戰', `對手：${NET.peer}　先到 ${NET.goal} 殺`, 3);
}
function endDuel(iWon, fromPeer) {
  if (!NET.on && !fromPeer) return;
  // 兩邊同時打死對方、同時到目標：我這邊已經判輸，對方也判他自己輸 → 平手
  if (!NET.on && game.state === 'over') { if (iWon && $('overT').textContent === '落敗') { $('overT').textContent = '平手'; $('overT').className = 'lose'; $('overS').textContent = `${NET.myK} : ${NET.theirK}`; } return; }
  NET.on = false; game.state = 'over';
  $('overT').textContent = iWon ? '勝利' : '落敗'; $('overT').className = iWon ? 'win' : 'lose';
  $('overS').textContent = `${NET.myK} : ${NET.theirK}`; $('overM').textContent = `好友對戰：你 vs ${NET.peer}`;
  $('overY').textContent = `你：${player.kills} 殺 · ${player.deaths} 死 · ${player.heads} 爆頭`; $('overC').textContent = '想再打一場：按「再來一場」，等對方也按。';
  overXpLine(); $('over').hidden = false; $('touch').hidden = true; resetTouchState(); closeBuy(); overClean();
  if (pointerLocked()) document.exitPointerLock();
  NET.state = 'linked';
}
function duelHud() {
  $('mtop').hidden = false; $('ptop').hidden = true; $('bBoard').hidden = true; $('spec').hidden = true; $('pipsA').textContent = ''; $('pipsB').textContent = '';
  $('scA').textContent = NET.myK; $('scB').textContent = NET.theirK; $('clk').textContent = `先到 ${NET.goal}`; $('clk').className = '';
  $('rnd').textContent = `對手：${NET.peer}・延遲 ${NET.rtt || '—'} 毫秒`;
}

// ---------- 配對畫面 ----------
function netStatus(extra) {
  const el = $('duelSt'); if (!el) return;
  const st = NET.pc ? NET.pc.connectionState : '';
  el.textContent = extra || (NET.state === 'linked' ? `已連線：${NET.peer}${NET.rtt ? `（延遲 ${NET.rtt} 毫秒）` : ''}${NET.role === 'host' ? '　按「開始」' : '　等對方按開始'}`
    : NET.state === 'offer' ? '把邀請碼傳給朋友，再把他給你的回覆碼貼到下面' : NET.state === 'answer' ? '把回覆碼傳回去給開房的人，等他貼上' : NET.state === 'connecting' ? `連線中…（${st}）` : '');
  $('duelGo').hidden = !(NET.state === 'linked' && NET.role === 'host');
}
function openDuelUI() { $('duel').hidden = false; $('duelName').value = NET.name || S.nick || ''; $('duelMine').value = ''; $('duelTheirs').value = ''; netStatus(); }
function closeDuelUI() { $('duel').hidden = true; }
const nickOk = () => { const n = ($('duelName').value || '').trim().slice(0, 12) || ('玩家' + (100 + Math.floor(Math.random() * 900))); NET.name = S.nick = n; saveSettings(); return n; };
async function shareOrCopy(text) {
  try { if (navigator.share) { await navigator.share({ text }); return '已分享'; } } catch (e) { /* 取消分享就改用複製 */ }
  try { await navigator.clipboard.writeText(text); return '已複製'; } catch (e) { $('duelMine').select(); return '請長按自己複製'; }
}
onTap($('bDuel'), openDuelUI);
onTap($('duelX'), () => { closeDuelUI(); if (NET.state !== 'linked') { netClose(); NET.state = 'idle'; } });
onTap($('duelHost'), async () => { nickOk(); $('duelSt').textContent = '產生邀請碼中…'; $('duelMine').value = await netHost(); $('duelMineL').textContent = '你的邀請碼（傳給朋友）'; netStatus(); });
onTap($('duelJoin'), async () => {
  nickOk(); const code = $('duelTheirs').value;
  if (/^DSO1/.test(code.trim()) && NET.role === 'host' && code.trim() === $('duelMine').value.trim()) { $('duelSt').textContent = '這是你自己的邀請碼，要貼的是朋友傳回來的回覆碼（DSA1 開頭）'; return; }
  if (/^DSA1/.test(code.trim())) { const e = await netAccept(code); $('duelSt').textContent = e || '連線中…'; return; }   // 開房的人貼回覆碼
  $('duelSt').textContent = '產生回覆碼中…'; const r = await netJoin(code);
  if (r.err) { $('duelSt').textContent = r.err; return; }
  $('duelMine').value = r.code; $('duelMineL').textContent = '你的回覆碼（傳回給開房的人）'; netStatus();
});
onTap($('duelShare'), async () => { if ($('duelMine').value) $('duelSt').textContent = await shareOrCopy($('duelMine').value); });
onTap($('duelGo'), () => startDuel(S.map, NET.goal, true));
