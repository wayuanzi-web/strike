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
const sunLight = new THREE.DirectionalLight('#ffc792', 2.5); scene.add(sunLight);
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
  sky = buildSky(t.sky); scene.add(sky);
}
// 重建地圖網格（換地圖時）：舊的丟掉、新的加進場景
function rebuildMapMeshes() {
  for (const m of mapMeshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  mapMeshes.length = 0;
  rebuildDecor();
  for (const m of buildMapMeshes(MAX_ANISO)) { mapMeshes.push(m); scene.add(m); }
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
  const g = x.createRadialGradient(40, 34, 1, 64, 64, 66);
  g.addColorStop(0, hi); g.addColorStop(0.14, base); g.addColorStop(0.74, base); g.addColorStop(0.92, '#0b0c0f'); g.addColorStop(1, rim);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const VM_MATS = {
  metal: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#5c636c', '#eef3f8', '#6a6258'), vertexColors: true }),
  poly: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#57513f', '#bdb39a', '#5a5242'), vertexColors: true }),
  cloth: new THREE.MeshMatcapMaterial({ matcap: matcapTex('#6f7566', '#c4c9b6', '#4d4b42'), vertexColors: true }),
};
// 步槍：通用突擊步槍外形（不是任何一把真槍）。槍身朝 -z，原點在握把附近
// ---------- 手上的槍：每種武器一組模型，換槍時換掉 gunRig 裡的那組 ----------
const gunRig = new THREE.Group(); vmScene.add(gunRig);
const GLOVE = '#5a5d5e', SLEEVE = '#8a907c', CUFF = '#6a7062';
// 右手（握握把）：位置是手套中心；左手：位置是手套中心，可以是單獨的物件（換彈時會動）
function vmRightArm(x, y, z) {
  const ox = x - 0.012, oy = y + 0.085, oz = z - 0.03;
  return [partBox(0.085, 0.09, 0.34, 0.035 + ox, -0.135 + oy, 0.22 + oz, SLEEVE, 0.35), partBox(0.095, 0.1, 0.05, 0.035 + ox, -0.105 + oy, 0.07 + oz, CUFF, 0.35),
    partBox(0.065, 0.075, 0.09, 0.012 + ox, -0.085 + oy, 0.03 + oz, GLOVE, -0.3), partBox(0.06, 0.02, 0.05, -0.02 + ox, -0.06 + oy, -0.02 + oz, GLOVE)];
}
function vmLeftArm(x, y, z) {
  const ox = x + 0.005, oy = y + 0.045, oz = z + 0.47;
  return [partBox(0.085, 0.09, 0.38, -0.08 + ox, -0.115 + oy, -0.32 + oz, SLEEVE, 0.35, 0.55), partBox(0.095, 0.1, 0.05, -0.04 + ox, -0.07 + oy, -0.43 + oz, CUFF, 0.35, 0.55),
    partBox(0.08, 0.05, 0.1, -0.005 + ox, -0.045 + oy, -0.47 + oz, GLOVE), partBox(0.03, 0.06, 0.09, 0.035 + ox, -0.01 + oy, -0.47 + oz, GLOVE)];
}
function vmAssemble(metal, poly, cloth, left, magParts, magPos, muzzle) {
  const g = new THREE.Group();
  if (metal.length) g.add(new THREE.Mesh(mergeParts(metal), VM_MATS.metal));
  if (poly.length) g.add(new THREE.Mesh(mergeParts(poly), VM_MATS.poly));
  if (cloth.length) g.add(new THREE.Mesh(mergeParts(cloth), VM_MATS.cloth));
  const la = new THREE.Mesh(mergeParts(left.length ? left : [partBox(0.001, 0.001, 0.001, 0, 0, 0, GLOVE)]), VM_MATS.cloth); g.add(la); g.userData.leftArm = la;
  const mag = new THREE.Mesh(mergeParts(magParts), VM_MATS.metal); mag.position.copy(magPos); g.add(mag); g.userData.mag = mag; g.userData.magY = magPos.y;
  g.userData.muzzle = muzzle; g.visible = false; gunRig.add(g);
  return g;
}
const VMODELS = {};
(function buildViewmodels() {
  const M = '#ffffff', D = '#9aa0a8', P = '#ffffff', P2 = '#c9bfae', K = '#4a4e55';
  // 步槍「曙七」
  {
    const metal = [
      partProfile([[0.12, -0.022], [-0.33, -0.022], [-0.33, 0.058], [0.09, 0.058], [0.12, 0.035]], 0.064, 0, M),
      partBox(0.03, 0.012, 0.36, 0, 0.066, -0.13, D), partCyl(0.0125, 0.24, 0, 0.018, -0.68, M), partCyl(0.019, 0.075, 0, 0.018, -0.83, D, 6),
      partBox(0.008, 0.024, 0.075, 0.017, 0.018, -0.83, K), partBox(0.008, 0.024, 0.075, -0.017, 0.018, -0.83, K),
      partBox(0.016, 0.05, 0.02, 0, 0.055, -0.56, M), partBox(0.008, 0.045, 0.012, 0, 0.0675, -0.56, D),
      partBox(0.04, 0.012, 0.05, 0, 0.066, -0.06, M), partBox(0.005, 0.03, 0.025, -0.014, 0.075, -0.06, D), partBox(0.005, 0.03, 0.025, 0.014, 0.075, -0.06, D),
      partBox(0.012, 0.012, 0.05, 0.04, 0.035, -0.04, D), partBox(0.006, 0.006, 0.07, 0, -0.052, 0.0, M), partBox(0.006, 0.03, 0.006, 0, -0.038, 0.035, M),
      partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.15, '#15171a'),
    ];
    for (let k = 0; k < 10; k++) metal.push(partBox(0.034, 0.006, 0.012, 0, 0.074, -0.29 + k * 0.032, D));
    const poly = [
      partProfile([[-0.3, -0.036], [-0.58, -0.03], [-0.58, 0.046], [-0.3, 0.052]], 0.072, 0, P),
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.045, 0, P),
      partProfile([[0.12, 0.05], [0.12, -0.03], [0.3, -0.095], [0.335, -0.095], [0.335, 0.058], [0.2, 0.058]], 0.056, 0, P),
      partBox(0.06, 0.13, 0.02, 0, -0.02, 0.33, P2),
    ];
    for (let k = 0; k < 5; k++) poly.push(partBox(0.074, 0.008, 0.012, 0, 0.02, -0.33 - k * 0.05, P2));
    VMODELS.rifle = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.045, -0.47),
      [partProfile([[0.035, 0.08], [-0.035, 0.08], [-0.07, -0.1], [0.002, -0.112]], 0.042, 0, M)], new V3(0, -0.1, -0.2), new V3(0, 0.018, -0.88));
  }
  // 衝鋒槍「蜂」：短機匣、短槍管、摺疊托、直彈匣
  {
    const metal = [
      partBox(0.058, 0.07, 0.34, 0, 0.018, -0.1, M), partCyl(0.012, 0.16, 0, 0.022, -0.34, M), partCyl(0.022, 0.06, 0, 0.022, -0.44, D, 6),
      partBox(0.026, 0.01, 0.26, 0, 0.058, -0.1, D), partBox(0.012, 0.04, 0.014, 0, 0.068, -0.24, D), partBox(0.03, 0.02, 0.03, 0, 0.068, 0.04, D),
      partBox(0.012, 0.012, 0.04, 0.035, 0.03, -0.12, D), partBox(0.006, 0.006, 0.06, 0, -0.04, 0.0, M),
      partBox(0.012, 0.012, 0.2, 0.02, 0.0, 0.17, D), partBox(0.012, 0.012, 0.2, -0.02, 0.0, 0.17, D), partBox(0.05, 0.08, 0.015, 0, -0.02, 0.27, D),
    ];
    const poly = [
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.03, -0.14], [0.072, -0.14]], 0.045, 0, P),
      partBox(0.065, 0.05, 0.12, 0, -0.01, -0.25, P), partBox(0.035, 0.09, 0.035, 0, -0.07, -0.29, P2),
    ];
    VMODELS.smg = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.1, -0.3),
      [partBox(0.03, 0.16, 0.045, 0, -0.03, 0, M)], new V3(0, -0.08, -0.12), new V3(0, 0.022, -0.48));
  }
  // 狙擊槍「鷲」：長槍管、瞄準鏡、拉機柄、厚槍托
  {
    const metal = [
      partBox(0.06, 0.07, 0.42, 0, 0.018, -0.12, M), partCyl(0.014, 0.6, 0, 0.022, -0.62, M), partCyl(0.02, 0.07, 0, 0.022, -0.95, D, 6),
      partCyl(0.026, 0.3, 0, 0.11, -0.13, '#5a5f66', 10), partCyl(0.034, 0.07, 0, 0.11, -0.3, '#5a5f66', 10), partCyl(0.03, 0.06, 0, 0.11, 0.03, '#5a5f66', 10),
      partBox(0.02, 0.05, 0.03, 0, 0.068, -0.22, D), partBox(0.02, 0.05, 0.03, 0, 0.068, -0.02, D),
      partBox(0.06, 0.012, 0.012, 0.05, 0.03, 0.02, D), partCyl(0.012, 0.02, 0.085, 0.03, 0.02, D, 6),
      partBox(0.006, 0.006, 0.07, 0, -0.052, 0.0, M),
    ];
    const poly = [
      partProfile([[-0.02, -0.04], [-0.48, -0.03], [-0.48, 0.03], [-0.02, 0.04]], 0.07, 0, P),
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.048, 0, P),
      partProfile([[0.1, 0.06], [0.1, -0.04], [0.36, -0.11], [0.4, -0.11], [0.4, 0.07], [0.25, 0.07]], 0.06, 0, P),
      partBox(0.064, 0.14, 0.02, 0, -0.02, 0.4, P2),
    ];
    VMODELS.sniper = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.06, -0.4),
      [partBox(0.04, 0.06, 0.08, 0, 0, 0, M)], new V3(0, -0.05, -0.12), new V3(0, 0.022, -0.99));
  }
  // 霰彈槍「犀」：粗槍管＋下方彈倉管、泵動護木（左手握著，開槍後會拉）
  {
    const metal = [
      partBox(0.06, 0.08, 0.3, 0, 0.015, -0.08, M), partCyl(0.019, 0.62, 0, 0.032, -0.53, M), partCyl(0.015, 0.5, 0, -0.012, -0.48, D),
      partBox(0.012, 0.015, 0.015, 0, 0.056, -0.82, D), partBox(0.006, 0.006, 0.07, 0, -0.045, 0.02, M), partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.1, '#15171a'),
    ];
    const poly = [
      partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.145], [0.078, -0.145]], 0.048, 0, P),
      partProfile([[0.08, 0.05], [0.08, -0.04], [0.32, -0.1], [0.35, -0.1], [0.35, 0.05], [0.2, 0.06]], 0.056, 0, P),
      partBox(0.064, 0.13, 0.02, 0, -0.025, 0.35, P2),
    ];
    // 泵動護木和左手一起動（當成左手的一部分）
    const left = vmLeftArm(-0.005, -0.05, -0.44).concat([partBox(0.058, 0.05, 0.16, 0, -0.01, -0.44, P2)]);
    for (let k = 0; k < 5; k++) left.push(partBox(0.062, 0.006, 0.01, 0, 0.005, -0.38 - k * 0.028, P));
    VMODELS.shotgun = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), left,
      [partCyl(0.011, 0.05, 0, 0, 0, '#c43d2a')], new V3(0.02, -0.04, -0.1), new V3(0, 0.032, -0.86));
  }
  // 手槍「隼」：滑套、雙手握
  {
    const metal = [
      partBox(0.034, 0.042, 0.21, 0, 0.035, -0.09, M), partBox(0.03, 0.03, 0.17, 0, 0.0, -0.08, D),
      partBox(0.008, 0.012, 0.01, 0, 0.061, -0.19, D), partBox(0.024, 0.012, 0.012, 0, 0.061, 0.0, D),
      partBox(0.006, 0.006, 0.05, 0, -0.03, -0.04, M), partCyl(0.009, 0.02, 0, 0.035, -0.2, '#15171a'),
    ];
    for (let k = 0; k < 4; k++) metal.push(partBox(0.036, 0.03, 0.004, 0, 0.038, 0.0 - k * 0.01, D));
    const poly = [partProfile([[0.025, -0.012], [-0.02, -0.012], [0.005, -0.12], [0.05, -0.12]], 0.032, 0, P)];
    VMODELS.pistol = vmAssemble(metal, poly, vmRightArm(0.015, -0.075, 0.015), vmLeftArm(-0.02, -0.08, -0.0),
      [partBox(0.024, 0.09, 0.03, 0, 0, 0, M)], new V3(0.02, -0.1, 0.01), new V3(0, 0.035, -0.21));
  }
  // 卡賓槍「嵐」：平頂導軌、短槍管、伸縮管狀槍托、護木比較長
  {
    const metal = [
      partBox(0.058, 0.072, 0.36, 0, 0.018, -0.12, M), partCyl(0.012, 0.3, 0, 0.02, -0.5, M), partCyl(0.018, 0.06, 0, 0.02, -0.68, D, 6),
      partBox(0.03, 0.012, 0.42, 0, 0.06, -0.16, D), partBox(0.012, 0.05, 0.014, 0, 0.07, -0.46, D), partBox(0.03, 0.026, 0.03, 0, 0.076, 0.0, D),
      partBox(0.022, 0.022, 0.2, 0, 0.012, 0.16, D), partBox(0.05, 0.09, 0.06, 0, -0.01, 0.28, K), partBox(0.006, 0.006, 0.06, 0, -0.045, 0.0, M),
      partBox(0.03, 0.03, 0.06, 0.033, 0.02, -0.14, '#15171a'),
    ];
    for (let k = 0; k < 8; k++) metal.push(partBox(0.034, 0.006, 0.012, 0, 0.068, -0.3 + k * 0.035, D));
    const poly = [partBox(0.07, 0.072, 0.24, 0, 0.016, -0.36, P2), partProfile([[0.04, -0.02], [0.0, -0.02], [0.035, -0.14], [0.078, -0.14]], 0.045, 0, P)];
    for (let k = 0; k < 4; k++) poly.push(partBox(0.074, 0.008, 0.012, 0, 0.0, -0.28 - k * 0.045, P));
    VMODELS.carbine = vmAssemble(metal, poly, vmRightArm(0.012, -0.085, 0.03), vmLeftArm(-0.005, -0.05, -0.38),
      [partBox(0.03, 0.15, 0.05, 0, -0.03, 0, M)], new V3(0, -0.09, -0.16), new V3(0, 0.02, -0.72));
  }
  // 重手槍「雷」：大滑套、三角槍口
  {
    const metal = [
      partBox(0.044, 0.052, 0.26, 0, 0.042, -0.1, M), partBox(0.038, 0.036, 0.21, 0, 0.0, -0.09, D),
      partBox(0.01, 0.014, 0.012, 0, 0.074, -0.22, D), partBox(0.03, 0.014, 0.014, 0, 0.074, 0.02, D),
      partBox(0.006, 0.006, 0.055, 0, -0.032, -0.04, M), partCyl(0.011, 0.02, 0, 0.042, -0.235, '#15171a'),
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
  const pp = camera.position, dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  const rel = angDiff(camera.rotation.y, Math.atan2(-dx, -dz));
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
  const k = MAP.theme.amb, base = k === 'rail' ? 0.05 : k === 'town' ? 0.025 : 0.04;
  const target = on ? base * (0.7 + 0.3 * Math.sin(AMB.lfoT * 0.35) + 0.15 * Math.sin(AMB.lfoT * 1.3)) : 0;
  AMB.gain.gain.value += (target - AMB.gain.gain.value) * Math.min(1, dt * 2);
  AMB.filter.frequency.value = k === 'town' ? 700 : k === 'rail' ? 320 : 450;
  if (!on || (AMB.nextT -= dt) > 0) return;
  AMB.nextT = rand(6, 16);
  const pan = rand(-0.7, 0.7), r = Math.random();
  if (k === 'harbor') {
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
  if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
