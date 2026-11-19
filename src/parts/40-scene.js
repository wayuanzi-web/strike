/* ===== 40-scene：畫面、燈光、手上的槍、特效（彈道線、彈孔、火花、煙塵、火光、影子）、音效 ===== */
const canvas = $('cv');
// 抗鋸齒只能在建立時決定：省電模式不開（切換畫質後重新整理才會生效）
const renderer = new THREE.WebGLRenderer({ canvas, antialias: S.quality !== 'eco', powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__STRIKE_TEST });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.autoClear = false; renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d9c2b0', 45, 190);
const BASE_FOV = 75, ADS_FOV = 48;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 16 / 9, 0.08, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

// 燈光、霧、天空、遠景都跟著地圖的主題（破曉冷暖對比、正午白光、黃昏橘紫）
const hemiLight = new THREE.HemisphereLight('#c4d0ea', '#8a6e56', 1.45); scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight('#ffc792', 2.5); scene.add(sunLight); scene.add(sunLight.target);
// 人物的自身陰影（頭盔投在臉上、手臂投在身上、背心投在衣服上）：只有人物會畫進陰影圖，地圖的陰影已經烘在光照貼圖裡。
// 陰影範圍跟著鏡頭前方 14×14 公尺；省電畫質不開。
const CHAR_SHADOW = S.quality !== 'eco';
if (CHAR_SHADOW) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  sunLight.castShadow = true; sunLight.shadow.mapSize.set(1024, 1024);
  const sc = sunLight.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 70; sc.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.025; sunLight.shadow.radius = 1.5;
}
const _shF = new V3();
let _shWas = true;
function updateCharShadow() {
  if (!CHAR_SHADOW) return;
  // 附近沒有人在投影就不重畫陰影圖（省一整個繪製流程）；最後一個人走掉時多畫一次把舊影子清掉
  const any = typeof HUM_LOD !== 'undefined' && HUM_LOD.sh > 0; renderer.shadowMap.needsUpdate = any || _shWas; _shWas = any;
  camera.getWorldDirection(_shF); _shF.y = 0; if (_shF.lengthSq() < 1e-6) _shF.set(0, 0, -1); _shF.normalize();
  // 陰影範圍的中心：鏡頭前方 5 公尺；對齊到 2 公分的格子，鏡頭小動時陰影邊緣不會閃
  const fx = Math.round((camera.position.x + _shF.x * 5) / 0.02) * 0.02, fz = Math.round((camera.position.z + _shF.z * 5) / 0.02) * 0.02, fy = Math.round(camera.position.y * 50) / 50 - 0.6;
  sunLight.target.position.set(fx, fy, fz); sunLight.position.set(fx + SUN_DIR.x * 30, fy + SUN_DIR.y * 30, fz + SUN_DIR.z * 30);
  sunLight.target.updateMatrixWorld(); sunLight.updateMatrixWorld();
}
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const mapMeshes = [];
let skyline = null, sky = null;
function applyTheme() {
  const t = MAP.theme;
  SUN_DIR.fromArray(t.sun).normalize();
  sunLight.color.set(t.sunColor); sunLight.intensity = t.sunI; sunLight.position.copy(SUN_DIR).multiplyScalar(50);
  hemiLight.color.set(t.hemi[0]); hemiLight.groundColor.set(t.hemi[1]); hemiLight.intensity = t.hemi[2];
  scene.fog.color.set(t.fog[0]); scene.fog.near = t.fog[1]; scene.fog.far = t.fog[2];
  renderer.toneMappingExposure = t.exposure;
  for (const o of [skyline, sky]) if (o) { scene.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); }
  skyline = buildSkyline(t.skyline, t.skyTop, t.skyBot); skyline.visible = S.quality !== 'eco'; scene.add(skyline);
  sky = buildSky(t.sky); scene.add(sky); addStars(sky);
  applyLightTheme(); buildLampGlow();
  if (window.VM_READY) applyVmTheme();
}
// 手上的槍：夜裡環境光、反射都暗下來（主要靠路燈和槍口火光照亮）
function applyVmTheme() {
  const t = MAP.theme, nk = t.night ? 0.3 : 1; VM_HEMI.intensity = 0.8 * nk; VM_FILL.intensity = 0.5 * nk;
  for (const k in VM_MATS) VM_MATS[k].envMapIntensity = VM_ENVI[k] * (t.night ? 0.25 : 1);
}
// ---------- 地面細節：裂縫、油漬、濕痕、落葉、人孔蓋、胎痕、排水格柵 ----------
// 一張程式畫的圖集（白底＝不變），用相乘混色貼在地上：只會讓地面變暗、上色，白天夜裡光照都對。
// 全部一個 InstancedMesh、一次繪製；位置用雜湊決定，換地圖重排。
const GD_TILES = 8, GD_MAX = 60;
const gdTex = (function () {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 1024, 512);
  let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const tile = (i, fn) => { c.save(); c.translate((i % 4) * 256, Math.floor(i / 4) * 256); c.beginPath(); c.rect(4, 4, 248, 248); c.clip(); fn(); c.restore(); };
  const crack = (x, y, a, len, w, depth) => {
    c.strokeStyle = `rgba(60,58,55,${0.55 + w * 0.12})`; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < len; k++) { a += (rr() - 0.5) * 0.9; x += Math.cos(a) * 7; y += Math.sin(a) * 7; c.lineTo(x, y);
      if (depth < 2 && rr() < 0.12) { c.stroke(); crack(x, y, a + (rr() < 0.5 ? 1 : -1) * (0.6 + rr()), len * 0.45 | 0, w * 0.6, depth + 1); c.strokeStyle = `rgba(60,58,55,${0.55 + w * 0.12})`; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); } }
    c.stroke(); };
  tile(0, () => { crack(20, 130, 0.1, 32, 2.6, 0); crack(130, 128, -1.2, 14, 1.6, 1); });
  tile(1, () => { crack(128, 128, 0, 16, 2.2, 0); crack(128, 128, 2.1, 15, 2, 0); crack(128, 128, 4.2, 14, 1.8, 0); });
  tile(2, () => { for (let k = 0; k < 9; k++) { const x = 128 + (rr() - 0.5) * 90, y = 128 + (rr() - 0.5) * 90, r = 25 + rr() * 50, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,64,58,0.55)'); g.addColorStop(0.7, 'rgba(90,84,76,0.35)'); g.addColorStop(1, 'rgba(120,112,100,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } });
  tile(3, () => { for (let k = 0; k < 14; k++) { const x = 128 + (rr() - 0.5) * 140, y = 128 + (rr() - 0.5) * 110, r = 20 + rr() * 45, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,128,136,0.5)'); g.addColorStop(0.75, 'rgba(130,136,142,0.4)'); g.addColorStop(1, 'rgba(160,165,170,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } });
  tile(4, () => { const cols = ['#c2843a', '#a8642c', '#d6a24a', '#8a5a2a', '#b47838'];
    for (let k = 0; k < 34; k++) { const x = 128 + (rr() - 0.5) * 190, y = 128 + (rr() - 0.5) * 190; if (Math.hypot(x - 128, y - 128) > 100) continue;
      c.save(); c.translate(x, y); c.rotate(rr() * 6.28); c.fillStyle = cols[k % 5]; c.beginPath(); c.ellipse(0, 0, 9 + rr() * 6, 4 + rr() * 3, 0, 0, 6.28); c.fill();
      c.strokeStyle = 'rgba(90,60,30,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke(); c.restore(); } });
  tile(5, () => { c.fillStyle = '#5a5856'; c.beginPath(); c.arc(128, 128, 108, 0, 6.28); c.fill(); c.fillStyle = '#8a8884'; c.beginPath(); c.arc(128, 128, 98, 0, 6.28); c.fill();
    c.strokeStyle = '#5e5c58'; c.lineWidth = 5; for (let k = -80; k <= 80; k += 20) { c.beginPath(); c.moveTo(128 + k, 40); c.lineTo(128 + k, 216); c.stroke(); c.beginPath(); c.moveTo(40, 128 + k); c.lineTo(216, 128 + k); c.stroke(); }
    c.fillStyle = '#4a4846'; c.fillRect(118, 60, 20, 8); c.fillRect(118, 188, 20, 8); });
  tile(6, () => { c.strokeStyle = 'rgba(55,52,50,0.45)'; for (const o of [-26, 26]) { c.lineWidth = 16; c.beginPath(); c.moveTo(10, 128 + o); c.bezierCurveTo(90, 100 + o, 170, 150 + o, 246, 118 + o); c.stroke(); } });
  tile(7, () => { c.fillStyle = '#6a6866'; c.fillRect(40, 92, 176, 72); c.fillStyle = '#2e2c2a'; for (let k = 0; k < 10; k++) c.fillRect(50 + k * 16.5, 100, 9, 56); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
})();
const gdGeo = new THREE.PlaneGeometry(1, 1); gdGeo.rotateX(-Math.PI / 2);
const gdTileA = new THREE.InstancedBufferAttribute(new Float32Array(GD_MAX), 1); gdGeo.setAttribute('aTile', gdTileA);
const gdMat = new THREE.MeshBasicMaterial({ map: gdTex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor });
gdMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', 'attribute float aTile;\n#include <common>')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = vMapUv * vec2(0.25, 0.5) + vec2(mod(aTile, 4.0) * 0.25, 0.5 - floor(aTile / 4.0) * 0.5);');
};
const groundDetail = new THREE.InstancedMesh(gdGeo, gdMat, GD_MAX); groundDetail.count = 0; groundDetail.frustumCulled = false; groundDetail.renderOrder = -1; scene.add(groundDetail);
// 每張地圖各種細節的比重：裂縫 A、裂縫 B、油漬、濕痕、落葉、人孔蓋、胎痕、排水格柵
const GD_W = { dawn: [3, 2, 3, 1, 0, 2, 2, 1], night: [3, 2, 3, 2, 0, 2, 2, 1], market: [1, 1, 0, 3, 3, 1, 0, 2], rail: [0, 0, 4, 2, 2, 0, 0, 0], site: [3, 2, 2, 3, 1, 1, 2, 1] };
function placeGroundDetail() {
  const w = GD_W[MAP.id] || GD_W.dawn, tot = w.reduce((a, b) => a + b, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), ps = new V3(), up = new V3(0, 1, 0);
  let n = 0;
  for (let k = 0; k < 400 && n < (S.quality === 'eco' ? 30 : GD_MAX); k++) {
    const h = (j) => hash1(k * 97 + j * 31 + MAP.id.length * 7);
    let r = h(1) * tot, tl = 0; while (r >= w[tl]) { r -= w[tl]; tl++; }
    const size = tl === 5 ? 0.9 : tl === 7 ? 0.8 : tl === 6 ? 3.2 : tl === 3 ? 1.6 + h(4) * 1.6 : 1.1 + h(4) * 1.3;
    const x = (h(2) - 0.5) * 68, z = (h(3) - 0.5) * 48, rad = size * 0.55;
    if (BOXES.some((b) => b !== BOXES[0] && b.min[1] < 0.2 && b.max[1] > 0.02 && x + rad > b.min[0] && x - rad < b.max[0] && z + rad > b.min[2] && z - rad < b.max[2])) continue;
    q.setFromAxisAngle(up, tl === 5 ? 0 : h(5) * 6.28); sc.set(size, 1, size); ps.set(x, 0.004 + n * 0.0002, z);
    m.compose(ps, q, sc); groundDetail.setMatrixAt(n, m); gdTileA.setX(n, tl); n++;
  }
  groundDetail.count = n; groundDetail.instanceMatrix.needsUpdate = true; gdTileA.needsUpdate = true;
}
// ---------- 會動的布：舊城巷子裡的晾衣繩、其他地圖的旗桿 ----------
// 全部合成一個網格、一次繪製；擺動在頂點著色器裡算（aW：0＝固定的邊、1＝自由端，aPh：相位）
const CLOTH_U = { value: 0 }, CLOTH_B = { value: new THREE.Vector4(0, -99, 0, -99) };   // 最近一次爆炸：位置＋時間
const clothMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
clothMat.onBeforeCompile = (sh) => {
  sh.uniforms.uT = CLOTH_U; sh.uniforms.uB = CLOTH_B;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', 'uniform float uT; uniform vec4 uB; attribute float aW; attribute float aPh; attribute vec3 aN;\n#include <common>')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float wv = sin(uT * 3.1 + aPh + position.x * 1.7 + position.z * 1.3 + position.y * 2.0) * 0.6 + sin(uT * 5.3 + aPh * 1.7 + position.y * 3.0) * 0.4;
      transformed += aN * wv * aW * 0.16 + vec3(0.0, -abs(wv) * aW * aW * 0.03, 0.0);
      // 爆炸的震波：附近的布被往外吹、抖幾下，一秒多後平息
      float ba = uT - uB.w, bd = distance(position, uB.xyz), bk = step(0.0, ba) * exp(-ba * 2.6) * (1.0 - smoothstep(4.0, 16.0, bd));
      vec3 away = normalize(position - uB.xyz + vec3(0.0, 0.01, 0.0));
      transformed += (away * 0.45 * exp(-ba * 5.0) + aN * sin(ba * 21.0 + aPh) * 0.3) * bk * aW;`);
};
let clothMesh = null;
function clothBlast(p) { CLOTH_B.value.set(p.x, p.y + 0.5, p.z, performance.now() / 1000); }
// 爆炸震到附近沒受傷的人：往爆炸的反方向晃一下、縮一下（不留血跡）
function blastFlinch(p, r) {
  for (const b of bots) { if (!b.active || !b.alive) continue; const P = b.phys.pos, d = Math.hypot(P.x - p.x, P.z - p.z); if (d > r || d < 0.3) continue;
    humanHit(b, 'body', _v1.set((P.x - p.x) / d, 0, (P.z - p.z) / d), 26 * (1 - d / r) + 8, true); b.flinchT = 0.35 + 0.35 * (1 - d / r); }
}
function buildCloth() {
  if (clothMesh) { scene.remove(clothMesh); clothMesh.geometry.dispose(); clothMesh = null; }
  const P = [], C = [], W = [], PH = [], NN = [], I = [], col = new THREE.Color();
  // 一片布：從 o 出發，沿 U 方向 nu 格、沿 V 方向 nv 格；wf(u,v) 給擺動權重；n 是擺動方向
  const quad = (o, U, V, nu, nv, color, wf, n, ph, stripes) => {
    const s0 = P.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      P.push(o.x + U.x * u + V.x * v, o.y + U.y * u + V.y * v, o.z + U.z * u + V.z * v);
      col.set(stripes ? stripes[Math.min(stripes.length - 1, Math.floor(v * stripes.length))] : color).multiplyScalar(0.92 + 0.08 * Math.sin(u * 9 + v * 7));
      C.push(col.r, col.g, col.b); W.push(wf(u, v)); PH.push(ph); NN.push(n.x, n.y, n.z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = s0 + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, b, d, a, d, c); }
  };
  const bar = (a, b, w, color) => {   // 細桿、繩子：一片很窄的帶子（不擺動）
    const d = new V3().subVectors(b, a), side = Math.abs(d.y) > Math.abs(d.x) + Math.abs(d.z) ? new V3(w, 0, 0) : new V3(0, w, 0);
    quad(a.clone().addScaledVector(side, -0.5), d, side, 1, 1, color, () => 0, new V3(0, 0, 1), 0);
    if (Math.abs(d.y) > 1) { const s2 = new V3(0, 0, w); quad(a.clone().addScaledVector(s2, -0.5), d, s2, 1, 1, color, () => 0, new V3(1, 0, 0), 0); }
  };
  const segOk = (a, b) => segFree(BOXES, a.x, a.y, a.z, b.x, b.y, b.z);
  if (MAP.id === 'market') {
    const houses = BOXES.filter((b) => /^house/.test(b.c) && b.max[1] > 4), lines = [];
    for (const A of houses) for (const B of houses) {
      if (A === B || lines.length >= 6) continue;
      for (const ax of [0, 2]) {
        const oa = ax === 0 ? 2 : 0, g = B.min[ax] - A.max[ax], lo = Math.max(A.min[oa], B.min[oa]), hi = Math.min(A.max[oa], B.max[oa]);
        if (g < 2.5 || g > 7.5 || hi - lo < 2) continue;
        const m = (lo + hi) / 2, y = Math.min(A.max[1], B.max[1]) - 0.7;
        const a = ax === 0 ? new V3(A.max[0], y, m) : new V3(m, y, A.max[2]), b = ax === 0 ? new V3(B.min[0], y, m) : new V3(m, y, B.min[2]);
        if (lines.some((l) => l.a.distanceTo(a) < 4)) continue;
        if (!segOk(a.clone().lerp(b, 0.05), b.clone().lerp(a, 0.05))) continue;
        lines.push({ a, b });
      }
    }
    const PAL = ['#f2efe6', '#9cc3e0', '#d9534a', '#f0c75a', '#7fae6a', '#e8a0b4', '#5a6e9a'];
    lines.forEach((l, li) => {
      bar(l.a, l.b, 0.012, '#3a3836');
      const d = new V3().subVectors(l.b, l.a), len = d.length(); d.normalize();
      const n = new V3(-d.z, 0, d.x);
      for (let t = 0.6; t < len - 0.6;) {
        const w = 0.35 + hash1(li * 13 + Math.round(t * 7)) * 0.45, h = 0.45 + hash1(li * 7 + Math.round(t * 11)) * 0.4, sag = Math.sin((t + w / 2) / len * Math.PI) * 0.25;
        const o = l.a.clone().addScaledVector(d, t); o.y -= sag;
        const k = hash1(li * 31 + Math.round(t * 5));
        quad(o, d.clone().multiplyScalar(w), new V3(0, -h, 0), 4, 4, PAL[Math.floor(k * PAL.length)], (u, v) => v, n, t * 2.1 + li, k > 0.8 ? ['#f2efe6', '#5a6e9a', '#f2efe6', '#5a6e9a'] : null);
        t += w + 0.15 + hash1(li * 3 + Math.round(t * 13)) * 0.5;
      }
    });
  } else {
    // 旗桿兩支：原創的條紋旗（不是任何國家或單位的旗），放在牆邊空著的地方
    const FLAGS = [['#c8462c', '#f0ece2', '#c8462c'], ['#2f5e8a', '#f0c75a', '#2f5e8a']], wind = new V3(0.8, 0, 0.6).normalize(), n = new V3(-wind.z, 0, wind.x);
    let made = 0;
    for (let k = 0; k < 40 && made < 2; k++) {
      const x = (hash1(k * 17 + 3) - 0.5) * 64, z = (k % 2 ? 1 : -1) * (19 + hash1(k * 5) * 5);
      if (BOXES.some((b) => b !== BOXES[0] && x + 1.6 > b.min[0] && x - 0.3 < b.max[0] && z + 1.3 > b.min[2] && z - 0.3 < b.max[2])) continue;
      if (Math.abs(x) < 12 && made === 0 && k < 20) continue;   // 盡量放在兩邊出生區附近
      const top = new V3(x, 6.2, z);
      bar(new V3(x, 0, z), top, 0.08, '#8a8c90'); bar(top, top.clone().add(new V3(0, 0.12, 0)), 0.14, '#5a5c60');
      quad(top.clone().add(new V3(0, -0.05, 0)), wind.clone().multiplyScalar(1.5), new V3(0, -0.95, 0), 8, 4, null, (u) => u, n, k * 1.3, FLAGS[made]);
      made++;
    }
  }
  if (!P.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 1)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(PH, 1)); g.setAttribute('aN', new THREE.Float32BufferAttribute(NN, 3));
  g.setIndex(I); g.computeVertexNormals();
  clothMesh = new THREE.Mesh(g, clothMat); clothMesh.frustumCulled = false;
  clothMesh.onBeforeRender = () => { CLOTH_U.value = performance.now() / 1000; };
  scene.add(clothMesh);
}
// 重建地圖網格（換地圖時）：舊的丟掉、新的加進場景
function rebuildMapMeshes() {
  for (const m of mapMeshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  mapMeshes.length = 0;
  rebuildDecor();
  for (const m of buildMapMeshes(MAX_ANISO)) { mapMeshes.push(m); scene.add(m); }
  placeGroundDetail(); buildCloth();
}
rebuildMapMeshes(); applyTheme();

// ---------- 手上的槍：另一個場景、固定視野，最後疊上去畫，不會插進牆裡 ----------
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(54, 16 / 9, 0.01, 10);

function boxMesh(w, h, d, color, x, y, z, parent, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); parent.add(m); return m;
}
// 把很多小零件合成一個幾何（每個零件可以帶自己的顏色），減少繪製次數
let VM_BEV = false;   // 建手上的槍時：大零件用有倒角的方塊（邊緣接得到光，像加工過的金屬）
function bevelBox(w, h, d, r, seg = 2) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new V3(), c = new V3(), hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const dd = v.clone().sub(c); if (dd.lengthSq() > 1e-12) { dd.normalize(); v.copy(c).addScaledVector(dd, r); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  if (seg >= 4) smoothSeams(g);
  return g;
}
// 同一個位置的頂點（方塊六個面在邊上各有一份）法線取平均，圓角才會是平滑的，不會一格一格
function smoothSeams(g) {
  const p = g.attributes.position, n = g.attributes.normal, m = new Map(), key = (i) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), a = m.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); m.set(k, a); }
  for (let i = 0; i < p.count; i++) { const a = m.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
}
function partBox(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const mn = Math.min(w, h, d), mx = Math.max(w, h, d);
  const g = VM_BEV && mn >= 0.012 && mx >= 0.03 ? bevelBox(w, h, d, Math.min(0.004, mn * 0.25)) : new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1)));
  g.userData.color = color; return g;
}
// 軟的圓角塊（手套、手指）：圓角大到接近膠囊
function partSoft(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0, k = 0.42) {
  const g = VM_BEV ? bevelBox(w, h, d, Math.min(w, h, d) * k, 4) : new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1)));
  g.userData.color = color; return g;
}
function partCyl(r, len, x, y, z, color, seg = 8) {
  const g = new THREE.CylinderGeometry(r, r, len, VM_BEV ? Math.max(seg, r > 0.012 ? 20 : 12) : seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); g.userData.color = color; return g;
}
// 多邊形轉角倒圓：每個角換成一小段圓弧（r 會依兩邊長度縮小）
function roundPoly(pts, r, seg = 4) {
  if (r <= 0) return pts;
  pts = pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5; });   // 去掉重複的點
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]), rr = Math.min(r, la / 2.2, lb / 2.2);
    const p1 = [v[0] + (a[0] - v[0]) / la * rr, v[1] + (a[1] - v[1]) / la * rr], p2 = [v[0] + (b[0] - v[0]) / lb * rr, v[1] + (b[1] - v[1]) / lb * rr];
    for (let k = 0; k <= seg; k++) { const t = k / seg, u = 1 - t; out.push([u * u * p1[0] + 2 * u * t * v[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * v[1] + t * t * p2[1]]); }
  }
  return out;
}
// 二次貝茲曲線取樣（彎彈匣、弧形槍托用）：回傳不含終點的點
function bez(p0, c, p1, n) { const o = []; for (let k = 0; k < n; k++) { const t = k / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return o; }
// 側面輪廓擠出：pts 是 [槍身 z（往後為正）, y]，w 是厚度；轉角倒圓 r、邊緣圓角
function partProfile(pts, w, x, color, r = 0.007) {
  const q = VM_BEV ? roundPoly(pts, r) : pts;
  const s = new THREE.Shape(); s.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) s.lineTo(p[0], p[1]);
  const bv = VM_BEV ? Math.min(0.006, w * 0.18) : 0.003;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, w - bv * 2), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: VM_BEV ? 3 : 1, curveSegments: 2 });
  g.translate(0, 0, -(w - bv * 2) / 2); g.rotateY(-Math.PI / 2); g.translate(x, 0, 0); g.userData.color = color; return g;
}
// 圓角矩形截面的長條（沿 z）：機匣、護木、滑套；r 是截面的圓角
function partRBar(w, h, len, x, y, z, color, r = 0.01) {
  r = Math.min(r, w / 2.05, h / 2.05);
  const pts = roundPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], r, 4);
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const bv = Math.min(0.004, len * 0.1);
  const g = new THREE.ExtrudeGeometry(s, { depth: len - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.7, bevelSegments: 2, curveSegments: 2 });
  g.translate(x, y, z - (len - bv * 2) / 2); g.userData.color = color; return g;
}
// 扳機護弓＋扳機：一圈有圓角的環（中間挖空）和一片彎的扳機，側面輪廓擠出。L 是護弓長、yb 是底、z 是中心
function partGuard(L, yb, z, color) {
  const h = Math.max(0.026, L * 0.5), z0 = z - L / 2, z1 = z + L / 2, yt = yb + h, t = 0.0045;
  const mk = (pts) => { const q = roundPoly(pts, 0.008, 4), s = new THREE.Shape(); s.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) s.lineTo(p[0], p[1]); return s; };
  const outer = mk([[z1, yt], [z0, yt], [z0 - 0.004, yb + 0.008], [z0 + 0.006, yb], [z1, yb]]);
  const hole = mk([[z1 - t, yt + 0.001], [z0 + t, yt + 0.001], [z0 + t, yb + t + 0.006], [z0 + t + 0.006, yb + t], [z1 - t, yb + t]]);
  outer.holes.push(new THREE.Path(hole.getPoints()));
  // 扳機：從上面往下彎的一片（往後彎）
  const tz = z0 + L * 0.42, blade = [...bez([tz, yt], [tz - 0.002, yt - h * 0.45], [tz + 0.008, yb + t + 0.006], 6), [tz + 0.008, yb + t + 0.006], [tz + 0.012, yb + t + 0.008], ...bez([tz + 0.004, yb + t + 0.012], [tz + 0.002, yt - h * 0.4], [tz + 0.004, yt], 6)];
  const tr = new THREE.Shape(); tr.moveTo(blade[0][0], blade[0][1]); for (const p of blade.slice(1)) tr.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry([outer, tr], { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.001, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -0.003); g.rotateY(-Math.PI / 2); g.userData.color = color; return g;
}
function mergeParts(parts) {
  const P = [], N = [], C = [], c = new THREE.Color();
  for (const p0 of parts) {
    const g = p0.index ? p0.toNonIndexed() : p0; c.set(p0.userData.color || '#ffffff');
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i += 3) { P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]); C.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere(); return g;
}
// matcap：一張畫好光影的球，貼到槍上就有金屬／塑膠的質感，不用另外打燈
function matcapTex(base, hi, rim) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = x.createRadialGradient(40, 34, 1, 64, 64, 66);
  g.addColorStop(0, hi); g.addColorStop(0.14, base); g.addColorStop(0.74, base); g.addColorStop(0.92, '#0b0c0f'); g.addColorStop(1, rim);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 塗裝（成長畫面換）：每種材質的底色
const VM_TINT = { metal: new THREE.Color(1, 1, 1), poly: new THREE.Color(1, 1, 1), cloth: new THREE.Color(1, 1, 1) };
// 手上的槍改用有光照的 PBR 材質（金屬會反射環境、塑膠是霧面），比 matcap 像真的；
// 環境反射用一張程式畫的天空／地面漸層（啟動時算一次）。這個場景只有槍和手，多出來的運算很少。
const VM_ENV = (function () {
  try {
    // 棚拍式的環境：上半部天光漸層＋幾條長形柔光箱、窗格，地平線一條亮帶，下半部暗地面。
    // 金屬上會出現清楚的長條反光、邊緣亮線，轉動時反光會滑過去。
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8ea6c0'); g.addColorStop(0.38, '#d9dde0'); g.addColorStop(0.49, '#fff6e4'); g.addColorStop(0.52, '#a89c88'); g.addColorStop(0.62, '#4a453e'); g.addColorStop(1, '#1c1a18');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const box = (x, y, w, h, a) => { const gg = c.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, `rgba(255,255,255,${a * 0.6})`); gg.addColorStop(0.5, `rgba(255,255,255,${a})`); gg.addColorStop(1, `rgba(255,255,255,${a * 0.6})`); c.fillStyle = gg; c.fillRect(x, y, w, h); };
    box(70, 40, 150, 16, 1); box(300, 30, 110, 12, 0.95); box(20, 88, 60, 8, 0.7); box(420, 80, 70, 9, 0.75);   // 長形柔光箱
    c.fillStyle = 'rgba(255,250,235,.85)'; for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) c.fillRect(230 + k * 20, 70 + j * 22, 16, 18);   // 窗格
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0, 124, W, 3);   // 地平線亮帶
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 12; k++) c.fillRect(k * 43 + 10, 140, 20, 116);   // 地面的暗塊（反光有明暗變化）
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t); pm.dispose(); t.dispose(); return rt.texture;
  } catch (e) { return null; }
})();
const VM_BASE = { metal: new THREE.Color('#40454b'), poly: new THREE.Color('#2a2a28'), cloth: new THREE.Color('#9da392') };   // 機匣是陽極處理的深灰、護木握把是更深的霧面塑膠
// 瞄準鏡鏡片：很光滑、有鍍膜，看的角度不同顏色從綠轉紫
const VM_LENS = new THREE.MeshStandardMaterial({ color: 0x0c1418, metalness: 0.1, roughness: 0.04, envMap: VM_ENV, envMapIntensity: 1.6 });
VM_LENS.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float fr = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
  totalEmissiveRadiance += mix(vec3(0.05, 0.22, 0.12), vec3(0.22, 0.06, 0.26), fr) * (0.35 + fr);`); };
const VM_MATS = {
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.3, envMap: VM_ENV, envMapIntensity: 1.1 }),
  poly: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.08, roughness: 0.55, envMap: VM_ENV, envMapIntensity: 0.75 }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.95, envMap: VM_ENV, envMapIntensity: 0.35 }),
};
const VM_HEMI = new THREE.HemisphereLight(0xe2ebf4, 0x4b463e, 0.8); vmScene.add(VM_HEMI);
const VM_SUN = new THREE.DirectionalLight(0xfff0d8, 1.7); VM_SUN.position.set(-0.6, 1.0, 0.55); vmScene.add(VM_SUN);
const VM_FILL = new THREE.DirectionalLight(0xcfe0ff, 0.5); VM_FILL.position.set(0.8, 0.2, -0.4); vmScene.add(VM_FILL);
const VM_GLOW = new THREE.DirectionalLight(0xffb070, 0); VM_GLOW.position.set(0, 1, 0); vmScene.add(VM_GLOW);   // 路燈、槍口火光、爆炸照到手上的槍
const VM_ENVI = { metal: 1.0, poly: 0.75, cloth: 0.35 };
window.VM_READY = true; applyVmTheme();
// 步槍：通用突擊步槍外形（不是任何一把真槍）。槍身朝 -z，原點在握把附近
// ---------- 手上的槍：每種武器一組模型，換槍時換掉 gunRig 裡的那組 ----------
const gunRig = new THREE.Group(); vmScene.add(gunRig);
const GLOVE = '#5a5d5e', SLEEVE = '#8a907c', CUFF = '#6a7062';
// 右手（握握把）：位置是手套中心；左手：位置是手套中心，可以是單獨的物件（換彈時會動）
// 斜放的圓柱（袖子、手指）：r1 前端、r2 後端，沿 z 長 len，再轉 rx／ry
function partCylR(r1, r2, len, x, y, z, color, rx = 0, ry = 0, seg = 10) {
  const g = new THREE.CylinderGeometry(r1, r2, len, VM_BEV && r1 >= 0.03 ? Math.max(seg, 24) : seg); g.rotateX(Math.PI / 2);   // 袖子、袖口這種粗的圓柱：段數加多
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new V3(1, 1, 1)));
  g.userData.color = color; return g;
}
const GLOVE_K = '#3e4142', KNUCK = '#4f5354';
// 右手（握握把）：袖子（圓筒＋袖口皺褶）、手背、四指包住握把、食指放在扳機護弓上、拇指從左邊壓過來
function vmRightArm(x, y, z) {
  const ox = x - 0.012, oy = y + 0.085, oz = z - 0.03;
  return [partCylR(0.045, 0.055, 0.34, 0.035 + ox, -0.14 + oy, 0.23 + oz, SLEEVE, 0.35), partCylR(0.05, 0.05, 0.05, 0.035 + ox, -0.105 + oy, 0.075 + oz, CUFF, 0.35),
    partBox(0.004, 0.06, 0.2, 0.08 + ox, -0.15 + oy, 0.26 + oz, '#7a806c', 0.35), partBox(0.004, 0.05, 0.16, -0.01 + ox, -0.15 + oy, 0.25 + oz, '#7a806c', 0.35),
    partSoft(0.065, 0.075, 0.09, 0.016 + ox, -0.085 + oy, 0.035 + oz, GLOVE, -0.3, 0, 0, 0.3), partSoft(0.05, 0.02, 0.03, 0.02 + ox, -0.05 + oy, 0.06 + oz, KNUCK, -0.3),
    // 中指、無名指、小指一根一根包住握把（越下面越短），指節上有護片
    ...[0, 1, 2].map((i) => partSoft(0.05 - i * 0.004, 0.024, 0.024, -0.004 + ox, -0.072 - i * 0.026 + oy, -0.012 + i * 0.006 + oz, GLOVE_K, 0.25)),
    ...[0, 1, 2].map((i) => partSoft(0.012, 0.018, 0.02, 0.02 + ox, -0.072 - i * 0.026 + oy, -0.0 + i * 0.006 + oz, KNUCK, 0.25)),
    partSoft(0.052, 0.012, 0.024, -0.004 + ox, -0.058 + oy, -0.014 + oz, KNUCK, 0.25),
    partSoft(0.018, 0.018, 0.034, 0.012 + ox, -0.036 + oy, -0.012 + oz, GLOVE), partSoft(0.016, 0.016, 0.03, 0.012 + ox, -0.036 + oy, -0.044 + oz, GLOVE),   // 食指兩節沿著機匣（不在扳機上）
    partSoft(0.018, 0.02, 0.055, -0.03 + ox, -0.045 + oy, 0.0 + oz, GLOVE, 0, 0.35)];   // 拇指
}
// 左手（握護木）：袖子、手背、手指從上方包住護木、拇指在右側；左手腕戴錶
function vmLeftArm(x, y, z) {
  const ox = x + 0.005, oy = y + 0.045, oz = z + 0.47;
  return [partCylR(0.045, 0.055, 0.38, -0.08 + ox, -0.12 + oy, -0.32 + oz, SLEEVE, 0.35, 0.55), partCylR(0.05, 0.05, 0.05, -0.04 + ox, -0.07 + oy, -0.43 + oz, CUFF, 0.35, 0.55),
    partBox(0.004, 0.05, 0.2, -0.13 + ox, -0.14 + oy, -0.28 + oz, '#7a806c', 0.35, 0.55),
    partBox(0.07, 0.028, 0.032, -0.05 + ox, -0.075 + oy, -0.405 + oz, '#202224', 0.35, 0.55), partBox(0.034, 0.008, 0.034, -0.05 + ox, -0.06 + oy, -0.41 + oz, '#6f7a80', 0.35, 0.55),   // 手錶
    partSoft(0.08, 0.05, 0.1, -0.005 + ox, -0.045 + oy, -0.47 + oz, GLOVE, 0, 0, 0, 0.3), partSoft(0.03, 0.06, 0.09, 0.035 + ox, -0.01 + oy, -0.47 + oz, GLOVE),
    // 四根手指從上面包住護木：一根一根分開、指尖在右側往下彎
    ...[0, 1, 2, 3].map((i) => partSoft(0.07, 0.018, 0.019, 0.0 + ox, 0.012 + oy, -0.505 + i * 0.021 + oz, GLOVE_K, 0, 0, -0.06)),
    ...[0, 1, 2, 3].map((i) => partSoft(0.016, 0.03, 0.018, 0.04 + ox, -0.004 + oy, -0.505 + i * 0.021 + oz, GLOVE_K)),
    partSoft(0.02, 0.05, 0.08, -0.04 + ox, -0.01 + oy, -0.47 + oz, KNUCK),
    partSoft(0.016, 0.02, 0.06, 0.045 + ox, -0.035 + oy, -0.45 + oz, GLOVE, 0, -0.2)];   // 拇指
}
function vmAssemble(metal, poly, cloth, left, magParts, magPos, muzzle) {
  const g = new THREE.Group();
  if (metal.length) g.add(new THREE.Mesh(mergeParts(metal), VM_MATS.metal));
  if (poly.length) g.add(new THREE.Mesh(mergeParts(poly), VM_MATS.poly));
  if (cloth.length) g.add(new THREE.Mesh(mergeParts(cloth), VM_MATS.cloth));
  const la = new THREE.Mesh(mergeParts(left.length ? left : [partBox(0.001, 0.001, 0.001, 0, 0, 0, GLOVE)]), VM_MATS.cloth); g.add(la); g.userData.leftArm = la;
  // 槍口的膛孔：黑色小圓片（從前面看得到槍管是空心的）
  if (muzzle) { const b = partCyl(0.0055, 0.004, muzzle.x, muzzle.y, muzzle.z + 0.003, '#030303', 12); g.add(new THREE.Mesh(mergeParts([b]), VM_MATS.poly)); }
  const mag = new THREE.Mesh(mergeParts(magParts), VM_MATS.metal); mag.position.copy(magPos); g.add(mag); g.userData.mag = mag; g.userData.magY = magPos.y;
  g.userData.muzzle = muzzle; g.visible = false; gunRig.add(g);
  return g;
}
const VMODELS = {};
(function buildViewmodels() {
  VM_BEV = true;
  const M = '#ffffff', D = '#9aa0a8', P = '#ffffff', P2 = '#c9bfae', K = '#4a4e55';
  // 步槍「曙七」
  {
    const metal = [
      partProfile([[0.12, -0.022], [-0.33, -0.022], [-0.33, 0.058], [0.09, 0.058], [0.12, 0.035]], 0.064, 0, M),
      partBox(0.03, 0.012, 0.36, 0, 0.066, -0.13, D), partCyl(0.019, 0.075, 0, 0.018, -0.83, D, 10),
      partBox(0.008, 0.024, 0.075, 0.017, 0.018, -0.83, K), partBox(0.008, 0.024, 0.075, -0.017, 0.018, -0.83, K),
      partBox(0.016, 0.05, 0.02, 0, 0.055, -0.56, M), partBox(0.008, 0.045, 0.012, 0, 0.0675, -0.56, D),
      partBox(0.04, 0.012, 0.05, 0, 0.066, -0.06, M), partBox(0.005, 0.03, 0.025, -0.014, 0.075, -0.06, D), partBox(0.005, 0.03, 0.025, 0.014, 0.075, -0.06, D),
      partBox(0.012, 0.012, 0.05, 0.04, 0.035, -0.04, D), partGuard(0.075, -0.056, 0.0, M),
      partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.15, '#15171a'),
    ];
    for (let k = 0; k < 10; k++) metal.push(partBox(0.034, 0.006, 0.012, 0, 0.074, -0.29 + k * 0.032, D));
    metal.push(partBox(0.0655, 0.0025, 0.4, 0, 0.012, -0.11, '#1e2023'),   // 上下機匣的接縫
      partProfile([[-0.152, -0.02], [-0.288, -0.02], [-0.294, -0.048], [-0.146, -0.048]], 0.07, 0, M, 0.004),   // 彈匣井（包住彈匣上端、往下張開）
      partBox(0.004, 0.02, 0.03, 0.034, 0.03, -0.0, D), partCyl(0.004, 0.008, 0.035, -0.01, 0.03, '#15171a', 8),
      partCylR(0.0045, 0.0045, 0.07, 0, -0.004, -0.17, D, 0, Math.PI / 2, 10), partCylR(0.0045, 0.0045, 0.07, 0, 0.0, 0.07, D, 0, Math.PI / 2, 10),   // 分解銷（貫穿下機匣，兩邊露出圓頭）
      partBox(0.004, 0.008, 0.026, -0.0345, -0.002, 0.03, D, 0.4), partCylR(0.006, 0.006, 0.004, -0.034, -0.002, 0.03, D, 0, Math.PI / 2, 10),   // 快慢機
      partBox(0.004, 0.022, 0.012, -0.0345, 0.0, -0.075, D));   // 槍機卡榫   // 前進助推、彈匣卡榫
    metal.push(partCyl(0.0125, 0.24, 0, 0.018, -0.68, M, 12), partBox(0.012, 0.008, 0.02, 0.016, 0.026, -0.84, '#0d0e10'), partBox(0.012, 0.008, 0.02, -0.016, 0.026, -0.84, '#0d0e10'),
      partBox(0.012, 0.01, 0.03, 0.033, 0.024, -0.15, '#b08a3a'), partBox(0.05, 0.012, 0.016, 0, 0.068, 0.105, D), partBox(0.016, 0.01, 0.02, 0.026, 0.068, 0.105, D),
      partCyl(0.009, 0.03, 0.036, 0.03, -0.03, D, 8), partBox(0.004, 0.02, 0.02, 0.0, -0.03, 0.31, D));
    const poly = [
      partRBar(0.072, 0.082, 0.28, 0, 0.008, -0.44, P, 0.024),   // 護木：圓角截面
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.045, 0, P),
      partProfile([[0.12, 0.05], [0.12, -0.03], [0.3, -0.095], [0.335, -0.095], [0.335, 0.058], [0.2, 0.058]], 0.056, 0, P),
      partBox(0.06, 0.13, 0.02, 0, -0.02, 0.33, P2),
    ];
    for (let k = 0; k < 5; k++) poly.push(partBox(0.074, 0.008, 0.012, 0, 0.02, -0.33 - k * 0.05, P2));
    for (let k = 0; k < 4; k++) poly.push(partBox(0.074, 0.014, 0.03, 0, -0.008, -0.36 - k * 0.055, '#2a2b2c'));   // 護木 M-LOK 槽
    for (let k = 0; k < 6; k++) poly.push(partCylR(0.006, 0.006, 0.075, 0, 0.034, -0.34 - k * 0.04, '#1c1d1e', 0, Math.PI / 2, 8));   // 護木上緣散熱孔
    poly.push(partBox(0.0745, 0.003, 0.27, 0, 0.0, -0.44, '#232425'));   // 護木上下兩半的接縫
    poly.push(partBox(0.062, 0.14, 0.012, 0, -0.02, 0.345, '#1b1c1d'));   // 槍托橡膠底板
    // 彈匣是彎的（香蕉彈匣），換彈時整個跟左手走
    VMODELS.rifle = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.045, -0.47),
      [partProfile([[0.035, 0.08], [-0.035, 0.08], ...bez([-0.035, 0.08], [-0.042, -0.02], [-0.075, -0.1], 6), [-0.075, -0.1], [-0.068, -0.112], ...bez([0.0, -0.114], [0.03, -0.03], [0.035, 0.08], 6)], 0.042, 0, M, 0.004), partBox(0.044, 0.012, 0.012, 0, 0.0, -0.01, D), partBox(0.044, 0.012, 0.012, 0, -0.04, -0.03, D), partBox(0.05, 0.016, 0.05, 0, -0.105, -0.04, '#2a2c2f', -0.2)], new V3(0, -0.1, -0.2), new V3(0, 0.018, -0.88));
  }
  // 衝鋒槍「蜂」：短機匣、短槍管、摺疊托、直彈匣
  {
    const metal = [
      partRBar(0.058, 0.07, 0.34, 0, 0.018, -0.1, M, 0.014), partCyl(0.012, 0.16, 0, 0.022, -0.34, M, 12), partCyl(0.022, 0.06, 0, 0.022, -0.44, D, 10), partBox(0.012, 0.01, 0.03, 0.031, 0.03, -0.08, '#b08a3a'),
      partBox(0.026, 0.01, 0.26, 0, 0.058, -0.1, D), partBox(0.012, 0.04, 0.014, 0, 0.068, -0.24, D), partBox(0.03, 0.02, 0.03, 0, 0.068, 0.04, D),
      partBox(0.012, 0.012, 0.04, 0.035, 0.03, -0.12, D), partGuard(0.065, -0.044, 0.0, M),
      partBox(0.012, 0.012, 0.2, 0.02, 0.0, 0.17, D), partBox(0.012, 0.012, 0.2, -0.02, 0.0, 0.17, D), partBox(0.05, 0.08, 0.015, 0, -0.02, 0.27, D),
    ];
    const poly = [
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.03, -0.14], [0.072, -0.14]], 0.045, 0, P),
      partRBar(0.065, 0.05, 0.12, 0, -0.01, -0.25, P, 0.016), partRBar(0.035, 0.09, 0.035, 0, -0.07, -0.29, P2, 0.012),
    ];
    VMODELS.smg = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.1, -0.3),
      [partBox(0.03, 0.16, 0.045, 0, -0.03, 0, M)], new V3(0, -0.08, -0.12), new V3(0, 0.022, -0.48));
  }
  // 狙擊槍「鷲」：長槍管、瞄準鏡、拉機柄、厚槍托
  {
    const metal = [
      partRBar(0.06, 0.07, 0.42, 0, 0.018, -0.12, M, 0.022), partCyl(0.014, 0.6, 0, 0.022, -0.62, M, 12), partCyl(0.02, 0.07, 0, 0.022, -0.95, D, 10),  partBox(0.012, 0.03, 0.012, 0, 0.145, -0.13, D), partBox(0.03, 0.012, 0.012, 0.035, 0.11, -0.13, D),
      partCyl(0.026, 0.3, 0, 0.11, -0.13, '#5a5f66', 10), partCyl(0.034, 0.07, 0, 0.11, -0.3, '#5a5f66', 10), partCyl(0.03, 0.06, 0, 0.11, 0.03, '#5a5f66', 10),
      // 目鏡：橡膠眼罩一圈（往後凸）＋藍綠鍍膜的鏡片（凹在裡面）
      partCyl(0.031, 0.02, 0, 0.11, 0.068, '#151617', 20),  partCyl(0.008, 0.001, 0.007, 0.117, 0.0795, '#8fb6c0', 10),
      partBox(0.02, 0.05, 0.03, 0, 0.068, -0.22, D), partBox(0.02, 0.05, 0.03, 0, 0.068, -0.02, D),
      partBox(0.06, 0.012, 0.012, 0.05, 0.03, 0.02, D), partCyl(0.012, 0.02, 0.085, 0.03, 0.02, D, 6),
      partGuard(0.07500000000000001, -0.055999999999999994, 0.0, M),
    ];
    const poly = [
      partProfile([[-0.02, -0.04], [-0.48, -0.03], [-0.48, 0.03], [-0.02, 0.04]], 0.07, 0, P),
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.048, 0, P),
      partProfile([[0.1, 0.06], [0.1, -0.04], [0.36, -0.11], [0.4, -0.11], [0.4, 0.07], [0.25, 0.07]], 0.06, 0, P),
      partBox(0.064, 0.14, 0.02, 0, -0.02, 0.4, P2),
    ];
    VMODELS.sniper = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.06, -0.4),
      [partBox(0.04, 0.06, 0.08, 0, 0, 0, M)], new V3(0, -0.05, -0.12), new V3(0, 0.022, -0.99));
    // 物鏡、目鏡：鍍膜鏡片（另外一個材質，角度不同顏色會變）
    VMODELS.sniper.add(new THREE.Mesh(mergeParts([partCyl(0.029, 0.003, 0, 0.11, -0.3365, '#ffffff', 24), partCyl(0.022, 0.002, 0, 0.11, 0.0785, '#ffffff', 20)]), VM_LENS));
  }
  // 霰彈槍「犀」：粗槍管＋下方彈倉管、泵動護木（左手握著，開槍後會拉）
  {
    const metal = [
      partRBar(0.06, 0.08, 0.3, 0, 0.015, -0.08, M, 0.016), partCyl(0.019, 0.62, 0, 0.032, -0.53, M, 12), partCyl(0.015, 0.5, 0, -0.012, -0.48, D, 10), partBox(0.016, 0.022, 0.04, 0.032, 0.02, -0.06, '#0d0e10'), partCyl(0.009, 0.02, 0.034, 0.02, -0.06, '#b33322', 8),
      partBox(0.012, 0.015, 0.015, 0, 0.056, -0.82, D), partGuard(0.07500000000000001, -0.049, 0.02, M), partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.1, '#15171a'),
    ];
    const poly = [
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.048, 0, P),
      partProfile([[0.08, 0.05], [0.08, -0.04], [0.32, -0.1], [0.35, -0.1], [0.35, 0.05], [0.2, 0.06]], 0.056, 0, P),
      partBox(0.064, 0.13, 0.02, 0, -0.025, 0.35, P2),
    ];
    // 泵動護木和左手一起動（當成左手的一部分）
    const left = vmLeftArm(-0.005, -0.05, -0.44).concat([partRBar(0.058, 0.05, 0.16, 0, -0.01, -0.44, P2, 0.02)]);
    for (let k = 0; k < 5; k++) left.push(partBox(0.062, 0.006, 0.01, 0, 0.005, -0.38 - k * 0.028, P));
    VMODELS.shotgun = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), left,
      [partCyl(0.011, 0.05, 0, 0, 0, '#c43d2a')], new V3(0.02, -0.04, -0.1), new V3(0, 0.032, -0.86));
  }
  // 手槍「隼」：滑套、雙手握
  {
    const metal = [
      partRBar(0.034, 0.042, 0.21, 0, 0.035, -0.09, M, 0.008), partRBar(0.03, 0.03, 0.17, 0, 0.0, -0.08, D, 0.006),
      partBox(0.008, 0.012, 0.01, 0, 0.061, -0.19, D), partBox(0.024, 0.012, 0.012, 0, 0.061, 0.0, D),
      partGuard(0.055, -0.034, -0.04, M), partCyl(0.009, 0.02, 0, 0.035, -0.2, '#15171a', 10), partBox(0.003, 0.008, 0.004, -0.008, 0.063, 0.0, '#e8e2c8'), partBox(0.003, 0.008, 0.004, 0.008, 0.063, 0.0, '#e8e2c8'), partBox(0.003, 0.006, 0.004, 0, 0.065, -0.19, '#e8e2c8'),
    ];
    for (let k = 0; k < 4; k++) metal.push(partBox(0.036, 0.03, 0.004, 0, 0.038, 0.0 - k * 0.01, D));
    const poly = [partProfile([[0.025, -0.012], [-0.02, -0.012], [0.005, -0.12], [0.05, -0.12]], 0.032, 0, P)];
    VMODELS.pistol = vmAssemble(metal, poly, vmRightArm(0.015, -0.075, 0.015), vmLeftArm(-0.02, -0.08, -0.0),
      [partBox(0.024, 0.09, 0.03, 0, 0, 0, M)], new V3(0.02, -0.1, 0.01), new V3(0, 0.035, -0.21));
  }
  // 卡賓槍「嵐」：平頂導軌、短槍管、伸縮管狀槍托、護木比較長
  {
    const metal = [
      partRBar(0.058, 0.072, 0.36, 0, 0.018, -0.12, M, 0.012), partCyl(0.018, 0.06, 0, 0.02, -0.68, D, 10),
      partBox(0.03, 0.012, 0.42, 0, 0.06, -0.16, D), partBox(0.012, 0.05, 0.014, 0, 0.07, -0.46, D), partBox(0.03, 0.026, 0.03, 0, 0.076, 0.0, D),
      partCyl(0.012, 0.2, 0, 0.012, 0.16, D, 14), partProfile([[0.25, 0.035], [0.25, -0.05], [0.31, -0.06], [0.315, 0.04]], 0.05, 0, K, 0.012), partGuard(0.065, -0.049, 0.0, M),
      partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.14, '#15171a'),
    ];
    for (let k = 0; k < 8; k++) metal.push(partBox(0.034, 0.006, 0.012, 0, 0.068, -0.3 + k * 0.035, D));
    metal.push(partCyl(0.012, 0.3, 0, 0.02, -0.5, M, 12), partBox(0.012, 0.01, 0.03, 0.031, 0.024, -0.14, '#b08a3a'), partBox(0.05, 0.012, 0.016, 0, 0.066, 0.075, D),
      partBox(0.01, 0.006, 0.02, 0.014, 0.026, -0.68, '#0d0e10'), partBox(0.01, 0.006, 0.02, -0.014, 0.026, -0.68, '#0d0e10'));
    const poly = [partRBar(0.07, 0.072, 0.24, 0, 0.016, -0.36, P2, 0.026), partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.14], [0.078, -0.14]], 0.045, 0, P)];
    for (let k = 0; k < 4; k++) poly.push(partBox(0.074, 0.008, 0.012, 0, 0.0, -0.28 - k * 0.045, P));
    VMODELS.carbine = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.05, -0.38),
      [partBox(0.03, 0.15, 0.05, 0, -0.03, 0, M)], new V3(0, -0.09, -0.16), new V3(0, 0.02, -0.72));
  }
  // 重手槍「雷」：大滑套、三角槍口
  {
    const metal = [
      partRBar(0.044, 0.052, 0.26, 0, 0.042, -0.1, M, 0.01), partRBar(0.038, 0.036, 0.21, 0, 0.0, -0.09, D, 0.007),
      partBox(0.01, 0.014, 0.012, 0, 0.074, -0.22, D), partBox(0.03, 0.014, 0.014, 0, 0.074, 0.02, D),
      partGuard(0.06, -0.036000000000000004, -0.04, M), partCyl(0.011, 0.02, 0, 0.042, -0.235, '#15171a'),
    ];
    for (let k = 0; k < 5; k++) metal.push(partBox(0.046, 0.034, 0.004, 0, 0.044, 0.01 - k * 0.011, D));
    const poly = [partProfile([[0.03, -0.014], [-0.024, -0.014], [0.006, -0.135], [0.058, -0.135]], 0.04, 0, P)];
    VMODELS.deagle = vmAssemble(metal, poly, vmRightArm(0.015, -0.075, 0.015), vmLeftArm(-0.02, -0.08, -0.0),
      [partBox(0.028, 0.1, 0.034, 0, 0, 0, M)], new V3(0.022, -0.1, 0.01), new V3(0, 0.042, -0.25));
  }
  // 投擲物：右手拿著（四種顏色）
  const nade = (body, band) => vmAssemble([partCyl(0.007, 0.03, 0.03, 0.06, 0.0, '#c8c2b0'), partBox(0.012, 0.05, 0.02, 0.025, 0.035, 0.02, D)],
    [partCyl(0.032, 0.1, 0, 0, 0, body, 10), partCyl(0.0335, 0.018, 0, 0, -0.02, band, 10)], vmRightArm(0.012, -0.075, 0.06), vmLeftArm(-0.04, -0.06, -0.1),
    [partBox(0.001, 0.001, 0.001, 0, 0, 0, M)], new V3(0, 0, 0), new V3(0, 0, -0.05));
  for (const g of [VMODELS.he = nade('#5d6440', '#2b2d22'), VMODELS.flash = nade('#c9cdd2', '#3b6fb0'), VMODELS.smoke = nade('#77808a', '#d8d8d8'), VMODELS.molotov = nade('#6b4a26', '#e9dfc8')]) g.children[1].rotation.x = Math.PI / 2;
  VM_BEV = false;
})();
let gun = VMODELS.rifle; gun.visible = true;
// 走進陰影時手上的槍也跟著變暗（matcap 不受場景燈光影響，用這個近似）
let vmLight = 1;
function updateViewmodelLight(dt) {
  if ((game.t * 5 | 0) !== (updateViewmodelLight.k | 0)) {
    updateViewmodelLight.k = game.t * 5 | 0;
    const p = player.body.pos; updateViewmodelLight.lit = bakeRay(p.x, p.y + player.eye, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0.78;
  }
  vmLight = lerp(vmLight, updateViewmodelLight.lit || 1, 1 - Math.exp(-4 * dt));
  const f = vmLight + Math.max(0, W.flashT) * 8;
  for (const k in VM_MATS) VM_MATS[k].color.copy(VM_TINT[k]).multiply(VM_BASE[k]).multiplyScalar(f);   // 底色 × 塗裝顏色 × 陰影明暗
  VM_SUN.intensity = 1.7 * (vmLight - 0.6) / 0.4 * (MAP.theme.night ? 0.3 : 1);   // 走進陰影：直射光變弱；夜裡是月光
  // 路燈（腳下光照貼圖的值）＋別人的槍口火光、爆炸：從最亮那盞的方向照過來
  const p = camera.position, L = lightAt(p.x, p.z), fl = flashAt(p.x, p.y, p.z, _vmd);
  const lamp = (L.warm + L.cool) * 1.4;
  VM_GLOW.color.copy(LIGHT_U.uLampW.value).multiplyScalar(L.warm).add(_lc.copy(LIGHT_U.uLampC.value).multiplyScalar(L.cool));
  if (fl > 0.05) VM_GLOW.color.lerp(_lc.set(1, 0.7, 0.4), clamp(fl / (fl + lamp + 0.01), 0, 1));
  VM_GLOW.intensity = Math.min(4, lamp + fl * 1.2);
  if (fl > 0.05) { _vmd.applyQuaternion(_vmq.copy(camera.quaternion).invert()).normalize(); VM_GLOW.position.copy(_vmd); } else VM_GLOW.position.set(0.2, 1, 0.3);
}
const _vmd = new V3(), _vmq = new THREE.Quaternion();
function starTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,210,120,.9)'); g.addColorStop(0.6, 'rgba(255,140,40,.35)'); g.addColorStop(1, 'rgba(255,100,20,0)');
  c.fillStyle = g; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 11 : 31; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  c.fill();
  return new THREE.CanvasTexture(cv);
}
const flashTex = starTexture();
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
flash.position.copy(gun.userData.muzzle); flash.visible = false; gun.add(flash);
const flash2 = flash.clone(); flash2.rotation.y = Math.PI / 2; flash2.scale.set(0.7, 1.6, 1); flash.add(flash2);
function setViewmodel(kind) {
  const g = VMODELS[kind] || VMODELS.rifle; if (g === gun) return;
  gun.visible = false; gun = g; gun.visible = true; gun.add(flash); flash.position.copy(gun.userData.muzzle);
}

