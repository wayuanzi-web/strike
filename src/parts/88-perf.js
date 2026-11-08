/* ===== 88-perf：效能報告與跑分——讓手機實機的情況可以「一鍵複製」貼回來，不用口述
   收集：玩的時候每一幀花多久（中位、最差 1%、超過 33 毫秒的比例、最慢 5 幀）、繪製次數、記憶體、開機與換地圖時間、裝置資訊。
   跑分：三張地圖各 12 秒，9 個機器人對戰＋煙霧＋爆炸，鏡頭跟著隊友，量目前畫質下的幀數。
   另外處理 iPhone Safari：聲音被打斷後恢復、擋雙指縮放、WebGL 畫面被系統回收時提示重新載入。 */
const PERF = {
  play: new Float32Array(7200), playN: 0, playI: 0,      // 玩的時候的幀時間（毫秒，最多記最近 7200 幀）
  worst: [],                                             // 最慢 5 幀：{ ms, map, what }
  bootMs: 0, mapLoads: {}, playSec: 0, bench: null, results: null, prChanges: [],
};
function perfFrame(ms) {
  if (PERF.bench && PERF.bench.collect) { PERF.bench.frames.push(ms); return; }
  if (game.state !== 'play' || document.hidden || game.manual) return;
  PERF.play[PERF.playI] = ms; PERF.playI = (PERF.playI + 1) % PERF.play.length; PERF.playN = Math.min(PERF.playN + 1, PERF.play.length);
  PERF.playSec += ms / 1000;
  if (ms > 40 && (PERF.worst.length < 5 || ms > PERF.worst[4].ms)) {
    PERF.worst.push({ ms: Math.round(ms), map: MAP.name, what: game.mode === 'match' ? `${({ freeze: '準備', live: '開打', end: '回合結束' })[ROUND.phase] || ROUND.phase}・第${ROUND.num}回合・煙${SMOKES.length}` : ({ practice: '練習', tutorial: '教學' })[game.mode] || game.mode });
    PERF.worst.sort((a, b) => b.ms - a.ms); PERF.worst.length = Math.min(5, PERF.worst.length);
  }
}
// 幀時間 → 統計：中位 fps、最差 1% fps（第 99 百分位的幀時間換算）、超過 33ms 的比例
function frameStats(arr) {
  const a = Array.from(arr).filter((x) => x > 0).sort((x, y) => x - y); if (!a.length) return null;
  const q = (p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  return { n: a.length, med: Math.round(1000 / q(0.5)), low1: Math.round(1000 / q(0.99)), slow: +(a.filter((x) => x > 33.4).length / a.length * 100).toFixed(1), max: Math.round(a[a.length - 1]) };
}
function deviceInfo() {
  const gl = renderer.getContext(); let gpu = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = '?'; }
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS ' + ((ua.match(/OS (\d+[_\d]*)/) || [])[1] || '').replace(/_/g, '.') : /Android/.test(ua) ? 'Android ' + ((ua.match(/Android ([\d.]+)/) || [])[1] || '') : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'Linux';
  const br = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '瀏覽器';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || !!navigator.standalone;
  return { os, br, gpu, cores: navigator.hardwareConcurrency || '?', mem: navigator.deviceMemory || '?', screen: `${screen.width}×${screen.height}`, view: `${innerWidth}×${innerHeight}`,
    dpr: +(window.devicePixelRatio || 1).toFixed(2), pr: +renderer.getPixelRatio().toFixed(2), standalone, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
}
function perfReport() {
  const d = deviceInfo(), Q = { auto: '自動', eco: '省電', std: '標準', high: '清晰' }, now = new Date();
  const L = [];
  L.push(`破曉突擊 效能報告 ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}（版本 ${BUILD}）`);
  L.push(`裝置：${d.os}・${d.br}・GPU ${d.gpu}・${d.cores} 核${d.mem !== '?' ? '・記憶體約 ' + d.mem + 'GB' : ''}`);
  L.push(`畫面：螢幕 ${d.screen}、可用 ${d.view}、像素比 ${d.dpr}；遊戲解析度 ${d.pr} 倍（畫質「${Q[S.quality] || S.quality}」${S.quality === 'auto' ? `，自動目前 ${game.autoPR}` : ''}）${d.standalone ? '・從主畫面開啟' : ''}`);
  L.push(`開機 ${(PERF.bootMs / 1000).toFixed(1)} 秒；換地圖 ` + (Object.entries(PERF.mapLoads).map(([k, v]) => `${MAPS[k].name} ${(v / 1000).toFixed(2)}s`).join('、') || '還沒換過'));
  if (PERF.results) {
    L.push('跑分（每張地圖 12 秒：9 人對戰、煙霧、爆炸，鏡頭跟隊友）：');
    for (const r of PERF.results) L.push(`  ${r.name}：中位 ${r.s.med} fps、最差 1% ${r.s.low1} fps、超過 33ms 的幀 ${r.s.slow}%、最慢 ${r.s.max}ms、繪製 ${r.draws}、三角形 ${Math.round(r.tris / 1000)}k`);
  } else L.push('跑分：還沒跑（按「跑分」約 1 分鐘）');
  const ps = frameStats(PERF.play.subarray(0, PERF.playN));
  if (ps) L.push(`實際遊玩（開啟後共 ${Math.floor(PERF.playSec / 60)} 分 ${Math.round(PERF.playSec % 60)} 秒，取最近 ${ps.n} 幀）：中位 ${ps.med} fps、最差 1% ${ps.low1} fps、超過 33ms ${ps.slow}%`);
  else L.push('實際遊玩：還沒有資料');
  if (PERF.worst.length) L.push('最慢 5 幀：' + PERF.worst.map((w) => `${w.ms}ms（${w.map}・${w.what}）`).join('、'));
  if (PERF.prChanges.length) L.push('自動降解析度：' + PERF.prChanges.join('、'));
  const m = renderer.info.memory, jm = performance.memory ? `、JS ${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
  L.push(`記憶體：幾何 ${m.geometries}、貼圖 ${m.textures}${jm}；目前繪製 ${renderer.info.render.calls} 次`);
  return L.join('\n');
}
// ---------- 報告畫面 ----------
function openPerf() { $('perfT').textContent = perfReport(); $('perf').hidden = false; $('perfCopy').textContent = '複製報告'; }
function closePerf() { $('perf').hidden = true; }
function copyText(t) {
  const done = () => { $('perfCopy').textContent = '已複製'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
  function fallback() {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, t.length); try { document.execCommand('copy'); done(); } catch (e) { $('perfCopy').textContent = '請長按文字自己複製'; } ta.remove();
  }
}
onTap($('perfCopy'), () => copyText($('perfT').textContent));
onTap($('perfX'), closePerf);
onTap($('perfBench'), () => { closePerf(); runBench(); });
// ---------- 跑分 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runBench() {
  if (PERF.bench) return;
  const keepMap = MAP.id, B = PERF.bench = { collect: false, frames: [], stop: false };
  $('pause').hidden = true; $('menu').hidden = true; $('bench').hidden = false;
  const res = [];
  for (const id of MAP_ORDER) {
    if (B.stop) break;
    $('benchT').textContent = `跑分中：${MAPS[id].name}（${res.length + 1}／${MAP_ORDER.length}）`;
    await sleep(60);
    const t0 = performance.now(); if (switchMap(id)) PERF.mapLoads[id] = Math.round(performance.now() - t0);
    startGame('match'); closeBuy();
    // 你當觀眾：陣亡、直接開打
    player.alive = false; player.respawnT = Infinity; player.deadT = 3; onUnitDied(player);
    ROUND.phase = 'live'; ROUND.t = ROUND.length; ROUND.liveT = 0;
    $('touch').hidden = true;
    await sleep(1500);                                   // 讓編譯著色器、第一波載入過去
    B.frames = []; B.collect = true;
    let drawsMax = 0, trisMax = 0;
    for (let k = 0; k < 12 && !B.stop; k++) {
      if (k === 3) { const sp = spectateTarget() || bots.find((b) => b.active && b.alive); if (sp) { const p = sp.phys.pos; throwNade('smoke', new V3(p.x, 1.6, p.z), new V3(-Math.sin(sp.yaw), 0.3, -Math.cos(sp.yaw)).normalize(), sp, null); } }
      if (k === 6) { const sp = spectateTarget() || bots.find((b) => b.active && b.alive); if (sp) { const p = sp.phys.pos; throwNade('he', new V3(p.x, 1.6, p.z), new V3(-Math.sin(sp.yaw), 0.2, -Math.cos(sp.yaw)).normalize(), sp, null); } }
      await sleep(1000);
      drawsMax = Math.max(drawsMax, renderer.info.render.calls); trisMax = Math.max(trisMax, renderer.info.render.triangles);
      $('benchT').textContent = `跑分中：${MAPS[id].name}（${res.length + 1}／${MAP_ORDER.length}）${12 - k - 1} 秒`;
    }
    B.collect = false;
    const s = frameStats(B.frames); if (s) res.push({ id, name: MAPS[id].name, s, draws: drawsMax, tris: trisMax });
  }
  PERF.bench = null; $('bench').hidden = true;
  if (res.length) PERF.results = res;
  if (MAP.id !== keepMap) { const t0 = performance.now(); if (switchMap(keepMap)) PERF.mapLoads[keepMap] = Math.round(performance.now() - t0); }
  backToMenu(); menuBackdrop();
  openPerf();
}
onTap($('benchStop'), () => { if (PERF.bench) PERF.bench.stop = true; });
// ---------- iPhone Safari ----------
// 聲音：來電、切走 App 後 AudioContext 會變成 interrupted／suspended，下一次觸碰時恢復
document.addEventListener('touchend', () => { if (typeof AC !== 'undefined' && AC && AC.state !== 'running') AC.resume().catch(() => {}); }, { passive: true });
// 擋掉 Safari 的雙指縮放、雙擊放大、長按選單
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
// WebGL 畫面被系統回收（手機記憶體不夠、背景太久）：提示重新載入
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); if (game.state === 'play') pauseGame();
  $('glLost').hidden = false;
});
onTap($('glReload'), () => location.reload());
