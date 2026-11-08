/* ===== 66-bomb：炸彈模式——兩個包點，攻方帶炸彈去裝（按住 3.2 秒），裝好 40 秒後爆炸；守方按住拆（10 秒，有拆彈器 5 秒）
   帶炸彈的人陣亡，炸彈掉在地上，攻方的人走過去就撿起來。 */
const SITES = {};
// 從地圖資料載入包點（換地圖時呼叫）
function loadSites() {
  for (const k of Object.keys(SITES)) delete SITES[k];
  for (const [k, v] of Object.entries(MAP.sites)) SITES[k] = Object.assign({ id: k }, v);
}
loadSites();
function siteAt(x, y, z) {
  for (const k in SITES) { const s = SITES[k]; if (y < 0.6 && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return k; }
  return null;
}
const BOMB = { state: 'none', carrier: null, pos: new V3(), site: null, t: 0, planted: false, beepT: 0, planter: null, defuser: null };
const BOMB_TIME = 40, PLANT_TIME = 3.2, DEFUSE_TIME = 10, DEFUSE_KIT = 5;
// 炸彈的模型：一個小方塊＋閃紅燈
const bombMesh = new THREE.Group();
(function () {
  bombMesh.add(new THREE.Mesh(mergeParts([partBox(0.34, 0.12, 0.22, 0, 0.06, 0, '#3b3a34'), partBox(0.18, 0.02, 0.12, -0.04, 0.13, 0, '#202a24'),
    partBox(0.05, 0.02, 0.05, 0.11, 0.13, 0.05, '#7a6a40'), partCyl(0.012, 0.3, 0.0, 0.1, -0.08, '#a03a28')]), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#ff3020', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  led.position.set(0.11, 0.16, -0.05); led.scale.set(0.18, 0.18, 1); bombMesh.add(led); bombMesh.userData.led = led;
  bombMesh.visible = false; scene.add(bombMesh);
})();
const isCarrier = (u) => BOMB.state === 'carried' && BOMB.carrier === u;
function resetBomb() {
  BOMB.state = 'none'; BOMB.carrier = null; BOMB.planted = false; BOMB.site = null; BOMB.t = 0; BOMB.planter = BOMB.defuser = null;
  bombMesh.visible = false; INV.bomb = false; player.useT = 0;
  for (const b of bots) b.useT = 0;
}
function giveBomb(u) {
  BOMB.state = 'carried'; BOMB.carrier = u; bombMesh.visible = false;
  if (u === player) { INV.bomb = true; hudTip(`你帶著炸彈：隊友打算攻 ${ROUND.plan ? ROUND.plan.site : 'A'} 點，到包點按住「裝彈」`, 5); }
}
function dropBomb(u) {
  if (!isCarrier(u)) return;
  BOMB.state = 'dropped'; BOMB.carrier = null; if (u === player) INV.bomb = false;
  BOMB.pos.set(u.body.pos.x, 0, u.body.pos.z);
  // 掉在平台上就往下放到地面（機器人到不了高處）
  const n = nearestNode(u.body.pos.x, u.body.pos.z, u.body.pos.y);
  BOMB.pos.y = u.body.pos.y > 0.5 && n ? n.y : 0;
  if (n && Math.hypot(n.x - BOMB.pos.x, n.z - BOMB.pos.z) > 2.5) BOMB.pos.set(n.x, n.y, n.z);
  bombMesh.position.copy(BOMB.pos); bombMesh.rotation.set(0, Math.random() * 6, 0.3); bombMesh.visible = true;
}
function plantBomb(u) {
  BOMB.state = 'planted'; BOMB.planted = true; BOMB.carrier = null; BOMB.t = BOMB_TIME; BOMB.beepT = 0; BOMB.planter = u;
  BOMB.site = siteAt(u.body.pos.x, 0, u.body.pos.z) || 'A';
  BOMB.pos.set(u.body.pos.x, u.body.pos.y, u.body.pos.z);
  bombMesh.position.copy(BOMB.pos); bombMesh.rotation.set(0, u === player ? player.yaw : u.yaw, 0); bombMesh.visible = true;
  if (u === player) { INV.bomb = false; statPlant(); }
  addMoney(u, ECON.plant, '裝彈');
  hudBanner(`炸彈已裝在 ${BOMB.site} 點`, `${BOMB_TIME} 秒後爆炸`, 2.2, u.team === player.team ? 'win' : 'lose');
  sfx('plant');
  // 守方全部知道炸彈在哪
  const intel = TEAM_INTEL[u.team === 'A' ? 'B' : 'A']; intel.t = game.t; intel.pos.copy(BOMB.pos);
  if (typeof onBombPlanted === 'function') onBombPlanted();
}
function defuseBomb(u) {
  BOMB.state = 'defused'; BOMB.defuser = u; if (u === player) statDefuse();
  addMoney(u, ECON.defuse, '拆彈');
  endRound(u.team, '炸彈拆除', 'defuse');
}
function explodeBomb() {
  BOMB.state = 'exploded'; bombMesh.visible = false;
  const p = BOMB.pos;
  boomFx(p, 18, '#ffb050', 0.5);
  for (let k = 0; k < 16; k++) spawnPuff(_v2.set(p.x + rand(-4, 4), p.y + rand(0.5, 5), p.z + rand(-4, 4)), k % 2 ? '#3d3a36' : '#8a5a30', rand(3, 6), rand(1.2, 2.2), 1.5);
  spawnSparks(p, _v2.set(0, 1, 0), '#ffd27a', 40);
  addDecal(_v2.set(p.x, 0.005, p.z), [0, 1, 0], 20, _scorch);
  sfx('bombboom', 1.2, { pos: p });
  endRound(ROUND.atk, '炸彈爆炸', 'bomb');      // 先判勝負，炸死的人不會再觸發「全滅」
  // 傷害：10 公尺內幾乎必死，20 公尺外沒事
  const units = [player].concat(bots.filter((b) => b.active && b.alive));
  for (const u of units) {
    if (!u.alive) continue;
    const d = Math.hypot(u.body.pos.x - p.x, u.body.pos.z - p.z, (u.body.pos.y - p.y) * 0.5);
    let dmg = 420 * Math.exp(-(d / 8.5) * (d / 8.5)); if (u === player ? INV.vest : u.vest) { wearArmor(u, dmg * 0.25); dmg *= 0.75; }
    if (dmg < 2) continue;
    if (u === player) damagePlayer(dmg, BOMB.planter || bots[0], 'body', { short: '炸彈', reward: 0 });
    else damageBot(u, dmg, 'body', _v3.set(0, 1, 0).clone(), BOMB.planter && BOMB.planter !== u ? BOMB.planter : u, { short: '炸彈', reward: 0 }, true);
  }
  const dc = camera.position.distanceTo(p);
  if (dc < 40) { player.punchPV += (40 - dc) * 1.8; player.punchYV += rand(-1, 1) * (40 - dc) * 0.8; }
}
// 每一步：炸彈倒數、嗶聲、撿炸彈
function updateBomb(dt) {
  if (game.mode !== 'match') return;
  if (BOMB.state === 'planted') {
    BOMB.t -= dt; BOMB.beepT -= dt;
    const led = bombMesh.userData.led;
    if (BOMB.beepT <= 0) { BOMB.beepT = lerp(0.12, 1.0, clamp(BOMB.t / BOMB_TIME, 0, 1)); sfx('beep', 1, { pos: BOMB.pos }); led.visible = true; led.userData.t = 0.08; }
    else if ((led.userData.t -= dt) <= 0) led.visible = false;
    if (BOMB.t <= 0 && ROUND.phase === 'live') explodeBomb();
  } else if (BOMB.state === 'dropped') {
    // 攻方的人走到炸彈上就撿起來
    const atk = [player].concat(bots).filter((u) => u.alive && u.team === ROUND.atk && (u === player || u.active));
    for (const u of atk) if (Math.hypot(u.body.pos.x - BOMB.pos.x, u.body.pos.z - BOMB.pos.z) < 1.0 && Math.abs(u.body.pos.y - BOMB.pos.y) < 1.2) { giveBomb(u); if (u === player) sfx('magin'); break; }
    bombMesh.userData.led.visible = (game.t * 2 % 1) < 0.15;
  }
  updatePlayerUse(dt);
}
// ---------- 你按住「裝彈／拆彈」 ----------
// 能做什麼：'plant'（你帶炸彈、在包點、站在地上）、'defuse'（你是守方、靠近已裝好的炸彈）或 ''
function useAction() {
  const p = player.body.pos;
  if (game.mode === 'tutorial') return player.alive && INV.bomb && isCarrier(player) && player.body.onGround && siteAt(p.x, p.y, p.z) ? 'plant' : '';
  if (game.mode === 'match' && player.alive && ROUND.phase === 'live') {
    if (INV.bomb && isCarrier(player) && player.body.onGround && siteAt(p.x, p.y, p.z)) return 'plant';
    if (BOMB.state === 'planted' && player.team !== ROUND.atk && Math.hypot(p.x - BOMB.pos.x, p.z - BOMB.pos.z) < 1.7 && Math.abs(p.y - BOMB.pos.y) < 1.4) return 'defuse';
  }
  return pickableDrop() ? 'pickup' : '';
}
function plantBusy() { return !!(INPUT.use && player.useT > 0); }
function updatePlayerUse(dt) {
  const act = useAction();
  if (!act || !INPUT.use) { if (player.useT > 0 && act !== player.useKind) player.useT = 0; if (!INPUT.use) player.useT = 0; player.useKind = act; return; }
  if (act === 'pickup') { const d = pickableDrop(); if (d) takeDrop(player, d); INPUT.use = false; player.useT = 0; return; }
  if (player.useKind !== act) { player.useT = 0; player.useKind = act; }
  if (player.useT === 0) { sfx('plant'); player.ads = false; }
  player.useT += dt;
  const need = act === 'plant' ? PLANT_TIME : INV.kit ? DEFUSE_KIT : DEFUSE_TIME;
  if (Math.floor(player.useT * 2) !== Math.floor((player.useT - dt) * 2)) sfx('plant');
  if (player.useT >= need) {
    player.useT = 0; INPUT.use = false;
    if (act === 'plant') plantBomb(player); else defuseBomb(player);
  }
}
function useProgress() {
  const act = useAction(); if (!act || act === 'pickup' || !(player.useT > 0)) return 0;
  return player.useT / (act === 'plant' ? PLANT_TIME : INV.kit ? DEFUSE_KIT : DEFUSE_TIME);
}

// ---------- 地上的包點標示：黃色外框＋大字 ----------
let siteMarkMeshes = [];
function buildSiteMarks() {
  for (const m of siteMarkMeshes) { scene.remove(m); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
  siteMarkMeshes = [];
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
  c.font = '900 110px "Saira Condensed","Arial Narrow",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,196,60,.85)'; c.fillText('A', 64, 68); c.fillText('B', 192, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const geos = [];
  const quad = (cx, cz, w, h, u0, u1) => {
    const g = new THREE.PlaneGeometry(w, h); g.rotateX(-Math.PI / 2); g.translate(cx, 0.015, cz);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
    geos.push(g);
  };
  const mk = (s) => s.mark || [s.cx, s.cz];
  quad(mk(SITES.A)[0], mk(SITES.A)[1], 3.2, 3.2, 0, 0.5); quad(mk(SITES.B)[0], mk(SITES.B)[1], 3.2, 3.2, 0.5, 1);
  const letters = new THREE.Mesh(BufferGeometryUtils_merge(geos), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  scene.add(letters); siteMarkMeshes.push(letters);
  // 外框：細長條
  const lines = [], col = '#e8b23a';
  for (const s of Object.values(SITES)) {
    const t = 0.12;
    lines.push(partBox(s.x1 - s.x0, 0.01, t, (s.x0 + s.x1) / 2, 0.012, s.z0, col), partBox(s.x1 - s.x0, 0.01, t, (s.x0 + s.x1) / 2, 0.012, s.z1, col),
      partBox(t, 0.01, s.z1 - s.z0, s.x0, 0.012, (s.z0 + s.z1) / 2, col), partBox(t, 0.01, s.z1 - s.z0, s.x1, 0.012, (s.z0 + s.z1) / 2, col));
  }
  const fr = new THREE.Mesh(mergeParts(lines), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false })); scene.add(fr); siteMarkMeshes.push(fr);
}
buildSiteMarks();
function BufferGeometryUtils_merge(geos) {
  // 合併幾個非索引幾何（只要位置與 UV）
  let n = 0; const parts = geos.map((g) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