// ---------- 彈道線：一小段亮線從槍口飛到命中點 ----------
const tracers = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1); tracerGeo.translate(0, 0, -0.5);
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.visible = false; scene.add(m); tracers.push({ m, life: 0 });
}
let tracerI = 0;
function spawnTracer(from, to, color, width = 0.03, enemy = false) {
  const t = tracers[tracerI++ % tracers.length];
  const dist = from.distanceTo(to); if (dist < 0.5) return;
  t.m.material.color.set(color);
  t.from = from.clone(); t.dir = _v1.subVectors(to, from).normalize().clone(); t.dist = dist; t.d = 0; t.speed = 320; t.len = Math.min(4, dist * 0.5);
  t.m.scale.set(width, width, t.len); t.m.visible = true; t.life = 1; t.enemy = enemy;
  t.m.position.copy(from); t.m.lookAt(_v2.copy(from).add(t.dir)); t.m.scale.z = 0.01;
}
function updateTracers(dt) {
  for (const t of tracers) {
    if (!t.m.visible) continue;
    t.d += t.speed * dt;
    const head = Math.min(t.d, t.dist), tail = Math.max(0, t.d - t.len);   // 尾巴用沒截斷的距離算，打到牆後會整條收進牆裡
    if (tail >= t.dist - 0.01) { t.m.visible = false; continue; }
    t.m.position.copy(t.from).addScaledVector(t.dir, head);
    t.m.scale.z = Math.max(0.01, head - tail);
    t.m.lookAt(_v2.copy(t.m.position).add(t.dir));
    // 敵人的子彈飛到你臉前時不畫（太靠近鏡頭會變成一大條）
    if (t.enemy && t.m.position.distanceTo(camera.position) < 3) t.m.visible = false;
  }
}

