/* ===== 40-scene：畫面、燈光、特效（彈道線、彈孔、煙塵）、音效 ===== */
const canvas = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__STRIKE_TEST });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false; renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c9a79a', 50, 150);
const BASE_FOV = 75, ADS_FOV = 48;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 16 / 9, 0.05, 500);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight('#ffe6c8', '#4a4f5c', 1.55));
const sunLight = new THREE.DirectionalLight('#ffc98e', 1.7);
sunLight.position.copy(SUN_DIR).multiplyScalar(50);
scene.add(sunLight);
const mapMesh = buildMapMesh(); scene.add(mapMesh);
const sky = buildSky(); scene.add(sky);

// ---------- 手上的槍：另一個場景、固定視野，最後疊上去畫，不會插進牆裡 ----------
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(54, 16 / 9, 0.01, 10);
vmScene.add(new THREE.HemisphereLight('#ffe6c8', '#3d4250', 1.6));
const vmSun = new THREE.DirectionalLight('#ffd2a0', 1.5); vmSun.position.set(0.6, 1, 0.4); vmScene.add(vmSun);

function boxMesh(w, h, d, color, x, y, z, parent, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); parent.add(m); return m;
}
// 步槍模型：槍身朝 -z，原點在握把附近。照片上看不出是哪一把真槍——通用的突擊步槍外形
const gun = new THREE.Group();
const gunRig = new THREE.Group(); gunRig.add(gun); vmScene.add(gunRig);
(function buildGun() {
  const metal = new THREE.MeshLambertMaterial({ color: '#2c3036' }), dark = new THREE.MeshLambertMaterial({ color: '#1c1f24' });
  const poly = new THREE.MeshLambertMaterial({ color: '#6b5a43' }), sleeve = new THREE.MeshLambertMaterial({ color: '#4b5560' }), skin = new THREE.MeshLambertMaterial({ color: '#c4936d' });
  boxMesh(0.07, 0.085, 0.42, 0, 0, 0.02, -0.12, gun, metal);         // 機匣
  boxMesh(0.06, 0.065, 0.26, 0, 0, 0.0, -0.44, gun, poly);           // 護木
  boxMesh(0.028, 0.028, 0.3, 0, 0, 0.015, -0.66, gun, dark);         // 槍管
  boxMesh(0.04, 0.04, 0.06, 0, 0, 0.015, -0.82, gun, dark);          // 槍口
  boxMesh(0.06, 0.07, 0.24, 0, 0, -0.005, 0.18, gun, poly);          // 槍托
  boxMesh(0.06, 0.12, 0.05, 0, 0, -0.03, 0.29, gun, poly);           // 托底
  boxMesh(0.045, 0.11, 0.05, 0, 0, -0.08, 0.0, gun, poly).rotation.x = -0.35;   // 握把
  gun.userData.mag = boxMesh(0.045, 0.16, 0.07, 0, 0, -0.1, -0.2, gun, dark); gun.userData.mag.rotation.x = 0.22;   // 彈匣
  boxMesh(0.04, 0.012, 0.05, 0, 0, 0.066, -0.06, gun, dark);         // 照門底座
  boxMesh(0.01, 0.03, 0.03, 0, -0.014, 0.075, -0.06, gun, dark);     // 照門左右兩片，中間留縫
  boxMesh(0.01, 0.03, 0.03, 0, 0.014, 0.075, -0.06, gun, dark);
  boxMesh(0.008, 0.045, 0.012, 0, 0, 0.0675, -0.56, gun, dark);      // 準星
  // 右手與左手（袖子＋手）
  const rh = boxMesh(0.07, 0.08, 0.32, 0, 0.03, -0.12, 0.2, gun, sleeve); rh.rotation.x = 0.25;
  boxMesh(0.06, 0.06, 0.08, 0, 0.01, -0.07, 0.02, gun, skin);
  const lh = boxMesh(0.07, 0.08, 0.36, 0, -0.07, -0.08, -0.32, gun, sleeve); lh.rotation.set(0.35, 0.55, 0);
  boxMesh(0.07, 0.05, 0.08, 0, 0, -0.04, -0.46, gun, skin);
  gun.userData.muzzle = new V3(0, 0.015, -0.86);
})();
// 槍口火光
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
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
flash.position.copy(gun.userData.muzzle); flash.visible = false; gun.add(flash);
const flash2 = flash.clone(); flash2.rotation.y = Math.PI / 2; flash2.scale.set(0.7, 1.6, 1); flash.add(flash2);

// ---------- 彈道線：一小段亮線從槍口飛到命中點 ----------
const tracers = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1); tracerGeo.translate(0, 0, -0.5);
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
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
let decalI = 0;
const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _zAxis = new V3(0, 0, 1), _s1 = new V3();
function addDecal(p, n) {
  _v1.set(n[0], n[1], n[2]);
  _q.setFromUnitVectors(_zAxis, _v1);
  _q.multiply(new THREE.Quaternion().setFromAxisAngle(_zAxis, Math.random() * 6.28));
  const s = rand(0.8, 1.2); _s1.set(s, s, s);
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
let AC = null, noiseBuf = null, master = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(dur, freq, q, vol, type = 'lowpass', at = 0) {
  const t = AC.currentTime + at, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
}
function tone(freq, dur, vol, type = 'square', at = 0, slide = 0) {
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function sfx(kind, vol = 1) {
  if (!AC || !S.sound || vol < 0.02) return;
  if (kind === 'shot') { noise(0.16, 2400, 0.7, 0.9 * vol); noise(0.09, 600, 1, 0.8 * vol); tone(140, 0.08, 0.35 * vol, 'sine', 0, 50); }
  else if (kind === 'botshot') { noise(0.14, 1500, 0.8, 0.7 * vol); tone(110, 0.06, 0.2 * vol, 'sine', 0, 50); }
  else if (kind === 'hit') tone(1500, 0.05, 0.18, 'square');
  else if (kind === 'head') { tone(2100, 0.05, 0.2, 'square'); tone(2800, 0.06, 0.14, 'square', 0.03); }
  else if (kind === 'kill') { tone(900, 0.07, 0.2, 'triangle'); tone(1350, 0.12, 0.2, 'triangle', 0.06); }
  else if (kind === 'hurt') { noise(0.12, 300, 1, 0.8); tone(90, 0.12, 0.3, 'sine'); }
  else if (kind === 'magout') noise(0.06, 1800, 3, 0.4, 'bandpass');
  else if (kind === 'magin') { noise(0.05, 2500, 4, 0.5, 'bandpass'); noise(0.04, 3200, 4, 0.4, 'bandpass', 0.07); }
  else if (kind === 'empty') tone(2600, 0.03, 0.12, 'square');
  else if (kind === 'step') noise(0.06, 700, 1.2, 0.12 * vol);
  else if (kind === 'land') noise(0.1, 500, 1, 0.3);
  else if (kind === 'ping') noise(0.05, 4500, 6, 0.25 * vol, 'bandpass');
}
