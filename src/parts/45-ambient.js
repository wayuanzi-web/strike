// ---------- 畫面氣氛：太陽鏡頭光暈、空氣中的浮塵、天上的鳥 ----------
// 全部很便宜：光暈是幾個 DOM 圓（螢幕混色），浮塵一個 Points，鳥一個小網格（每幀 CPU 改頂點）

// --- 太陽鏡頭光暈 ---
const flareEl = document.createElement('div');
flareEl.id = 'flare';
flareEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;mix-blend-mode:screen;opacity:0;';
// 太陽本體的光暈、一條橫向光紋、四個沿著「太陽→畫面中心」那條線排的鬼影圈
const FLARE_PARTS = [
  { k: 0, s: 2.6, css: 'radial-gradient(circle, rgba(255,246,220,.9) 0%, rgba(255,214,150,.35) 18%, rgba(255,190,120,0) 60%)' },
  { k: 0, s: 5.2, sy: 0.05, css: 'radial-gradient(ellipse, rgba(255,236,200,.55) 0%, rgba(255,220,170,0) 70%)' },
  { k: 0.55, s: 0.35, css: 'radial-gradient(circle, rgba(140,220,180,.0) 45%, rgba(140,220,180,.35) 62%, rgba(140,220,180,0) 72%)' },
  { k: 0.95, s: 0.18, css: 'radial-gradient(circle, rgba(255,200,120,.45) 0%, rgba(255,200,120,0) 70%)' },
  { k: 1.35, s: 0.55, css: 'radial-gradient(circle, rgba(170,140,255,0) 50%, rgba(170,140,255,.28) 64%, rgba(170,140,255,0) 74%)' },
  { k: 1.75, s: 0.26, css: 'radial-gradient(circle, rgba(120,190,255,.35) 0%, rgba(120,190,255,0) 70%)' },
];
for (const f of FLARE_PARTS) { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:0;top:0;border-radius:50%;background:${f.css};will-change:transform;`; flareEl.appendChild(d); f.el = d; }
document.body.appendChild(flareEl);
const _fl = new V3();
let flareVis = 0, flareT = 0, flareClear = 0;
function updateFlare(dt) {
  const night = MAP.theme && MAP.theme.night, on = !night && S.quality !== 'eco' && !(player.flashT > 0);
  // 每 0.1 秒看一次太陽有沒有被牆擋住（眼睛往太陽方向打一條射線）
  flareT -= dt;
  if (flareT <= 0) { flareT = 0.1; const p = camera.position; flareClear = bakeRay(p.x, p.y, p.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 70) < 0 ? 1 : 0; }
  _fl.copy(camera.position).addScaledVector(SUN_DIR, 100).project(camera);
  const inFront = _fl.z < 1, W = innerWidth, H = innerHeight, sx = (_fl.x * 0.5 + 0.5) * W, sy = (-_fl.y * 0.5 + 0.5) * H;
  // 越接近畫面中心越強，出了畫面一點點就淡掉
  const edge = Math.max(Math.abs(_fl.x), Math.abs(_fl.y)), k = inFront ? clamp(1.25 - edge, 0, 1) : 0;
  const target = on ? k * flareClear : 0;
  flareVis += (target - flareVis) * (1 - Math.exp(-(target > flareVis ? 6 : 10) * dt));
  if (flareVis < 0.01) { if (flareEl.style.opacity !== '0') flareEl.style.opacity = '0'; return; }
  flareEl.style.opacity = (flareVis * 0.85).toFixed(3);
  const base = Math.min(W, H) * 0.32, cx = W / 2, cy = H / 2;
  for (const f of FLARE_PARTS) {
    const x = sx + (cx - sx) * f.k, y = sy + (cy - sy) * f.k, w = base * f.s, h = w * (f.sy || 1);
    f.el.style.width = w + 'px'; f.el.style.height = h + 'px';
    f.el.style.transform = `translate(${(x - w / 2).toFixed(1)}px,${(y - h / 2).toFixed(1)}px)`;
  }
}

// --- 空氣中的浮塵：鏡頭附近 10×5×10 公尺的盒子裡慢慢飄，離開盒子就從另一邊繞回來 ---
const DUST_N = 70;
const dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(DUST_N * 3), dustSeed = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) { dustPos[i * 3] = rand(-5, 5); dustPos[i * 3 + 1] = rand(0.2, 4.5); dustPos[i * 3 + 2] = rand(-5, 5); dustSeed[i] = Math.random() * 100; }
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ size: 0.022, map: puffTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d0, opacity: 0.45 });
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
let dustT = 0;
function updateDust(dt) {
  const night = MAP.theme && MAP.theme.night;
  dust.visible = !night && S.quality !== 'eco';
  if (!dust.visible) return;
  dustT += dt;
  const c = camera.position;
  for (let i = 0; i < DUST_N; i++) {
    const s = dustSeed[i];
    let x = dustPos[i * 3] + (Math.sin(dustT * 0.3 + s) * 0.05 + 0.04) * dt, y = dustPos[i * 3 + 1] + Math.sin(dustT * 0.5 + s * 1.7) * 0.03 * dt, z = dustPos[i * 3 + 2] + Math.cos(dustT * 0.27 + s) * 0.05 * dt;
    // 繞回：跟鏡頭的相對位置超出盒子就搬到另一邊
    if (x - c.x > 5) x -= 10; else if (x - c.x < -5) x += 10;
    if (z - c.z > 5) z -= 10; else if (z - c.z < -5) z += 10;
    if (y - c.y > 3) y -= 5; else if (y - c.y < -2) y += 5;
    dustPos[i * 3] = x; dustPos[i * 3 + 1] = y; dustPos[i * 3 + 2] = z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  // 看向太陽時浮塵比較亮（逆光）
  const v = camera.getWorldDirection(_fl).dot(SUN_DIR);
  dustMat.opacity = 0.25 + Math.max(0, v) * 0.45;
}

// --- 天上的鳥：7 隻在高空繞大圈，翅膀拍幾下就滑翔一陣 ---
const BIRD_N = 7;
const birdGeo = new THREE.BufferGeometry(), birdPos = new Float32Array(BIRD_N * 4 * 3);
birdGeo.setAttribute('position', new THREE.BufferAttribute(birdPos, 3));
const bi = []; for (let i = 0; i < BIRD_N; i++) { const o = i * 4; bi.push(o, o + 1, o + 2, o, o + 3, o + 1); }
birdGeo.setIndex(bi);
const birds = new THREE.Mesh(birdGeo, new THREE.MeshBasicMaterial({ color: 0x2a2a2e, side: THREE.DoubleSide, fog: false }));
birds.frustumCulled = false; scene.add(birds);
const BIRD = Array.from({ length: BIRD_N }, (_, i) => ({ r: 18 + i * 3.5, h: 24 + (i % 3) * 4, sp: 0.09 + (i % 4) * 0.02, ph: i * 0.9, cx: (i % 2 ? 8 : -10), cz: (i % 3) * 6 - 6, fl: Math.random() * 10 }));
let birdT = 0;
function updateBirds(dt) {
  const night = MAP.theme && MAP.theme.night;
  birds.visible = !night;
  if (!birds.visible) return;
  birdT += dt;
  for (let i = 0; i < BIRD_N; i++) {
    const b = BIRD[i], a = birdT * b.sp + b.ph, x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r, y = b.h + Math.sin(a * 2.3) * 1.5;
    // 前進方向（切線）和翅膀方向（側面）
    const fx = -Math.sin(a), fz = Math.cos(a), sx = -fz, sz = fx;
    // 拍翅：拍 1.5 秒、滑 2.5 秒（翅膀微微上揚）
    const cyc = (birdT + b.fl) % 4, flap = cyc < 1.5 ? Math.sin(cyc * 18) * 0.45 : 0.12;
    const span = 0.8, body = 0.4, o = i * 12;
    const P = (k, px, py, pz) => { birdPos[o + k * 3] = px; birdPos[o + k * 3 + 1] = py; birdPos[o + k * 3 + 2] = pz; };
    P(0, x + fx * body, y, z + fz * body);                                   // 頭
    P(1, x - fx * body * 0.6, y, z - fz * body * 0.6);                       // 尾
    P(2, x + sx * span - fx * 0.12, y + flap * span, z + sz * span - fz * 0.12);   // 右翅尖
    P(3, x - sx * span - fx * 0.12, y + flap * span, z - sz * span - fz * 0.12);   // 左翅尖
  }
  birdGeo.attributes.position.needsUpdate = true;
}

function updateAmbient(dt) { updateFlare(dt); updateDust(dt); updateBirds(dt); }
