/* ===== 40-scene：畫面、燈光、手上的槍、特效（彈道線、彈孔、火花、煙塵、火光、影子）、音效 ===== */
const canvas = $('cv');
// 抗鋸齒只能在建立時決定：省電模式不開（切換畫質後重新整理才會生效）
const renderer = new THREE.WebGLRenderer({ canvas, antialias: S.quality !== 'eco', powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__STRIKE_TEST });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.autoClear = false; renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d6a98d', 40, 175);
const BASE_FOV = 75, ADS_FOV = 48;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 16 / 9, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

// 破曉的冷暖對比：環境光偏冷藍、太陽低而暖
scene.add(new THREE.HemisphereLight('#b4c4e4', '#6a5646', 1.25));
const sunLight = new THREE.DirectionalLight('#ffb070', 2.9);
sunLight.position.copy(SUN_DIR).multiplyScalar(50);
scene.add(sunLight);
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const mapMeshes = buildMapMeshes(MAX_ANISO); for (const m of mapMeshes) scene.add(m);
const skyline = buildSkyline(); scene.add(skyline);
const sky = buildSky(); scene.add(sky);

// ---------- 手上的槍：另一個場景、固定視野，最後疊上去畫，不會插進牆裡 ----------
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(54, 16 / 9, 0.01, 10);

