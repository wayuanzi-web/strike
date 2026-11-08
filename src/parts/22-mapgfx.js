/* ===== 22-mapgfx：地圖的樣子——程式畫的寫實貼圖、烘焙陰影與環境光遮蔽、邊角磨損、裝飾與遠景 =====
   碰撞只看 BOXES；這裡加的裝飾（DECOR）只畫不擋。太陽與地圖都不會動，所以陰影在載入時算一次存在頂點上。 */
const SUN_DIR = new V3(0.82, 0.22, 0.28).normalize();
// 每種方塊用哪個材質，和它的底色（貼圖是灰階，顏色靠頂點色）
const MAT_OF = { floor: 'floor', outer: 'concrete', pillar: 'concrete', low: 'concrete', dock: 'concrete', lintel: 'concrete', trim: 'concrete',
  wall: 'brick', rust: 'container', teal: 'container', olive: 'container', crate: 'wood', shed: 'metal', dark: 'metal', paint: 'floor', hazard: 'floor' };
const TINT = {
  floor: '#9a958c', outer: '#9b968d', pillar: '#a29d93', low: '#aca598', dock: '#a19b90', lintel: '#8f897f', trim: '#b4ada1',
  wall: '#a46a55', rust: '#b8552f', teal: '#2e7f88', olive: '#7f823c', crate: '#c3935a', shed: '#8a959a', dark: '#4a4d52', paint: '#e0b43a', hazard: '#262626',
};
const DECOR = [];
function D(x0, z0, x1, z1, y0, y1, c) { DECOR.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], c }); }

(function buildDecor() {
  for (const b of BOXES) {
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    if (b.c === 'rust' || b.c === 'teal' || b.c === 'olive') {
      // 貨櫃：角件、長邊浪板凸條、短邊門鎖桿
      const s = 0.17, e = 0.015;
      for (const cx of [[x0 - e, x0 - e + s], [x1 + e - s, x1 + e]]) for (const cz of [[z0 - e, z0 - e + s], [z1 + e - s, z1 + e]]) for (const cy of [[y0, y0 + s], [y1 - s, y1 + e]])
        D(cx[0], cz[0], cx[1], cz[1], cy[0], cy[1], 'dark');
      const alongX = x1 - x0 > z1 - z0, L0 = alongX ? x0 : z0, L1 = alongX ? x1 : z1;
      for (let t = L0 + 0.35; t < L1 - 0.3; t += 0.3) {
        if (alongX) { D(t, z0 - 0.035, t + 0.1, z0, y0 + 0.12, y1 - 0.12, b.c); D(t, z1, t + 0.1, z1 + 0.035, y0 + 0.12, y1 - 0.12, b.c); }
        else { D(x0 - 0.035, t, x0, t + 0.1, y0 + 0.12, y1 - 0.12, b.c); D(x1, t, x1 + 0.035, t + 0.1, y0 + 0.12, y1 - 0.12, b.c); }
      }
      for (let k = 0; k < 4; k++) {
        const t = (alongX ? z0 : x0) + (k + 0.5) * ((alongX ? z1 - z0 : x1 - x0) / 4);
        if (alongX) D(x1, t - 0.02, x1 + 0.045, t + 0.02, y0 + 0.1, y1 - 0.1, 'dark'); else D(t - 0.02, z1, t + 0.02, z1 + 0.045, y0 + 0.1, y1 - 0.1, 'dark');
      }
    } else if (b.c === 'wall') {
      // 倉庫牆頂壓條
      const thinX = x1 - x0 < z1 - z0;
      if (thinX) D(x0 - 0.06, z0, x1 + 0.06, z1, y1, y1 + 0.08, 'trim'); else D(x0, z0 - 0.06, x1, z1 + 0.06, y1, y1 + 0.08, 'trim');
    } else if (b.c === 'outer') {
      // 外牆內側：壁柱每 6 公尺一根、牆頂壓條
      if (z0 >= 26) { for (let x = -33; x <= 33; x += 6) D(x - 0.2, 25.9, x + 0.2, 26, 0, 5, 'outer'); D(-36, 25.85, 36, 26, 5, 5.1, 'trim'); }
      if (z1 <= -26) { for (let x = -33; x <= 33; x += 6) D(x - 0.2, -26, x + 0.2, -25.9, 0, 5, 'outer'); D(-36, -26, 36, -25.85, 5, 5.1, 'trim'); }
      if (x0 >= 36) { for (let z = -21; z <= 21; z += 6) D(35.9, z - 0.2, 36, z + 0.2, 0, 5, 'outer'); D(35.85, -26, 36, 26, 5, 5.1, 'trim'); }
      if (x1 <= -36) { for (let z = -21; z <= 21; z += 6) D(-36, z - 0.2, -35.9, z + 0.2, 0, 5, 'outer'); D(-36, -26, -35.85, 26, 5, 5.1, 'trim'); }
    }
  }
  // 北牆上的兩條管線
  D(-36, 25.72, 36, 25.86, 3.5, 3.64, 'dark'); D(-36, 25.74, 36, 25.86, 3.85, 3.95, 'dark');
  // 地上的黃色標線：倉庫四周、貨櫃場的停放格
  const P = 0.008, w = 0.06;
  D(-10.5, 8 - w, 10.5, 8 + w, 0, P, 'paint'); D(-10.5, -8 - w, 10.5, -8 + w, 0, P, 'paint');
  D(-10.5 - w, -8, -10.5 + w, 8, 0, P, 'paint'); D(10.5 - w, -8, 10.5 + w, 8, 0, P, 'paint');
  for (let x = -26; x <= 26; x += 4) D(x - w, 23, x + w, 25.5, 0, P, 'paint');
  D(-26, 23 - w, 26, 23 + w, 0, P, 'paint');
  for (let x = -34; x <= 34; x += 3) D(x, -0.05, x + 1.5, 0.05, 0, P, 'paint');    // 中線虛線
  // 卸貨平台北緣的黃黑警示條
  for (let x = 12, k = 0; x < 24; x += 0.4, k++) D(x, -19.012, Math.min(24, x + 0.4), -19, 2.12, 2.4, k % 2 ? 'hazard' : 'paint');
})();

