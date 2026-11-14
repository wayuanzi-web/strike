/* ===== 23-lights：M15 光影
   - 動態光：同時 4 盞（槍口火光、手榴彈、燃燒彈、炸彈），照亮地圖、人物和你手上的槍；最弱的那盞先被換掉，同一個位置疊在一起。
   - 反光：貨櫃、金屬照得到太陽的高光，並反射天空（越斜看越亮，菲涅耳）；舊城的窗戶改成玻璃，會映出天空和太陽。
   - 夜間路燈：每盞燈的光和影子在載入時烘進光照貼圖（藍、透明兩個通道：暖色鈉燈、冷白 LED），不多花即時運算；
     人物用腳下光照貼圖的值決定被路燈照得多亮，所以站在暗處真的比較暗。 */
const FL_N = 4;
const LIGHT_U = {
  uFl: { value: Array.from({ length: FL_N }, () => new THREE.Vector4(0, -99, 0, 0)) },
  uLampW: { value: new THREE.Color(0, 0, 0) }, uLampC: { value: new THREE.Color(0, 0, 0) },
  uSunD: { value: new V3(0, 1, 0) }, uSunC: { value: new THREE.Color(1, 1, 1) },
  uSkyT: { value: new THREE.Color() }, uSkyH: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
};
const FL_GLSL = `uniform vec4 uFl[${FL_N}];
vec3 flashLight(vec3 wp) { vec3 s = vec3(0.0); for (int i = 0; i < ${FL_N}; i++) { vec3 dv = wp - uFl[i].xyz; s += vec3(uFl[i].w / (1.0 + dot(dv, dv) * 0.5)); } return s * vec3(1.0, 0.7, 0.4); }`;
// 新的一盞：同一個位置（0.7 公尺內）已經有就疊上去，否則換掉最弱的
function muzzleLight(p, strength) {
  const a = LIGHT_U.uFl.value;
  for (const v of a) if (v.w > 0.05 && (v.x - p.x) ** 2 + (v.y - p.y) ** 2 + (v.z - p.z) ** 2 < 0.5) { if (strength > v.w) v.set(p.x, p.y, p.z, strength); return; }
  let k = 0; for (let i = 1; i < FL_N; i++) if (a[i].w < a[k].w) k = i;
  if (strength >= a[k].w * 0.8) a[k].set(p.x, p.y, p.z, strength);
}
function updateMuzzleLight(dt) { const f = Math.exp(-dt * 40); for (const v of LIGHT_U.uFl.value) v.w *= f; }
// 某一點被動態光照多亮（手上的槍、夜間的「暗處看不到」用）；回傳強度，dir 填最亮那盞的方向
function flashAt(x, y, z, dir) {
  let s = 0, best = 0;
  for (const v of LIGHT_U.uFl.value) { if (v.w < 0.02) continue; const d2 = (v.x - x) ** 2 + (v.y - y) ** 2 + (v.z - z) ** 2, c = v.w / (1 + d2 * 0.5); s += c; if (dir && c > best) { best = c; dir.set(v.x - x, v.y - y, v.z - z); } }
  return s;
}

// ---------- 反光：每種材質的 [反射天空、太陽高光、亮點大小] ----------
const SPEC = { container: [0.1, 0.35, 40], metal: [0.22, 0.6, 70], glass: [0.85, 1.6, 260] };
function specGlsl(m) {
  const s = SPEC[m]; if (!s) return '';
  return `{
    vec3 Vv = normalize(cameraPosition - vWp), Nn = normalize(vN0), R = reflect(-Vv, Nn);
    float fr = pow(1.0 - max(dot(Nn, Vv), 0.0), 5.0);
    vec3 env = R.y > 0.0 ? mix(uSkyH, uSkyT, smoothstep(0.0, 0.6, R.y)) : mix(uSkyH, uGnd, smoothstep(0.0, 0.25, -R.y));
    float sp = pow(max(dot(R, uSunD), 0.0), ${s[2].toFixed(1)}) * ${s[1].toFixed(2)} * L.x;
    reflectedLight.directDiffuse += uSunC * sp;
    reflectedLight.indirectDiffuse += (env * mix(0.35, 1.0, L.y) + (uLampW * L.z + uLampC * L.w) * 0.6) * ${s[0].toFixed(2)} * (0.25 + 0.75 * fr);
  }`;
}
// 換地圖時更新：太陽方向顏色、天空顏色（反射用）、路燈顏色
function applyLightTheme() {
  const t = MAP.theme, sk = t.sky;
  LIGHT_U.uSunD.value.copy(SUN_DIR); LIGHT_U.uSunC.value.set(t.sunColor).multiplyScalar(t.sunI * 0.5);
  LIGHT_U.uSkyT.value.set(sk.zen).lerp(new THREE.Color(sk.mid), 0.5); LIGHT_U.uSkyH.value.set(sk.hor); LIGHT_U.uGnd.value.set(t.hemi[1]).multiplyScalar(0.45);
  LIGHT_U.uLampW.value.set(t.lampW || '#000000'); LIGHT_U.uLampC.value.set(t.lampC || '#000000');
}

