/* ===== 79-armory：M16 軍械庫（參考 CS2 的武器外觀、掛飾、貼紙；全部用遊戲內經驗、成就、段位解鎖，不涉及真錢、沒有開箱）
   - 花紋塗裝：數位迷彩、虎紋、碳纖維、蜂巢、夕陽漸層、大馬士革、龍鱗、霓虹……著色器即時畫在槍上（不用圖檔），跟光影、反射一起算。
   - 掛飾：掛在槍左側的小東西，用一段鏈子吊著；槍晃、後座、換彈、檢視時會甩（真的用重力＋慣性算，不是播動畫）。
   - 貼紙：槍左側 3 個位置，射線打到槍身表面才貼，貼合不同的槍。
   - 軍械庫畫面：左邊是放大的槍可以轉著看（拖曳旋轉），右邊選塗裝、掛飾、貼紙；可以切換要看哪一把槍。 */

// ---------- 花紋塗裝 ----------
// pat：0 純色、1 數位迷彩、2 虎紋、3 碳纖維、4 蜂巢、5 漸層、6 大馬士革、7 龍鱗、8 霓虹；a／b／c：三個顏色；how：怎麼解鎖
const PAT_SKINS = [
  { id: 'digital', name: '數位迷彩', lv: 3, pat: 1, a: '#5d6650', b: '#8b8f74', c: '#2e3329' },
  { id: 'tiger', name: '虎紋', lv: 5, pat: 2, a: '#d98a2b', b: '#1c1712', c: '#f0b04a' },
  { id: 'carbon', name: '碳纖維', lv: 9, pat: 3, a: '#2a2c30', b: '#14151a', c: '#4b4f58' },
  { id: 'hex', name: '蜂巢', lv: 11, pat: 4, a: '#2f6f8f', b: '#9fe3ff', c: '#163847' },
  { id: 'sunset', name: '夕陽漸層', lv: 14, pat: 5, a: '#ff7a3c', b: '#6a2c8f', c: '#ffd36a' },
  { id: 'damascus', name: '大馬士革', lv: 18, pat: 6, a: '#9aa3ad', b: '#4c535c', c: '#d8dde2' },
  { id: 'dragon', name: '龍鱗', lv: 22, pat: 7, a: '#1f7a55', b: '#0c3324', c: '#7fe0a8' },
  { id: 'neon', name: '霓虹', lv: 26, pat: 8, a: '#14121c', b: '#ff3ad1', c: '#3af0ff' },
  { id: 'champion', name: '冠軍金紋', ach: 'arms_win', pat: 6, a: '#f0c858', b: '#9a7420', c: '#fff0b0' },
  { id: 'officer', name: '軍官藍', rank: 6, pat: 4, a: '#1f2f5c', b: '#ffd36a', c: '#0f1830' },
];
for (const p of PAT_SKINS) SKINS.push(Object.assign({ poly: p.a, metal: p.c }, p, { lv: p.lv || 99 }));
const PAT_U = { uPat: { value: 0 }, uPA: { value: new THREE.Color() }, uPB: { value: new THREE.Color() }, uPC: { value: new THREE.Color() } };
const PAT_GLSL = `
uniform float uPat; uniform vec3 uPA; uniform vec3 uPB; uniform vec3 uPC; uniform float uPK;
varying vec3 vGP; varying vec3 vGN;
float ph(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ph(i), ph(i + vec2(1, 0)), f.x), mix(ph(i + vec2(0, 1)), ph(i + vec2(1, 1)), f.x), f.y); }
// 側面看（z、y），上下面用（z、x）
vec3 patColor(out float glow) {
  glow = 0.0;
  vec3 an = abs(normalize(vGN)); vec2 p = an.y > 0.7 ? vGP.zx : vGP.zy;
  if (uPat < 0.5) return vec3(1.0);
  if (uPat < 1.5) { vec2 c = floor(p * 55.0); float h = ph(c), h2 = ph(floor(p * 18.0)); float m = h2 < 0.45 ? 0.0 : h2 < 0.8 ? 1.0 : 2.0; if (h < 0.25) m = mod(m + 1.0, 3.0); return m < 0.5 ? uPA : m < 1.5 ? uPB : uPC; }
  if (uPat < 2.5) { float s = sin(p.x * 70.0 + pn(p * 9.0) * 6.0 + pn(p * 31.0) * 1.5); return mix(uPA, uPB, smoothstep(0.55, 0.7, s)) + uPC * 0.15 * pn(p * 60.0); }
  if (uPat < 3.5) { vec2 q = p * 160.0; float w = mod(floor(q.x) + floor(q.y), 2.0); float g = w > 0.5 ? fract(q.x) : fract(q.y); return mix(uPB, uPA, 0.4 + 0.6 * sin(g * 3.14159)) + uPC * 0.25 * step(0.92, sin(g * 3.14159)); }
  if (uPat < 4.5) { vec2 q = p * 60.0; vec2 r = vec2(1.0, 1.732); vec2 h = r * 0.5; vec2 a = mod(q, r) - h, b = mod(q - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;
    float e = max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y)); float edge = smoothstep(0.4, 0.46, e); return mix(uPA, uPB, edge) * (0.85 + 0.3 * ph(floor(q))); }
  if (uPat < 5.5) { float t = clamp((vGP.z + 0.15) / 0.75, 0.0, 1.0) + (pn(p * 12.0) - 0.5) * 0.15; return t < 0.5 ? mix(uPC, uPA, t * 2.0) : mix(uPA, uPB, t * 2.0 - 1.0); }
  if (uPat < 6.5) { float s = sin(p.x * 120.0 + sin(p.y * 70.0) * 2.5 + pn(p * 20.0) * 4.0); return mix(uPB, uPA, s * 0.5 + 0.5) + uPC * 0.35 * smoothstep(0.92, 1.0, s); }
  if (uPat < 7.5) { vec2 q = p * vec2(45.0, 60.0); q.x += mod(floor(q.y), 2.0) * 0.5; vec2 f = fract(q) - vec2(0.5, 0.15); float d = length(f);
    return mix(uPB, uPA, smoothstep(0.62, 0.3, d)) + uPC * 0.4 * smoothstep(0.25, 0.0, abs(d - 0.45)); }
  float l1 = smoothstep(0.03, 0.0, abs(fract(p.x * 14.0 + p.y * 6.0) - 0.5) - 0.02), l2 = smoothstep(0.03, 0.0, abs(fract(p.y * 22.0 - p.x * 4.0) - 0.5) - 0.015);
  glow = l1 + l2 * 0.7; return mix(uPA, mix(uPB, uPC, l2), clamp(glow, 0.0, 1.0));
}`;
// 手上的槍的表面細節：邊角磨損（倒角的地方法線變化快 → 露出金屬底色）、沿槍身的細刮痕、粗糙度不均；塑膠是霧面顆粒與手摸的亮面
const VM_DETAIL_GLSL = `
uniform float uDet;
vec3 vmDetail(vec3 base, out float wear, out float rough) {
  vec3 an = abs(normalize(vGN)); vec2 p = an.y > 0.7 ? vGP.zx : vGP.zy;
  float edge = clamp(length(fwidth(normalize(vGN))) * 2.2 - 0.15, 0.0, 1.0);
  float n1 = pn(p * 140.0), n2 = pn(vec2(vGP.z * 30.0, (an.y > 0.7 ? vGP.x : vGP.y) * 900.0)), n3 = pn(p * 26.0);
  float scratch = smoothstep(0.78, 0.95, n2) * smoothstep(0.35, 0.7, n3);
  wear = clamp(edge * (0.55 + 0.6 * n1) + scratch * 0.5, 0.0, 1.0) * mix(0.35, 1.0, uDet);
  rough = mix(0.82 + 0.36 * n1, 1.0, 0.0) * (1.0 - wear * 0.45 * uDet) * mix(1.0, 0.9 + 0.2 * pn(p * 300.0), 1.0 - uDet);
  vec3 bare = mix(base, vec3(0.55, 0.56, 0.58), uDet);   // 金屬：磨掉陽極處理露出來的鋁色；塑膠：磨亮一點
  return mix(base * (0.92 + 0.12 * n3), mix(base * 1.35, bare, 0.75), wear * (uDet > 0.5 ? 0.65 : 0.3));
}`;
function patchVmPattern(mat, k) {
  mat.userData.patK = { value: k };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, PAT_U); sh.uniforms.uPK = mat.userData.patK;
    sh.vertexShader = 'varying vec3 vGP; varying vec3 vGN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = position; vGN = normal;');
    sh.uniforms.uDet = { value: k < 0.9 ? 1 : 0 };
    sh.fragmentShader = PAT_GLSL + VM_DETAIL_GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat pGlow; vec3 pCol = patColor(pGlow); diffuseColor.rgb *= mix(vec3(1.0), pCol, uPK);\nfloat vmWear, vmRough; diffuseColor.rgb = vmDetail(diffuseColor.rgb, vmWear, vmRough);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vmRough, 0.08, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.9, vmWear * uDet);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += pGlow * uPK * mix(uPB, uPC, 0.5) * 0.9;');
  };
  mat.customProgramCacheKey = () => 'vmpat2' + k;
}
patchVmPattern(VM_MATS.poly, 1); patchVmPattern(VM_MATS.metal, 0.75);

