/* ===== 56-volume：M12 戰術道具進化（參考 CS2）
   1. 立體煙：煙霧彈落地後，煙在 0.7 公尺的格子裡「流」出去——碰到牆會轉彎、從門縫溢出、填滿房間（不是一顆固定的球）。
      子彈穿過會打出一條短暫的洞（大約 1.3 秒長回來）；手榴彈在旁邊爆炸會把一大片吹開 3 秒多。
      朝太陽那面比較亮、背光那面暗；攻方（赤隊）的煙偏暖色、我方偏冷色。
      視線判斷沿著線一格一格累加煙的濃度，所以從被打開的洞看得過去（你和機器人都一樣）。
   2. 燃燒彈：火沿著地面一格一格蔓延，牆擋得住、不會燒過牆，走到平台邊緣就停；煙蓋到哪一格，哪一格就熄。
   3. 炸彈衝擊波：從包點沿著地圖（路點）往外擴散，傷害看「沿路走過去的距離」——躲在牆後面或轉角後面比較安全；
      衝擊波經過的地方揚起灰塵，傳到你那邊時鏡頭才震。 */
const VC = 0.7, SNX = 21, SNY = 6, SNZ = 21, SN = SNX * SNY * SNZ, SMOKE_CELLS = 380, SMOKE_LIFE = 17;
const sIdx = (i, j, k) => (j * SNZ + k) * SNX + i;
function boxesNear(x0, y0, z0, x1, y1, z1) { return BOXES.filter((b) => b.max[0] > x0 && b.min[0] < x1 && b.max[1] > y0 && b.min[1] < y1 && b.max[2] > z0 && b.min[2] < z1); }
function pointFree(bx, x, y, z) { for (const b of bx) if (x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]) return false; return true; }
function segFree(bx, ax, ay, az, bx2, by, bz) {
  const dx = bx2 - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
  for (const b of bx) if (rayAABB(ax, ay, az, dx / L, dy / L, dz / L, b.min, b.max, L)) return false;
  return true;
}
// 線段和方塊的交集（起點在方塊裡面也算），回傳 [t0, t1]（0–1）或 null
function segClip(a, b, mn, mx) {
  let t0 = 0, t1 = 1; const o = [a.x, a.y, a.z], d = [b.x - a.x, b.y - a.y, b.z - a.z];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return null; continue; }
    let ta = (mn[k] - o[k]) / d[k], tb = (mx[k] - o[k]) / d[k]; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return null;
  }
  return [t0, t1];
}
const SMOKE_TINT = { warm: new THREE.Color('#d6cbb2'), cool: new THREE.Color('#c4cad0') };