function boxMesh(w, h, d, color, x, y, z, parent, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); parent.add(m); return m;
}
// 把很多小零件合成一個幾何（每個零件可以帶自己的顏色），減少繪製次數
function partBox(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1)));
  g.userData.color = color; return g;
}
function partCyl(r, len, x, y, z, color, seg = 8) {
  const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); g.userData.color = color; return g;
}
// 側面輪廓擠出：pts 是 [槍身 z（往後為正）, y]，w 是厚度
function partProfile(pts, w, x, color) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2); g.translate(x, 0, 0); g.userData.color = color; return g;
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
  const g = x.createRadialGradient(46, 38, 3, 64, 64, 64);
  g.addColorStop(0, hi); g.addColorStop(0.32, base); g.addColorStop(0.82, '#0b0c0f'); g.addColorStop(1, rim);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const VM_MATS = {
  metal: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#5c636c', '#eef3f8', '#6a6258'), vertexColors: true }),
  poly: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#57513f', '#bdb39a', '#5a5242'), vertexColors: true }),
  cloth: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#6f7566', '#c4c9b6', '#4d4b42'), vertexColors: true }),
};
// 步槍：通用突擊步槍外形（不是任何一把真槍）。槍身朝 -z，原點在握把附近
const gun = new THREE.Group();
const gunRig = new THREE.Group(); gunRig.add(gun); vmScene.add(gunRig);
(function buildGun() {
  const M = '#ffffff', D = '#9aa0a8', P = '#ffffff', P2 = '#c9bfae';
  const metal = [
    partProfile([[0.12, -0.022], [-0.33, -0.022], [-0.33, 0.058], [0.09, 0.058], [0.12, 0.035]], 0.064, 0, M),   // 機匣
    partBox(0.03, 0.012, 0.36, 0, 0.066, -0.13, D),                                                       // 上導軌
    partCyl(0.0125, 0.24, 0, 0.018, -0.68, M), partCyl(0.019, 0.075, 0, 0.018, -0.83, D, 6),             // 槍管、消焰器
    partBox(0.008, 0.024, 0.075, 0.017, 0.018, -0.83, '#4a4e55'), partBox(0.008, 0.024, 0.075, -0.017, 0.018, -0.83, '#4a4e55'),
    partBox(0.016, 0.05, 0.02, 0, 0.055, -0.56, M), partBox(0.008, 0.045, 0.012, 0, 0.0675, -0.56, D),     // 準星座、準星
    partBox(0.04, 0.012, 0.05, 0, 0.066, -0.06, M), partBox(0.01, 0.03, 0.03, -0.014, 0.075, -0.06, D), partBox(0.01, 0.03, 0.03, 0.014, 0.075, -0.06, D),  // 照門
    partBox(0.012, 0.012, 0.05, 0.04, 0.035, -0.04, D),                                                   // 拉機柄
    partBox(0.006, 0.006, 0.07, 0, -0.052, 0.0, M), partBox(0.006, 0.03, 0.006, 0, -0.038, 0.035, M),     // 扳機護弓
    partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.15, '#15171a'),                                             // 拋殼口
  ];
  for (let k = 0; k < 10; k++) metal.push(partBox(0.034, 0.006, 0.012, 0, 0.074, -0.29 + k * 0.032, D));   // 導軌齒
  const poly = [
    partProfile([[-0.3, -0.036], [-0.58, -0.03], [-0.58, 0.046], [-0.3, 0.052]], 0.072, 0, P),           // 護木
    partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.045, 0, P),           // 握把
    partProfile([[0.12, 0.05], [0.12, -0.03], [0.3, -0.095], [0.335, -0.095], [0.335, 0.058], [0.2, 0.058]], 0.056, 0, P),  // 槍托
    partBox(0.06, 0.13, 0.02, 0, -0.02, 0.33, P2),                                                        // 托底板
  ];
  for (let k = 0; k < 5; k++) { poly.push(partBox(0.074, 0.008, 0.012, 0, 0.02, -0.33 - k * 0.05, P2)); }   // 護木散熱溝
  // 手：手套、袖子（右手握握把、左手托護木）
  const glove = '#5a5d5e', sleeve = '#ffffff', cuff = '#c8ccc0';
  const cloth = [
    partBox(0.085, 0.09, 0.34, 0.035, -0.135, 0.22, sleeve, 0.35), partBox(0.095, 0.1, 0.05, 0.035, -0.105, 0.07, cuff, 0.35),
    partBox(0.065, 0.075, 0.09, 0.012, -0.085, 0.03, glove, -0.3), partBox(0.06, 0.02, 0.05, -0.02, -0.06, -0.02, glove),
    partBox(0.085, 0.09, 0.38, -0.08, -0.115, -0.32, sleeve, 0.35, 0.55), partBox(0.095, 0.1, 0.05, -0.04, -0.07, -0.43, cuff, 0.35, 0.55),
    partBox(0.08, 0.05, 0.1, -0.005, -0.045, -0.47, glove), partBox(0.03, 0.06, 0.09, 0.035, -0.01, -0.47, glove),
  ];
  gun.add(new THREE.Mesh(mergeParts(metal), VM_MATS.metal));
  gun.add(new THREE.Mesh(mergeParts(poly), VM_MATS.poly));
  gun.add(new THREE.Mesh(mergeParts(cloth), VM_MATS.cloth));
  // 彈匣（換彈時會動，單獨一個）：往前彎的長條
  const mag = new THREE.Mesh(mergeParts([partProfile([[0.035, 0.08], [-0.035, 0.08], [-0.07, -0.1], [0.002, -0.112]], 0.042, 0, '#ffffff')]), VM_MATS.metal);
  mag.position.set(0, -0.1, -0.2); gun.add(mag); gun.userData.mag = mag;
  gun.userData.muzzle = new V3(0, 0.018, -0.88);
})();
// 走進陰影時手上的槍也跟著變暗（matcap 不受場景燈光影響，用這個近似）
let vmLight = 1;
function updateViewmodelLight(dt) {
  if ((game.t * 5 | 0) !== (updateViewmodelLight.k | 0)) {
    updateViewmodelLight.k = game.t * 5 | 0;
    const p = player.body.pos; updateViewmodelLight.lit = bakeRay(p.x, p.y + player.eye, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 60) < 0 ? 1 : 0.78;
  }
  vmLight = lerp(vmLight, updateViewmodelLight.lit || 1, 1 - Math.exp(-4 * dt));
  const f = vmLight + Math.max(0, W.flashT) * 8;
  for (const m of Object.values(VM_MATS)) m.color.setScalar(f);
}
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
    const head = Math.min(t.d, t.dist), tail = Math.max(0, head - t.len);
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
  g.addColorStop(0, 'rgba(10,10,12,1)'); g.addColorStop(0.3, 'rgba(25,24,26,.95)'); g.addColorStop(0.55, 'rgba(50,46,44,.5)'); g.addColorStop(1, 'rgba(60,55,50,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const DECALS = 120;
const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.13),
  new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), DECALS);
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
const _white = new THREE.Color(1, 1, 1), _blood = new THREE.Color('#7a1510');
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