// ---------- 程式畫的貼圖（可無縫重複） ----------
function tileNoise(size, cells, seed) {
  const r = (i, j) => { i = ((i % cells) + cells) % cells; j = ((j % cells) + cells) % cells; let h = (i * 374761393 + j * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * cells, fy = y / size * cells, i = Math.floor(fx), j = Math.floor(fy);
    let u = fx - i, v = fy - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    out[y * size + x] = (r(i, j) * (1 - u) + r(i + 1, j) * u) * (1 - v) + (r(i, j + 1) * (1 - u) + r(i + 1, j + 1) * u) * v;
  }
  return out;
}
function fbm(size, seed, base = 4, oct = 5) {
  const o = new Float32Array(size * size); let a = 0.5, t = 0;
  for (let k = 0; k < oct; k++) { const n = tileNoise(size, base << k, seed + k); for (let i = 0; i < o.length; i++) o[i] += n[i] * a; t += a; a *= 0.5; }
  for (let i = 0; i < o.length; i++) o[i] /= t;
  return o;
}
function hash1(i) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// fn(x, y, i) 回傳 [r,g,b] 0..1
function makeTex(w, h, fn, aniso) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'), img = c.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = fn(x, y, i);
    d[i * 4] = clamp(v[0], 0, 1) * 255; d[i * 4 + 1] = clamp(v[1], 0, 1) * 255; d[i * 4 + 2] = clamp(v[2], 0, 1) * 255; d[i * 4 + 3] = v.length > 3 ? v[3] * 255 : 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
const g3 = (v) => [v, v, v];
function buildTextures(aniso) {
  const T = {};
  // 混凝土（4 公尺一張）：明暗起伏、小斑點、水漬、模板螺栓孔、2 公尺一道施工縫
  { const S = 512, n = fbm(S, 11), st = fbm(S, 23, 2, 3);
    T.concrete = makeTex(S, S, (x, y, i) => {
      let v = 0.86 + (n[i] - 0.5) * 0.3;
      if (st[i] > 0.6) v -= (st[i] - 0.6) * 0.5;
      if (hash1(i * 7 + 3) < 0.035) v -= 0.12;
      const hx = (x % 128) - 64, hy = (y % 128) - 64; if (hx * hx + hy * hy < 14) v -= 0.3;
      if (y % 256 < 3) v -= 0.12;
      return g3(v);
    }, aniso); }
  // 磚牆（2 公尺一張）：每塊磚色差、灰縫、半塊錯開
  { const S = 256, n = fbm(S, 31, 8, 4), rows = 24, bw = 32;
    T.brick = makeTex(S, S, (x, y, i) => {
      const r = Math.floor(y / (S / rows)), yy = y - r * (S / rows), off = (r % 2) * bw / 2, bx = Math.floor((x + off) / bw), xx = (x + off) % bw;
      const mortar = yy < 2 || xx < 2;
      const k = hash1(r * 131 + ((bx % (S / bw)) + S / bw) % (S / bw));
      let v = mortar ? 0.62 + n[i] * 0.1 : 0.9 + (k - 0.5) * 0.2 + (n[i] - 0.5) * 0.18;
      if (!mortar && (yy < 3 || xx < 3)) v -= 0.06;
      return mortar ? [v * 1.05, v * 1.0, v * 0.95] : g3(v);
    }, aniso); }
  // 地面（4 公尺一張）：淡淡的起伏、2 公尺伸縮縫、油漬
  { const S = 512, n = fbm(S, 41, 4, 5), oil = fbm(S, 53, 2, 3), spot = fbm(S, 59, 8, 3);
    T.floor = makeTex(S, S, (x, y, i) => {
      let v = 0.88 + (n[i] - 0.5) * 0.22;
      if (oil[i] > 0.7) v -= (oil[i] - 0.7) * 0.45;
      if (spot[i] > 0.68) v -= (spot[i] - 0.68) * 0.6;
      if (x % 256 < 2 || y % 256 < 2) v -= 0.16;
      if (hash1(i * 13 + 5) < 0.02) v -= 0.08;
      return g3(v);
    }, aniso); }
  // 貨櫃浪板（橫向 2.4 公尺、縱向 2.6 公尺）：凹凸明暗、從上往下的鏽痕、掉漆
  { const W2 = 256, H2 = 256, n = fbm(W2, 61, 4, 4), streak = tileNoise(W2, 32, 71), chip = fbm(W2, 83, 4, 4);
    T.container = makeTex(W2, H2, (x, y, i) => {
      const rib = 0.5 + 0.5 * Math.sin(x / W2 * 8 * Math.PI * 2);
      let v = 0.8 + (rib - 0.5) * 0.36 + (n[i] - 0.5) * 0.14;
      const s = streak[Math.floor(y / 6) * W2 + x] * (1 - y / H2);
      let rgb = g3(v);
      if (s > 0.55) { const k = (s - 0.55) * 1.6; rgb = [v * (1 - k * 0.2), v * (1 - k * 0.45), v * (1 - k * 0.6)]; }
      if (chip[i] > 0.66) rgb.push(0);   // 第 4 個值當透明度：0＝掉漆露出底漆
      return rgb;
    }, aniso); }
  // 木箱（每個面剛好一張）：外框、斜撐、木紋、木板縫
  { const S = 256, n = fbm(S, 91, 4, 4), grain = tileNoise(S, 32, 97);
    T.wood = makeTex(S, S, (x, y, i) => {
      const fr = 30, inFrame = x < fr || x > S - fr || y < fr || y > S - fr;
      const dx = x - y, brace = Math.abs(dx) < 18 && !inFrame;
      const plank = Math.floor(y / (S / 5)), pv = hash1(plank * 17 + (inFrame ? 3 : 0) + (brace ? 9 : 0));
      let v = 0.78 + (pv - 0.5) * 0.2 + (grain[(y % S) * S + Math.floor(x / 8)] - 0.5) * 0.18 + (n[i] - 0.5) * 0.1;
      if (!inFrame && !brace && y % (S / 5) < 2) v -= 0.3;
      if (inFrame || brace) v += 0.06;
      if ((inFrame && (Math.abs(x - fr) < 2 || Math.abs(x - (S - fr)) < 2 || Math.abs(y - fr) < 2 || Math.abs(y - (S - fr)) < 2)) || (brace && Math.abs(Math.abs(dx) - 18) < 2)) v -= 0.25;
      const nail = ((x - 15) ** 2 + (y - 15) ** 2 < 6) || ((x - S + 15) ** 2 + (y - 15) ** 2 < 6) || ((x - 15) ** 2 + (y - S + 15) ** 2 < 6) || ((x - S + 15) ** 2 + (y - S + 15) ** 2 < 6);
      if (nail) v = 0.35;
      return [v * 1.0, v * 0.97, v * 0.92];
    }, aniso); }
  // 鐵皮（棚、深色金屬）：細浪板＋髒污
  { const S = 256, n = fbm(S, 101, 4, 5);
    T.metal = makeTex(S, S, (x, y, i) => {
      const rib = 0.5 + 0.5 * Math.sin(x / S * 16 * Math.PI * 2);
      const v = 0.8 + (rib - 0.5) * 0.22 + (n[i] - 0.5) * 0.26 - (y / S) * 0.06;
      return g3(v);
    }, aniso); }
  return T;
}

// ---------- 烘焙：每個頂點的日照（看不看得到太陽）與環境光遮蔽 ----------
const BAKE = { cell: 4, x0: -38, z0: -28, nx: 19, nz: 14, cells: null, stamp: null, sid: 0 };
function bakeIndex() {
  BAKE.cells = Array.from({ length: BAKE.nx * BAKE.nz }, () => []);
  BAKE.stamp = new Int32Array(BOXES.length);
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    const i0 = clamp(Math.floor((b.min[0] - BAKE.x0) / BAKE.cell), 0, BAKE.nx - 1), i1 = clamp(Math.floor((b.max[0] - BAKE.x0) / BAKE.cell), 0, BAKE.nx - 1);
    const j0 = clamp(Math.floor((b.min[2] - BAKE.z0) / BAKE.cell), 0, BAKE.nz - 1), j1 = clamp(Math.floor((b.max[2] - BAKE.z0) / BAKE.cell), 0, BAKE.nz - 1);
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) BAKE.cells[j * BAKE.nx + k].push(i);
  }
}
// 射線在 len 內有沒有打到方塊；打到回傳距離，沒打到回傳 -1
function bakeRay(ox, oy, oz, dx, dy, dz, len) {
  const ex = ox + dx * len, ez = oz + dz * len;
  const i0 = clamp(Math.floor((Math.min(ox, ex) - BAKE.x0) / BAKE.cell), 0, BAKE.nx - 1), i1 = clamp(Math.floor((Math.max(ox, ex) - BAKE.x0) / BAKE.cell), 0, BAKE.nx - 1);
  const j0 = clamp(Math.floor((Math.min(oz, ez) - BAKE.z0) / BAKE.cell), 0, BAKE.nz - 1), j1 = clamp(Math.floor((Math.max(oz, ez) - BAKE.z0) / BAKE.cell), 0, BAKE.nz - 1);
  const sid = ++BAKE.sid; let best = -1;
  for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
    for (const bi of BAKE.cells[j * BAKE.nx + k]) {
      if (BAKE.stamp[bi] === sid) continue; BAKE.stamp[bi] = sid;
      const b = BOXES[bi];
      if (rayAABB(ox, oy, oz, dx, dy, dz, b.min, b.max, best < 0 ? len : best)) best = RAY_HIT.t;
    }
  }
  return best;
}
// 半球取樣方向（相對面的切線空間）：一圈低角度＋一圈高角度
const AO_DIRS = (function () {
  const out = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, el = 0.42; out.push([Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), Math.sin(el), 1]); }
  for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * Math.PI * 2, el = 1.05; out.push([Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), Math.sin(el), 0.8]); }
  return out;
})();
const SUN_JIT = [[0, 0], [0.018, 0.01], [-0.015, 0.014], [0.006, -0.018]];
function bakeVertex(px, py, pz, n, tu, tv) {
  const ox = px + n[0] * 0.025, oy = py + n[1] * 0.025, oz = pz + n[2] * 0.025;
  // 日照：朝太陽打 4 條略微錯開的射線，算出柔和的影子邊
  let sun = 0;
  const nd = n[0] * SUN_DIR.x + n[1] * SUN_DIR.y + n[2] * SUN_DIR.z;
  if (nd > 0.01) {
    const len = Math.min(70, Math.max(1, (7 - oy) / SUN_DIR.y));
    for (const j of SUN_JIT) {
      let dx = SUN_DIR.x + j[0] * SUN_DIR.z, dy = SUN_DIR.y + j[1], dz = SUN_DIR.z - j[0] * SUN_DIR.x;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      if (bakeRay(ox, oy, oz, dx, dy, dz, len) < 0) sun += 1 / SUN_JIT.length;
    }
  }
  // 環境光遮蔽：附近 1.4 公尺內被擋住越多越暗
  let occ = 0, tot = 0;
  for (const d of AO_DIRS) {
    const dx = tu[0] * d[0] + tv[0] * d[1] + n[0] * d[2], dy = tu[1] * d[0] + tv[1] * d[1] + n[1] * d[2], dz = tu[2] * d[0] + tv[2] * d[1] + n[2] * d[2];
    const t = bakeRay(ox, oy, oz, dx, dy, dz, 1.4);
    if (t >= 0) occ += d[3] * (1 - t / 1.4) * (1 - t / 1.4) + d[3] * 0.25;
    tot += d[3] * 1.25;
  }
  return [sun, clamp(1 - occ / tot * 1.5, 0.15, 1)];
}

