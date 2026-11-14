/* ===== 59-human：擬真人物——一個人一個「骨架蒙皮」網格（SkinnedMesh），整個人只要 1 次繪製（槍另 1 次）。
   16 根骨頭：髖、左右大腿、左右膝、腰、胸、脖子、頭、左右肩、左右手肘、左右手。
   身體用圓柱、膠囊、橢球拼（不是方塊），衣服有迷彩（在著色器裡用 3D 雜訊畫，不用貼圖）。
   雙手用兩段式 IK 握在槍上；走路、蹲、瞄準上下、換彈、丟東西、中彈彈簧反應、倒地（順著子彈方向倒、膝蓋先軟、手臂甩開）都在這裡。
   外觀分：一般士兵（敵／我）、精英（黑色特戰）、魔王（高級軍官：大盤帽、深色制服、金色肩章、紅臂章、勳章）。 */
const HB = { root: 0, hips: 1, thighL: 2, kneeL: 3, thighR: 4, kneeR: 5, spine: 6, chest: 7, neck: 8, head: 9, shL: 10, elL: 11, haL: 12, shR: 13, elR: 14, haR: 15 };
// 骨頭的綁定位置（模型座標，腳底 y=0，面向 -z）
const HB_POS = [[0, 0, 0], [0, 0.95, 0], [-0.1, 0.93, 0], [-0.1, 0.5, 0], [0.1, 0.93, 0], [0.1, 0.5, 0], [0, 1.08, 0], [0, 1.3, 0], [0, 1.5, 0], [0, 1.6, 0],
  [-0.2, 1.44, 0], [-0.2, 1.13, 0], [-0.2, 0.86, 0], [0.2, 1.44, 0], [0.2, 1.13, 0], [0.2, 0.86, 0]];
