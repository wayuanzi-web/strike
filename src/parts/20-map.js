/* ===== 20-map：灰盒地圖「曙光倉區」——全部用方塊拼，原創配置 =====
   座標：x 東西（東為正）、z 南北（北為正… 注意 three.js 的 z 指向畫面外，這裡把 +z 當北）、y 往上，單位公尺。
   中間一座沒屋頂的倉庫（四面有門），北邊貨櫃場，南邊長掩體牆和高起的卸貨平台（西側有樓梯），
   玩家從西邊出生，機器人從東邊出生。 */
const COLORS = {
  floor: '#7c8189', outer: '#6c6862', wall: '#bab3a5', pillar: '#8f8a82', low: '#a7a194', shed: '#8c979c',
  rust: '#a65a3d', teal: '#3d7880', olive: '#7a7a42', crate: '#b3884f', dock: '#9b988e', lintel: '#a49d90',
};
const BOXES = [];   // { min:[x,y,z], max:[x,y,z], c:顏色 }
function B(x0, z0, x1, z1, y0, y1, c) { BOXES.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], c }); }
function crate(x, z, n = 1, s = 0.9) { for (let i = 0; i < n; i++) B(x - s / 2, z - s / 2, x + s / 2, z + s / 2, i * s, (i + 1) * s, 'crate'); }

(function buildLayout() {
  B(-37, -27, 37, 27, -1, 0, 'floor');
  // 外牆
  B(-37, 26, 37, 27, 0, 5, 'outer'); B(-37, -27, 37, -26, 0, 5, 'outer');
  B(-37, -26, -36, 26, 0, 5, 'outer'); B(36, -26, 37, 26, 0, 5, 'outer');

  // 中央倉庫：牆高 4、厚 0.6，四面有門，門上有橫梁
  B(-9, 6.4, -2, 7, 0, 4, 'wall'); B(2, 6.4, 9, 7, 0, 4, 'wall'); B(-2, 6.4, 2, 7, 3, 4, 'lintel');
  B(-9, -7, -4, -6.4, 0, 4, 'wall'); B(0, -7, 9, -6.4, 0, 4, 'wall'); B(-4, -7, 0, -6.4, 3, 4, 'lintel');
  B(-9, -6.4, -8.4, -1.5, 0, 4, 'wall'); B(-9, 1.5, -8.4, 6.4, 0, 4, 'wall'); B(-9, -1.5, -8.4, 1.5, 3, 4, 'lintel');
  B(8.4, -6.4, 9, -3, 0, 4, 'wall'); B(8.4, 0, 9, 6.4, 0, 4, 'wall'); B(8.4, -3, 9, 0, 3, 4, 'lintel');
  B(-0.7, -0.7, 0.7, 0.7, 0, 4, 'pillar');
  crate(-5.05, 2.95, 2); crate(-5.05, 3.85); crate(3.95, -4.05); crate(4.85, -4.05);
  B(2, 2.6, 6, 3.1, 0, 1.1, 'low'); B(-6.5, -4, -4.5, -3.5, 0, 1.1, 'low');

  // 倉庫東西兩側的擋牆（擋住出生點直接對看）
  B(-18, -2.5, -16.5, 2.5, 0, 2.2, 'wall'); B(16.5, -2.5, 18, 2.5, 0, 2.2, 'wall');

  // 北邊貨櫃場
  B(-24, 12, -18, 14.4, 0, 2.6, 'rust');
  B(-12, 18, -6, 20.4, 0, 2.6, 'teal'); B(-11.5, 18, -6.5, 20.4, 2.6, 5.2, 'olive');
  B(4, 11, 6.4, 17, 0, 2.6, 'olive');
  B(15, 14, 21, 16.4, 0, 2.6, 'rust');
  B(26, 8, 28.4, 14, 0, 2.6, 'teal');
  B(-30, 19, -24, 21.4, 0, 2.6, 'teal');
  crate(-15, 9.5); crate(12, 21, 2); crate(12.9, 21); crate(0, 22.5); crate(22, 20); crate(-3, 13); crate(30, 22, 2);

  // 南邊：長掩體牆（三段，中間留兩個缺口）
  B(-22, -14, -12, -13.4, 0, 2.8, 'low'); B(-9, -14, 2, -13.4, 0, 2.8, 'low'); B(5, -14, 10, -13.4, 0, 2.8, 'low');
  // 卸貨平台（高 2.4）、西側七階樓梯、平台北緣的矮欄
  B(12, -26, 24, -19, 0, 2.4, 'dock');
  for (let k = 1; k <= 7; k++) B(12 - 0.5 * k, -24, 12 - 0.5 * (k - 1), -21, 0, 2.4 - 0.3 * k, 'dock');
  B(15, -19.25, 24, -19, 2.4, 3.3, 'low');
  B(20, -23, 21, -22, 2.4, 3.3, 'crate');
  B(-31, -23, -23, -17, 0, 3.5, 'shed');
  crate(-5, -19); crate(-4.1, -19); crate(-18, -20, 2); crate(28, -12, 2); crate(27.1, -12); crate(30, 4);
  B(-17, -8, -16, -7, 0, 3.2, 'pillar'); B(16, -9, 17, -8, 0, 3.2, 'pillar'); B(16, 7, 17, 8, 0, 3.2, 'pillar');

  // 兩邊出生點前的矮牆
  B(-29, 3, -27, 3.6, 0, 1.1, 'low'); B(-29, -3.6, -27, -3, 0, 1.1, 'low'); crate(-24, 0);
  B(27, -3.6, 29, -3, 0, 1.1, 'low'); B(27, 3, 29, 3.6, 0, 1.1, 'low'); crate(24, 0);
})();