// ---------- 彈孔：一個 InstancedMesh 放 120 個，只花一次繪製 ----------
const decalTex = (function () {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(12,10,10,1)'); g.addColorStop(0.3, 'rgba(30,27,26,.9)'); g.addColorStop(0.58, 'rgba(45,41,38,.35)'); g.addColorStop(1, 'rgba(50,45,42,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const DECALS = 120;
const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.17),
  new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), DECALS);
decalTex.colorSpace = THREE.SRGBColorSpace;
decals.count = 0; decals.frustumCulled = false; scene.add(decals);
for (let i = 0; i < DECALS; i++) decals.setColorAt(i, new THREE.Color(1, 1, 1));
let decalI = 0;
const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _zAxis = new V3(0, 0, 1), _s1 = new V3();
function addDecal(p, n, scale = 1, color = null) {
  _v1.set(n[0], n[1], n[2]);
  _q.setFromUnitVectors(_zAxis, _v1);
  _q.multiply(new THREE.Quaternion().setFromAxisAngle(_zAxis, Math.random() * 6.28));
  const s = rand(0.8, 1.2) * scale; _s1.set(s, s, s);
  decals.setColorAt(decalI % DECALS, color || _white); decals.instanceColor.needsUpdate = true;
  _m4.compose(_v2.copy(p).addScaledVector(_v1, 0.004), _q, _s1);
  decals.setMatrixAt(decalI % DECALS, _m4); decalI++;
  decals.count = Math.min(DECALS, decalI); decals.instanceMatrix.needsUpdate = true;
}