const HB_PARENT = [-1, 0, 1, 2, 1, 4, 1, 6, 7, 8, 7, 10, 11, 7, 13, 14];
const ARM_A = 0.31, ARM_B = 0.27;   // 上臂、前臂長
// 迷彩配色：底色＋兩種斑塊＋深色（每隊／每種外觀不同）
const CAMO = {
  B: ['#8c7b58', '#6b5e43', '#a8977a', '#4c4433'],
  A: ['#5b6674', '#47515e', '#77818d', '#353c45'],
  elite: ['#2c2e31', '#1d1e20', '#3c3e42', '#141516'],
  boss: ['#26303f', '#26303f', '#2c3748', '#1b2230'],      // 軍官制服：深藍、幾乎素色
};
const HUMAN_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
// 迷彩斑塊：啟動時用可無縫重複的雜訊畫一張 128×128 的圖（R、G、B 三層斑塊、A 是布紋），著色器用三向投影貼上去（比每個像素算雜訊省很多）
const CAMO_TEX = (function () {
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), img = c.createImageData(N, N);
  const lat = (P, seed) => { const a = new Float32Array(P * P); let x = seed * 9301 + 49297; for (let i = 0; i < a.length; i++) { x = (x * 9301 + 49297) % 233280; a[i] = x / 233280; } return a; };
  const noise = (u, v, P, L) => { const x = u * P, y = v * P, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => L[((j % P + P) % P) * P + ((i % P + P) % P)];
    return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy; };
  const L = [lat(4, 1), lat(8, 2), lat(5, 3), lat(10, 4), lat(16, 5), lat(64, 6)];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = (j * N + i) * 4;
    img.data[k] = 255 * (noise(u, v, 4, L[0]) * 0.65 + noise(u, v, 8, L[1]) * 0.35);
    img.data[k + 1] = 255 * (noise(u, v, 5, L[2]) * 0.6 + noise(u, v, 10, L[3]) * 0.4);
    img.data[k + 2] = 255 * noise(u, v, 16, L[4]);
    img.data[k + 3] = 255 * noise(u, v, 64, L[5]);
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.premultiplyAlpha = false; t.generateMipmaps = true; return t;
})();
// 迷彩＋布料細節＋邊緣光（每個人一份材質，顏色放 uniform，程式共用）
function patchHumanMat(m, rim, camo) {
  const U = m.userData.rimU = { value: new THREE.Color().setRGB(...rim.split(',').map(Number)) };
  const C = m.userData.camoU = camo.map((c) => ({ value: new THREE.Color(c) }));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = U; C.forEach((u, i) => { sh.uniforms['uC' + i] = u; });
    sh.uniforms.uCamoT = { value: CAMO_TEX };
    sh.vertexShader = 'attribute float aCamo;\nvarying float vCamo;\nvarying vec3 vRest;\nvarying vec3 vRN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamo = aCamo; vRest = position; vRN = normal;');
    sh.fragmentShader = `uniform vec3 uRim; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform sampler2D uCamoT;
varying float vCamo; varying vec3 vRest; varying vec3 vRN;
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 w = abs(vRN); w /= (w.x + w.y + w.z + 1e-4);
    vec4 t = texture2D(uCamoT, vRest.zy * 1.6) * w.x + texture2D(uCamoT, vRest.xz * 1.6) * w.y + texture2D(uCamoT, vRest.xy * 1.6) * w.z;
    vec3 cam = uC0; cam = mix(cam, uC1, smoothstep(0.52, 0.56, t.r)); cam = mix(cam, uC2, smoothstep(0.6, 0.64, t.g)); cam = mix(cam, uC3, smoothstep(0.68, 0.71, t.b) * 0.85);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cam * 1.25, vCamo);
    diffuseColor.rgb *= 0.9 + 0.1 * t.a;   // 布料、皮膚細紋
  }`)
      .replace('#include <opaque_fragment>', `outgoingLight += uRim * pow(1.0 - abs(dot(normalize(normal), vec3(0.0, 0.0, 1.0))), 3.0) * 0.26;\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'human2'; return m;
}
// ---------- 零件：每個零件記住顏色、屬於哪根骨頭、是不是迷彩布料 ----------
const _hq = new THREE.Quaternion(), _hv1 = new V3(), _hv2 = new V3();
function hp(g, color, bone, camo = 0) { g.userData.color = color; g.userData.bone = bone; g.userData.camo = camo; return g; }
function hBox(w, h, d, x, y, z, color, bone, camo = 0, rx = 0, ry = 0, rz = 0) { const g = partBox(w, h, d, x, y, z, color, rx, ry, rz); return hp(g, color, bone, camo); }
// 兩點之間的膠囊（四肢）
let HLOD = 0;   // 遠處用的簡化版：圓的段數少一點、很小的零件不畫
function hLimb(r, a, b, color, bone, camo = 0, seg = 8) {
  if (HLOD) seg = 5;
  const A = _hv1.set(...a), B = _hv2.set(...b), len = A.distanceTo(B);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 0.6), HLOD ? 1 : 2, seg);
  _hq.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(_hq); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return hp(g, color, bone, camo);
}
// 橢球（頭、肩、軀幹）；可以只取一部分（頭盔用上半球）
function hEll(rx, ry, rz, x, y, z, color, bone, camo = 0, ws = 12, hs = 8, th0 = 0, thL = Math.PI) {
  if (HLOD) { ws = Math.max(6, ws >> 1); hs = Math.max(4, hs >> 1); }
  const g = new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, th0, thL); g.scale(rx, ry, rz); g.translate(x, y, z); return hp(g, color, bone, camo);
}
// 上下不同粗細的橢圓柱（軀幹）
function hTorso(rt, rb, h, x, y, z, color, bone, camo = 0, zs = 0.62, seg = 12) {
  if (HLOD) seg = Math.max(6, seg >> 1);
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.scale(1, 1, zs); g.translate(x, y, z); return hp(g, color, bone, camo);
}
function hCyl(r, h, x, y, z, color, bone, rx = 0, rz = 0, seg = 10) {
  if (HLOD) seg = 6;
  const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return hp(g, color, bone);
}
function mergeSkinned(parts) {
  const P = [], N = [], C = [], SI = [], SW = [], CA = [], c = new THREE.Color();
  for (const p0 of parts) {
    const pr = p0.parameters; if (HLOD && pr && pr.depth !== undefined && Math.max(pr.width, pr.height, pr.depth) < 0.05) continue;   // 遠處看不到的小零件
    const g = p0.index ? p0.toNonIndexed() : p0; c.set(p0.userData.color || '#ffffff');
    const pa = g.attributes.position.array, na = g.attributes.normal.array, bn = p0.userData.bone, cm = p0.userData.camo ? 1 : 0;
    for (let i = 0; i < pa.length; i += 3) {
      P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]); C.push(c.r, c.g, c.b);
      SI.push(bn, 0, 0, 0); SW.push(1, 0, 0, 0); CA.push(cm);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aCamo', new THREE.Float32BufferAttribute(CA, 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.computeBoundingSphere(); g.boundingSphere.radius = 1.6; g.boundingSphere.center.set(0, 0.9, 0);   // 倒地、彎腰時也不會被誤裁掉
  return g;
}
// ---------- 外觀：team 'A'／'B'，look 'grunt'／'elite'／'boss' ----------
const HUMAN_GEO = {};
function humanGeo(team, look = 'grunt', lod = 0) {
  const key = team + look + lod; if (HUMAN_GEO[key]) return HUMAN_GEO[key];
  HLOD = lod;
  const PAL = PALETTE[team], W = '#ffffff';   // 迷彩部位用白色底，實際顏色在著色器
  const boss = look === 'boss', elite = look === 'elite';
  const skin = team === 'A' ? '#c99a75' : '#b98863', skinD = '#8e6346';
  const vest = elite ? '#232527' : boss ? '#1e2633' : PAL.vest, vestD = elite ? '#18191b' : boss ? '#161c27' : PAL.plate, pouch = elite ? '#2a2c2e' : PAL.pouch;
  const strap = elite ? '#151617' : '#3a3628', glove = elite || boss ? '#151515' : '#2e2c29', boot = boss ? '#0f0f10' : '#2b2520', sole = '#151311';
  const band = boss ? '#c8202a' : elite ? '#d8262e' : PAL.band, gold = '#d9a93a';
  const parts = [];
  const add = (...a) => parts.push(...a);
  // 腳：大腿（迷彩褲＋側口袋）、小腿（護膝、戰術靴）
  for (const s of [-1, 1]) {
    const x = 0.1 * s, th = s < 0 ? HB.thighL : HB.thighR, kn = s < 0 ? HB.kneeL : HB.kneeR;
    add(hLimb(0.088, [x, 0.92, 0], [x * 1.02, 0.52, -0.005], W, th, 1), hBox(0.05, 0.13, 0.12, x + 0.075 * s, 0.7, 0, W, th, 1), hBox(0.052, 0.012, 0.125, x + 0.076 * s, 0.77, 0, strap, th));
    if (s > 0 && !boss) add(hBox(0.05, 0.16, 0.1, x + 0.085, 0.8, 0.01, strap, th), hBox(0.03, 0.12, 0.05, x + 0.11, 0.82, -0.01, '#1e2024', th));   // 右大腿槍套
    add(hLimb(0.072, [x, 0.5, 0], [x, 0.14, 0.02], W, kn, 1), hBox(0.11, 0.1, 0.05, x, 0.47, -0.07, boss ? W : '#2b2c2a', kn, boss ? 1 : 0, 0.15),
      hBox(0.12, 0.13, 0.25, x, 0.065, -0.035, boot, kn), hBox(0.125, 0.03, 0.27, x, 0.014, -0.04, sole, kn), hBox(0.1, 0.06, 0.06, x, 0.12, -0.13, boot, kn, 0, 0.5),
      hLimb(0.07, [x, 0.2, 0.02], [x, 0.12, 0.02], boot, kn, 0, 8));
  }
  // 骨盆、腰帶
  add(hTorso(0.165, 0.16, 0.2, 0, 0.9, 0, W, HB.hips, 1, 0.66), hTorso(0.172, 0.172, 0.05, 0, 0.985, 0, strap, HB.hips, 0, 0.68), hBox(0.05, 0.045, 0.02, 0, 0.985, -0.12, '#6f6a5a', HB.hips));
  if (boss) add(hBox(0.06, 0.05, 0.02, 0, 0.985, -0.122, gold, HB.hips));
  // 腰、胸（衣服）
  add(hTorso(0.17, 0.165, 0.24, 0, 1.12, 0, W, HB.spine, 1, 0.64), hTorso(0.205, 0.175, 0.32, 0, 1.33, 0, W, HB.chest, 1, 0.62), hEll(0.2, 0.07, 0.13, 0, 1.47, 0, W, HB.chest, 1, 10, 5));
  if (boss) {
    // 軍官：制服外套（前襟、口袋、金扣、勳章、肩章）、斜背帶
    add(hBox(0.012, 0.36, 0.02, 0, 1.25, -0.128, '#141a24', HB.chest), hBox(0.012, 0.22, 0.02, 0, 1.08, -0.11, '#141a24', HB.spine));
    for (let k = 0; k < 4; k++) add(hBox(0.022, 0.022, 0.012, 0.035, 1.38 - k * 0.075, -0.132, gold, k < 2 ? HB.chest : HB.spine));
    add(hBox(0.09, 0.07, 0.02, -0.085, 1.37, -0.125, W, HB.chest, 1), hBox(0.09, 0.07, 0.02, 0.085, 1.37, -0.125, W, HB.chest, 1));
    for (let k = 0; k < 3; k++) add(hBox(0.022, 0.032, 0.008, -0.11 + k * 0.026, 1.43, -0.13, ['#c8202a', '#2f6fd0', gold][k], HB.chest), hBox(0.014, 0.014, 0.008, -0.11 + k * 0.026, 1.405, -0.132, gold, HB.chest));
    add(hBox(0.04, 0.5, 0.012, 0, 1.25, -0.135, '#5c1a1e', HB.chest, 0, 0, 0, 0.62), hBox(0.04, 0.5, 0.012, 0, 1.25, 0.12, '#5c1a1e', HB.chest, 0, 0, 0, -0.62));
    add(hBox(0.1, 0.1, 0.09, 0, 1.53, -0.03, W, HB.neck, 1, 0.1));   // 立領
  } else {
    // 防彈背心：前後板、側邊、彈匣袋、無線電、肩帶、背包
    add(hBox(0.33, 0.33, 0.05, 0, 1.31, -0.125, vest, HB.chest), hBox(0.31, 0.31, 0.012, 0, 1.31, -0.153, vestD, HB.chest),
      hBox(0.33, 0.35, 0.05, 0, 1.31, 0.12, vest, HB.chest), hBox(0.06, 0.22, 0.2, -0.19, 1.25, 0, vestD, HB.chest), hBox(0.06, 0.22, 0.2, 0.19, 1.25, 0, vestD, HB.chest),
      hBox(0.07, 0.03, 0.26, -0.13, 1.47, 0, vest, HB.chest), hBox(0.07, 0.03, 0.26, 0.13, 1.47, 0, vest, HB.chest));
    for (let k = 0; k < 3; k++) add(hBox(0.085, 0.12, 0.05, -0.095 + k * 0.095, 1.2, -0.17, pouch, HB.chest), hBox(0.087, 0.03, 0.052, -0.095 + k * 0.095, 1.25, -0.172, vestD, HB.chest));
    for (let k = 0; k < 3; k++) add(hBox(0.3, 0.008, 0.008, 0, 1.38 - k * 0.04, -0.156, strap, HB.chest));   // 織帶
    add(hBox(0.06, 0.1, 0.045, -0.12, 1.4, -0.165, '#2a2d30', HB.chest), hCyl(0.006, 0.22, -0.13, 1.55, -0.16, '#1a1b1c', HB.chest));    // 無線電＋天線
    add(hBox(0.27, 0.3, 0.13, 0, 1.28, 0.205, elite ? '#1c1d1f' : PAL.pack, HB.chest), hBox(0.25, 0.08, 0.02, 0, 1.36, 0.275, strap, HB.chest));
    add(hBox(0.08, 0.05, 0.012, 0.0, 1.4, -0.158, band, HB.chest));   // 胸前隊伍色章
    // 脖子護領／圍巾
    add(hTorso(0.075, 0.085, 0.09, 0, 1.52, 0.0, team === 'B' && !elite ? '#9a8a68' : W, HB.neck, team === 'B' && !elite ? 0 : 1, 1, 10));
  }
  // 脖子、頭
  add(hTorso(0.052, 0.056, 0.12, 0, 1.54, 0.005, elite ? '#1b1c1e' : skin, HB.neck, 0, 1, 8));
  const face = elite ? '#1d1e20' : skin;        // 精英戴面罩
  add(hEll(0.098, 0.118, 0.11, 0, 1.665, 0, face, HB.head, 0, 14, 10), hEll(0.075, 0.05, 0.075, 0, 1.585, -0.025, face, HB.head, 0, 10, 6));   // 頭、下巴
  add(hBox(0.026, 0.045, 0.03, 0, 1.655, -0.112, elite ? '#1d1e20' : skinD, HB.head, 0, -0.25), hBox(0.11, 0.016, 0.03, 0, 1.7, -0.098, elite ? '#1d1e20' : '#4a3a2c', HB.head));   // 鼻子、眉
  add(hBox(0.02, 0.05, 0.035, -0.1, 1.665, 0.01, face, HB.head), hBox(0.02, 0.05, 0.035, 0.1, 1.665, 0.01, face, HB.head));   // 耳朵
  // 眼睛：護目鏡（精英）、太陽眼鏡（軍官）、防彈眼鏡（一般）
  if (elite) add(hBox(0.19, 0.05, 0.05, 0, 1.68, -0.1, '#0c0d0e', HB.head), hBox(0.16, 0.034, 0.02, 0, 1.68, -0.124, '#3a6070', HB.head), hBox(0.205, 0.02, 0.2, 0, 1.68, 0.0, '#0c0d0e', HB.head));
  else add(hBox(0.17, 0.032, 0.02, 0, 1.678, -0.108, boss ? '#0b0b0c' : '#20262b', HB.head), hBox(0.012, 0.012, 0.11, -0.092, 1.682, -0.05, '#101113', HB.head), hBox(0.012, 0.012, 0.11, 0.092, 1.682, -0.05, '#101113', HB.head));
  if (!elite) add(hBox(0.05, 0.008, 0.02, 0, 1.612, -0.1, '#6a4a3a', HB.head));   // 嘴
  if (boss) add(hBox(0.07, 0.016, 0.02, 0, 1.628, -0.106, '#2a1f18', HB.head));   // 鬍子
  if (team === 'B' && !elite && !boss) add(hEll(0.105, 0.06, 0.1, 0, 1.6, -0.02, '#9a8a68', HB.head, 0, 10, 6, Math.PI * 0.45, Math.PI * 0.55));   // 圍巾拉到下巴
  if (boss) {
    // 大盤帽：帽頂、帽圈、帽簷、金色帽徽與金繩
    add(hCyl(0.125, 0.05, 0, 1.79, -0.01, '#1f2836', HB.head, 0, 0, 14), hEll(0.13, 0.025, 0.135, 0, 1.815, -0.015, '#1f2836', HB.head, 0, 14, 4),
      hCyl(0.102, 0.045, 0, 1.75, 0, '#121722', HB.head, 0, 0, 14), hBox(0.18, 0.012, 0.09, 0, 1.735, -0.12, '#0b0d10', HB.head, 0, 0.2),
      hBox(0.04, 0.04, 0.012, 0, 1.79, -0.13, gold, HB.head), hBox(0.2, 0.012, 0.012, 0, 1.75, -0.104, gold, HB.head), hBox(0.21, 0.012, 0.21, 0, 1.775, 0, '#c8202a', HB.head));
  } else {
    // 頭盔（上半球＋盔緣）、耳機、夜視鏡座、盔布
    const hc = elite ? '#1a1b1d' : PAL.helmet;
    add(hEll(0.132, 0.12, 0.142, 0, 1.69, 0.005, hc, HB.head, elite ? 0 : 1, 14, 6, 0, Math.PI * 0.55), hTorso(0.134, 0.136, 0.02, 0, 1.685, 0.005, '#1b1c1d', HB.head, 0, 1.06, 14));
    add(hCyl(0.04, 0.035, -0.115, 1.665, 0.01, '#1c1e20', HB.head, 0, Math.PI / 2, 10), hCyl(0.04, 0.035, 0.115, 1.665, 0.01, '#1c1e20', HB.head, 0, Math.PI / 2, 10));
    add(hBox(0.05, 0.035, 0.03, 0, 1.765, -0.135, '#16171a', HB.head), hBox(0.06, 0.03, 0.012, 0, 1.74, 0.145, band, HB.head));   // 隊伍色魔鬼氈章在盔後
    if (elite) add(hBox(0.09, 0.04, 0.06, 0, 1.765, -0.17, '#0e0f10', HB.head), hCyl(0.018, 0.05, -0.025, 1.745, -0.2, '#0e0f10', HB.head, Math.PI / 2), hCyl(0.018, 0.05, 0.025, 1.745, -0.2, '#0e0f10', HB.head, Math.PI / 2));
  }
  // 手臂：上臂（肩章／隊伍色章）、前臂、護肘、手套（手掌＋四指＋拇指）
  for (const s of [-1, 1]) {
    const x = 0.2 * s, sh = s < 0 ? HB.shL : HB.shR, el = s < 0 ? HB.elL : HB.elR, ha = s < 0 ? HB.haL : HB.haR;
    add(hEll(0.075, 0.07, 0.075, x, 1.43, 0, W, sh, 1, 10, 6), hLimb(0.062, [x, 1.43, 0], [x, 1.14, 0], W, sh, 1));
    if (boss) add(hBox(0.09, 0.02, 0.12, x, 1.475, 0, gold, sh), hBox(0.095, 0.006, 0.13, x, 1.487, 0, '#f2d27a', sh), hBox(0.13, 0.04, 0.13, x, 1.3, 0, '#c8202a', sh));
    else add(hBox(0.02, 0.06, 0.05, x + 0.062 * s, 1.34, 0, band, sh), hBox(0.022, 0.05, 0.06, x + 0.063 * s, 1.27, 0, elite ? '#2c2e31' : '#4a4d43', sh));
    add(hLimb(0.054, [x, 1.13, 0], [x, 0.9, 0], W, el, 1), hBox(0.1, 0.07, 0.1, x, 1.12, 0.02, elite ? '#141516' : '#2b2c2a', el), hTorso(0.058, 0.05, 0.05, x, 0.91, 0, glove, el, 0, 1, 8));
    add(hBox(0.075, 0.085, 0.04, x, 0.83, 0, glove, ha), hBox(0.07, 0.06, 0.035, x, 0.765, -0.012, glove, ha, 0, 0.4), hBox(0.025, 0.055, 0.025, x - 0.04 * s, 0.82, -0.025, glove, ha, 0, 0, 0, 0.4 * s));
  }
  const geo = mergeSkinned(parts); HLOD = 0;
  return (HUMAN_GEO[key] = geo);
}
// 建一個人：骨架（每人自己一組）＋共用的幾何
function makeHuman(team, look = 'grunt') {
  const camo = CAMO[look === 'grunt' ? team : look];
  const mat = patchHumanMat(HUMAN_MAT.clone(), PALETTE[team].rim, camo);
  const bones = HB_POS.map(() => new THREE.Bone());
  bones.forEach((bn, i) => {
    const p = HB_POS[i], pp = HB_PARENT[i] >= 0 ? HB_POS[HB_PARENT[i]] : [0, 0, 0];
    bn.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (HB_PARENT[i] >= 0) bones[HB_PARENT[i]].add(bn);
  });
  const mesh = new THREE.SkinnedMesh(humanGeo(team, look), mat);
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = true;
  const g = new THREE.Group(); g.add(mesh);
  return { g, mesh, bones, mat, look, team };
}
// 換外觀（狂暴模式的精英、魔王）：同一副骨架，換幾何和迷彩色
function setHumanLook(b, look) {
  if (!b.hm || b.hm.look === look) return;
  b.hm.look = look; b.hm.lod = -1;
  const cm = CAMO[look === 'grunt' ? b.baseTeam : look]; b.mat.userData.camoU.forEach((u, i) => u.value.set(cm[i]));
}

// ---------- 兩段式 IK：肩 S、目標 T（都在胸骨座標），pole 是手肘想朝的方向 ----------
const _ikS = new V3(), _ikT = new V3(), _ikE = new V3(), _ikU = new V3(), _ikW = new V3(), _ikD = new V3(), _ikQ = new THREE.Quaternion(), _ikQ2 = new THREE.Quaternion(), _DOWN = new V3(0, -1, 0);
function armIK(sh, el, T, pole) {
  _ikS.copy(sh.position);
  _ikU.subVectors(T, _ikS); let d = _ikU.length(); d = clamp(d, 0.08, ARM_A + ARM_B - 0.005); _ikU.normalize();
  const cosA = clamp((ARM_A * ARM_A + d * d - ARM_B * ARM_B) / (2 * ARM_A * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _ikW.copy(pole).addScaledVector(_ikU, -pole.dot(_ikU)); if (_ikW.lengthSq() < 1e-6) _ikW.set(0, -1, 0); _ikW.normalize();
  _ikE.copy(_ikS).addScaledVector(_ikU, ARM_A * cosA).addScaledVector(_ikW, ARM_A * sinA);
  _ikD.subVectors(_ikE, _ikS).normalize(); _ikQ.setFromUnitVectors(_DOWN, _ikD); sh.quaternion.copy(_ikQ);
  _ikT.copy(_ikS).addScaledVector(_ikU, d); _ikD.subVectors(_ikT, _ikE).normalize(); _ikQ2.setFromUnitVectors(_DOWN, _ikD);
  el.quaternion.copy(_ikQ.invert()).multiply(_ikQ2);
}
// 每種槍：右手（握把）、左手（護木）在槍座標的位置
const HAND_T = {
  rifle: [[0.16, 1.27, -0.43], [0.16, 1.33, -0.64]], carbine: [[0.16, 1.27, -0.4], [0.16, 1.33, -0.6]], smg: [[0.16, 1.28, -0.38], [0.16, 1.31, -0.5]],
  sniper: [[0.16, 1.27, -0.44], [0.16, 1.33, -0.68]], shotgun: [[0.16, 1.28, -0.4], [0.16, 1.33, -0.66]],
  pistol: [[0.06, 1.3, -0.5], [0.035, 1.285, -0.48]], deagle: [[0.06, 1.29, -0.5], [0.035, 1.275, -0.48]],
};
const POLE_R = new V3(0.75, -0.6, 0.15), POLE_L = new V3(-0.45, -0.9, 0), POLE_LIMP_R = new V3(0.2, 0, -1), POLE_LIMP_L = new V3(-0.2, 0, -1);
const _hT = new V3(), _hT2 = new V3(), _hW = new V3(), _hq2 = new THREE.Quaternion(), _hAx = new V3();
// 彈簧（中彈反應）：x'' = -k x - c x'
function hSpring(s, k, dt) { s.v += (-120 * s.x - 13 * s.v) * dt; s.x += s.v * dt; if (Math.abs(s.x) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = 0; s.v = 0; } }
function humanInit(b) {
  b.hs = { sp: { x: 0, v: 0 }, sy: { x: 0, v: 0 }, sr: { x: 0, v: 0 }, hd: { x: 0, v: 0 }, hy: { x: 0, v: 0 }, kL: { x: 0, v: 0 }, kR: { x: 0, v: 0 } };
}
// 中彈：dir 是子彈飛的方向（世界座標）；照部位和方向推一下
function humanHit(b, part, dir, dmg) {
  if (!b.hs) humanInit(b);
  const f = Math.cos(b.yaw), s = Math.sin(b.yaw);
  // 子彈方向換到這個人的座標：back>0 往他背後推（正面中彈）、right>0 往他右邊推
  const back = dir ? -(dir.x * -s + dir.z * -f) : 1, right = dir ? dir.x * f - dir.z * s : 0, k = clamp(dmg / 30, 0.5, 2.2);
  const H = b.hs;
  if (part === 'head') { H.hd.v += 16 * back * k; H.hy.v += 10 * right * k; H.sp.v += 3 * back * k; }
  else if (part === 'legs') { const side = right > 0 ? 'kL' : 'kR'; H[Math.random() < 0.5 ? 'kL' : 'kR'].v += 9 * k; H[side].v += 4 * k; H.sp.v -= 2.5 * k; }
  else { H.sp.v += 7 * back * k; H.sy.v += 9 * (right >= 0 ? 1 : -1) * k * (0.6 + Math.random() * 0.4); H.sr.v += 5 * right * k; H.hd.v += 4 * back * k; }
  // 被打退半步（踉蹌）
  if (dir && b.alive) { const kb = (part === 'head' ? 1.2 : part === 'legs' ? 0.6 : 1.6) * k; b.kbX = dir.x * kb; b.kbZ = dir.z * kb; b.kbT = 0.25; }
}
// 倒地準備：順著子彈方向倒（打腳往前跪倒、正面爆頭往後），加一點隨機
function humanDie(b, part, dir) {
  const f = Math.cos(b.yaw), s = Math.sin(b.yaw);
  let ang;   // 倒的方向（世界 yaw）
  if (part === 'legs' || !dir) ang = b.yaw + rand(-0.6, 0.6);                 // 往前（面向 -z 的前方）
  else ang = Math.atan2(-dir.x, -dir.z) + rand(-0.45, 0.45);               // 順著子彈飛的方向
  b.dd = { ang, th: 0, tv: rand(0.9, 1.6) + (part === 'head' ? 1.2 : 0), t: 0, land: false, armR: rand(-0.5, 0.5), armL: rand(-0.5, 0.5), twist: rand(-0.5, 0.5), headLag: 0, part };
}
const DEATH_GRAV = 9.0;
// 每格：擺骨頭
function humanPose(b, dt) {
  const B = b.hm.bones, H = b.hs || (humanInit(b), b.hs), p = b.phys.pos;
  const d2 = camera ? p.distanceToSquared(camera.position) : 0, near = d2 < 45 * 45;
  // 遠近換模型：22 公尺外用簡化版（三角形少一半多）
  const lod = d2 > 22 * 22 ? 1 : 0;
  if (b.hm.lod !== lod) { b.hm.lod = lod; b.hm.mesh.geometry = humanGeo(b.baseTeam, b.hm.look, lod); }
  for (const k in H) hSpring(H[k], 0, dt);
  // 共用：重設
  for (const bn of B) bn.quaternion.identity();
  B[HB.hips].position.set(0, 0.95, 0);
  if (!b.alive) { humanDeathPose(b, dt); return; }
  b.g.quaternion.setFromAxisAngle(_hAx.set(0, 1, 0), b.yaw); b.g.position.copy(p);
  const sp = Math.hypot(b.phys.vel.x, b.phys.vel.z), mv = Math.min(1, sp / 3.2), run = clamp((sp - 3) / 2, 0, 1), ck = b.ck;
  const sw = Math.sin(b.walk) * mv * (0.55 + run * 0.2) * (1 - ck * 0.7), bob = Math.abs(Math.cos(b.walk)) * mv * 0.035;
  // 腳：走路擺動、膝蓋在往後擺時彎；蹲下：左膝跪地、右腳往前
  const kneeW = (x) => Math.max(0, -x) * 1.6 + 0.1 * mv;
  B[HB.thighL].rotation.x = sw * (1 - ck) + 0.25 * ck - H.kL.x * 0.6; B[HB.thighR].rotation.x = -sw * (1 - ck) + 1.35 * ck - H.kR.x * 0.6;
  B[HB.kneeL].rotation.x = -(kneeW(sw) * (1 - ck) + 1.55 * ck + H.kL.x * 1.4); B[HB.kneeR].rotation.x = -(kneeW(-sw) * (1 - ck) + 1.4 * ck + H.kR.x * 1.4);
  B[HB.thighL].rotation.z = -0.04; B[HB.thighR].rotation.z = 0.04;
  const legDrop = Math.max(H.kL.x, H.kR.x, 0) * 0.22;   // 打腳：身子一沉
  B[HB.hips].position.y = 0.95 - 0.46 * ck - bob * (1 - ck) - legDrop + (b.phys.onGround ? 0 : 0.03);
  B[HB.hips].rotation.y = sw * 0.12;
  // 上身：瞄準上下分給腰和胸，持槍側身、走路反向扭、彈簧反應
  const aim = clamp(b.pitch || 0, -0.9, 0.9);
  let gx = 0, lean = 0, act = '';
  const thr = game.t - (b.thrownAt || -9);
  if (b.reloadT > 0 && b.wpn) { act = 'reload'; const kq = Math.sin(clamp(1 - b.reloadT / b.wpn.reload, 0, 1) * Math.PI); gx = -0.55 * kq; lean = 0.08 * kq; }
  else if (b.state === 'plant' || b.state === 'defuse') { act = 'use'; gx = -1.0; lean = 0.5; }
  else if (thr < 0.55) { act = 'throw'; const t = thr / 0.55; gx = -0.6 * Math.sin(t * Math.PI); lean = 0.25 * Math.sin(t * Math.PI); }
  const ready = act ? 0 : 1, lowReady = b.state === 'patrol' && !b.visible && sp > 0.5 ? 0.35 : 0;   // 巡邏時槍口稍微朝下
  B[HB.spine].rotation.set(-aim * 0.35 - lean * 0.6 + H.sp.x * 0.5 + run * 0.08 * ready, -sw * 0.18 - 0.12 + H.sy.x * 0.4, H.sr.x * 0.3);
  B[HB.chest].rotation.set(-aim * 0.55 - lean * 0.4 + H.sp.x * 0.5, -0.22 + H.sy.x * 0.5, H.sr.x * 0.3);
  B[HB.neck].rotation.set(H.hd.x * 0.4 - aim * 0.05, 0.22 + H.hy.x * 0.3, 0);
  B[HB.head].rotation.set(H.hd.x * 0.6 + aim * 0.05, 0.1 + H.hy.x * 0.5, 0);
  // 槍：掛在胸骨上，抵消側身讓槍口朝前
  const gp = b.gunP;
  gp.rotation.set(lerp(gp.rotation.x, gx - lowReady, 1 - Math.exp(-14 * dt)), 0.34, 0);
  if (!near) return;    // 遠的人不算手（看不清楚，省時間）
  // 手：IK 握槍（換彈時左手去拿彈匣、丟東西時右手往後甩再往前、裝拆彈時手往前下）
  b.g.updateMatrixWorld(true);
  const hand = HAND_T[b.wpn && b.wpn.vm || 'rifle'] || HAND_T.rifle, chest = B[HB.chest];
  _hT.set(...hand[0]); b.gunM.localToWorld(_hT); chest.worldToLocal(_hT);
  _hT2.set(...hand[1]);
  if (act === 'reload') { const t = clamp(1 - b.reloadT / b.wpn.reload, 0, 1), q = Math.sin(t * Math.PI); _hT2.set(hand[1][0] - 0.03, hand[1][1] - 0.12 - q * 0.16, lerp(hand[1][2], -0.3, q)); }
  b.gunM.localToWorld(_hT2); chest.worldToLocal(_hT2);
  if (act === 'throw') { const t = thr / 0.55; _hT.set(0.25, 0.25 - t * 0.35, 0.15 - t * 0.6); }
  const wr = (T, S) => T.addScaledVector(_hW.subVectors(T, S).normalize(), -0.06);   // 手腕在握點後面一點
  armIK(B[HB.shR], B[HB.elR], wr(_hT, B[HB.shR].position), POLE_R);
  armIK(B[HB.shL], B[HB.elL], wr(_hT2, B[HB.shL].position), POLE_L);
}
// 倒地：膝蓋先軟、身體順著方向倒（越倒越快）、撞地彈一下、手臂甩開、頭跟著晃
function humanDeathPose(b, dt) {
  const B = b.hm.bones, D = b.dd || (humanDie(b, 'body', null), b.dd), p = b.phys.pos;
  D.t += dt;
  const sink = Math.min(1, D.t / 0.28);
  if (!D.land) {
    D.tv += (DEATH_GRAV * Math.sin(Math.max(0.05, D.th)) * 0.55 + 0.6) * dt; D.th += D.tv * dt;
    if (D.th >= 1.5) { D.th = 1.5; D.tv = -D.tv * 0.22; if (Math.abs(D.tv) < 0.35) { D.land = true; D.tv = 0; } else sfx('step', 0.4, { pos: p, surface: 'concrete' }); }
  }
  const e = D.th / 1.5;
  // 整個人繞腳底倒：轉軸是倒的方向的水平垂直線
  _hAx.set(Math.cos(D.ang), 0, -Math.sin(D.ang));
  b.g.quaternion.setFromAxisAngle(_hAx, -D.th);
  _hq2.setFromAxisAngle(_hW.set(0, 1, 0), b.yaw + D.twist * e); b.g.quaternion.multiply(_hq2);
  b.g.position.set(p.x, p.y + 0.06 * e, p.z);
  // 膝蓋一軟、髖往下沉；倒下後腳半彎
  B[HB.hips].position.y = 0.95 - 0.3 * sink * (1 - e * 0.85);
  B[HB.kneeL].rotation.x = -1.2 * sink * (1 - e * 0.6); B[HB.kneeR].rotation.x = -0.9 * sink * (1 - e * 0.55);
  B[HB.thighL].rotation.x = 0.5 * sink * (1 - e * 0.7); B[HB.thighR].rotation.x = 0.35 * sink * (1 - e * 0.6);
  // 身體：爆頭往後仰、身中彈往前彎再攤平
  const bend = D.part === 'head' ? -0.25 : 0.35;
  B[HB.spine].rotation.set(bend * sink * (1 - e), D.twist * 0.4, 0); B[HB.chest].rotation.set(bend * 0.6 * sink * (1 - e), 0, 0);
  D.headLag = lerp(D.headLag, -D.tv * 0.25, 1 - Math.exp(-10 * dt));
  B[HB.neck].rotation.set(D.headLag + (D.land ? 0.15 : 0), D.twist * 0.6, 0);
  // 手臂：鬆開槍、往外甩（倒地時落到身體兩側）
  const fl = Math.min(1, D.t / 0.35);
  B[HB.shR].rotation.set(-0.9 * fl * (1 - e * 0.4) + D.armR, 0, (0.6 + e * 0.7) * fl);
  B[HB.shL].rotation.set(-0.7 * fl * (1 - e * 0.4) + D.armL, 0, -(0.5 + e * 0.8) * fl);
  B[HB.elR].rotation.x = -0.5 * fl; B[HB.elL].rotation.x = -0.7 * fl;
  // 槍：脫手往下掉
  if (b.gunP) { b.gunP.rotation.x = lerp(b.gunP.rotation.x, -1.3, 1 - Math.exp(-6 * dt)); b.gunP.position.y = HUMAN_GUN_P[1] - 0.25 * fl; }
}
// 槍掛點（胸骨座標）：原本模型座標的 (0.16, 1.3, -0.3) 減掉胸骨位置
const HUMAN_GUN_P = [0.16, 0.0, -0.3];
