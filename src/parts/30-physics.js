/* ===== 30-physics：圓柱對方塊的碰撞與滑牆、射線判定 ===== */
const GRAVITY = 20.3, STEP_UP = 0.45;

// 射線打方塊（slab 法）。回傳距離與打到的面法向量，打不到回 null
const RAY_HIT = { t: 0, n: [0, 0, 0] };
function rayAABB(ox, oy, oz, dx, dy, dz, mn, mx, maxT) {
  let t0 = 0, t1 = maxT, ax = -1, sg = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return false; continue; }
    const inv = 1 / d[a];
    let ta = (mn[a] - o[a]) * inv, tb = (mx[a] - o[a]) * inv, s = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
    if (ta > t0) { t0 = ta; ax = a; sg = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  if (ax < 0) return false;   // 起點在方塊裡面
  RAY_HIT.t = t0; RAY_HIT.n[0] = RAY_HIT.n[1] = RAY_HIT.n[2] = 0; RAY_HIT.n[ax] = sg;
  return true;
}
// 射線打地圖：回傳 { t, n } 或 null
function rayWorld(o, d, maxT) {
  let best = null;
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, b.min, b.max, best ? best.t : maxT)) {
      best = { t: RAY_HIT.t, n: RAY_HIT.n.slice(), box: i };
    }
  }
  return best;
}
// 兩點之間有沒有被擋住（視線）
function lineClear(a, b) {
  _v3.subVectors(b, a); const len = _v3.length(); if (len < 1e-4) return true;
  _v3.multiplyScalar(1 / len);
  for (let i = 0; i < BOXES.length; i++) {
    const bx = BOXES[i];
    if (rayAABB(a.x, a.y, a.z, _v3.x, _v3.y, _v3.z, bx.min, bx.max, len)) return false;
  }
  return true;
}

// ---------- 角色身體：直立的圓柱 ----------
// body: { pos(腳底), vel, r, h, onGround }
function overlapXZ(b, x, z, r) {
  const cx = clamp(x, b.min[0], b.max[0]), cz = clamp(z, b.min[2], b.max[2]);
  return (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r;
}
function headroom(x, z, r, y0, y1) {
  for (let i = 1; i < BOXES.length; i++) { const b = BOXES[i]; if (b.max[1] > y0 && b.min[1] < y1 && overlapXZ(b, x, z, r)) return false; }
  return true;
}
function resolveXZ(body) {
  const p = body.pos, r = body.r;
  let hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (let i = 1; i < BOXES.length; i++) {
      const b = BOXES[i];
      if (b.max[1] <= p.y + 0.001 || b.min[1] >= p.y + body.h - 0.001) continue;
      const cx = clamp(p.x, b.min[0], b.max[0]), cz = clamp(p.z, b.min[2], b.max[2]);
      let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      // 矮於一階的方塊：在地上就直接踏上去（樓梯、門檻）
      const rise = b.max[1] - p.y;
      if (body.onGround && rise > 0 && rise <= STEP_UP && headroom(p.x, p.z, r * 0.9, b.max[1] + 0.01, b.max[1] + body.h)) { p.y = b.max[1]; moved = true; continue; }
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.z += dz / d * push;
      } else {
        // 圓心跑進方塊裡：往最近的邊推出去
        const pen = [p.x - b.min[0] + r, b.max[0] - p.x + r, p.z - b.min[2] + r, b.max[2] - p.z + r];
        const m = pen.indexOf(Math.min(...pen));
        if (m === 0) p.x -= pen[0]; else if (m === 1) p.x += pen[1]; else if (m === 2) p.z -= pen[2]; else p.z += pen[3];
      }
      moved = true; hit = true;
    }
    if (!moved) break;
  }
  return hit;
}
// 移動一步：水平先動、推出牆外（沿牆滑），再處理重力、落地、撞頭
function moveBody(body, dt) {
  const p = body.pos, wasGround = body.onGround;
  const dx = body.vel.x * dt, dz = body.vel.z * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (body.r * 0.5)));
  let hitWall = false;
  for (let s = 0; s < n; s++) { p.x += dx / n; p.z += dz / n; if (resolveXZ(body)) hitWall = true; }

  body.vel.y -= GRAVITY * dt;
  const ny = p.y + body.vel.y * dt;
  // 腳下最高的地面
  let ground = -1e9, ceil = 1e9;
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (!overlapXZ(b, p.x, p.z, body.r * 0.85)) continue;
    if (b.max[1] <= p.y + 0.02 && b.max[1] > ground) ground = b.max[1];
    if (b.min[1] >= p.y + body.h - 0.02 && b.min[1] < ceil) ceil = b.min[1];
  }
  if (body.vel.y <= 0) {
    if (ny <= ground) { p.y = ground; body.vel.y = 0; body.onGround = true; }
    else if (wasGround && p.y - ground <= STEP_UP + 0.05 && !body.jumped) { p.y = ground; body.vel.y = 0; body.onGround = true; }  // 下樓梯貼地
    else { p.y = ny; body.onGround = false; }
  } else {
    if (ny + body.h >= ceil) { p.y = ceil - body.h; body.vel.y = 0; } else p.y = ny;
    body.onGround = false;
  }
  body.jumped = false;
  return hitWall;
}

// 分部位的命中框：頭、身體、腳（站和蹲的高度不同）。給玩家和機器人共用
function hitBoxes(pos, h, out) {
  const k = h / 1.8;
  out[0].part = 'head'; out[0].min[0] = pos.x - 0.15; out[0].max[0] = pos.x + 0.15; out[0].min[2] = pos.z - 0.15; out[0].max[2] = pos.z + 0.15;
  out[0].min[1] = pos.y + 1.5 * k; out[0].max[1] = pos.y + h + 0.02;
  out[1].part = 'body'; out[1].min[0] = pos.x - 0.27; out[1].max[0] = pos.x + 0.27; out[1].min[2] = pos.z - 0.27; out[1].max[2] = pos.z + 0.27;
  out[1].min[1] = pos.y + 0.85 * k; out[1].max[1] = pos.y + 1.5 * k;
  out[2].part = 'legs'; out[2].min[0] = pos.x - 0.22; out[2].max[0] = pos.x + 0.22; out[2].min[2] = pos.z - 0.22; out[2].max[2] = pos.z + 0.22;
  out[2].min[1] = pos.y; out[2].max[1] = pos.y + 0.85 * k;
  return out;
}
const newBoxes = () => [0, 1, 2].map(() => ({ part: '', min: [0, 0, 0], max: [0, 0, 0] }));
const PART_MUL = { head: 4, body: 1, legs: 0.75 };
// 射線打某個角色的三個框，回傳最近的 { t, part }
function rayBody(o, d, boxes, maxT, inflate = 0) {
  let best = null;
  for (const b of boxes) {
    let mn = b.min, mx = b.max;
    if (inflate) { mn = [b.min[0] - inflate, b.min[1] - inflate, b.min[2] - inflate]; mx = [b.max[0] + inflate, b.max[1] + inflate, b.max[2] + inflate]; }
    if (rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, mn, mx, best ? best.t : maxT)) best = { t: RAY_HIT.t, part: b.part, n: RAY_HIT.n.slice() };
  }
  return best;
}