// ---------- 煙塵、血霧：小小的一團，變大、變淡 ----------
const puffTex = (function () {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d');
  const g = c.createRadialGradient(16, 16, 1, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv);
})();
const puffs = [];
for (let i = 0; i < 24; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false }));
  s.visible = false; scene.add(s); puffs.push({ s, life: 0, max: 0.4, size: 0.3 });
}
let puffI = 0;
function spawnPuff(p, color, size = 0.35, life = 0.45, rise = 0.4) {
  const q = puffs[puffI++ % puffs.length];
  q.s.position.copy(p); q.s.material.color.set(color); q.s.material.opacity = 0.85;
  q.life = life; q.max = life; q.size = size; q.rise = rise; q.s.visible = true; q.s.scale.set(size * 0.4, size * 0.4, 1);
}
function updatePuffs(dt) {
  for (const q of puffs) {
    if (!q.s.visible) continue;
    q.life -= dt; if (q.life <= 0) { q.s.visible = false; continue; }
    const k = 1 - q.life / q.max;
    q.s.scale.setScalar(q.size * (0.4 + k * 1.2)); q.s.material.opacity = 0.85 * (1 - k);
    q.s.position.y += q.rise * dt;
  }
}

// ---------- 音效：用合成的，不載檔案。第一次點畫面才能出聲 ----------