// ---------- 機器人腳下的影子：沿太陽反方向拉長的柔邊橢圓，一次繪製 ----------
const shadowTex = (function () {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const blobShadows = new THREE.InstancedMesh((function () { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })(),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 8);
blobShadows.frustumCulled = false; blobShadows.count = 0; scene.add(blobShadows);
const SHADOW_YAW = Math.atan2(-SUN_DIR.x, -SUN_DIR.z);
function updateBlobShadows() {
  let n = 0;
  for (const b of bots) {
    if (!b.g.visible) continue;
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
function muzzleLight(p, strength) { const u = MAP_UNI.uFlash.value; if (strength >= u.w * 0.8) u.set(p.x, p.y, p.z, strength); }
function updateMuzzleLight(dt) { MAP_UNI.uFlash.value.w *= Math.exp(-dt * 40); }

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
// 依位置算音量、悶的程度、左右、延遲
function spatial(pos) {
  const pp = player.body.pos, dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  const rel = angDiff(player.yaw, Math.atan2(-dx, -dz));
  return { d, vol: 1 / (1 + d / 12), lp: clamp(18000 * Math.exp(-d / 22), 900, 18000), pan: clamp(-Math.sin(rel) * 0.8, -0.8, 0.8), delay: d / 343 };
}
function playBuf(buf, vol, o = {}) {
  const s = AC.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || rand(0.96, 1.04);
  let node = s;
  if (o.lp && o.lp < 17000) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
  const g = AC.createGain(); g.gain.value = vol; node.connect(g); node = g;
  if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
  node.connect(master); s.start(AC.currentTime + (o.delay || 0));
}
function noise(dur, freq, q, vol, type = 'lowpass', at = 0, pan = 0) {
  const t = AC.currentTime + at, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g);
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
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
  if (!AC || !S.sound || vol < 0.02) return;
  if (kind === 'shot') {
    if (BUF.shot) playBuf(BUF.shot[shotI++ % 4], 0.9);
    else { noise(0.16, 2400, 0.7, 0.9); noise(0.09, 600, 1, 0.8); tone(140, 0.08, 0.35, 'sine', 0, 50); }
  } else if (kind === 'botshot') {
    const sp = o.pos ? spatial(o.pos) : { vol, lp: 6000, pan: 0, delay: 0 };
    if (BUF.shot) playBuf(BUF.shot[shotI++ % 4], sp.vol * 0.85, { lp: sp.lp, pan: sp.pan, delay: sp.delay, rate: rand(0.92, 0.98) });
    else { noise(0.14, 1500, 0.8, 0.7 * sp.vol); }
  } else if (kind === 'hit') { if (BUF.hit) playBuf(BUF.hit, 0.8); else tone(1500, 0.05, 0.18, 'square'); }
  else if (kind === 'head') { if (BUF.head) playBuf(BUF.head, 0.75, { rate: 1 }); else { tone(2100, 0.05, 0.2, 'square'); tone(2800, 0.06, 0.14, 'square', 0.03); } }
  else if (kind === 'kill') { tone(880, 0.06, 0.09, 'triangle'); tone(1320, 0.1, 0.09, 'triangle', 0.05); }
  else if (kind === 'hurt') { noise(0.12, 300, 1, 0.8); tone(90, 0.12, 0.3, 'sine'); }
  else if (kind === 'magout') { noise(0.05, 1800, 3, 0.4, 'bandpass'); noise(0.04, 900, 2, 0.3, 'bandpass', 0.05); }
  else if (kind === 'magin') { noise(0.05, 2500, 4, 0.5, 'bandpass'); noise(0.04, 3200, 4, 0.45, 'bandpass', 0.07); noise(0.03, 1600, 3, 0.4, 'bandpass', 0.28); }
  else if (kind === 'empty') tone(2600, 0.03, 0.12, 'square');
  else if (kind === 'step') {
    // 腳步：低頻的落腳＋鞋底摩擦；依地面材質換聲音，可帶位置（機器人的腳步）
    let v = vol, pan = o.pan || 0;
    if (o.pos) { const sp = spatial(o.pos); v *= sp.vol * 1.4; pan = sp.pan; }
    const surf = MAT_OF[o.surface] || 'floor', r = o.rate || 1;
    noise(0.035, 350 * r, 1.2, 0.35 * v, 'lowpass', 0, pan); noise(0.018, 1800 * r, 1.5, 0.12 * v, 'bandpass', 0.008, pan);
    if (surf === 'container' || surf === 'metal') noise(0.08, 2400 * r, 9, 0.12 * v, 'bandpass', 0.004, pan);
    else if (surf === 'wood') noise(0.05, 700 * r, 5, 0.18 * v, 'bandpass', 0.004, pan);
  }
  else if (kind === 'land') { noise(0.1, 420, 1, 0.45 * vol); noise(0.03, 1600, 2, 0.15 * vol, 'bandpass', 0.01); }
  else if (kind === 'ping') noise(0.05, 4500, 6, 0.25 * vol, 'bandpass');
}