// ---------- 掛飾 ----------
// 每個掛飾：用小零件拼（partBox／partCylR 跟手上的槍同一套），回傳合併的幾何
const CHARMS = [
  { id: 'none', name: '不掛', lv: 1 },
  { id: 'tag', name: '狗牌', lv: 2 }, { id: 'bullet', name: '子彈', lv: 4 }, { id: 'dice', name: '骰子', lv: 6 },
  { id: 'bell', name: '鈴鐺', lv: 8 }, { id: 'coin', name: '銀幣', lv: 10 }, { id: 'nade', name: '迷你手榴彈', lv: 12 },
  { id: 'star', name: '金星', lv: 15 }, { id: 'heart', name: '紅心', lv: 17 }, { id: 'bear', name: '小熊', lv: 20 },
  { id: 'badge', name: '段位徽章', placed: true }, { id: 'trophy', name: '獎盃', ach: 'arms_win' },
];
function extrudeShape(pts, depth, color) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: depth * 0.25, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); return colorGeo(g, color);
}
function colorGeo(g, color) { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
function sphereP(r, x, y, z, color, sx = 1, sy = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 10, 8); g.scale(sx, sy, sz); g.translate(x, y, z); return colorGeo(g, color); }
function starPts(n, r0, r1) { const out = []; for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? r1 : r0; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
// 掛飾本體：吊點在 (0,0,0)，往下（-y）長；大小約 1.5–2.5 公分
function charmGeo(id) {
  const P = [], s = 0.001;
  const rankHex = () => { const r = STATS.ranked; const t = tierOf(r.rating); return { pvt: '#c9d2dc', nco: '#8fd0ff', lt: '#e6ecf3', maj: '#ffd36a', gen: '#ff6a4a' }[t.kind]; };
  P.push(colorGeo(new THREE.TorusGeometry(0.0028, 0.0007, 4, 8).rotateY(Math.PI / 2).translate(0, -0.003, 0), '#b8bec6'));
  switch (id) {
    case 'tag': P.push(partBox(0.0016, 0.022, 0.014, 0, -0.016, 0, '#c8cdd3'), partBox(0.0022, 0.0025, 0.009, 0, -0.012, 0, '#4a4f56'), partBox(0.0022, 0.0018, 0.007, 0, -0.017, 0, '#4a4f56')); break;
    case 'bullet': P.push(partCylR(0.0032, 0.0032, 0.016, 0, -0.014, 0, '#c99a3e'), colorGeo(new THREE.ConeGeometry(0.0032, 0.008, 10).rotateX(Math.PI).translate(0, -0.026, 0), '#b8673a')); break;
    case 'dice': { P.push(partBox(0.011, 0.011, 0.011, 0, -0.011, 0, '#f4f1ea')); for (const [y, z] of [[-0.008, -0.003], [-0.011, 0], [-0.014, 0.003]]) P.push(partBox(0.0122, 0.0018, 0.0018, 0, y, z, '#1d1d1f')); break; }
    case 'bell': { const g = new THREE.LatheGeometry([[0.001, 0], [0.004, -0.002], [0.0055, -0.009], [0.0075, -0.015], [0.0075, -0.016]].map(([x, y]) => new THREE.Vector2(x, y)), 12); g.translate(0, -0.004, 0); P.push(colorGeo(g, '#e2b23c'), sphereP(0.0022, 0, -0.019, 0, '#a07a22')); break; }
    case 'coin': { const g = new THREE.CylinderGeometry(0.009, 0.009, 0.0018, 16).rotateZ(Math.PI / 2).translate(0, -0.013, 0); P.push(colorGeo(g, '#d6dbe0'), extrudeShape(starPts(5, 0.004, 0.0018), 0.0022, '#9aa2ab').translate(0, -0.013, 0)); break; }
    case 'nade': P.push(sphereP(0.0065, 0, -0.012, 0, '#55603a', 1, 1.15, 1), partCylR(0.0025, 0.0025, 0.004, 0, -0.004, 0, '#3a3f2a'), partBox(0.0015, 0.009, 0.003, 0.0045, -0.009, 0, '#6b7068')); break;
    case 'star': P.push(extrudeShape(starPts(5, 0.011, 0.0045), 0.003, '#f2c94c').translate(0, -0.014, 0)); break;
    case 'heart': { const pts = []; for (let k = 0; k < 24; k++) { const t = k / 24 * Math.PI * 2; pts.push([16 * Math.sin(t) ** 3 * 0.0006, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.0006]); } P.push(extrudeShape(pts, 0.0035, '#d8323c').translate(0, -0.012, 0)); break; }
    case 'bear': P.push(sphereP(0.0075, 0, -0.012, 0, '#8a5a34'), sphereP(0.0028, 0, -0.006, -0.0055, '#8a5a34'), sphereP(0.0028, 0, -0.006, 0.0055, '#8a5a34'), sphereP(0.0032, -0.006, -0.0135, 0, '#d9b48a'), sphereP(0.0012, -0.0085, -0.0128, 0, '#1a1210'), sphereP(0.0011, -0.0064, -0.0095, -0.0028, '#1a1210'), sphereP(0.0011, -0.0064, -0.0095, 0.0028, '#1a1210')); break;
    case 'badge': P.push(extrudeShape([[0, 0.012], [0.01, 0.008], [0.01, -0.002], [0, -0.012], [-0.01, -0.002], [-0.01, 0.008]], 0.003, '#2a3340').translate(0, -0.015, 0), extrudeShape(starPts(5, 0.0055, 0.0022), 0.0042, rankHex()).translate(0, -0.014, 0)); break;
    case 'trophy': { const g = new THREE.LatheGeometry([[0.0001, 0], [0.006, 0.0005], [0.0065, -0.002], [0.004, -0.009], [0.0012, -0.011], [0.0012, -0.014], [0.0045, -0.016], [0.0045, -0.018], [0.0001, -0.018]].map(([x, y]) => new THREE.Vector2(x, y)), 14); g.translate(0, -0.004, 0); P.push(colorGeo(g, '#f0c858')); break; }
    default: return null;
  }
  void s; return mergeParts(P);
}
const CHARM = { id: '', mesh: null, chain: null, p: new V3(), pp: new V3(), a: new V3(), aPrev: new V3(), on: false, L: 0.024, kick: 0, scale: 1.35 };
const CHARM_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.38, envMap: VM_ENV, envMapIntensity: 0.9 });
const CHAIN_MAT = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.8, roughness: 0.3, envMap: VM_ENV });
function setCharm(id) {
  if (CHARM.id === id) return;
  if (CHARM.mesh) { vmScene.remove(CHARM.mesh); CHARM.mesh.geometry.dispose(); CHARM.mesh = null; }
  if (CHARM.chain) { vmScene.remove(CHARM.chain); CHARM.chain.geometry.dispose(); CHARM.chain = null; }
  CHARM.id = id; const g = charmGeo(id); CHARM.on = !!g; if (!g) return;
  CHARM.mesh = new THREE.Mesh(g, CHARM_MAT); CHARM.mesh.name = 'charm'; CHARM.mesh.scale.setScalar(CHARM.scale); vmScene.add(CHARM.mesh);
  const cg = new THREE.CylinderGeometry(0.0005, 0.0005, 1, 4); cg.translate(0, -0.5, 0);
  CHARM.chain = new THREE.Mesh(cg, CHAIN_MAT); vmScene.add(CHARM.chain);
  CHARM.reset = true;
}
// 每把槍的吊點：槍身左側、偏後的位置（第一次用到時用射線找表面）
const _ca = new V3(), _cg = new V3(), _cq = new THREE.Quaternion(), _cd = new V3(), _cu = new V3(0, -1, 0);
function charmAnchor(g) {
  if (!g.userData.anchor) {
    const sp = stickerSpots(g); const a = sp.anchor || new V3(-0.02, 0.0, 0.1);
    g.userData.anchor = a;
  }
  return g.userData.anchor;
}
// 鏈子末端用質點模擬：重力（看手上的槍那個場景裡，往下的方向跟著你抬頭低頭變）＋槍晃動的慣性、後座的一甩；長度固定
function updateCharm(dt) {
  if (!CHARM.on) return;
  const vis = gun.visible && gunRig.visible !== false;
  CHARM.mesh.visible = CHARM.chain.visible = vis; if (!vis) return;
  gunRig.updateMatrixWorld(true);
  gun.localToWorld(_ca.copy(charmAnchor(gun)));
  if (CHARM.reset) { CHARM.p.copy(_ca).y -= CHARM.L; CHARM.pp.copy(CHARM.p); CHARM.reset = false; }
  dt = Math.min(dt, 1 / 30);
  _cg.set(0, -9.8, 0).applyQuaternion(_cq.copy(camera.quaternion).invert());   // 真的往下
  _cg.z *= 0.5;
  const v = _cd.subVectors(CHARM.p, CHARM.pp).multiplyScalar(0.985);           // 空氣阻力
  CHARM.pp.copy(CHARM.p); CHARM.p.add(v).addScaledVector(_cg, dt * dt);
  if (CHARM.kick) { CHARM.p.z += CHARM.kick * 0.004; CHARM.p.y += CHARM.kick * 0.002; CHARM.kick = 0; }   // 開槍時甩一下
  _cd.subVectors(CHARM.p, _ca); const L = _cd.length() || 1e-4; CHARM.p.copy(_ca).addScaledVector(_cd, CHARM.L / L);
  _cd.subVectors(CHARM.p, _ca).normalize();
  CHARM.chain.position.copy(_ca); CHARM.chain.quaternion.setFromUnitVectors(_cu, _cd); CHARM.chain.scale.set(1, CHARM.L, 1);
  CHARM.mesh.position.copy(CHARM.p); CHARM.mesh.quaternion.setFromUnitVectors(_cu, _cd);
  CHARM.mesh.rotateY(Math.sin(game.t * 1.3) * 0.25 + (v.x - v.z) * 30);   // 慢慢轉一點
  CHARM.ang = Math.acos(clamp(-_cd.y, -1, 1));
}