// ---------- 建地圖網格：依材質分組，每組一次繪製 ----------
const MAP_UNI = { uFlash: { value: new THREE.Vector4(0, 0, 0, 0) } };
function patchMapMaterial(mat, wear, grime, chip = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = MAP_UNI.uFlash;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLight; attribute vec3 aLocal; attribute vec3 aSize;\nvarying vec2 vLight; varying vec3 vWp; varying vec3 vN0; varying vec3 vLoc; varying vec3 vSz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLight = aLight; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vN0 = normal; vLoc = aLocal; vSz = aSize;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uFlash;\nvarying vec2 vLight; varying vec3 vWp; varying vec3 vN0; varying vec3 vLoc; varying vec3 vSz;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 an = abs(vN0);
        vec3 d3 = min(vLoc, vSz - vLoc); d3 = mix(d3, vec3(99.0), step(0.5, an));
        float e = min(d3.x, min(d3.y, d3.z));
        float nz = texture2D(map, vWp.xz * 0.37 + vWp.y * 0.21).r;
        float wear = 1.0 - smoothstep(0.012, 0.045 + nz * 0.07, e);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.32 + 0.035, wear * ${wear.toFixed(2)});
        diffuseColor.rgb *= 0.9 + 0.2 * texture2D(map, vMapUv * 6.0).r;
        ${chip ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.27, 0.18) * sampledDiffuseColor.r, (1.0 - sampledDiffuseColor.a) * 0.9); diffuseColor.a = 1.0;' : ''}
        float grime = 1.0 - smoothstep(0.0, 0.55 + nz * 0.5, vWp.y);
        diffuseColor.rgb *= 1.0 - grime * ${grime.toFixed(2)} * step(an.y, 0.5);
      }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= vLight.x;
        reflectedLight.indirectDiffuse *= mix(0.42, 1.0, vLight.y);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.08, 0.05, 0.03) * (1.0 - smoothstep(0.0, 2.0, vWp.y));
        { float fd = distance(vWp, uFlash.xyz);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.7, 0.4) * uFlash.w * 2.2 / (1.0 + fd * fd * 0.5); }`);
  };
  mat.customProgramCacheKey = () => 'map' + wear + '_' + grime + (chip ? 'c' : '');
}
function buildMapMeshes(aniso) {
  const t0 = performance.now();
  const tex = buildTextures(aniso);
  const t1 = performance.now();
  bakeIndex();
  const groups = {};
  const G = (m) => groups[m] || (groups[m] = { P: [], N: [], C: [], U: [], L: [], O: [], Z: [], I: [] });
  const col = new THREE.Color();
  const BOUND = { x0: -37, x1: 37, z0: -27, z1: 27 };
  // 一個面：axis 法線軸（0/1/2）、sign 正負、u/v 兩個面內軸
  const FACES = [[0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1]];
  const all = BOXES.map((b) => ({ b, decor: false })).concat(DECOR.map((b) => ({ b, decor: true })));
  for (const { b, decor } of all) {
    const mat = MAT_OF[b.c] || 'concrete', g = G(mat);
    const base = new THREE.Color(TINT[b.c] || '#999999'), tint = 1 + (hash1(Math.round(b.min[0] * 7 + b.min[2] * 13 + b.max[1] * 17)) - 0.5) * 0.08;
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    for (const [ax, sg, ua, va] of FACES) {
      // 地圖外側看不到的面不畫
      if (ax === 0 && sg > 0 && b.max[0] >= BOUND.x1 - 0.001) continue;
      if (ax === 0 && sg < 0 && b.min[0] <= BOUND.x0 + 0.001) continue;
      if (ax === 2 && sg > 0 && b.max[2] >= BOUND.z1 - 0.001) continue;
      if (ax === 2 && sg < 0 && b.min[2] <= BOUND.z0 + 0.001) continue;
      if (b.c === 'floor' && ax !== 1) continue;
      const plane = sg > 0 ? b.max[ax] : b.min[ax];
      const lu = size[ua], lv = size[va];
      const cell = decor ? 99 : b.c === 'floor' ? 0.5 : ax === 1 ? 1.0 : 0.5;
      const nu = Math.max(1, Math.ceil(lu / cell)), nv = Math.max(1, Math.ceil(lv / cell));
      const n = [0, 0, 0]; n[ax] = sg;
      const tu = [0, 0, 0]; tu[ua] = 1; const tv = [0, 0, 0]; tv[va] = 1;
      const start = g.P.length / 3;
      let faceL = null;
      if (decor) { const c = [0, 0, 0]; c[ax] = plane; c[ua] = b.min[ua] + lu / 2; c[va] = b.min[va] + lv / 2; faceL = bakeVertex(c[0], c[1], c[2], n, tu, tv); }
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const p = [0, 0, 0]; p[ax] = plane; p[ua] = b.min[ua] + lu * i / nu; p[va] = b.min[va] + lv * j / nv;
        g.P.push(p[0], p[1], p[2]); g.N.push(n[0], n[1], n[2]);
        col.copy(base).multiplyScalar(tint); g.C.push(col.r, col.g, col.b);
        // UV：木箱用方塊自己的座標（每面一張），其它用世界座標
        let u, v;
        if (mat === 'wood') { u = (p[ua] - b.min[ua]) / lu; v = (p[va] - b.min[va]) / lv; }
        else {
          const scale = mat === 'brick' ? 0.5 : mat === 'container' ? (ax === 1 ? 1 / 2.4 : 1 / 2.4) : mat === 'metal' ? 0.5 : 0.25;
          const hu = ax === 0 ? p[2] : p[0], hv = ax === 1 ? p[2] : p[1];
          u = hu * scale * (ax === 0 && sg > 0 || ax === 2 && sg < 0 ? -1 : 1); v = mat === 'container' && ax !== 1 ? (p[1] - b.min[1]) / 2.6 : hv * scale;
        }
        g.U.push(u, v);
        g.L.push(...(faceL || bakeVertex(p[0], p[1], p[2], n, tu, tv)));
        g.O.push(p[0] - b.min[0], p[1] - b.min[1], p[2] - b.min[2]); g.Z.push(size[0], size[1], size[2]);
      }
      // 三角形要朝外（逆時針）：依法線方向決定繞向
      const cr = [tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]];
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = start + j * (nu + 1) + i, bb = a + 1, c = a + nu + 1, d = c + 1;
        if (!flip) g.I.push(a, bb, d, a, d, c); else g.I.push(a, d, bb, a, c, d);
      }
    }
  }
  const SETTINGS = { concrete: [0.5, 0.25], brick: [0.35, 0.3], floor: [0.0, 0.0], container: [0.9, 0.2], wood: [0.7, 0.2], metal: [0.6, 0.25] };
  const meshes = [];
  for (const [m, g] of Object.entries(groups)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.C, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.U, 2));
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(g.L, 2));
    geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(g.O, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(g.Z, 3));
    geo.setIndex(g.I); geo.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex[m] });
    const st = SETTINGS[m] || [0.5, 0.2]; patchMapMaterial(mat, st[0], st[1], m === 'container');
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'map-' + m; mesh.matrixAutoUpdate = false;
    meshes.push(mesh);
  }
  window.__mapTiming = { textures: Math.round(t1 - t0), bake: Math.round(performance.now() - t1) };
  return meshes;
}
// 驗證三角形繞向用：每個面的法線是否跟幾何算出來的一致（測試頁呼叫）
function checkWinding(mesh) {
  const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal, idx = mesh.geometry.index.array; let bad = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = new V3().fromBufferAttribute(pos, idx[t]), b = new V3().fromBufferAttribute(pos, idx[t + 1]), c = new V3().fromBufferAttribute(pos, idx[t + 2]);
    const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)); const nn = new V3().fromBufferAttribute(nor, idx[t]);
    if (n.dot(nn) < 0) bad++;
  }
  return bad;
}

// ---------- 遠景：牆外的倉庫、龍門吊、煙囪剪影，不再像關在盒子裡 ----------
function buildSkyline() {
  const P = [], C = [], I = []; const c = new THREE.Color(), top = new THREE.Color('#a7a2ad'), bot = new THREE.Color('#6b6772');
  const box = (x0, z0, x1, z1, h, y0 = 0) => {
    const s = P.length / 3;
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]];
    for (const p of v) { P.push(...p); c.copy(bot).lerp(top, clamp((p[1] - y0) / 30, 0, 1)); C.push(c.r, c.g, c.b); }
    for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]) I.push(s + f[0], s + f[2], s + f[1], s + f[0], s + f[3], s + f[2]);
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 46; k++) {
    const a = k / 46 * Math.PI * 2 + rnd() * 0.08, r = 70 + rnd() * 70, x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r;
    const w = 8 + rnd() * 18, d = 8 + rnd() * 14, h = 7 + rnd() * 20;
    box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h);
    if (rnd() < 0.25) box(x - 1, z - 1, x + 1, z + 1, h + 14 + rnd() * 16);     // 煙囪
  }
  // 兩座龍門吊
  for (const [x, z] of [[-60, 70], [75, -66]]) { box(x - 9, z - 1, x - 7.5, z + 1, 32); box(x + 7.5, z - 1, x + 9, z + 1, 32); box(x - 12, z - 1.2, x + 22, z + 1.2, 34, 30); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// 天空：反面的大球，頂點顏色畫破曉漸層；太陽一張發光的圓（不受色調映射影響，照原色）
function buildSky() {
  const g = new THREE.SphereGeometry(400, 48, 24);
  const pos = g.attributes.position, cols = [];
  const zen = new THREE.Color('#3f6fa6'), mid = new THREE.Color('#a9bad6'), hor = new THREE.Color('#ffc79a'), low = new THREE.Color('#6b6168');
  const warm = new THREE.Color('#ffdba8'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400, x = pos.getX(i) / 400, z = pos.getZ(i) / 400;
    const sun = Math.max(0, x * SUN_DIR.x + z * SUN_DIR.z);
    if (y > 0.35) c.copy(mid).lerp(zen, (y - 0.35) / 0.65);
    else if (y > 0) c.copy(hor).lerp(mid, y / 0.35);
    else c.copy(hor).lerp(low, Math.min(1, -y * 6));
    if (y > -0.05 && y < 0.5) c.lerp(warm, sun * sun * (1 - Math.abs(y) * 2) * 0.6);
    // 幾道淡淡的卷雲（高度 0.08–0.3 之間的條紋）
    if (y > 0.06 && y < 0.32) { const band = Math.sin(Math.atan2(z, x) * 7 + y * 30) * 0.5 + 0.5; c.lerp(warm, band * band * 0.12 * (1 - Math.abs(y - 0.18) / 0.14)); }
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  sky.renderOrder = -1;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.16, 'rgba(255,236,190,.95)'); gr.addColorStop(0.4, 'rgba(255,190,120,.3)'); gr.addColorStop(1, 'rgba(255,160,90,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sunS.position.copy(SUN_DIR).multiplyScalar(380); sunS.scale.set(80, 80, 1);
  sky.add(sunS);
  return sky;
}