// ---------- 彈孔顏色：一般彈孔是深色，血跡是暗紅、比較大 ----------
const _white = new THREE.Color(1, 1, 1), _blood = new THREE.Color('#8a1a12');
function addBloodSplat(p, n) { addDecal(p, n, 4.2, _blood); }

// ---------- 火花：命中金屬、頭盔時的亮點，一個 Points 只花一次繪製 ----------
const SPARKS = 160;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, map: puffTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
sparkPts.frustumCulled = false; scene.add(sparkPts);
const sparkV = new Float32Array(SPARKS * 3), sparkL = new Float32Array(SPARKS), sparkC = [];
for (let i = 0; i < SPARKS; i++) { sparkPos[i * 3 + 1] = -100; sparkC.push(new THREE.Color()); }
let sparkI = 0;
function spawnSparks(p, n, color, count) {
  if (S.quality === 'eco') count = Math.ceil(count * 0.5);   // 省電：火花減半
  const c = new THREE.Color(color);
  for (let k = 0; k < count; k++) {
    const i = sparkI++ % SPARKS;
    sparkPos[i * 3] = p.x; sparkPos[i * 3 + 1] = p.y; sparkPos[i * 3 + 2] = p.z;
    const s = rand(2.5, 6);
    sparkV[i * 3] = (n.x * 0.7 + rand(-0.6, 0.6)) * s; sparkV[i * 3 + 1] = (Math.abs(n.y) * 0.5 + rand(0.1, 0.9)) * s; sparkV[i * 3 + 2] = (n.z * 0.7 + rand(-0.6, 0.6)) * s;
    sparkL[i] = rand(0.12, 0.28); sparkC[i].copy(c);
  }
}
function updateSparks(dt) {
  for (let i = 0; i < SPARKS; i++) {
    if (sparkL[i] <= 0) continue;
    sparkL[i] -= dt;
    if (sparkL[i] <= 0) { sparkPos[i * 3 + 1] = -100; continue; }
    sparkV[i * 3 + 1] -= 12 * dt;
    sparkPos[i * 3] += sparkV[i * 3] * dt; sparkPos[i * 3 + 1] += sparkV[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkV[i * 3 + 2] * dt;
    const k = Math.min(1, sparkL[i] * 6); sparkCol[i * 3] = sparkC[i].r * k; sparkCol[i * 3 + 1] = sparkC[i].g * k; sparkCol[i * 3 + 2] = sparkC[i].b * k;
  }
  sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
}

// ---------- 碎屑：布料碎片、牆面碎石（不發光、會掉到地上），一組一個 Points、一次繪製 ----------
// 兩組：小碎屑（子彈打出來的，2.8 公分）、大塊（爆炸炸飛的，7 公分）
function mkDebris(N, size) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true })); pts.frustumCulled = false; scene.add(pts);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -100;
  return { N, geo, pos, col, V: new Float32Array(N * 3), L: new Float32Array(N), F: new Float32Array(N), i: 0, live: false };
}
const DEB_S = mkDebris(140, 0.028), DEB_B = mkDebris(60, 0.07);
const DEBRIS = DEB_S.N, debL = DEB_S.L, debPos = DEB_S.pos;   // 測試用（debrisStat）
const _debC = new THREE.Color();
// p 命中點、n 噴出的方向、color 顏色、count 數量、spd 速度、floor 落地高度、big 用大塊
function spawnDebris(p, n, color, count, spd = 2.2, floor = 0, big = false) {
  if (S.quality === 'eco') count = Math.ceil(count * 0.5);
  const D = big ? DEB_B : DEB_S; _debC.set(color); D.live = true;
  for (let k = 0; k < count; k++) {
    const i = D.i++ % D.N, s = rand(0.4, 1) * spd, sh = rand(0.6, 1.15);
    D.pos[i * 3] = p.x; D.pos[i * 3 + 1] = p.y; D.pos[i * 3 + 2] = p.z;
    D.V[i * 3] = (n.x + rand(-0.7, 0.7)) * s; D.V[i * 3 + 1] = (n.y * 0.6 + rand(0, 0.9)) * s; D.V[i * 3 + 2] = (n.z + rand(-0.7, 0.7)) * s;
    D.L[i] = rand(0.9, 1.6) * (big ? 1.8 : 1); D.F[i] = floor + (big ? 0.03 : 0.012);
    D.col[i * 3] = _debC.r * sh; D.col[i * 3 + 1] = _debC.g * sh; D.col[i * 3 + 2] = _debC.b * sh;
  }
}
function updateDebrisSet(D, dt) {
  if (!D.live) return;
  let any = false;
  const { pos, V, L, F } = D;
  for (let i = 0; i < D.N; i++) {
    if (L[i] <= 0) continue;
    any = true; L[i] -= dt;
    if (L[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
    if (pos[i * 3 + 1] <= F[i]) continue;                    // 落地就停住，等時間到消失
    V[i * 3 + 1] -= 9.8 * dt; const drag = Math.exp(-2.2 * dt); V[i * 3] *= drag; V[i * 3 + 2] *= drag;
    pos[i * 3] += V[i * 3] * dt; pos[i * 3 + 1] = Math.max(F[i], pos[i * 3 + 1] + V[i * 3 + 1] * dt); pos[i * 3 + 2] += V[i * 3 + 2] * dt;
  }
  D.geo.attributes.position.needsUpdate = true; D.geo.attributes.color.needsUpdate = true;
  D.live = any;
}
function updateDebris(dt) { updateDebrisSet(DEB_S, dt); updateDebrisSet(DEB_B, dt); }
// 某一點底下最高的地板（方塊頂）高度：碎屑、焦痕落在這裡
function floorBelow(x, y, z) { let fy = 0; for (const b of BOXES) if (x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2] && b.max[1] <= y + 0.05) fy = Math.max(fy, b.max[1]); return fy; }
// 爆炸碎屑：地面顏色的碎石往上往外炸飛
function blastDebris(p, count, spd) {
  const fy = floorBelow(p.x, p.y + 0.2, p.z), top = BOXES.find((b) => p.x > b.min[0] && p.x < b.max[0] && p.z > b.min[2] && p.z < b.max[2] && Math.abs(b.max[1] - fy) < 0.01);
  _debC3.set(TINT[top ? top.c : 'floor'] || '#8a857a').multiplyScalar(0.7);
  const o = _v3.set(p.x, fy + 0.15, p.z);
  for (let k = 0; k < 4; k++) spawnDebris(o, _v2.set(rand(-0.6, 0.6), 1, rand(-0.6, 0.6)), k === 0 ? '#2a2724' : _debC3, Math.ceil(count / 4), spd, fy);
  for (let k = 0; k < 2; k++) spawnDebris(o, _v2.set(rand(-0.5, 0.5), 1, rand(-0.5, 0.5)), k ? _debC3 : '#3a3530', Math.ceil(count / 6), spd * 0.8, fy, true);   // 大塊
  return fy;
}
const _debC3 = new THREE.Color();

// ---------- 機器人腳下的影子：沿太陽反方向拉長的柔邊橢圓，一次繪製 ----------
const shadowTex = (function () {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const blobShadows = new THREE.InstancedMesh((function () { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })(),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 12);
blobShadows.frustumCulled = false; blobShadows.count = 0; scene.add(blobShadows);
const SHADOW_YAW = Math.atan2(-SUN_DIR.x, -SUN_DIR.z);
function updateBlobShadows() {
  let n = 0;
  for (const b of bots) {
    if (!b.active || !b.g.visible || !b.alive) continue;
    const p = b.phys.pos, lit = b.lit === undefined ? 1 : b.lit;
    _q.setFromAxisAngle(_yAxis, SHADOW_YAW);
    _s1.set(0.75, 1, 2.2 * lit + 0.9 * (1 - lit));
    _m4.compose(_v1.set(p.x - SUN_DIR.x * 0.9 * lit, p.y + 0.012, p.z - SUN_DIR.z * 0.9 * lit), _q, _s1);
    blobShadows.setMatrixAt(n++, _m4);
  }
  blobShadows.count = n; blobShadows.instanceMatrix.needsUpdate = true;
}
const _yAxis = new V3(0, 1, 0);

// 槍口照亮周圍：地圖材質裡的一個 uniform，最近一次開槍的位置與強度
// muzzleLight()、updateMuzzleLight() 在 23-lights.js（同時 4 盞）

// ---------- 音效：多層合成的槍聲事先算好存起來，每發只播放；遠的聲音變悶、變小、慢一點到、分左右 ----------
let AC = null, noiseBuf = null, master = null, sendBus = null;
const BUF = {};
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.7; master.connect(comp);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    prerenderSounds();
    setTimeout(() => { if (typeof ensureReverb === 'function') ensureReverb(); }, 400);   // 混響器先建好（設定回音要做 FFT，放到開打第一幀會卡 40 毫秒以上）
  } catch (e) { AC = null; }
}
function offline(len, build) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return Promise.resolve(null);
  const sr = 44100, ctx = new OAC(2, Math.ceil(sr * len), sr);
  const nb = ctx.createBuffer(1, sr, sr), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  build(ctx, nb);
  const r = ctx.startRendering(); return r && r.then ? r : new Promise((res) => { ctx.oncomplete = (e) => res(e.renderedBuffer); });
}
function oNoise(ctx, nb, out, t, dur, type, f, q, vol, attack = 0.0005) {
  const s = ctx.createBufferSource(); s.buffer = nb; s.playbackRate.value = rand(0.9, 1.1);
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return g;
}
function oTone(ctx, out, t, dur, f0, f1, vol, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function prerenderSounds() {
  // 槍聲：衝擊（高頻爆音）＋槍身（中頻、輕微失真）＋低頻＋槍機喀聲＋殘響尾音，四種變化輪流用
  const shot = (variant) => offline(1.1, (ctx, nb) => {
    const dry = ctx.createGain(), wet = ctx.createGain(); dry.gain.value = 1; wet.gain.value = 0.28;
    const conv = ctx.createConvolver(), ir = ctx.createBuffer(2, ctx.sampleRate * 0.9, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3.2) * (i < 4400 ? i / 4400 : 1); }
    conv.buffer = ir; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(wet); wet.connect(conv); conv.connect(lp);
    const shp = ctx.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 3); } shp.curve = curve;
    dry.connect(shp); shp.connect(ctx.destination); lp.connect(ctx.destination);
    const t = 0.002, k = 1 + (variant - 1.5) * 0.04;
    oNoise(ctx, nb, bus, t, 0.012, 'highpass', 3200 * k, 0.7, 1.0);
    oNoise(ctx, nb, bus, t, 0.09, 'bandpass', 900 * k, 0.8, 0.95);
    oNoise(ctx, nb, bus, t + 0.004, 0.2, 'lowpass', 500, 0.7, 0.45);
    oTone(ctx, bus, t, 0.14, 95 * k, 42, 0.8);
    oNoise(ctx, nb, bus, t + 0.028 + variant * 0.002, 0.014, 'bandpass', 2800, 6, 0.28);
  });
  const ding = () => offline(0.4, (ctx, nb) => {     // 爆頭打到頭盔的金屬「叮」
    oNoise(ctx, nb, ctx.destination, 0.001, 0.01, 'bandpass', 4200, 12, 0.9);
    oTone(ctx, ctx.destination, 0.001, 0.22, 3100, 3000, 0.28); oTone(ctx, ctx.destination, 0.001, 0.16, 4700, 4600, 0.18);
  });
  const thud = () => offline(0.15, (ctx, nb) => {    // 打到身體的悶聲
    oNoise(ctx, nb, ctx.destination, 0.001, 0.05, 'lowpass', 260, 1, 1.0); oNoise(ctx, nb, ctx.destination, 0.001, 0.02, 'bandpass', 1200, 2, 0.5);
  });
  const jobs = [shot(0), shot(1), shot(2), shot(3), ding(), thud()];
  Promise.all(jobs).then((r) => { if (r[0]) { BUF.shot = r.slice(0, 4); BUF.head = r[4]; BUF.hit = r[5]; } }).catch(() => { /* 不支援就用即時合成 */ });
}
// spatial()（位置 → 音量、悶、左右或 HRTF、延遲）在 41-sound3d.js
function playBuf(buf, vol, o = {}) {
  const s = AC.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || rand(0.96, 1.04);
  let node = s;
  if (o.lp && o.lp < 17000) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
  const g = AC.createGain(); g.gain.value = vol; node.connect(g);
  connectOut(g, o.pan, buf.duration / s.playbackRate.value + (o.delay || 0), o.rev !== false);   // 左右或 HRTF＋殘響
  s.start(AC.currentTime + (o.delay || 0));
}
function noise(dur, freq, q, vol, type = 'lowpass', at = 0, pan = 0) {
  const t = AC.currentTime + at, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g);
  connectOut(g, pan, dur + at, true, !!(pan && pan.low));
  src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
}
function tone(freq, dur, vol, type = 'square', at = 0, slide = 0) {
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
let shotI = 0;
function sfx(kind, vol = 1, o = {}) {
  if (window.__sfxLog) window.__sfxLog.push(kind);   // 測試用
  if (!AC || !S.sound || vol < 0.02) return;
  if (kind === 'shot') {
    // 每把槍用同一組槍聲換音高、音量（手槍尖、狙擊低沉、霰彈多一層低頻）
    const w = (o.w && o.w.snd) || { rate: 1, vol: 0.9 };
    if (BUF.shot) playBuf(BUF.shot[shotI++ % 4], w.vol, { rate: w.rate * rand(0.97, 1.03) });
    else { noise(0.16, 2400, 0.7, 0.9); noise(0.09, 600, 1, 0.8); tone(140, 0.08, 0.35, 'sine', 0, 50); }
    if (w.rate < 0.85) { noise(0.25, 220, 0.8, 0.5); tone(70, 0.22, 0.35, 'sine', 0, 35); }
  } else if (kind === 'botshot') {
    const sp = o.pos ? spatial(o.pos) : { vol, lp: 6000, pan: 0, delay: 0 }, w = (o.w && o.w.snd) || { rate: 1, vol: 0.9 };
    if (BUF.shot) playBuf(BUF.shot[shotI++ % 4], sp.vol * 0.95 * w.vol, { lp: sp.lp, pan: sp.pan, delay: sp.delay, rate: w.rate * rand(0.92, 0.98) });
    else { noise(0.14, 1500, 0.8, 0.7 * sp.vol); }
  } else if (kind === 'boom' || kind === 'bang' || kind === 'hiss' || kind === 'clink' || kind === 'beep' || kind === 'bombboom') {
    const sp = o.pos ? spatial(o.pos) : { vol: 1, pan: 0 }, v = vol * sp.vol, pn = sp.pan;
    if (kind === 'boom') { noise(0.6, 380, 0.7, 1.2 * v, 'lowpass', 0, pn); noise(0.12, 2200, 0.6, 0.6 * v, 'lowpass', 0, pn); tone(55, 0.5, 0.6 * v, 'sine', 0, 30); }
    else if (kind === 'bombboom') { noise(1.6, 260, 0.7, 1.6 * v, 'lowpass', 0, pn); noise(0.3, 1800, 0.6, 0.9 * v, 'lowpass', 0, pn); tone(42, 1.2, 0.9 * v, 'sine', 0, 22); }
    else if (kind === 'bang') { noise(0.25, 3500, 0.5, 1.0 * v, 'highpass', 0, pn); noise(0.4, 600, 0.7, 0.6 * v, 'lowpass', 0, pn); }
    else if (kind === 'hiss') noise(1.4, 1600, 0.4, 0.35 * v, 'bandpass', 0, pn);
    else if (kind === 'clink') noise(0.04, 3000 + Math.random() * 800, 8, 0.35 * v, 'bandpass', 0, pn);
    else if (kind === 'beep') { const t = AC.currentTime, osc = AC.createOscillator(), g = AC.createGain(); osc.type = 'square'; osc.frequency.value = 2100;
      g.gain.setValueAtTime(0.09 * Math.max(0.25, v), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + 0.1); }
  } else if (kind === 'ring') { tone(3800, 2.4 * vol + 0.4, 0.05 * vol, 'sine'); }
  else if (kind === 'cash') { tone(1568, 0.06, 0.07, 'triangle'); tone(2093, 0.12, 0.07, 'triangle', 0.05); }
  else if (kind === 'plant') { noise(0.05, 2000, 5, 0.3, 'bandpass'); tone(1400, 0.05, 0.05, 'square', 0.02); } else if (kind === 'hit') { if (BUF.hit) playBuf(BUF.hit, 0.8); else tone(1500, 0.05, 0.18, 'square'); }
  else if (kind === 'head') { if (BUF.head) playBuf(BUF.head, 0.75, { rate: 1 }); else { tone(2100, 0.05, 0.2, 'square'); tone(2800, 0.06, 0.14, 'square', 0.03); } }
  else if (kind === 'kill') { tone(880, 0.06, 0.09, 'triangle'); tone(1320, 0.1, 0.09, 'triangle', 0.05); tone(120, 0.12, 0.22, 'sine', 0, 55); }   // 兩聲高音＋一聲低沉的確認
  else if (kind === 'headkill') { tone(2600, 0.05, 0.08, 'square'); tone(1760, 0.18, 0.08, 'triangle', 0.04); noise(0.05, 5200, 2, 0.25, 'highpass'); }
  else if (kind === 'dink') { tone(3300, 0.2, 0.09, 'sine'); tone(4900, 0.12, 0.05, 'sine'); noise(0.012, 5000, 10, 0.4, 'bandpass'); }
  else if (kind === 'hurt') { noise(0.12, 300, 1, 0.8); tone(90, 0.12, 0.3, 'sine'); }
  else if (kind === 'magout') { noise(0.05, 1800, 3, 0.4, 'bandpass'); noise(0.04, 900, 2, 0.3, 'bandpass', 0.05); }
  else if (kind === 'magin') { noise(0.05, 2500, 4, 0.5, 'bandpass'); noise(0.04, 3200, 4, 0.45, 'bandpass', 0.07); noise(0.03, 1600, 3, 0.4, 'bandpass', 0.28); }
  else if (kind === 'empty') tone(2600, 0.03, 0.12, 'square');
  else if (kind === 'step') {
    // 腳步：低頻的落腳＋鞋底摩擦；依地面材質換聲音，可帶位置（機器人的腳步）
    let v = vol, pan = o.pan || 0;
    if (o.pos) { const sp = spatial(o.pos); v *= sp.vol * 1.4; pan = sp.pan; if (pan && typeof pan === 'object') pan.low = true; }
    if (o.pos && v < 0.02) return;
    const surf = MAT_OF[o.surface] || 'floor', r = o.rate || 1;
    noise(0.035, 350 * r, 1.2, 0.35 * v, 'lowpass', 0, pan); noise(0.018, 1800 * r, 1.5, 0.12 * v, 'bandpass', 0.008, pan);
    if (surf === 'container' || surf === 'metal') noise(0.08, 2400 * r, 9, 0.12 * v, 'bandpass', 0.004, pan);
    else if (surf === 'wood') noise(0.05, 700 * r, 5, 0.18 * v, 'bandpass', 0.004, pan);
    else if (surf === 'gravel') { noise(0.07, 3200 * r, 1.2, 0.16 * v, 'highpass', 0.004, pan); noise(0.05, 1400 * r, 1.5, 0.1 * v, 'bandpass', 0.02, pan); }
    else if (surf === 'cobble') noise(0.03, 2600 * r, 3, 0.12 * v, 'bandpass', 0.003, pan);
  }
  else if (kind === 'land') { noise(0.1, 420, 1, 0.45 * vol); noise(0.03, 1600, 2, 0.15 * vol, 'bandpass', 0.01); }
  else if (kind === 'ping') noise(0.05, 4500, 6, 0.25 * vol, 'bandpass');
  else if (kind === 'win') { tone(523, 0.18, 0.12, 'triangle'); tone(659, 0.18, 0.12, 'triangle', 0.14); tone(784, 0.35, 0.14, 'triangle', 0.28); }
  else if (kind === 'lose') { tone(392, 0.25, 0.12, 'triangle'); tone(311, 0.45, 0.12, 'triangle', 0.2); }
  else if (kind === 'go') { tone(880, 0.08, 0.1, 'square'); tone(1320, 0.12, 0.1, 'square', 0.09); }
}

// ---------- 地圖環境音：底層的風聲（循環噪音＋慢慢起伏）＋不定時的事件聲（海鷗、鳥、鐘、火車鳴笛） ----------
const AMB = { node: null, gain: null, lfoT: 0, nextT: 3, kind: '' };
function ambStart() {
  if (!AC || AMB.node) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
  const g = AC.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  AMB.node = src; AMB.gain = g; AMB.filter = f;
}
function updateAmbience(dt) {
  if (!AC) return;
  if (!AMB.node) ambStart();
  const on = S.sound && !document.hidden;
  AMB.lfoT += dt;
  const k = MAP.theme.amb, base = k === 'rail' ? 0.05 : k === 'town' ? 0.025 : k === 'night' ? 0.028 : 0.04;
  const target = on ? base * (0.7 + 0.3 * Math.sin(AMB.lfoT * 0.35) + 0.15 * Math.sin(AMB.lfoT * 1.3)) : 0;
  AMB.gain.gain.value += (target - AMB.gain.gain.value) * Math.min(1, dt * 2);
  AMB.filter.frequency.value = k === 'town' ? 700 : k === 'rail' ? 320 : k === 'night' ? 300 : 450;
  if (!on || (AMB.nextT -= dt) > 0) return;
  AMB.nextT = rand(6, 16);
  const pan = rand(-0.7, 0.7), r = Math.random();
  if (k === 'night') {
    if (r < 0.5) { const f = rand(4200, 4800); for (let i = 0; i < 6; i++) tonePan(f, 0.035, 0.012, 'sine', i * 0.07 + (i > 2 ? 0.25 : 0), f * 0.98, pan); }   // 蟲鳴
    else if (r < 0.8) { tonePan(98, 2.8, 0.035, 'sawtooth', 0, 96, pan, 420); tonePan(123, 2.8, 0.025, 'sawtooth', 0, 121, pan, 420); }   // 遠處船笛
    else { for (const [f, v] of [[880, 0.02], [1320, 0.008]]) tonePan(f, 3, v, 'sine', 0, f * 0.997, pan); }                              // 浮標的鈴
  } else if (k === 'harbor') {
    if (r < 0.7) { for (let i = 0; i < 2; i++) tonePan(rand(1500, 1900), 0.18, 0.025, 'triangle', i * 0.22, rand(1100, 1300), pan); }   // 海鷗
    else { tonePan(110, 2.2, 0.04, 'sawtooth', 0, 108, pan, 500); tonePan(138, 2.2, 0.03, 'sawtooth', 0, 136, pan, 500); }               // 遠處船笛
  } else if (k === 'town') {
    if (r < 0.75) { const n = 3 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) tonePan(rand(3000, 4200), 0.06, 0.018, 'sine', i * 0.09, rand(2600, 4600), pan); }   // 鳥
    else { for (const [f, v] of [[523, 0.04], [1046, 0.015], [1570, 0.01]]) tonePan(f, 2.6, v, 'sine', 0, f * 0.995, pan); }              // 鐘
  } else {
    if (r < 0.55) { tonePan(311, 1.6, 0.035, 'sawtooth', 0, 305, pan, 900); tonePan(392, 1.6, 0.03, 'sawtooth', 0, 385, pan, 900); }     // 火車鳴笛
    else noise(0.25, 2400, 7, 0.05, 'bandpass', 0, pan);                                                                               // 金屬碰撞
  }
}
function tonePan(freq, dur, vol, type, at, slide, pan, lp) {
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.15, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o; if (lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
  node.connect(g);
  connectOut(g, pan, dur + at, typeof pan === 'object');
  o.start(t); o.stop(t + dur + 0.05);
}