// ---------- 貼紙 ----------
const STICKERS = [
  { id: 'none', name: '不貼', lv: 1 }, { id: 'sun', name: '曙光', lv: 2 }, { id: 'bolt', name: '閃電', lv: 3 }, { id: 'starS', name: '星星', lv: 5 },
  { id: 'flame', name: '火焰', lv: 7 }, { id: 'hs', name: '爆頭', lv: 9 }, { id: 'paw', name: '熊掌', lv: 11 }, { id: 'cross', name: '準星', lv: 13 },
  { id: 'gg', name: 'GG', lv: 16 }, { id: 'heartS', name: '愛心', lv: 19 }, { id: 'skull', name: '骷髏', lv: 23 }, { id: 'crown', name: '皇冠', lv: 28 },
  { id: 'rankS', name: '段位', placed: true }, { id: 'champS', name: '冠軍', ach: 'arms_win' },
];
const STK_TEX = {};
function stickerTex(id) {
  if (STK_TEX[id]) return STK_TEX[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const disc = (fill, stroke) => { c.beginPath(); c.arc(64, 64, 56, 0, 6.283); c.fillStyle = fill; c.fill(); c.lineWidth = 7; c.strokeStyle = stroke; c.stroke(); };
  const star = (cx, cy, r0, r1, n = 5) => { c.beginPath(); for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * 6.283 - 1.5708, r = k % 2 ? r1 : r0; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); };
  c.lineJoin = 'round';
  switch (id) {
    case 'sun': disc('#1d2a44', '#ffb347'); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(64, 78, 26, Math.PI, 0); c.fill(); for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) / 7 * Math.PI; c.fillRect(0, 0, 0, 0); c.save(); c.translate(64, 78); c.rotate(a + Math.PI / 2); c.fillRect(-3, -50, 6, 14); c.restore(); } c.fillRect(20, 82, 88, 6); break;
    case 'bolt': c.fillStyle = '#ffe14a'; c.strokeStyle = '#1b1b1b'; c.lineWidth = 8; c.beginPath(); [[72, 6], [30, 70], [60, 70], [48, 122], [98, 50], [66, 50], [84, 6]].forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.stroke(); c.fill(); break;
    case 'starS': c.fillStyle = '#ffd24a'; c.strokeStyle = '#7a4a00'; c.lineWidth = 7; star(64, 68, 58, 24); c.stroke(); c.fill(); break;
    case 'flame': { const g = c.createLinearGradient(0, 120, 0, 10); g.addColorStop(0, '#ff3d1f'); g.addColorStop(0.6, '#ff9a1f'); g.addColorStop(1, '#ffe46a'); c.fillStyle = g; c.beginPath(); c.moveTo(64, 6); c.bezierCurveTo(100, 50, 112, 74, 100, 98); c.bezierCurveTo(90, 120, 38, 124, 28, 100); c.bezierCurveTo(16, 74, 40, 60, 46, 36); c.bezierCurveTo(56, 52, 60, 30, 64, 6); c.fill(); break; }
    case 'hs': c.fillStyle = '#d8323c'; c.fillRect(6, 36, 116, 56); c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(10, 40, 108, 48); c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('爆頭', 64, 66); break;
    case 'paw': c.fillStyle = '#3a2a20'; c.beginPath(); c.ellipse(64, 80, 30, 26, 0, 0, 6.283); c.fill(); for (const [x, y] of [[30, 44], [50, 26], [78, 26], [98, 44]]) { c.beginPath(); c.ellipse(x, y, 12, 15, 0, 0, 6.283); c.fill(); } break;
    case 'cross': c.strokeStyle = '#3af07a'; c.lineWidth = 9; c.beginPath(); c.arc(64, 64, 44, 0, 6.283); c.stroke(); c.fillStyle = '#3af07a'; c.fillRect(60, 6, 8, 40); c.fillRect(60, 82, 8, 40); c.fillRect(6, 60, 40, 8); c.fillRect(82, 60, 40, 8); break;
    case 'gg': disc('#2b2b33', '#9fe3ff'); c.fillStyle = '#9fe3ff'; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GG', 64, 68); break;
    case 'heartS': c.fillStyle = '#ff4a6a'; c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.moveTo(64, 112); c.bezierCurveTo(-10, 60, 20, 4, 64, 36); c.bezierCurveTo(108, 4, 138, 60, 64, 112); c.stroke(); c.fill(); break;
    case 'skull': c.fillStyle = '#efeae0'; c.beginPath(); c.arc(64, 54, 42, 0, 6.283); c.fill(); c.fillRect(40, 80, 48, 30); c.fillStyle = '#1b1b1b'; for (const x of [46, 82]) { c.beginPath(); c.arc(x, 56, 12, 0, 6.283); c.fill(); } c.beginPath(); c.moveTo(64, 70); c.lineTo(57, 84); c.lineTo(71, 84); c.fill(); for (let x = 46; x <= 80; x += 11) c.fillRect(x, 96, 4, 14); break;
    case 'crown': c.fillStyle = '#f2c94c'; c.strokeStyle = '#7a5200'; c.lineWidth = 6; c.beginPath(); [[14, 100], [14, 40], [40, 70], [64, 24], [88, 70], [114, 40], [114, 100]].forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.stroke(); c.fill(); c.fillStyle = '#d8323c'; for (const x of [40, 64, 88]) { c.beginPath(); c.arc(x, 86, 7, 0, 6.283); c.fill(); } break;
    case 'rankS': { const t = tierOf(STATS.ranked.rating); disc('#2a3340', { pvt: '#c9d2dc', nco: '#8fd0ff', lt: '#e6ecf3', maj: '#ffd36a', gen: '#ff6a4a' }[t.kind]); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t.name, 64, 66); break; }
    case 'champS': c.fillStyle = '#f0c858'; star(64, 64, 60, 46, 12); c.fill(); c.fillStyle = '#7a5200'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('冠軍', 64, 66); break;
    default: return null;
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; STK_TEX[id] = t; return t;
}
// 找槍左側表面上的 3 個貼紙位置（＋掛飾吊點）：在機匣的高度從左邊往右打射線
const _ray = new THREE.Raycaster();
function stickerSpots(g) {
  if (g.userData.spots) return g.userData.spots;
  const parts = g.children.filter((m) => m.isMesh && (m.material === VM_MATS.poly || m.material === VM_MATS.metal) && m !== g.userData.mag);
  const box = new THREE.Box3(); for (const m of parts) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const spots = []; let anchor = null;
  const cy = (box.min.y + box.max.y) / 2, len = box.max.z - box.min.z;
  const tryAt = (z, ys) => {
    for (const y of ys) {
      _ray.set(new V3(box.min.x - 0.2, y, z), new V3(1, 0, 0)); _ray.far = 1;
      g.updateMatrixWorld(true);
      // 用槍自己的座標打（暫時把槍放在原點）
      const hit = parts.map((m) => { const r = _ray.intersectObject(m, false)[0]; return r; }).filter(Boolean).sort((a, b) => a.distance - b.distance)[0];
      if (hit) return { p: hit.point.clone(), n: hit.face ? hit.face.normal.clone() : new V3(-1, 0, 0) };
    }
    return null;
  };
  // 暫時把槍的位置歸零，射線才是在槍的座標裡
  const par = g.parent, pos = g.position.clone(), rot = g.rotation.clone(), sc = g.scale.clone(); if (par) par.remove(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.updateMatrixWorld(true);
  // 貼紙：機匣側面（護木後面、手不會擋到），只貼在朝左的平面上
  for (const f of [0.6, 0.7, 0.5, 0.78, 0.42, 0.55, 0.65, 0.74, 0.46, 0.84]) { if (spots.length >= 3) break; const s = tryAt(box.min.z + len * f, [cy + 0.006, cy + 0.016, cy - 0.006, cy + 0.026, cy - 0.016, cy + 0.036]); if (s && s.n.x < -0.85 && spots.every((q) => Math.abs(q.p.z - s.p.z) > 0.03)) spots.push(s); }
  spots.sort((a, b) => a.p.z - b.p.z);
  // 掛飾吊點：機匣左上方（偏後），掛在看得到的那一側
  const an = tryAt(box.min.z + len * 0.6, [box.max.y - 0.012, box.max.y - 0.024, cy + 0.02, cy]); if (an) anchor = an.p.clone().add(new V3(-0.006, 0, 0));
  if (par) par.add(g); g.position.copy(pos); g.rotation.copy(rot); g.scale.copy(sc); g.updateMatrixWorld(true);
  g.userData.spots = spots; spots.anchor = anchor; return spots;
}
const STK_GEO = new THREE.PlaneGeometry(1, 1);
function applyStickers(g) {
  if (!g) return;
  const want = stkList().join('|'); if (g.userData.stkKey === want) return;
  for (const m of g.userData.stk || []) { g.remove(m); m.material.dispose(); }
  g.userData.stk = []; g.userData.stkKey = want;
  const spots = stickerSpots(g), ids = stkList();
  spots.forEach((s, i) => {
    const id = ids[i]; if (!id || id === 'none') return; const tex = stickerTex(id); if (!tex) return;
    const m = new THREE.Mesh(STK_GEO, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.08, roughness: 0.45, metalness: 0.05, envMap: VM_ENV, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    const size = g === VMODELS.pistol || g === VMODELS.deagle ? 0.02 : 0.03;
    m.scale.set(size, size, 1); m.position.copy(s.p).addScaledVector(s.n, 0.0012);
    m.quaternion.setFromUnitVectors(new V3(0, 0, 1), s.n); m.rotateZ(Math.PI / 2 * 0 + (i - 1) * 0.08);
    m.name = 'sticker'; g.add(m); g.userData.stk.push(m);
  });
}
// ---------- 擁有與裝上 ----------
const stkList = () => String(P().stk || '').split('|').concat(['none', 'none', 'none']).slice(0, 3);
function owned(it) {
  if (it.ach) return !!P().ach[it.ach];
  if (it.placed) return STATS.ranked.placed >= PLACE_N;
  if (it.rank !== undefined) return STATS.ranked.placed >= PLACE_N && tierOf(STATS.ranked.best || STATS.ranked.rating).idx >= it.rank;
  return (it.lv || 1) <= myLv();
}
function howToGet(it) {
  if (it.ach) return `成就「${(ACH.find((a) => a[0] === it.ach) || [0, it.ach])[1]}」`;
  if (it.placed) return '段位賽定級完成';
  if (it.rank !== undefined) return `段位達到「${RANK_TIERS[it.rank][1]}」`;
  return `${it.lv} 級`;
}
function applyArmory() {
  const sk = SKINS.find((s) => s.id === P().skin && owned(s)) || SKINS[0];
  if (sk.pat) {
    // 花紋：顏色全由花紋決定，底色抵銷成接近白（之後每格照樣乘上陰影明暗）
    PAT_U.uPat.value = sk.pat; PAT_U.uPA.value.set(sk.a); PAT_U.uPB.value.set(sk.b); PAT_U.uPC.value.set(sk.c);
    const B = VM_BASE; VM_TINT.poly.setRGB(0.8 / B.poly.r, 0.8 / B.poly.g, 0.8 / B.poly.b); VM_TINT.metal.setRGB(0.75 / B.metal.r, 0.75 / B.metal.g, 0.75 / B.metal.b);
    VM_MATS.poly.color.copy(VM_TINT.poly).multiply(B.poly); VM_MATS.metal.color.copy(VM_TINT.metal).multiply(B.metal);
  } else PAT_U.uPat.value = 0;
  const ch = CHARMS.find((c) => c.id === P().charm && owned(c)) || CHARMS[0]; setCharm(ch.id);
  for (const k in VMODELS) applyStickers(VMODELS[k]);
}
function equipArmory(kind, id, slot = 0) {
  const list = kind === 'skin' ? SKINS : kind === 'charm' ? CHARMS : STICKERS, it = list.find((x) => x.id === id);
  if (!it || !owned(it)) return false;
  if (kind === 'skin') P().skin = id; else if (kind === 'charm') { P().charm = id; CHARM.id = ''; } else { const l = stkList(); l[slot] = id; P().stk = l.join('|'); }
  saveStats(); applyCosmetics(); return true;
}

// ---------- 軍械庫畫面 ----------
const ARM = { open: false, tab: 'skin', slot: 0, gun: 'rifle', yaw: 1.57, pitch: 0.12, drag: null, auto: true, prevGun: null };
const ARM_GUNS = [['rifle', '步槍'], ['carbine', '卡賓槍'], ['smg', '衝鋒槍'], ['shotgun', '霰彈槍'], ['sniper', '狙擊槍'], ['deagle', '重手槍'], ['pistol', '手槍']];
function renderArmory() {
  const L = myLv();
  $('arTabs').innerHTML = [['skin', '塗裝'], ['charm', '掛飾'], ['stk', '貼紙']].map(([k, n]) => `<button class="btn${ARM.tab === k ? ' go' : ''}" data-tab="${k}">${n}</button>`).join('');
  $('arGuns').innerHTML = ARM_GUNS.map(([k, n]) => `<button class="${ARM.gun === k ? 'on' : ''}" data-gun="${k}">${n}</button>`).join('');
  let html = '';
  const cell = (it, kind, cur, sw) => { const ok = owned(it); return `<button class="sk${it.id === cur ? ' on' : ''}" data-kind="${kind}" data-id="${it.id}" ${ok ? '' : 'disabled'}><i style="${sw}"></i><b>${it.name}</b><small>${!ok ? howToGet(it) + '解鎖' : it.id === cur ? '使用中' : '可用'}</small></button>`; };
  if (ARM.tab === 'skin') html = SKINS.map((s) => cell(s, 'skin', P().skin, s.pat ? `background:linear-gradient(135deg, ${s.a} 0 33%, ${s.b} 33% 66%, ${s.c} 66%)` : `background:linear-gradient(135deg, ${s.poly} 50%, ${s.metal} 50%)`)).join('');
  else if (ARM.tab === 'charm') html = CHARMS.map((c) => cell(c, 'charm', P().charm || 'none', `background:${c.id === 'none' ? 'transparent' : 'radial-gradient(circle, #ffd36a 0 30%, #554 32%)'}`)).join('');
  else {
    const l = stkList();
    html = `<div class="arslots">${[0, 1, 2].map((i) => `<button class="${ARM.slot === i ? 'on' : ''}" data-slot="${i}">位置 ${i + 1}<small>${(STICKERS.find((s) => s.id === l[i]) || STICKERS[0]).name}</small></button>`).join('')}</div>` +
      STICKERS.map((s) => { const t = s.id !== 'none' && owned(s) ? stickerTex(s.id) : null; return cell(s, 'stk', l[ARM.slot], t ? `background:center/contain no-repeat url(${t.image.toDataURL()})` : 'background:#333'); }).join('');
  }
  $('arList').innerHTML = html;
  const got = SKINS.filter(owned).length + CHARMS.filter(owned).length - 1 + STICKERS.filter(owned).length - 1;
  $('arNote').textContent = `${L} 級・已解鎖 ${got} / ${SKINS.length + CHARMS.length + STICKERS.length - 2} 樣。全部用經驗、成就、段位解鎖，沒有付費、沒有開箱。塗裝、掛飾、貼紙每把槍共用。`;
  for (const b of $('arTabs').children) onTap(b, () => { ARM.tab = b.dataset.tab; sfx('ping', 0.3); renderArmory(); });
  for (const b of $('arGuns').children) onTap(b, () => { ARM.gun = b.dataset.gun; setViewmodel(ARM.gun); armPreviewPrep(); renderArmory(); });
  for (const b of $('arList').querySelectorAll('[data-slot]')) onTap(b, () => { ARM.slot = +b.dataset.slot; renderArmory(); });
  for (const b of $('arList').querySelectorAll('.sk')) onTap(b, () => { if (equipArmory(b.dataset.kind, b.dataset.id, ARM.slot)) { sfx('cash'); CHARM.kick = 3; renderArmory(); } });
}
function armPreviewPrep() {
  // 只看槍：手臂、手套先藏起來
  for (const g of Object.values(VMODELS)) { for (const m of g.children) if (m.material === VM_MATS.cloth) m.visible = !ARM.open; g.userData.leftArm.visible = !ARM.open; }
  CHARM.reset = true;
}
function openArmory() { ARM.menuWas = !$('menu').hidden; $('menu').hidden = true; ARM.open = true; ARM.prevGun = gun; ARM.gun = 'rifle'; setViewmodel('rifle'); applyCosmetics(); armPreviewPrep(); renderArmory(); $('armory').hidden = false; }
function closeArmory() { ARM.open = false; armPreviewPrep(); $('armory').hidden = true; if (ARM.menuWas) $('menu').hidden = false; gunRig.position.set(0, 0, 0); gunRig.rotation.set(0, 0, 0); syncMenuLevel(); }
// 預覽：槍放在畫面左半邊，慢慢轉；拖曳可以自己轉
function updateArmoryPreview(dt) {
  if (!ARM.open) return;
  ARM.t = (ARM.t || 0) + dt;
  if (!ARM.drag && ARM.auto) ARM.yaw = 1.57 + Math.sin(ARM.t * 0.5) * 0.55;   // 左右擺著看（掛飾、貼紙在左側）
  const asp = vmCam.aspect || 1.8;
  const small = ARM.gun === 'pistol' || ARM.gun === 'deagle', dz = small ? -0.55 : ARM.gun === 'sniper' ? -1.25 : -1.05;
  gunRig.position.set(dz * 0.4 * Math.min(1.6, asp / 1.8), small ? 0.08 : 0.06, dz); gunRig.rotation.set(ARM.pitch, ARM.yaw, 0);
  updateCharm(dt);
}
(function armoryInput() {
  const el = $('arView');
  el.addEventListener('pointerdown', (e) => { ARM.drag = { x: e.clientX, y: e.clientY }; ARM.auto = false; try { el.setPointerCapture(e.pointerId); } catch (er) { /* 略過 */ } });
  el.addEventListener('pointermove', (e) => { if (!ARM.drag) return; ARM.yaw += (e.clientX - ARM.drag.x) * 0.012; ARM.pitch = clamp(ARM.pitch + (e.clientY - ARM.drag.y) * 0.008, -0.8, 0.8); ARM.drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { ARM.drag = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
})();
onTap($('bArmory'), openArmory); onTap($('arX'), closeArmory); onTap($('pgArmory'), () => { closeProg(); openArmory(); });
window.ARMORY_READY = true; applyCosmetics();