const PLAYER_SPAWNS = [[-32, 0], [-32, -8], [-32, 8]];
const BOT_SPAWNS = [[32, 0], [32, -8], [32, 8], [31, 18], [33, -20], [22, 23]];

// ---------- 地圖網格：所有方塊合成一個網格，只花一次繪製 ----------
function gridTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
  c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
  c.strokeStyle = 'rgba(0,0,0,.20)'; c.lineWidth = 3; c.strokeRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 128); c.moveTo(0, 64); c.lineTo(128, 64); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function buildMapMesh() {
  const P = [], N = [], C = [], U = [];
  const col = new THREE.Color();
  const faces = [ // 法向量、四個角（0/1 代表 min/max）、uv 用哪兩軸
    { n: [1, 0, 0], q: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], u: [2, 1], s: 0.86 },
    { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], u: [2, 1], s: 0.78 },
    { n: [0, 1, 0], q: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [0, 2], s: 1.0 },
    { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: [0, 1], s: 0.92 },
    { n: [0, 0, -1], q: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: [0, 1], s: 0.72 },
  ];
  for (const b of BOXES) {
    const base = new THREE.Color(COLORS[b.c]); const tint = 1 + (Math.random() - 0.5) * 0.06;
    for (const f of faces) {
      const idx = P.length / 3;
      for (const q of f.q) {
        const p = [q[0] ? b.max[0] : b.min[0], q[1] ? b.max[1] : b.min[1], q[2] ? b.max[2] : b.min[2]];
        P.push(p[0], p[1], p[2]); N.push(f.n[0], f.n[1], f.n[2]);
        // 牆腳壓暗一點，假裝有環境光遮蔽
        let k = tint * (f.n[1] === 0 && p[1] <= 0.01 ? 0.6 : 1);
        if (f.n[1] === 0 && b.c === 'floor') k = 1;
        col.copy(base).multiplyScalar(k); C.push(col.r, col.g, col.b);
        U.push(p[f.u[0]] * 0.5, p[f.u[1]] * 0.5);
      }
      // 兩個三角形（逆時針朝外）
      IDX.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(IDX);
  g.computeBoundingSphere();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: gridTexture() });
  return new THREE.Mesh(g, m);
}
const IDX = [];