// ---------- 煙霧彈 ----------
function popSmoke(n) {
  const p = n.pos, W = SNX * VC, D = SNZ * VC;
  const ox = p.x - W / 2, oy = p.y - 0.25, oz = p.z - D / 2;
  const bx = boxesNear(ox - 0.1, oy - 0.1, oz - 0.1, ox + W + 0.1, oy + SNY * VC + 0.1, oz + D + 0.1);
  const cx = (i) => ox + (i + 0.5) * VC, cy = (j) => oy + (j + 0.5) * VC, cz = (k) => oz + (k + 0.5) * VC;
  // 起點：落點那一格；被擋住就往上、往旁邊找空的
  let si = 10, sj = 0, sk = 10, found = false;
  for (let r = 0; r <= 2 && !found; r++) for (let j = 0; j <= 2 && !found; j++) for (let di = -r; di <= r && !found; di++) for (let dk = -r; dk <= r && !found; dk++) {
    if (pointFree(bx, cx(10 + di), cy(j), cz(10 + dk))) { si = 10 + di; sj = j; sk = 10 + dk; found = true; }
  }
  // 往外流：權重最小的先填（橫向 10、往上 17、往下 12），填到 420 格為止
  const dist = new Uint16Array(SN).fill(65535), order = [], Q = [];
  const push = (d, id) => { (Q[d] || (Q[d] = [])).push(id); };
  dist[sIdx(si, sj, sk)] = 0; push(0, sIdx(si, sj, sk));
  const NB = [[1, 0, 0, 10], [-1, 0, 0, 10], [0, 0, 1, 10], [0, 0, -1, 10], [0, 1, 0, 10], [0, -1, 0, 10]];   // 上下左右一樣容易：空地上是圓的一團，被牆擋住就往別處流
  for (let d = 0; d < Q.length && order.length < SMOKE_CELLS; d++) {
    const q = Q[d]; if (!q) continue;
    for (let qi = 0; qi < q.length && order.length < SMOKE_CELLS; qi++) {
      const id = q[qi]; if (dist[id] !== d) continue;
      order.push(id);
      const i = id % SNX, k = ((id / SNX) | 0) % SNZ, j = (id / (SNX * SNZ)) | 0;
      for (const [di, dj, dk, w] of NB) {
        const ni = i + di, nj = j + dj, nk = k + dk;
        if (ni < 0 || nj < 0 || nk < 0 || ni >= SNX || nj >= SNY || nk >= SNZ) continue;
        const nid = sIdx(ni, nj, nk), nd = d + w; if (nd >= dist[nid]) continue;
        if (!pointFree(bx, cx(ni), cy(nj), cz(nk)) || !segFree(bx, cx(i), cy(j), cz(k), cx(ni), cy(nj), cz(nk))) continue;
        dist[nid] = nd; push(nd, nid);
      }
    }
  }
  const maxD = dist[order[order.length - 1]] || 1;
  const dens = new Float32Array(SN), on = new Uint8Array(SN), rev = new Float32Array(SN);
  for (const id of order) on[id] = 1;
  const cells = new Int32Array(order), col = new Float32Array(order.length * 3), reveal = new Float32Array(order.length);
  const tint = n.team === 'B' ? SMOKE_TINT.warm : SMOKE_TINT.cool, sd = SUN_DIR, SUN_COL = new THREE.Color(MAP.theme.sunColor || '#ffffff');
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  order.forEach((id, q) => {
    const i = id % SNX, k = ((id / SNX) | 0) % SNZ, j = (id / (SNX * SNZ)) | 0, f = dist[id] / maxD;
    dens[id] = f < 0.72 ? 1 : 1 - (f - 0.72) / 0.28 * 0.5;            // 邊緣比較淡
    reveal[q] = Math.pow(f, 1.25);                                    // 先出現中間，再往外長
    // 自身陰影：往太陽方向走 3 格，碰到煙越多越暗；高處比較亮
    let occ = 0;
    for (let s = 1; s <= 3; s++) { const ii = Math.round(i + sd.x * s * 1.2), jj = Math.round(j + sd.y * s * 1.2), kk = Math.round(k + sd.z * s * 1.2); if (ii >= 0 && jj >= 0 && kk >= 0 && ii < SNX && jj < SNY && kk < SNZ && on[sIdx(ii, jj, kk)]) occ++; }
    const sh = clamp(1.04 - occ * 0.13 + j * 0.025, 0.55, 1.12);
    col[q * 3] = tint.r * sh * (0.92 + 0.08 * SUN_COL.r); col[q * 3 + 1] = tint.g * sh * (0.92 + 0.08 * SUN_COL.g); col[q * 3 + 2] = tint.b * sh * (0.92 + 0.08 * SUN_COL.b);
    const x = cx(i), y = cy(j), z = cz(k);
    mn = [Math.min(mn[0], x - VC / 2), Math.min(mn[1], y - VC / 2), Math.min(mn[2], z - VC / 2)]; mx = [Math.max(mx[0], x + VC / 2), Math.max(mx[1], y + VC / 2), Math.max(mx[2], z + VC / 2)];
  });
  const N = order.length, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 4), 4));
  geo.setDrawRange(0, 0);
  const eco = S.quality === 'eco';
  const mat = new THREE.PointsMaterial({ size: eco ? 2.7 : 2.3, map: puffTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  SMOKES.push({ x: p.x, y: oy, z: p.z, ox, oy, oz, r: 0, rMax: Math.max(mx[0] - p.x, p.x - mn[0], mx[2] - p.z, p.z - mn[2]), t: 0, life: SMOKE_LIFE,
    cells, reveal, col, dens, rev, hole: new Float32Array(SN), holes: new Set(), mn, mx, pts, team: n.team, eco });
  sfx('hiss', 1, { pos: p });
}
// 這一格現在的有效濃度（0–1）：本身濃度 × 長出來了沒 ×（1 − 被打開的洞）
const smokeEff = (s, id) => s.rev[id] * (1 - Math.min(1, s.hole[id]));
function smokeCell(s, x, y, z) {
  const i = Math.floor((x - s.ox) / VC), j = Math.floor((y - s.oy) / VC), k = Math.floor((z - s.oz) / VC);
  if (i < 0 || j < 0 || k < 0 || i >= SNX || j >= SNY || k >= SNZ) return -1;
  return sIdx(i, j, k);
}
function smokeSample(s, x, y, z) { const id = smokeCell(s, x, y, z); return id < 0 ? 0 : smokeEff(s, id); }
// 視線：沿著線每 0.3 公尺累加煙的濃度，超過約 1 公尺的濃煙就算擋住（被打開的洞看得過去）
function smokeBlocks(a, b) {
  for (const s of SMOKES) {
    if (s.t < 0.3) continue;
    const c = segClip(a, b, s.mn, s.mx); if (!c) continue;
    const L = a.distanceTo(b), t0 = c[0] * L, t1 = c[1] * L, step = 0.3;
    let sum = 0;
    for (let t = t0 + step * 0.5; t < t1; t += step) {
      const f = t / L; sum += smokeSample(s, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f) * step;
      if (sum > 0.95) return true;
    }
  }
  return false;
}
const smokeCovers = (x, z, extra = 0, y = null) => SMOKES.some((s) => {
  if (s.t > s.life - 1) return false;
  const yy = (y === null ? s.oy : y) + 0.4;
  if (smokeSample(s, x, yy, z) > 0.4) return true;
  return extra > 0 && [[extra, 0], [-extra, 0], [0, extra], [0, -extra]].some(([dx, dz]) => smokeSample(s, x + dx, yy, z + dz) > 0.4);
});
function smokeAtCamera() {
  let k = 0; const c = camera.position;
  for (const s of SMOKES) {
    // 附近幾點平均，進出煙比較順
    const v = (smokeSample(s, c.x, c.y, c.z) * 2 + smokeSample(s, c.x + 0.35, c.y, c.z) + smokeSample(s, c.x - 0.35, c.y, c.z) + smokeSample(s, c.x, c.y, c.z + 0.35) + smokeSample(s, c.x, c.y, c.z - 0.35)) / 6;
    k = Math.max(k, v);
  }
  return clamp(k * 1.15, 0, 1);
}
// 子彈穿過：沿線打出一條洞（中間全開、旁邊開一半）
function smokeBullet(o, d, len) {
  if (!SMOKES.length) return;
  const e = _v3b.copy(o).addScaledVector(d, len);
  for (const s of SMOKES) {
    const c = segClip(o, e, s.mn, s.mx); if (!c) continue;
    for (let t = c[0] * len; t < c[1] * len; t += 0.25) {
      const id = smokeCell(s, o.x + d.x * t, o.y + d.y * t, o.z + d.z * t); if (id < 0 || !s.dens[id]) continue;
      if (s.hole[id] < 1) { s.hole[id] = 1; s.holes.add(id); }
      for (const nd of [1, -1, SNX, -SNX, SNX * SNZ, -SNX * SNZ]) { const n2 = id + nd; if (n2 >= 0 && n2 < SN && s.dens[n2] && s.hole[n2] < 0.45) { s.hole[n2] = 0.45; s.holes.add(n2); } }
    }
  }
}
const _v3b = new V3();
// 爆炸：半徑內的煙被吹開（中間吹得最久），之後從邊緣慢慢流回來
function smokeBlast(p, R = 4.5) {
  for (const s of SMOKES) {
    if (p.x < s.mn[0] - R || p.x > s.mx[0] + R || p.z < s.mn[2] - R || p.z > s.mx[2] + R) continue;
    for (const id of s.cells) {
      const i = id % SNX, k = ((id / SNX) | 0) % SNZ, j = (id / (SNX * SNZ)) | 0;
      const d = Math.hypot(s.ox + (i + 0.5) * VC - p.x, (s.oy + (j + 0.5) * VC - p.y) * 0.8, s.oz + (k + 0.5) * VC - p.z);
      if (d < R) { const h = 3.2 * (1 - d / R) + 0.6; if (s.hole[id] < h) { s.hole[id] = h; s.holes.add(id); } }
    }
  }
}
function updateSmokes(dt) {
  for (let si = SMOKES.length - 1; si >= 0; si--) {
    const s = SMOKES[si]; s.t += dt;
    if (s.t >= s.life) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); SMOKES.splice(si, 1); continue; }
    // 長出來（1.6 秒從中間往外）、最後 3 秒從外往內散掉
    const grow = Math.min(1, s.t / 1.6), endCut = s.t > s.life - 3 ? (s.life - s.t) / 3 : 1.01, fadeA = clamp((s.life - s.t) / 1.2, 0, 1);
    const cells = s.cells, rv = s.reveal;
    for (let q = 0; q < cells.length; q++) { const id = cells[q], a = rv[q]; s.rev[id] = a <= grow && a <= endCut ? s.dens[id] * Math.min(1, (grow - a) * 6 + 0.2) * fadeA : 0; }
    s.r = s.rMax * Math.sqrt(grow);
    // 洞慢慢長回來（子彈約 1.3 秒、爆炸 3 秒多）
    for (const id of s.holes) { s.hole[id] -= dt * 0.75; if (s.hole[id] <= 0) { s.hole[id] = 0; s.holes.delete(id); } }
    // 畫：只畫表面（旁邊有空格或被打開的格子），裡面看不到的不畫，省很多
    const P = s.pts.geometry.attributes.position.array, C = s.pts.geometry.attributes.color.array, tt = s.t;
    let m = 0;
    for (let q = 0; q < cells.length; q++) {
      const id = cells[q], e = smokeEff(s, id); if (e < 0.04) continue;
      const i = id % SNX, k = ((id / SNX) | 0) % SNZ, j = (id / (SNX * SNZ)) | 0;
      let surf = j === SNY - 1;
      if (!surf) for (const nd of [1, -1, SNX, -SNX, SNX * SNZ]) { const n2 = id + nd; if (n2 < 0 || n2 >= SN || smokeEff(s, n2) < 0.6 * e) { surf = true; break; } }
      if ((!surf && q % 3) || (s.eco && (q & 1))) continue;   // 表面全畫、裡面畫三分之一（從洞看進去才有層次）
      const w = q * 1.7 + tt * 0.35;
      P[m * 3] = s.ox + (i + 0.5) * VC + Math.sin(w) * 0.14; P[m * 3 + 1] = s.oy + (j + 0.5) * VC + Math.sin(w * 1.3) * 0.08; P[m * 3 + 2] = s.oz + (k + 0.5) * VC + Math.cos(w) * 0.14;
      C[m * 4] = s.col[q * 3]; C[m * 4 + 1] = s.col[q * 3 + 1]; C[m * 4 + 2] = s.col[q * 3 + 2]; C[m * 4 + 3] = Math.min(1, e * 0.95);
      m++;
    }
    s.pts.geometry.setDrawRange(0, m);
    s.pts.geometry.attributes.position.needsUpdate = true; s.pts.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------- 燃燒彈：沿地面一格一格蔓延 ----------
const FC = 0.7, FIRE_CELLS = 40, FIRE_LIFE = 7, FIRE_DPS = 40, FIRE_R = 3;
// 這一點底下有沒有地板（地面、或高度差不多的方塊頂）
function floorAt(bx, x, z, y) {
  if (y < 0.2) return pointFree(bx, x, 0.05, z);
  for (const b of bx) if (x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2] && Math.abs(b.max[1] - y) < 0.3) return pointFree(bx, x, y + 0.05, z);
  return false;
}
function igniteFire(n) {
  const p = n.pos;
  if (smokeCovers(p.x, p.z, 0, p.y - 0.4)) { sfx('hiss', 0.6, { pos: p }); spawnPuff(p, '#8a8680', 1.2, 0.6, 0.6); return; }
  const R = 4.5, bx0 = boxesNear(p.x - 0.5, -1, p.z - 0.5, p.x + 0.5, p.y + 0.3, p.z + 0.5);
  let y = 0; for (const b of bx0) if (p.x > b.min[0] && p.x < b.max[0] && p.z > b.min[2] && p.z < b.max[2] && b.max[1] <= p.y + 0.15) y = Math.max(y, b.max[1]);   // 落點底下的地板高度
  const bx = boxesNear(p.x - R, y - 0.6, p.z - R, p.x + R, y + 1.2, p.z + R);
  // 從落點往外，一格一格找有地板、沒被牆擋住的地方
  const seen = new Map(), cells = [], key = (i, k) => i * 1000 + k, q = [[0, 0, 0]]; seen.set(key(0, 0), 1);
  while (q.length && cells.length < FIRE_CELLS) {
    q.sort((a, b) => a[2] - b[2]); const [i, k, d] = q.shift();
    const x = p.x + i * FC, z = p.z + k * FC;
    if (d > 0 && !floorAt(bx, x, z, y)) continue;
    cells.push({ x, z, at: Math.min(0.9, d * 0.09), on: true });
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nk = k + dk; if (seen.has(key(ni, nk))) continue; seen.set(key(ni, nk), 1);
      const nx = p.x + ni * FC, nz = p.z + nk * FC, nd = d + Math.hypot(di, dk);
      if (Math.hypot(nx - p.x, nz - p.z) > R) continue;
      if (!segFree(bx, x, y + 0.3, z, nx, y + 0.3, nz)) continue;   // 牆擋得住
      q.push([ni, nk, nd]);
    }
  }
  const N = cells.length * 2, geo = new THREE.BufferGeometry(), off = [];
  for (let i = 0; i < N; i++) off.push([i >> 1, rand(-0.3, 0.3), rand(-0.3, 0.3), Math.random(), rand(2, 4)]);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const mat = new THREE.PointsMaterial({ size: 1.4, map: puffTex, color: '#ff8a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let r = 0; for (const c of cells) r = Math.max(r, Math.hypot(c.x - p.x, c.z - p.z) + FC * 0.6);
  FIRES.push({ x: p.x, y, z: p.z, r, t: 0, life: FIRE_LIFE, tick: 0, team: n.team, owner: n.owner, pts, off, cells });
  addDecal(_v2.set(p.x, y + 0.005, p.z), [0, 1, 0], Math.max(4, r * 2), _scorch);
  boomFx(p, 2.5, '#ff9a3a', 0.3); sfx('boom', 0.35, { pos: p }); sfx('hiss', 0.5, { pos: p });
}
function removeFire(f) { scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose(); }
// 這個點在不在火裡（margin：多算幾公尺，給機器人繞路用）
function fireAt(x, z, y = 0, margin = 0) {
  for (const f of FIRES) {
    if (f.t >= f.life - 0.6 || Math.abs(y - f.y) > 1.6 || Math.hypot(x - f.x, z - f.z) > f.r + margin + 0.5) continue;
    for (const c of f.cells) if (c.on && f.t >= c.at && Math.hypot(x - c.x, z - c.z) < FC * 0.62 + margin) return f;
  }
  return null;
}
function updateFires(dt) {
  for (let i = FIRES.length - 1; i >= 0; i--) {
    const f = FIRES[i]; f.t += dt;
    // 煙蓋到哪一格就熄哪一格；全熄了就結束
    if (SMOKES.length && f.t > 0.3) {
      let left = 0;
      for (const c of f.cells) { if (c.on && smokeCovers(c.x, c.z, 0, f.y - 0.3)) { c.on = false; if (Math.random() < 0.3) sfx('hiss', 0.35, { pos: _v2.set(c.x, f.y, c.z) }); } if (c.on) left++; }
      if (!left) f.life = Math.min(f.life, f.t + 0.3);
    }
    const a = f.pts.geometry.attributes.position.array, end = f.t > f.life - 1 ? Math.max(0, f.life - f.t) : 1;
    let m = 0;
    for (const o of f.off) {
      const c = f.cells[o[0]]; if (!c.on || f.t < c.at) continue;
      const h = (o[3] + f.t * o[4] * 0.35) % 1, grow = Math.min(1, (f.t - c.at) / 0.3);
      a[m * 3] = c.x + o[1]; a[m * 3 + 1] = f.y + 0.1 + h * 1.1 * grow * end; a[m * 3 + 2] = c.z + o[2]; m++;
    }
    f.pts.geometry.setDrawRange(0, m); f.pts.geometry.attributes.position.needsUpdate = true;
    f.pts.material.opacity = 0.85 * Math.min(1, f.t / 0.3) * clamp(f.life - f.t, 0, 1);
    f.pts.material.size = 1.2 + 0.4 * Math.sin(f.t * 13);
    if ((game.t * 8 | 0) % 2 === 0 && f.t < f.life - 0.5) muzzleLight(_v2.set(f.x, f.y + 0.6, f.z), 1.4);
    f.tick += dt;
    if (f.tick >= 0.25) {
      f.tick -= 0.25;
      if (f.owner && f.owner.remote) { if (f.t >= f.life) { removeFire(f); FIRES.splice(i, 1); } continue; }   // 好友對戰：對手的火傷害由他那台算
      for (const u of [player].concat(bots.filter((b) => b.active))) {
        if (!u.alive || (u.team === f.team && u !== f.owner)) continue;
        const up = u.body.pos; if (Math.abs(up.y - f.y) > 1.2) continue;
        let inF = false; for (const c of f.cells) if (c.on && f.t >= c.at && Math.hypot(up.x - c.x, up.z - c.z) < FC * 0.62) { inF = true; break; }
        if (!inF) continue;
        const dmg = FIRE_DPS * 0.25 * (u === f.owner ? 0.6 : 1);
        if (u === player) { if (f.owner !== player) damagePlayer(dmg, f.owner, 'legs', NADES.molotov); else { player.hp = Math.max(1, player.hp - dmg); player.hurtT = 0.3; } }
        else damageBot(u, dmg, 'legs', _v3.set(0, 1, 0).clone(), f.owner, NADES.molotov);
      }
    }
    if (f.t >= f.life) { removeFire(f); FIRES.splice(i, 1); }
  }
}

// ---------- 炸彈衝擊波：沿路點往外擴散 ----------
const BLAST = { t: 0, ev: [], on: false, shakeAt: -1, shakeK: 0 };
const BLAST_SPEED = 38;   // 公尺／秒
// 從 p 沿著路點走，到每個路點的距離（Dijkstra，只算到 maxD）
function navDistFrom(p, maxD) {
  const s = nearestNode(p.x, p.z, p.y), D = new Map(); if (!s) return D;
  const d0 = Math.hypot(s.x - p.x, s.z - p.z); D.set(s.id, d0);
  const open = [[d0, s.id]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, id] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (d > D.get(id)) continue;
    const n = NAV.nodes[id];
    for (const m of n.nb) { const o = NAV.nodes[m], nd = d + Math.hypot(o.x - n.x, o.z - n.z, (o.y - n.y) * 1.5); if (nd < maxD && nd < (D.has(m) ? D.get(m) : 1e9)) { D.set(m, nd); open.push([nd, m]); } }
  }
  return D;
}
// 一個人離炸彈的「衝擊波距離」：看得到就用直線距離；被牆擋住就要繞路，算繞過去的距離（再加一點，牆會吃掉一些）
function blastDist(D, p, u) {
  const up = u.body.pos, straight = Math.hypot(up.x - p.x, up.z - p.z, (up.y - p.y) * 0.5);
  _v2.set(p.x, p.y + 0.5, p.z); _v3b.set(up.x, up.y + u.body.h * 0.6, up.z);
  if (lineClearNoSmoke(_v2, _v3b)) return straight;
  const n = nearestNode(up.x, up.z, up.y); if (!n || !D.has(n.id)) return Math.max(straight * 1.6, 30);
  return Math.max(straight * 1.15, (D.get(n.id) + Math.hypot(up.x - n.x, up.z - n.z)) * 1.12);
}
// 衝擊波的灰塵：經過的路點陸續揚起
function startBlastWave(p, D) {
  const ev = [];
  for (const [id, d] of D) if (d < 26 && (id % 3 === 0)) ev.push([d / BLAST_SPEED, NAV.nodes[id]]);
  ev.sort((a, b) => a[0] - b[0]); BLAST.ev = ev.slice(0, 60); BLAST.t = 0; BLAST.on = true;
}
function updateBlast(dt) {
  if (!BLAST.on) return;
  BLAST.t += dt;
  while (BLAST.ev.length && BLAST.ev[0][0] <= BLAST.t) { const n = BLAST.ev.shift()[1]; spawnPuff(_v2.set(n.x + rand(-0.6, 0.6), (n.y || 0) + 0.3, n.z + rand(-0.6, 0.6)), Math.random() < 0.5 ? '#6a5e50' : '#8a7a62', rand(1.6, 2.8), rand(0.8, 1.4), 1.2); }
  if (BLAST.shakeAt >= 0 && BLAST.t >= BLAST.shakeAt) { player.punchPV += BLAST.shakeK * 1.8; player.punchYV += rand(-1, 1) * BLAST.shakeK * 0.8; BLAST.shakeAt = -1; }
  if (!BLAST.ev.length && BLAST.shakeAt < 0) BLAST.on = false;
}
