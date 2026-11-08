/* ===== 58-drops：地上的槍——陣亡掉槍、自己丟槍、撿槍
   對戰：每回合開始清掉；其他模式 20 秒後消失。地上最多 14 把（多了先清最舊的）。
   撿：走到槍旁邊，那一格是空的就自動撿；已經有了按「撿起」換（手上那把丟在原地）。 */
const DROPS = [];
const DROP_MAT = new THREE.MeshLambertMaterial({ color: '#d8d2c6' });
const _dropGeo = {};
function dropGeo(def) {
  if (_dropGeo[def.id]) return _dropGeo[def.id];
  const src = BOT_GUNS[def.id] || (def.slot === 'secondary' ? BOT_GUNS.pistol : BOT_GUNS.rifle);
  const g = src.geo.clone(); g.computeBoundingBox(); const c = new V3(); g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y, -c.z);
  return (_dropGeo[def.id] = g);
}
function spawnDrop(def, ammo, reserve, x, y, z) {
  if (!def || def === WEAPONS.pistol) return null;     // 基本手槍不掉（地上太亂）
  while (DROPS.length >= 14) removeDrop(DROPS[0]);
  // 掉在高處就放到最近的地面路點（機器人才拿得到）；不要卡進牆
  const n = nearestNode(x, z, y); if (n && Math.hypot(n.x - x, n.z - z) > 2.5) { x = n.x; z = n.z; y = n.y; }
  const mesh = new THREE.Mesh(dropGeo(def), DROP_MAT); mesh.material = mesh.material.clone(); mesh.material.color.set('#9a958c');
  mesh.position.set(x, (y || 0) + 0.06, z); mesh.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
  scene.add(mesh);
  const d = { def, ammo, reserve, pos: new V3(x, y || 0, z), mesh, t: 0 };
  DROPS.push(d); return d;
}
function removeDrop(d) { const i = DROPS.indexOf(d); if (i >= 0) DROPS.splice(i, 1); scene.remove(d.mesh); d.mesh.material.dispose(); }
function clearDrops() { while (DROPS.length) removeDrop(DROPS[0]); }
function nearDrop(pos, maxD = 1.3, filter = null) {
  let best = null, bd = maxD;
  for (const d of DROPS) {
    if (Math.abs(pos.y - d.pos.y) > 1.3 || (filter && !filter(d))) continue;
    const k = Math.hypot(pos.x - d.pos.x, pos.z - d.pos.z); if (k < bd) { bd = k; best = d; }
  }
  return best;
}
// 陣亡：掉主武器（沒有就掉重手槍）
function dropGunsOf(u) {
  const p = u.body.pos;
  if (u === player) {
    stashCur();
    const it = INV.primary || (INV.secondary && INV.secondary.def !== WEAPONS.pistol ? INV.secondary : null);
    if (it) { spawnDrop(it.def, it.ammo, it.reserve, p.x, p.y, p.z); if (game.mode === 'match') INV[it.def.slot] = it.def.slot === 'secondary' ? newItem(WEAPONS.pistol) : null; }
  } else {
    const def = u.primary || u.secondary; if (!def) return;
    spawnDrop(def, def.mag, def.reserve, p.x + rand(-0.3, 0.3), p.y, p.z + rand(-0.3, 0.3));
    if (game.mode === 'match') { if (u.primary) u.primary = null; else u.secondary = null; }
  }
}
// 你丟掉手上的槍（基本手槍不能丟）
function playerDropGun() {
  if (!player.alive || W.isNade || INV.cur === 'nade') return false;
  const slot = INV.cur, it = INV[slot]; if (!it || it.def === WEAPONS.pistol) { hudTip('基本手槍不能丟', 1); return false; }
  stashCur();
  const p = player.body.pos, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  spawnDrop(it.def, it.ammo, it.reserve, p.x + fx * 1.4, p.y, p.z + fz * 1.4);
  INV[slot] = slot === 'secondary' ? newItem(WEAPONS.pistol) : null;
  INV.cur = '__'; equip(slot === 'secondary' ? 'secondary' : bestSlot(), true);
  sfx('clink', 0.6); hudTip(`丟下${it.def.short}`, 0.8);
  return true;
}
// 你丟下炸彈（給隊友撿）
function playerDropBomb() {
  if (!INV.bomb || !isCarrier(player)) return false;
  dropBomb(player); hudTip('丟下炸彈', 1); return true;
}
// 撿槍：那一格空的直接拿；有了就交換（手上那把丟在原地）
function takeDrop(u, d) {
  if (u === player) {
    stashCur();
    const slot = d.def.slot, old = INV[slot];
    if (old && old.def !== WEAPONS.pistol) spawnDrop(old.def, old.ammo, old.reserve, d.pos.x, d.pos.y, d.pos.z);
    INV[slot] = { def: d.def, ammo: d.ammo, reserve: d.reserve };
    removeDrop(d); INV.cur = '__'; equip(slot, true); sfx('magin', 0.7); hudTip(`撿起${d.def.short}`, 0.9);
  } else {
    if (d.def.slot === 'primary') u.primary = d.def; else u.secondary = d.def;
    removeDrop(d); botArm(u);
  }
}
// 現在可以撿的：空格自動撿；換槍要按鍵（回傳給 useAction）
function pickableDrop() {
  if (!player.alive || !DROPS.length) return null;
  return nearDrop(player.body.pos, 1.3, (d) => !(INV[d.def.slot] && INV[d.def.slot].def === d.def));
}
function updateDrops(dt) {
  if (!DROPS.length) return;
  const life = game.mode === 'match' ? Infinity : 20;
  for (let i = DROPS.length - 1; i >= 0; i--) {
    const d = DROPS[i]; d.t += dt;
    d.mesh.material.color.setScalar(0.62 + 0.18 * Math.max(0, Math.sin(game.t * 4 + i)));   // 微微閃一下，比較好找
    if (d.t > life) removeDrop(d);
  }
  // 空格自動撿（主武器格空著、或只有基本手槍時撿到更好的手槍）
  if (player.alive) {
    const d = nearDrop(player.body.pos, 1.1, (x) => x.def.slot === 'primary' ? !INV.primary : INV.secondary && INV.secondary.def === WEAPONS.pistol);
    if (d) takeDrop(player, d);
  }
  // 機器人：沒有主武器、腳邊有槍就撿
  for (const b of bots) {
    if (!b.active || !b.alive || b.primary || b.dummy) continue;
    const d = nearDrop(b.phys.pos, 1.2, (x) => x.def.slot === 'primary'); if (d) takeDrop(b, d);
  }
}
// 機器人去撿槍的目標：沒有主武器、12 公尺內有槍、沒在交戰
function dropGoalFor(b) {
  if (b.primary || b.state === 'combat' || !DROPS.length) return null;
  const d = nearDrop(b.phys.pos, 12, (x) => x.def.slot === 'primary');
  return d ? { tag: 'gun', x: d.pos.x, z: d.pos.z, y: d.pos.y } : null;
}