// ---------- 夜間路燈（烘焙） ----------
// MAP.lamps：[x, z, 高度, 'w' 暖／'c' 冷, 強度]；燈罩畫成裝飾，光暈用一組 Points
const LAMP_R = 17;
const lampList = () => MAP.lamps || [];
// 一個點被路燈照到的量：[暖, 冷]，有影子（射線被擋就不算）
function lampAt(ox, oy, oz, n, near) {
  let w = 0, c = 0;
  for (const L of near) {
    const dx = L[0] - ox, dy = L[2] - oy, dz = L[1] - oz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > LAMP_R * LAMP_R) continue;
    const d = Math.sqrt(d2), nd = n ? (n[0] * dx + n[1] * dy + n[2] * dz) / d : 0.7;
    if (nd <= 0.02) continue;
    const fall = (1 - d2 / (LAMP_R * LAMP_R)) ** 2, I = (L[4] || 1) * 1.6 * nd * fall / (1 + d2 / 16);
    if (I < 0.01) continue;
    if (bakeRay(ox, oy, oz, dx / d, dy / d, dz / d, d - 0.35) >= 0) continue;   // 被擋住：影子
    if (L[3] === 'c') c += I; else w += I;
  }
  return [w, c];
}
// 這個面附近（燈照得到、燈在面的前方）的燈
function lampsNearFace(b, n, plane, ax) {
  const out = [];
  for (const L of lampList()) {
    const p = [L[0], L[2], L[1]];
    if ((p[ax] - plane) * n[ax] <= 0.01) continue;
    let d2 = 0; for (let k = 0; k < 3; k++) { const v = clamp(p[k], b.min[k], b.max[k]) - p[k]; d2 += v * v; }
    if (d2 < LAMP_R * LAMP_R) out.push(L);
  }
  return out;
}
// 地上某一點的光（從光照貼圖的地板那一塊讀）：sun 0–1、warm／cool（路燈，可以超過 1）
const _lit = { sun: 1, warm: 0, cool: 0 };
function lightAt(x, z) {
  const F = LM.floor, D = LM.data; _lit.sun = 1; _lit.warm = 0; _lit.cool = 0;
  if (!F || !D) return _lit;
  const i = clamp(Math.floor((x - F.x0) / F.lu * F.tw), 0, F.tw - 1), j = clamp(Math.floor((z - F.z0) / F.lv * F.th), 0, F.th - 1);
  const o = ((F.ay0 + 1 + j) * LM.size[0] + (F.ax0 + 1 + i)) * 4;
  _lit.sun = D[o] / 255; _lit.warm = D[o + 2] / 127.5; _lit.cool = D[o + 3] / 127.5;
  return _lit;
}
// 人物被路燈照的顏色（每個人的材質一個值，0.2 秒更新一次）
const _lc = new THREE.Color();
function lampColorAt(x, z, out) {
  const L = lightAt(x, z);
  return out.copy(LIGHT_U.uLampW.value).multiplyScalar(L.warm * 0.9).add(_lc.copy(LIGHT_U.uLampC.value).multiplyScalar(L.cool * 0.9));
}
// 夜裡一個單位有多亮（0–1）：月光（照得到的地方）＋路燈＋附近的槍口火光
function unitLit(u) {
  if (!MAP.theme.night) return 1;
  const p = u.body.pos, L = lightAt(p.x, p.z);
  return clamp(L.sun * 0.12 + (L.warm + L.cool) * 0.75 + flashAt(p.x, p.y + 1, p.z) * 0.4, 0, 1);
}
// 夜裡看得到多遠：全黑約 16 公尺、亮處不限；剛開槍的人槍口火光會暴露位置
function nightSeeDist(u) {
  const fired = u === player ? player.firedAt : u.firedAt;
  if (fired !== undefined && game.t - fired < 1.2) return 999;
  if ((u.nightT || 0) > game.t) return u.nightD;
  u.nightT = game.t + 0.25; u.nightD = 16 + 60 * unitLit(u) ** 1.3;
  return u.nightD;
}
// 燈的樣子：牆上的小燈罩＋支架（裝飾），光暈是一組加法混色的點
let lampGlow = null;
function lampDecor(D) {
  for (const L of lampList()) {
    const [x, z, h, k] = L;
    D(x - 0.16, z - 0.16, x + 0.16, z + 0.16, h + 0.06, h + 0.16, 'dark');
    D(x - 0.11, z - 0.11, x + 0.11, z + 0.11, h - 0.02, h + 0.06, k === 'c' ? 'lampc' : 'lampw');
  }
}
function buildLampGlow() {
  if (lampGlow) { scene.remove(lampGlow); lampGlow.geometry.dispose(); lampGlow.material.dispose(); lampGlow = null; }
  const ls = lampList(); if (!ls.length) return;
  const P = [], C = [], cw = new THREE.Color(MAP.theme.lampW), cc = new THREE.Color(MAP.theme.lampC);
  for (const L of ls) { P.push(L[0], L[2] - 0.05, L[1]); const c = L[3] === 'c' ? cc : cw; C.push(c.r, c.g, c.b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,.85)'); gr.addColorStop(0.35, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  lampGlow = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  lampGlow.name = 'lampGlow'; scene.add(lampGlow);
}
// 夜空的星星：一組點（1 次繪製）
function addStars(sky) {
  if (!MAP.theme.night) return;
  const P = [], C = []; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 700; i++) {
    const y = 0.08 + Math.pow(rnd(), 0.7) * 0.92, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y), b = 0.45 + rnd() * 0.55;
    P.push(Math.cos(a) * r * 390, y * 390, Math.sin(a) * r * 390); C.push(b, b, b * (0.9 + rnd() * 0.2));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const st = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, toneMapped: false }));
  st.renderOrder = -1; sky.add(st);
}
