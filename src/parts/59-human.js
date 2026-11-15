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
  B: ['#4d573c', '#39422e', '#636c4a', '#242a1f'],      // 敵方：深綠林地迷彩
  A: ['#8f8b6e', '#6a6c4e', '#a39a7c', '#54463a'],      // 我方：美軍 OCP（棕綠底、橄欖與淺沙色斑塊、深棕點）
  elite: ['#2c2e31', '#1d1e20', '#3c3e42', '#141516'],
  boss: ['#26303f', '#26303f', '#2c3748', '#1b2230'],      // 軍官制服：深藍、幾乎素色
};
// 寫實版（2026-11-15）：PBR 材質（每個零件自己的粗糙度、金屬度）、布料的織紋與皺褶凹凸、皮膚的透光感、臉部細節貼圖
const HUMAN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMap: VM_ENV, envMapIntensity: 0.45 });
const SKIN_TONES = ['#c49c80', '#b48c70', '#d8b49a', '#a07a62', '#86624c', '#cfa88c', '#bc9178', '#94705a'];
// 臉：一張 256×256 的臉部細節圖（眼白、虹膜、上眼瞼、眉毛、唇色、鼻影、眼窩與臉頰的陰影、鬍渣），從正面投影到頭上
// RGB＝要乘上的顏色，A＝這個細節有多強；範圍：x −0.1～0.1、y 1.55～1.75（頭的綁定位置）
const FACE_TEX = (function () {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
  const X = (x) => (x / 0.2 + 0.5) * N, Y = (y) => (1 - (y - 1.55) / 0.2) * N;
  c.clearRect(0, 0, N, N);
  const blob = (x, y, rx, ry, col, a) => { const g = c.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), rx * N / 0.2); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.save(); c.translate(X(x), Y(y)); c.scale(1, ry / rx); c.translate(-X(x), -Y(y)); c.fillStyle = g; c.fillRect(0, 0, N, N); c.restore(); };
  // 眼窩、鼻翼、法令紋的陰影；臉頰、鼻頭偏紅
  for (const s of [-1, 1]) { blob(0.036 * s, 1.684, 0.028, 0.018, '85,60,52', 0.32); blob(0.05 * s, 1.632, 0.03, 0.022, '190,110,95', 0.09); blob(0.026 * s, 1.612, 0.008, 0.025, '95,65,55', 0.2); }
  blob(0, 1.632, 0.01, 0.01, '190,105,95', 0.1);
  // 眼睛：眼白、虹膜、瞳孔、上眼瞼的線、眼角
  for (const s of [-1, 1]) {
    const ex = X(0.033 * s), ey = Y(1.68), w = 0.0135 / 0.2 * N, h = 0.0052 / 0.2 * N;
    c.save(); c.beginPath(); c.ellipse(ex, ey, w, h, 0, 0, 6.283); c.clip();
    c.fillStyle = 'rgba(232,226,218,1)'; c.fillRect(ex - w, ey - h, w * 2, h * 2);
    c.fillStyle = 'rgba(78,52,34,1)'; c.beginPath(); c.arc(ex - 0.001 * s * N / 0.2, ey + 0.4, h * 1.05, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(12,10,9,1)'; c.beginPath(); c.arc(ex - 0.001 * s * N / 0.2, ey + 0.4, h * 0.45, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex + 1.2, ey - 1.2, 1.1, 0, 6.283); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(40,26,20,.95)'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(ex, ey + 0.6, w * 1.03, h * 1.25, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = 'rgba(80,55,45,.5)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(ex, ey - 0.5, w * 0.95, h * 1.1, 0, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
    // 眉毛：一根一根的短線
    for (let k = 0; k < 26; k++) { const t = k / 25, bx = X((0.016 + t * 0.034) * s), by = Y(1.703 + Math.sin(t * 3) * 0.004 - t * 0.003); c.strokeStyle = `rgba(42,30,22,${0.75 - t * 0.25})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(bx, by + 2); c.lineTo(bx + 3 * s, by - 2); c.stroke(); }
  }
  // 嘴唇：上唇較暗、下唇較亮，嘴角
  c.fillStyle = 'rgba(150,80,72,.85)'; c.beginPath(); c.moveTo(X(-0.022), Y(1.6035)); c.quadraticCurveTo(X(-0.008), Y(1.611), X(0), Y(1.607)); c.quadraticCurveTo(X(0.008), Y(1.611), X(0.022), Y(1.6035)); c.quadraticCurveTo(X(0), Y(1.6005), X(-0.022), Y(1.6035)); c.fill();
  c.fillStyle = 'rgba(176,98,88,.75)'; c.beginPath(); c.moveTo(X(-0.02), Y(1.6025)); c.quadraticCurveTo(X(0), Y(1.592), X(0.02), Y(1.6025)); c.quadraticCurveTo(X(0), Y(1.6), X(-0.02), Y(1.6025)); c.fill();
  c.strokeStyle = 'rgba(70,35,30,.9)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(X(-0.022), Y(1.6033)); c.quadraticCurveTo(X(0), Y(1.6), X(0.022), Y(1.6033)); c.stroke();
  // 鬍渣：下巴、上唇一點一點的深色
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 1400; k++) { const x = (rnd() - 0.5) * 0.11, y = 1.565 + rnd() * 0.06; if (y > 1.598 && Math.abs(x) > 0.03) continue; if (y > 1.616) continue; if (Math.abs(y - 1.6035) < 0.005 && Math.abs(x) < 0.024) continue; c.fillStyle = `rgba(55,40,32,${0.25 + rnd() * 0.25})`; c.fillRect(X(x), Y(y), 1.2, 1.2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t;
})();   // 每個人隨機一種膚色
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
// 寫實的頭用的細節圖：只有眉毛和鬍渣（眼睛是真的眼球、嘴唇在頂點顏色裡）。四張臉的眼睛都對齊在 x=±0.029、y=1.682
const FACE_MH = (function () {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
  const X = (x) => (x / 0.2 + 0.5) * N, Y = (y) => (1 - (y - 1.55) / 0.2) * N;
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (const s of [-1, 1]) for (let k = 0; k < 160; k++) {
    const t = rnd(), bx = (0.01 + t * 0.042) * s, by = 1.7015 + Math.sin(t * 2.6) * 0.0045 - t * 0.002 + (rnd() - 0.5) * 0.0045 * (1 - t * 0.5);
    c.strokeStyle = `rgba(26,19,14,${0.8 + rnd() * 0.2 - t * 0.2})`; c.lineWidth = 2; c.beginPath(); c.moveTo(X(bx), Y(by) + 1.5); c.lineTo(X(bx) + 3.5 * s, Y(by) - 1.5); c.stroke();
  }
  for (let k = 0; k < 2600; k++) { const x = (rnd() - 0.5) * 0.13, y = 1.555 + rnd() * 0.07; if (y > 1.607 && Math.abs(x) > 0.032) continue; if (y > 1.628) continue; if (Math.abs(y - 1.614) < 0.007 && Math.abs(x) < 0.026) continue; c.fillStyle = `rgba(40,30,24,${0.16 + rnd() * 0.2})`; c.fillRect(X(x), Y(y), 1.3, 1.3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t;
})();
// 迷彩＋布料細節＋邊緣光（每個人一份材質，顏色放 uniform，程式共用）
function patchHumanMat(m, rim, camo) {
  const U = m.userData.rimU = { value: new THREE.Color().setRGB(...rim.split(',').map(Number)) };
  const C = m.userData.camoU = camo.map((c) => ({ value: new THREE.Color(c) }));
  m.userData.skinU = { value: new THREE.Color(pick(SKIN_TONES)) };
  m.userData.lampU = { value: new THREE.Color(0, 0, 0) };   // 夜裡被路燈照到的顏色（腳下光照貼圖的值）
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = U; C.forEach((u, i) => { sh.uniforms['uC' + i] = u; });
    sh.uniforms.uCamoT = { value: CAMO_TEX }; sh.uniforms.uSkin = m.userData.skinU; sh.uniforms.uLampH = m.userData.lampU; sh.uniforms.uFl = LIGHT_U.uFl;
    sh.uniforms.uFaceT = { value: FACE_TEX }; sh.uniforms.uFaceM = { value: FACE_MH };
    sh.vertexShader = 'attribute float aCamo;\nattribute vec2 aRM;\nvarying float vCamo;\nvarying vec3 vRest;\nvarying vec3 vRN;\nvarying vec3 vHw;\nvarying vec2 vRM;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamo = aCamo; vRest = position; vRN = normal; vRM = aRM;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvHw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform vec3 uRim; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform sampler2D uCamoT; uniform vec3 uSkin; uniform vec3 uLampH; uniform sampler2D uFaceT; uniform sampler2D uFaceM;
varying float vCamo; varying vec3 vRest; varying vec3 vRN; varying vec3 vHw; varying vec2 vRM;
${FL_GLSL}
// 布料凹凸：織紋（細）＋皺褶（沿著四肢的橫向褶子、關節處多）
float clothH(vec3 p, vec3 n) {
  vec3 w = abs(n); w /= (w.x + w.y + w.z + 1e-4);
  float weave = texture2D(uCamoT, p.zy * 15.0).a * w.x + texture2D(uCamoT, p.xz * 15.0).a * w.y + texture2D(uCamoT, p.xy * 15.0).a * w.z;
  float jt = exp(-pow((p.y - 0.5) * 9.0, 2.0)) + exp(-pow((p.y - 1.13) * 9.0, 2.0)) + exp(-pow((p.y - 0.93) * 7.0, 2.0)) * 0.6;
  float fold = sin(p.y * 95.0 + texture2D(uCamoT, p.xz * 1.3).r * 9.0) * (0.35 + jt);
  return weave * 0.6 + fold * 0.5;
}
vec3 bumpN(vec3 n, vec3 vp, float h, float k) {
  vec3 dpx = dFdx(vp), dpy = dFdy(vp); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2) * k; return normalize(abs(det) * n - g);
}
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 w = abs(vRN); w /= (w.x + w.y + w.z + 1e-4);
    vec4 t = texture2D(uCamoT, vRest.zy * 1.6) * w.x + texture2D(uCamoT, vRest.xz * 1.6) * w.y + texture2D(uCamoT, vRest.xy * 1.6) * w.z;
    vec3 cam = uC0; cam = mix(cam, uC1, smoothstep(0.52, 0.56, t.r)); cam = mix(cam, uC2, smoothstep(0.6, 0.64, t.g)); cam = mix(cam, uC3, smoothstep(0.68, 0.71, t.b) * 0.85);
    float cw = clamp(vCamo, 0.0, 1.0) * (1.0 - step(1.5, vCamo)), sw = step(1.5, vCamo);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cam * 1.25, cw);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uSkin * (0.94 + 0.12 * t.a), sw);   // 皮膚：每人膚色不同，帶一點斑駁
    // 臉：正面投影細節圖（只在頭部、朝前的皮膚）
    if (sw > 0.5 && vRest.y > 1.55 && vRest.y < 1.75 && vRN.z < -0.05) {
      vec2 fuv = vec2(vRest.x / 0.2 + 0.5, (vRest.y - 1.55) / 0.2);
      vec4 fc = vCamo > 2.5 ? texture2D(uFaceM, fuv) : texture2D(uFaceT, fuv);
      diffuseColor.rgb = mix(diffuseColor.rgb, pow(fc.rgb, vec3(2.2)), fc.a * smoothstep(-0.05, -0.4, vRN.z));
    }
    diffuseColor.rgb *= 0.9 + 0.1 * t.a;   // 布料、皮膚細紋
    // 布料：腳下越靠近地面越髒（泥土色）、膝蓋磨白
    float dirt = (1.0 - smoothstep(0.05, 0.45, vRest.y)) * cw;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.27, 0.21) * (0.8 + 0.4 * t.b), dirt * 0.55);
    diffuseColor.rgb *= 1.0 + cw * 0.12 * exp(-pow((vRest.y - 0.48) * 14.0, 2.0)) * step(abs(vRest.z), 0.12) * step(vRest.z, -0.02);
  }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRM.y;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float cwN = clamp(vCamo, 0.0, 1.0) * (1.0 - step(1.5, vCamo)); if (cwN > 0.5 || vRM.x > 0.85) normal = bumpN(normal, -vViewPosition, clothH(vRest, vRN), 0.0016); }`)
      .replace('#include <opaque_fragment>', `outgoingLight += uRim * pow(1.0 - abs(dot(normalize(normal), vec3(0.0, 0.0, 1.0))), 3.0) * 0.26;
if (vCamo > 1.5) outgoingLight += diffuseColor.rgb * vec3(0.9, 0.35, 0.25) * pow(1.0 - abs(dot(normalize(normal), vec3(0.0, 0.0, 1.0))), 2.0) * 0.22;   // 皮膚邊緣透一點紅（透光感）
outgoingLight += diffuseColor.rgb * (flashLight(vHw) * 1.6 + uLampH * (0.55 + 0.45 * max(normalize(normal).y, 0.0)));   // 槍口火光、夜間路燈
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'human5'; return m;
}
// ---------- 零件：每個零件記住顏色、屬於哪根骨頭、是不是迷彩布料 ----------
const _hq = new THREE.Quaternion(), _hv1 = new V3(), _hv2 = new V3();
function hp(g, color, bone, camo = 0) { g.userData.color = color; g.userData.bone = bone; g.userData.camo = camo; return g; }
function hBox(w, h, d, x, y, z, color, bone, camo = 0, rx = 0, ry = 0, rz = 0) {
  const mn = Math.min(w, h, d);
  if (HLOD || mn < 0.012) { const g = partBox(w, h, d, x, y, z, color, rx, ry, rz); return hp(g, color, bone, camo); }
  // 圓角方塊：裝備、靴子不再是硬邊方塊（倒角約最短邊的 30%）
  const g = roundBox(w, h, d, Math.min(0.014, mn * 0.32));
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1)));
  return hp(g, color, bone, camo);
}
// 圓角方塊：細分的方塊，每個點推到「內縮方塊＋半徑」的表面上
function roundBox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new V3(), c = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // 細分點先往邊緣集中（倒角那一段才夠圓）
    v.x = Math.sign(v.x) * (Math.abs(v.x) > w / 2 - 1e-6 ? w / 2 : Math.abs(v.x) > w / 6 + 1e-6 ? hx : Math.abs(v.x));
    v.y = Math.sign(v.y) * (Math.abs(v.y) > h / 2 - 1e-6 ? h / 2 : Math.abs(v.y) > h / 6 + 1e-6 ? hy : Math.abs(v.y));
    v.z = Math.sign(v.z) * (Math.abs(v.z) > d / 2 - 1e-6 ? d / 2 : Math.abs(v.z) > d / 6 + 1e-6 ? hz : Math.abs(v.z));
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    const dd = v.clone().sub(c); if (dd.lengthSq() > 1e-12) v.copy(c).add(dd.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// 材質：粗糙度、金屬度（不指定就看是不是布料、皮膚）
const RM_METAL = [0.32, 0.85], RM_PLASTIC = [0.55, 0], RM_GLASS = [0.12, 0.2];
function hRM(g, rm) { g.userData.rm = rm; return g; }
// 依顏色認材質：金色、金屬扣件、鏡片、皮靴
const RM_BY_COLOR = { '#d9a93a': RM_METAL, '#f2d27a': RM_METAL, '#8c8c80': RM_METAL, '#6f6a5a': RM_METAL, '#5a5a56': RM_METAL, '#3a6070': RM_GLASS, '#2b2520': [0.8, 0], '#8e7553': [0.92, 0], '#5c4a34': [0.9, 0], '#75654b': [0.85, 0], '#0f0f10': [0.4, 0], '#151311': [0.85, 0], '#2e2c29': [0.7, 0], '#151515': [0.6, 0] };
// 兩點之間的膠囊（四肢）
let HLOD = 0;   // 遠處用的簡化版：圓的段數少一點、很小的零件不畫
function hLimb(r, a, b, color, bone, camo = 0, seg = 10) {
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
// 寫實的頭（58-heads，MakeHuman 資料）：解開成一個零件，帶自己的頂點顏色、種類、頭／脖子兩根骨頭的權重
const MH_CACHE = {};
function mhHeadPart(fi) {
  const H = MH_HEADS[fi % MH_HEADS.length];
  if (!MH_CACHE[H.name]) {
    const b64 = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
    const p = b64(H.p, Uint16Array), n = b64(H.nrm, Uint8Array), c = b64(H.c, Uint8Array), k = b64(H.k, Uint8Array), wn = b64(H.wn, Uint8Array), tri = b64(H.tri || MH_HEADS[0].tri, Uint16Array);
    const N = tri.length, pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3), kind = new Float32Array(N), w = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = tri[i];
      for (let a = 0; a < 3; a++) { pos[i * 3 + a] = p[v * 3 + a] / 65535 * 0.4 - 0.2 + (a === 1 ? 1.65 : 0); nrm[i * 3 + a] = n[v * 3 + a] / 255 * 2 - 1; col[i * 3 + a] = c[v * 3 + a] / 255; }
      kind[i] = k[v]; w[i] = wn[v] / 255;
    }
    MH_CACHE[H.name] = { pos, nrm, col, kind, w };
  }
  const D = MH_CACHE[H.name], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(D.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(D.nrm, 3));
  g.userData = { color: '#ffffff', bone: HB.head, camo: 3, raw: D };
  return g;
}
function mergeSkinned(parts) {
  const P = [], N = [], C = [], SI = [], SW = [], CA = [], RM = [], c = new THREE.Color();
  for (const p0 of parts) {
    const pr = p0.parameters; if (HLOD && pr && pr.depth !== undefined && Math.max(pr.width, pr.height, pr.depth) < 0.05) continue;   // 遠處看不到的小零件
    const g = p0.index ? p0.toNonIndexed() : p0; c.set(p0.userData.color || '#ffffff');
    const pa = g.attributes.position.array, na = g.attributes.normal.array, bn = p0.userData.bone, cm = p0.userData.camo || 0;
    const raw = p0.userData.raw;
    if (raw) {   // 寫實的頭：顏色、種類、權重都是每個頂點自己的
      for (let i = 0, v = 0; i < pa.length; i += 3, v++) {
        P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]); C.push(raw.col[i], raw.col[i + 1], raw.col[i + 2]);
        SI.push(HB.head, HB.neck, 0, 0); SW.push(1 - raw.w[v], raw.w[v], 0, 0); CA.push(raw.kind[v]); RM.push(raw.kind[v] > 2 ? (Math.abs(pa[i]) < 0.035 && pa[i + 2] < -0.075 && pa[i + 1] > 1.62 ? 0.36 : 0.5) : 0.1, 0);   // 額頭、鼻子比較油亮；眼球最亮
      }
      continue;
    }
    const col = String(p0.userData.color || '').toLowerCase();
    const rm = p0.userData.rm || RM_BY_COLOR[col] || (cm === 1 ? [0.93, 0] : cm === 2 ? [0.52, 0] : [0.78, 0]);
    for (let i = 0; i < pa.length; i += 3) {
      const ao = 1 - Math.max(0, -na[i + 1]) * 0.28 - (pa[i + 1] < 0.3 ? 0.06 : 0);   // 朝下的面、腳邊比較暗（接觸陰影）
      P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]); C.push(c.r * ao, c.g * ao, c.b * ao);
      SI.push(bn, 0, 0, 0); SW.push(1, 0, 0, 0); CA.push(cm); RM.push(rm[0], rm[1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aCamo', new THREE.Float32BufferAttribute(CA, 1)); g.setAttribute('aRM', new THREE.Float32BufferAttribute(RM, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.computeBoundingSphere(); g.boundingSphere.radius = 1.6; g.boundingSphere.center.set(0, 0.9, 0);   // 倒地、彎腰時也不會被誤裁掉
  return g;
}
// ---------- 外觀：team 'A'／'B'，look 'grunt'／'elite'／'boss' ----------
const HUMAN_GEO = {};
function humanGeo(team, look = 'grunt', lod = 0, faceI = 0) {
  const mh = lod === 0 && look !== 'elite' && typeof MH_HEADS !== 'undefined';   // 近看：寫實的頭（精英戴面罩、遠處簡化版用原本的）
  const key = team + look + lod + (mh ? 'f' + faceI % MH_HEADS.length : ''); if (HUMAN_GEO[key]) return HUMAN_GEO[key];
  HLOD = lod;
  const PAL = PALETTE[team], W = '#ffffff';   // 迷彩部位用白色底，實際顏色在著色器
  const boss = look === 'boss', elite = look === 'elite', face0 = faceI;
  const skin = '#ffffff', skinD = '#d9bcaa', SK = 2;   // 皮膚：白底＋每人自己的膚色（著色器 uSkin）
  const vest = elite ? '#232527' : boss ? '#1e2633' : PAL.vest, vestD = elite ? '#18191b' : boss ? '#161c27' : PAL.plate, pouch = elite ? '#2a2c2e' : PAL.pouch;
  const us = team === 'A' && !elite && !boss;
  const strap = elite ? '#151617' : us ? '#6b5a40' : '#2c2e26', glove = elite || boss ? '#151515' : us ? '#75654b' : '#2e2c29', boot = boss ? '#0f0f10' : us ? '#8e7553' : '#2b2520', sole = us ? '#5c4a34' : '#151311';
  const band = boss ? '#c8202a' : elite ? '#d8262e' : PAL.band, gold = '#d9a93a';
  const parts = [];
  const add = (...a) => parts.push(...a);
  // 腳：大腿（寬鬆的作戰褲、膝上布料堆積＋側口袋）、小腿（褲管塞進靴子的皺褶、護膝、戰術靴）
  for (const s of [-1, 1]) {
    const x = 0.1 * s, th = s < 0 ? HB.thighL : HB.thighR, kn = s < 0 ? HB.kneeL : HB.kneeR;
    add(hLimb(0.094, [x, 0.92, 0], [x * 1.02, 0.52, -0.005], W, th, 1), hEll(0.082, 0.07, 0.085, x * 1.02, 0.56, -0.004, W, th, 1, 10, 6), hBox(0.05, 0.13, 0.12, x + 0.075 * s, 0.7, 0, W, th, 1), hBox(0.052, 0.012, 0.125, x + 0.076 * s, 0.77, 0, strap, th));
    if (s > 0 && !boss) add(hBox(0.05, 0.16, 0.1, x + 0.085, 0.8, 0.01, strap, th), hBox(0.03, 0.12, 0.05, x + 0.11, 0.82, -0.01, '#1e2024', th));   // 右大腿槍套
    add(hLimb(0.074, [x, 0.5, 0], [x, 0.16, 0.02], W, kn, 1), hEll(0.078, 0.05, 0.08, x, 0.2, 0.018, W, kn, 1, 10, 5), hBox(0.11, 0.1, 0.05, x, 0.47, -0.07, boss ? W : '#2b2c2a', kn, boss ? 1 : 0, 0.15),
      hBox(0.12, 0.13, 0.25, x, 0.065, -0.035, boot, kn), hBox(0.04, 0.09, 0.006, x, 0.11, -0.163, '#4a4238', kn, 0, 0.45), hBox(0.125, 0.03, 0.27, x, 0.014, -0.04, sole, kn), hBox(0.1, 0.06, 0.06, x, 0.12, -0.13, boot, kn, 0, 0.5),
      hLimb(0.07, [x, 0.2, 0.02], [x, 0.12, 0.02], boot, kn, 0, 8));
  }
  // 骨盆、腰帶
  if (!boss) add(hBox(0.1, 0.11, 0.07, -0.17, 0.92, 0.07, '#3c3a32', HB.hips, 0, 0, 0.6), hBox(0.06, 0.08, 0.05, 0.13, 0.93, 0.12, PAL.pouch, HB.hips));   // 回收袋、腰包
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
    add(hBox(0.06, 0.1, 0.045, -0.12, 1.4, -0.165, '#2a2d30', HB.chest), hCyl(0.005, 0.24, -0.15, 1.52, 0.17, '#1a1b1c', HB.chest));    // 無線電＋天線
    add(hBox(0.27, 0.3, 0.13, 0, 1.28, 0.205, elite ? '#1c1d1f' : PAL.pack, HB.chest), hBox(0.25, 0.08, 0.02, 0, 1.36, 0.275, strap, HB.chest));
    add(hBox(0.08, 0.05, 0.012, 0.0, 1.4, -0.158, band, HB.chest));   // 胸前隊伍色章
    add(hBox(0.1, 0.022, 0.008, 0.095, 1.44, -0.157, '#2d2b26', HB.chest), hBox(0.08, 0.012, 0.004, 0.095, 1.44, -0.162, '#8a8470', HB.chest));   // 名條
    add(hCyl(0.028, 0.07, 0.16, 1.2, -0.12, '#4d5332', HB.chest), hCyl(0.006, 0.022, 0.16, 1.245, -0.12, '#8c8c80', HB.chest), hCyl(0.028, 0.07, -0.165, 1.2, -0.12, '#4d5332', HB.chest));   // 手榴彈
    add(hBox(0.03, 0.14, 0.02, -0.07, 1.31, -0.158, '#1a1b1c', HB.chest, 0, 0, 0, 0.2), hBox(0.012, 0.05, 0.022, -0.085, 1.39, -0.158, '#5a5a56', HB.chest, 0, 0, 0, 0.2));   // 刀
    add(hBox(0.12, 0.1, 0.06, 0, 1.38, 0.285, '#3a3a34', HB.chest), hBox(0.045, 0.045, 0.004, 0, 1.38, 0.317, '#c8202a', HB.chest), hBox(0.015, 0.045, 0.006, 0, 1.38, 0.319, '#f2f2f2', HB.chest), hBox(0.045, 0.015, 0.006, 0, 1.38, 0.319, '#f2f2f2', HB.chest));   // 背包上的急救包（紅十字）
    add(hCyl(0.008, 0.36, 0.11, 1.38, 0.13, '#2a2a28', HB.chest, 0.35, 0, 6));   // 水袋管
    // 脖子護領／圍巾
    add(hTorso(0.075, 0.085, 0.09, 0, 1.52, 0.0, team === 'B' && !elite ? '#4a4f3e' : W, HB.neck, team === 'B' && !elite ? 0 : 1, 1, 10));
  }
  // 脖子、頭
  const face = elite ? '#1d1e20' : skin;        // 精英戴面罩
  const fk = elite ? 0 : SK;
  if (mh) add(mhHeadPart(face0));
  else {
  add(hTorso(0.054, 0.058, 0.12, 0, 1.54, 0.005, elite ? '#1b1c1e' : skin, HB.neck, elite ? 0 : SK, 1, 10));
  add(hEll(0.096, 0.118, 0.108, 0, 1.665, 0, face, HB.head, fk, 18, 14), hEll(0.072, 0.05, 0.072, 0, 1.585, -0.028, face, HB.head, fk, 12, 8));   // 頭、下巴
  // 臉的立體：鼻子（鼻樑＋鼻頭＋鼻翼）、眉骨、顴骨、嘴唇的微凸；眉毛、眼睛、唇色、鬍渣在臉部細節圖裡
  const nose = elite ? '#1d1e20' : skin;
  add(hEll(0.0085, 0.024, 0.011, 0, 1.652, -0.102, nose, HB.head, fk, 8, 8), hEll(0.0105, 0.0085, 0.0095, 0, 1.63, -0.108, nose, HB.head, fk, 8, 6),
    hEll(0.0068, 0.0062, 0.007, -0.0095, 1.628, -0.103, nose, HB.head, fk, 6, 4), hEll(0.0068, 0.0062, 0.007, 0.0095, 1.628, -0.103, nose, HB.head, fk, 6, 4));
  add(hEll(0.085, 0.011, 0.022, 0, 1.699, -0.088, face, HB.head, fk, 12, 4));   // 眉骨
  if (!elite) add(hEll(0.024, 0.0075, 0.01, 0, 1.604, -0.094, skin, HB.head, SK, 8, 4), hEll(0.022, 0.008, 0.011, 0, 1.596, -0.092, skin, HB.head, SK, 8, 4));
  add(hEll(0.014, 0.03, 0.024, -0.099, 1.665, 0.01, face, HB.head, fk, 8, 6), hEll(0.014, 0.03, 0.024, 0.099, 1.665, 0.01, face, HB.head, fk, 8, 6));   // 耳朵
  }
  // 眼睛：護目鏡（精英）、太陽眼鏡（軍官）、防彈眼鏡（一般）
  if (elite) add(hBox(0.19, 0.05, 0.05, 0, 1.68, -0.1, '#0c0d0e', HB.head), hBox(0.16, 0.034, 0.02, 0, 1.68, -0.124, '#3a6070', HB.head), hBox(0.205, 0.02, 0.2, 0, 1.68, 0.0, '#0c0d0e', HB.head));
  else if (boss) add(hRM(hBox(0.17, 0.032, 0.02, 0, 1.678, -0.108, '#0b0b0c', HB.head), RM_GLASS), hBox(0.012, 0.012, 0.11, -0.092, 1.682, -0.05, '#101113', HB.head), hBox(0.012, 0.012, 0.11, 0.092, 1.682, -0.05, '#101113', HB.head));
  else if (!mh) add(hBox(0.15, 0.004, 0.006, 0, 1.696, -0.112, '#18191b', HB.head), hBox(0.004, 0.004, 0.11, -0.088, 1.69, -0.055, '#18191b', HB.head), hBox(0.004, 0.004, 0.11, 0.088, 1.69, -0.055, '#18191b', HB.head));   // 防彈眼鏡：只剩細框（看得到眼睛）
  if (boss) add(hBox(0.07, 0.016, 0.02, 0, 1.628, -0.106, '#2a1f18', HB.head));   // 鬍子
  if (team === 'B' && !elite && !boss) add(hEll(0.105, 0.06, 0.1, 0, 1.6, -0.02, '#4a4f3e', HB.head, 0, 10, 6, Math.PI * 0.45, Math.PI * 0.55));   // 圍巾拉到下巴
  if (boss) {
    // 大盤帽：帽頂、帽圈、帽簷、金色帽徽與金繩
    add(hCyl(0.125, 0.05, 0, 1.79, -0.01, '#1f2836', HB.head, 0, 0, 14), hEll(0.13, 0.025, 0.135, 0, 1.815, -0.015, '#1f2836', HB.head, 0, 14, 4),
      hCyl(0.102, 0.045, 0, 1.75, 0, '#121722', HB.head, 0, 0, 14), hBox(0.18, 0.012, 0.09, 0, 1.735, -0.12, '#0b0d10', HB.head, 0, 0.2),
      hBox(0.04, 0.04, 0.012, 0, 1.79, -0.13, gold, HB.head), hBox(0.2, 0.012, 0.012, 0, 1.75, -0.104, gold, HB.head), hBox(0.21, 0.012, 0.21, 0, 1.775, 0, '#c8202a', HB.head));
  } else {
    // 頭盔（上半球＋盔緣）、耳機、夜視鏡座、盔布
    const hc = elite ? '#1a1b1d' : PAL.helmet;
    if (mh) add(hEll(0.112, 0.112, 0.128, 0, 1.712, 0.002, hc, HB.head, 1, 20, 8, 0, Math.PI * 0.52), hTorso(0.1125, 0.1125, 0.012, 0, 1.705, 0.002, us ? '#6f6648' : '#22261e', HB.head, 0, 1.143, 20),   // 貼合頭型的頭盔＋盔緣
      hBox(0.012, 0.09, 0.012, -0.093, 1.655, -0.03, strap, HB.head, 0, 0.35), hBox(0.012, 0.09, 0.012, 0.093, 1.655, -0.03, strap, HB.head, 0, 0.35), hBox(0.05, 0.016, 0.02, 0, 1.578, -0.088, strap, HB.head));   // 下巴帶
    else add(hEll(0.132, 0.12, 0.142, 0, 1.705, 0.008, hc, HB.head, elite ? 0 : 1, 14, 6, 0, Math.PI * 0.55), hTorso(0.134, 0.136, 0.02, 0, 1.7, 0.008, '#1b1c1d', HB.head, 0, 1.06, 14));
    const cx = mh ? 0.098 : 0.115, cc = us ? '#5f5238' : '#1c1e20';
    add(hCyl(0.036, 0.03, -cx, 1.662, 0.012, cc, HB.head, 0, Math.PI / 2, 10), hCyl(0.036, 0.03, cx, 1.662, 0.012, cc, HB.head, 0, Math.PI / 2, 10));
    add(hBox(0.05, 0.035, 0.03, 0, mh ? 1.785 : 1.765, mh ? -0.112 : -0.135, '#16171a', HB.head), hBox(0.06, 0.03, 0.012, 0, 1.74, 0.145, band, HB.head));   // 隊伍色魔鬼氈章在盔後
    if (elite) add(hBox(0.09, 0.04, 0.06, 0, 1.765, -0.17, '#0e0f10', HB.head), hCyl(0.018, 0.05, -0.025, 1.745, -0.2, '#0e0f10', HB.head, Math.PI / 2), hCyl(0.018, 0.05, 0.025, 1.745, -0.2, '#0e0f10', HB.head, Math.PI / 2));
  }
  // 手臂：上臂（肩章／隊伍色章）、前臂、護肘、手套（手掌＋四指＋拇指）
  for (const s of [-1, 1]) {
    const x = 0.2 * s, sh = s < 0 ? HB.shL : HB.shR, el = s < 0 ? HB.elL : HB.elR, ha = s < 0 ? HB.haL : HB.haR;
    add(hEll(0.068, 0.064, 0.07, x, 1.43, 0, W, sh, 1, 10, 6), hLimb(0.054, [x, 1.43, 0], [x, 1.14, 0], W, sh, 1));
    if (boss) add(hBox(0.09, 0.02, 0.12, x, 1.475, 0, gold, sh), hBox(0.095, 0.006, 0.13, x, 1.487, 0, '#f2d27a', sh), hBox(0.13, 0.04, 0.13, x, 1.3, 0, '#c8202a', sh));
    else add(hBox(0.02, 0.06, 0.05, x + 0.062 * s, 1.34, 0, band, sh), hBox(0.022, 0.05, 0.06, x + 0.063 * s, 1.27, 0, elite ? '#2c2e31' : '#4a4d43', sh));
    add(hLimb(0.047, [x, 1.13, 0], [x, 0.9, 0], W, el, 1), hBox(0.1, 0.07, 0.1, x, 1.12, 0.02, elite ? '#141516' : '#2b2c2a', el), hTorso(0.058, 0.05, 0.05, x, 0.91, 0, glove, el, 0, 1, 8));
    add(hEll(0.04, 0.05, 0.022, x, 0.825, 0, glove, ha, 0, 10, 6), hBox(0.07, 0.016, 0.03, x, 0.79, -0.01, '#44413c', ha));   // 手掌、指節護片
    for (let f = 0; f < 4; f++) { const fx = x + (f - 1.5) * 0.017; add(hLimb(0.0095, [fx, 0.79, -0.005], [fx, 0.755, -0.03], glove, ha, 0, 6), hLimb(0.009, [fx, 0.755, -0.03], [fx, 0.765, -0.055], glove, ha, 0, 6)); }   // 四指彎起來握
    add(hLimb(0.011, [x - 0.03 * s, 0.82, -0.01], [x - 0.035 * s, 0.785, -0.045], glove, ha, 0, 6));   // 拇指
  }
  const geo = mergeSkinned(parts); HLOD = 0;
  return (HUMAN_GEO[key] = geo);
}
// 建一個人：骨架（每人自己一組）＋共用的幾何
let HUMAN_SEQ = 0;
function makeHuman(team, look = 'grunt') {
  const camo = CAMO[look === 'grunt' ? team : look];
  const mat = patchHumanMat(HUMAN_MAT.clone(), PALETTE[team].rim, camo);
  const bones = HB_POS.map(() => new THREE.Bone());
  bones.forEach((bn, i) => {
    const p = HB_POS[i], pp = HB_PARENT[i] >= 0 ? HB_POS[HB_PARENT[i]] : [0, 0, 0];
    bn.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (HB_PARENT[i] >= 0) bones[HB_PARENT[i]].add(bn);
  });
  const face = HUMAN_SEQ++ % MH_HEADS.length; mat.userData.skinU.value.set(MH_HEADS[face].tone);
  const mesh = new THREE.SkinnedMesh(humanGeo(team, look, 0, face), mat);
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = true;
  const g = new THREE.Group(); g.add(mesh);
  return { g, mesh, bones, mat, look, team, face };
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
  b.hs = { sp: { x: 0, v: 0 }, sy: { x: 0, v: 0 }, sr: { x: 0, v: 0 }, hd: { x: 0, v: 0 }, hy: { x: 0, v: 0 }, kL: { x: 0, v: 0 }, kR: { x: 0, v: 0 }, ld: { x: 0, v: 0 } };
  b.hYaw = 0; b.tLag = 0; b.tStep = 0; b.tSide = 1; b.airT = 0; b.airK = 0; b.prevSp = 0; b.lastYaw = b.yaw;
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
  if (b.hm.lod !== lod) { b.hm.lod = lod; b.hm.mesh.geometry = humanGeo(b.baseTeam, b.hm.look, lod, b.hm.face); }
  for (const k in H) hSpring(H[k], 0, dt);
  if (b.alive === false && b.lastYaw !== undefined) b.lastYaw = undefined;
  // 共用：重設
  for (const bn of B) bn.quaternion.identity();
  B[HB.hips].position.set(0, 0.95, 0);
  if (!b.alive) { humanDeathPose(b, dt); return; }
  b.g.quaternion.setFromAxisAngle(_hAx.set(0, 1, 0), b.yaw); b.g.position.copy(p);
  const vx = b.phys.vel.x, vz = b.phys.vel.z, sp = Math.hypot(vx, vz), mv = Math.min(1, sp / 3.2), run = clamp((sp - 3) / 2, 0, 1), ck = b.ck;
  const og = b.phys.onGround, fy = Math.sin(b.yaw), fc = Math.cos(b.yaw);
  if (!H.ld) H.ld = { x: 0, v: 0 };
  // 移動方向換到身體座標：0＝往前、正＝往右；往後走時腳朝反方向、步子小一點、膝蓋反過來彎
  let ma = sp > 0.3 ? Math.atan2(vx * fc - vz * fy, -(vx * fy + vz * fc)) : 0, back = 0;
  if (ma > 1.75) { ma -= Math.PI; back = 1; } else if (ma < -1.75) { ma += Math.PI; back = 1; }
  const hyT = clamp(ma, -1.2, 1.2) * 0.7 * mv * (1 - ck * 0.5);
  b.hYaw = lerp(b.hYaw, hyT, 1 - Math.exp(-8 * dt));
  const res = (ma - hyT) * mv, sideK = Math.sin(res), fwdK = Math.cos(res);   // 腰轉不夠的部分：腳往側邊跨
  // 原地轉身：下半身先留著、轉超過 30 度就踏一步跟上
  const dy = angDiff(b.lastYaw === undefined ? b.yaw : b.lastYaw, b.yaw); b.lastYaw = b.yaw;
  if (sp < 0.5 && og && ck < 0.5) {
    b.tLag = clamp(b.tLag - dy, -1.2, 1.2);
    if (b.tStep <= 0 && Math.abs(b.tLag) > 0.5) { b.tStep = 0.34; b.tSide = b.tLag > 0 ? 1 : -1; if (near && d2 < 15 * 15) sfx('step', 0.25, { pos: p, surface: 'concrete' }); }
  } else b.tLag = lerp(b.tLag, 0, 1 - Math.exp(-10 * dt));
  let stepL = 0, stepR = 0;
  if (b.tStep > 0) {
    b.tStep -= dt; const t = 1 - Math.max(0, b.tStep) / 0.34, lift = Math.sin(t * Math.PI);
    b.tLag = lerp(b.tLag, 0, 1 - Math.exp(-9 * dt));
    if (b.tSide > 0) stepL = lift; else stepR = lift;
  }
  // 跳：空中縮腳；落地：膝蓋一彎、身子一沉（彈簧）
  if (!og) { b.airT += dt; b.airK = lerp(b.airK, b.airT > 0.12 ? 1 : 0, 1 - Math.exp(-10 * dt)); }
  else { if (b.airT > 0.22) H.ld.v += 2.4 * Math.min(1.4, b.airT * 1.6); b.airT = 0; b.airK = lerp(b.airK, 0, 1 - Math.exp(-18 * dt)); }
  // 急停：上身往前晃一下
  if (b.prevSp > 2.4 && sp < 0.8 && og) H.sp.v += 1.6;
  b.prevSp = lerp(b.prevSp, sp, 1 - Math.exp(-12 * dt)); if (sp < 0.8) b.prevSp = Math.min(b.prevSp, sp + 0.5);
  const sw = Math.sin(b.walk) * mv * (0.55 + run * 0.2) * (1 - ck * 0.7) * (back ? 0.72 : 1), bob = Math.abs(Math.cos(b.walk)) * mv * 0.035;
  const swX = sw * fwdK, swZ = sw * sideK * 0.55, ldx = Math.max(0, H.ld.x), ak = b.airK;
  // 腳：走路擺動、膝蓋在往後擺時彎（倒退走時反過來）；蹲下：左膝跪地、右腳往前
  const kneeW = (x) => Math.max(0, back ? x : -x) * 1.6 + 0.1 * mv;
  B[HB.thighL].rotation.x = swX * (1 - ck) + 0.25 * ck - H.kL.x * 0.6 + stepL * 0.4 + ak * 0.5 + ldx * 0.5;
  B[HB.thighR].rotation.x = -swX * (1 - ck) + 1.35 * ck - H.kR.x * 0.6 + stepR * 0.4 + ak * 0.25 + ldx * 0.5;
  B[HB.kneeL].rotation.x = -(kneeW(swX) * (1 - ck) + 1.55 * ck + H.kL.x * 1.4 + stepL * 0.8 + ak * 0.95 + ldx * 1.1);
  B[HB.kneeR].rotation.x = -(kneeW(-swX) * (1 - ck) + 1.4 * ck + H.kR.x * 1.4 + stepR * 0.8 + ak * 0.6 + ldx * 1.1);
  const stance = (1 - mv) * (1 - ck) * 0.035;   // 站著時兩腳稍微打開（比較自然）
  B[HB.thighL].rotation.z = -0.04 - stance + swZ * (1 - ck); B[HB.thighR].rotation.z = 0.04 + stance - swZ * (1 - ck);
  const legDrop = Math.max(H.kL.x, H.kR.x, 0) * 0.22;   // 打腳：身子一沉
  B[HB.hips].position.y = 0.95 - 0.46 * ck - bob * (1 - ck) - legDrop + (og ? 0 : 0.03) - ldx * 0.22 - ak * 0.06;
  // 腰：朝移動方向轉（上身轉回來對準目標）＋原地轉身時下半身落後
  const hipY = -b.hYaw + b.tLag;
  B[HB.hips].rotation.y = sw * 0.12 * fwdK + hipY;
  // 探頭：上身往旁邊歪、髖往那邊挪一點
  const la = b.leanA || 0;
  B[HB.hips].position.x = la * 0.06;
  // 上身：瞄準上下分給腰和胸，持槍側身、走路反向扭、彈簧反應
  const aim = clamp(b.pitch || 0, -0.9, 0.9);
  let gx = 0, lean = 0, act = '';
  const thr = game.t - (b.thrownAt || -9);
  if (b.reloadT > 0 && b.wpn) { act = 'reload'; const kq = Math.sin(clamp(1 - b.reloadT / b.wpn.reload, 0, 1) * Math.PI); gx = -0.55 * kq; lean = 0.08 * kq; }
  else if (b.state === 'plant' || b.state === 'defuse') { act = 'use'; gx = -1.0; lean = 0.5; }
  else if (thr < 0.55) { act = 'throw'; const t = thr / 0.55; gx = -0.6 * Math.sin(t * Math.PI); lean = 0.25 * Math.sin(t * Math.PI); }
  const ready = act ? 0 : 1, lowReady = b.state === 'patrol' && !b.visible && sp > 0.5 ? 0.35 : 0;   // 巡邏時槍口稍微朝下
  B[HB.spine].rotation.set(-aim * 0.35 - lean * 0.6 + H.sp.x * 0.5 + run * 0.08 * ready - back * mv * 0.06 + ldx * 0.3, -sw * 0.18 * fwdK - 0.12 + H.sy.x * 0.4 - hipY * 0.6, H.sr.x * 0.3 - la * 0.32);
  B[HB.chest].rotation.set(-aim * 0.55 - lean * 0.4 + H.sp.x * 0.5, -0.22 + H.sy.x * 0.5 - hipY * 0.4, H.sr.x * 0.3 - la * 0.22);
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