// 天空：一顆反面的大球，用頂點顏色畫出破曉的漸層（地平線暖橘、天頂深藍）
const SUN_DIR = new V3(0.82, 0.22, 0.28).normalize();
function buildSky() {
  const g = new THREE.SphereGeometry(400, 32, 16);
  const pos = g.attributes.position, cols = [];
  const zen = new THREE.Color('#27426b'), mid = new THREE.Color('#9a8ab0'), hor = new THREE.Color('#ffb27a'), low = new THREE.Color('#3a3540');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400, x = pos.getX(i) / 400, z = pos.getZ(i) / 400;
    const sun = Math.max(0, x * SUN_DIR.x + z * SUN_DIR.z);       // 太陽那一側的地平線比較亮
    if (y > 0.35) c.copy(mid).lerp(zen, (y - 0.35) / 0.65);
    else if (y > 0) c.copy(hor).lerp(mid, y / 0.35);
    else c.copy(hor).lerp(low, Math.min(1, -y * 6));
    if (y > -0.05 && y < 0.5) c.lerp(new THREE.Color('#ffd7a0'), sun * sun * (1 - Math.abs(y) * 2) * 0.55);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -1;
  // 太陽：一張發光的圓
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.18, 'rgba(255,236,190,.95)'); gr.addColorStop(0.4, 'rgba(255,190,120,.35)'); gr.addColorStop(1, 'rgba(255,160,90,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sunS.position.copy(SUN_DIR).multiplyScalar(380); sunS.scale.set(70, 70, 1);
  sky.add(sunS);
  return sky;
}

// ---------- 路點圖：每 2 公尺一個點，站得下人的才算，相鄰且走得過去的連起來 ----------
const NAV = { nodes: [], cols: 36, rows: 26, x0: -35, z0: -25, step: 2 };
function cylinderFree(x, z, r, y0, y1) {
  for (let i = 1; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (b.max[1] <= y0 || b.min[1] >= y1) continue;
    const cx = clamp(x, b.min[0], b.max[0]), cz = clamp(z, b.min[2], b.max[2]);
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return false;
  }
  return true;
}
function sweepFree(ax, az, bx, bz, r) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!cylinderFree(ax + (bx - ax) * t, az + (bz - az) * t, r, 0.05, 1.8)) return false; }
  return true;
}
function buildNav() {
  const { cols, rows, x0, z0, step } = NAV;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    NAV.nodes.push({ id: j * cols + i, x, z, ok: cylinderFree(x, z, 0.55, 0.05, 1.8), nb: [] });
  }
  for (const n of NAV.nodes) {
    if (!n.ok) continue;
    const i = n.id % cols, j = (n.id / cols) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
      const m = NAV.nodes[jj * cols + ii]; if (!m.ok) continue;
      if (di && dj && (!NAV.nodes[j * cols + ii].ok || !NAV.nodes[jj * cols + i].ok)) continue;
      if (sweepFree(n.x, n.z, m.x, m.z, 0.45)) n.nb.push(m.id);
    }
  }
}
function nearestNode(x, z) {
  let best = null, bd = 1e9;
  for (const n of NAV.nodes) { if (!n.ok || !n.nb.length) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
// A*：回傳一串 [x,z]，再把走得直通的中間點拉掉
function findPath(sx, sz, tx, tz) {
  const s = nearestNode(sx, sz), t = nearestNode(tx, tz);
  if (!s || !t) return null;
  const open = [s.id], g = new Map([[s.id, 0]]), came = new Map(), f = new Map([[s.id, Math.hypot(s.x - t.x, s.z - t.z)]]), closed = new Set();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === t.id) {
      const out = []; let c = cur; while (c !== undefined) { const n = NAV.nodes[c]; out.unshift([n.x, n.z]); c = came.get(c); }
      out.push([tx, tz]);
      return smoothPath(sx, sz, out);
    }
    closed.add(cur);
    const cn = NAV.nodes[cur];
    for (const nb of cn.nb) {
      if (closed.has(nb)) continue;
      const m = NAV.nodes[nb], ng = g.get(cur) + Math.hypot(m.x - cn.x, m.z - cn.z);
      if (ng < (g.has(nb) ? g.get(nb) : 1e9)) {
        came.set(nb, cur); g.set(nb, ng); f.set(nb, ng + Math.hypot(m.x - t.x, m.z - t.z));
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return null;
}
function smoothPath(sx, sz, pts) {
  // 終點如果站不下（例如貼著牆）就丟掉，停在最後一個路點
  const last = pts[pts.length - 1]; if (!cylinderFree(last[0], last[1], 0.4, 0.05, 1.8)) pts.pop();
  const out = []; let ax = sx, az = sz, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !sweepFree(ax, az, pts[j][0], pts[j][1], 0.42)) j--;
    out.push(pts[j]); ax = pts[j][0]; az = pts[j][1]; i = j + 1;
  }
  return out;
}
