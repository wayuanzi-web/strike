/* ===== 22-mapgfx：地圖的樣子——程式畫的寫實貼圖、烘焙陰影與環境光遮蔽、邊角磨損、裝飾與遠景 =====
   碰撞只看 BOXES；這裡加的裝飾（DECOR）只畫不擋。太陽與地圖都不會動，所以陰影在載入時算一次存在頂點上。 */
const SUN_DIR = new V3().fromArray(MAP.theme.sun).normalize();
// 每種方塊用哪個材質，和它的底色（貼圖是灰階，顏色靠頂點色）
const MAT_OF = { floor: 'floor', outer: 'concrete', pillar: 'concrete', low: 'concrete', dock: 'concrete', lintel: 'concrete', trim: 'concrete',
  wall: 'brick', rust: 'container', teal: 'container', olive: 'container', crate: 'wood', shed: 'metal', dark: 'metal', paint: 'floor', hazard: 'floor',
  // 舊城：灰泥牆、石材、石板地、木攤位、窗、屋簷、遮陽布、水
  house: 'plaster', house2: 'plaster', house3: 'plaster', stone: 'concrete', cobble: 'cobble', stall: 'wood', win: 'metal', roof: 'brick', door: 'wood',
  awn1: 'plaster', awn2: 'plaster', water: 'floor', clock: 'plaster', sill: 'concrete',
  // 鐵道：碎石地、車廂、鐵軌、枕木
  gravel: 'gravel', car1: 'container', car2: 'container', car3: 'container', rail: 'metal', sleeper: 'wood', canopy: 'metal', yellow: 'floor' };
const TINT = {
  floor: '#9a958c', outer: '#9b968d', pillar: '#a29d93', low: '#aca598', dock: '#a19b90', lintel: '#8f897f', trim: '#b4ada1',
  wall: '#a46a55', rust: '#b8552f', teal: '#2e7f88', olive: '#7f823c', crate: '#c3935a', shed: '#8a959a', dark: '#4a4d52', paint: '#e0b43a', hazard: '#262626',
  house: '#e6d8bd', house2: '#d9a27a', house3: '#c9d2cf', stone: '#c4b8a2', cobble: '#a49a8a', stall: '#a8774a', win: '#34393f', roof: '#b0573a', door: '#6b4a32',
  awn1: '#c8423a', awn2: '#f0e8d8', water: '#4f8fa8', clock: '#f2ede2', sill: '#d8d0c0',
  gravel: '#a89c8c', car1: '#7a3a2c', car2: '#3d5a7a', car3: '#6a6a5e', rail: '#8a8580', sleeper: '#5a4636', canopy: '#6d757c', yellow: '#e0b43a',
};

// 每張地圖都有的：依方塊顏色自動加的裝飾（貨櫃凸條、牆頂壓條、外牆壁柱、房子窗戶與屋簷、車廂細節）
function decorBoxes() {
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
      if (z0 >= 26) { for (let x = -33; x <= 33; x += 6) D(x - 0.2, 25.9, x + 0.2, 26, 0, y1, 'outer'); D(-36, 25.85, 36, 26, y1, y1 + 0.1, 'trim'); }
      if (z1 <= -26) { for (let x = -33; x <= 33; x += 6) D(x - 0.2, -26, x + 0.2, -25.9, 0, y1, 'outer'); D(-36, -26, 36, -25.85, y1, y1 + 0.1, 'trim'); }
      if (x0 >= 36) { for (let z = -21; z <= 21; z += 6) D(35.9, z - 0.2, 36, z + 0.2, 0, y1, 'outer'); D(35.85, -26, 36, 26, y1, y1 + 0.1, 'trim'); }
      if (x1 <= -36) { for (let z = -21; z <= 21; z += 6) D(-36, z - 0.2, -35.9, z + 0.2, 0, y1, 'outer'); D(-36, -26, -35.85, 26, y1, y1 + 0.1, 'trim'); }
    }
  
    else if (b.c.startsWith('house') && y1 > 4) decorHouse(b);
    else if (b.c.startsWith('car')) decorCar(b);
  }
}
// 房子：每層窗戶（窗台、窗框）、一樓偶爾有門、屋簷（陶瓦色）
function decorHouse(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max, e = 0.04;
  const faces = [[2, -1, z0], [2, 1, z1], [0, -1, x0], [0, 1, x1]];
  for (const [ax, sg, pl] of faces) {
    if ((ax === 2 && (pl <= -25.9 || pl >= 25.9)) || (ax === 0 && (pl <= -35.9 || pl >= 35.9))) continue;
    const a0 = ax === 2 ? x0 : z0, a1 = ax === 2 ? x1 : z1, len = a1 - a0; if (len < 2.5) continue;
    const n = Math.max(1, Math.floor(len / 3.2)), step = len / n;
    for (let k = 0; k < n; k++) {
      const c = a0 + step * (k + 0.5);
      for (const fy of [1.6, 4.4]) {
        if (fy + 1.4 > y1 - 0.4) continue;
        const ground = fy < 2 && hash1(Math.round(c * 7 + pl * 3)) < 0.25;
        const w = ground ? 1.1 : 0.9, h0 = ground ? 0 : fy, h1 = ground ? 2.3 : fy + 1.3, col = ground ? 'door' : 'win';
        const o0 = sg > 0 ? pl : pl - e, o1 = sg > 0 ? pl + e : pl;
        if (ax === 2) { D(c - w / 2, o0, c + w / 2, o1, h0, h1, col); if (!ground) D(c - w / 2 - 0.1, sg > 0 ? pl : pl - 0.12, c + w / 2 + 0.1, sg > 0 ? pl + 0.12 : pl, h0 - 0.1, h0, 'sill'); }
        else { D(o0, c - w / 2, o1, c + w / 2, h0, h1, col); if (!ground) D(sg > 0 ? pl : pl - 0.12, c - w / 2 - 0.1, sg > 0 ? pl + 0.12 : pl, c + w / 2 + 0.1, h0 - 0.1, h0, 'sill'); }
      }
    }
  }
  D(x0 - 0.18, z0 - 0.18, x1 + 0.18, z1 + 0.18, y1, y1 + 0.22, 'roof');
  D(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, y1 - 0.5, y1 - 0.38, 'sill');
}
// 車廂：底下的轉向架（輪子）、車頂、側門的框、車身下緣的暗色
function decorCar(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max, alongZ = z1 - z0 > x1 - x0;
  const L0 = alongZ ? z0 : x0, L1 = alongZ ? z1 : x1, W0 = alongZ ? x0 : z0, W1 = alongZ ? x1 : z1;
  const box = (l0, l1, w0, w1, h0, h1, c) => (alongZ ? D(w0, l0, w1, l1, h0, h1, c) : D(l0, w0, l1, w1, h0, h1, c));
  for (const l of [L0 + 1.6, L1 - 1.6]) { box(l - 1.1, l + 1.1, W0 - 0.05, W0, 0.1, 0.75, 'dark'); box(l - 1.1, l + 1.1, W1, W1 + 0.05, 0.1, 0.75, 'dark'); }
  box(L0, L1, W0 - 0.03, W0, 0.75, 0.95, 'dark'); box(L0, L1, W1, W1 + 0.03, 0.75, 0.95, 'dark');
  box(L0 + 0.2, L1 - 0.2, W0 + 0.3, W1 - 0.3, y1, y1 + 0.12, b.c);
  const mid = (L0 + L1) / 2;
  for (const [w, o] of [[W0 - 0.04, W0], [W1, W1 + 0.04]]) { box(mid - 1.4, mid - 1.3, w, o, 1.0, 3.0, 'dark'); box(mid + 1.3, mid + 1.4, w, o, 1.0, 3.0, 'dark'); box(mid - 1.4, mid + 1.4, w, o, 2.95, 3.05, 'dark'); }
}
const DECOR = [];
function D(x0, z0, x1, z1, y0, y1, c) { DECOR.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], c }); }
function rebuildDecor() { DECOR.length = 0; decorBoxes(); MAP.decor(D); }
// 曙光倉區：管線、黃色標線、警示條
function decorDawn(D) {
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
}
// 烈日工地：樓板邊的黃黑警示條、冒出來的鋼筋、鷹架的鋼管與斜撐、塔吊、地上的標線
function decorSite(D) {
  for (let x = -8, k = 0; x < 8; x += 0.4, k++) { D(x, -6.012, Math.min(8, x + 0.4), -6, 2.72, 3, k % 2 ? 'hazard' : 'paint'); }
  for (let z = 6, k = 0; z < 13; z += 0.4, k++) { D(8, z, 8.012, Math.min(13, z + 0.4), 2.72, 3, k % 2 ? 'hazard' : 'paint'); D(3.988, z, 4, Math.min(13, z + 0.4), 2.72, 3, k % 2 ? 'hazard' : 'paint'); }
  // 鋼筋：二樓牆頂、柱頂冒出來
  for (let z = -5.5; z <= 3; z += 0.7) D(-7.88, z - 0.02, -7.84, z + 0.02, 5.2, 5.9, 'rail');
  for (let z = -3; z <= 5.5; z += 0.7) D(7.84, z - 0.02, 7.88, z + 0.02, 5.2, 5.9, 'rail');
  for (const [x, z] of [[-1, -0.5], [1, 0.5], [-1, 0.5], [1, -0.5]]) D(x - 0.02, z - 0.02, x + 0.02, z + 0.02, 3, 3.9, 'rail');
  // 鷹架：平台外側的直管、橫管、斜撐
  for (let x = 5; x <= 15; x += 2.5) { D(x - 0.04, 16.5, x + 0.04, 16.58, 0, 6, 'rail'); }
  for (const y of [1.5, 4.5, 6]) D(4.5, 16.5, 15, 16.58, y, y + 0.06, 'rail');
  for (let x = 5; x < 15; x += 2.5) for (let k = 0; k < 6; k++) { const t = k / 6; D(x + t * 2.5, 16.5, x + t * 2.5 + 0.42, 16.56, 0.1 + t * 2.5, 0.16 + t * 2.5, 'rail'); }
  // 塔吊（牆外，只是遠景）：塔身、吊臂、配重
  D(-34, 30, -32, 32, 0, 30, 'yellow'); D(-48, 30.6, 6, 31.4, 30, 31, 'yellow'); D(-46, 30.4, -40, 31.6, 28.6, 30, 'dark');
  for (let y = 1; y < 30; y += 2) D(-34.05, 29.95, -31.95, 32.05, y, y + 0.08, 'dark');
  // 地上的標線：二樓下方、B 平台邊緣
  const P = 0.008, w = 0.06;
  D(-10, -8 - w, 10, -8 + w, 0, P, 'paint'); D(-10, 8 - w, 10, 8 + w, 0, P, 'paint');
  for (let x = 18, k = 0; x < 30; x += 0.4, k++) D(x, -14.012, Math.min(30, x + 0.4), -14, 0.9, 1.2, k % 2 ? 'hazard' : 'paint');
  for (let x = -34; x <= 34; x += 3) D(x, -0.05, x + 1.5, 0.05, 0, P, 'paint');
}
// 正午舊城：鐘面、噴水池的水與中柱、攤位遮陽布（紅白條）、路燈、石板路的邊石
function decorMarket(D) {
  for (const [ax, sg] of [[0, -1], [0, 1], [2, -1], [2, 1]]) {
    const p = 3 * sg + (sg > 0 ? 0.03 : -0.03);
    if (ax === 0) { D(sg > 0 ? 3 : p, -1.2, sg > 0 ? p : -3, 1.2, 9, 11.4, 'clock'); D(sg > 0 ? 3 : p - 0.02, -0.08, sg > 0 ? p + 0.02 : -3, 0.08, 10.2, 11.1, 'win'); D(sg > 0 ? 3 : p - 0.02, -0.08, sg > 0 ? p + 0.02 : -3, 0.7, 10.12, 10.28, 'win'); }
    else { D(-1.2, sg > 0 ? 3 : p, 1.2, sg > 0 ? p : -3, 9, 11.4, 'clock'); D(-0.08, sg > 0 ? 3 : p - 0.02, 0.08, sg > 0 ? p + 0.02 : -3, 10.2, 11.1, 'win'); D(-0.08, sg > 0 ? 3 : p - 0.02, 0.7, sg > 0 ? p + 0.02 : -3, 10.12, 10.28, 'win'); }
  }
  D(-3.3, -3.3, 3.3, 3.3, 13, 13.4, 'roof'); D(-2.2, -2.2, 2.2, 2.2, 13.4, 14.6, 'roof'); D(-1, -1, 1, 1, 14.6, 15.6, 'roof');
  D(-3.2, -3.2, 3.2, 3.2, 6.5, 6.7, 'sill');
  D(20.7, 18.2, 22.3, 19.8, 0.9, 0.93, 'water'); D(21.3, 18.8, 21.7, 19.2, 0.9, 1.9, 'stone'); D(21, 18.5, 22, 19.5, 1.9, 2.05, 'stone');
  const awning = (x0, z0, x1, z1) => { const w = x1 - x0; for (let k = 0, x = x0; x < x1 - 0.01; x += 0.5, k++) D(x, z0 - 0.3, Math.min(x1, x + 0.5), z1 + 0.3, 2.2, 2.28, k % 2 ? 'awn2' : 'awn1');
    for (const x of [x0 + 0.05, x1 - 0.15]) for (const z of [z0 - 0.25, z1 + 0.15]) D(x, z, x + 0.1, z + 0.1, 0, 2.2, 'stall'); };
  awning(16, -17.2, 19, -16); awning(22, -21.2, 25, -20); awning(27, -16.2, 30, -15); awning(29.5, 19, 31, 21.5); awning(-2.2, 11.2, -0.6, 12.6);
  for (const [x, z] of [[-9, 9.2], [9.2, -9], [14, 12.3], [14, -12.3], [-24, 12.5], [-24, -12.5], [30, 11.3], [30, -11.3]]) { D(x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0, 3.6, 'win'); D(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 3.6, 3.9, 'win'); }
  const P = 0.01; for (let x = -34; x <= 34; x += 2) { D(x, 8.95, x + 0.12, 9.05, 0, P, 'sill'); D(x, -9.05, x + 0.12, -8.95, 0, P, 'sill'); }
}
// 黃昏鐵道：鐵軌與枕木、吊車橫樑、車站雨棚、月台邊黃線、電線桿
function decorRail(D) {
  const track = (x, z0, z1) => {
    D(x - 0.78, z0, x - 0.7, z1, 0, 0.16, 'rail'); D(x + 0.7, z0, x + 0.78, z1, 0, 0.16, 'rail');
    for (let z = z0 + 0.3; z < z1; z += 0.75) D(x - 1.25, z, x + 1.25, z + 0.24, 0, 0.09, 'sleeper');
  };
  track(-20, -26, 26); track(-13, -26, 26); track(12, -26, 26); track(20.5, -26, -9);
  D(19, 12.6, 31, 13.4, 7.4, 8, 'dark'); D(19, 22.6, 31, 23.4, 7.4, 8, 'dark'); D(24.6, 12.6, 25.4, 23.4, 7.6, 8.2, 'dark');
  D(24.8, 17.6, 25.2, 18, 3.5, 7.6, 'rail'); D(24.4, 17.4, 25.6, 18.2, 3.1, 3.5, 'dark');
  D(-7.5, -7.5, 7.5, 7.5, 3.6, 3.75, 'canopy');
  for (const [x, z] of [[-7.2, -7.2], [7.2, -7.2], [-7.2, 7.2], [7.2, 7.2]]) D(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 0, 3.6, 'dark');
  D(-7.5, -7.6, 7.5, -7.5, 0, 0.01, 'yellow'); D(-7.5, 7.5, 7.5, 7.6, 0, 0.01, 'yellow');
  for (const x of [-30, -10, 10, 30]) { D(x - 0.12, 19.6, x + 0.12, 19.84, 0, 7.5, 'sleeper'); D(x - 1, 19.6, x + 1, 19.8, 7.1, 7.25, 'sleeper'); }
  for (const x of [-30, -10, 10, 30]) { D(x - 0.12, -19.84, x + 0.12, -19.6, 0, 7.5, 'sleeper'); D(x - 1, -19.8, x + 1, -19.6, 7.1, 7.25, 'sleeper'); }
  D(-36, 19.7, 36, 19.74, 6.9, 6.94, 'dark'); D(-36, -19.74, 36, -19.7, 6.9, 6.94, 'dark');
  // 月台邊緣（南邊房子前）與倉庫的大門
  D(-36, -21.1, 6, -21, 0, 0.01, 'yellow');
  for (const x of [-28, -16, -4]) D(x - 2, 20.95, x + 2, 21, 0, 4.2, 'dark');
}
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
// 貼圖只在第一次用到時才畫（換地圖時沿用）
const TEX_CACHE = {};
function getTex(name, aniso) {
  if (!TEX_CACHE[name]) { const T = buildTextures(aniso, name); TEX_CACHE[name] = T[name]; }
  return TEX_CACHE[name];
}
function buildTextures(aniso, only) {
  const T = {};
  const want = (k) => !only || only === k;
  // 混凝土（4 公尺一張）：明暗起伏、小斑點、水漬、模板螺栓孔、2 公尺一道施工縫
  if (want('concrete')) { const S = 512, n = fbm(S, 11), st = fbm(S, 23, 2, 3);
    T.concrete = makeTex(S, S, (x, y, i) => {
      let v = 0.86 + (n[i] - 0.5) * 0.3;
      if (st[i] > 0.6) v -= (st[i] - 0.6) * 0.5;
      if (hash1(i * 7 + 3) < 0.035) v -= 0.12;
      const hx = (x % 128) - 64, hy = (y % 128) - 64; if (hx * hx + hy * hy < 14) v -= 0.3;
      if (y % 256 < 3) v -= 0.12;
      return g3(v);
    }, aniso); }
  // 磚牆（2 公尺一張）：每塊磚色差、灰縫、半塊錯開
  if (want('brick')) { const S = 256, n = fbm(S, 31, 8, 4), rows = 24, bw = 32;
    T.brick = makeTex(S, S, (x, y, i) => {
      const r = Math.floor(y / (S / rows)), yy = y - r * (S / rows), off = (r % 2) * bw / 2, bx = Math.floor((x + off) / bw), xx = (x + off) % bw;
      const mortar = yy < 2 || xx < 2;
      const k = hash1(r * 131 + ((bx % (S / bw)) + S / bw) % (S / bw));
      let v = mortar ? 0.62 + n[i] * 0.1 : 0.9 + (k - 0.5) * 0.2 + (n[i] - 0.5) * 0.18;
      if (!mortar && (yy < 3 || xx < 3)) v -= 0.06;
      return mortar ? [v * 1.05, v * 1.0, v * 0.95] : g3(v);
    }, aniso); }
  // 地面（4 公尺一張）：淡淡的起伏、2 公尺伸縮縫、油漬
  if (want('floor')) { const S = 512, n = fbm(S, 41, 4, 5), oil = fbm(S, 53, 2, 3), spot = fbm(S, 59, 8, 3);
    T.floor = makeTex(S, S, (x, y, i) => {
      let v = 0.88 + (n[i] - 0.5) * 0.22;
      if (oil[i] > 0.7) v -= (oil[i] - 0.7) * 0.45;
      if (spot[i] > 0.68) v -= (spot[i] - 0.68) * 0.6;
      if (x % 256 < 2 || y % 256 < 2) v -= 0.16;
      if (hash1(i * 13 + 5) < 0.02) v -= 0.08;
      return g3(v);
    }, aniso); }
  // 貨櫃浪板（橫向 2.4 公尺、縱向 2.6 公尺）：凹凸明暗、從上往下的鏽痕、掉漆
  if (want('container')) { const W2 = 256, H2 = 256, n = fbm(W2, 61, 4, 4), streak = tileNoise(W2, 32, 71), chip = fbm(W2, 83, 4, 4);
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
  if (want('wood')) { const S = 256, n = fbm(S, 91, 4, 4), grain = tileNoise(S, 32, 97);
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
  if (want('metal')) { const S = 256, n = fbm(S, 101, 4, 5);
    T.metal = makeTex(S, S, (x, y, i) => {
      const rib = 0.5 + 0.5 * Math.sin(x / S * 16 * Math.PI * 2);
      const v = 0.8 + (rib - 0.5) * 0.22 + (n[i] - 0.5) * 0.26 - (y / S) * 0.06;
      return g3(v);
    }, aniso); }
  // 灰泥牆（4 公尺一張）：大片柔和的色斑、雨水痕、少數裂紋與剝落
  if (want('plaster')) { const S = 256, n = fbm(S, 131, 3, 5), st = tileNoise(S, 24, 137), cr = fbm(S, 139, 8, 3);
    T.plaster = makeTex(S, S, (x, y, i) => {
      let v = 0.9 + (n[i] - 0.5) * 0.16;
      v -= Math.max(0, st[Math.floor(y / 4) * S + x] - 0.6) * 0.25 * (y / S);
      if (cr[i] > 0.72) v -= (cr[i] - 0.72) * 0.9;
      if (hash1(i * 5 + 1) < 0.02) v -= 0.05;
      return g3(v);
    }, aniso); }
  // 石板路（2 公尺一張）：不規則大小的石塊、深色縫、每塊明暗不同
  if (want('cobble')) { const S = 256, n = fbm(S, 151, 8, 4), cols = 8, rows = 10;
    T.cobble = makeTex(S, S, (x, y, i) => {
      const r = Math.floor(y / (S / rows)), off = (r % 2) * (S / cols) * 0.5, c = Math.floor(((x + off) % S) / (S / cols));
      const yy = y % (S / rows), xx = (x + off) % (S / cols);
      const edge = Math.min(yy, S / rows - yy, xx, S / cols - xx);
      const k = hash1(r * 97 + c * 13);
      let v = 0.82 + (k - 0.5) * 0.24 + (n[i] - 0.5) * 0.14;
      if (edge < 2.5) v = 0.42 + n[i] * 0.1; else if (edge < 5) v -= (5 - edge) * 0.05;
      return [v * 1.02, v, v * 0.95];
    }, aniso); }
  // 碎石（2 公尺一張）：細碎的亮暗顆粒
  if (want('gravel')) { const S = 256, n = fbm(S, 171, 16, 3), m = fbm(S, 173, 4, 3);
    T.gravel = makeTex(S, S, (x, y, i) => {
      const g = hash1(i * 3 + 7);
      let v = 0.8 + (n[i] - 0.5) * 0.42 + (g - 0.5) * 0.22 + (m[i] - 0.5) * 0.1;
      return [v * 1.03, v, v * 0.96];
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

// ---------- 光照貼圖：每個方塊面在一張圖集裡有一塊，每格算日照與環境光遮蔽（取代以前把面切細、存在頂點上） ----------
// 密度依地圖大小自動調（每公尺約 3–5 格，總共約 14 萬格）；邊緣多留一圈避免取樣滲色；圖集用線性內插，影子邊比頂點版銳利。
const LM = { tex: null, size: [0, 0], density: 0, texels: 0, ms: 0 };
function bakeTexel(px, py, pz, n, tu, tv) {
  const ox = px + n[0] * 0.03, oy = py + n[1] * 0.03, oz = pz + n[2] * 0.03;
  let sun = 0;
  const nd = n[0] * SUN_DIR.x + n[1] * SUN_DIR.y + n[2] * SUN_DIR.z;
  if (nd > 0.01) {
    const len = Math.min(70, Math.max(1, (7 - oy) / SUN_DIR.y));
    for (let k = 0; k < 2; k++) {   // 兩條略錯開的射線：影子邊只有一點點柔
      const j = SUN_JIT[k * 2]; let dx = SUN_DIR.x + j[0] * SUN_DIR.z, dy = SUN_DIR.y + j[1], dz = SUN_DIR.z - j[0] * SUN_DIR.x;
      const l = Math.hypot(dx, dy, dz); if (bakeRay(ox, oy, oz, dx / l, dy / l, dz / l, len) < 0) sun += 0.5;
    }
  }
  let occ = 0, tot = 0;
  for (let k = 0; k < AO_DIRS.length; k += 2) {   // 環境光遮蔽：一半的方向就夠（之後還會模糊）
    const d = AO_DIRS[k], dx = tu[0] * d[0] + tv[0] * d[1] + n[0] * d[2], dy = tu[1] * d[0] + tv[1] * d[1] + n[1] * d[2], dz = tu[2] * d[0] + tv[2] * d[1] + n[2] * d[2];
    const t = bakeRay(ox, oy, oz, dx, dy, dz, 1.4);
    if (t >= 0) occ += d[3] * (1 - t / 1.4) * (1 - t / 1.4) + d[3] * 0.25;
    tot += d[3] * 1.25;
  }
  return [sun, clamp(1 - occ / tot * 1.5, 0.15, 1)];
}
// 把每個面放進圖集（依高度排成一列一列），回傳每個面的位置
function packFaces(faces, density) {
  const W = 1024; let x = 0, y = 0, rowH = 0;
  const order = faces.map((f, i) => i).sort((a, b) => faces[b].th - faces[a].th);
  for (const i of order) {
    const f = faces[i]; f.tw = Math.max(1, Math.round(f.lu * density)); f.th = Math.max(1, Math.round(f.lv * density));
    const w = f.tw + 2, h = f.th + 2;
    if (x + w > W) { x = 0; y += rowH; rowH = 0; }
    f.ax0 = x; f.ay0 = y; x += w; rowH = Math.max(rowH, h);
  }
  return [W, y + rowH];
}
function bakeLightmap(faces) {
  const t0 = performance.now();
  let area = 0; for (const f of faces) area += f.lu * f.lv;
  let density = clamp(Math.sqrt(140000 / Math.max(1, area)), 2.5, 5);
  for (const f of faces) f.th = Math.max(1, Math.round(f.lv * density));
  let [W, H] = packFaces(faces, density);
  while (H > 1024 && density > 1.5) { density *= 0.9; for (const f of faces) f.th = Math.max(1, Math.round(f.lv * density)); [W, H] = packFaces(faces, density); }
  H = Math.min(1024, 1 << Math.ceil(Math.log2(Math.max(H, 1))));
  const data = new Uint8Array(W * H * 4), tmp = [];
  let texels = 0;
  for (const f of faces) {
    const { b, ax, ua, va, n, tu, tv, plane, lu, lv, tw, th } = f;
    // 先算這個面自己的格子，再輕輕模糊環境光遮蔽（3×3），最後寫進圖集（外圍一圈複製邊緣）
    tmp.length = 0;
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const p = [0, 0, 0]; p[ax] = plane; p[ua] = b.min[ua] + lu * (i + 0.5) / tw; p[va] = b.min[va] + lv * (j + 0.5) / th;
      tmp.push(bakeTexel(p[0], p[1], p[2], n, tu, tv)); texels++;
    }
    const at = (i, j) => tmp[clamp(j, 0, th - 1) * tw + clamp(i, 0, tw - 1)];
    for (let j = -1; j <= th; j++) for (let i = -1; i <= tw; i++) {
      const c = at(i, j); let ao = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) ao += at(i + di, j + dj)[1];
      const o = ((f.ay0 + 1 + j) * W + (f.ax0 + 1 + i)) * 4;
      data[o] = Math.round(c[0] * 255); data[o + 1] = Math.round(ao / 9 * 255); data[o + 2] = 0; data[o + 3] = 255;
    }
  }
  if (LM.tex) LM.tex.dispose();
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
  const fl = faces.find((f) => f.b === BOXES[0] && f.ax === 1);   // 地板那一面（測試用）
  Object.assign(LM, { data, floor: fl && { ax0: fl.ax0, ay0: fl.ay0, tw: fl.tw, th: fl.th, x0: fl.b.min[0], z0: fl.b.min[2], lu: fl.lu, lv: fl.lv }, tex, size: [W, H], density: +density.toFixed(2), texels, ms: Math.round(performance.now() - t0) });
  MAP_UNI.uLM.value = tex;
  return [W, H];
}

// ---------- 建地圖網格：依材質分組，每組一次繪製 ----------
const MAP_UNI = { uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, uLM: { value: null } };
function patchMapMaterial(mat, wear, grime, chip = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = MAP_UNI.uFlash; sh.uniforms.uLM = MAP_UNI.uLM;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLight; attribute vec2 aLm; attribute vec3 aLocal; attribute vec3 aSize;\nvarying vec2 vLight; varying vec2 vLm; varying vec3 vWp; varying vec3 vN0; varying vec3 vLoc; varying vec3 vSz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLight = aLight; vLm = aLm; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vN0 = normal; vLoc = aLocal; vSz = aSize;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uFlash; uniform sampler2D uLM;\nvarying vec2 vLight; varying vec2 vLm; varying vec3 vWp; varying vec3 vN0; varying vec3 vLoc; varying vec3 vSz;')
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
        vec2 L = vLm.x < 0.0 ? vLight : texture2D(uLM, vLm).rg;   // 方塊用光照貼圖，裝飾用頂點上的值
        reflectedLight.directDiffuse *= L.x;
        reflectedLight.indirectDiffuse *= mix(0.42, 1.0, L.y);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.08, 0.05, 0.03) * (1.0 - smoothstep(0.0, 2.0, vWp.y));
        { float fd = distance(vWp, uFlash.xyz);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.7, 0.4) * uFlash.w * 2.2 / (1.0 + fd * fd * 0.5); }`);
  };
  mat.customProgramCacheKey = () => 'map' + wear + '_' + grime + (chip ? 'c' : '');
}
function buildMapMeshes(aniso) {
  const t0 = performance.now();
  const used = new Set(BOXES.concat(DECOR).map((b) => MAT_OF[b.c] || 'concrete'));
  const tex = {}; for (const m of used) tex[m] = getTex(m, aniso);
  const t1 = performance.now();
  bakeIndex();
  const groups = {};
  const G = (m) => groups[m] || (groups[m] = { P: [], N: [], C: [], U: [], L: [], M: [], O: [], Z: [], I: [] });
  const lmFaces = [];   // 方塊的面：先收集，烘好光照貼圖再算貼圖座標
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
      if (b === BOXES[0] && ax !== 1) continue;
      const plane = sg > 0 ? b.max[ax] : b.min[ax];
      const lu = size[ua], lv = size[va];
      const nu = 1, nv = 1;   // 一個面兩個三角形（光影在光照貼圖裡）
      const n = [0, 0, 0]; n[ax] = sg;
      const tu = [0, 0, 0]; tu[ua] = 1; const tv = [0, 0, 0]; tv[va] = 1;
      const start = g.P.length / 3;
      let faceL = null;
      if (decor) { const c = [0, 0, 0]; c[ax] = plane; c[ua] = b.min[ua] + lu / 2; c[va] = b.min[va] + lv / 2; faceL = bakeVertex(c[0], c[1], c[2], n, tu, tv); }
      else lmFaces.push({ b, ax, ua, va, n, tu, tv, plane, lu, lv, g, start });
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const p = [0, 0, 0]; p[ax] = plane; p[ua] = b.min[ua] + lu * i / nu; p[va] = b.min[va] + lv * j / nv;
        g.P.push(p[0], p[1], p[2]); g.N.push(n[0], n[1], n[2]);
        col.copy(base).multiplyScalar(tint); g.C.push(col.r, col.g, col.b);
        // UV：木箱用方塊自己的座標（每面一張），其它用世界座標
        let u, v;
        if (mat === 'wood') { u = (p[ua] - b.min[ua]) / lu; v = (p[va] - b.min[va]) / lv; }
        else {
          const scale = mat === 'brick' ? 0.5 : mat === 'container' ? (ax === 1 ? 1 / 2.4 : 1 / 2.4) : mat === 'metal' || mat === 'cobble' || mat === 'gravel' ? 0.5 : 0.25;
          const hu = ax === 0 ? p[2] : p[0], hv = ax === 1 ? p[2] : p[1];
          u = hu * scale * (ax === 0 && sg > 0 || ax === 2 && sg < 0 ? -1 : 1); v = mat === 'container' && ax !== 1 ? (p[1] - b.min[1]) / 2.6 : hv * scale;
        }
        g.U.push(u, v);
        g.L.push(...(faceL || [1, 1])); g.M.push(-1, -1);
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
  // 烘光照貼圖，填每個方塊面四個角的貼圖座標
  const [LW, LH] = bakeLightmap(lmFaces);
  for (const f of lmFaces) {
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) {
      const k = (f.start + j * 2 + i) * 2;
      f.g.M[k] = (f.ax0 + 1 + i * f.tw) / LW; f.g.M[k + 1] = (f.ay0 + 1 + j * f.th) / LH;
    }
  }
  const SETTINGS = { concrete: [0.5, 0.25], brick: [0.35, 0.3], floor: [0.0, 0.0], container: [0.9, 0.2], wood: [0.7, 0.2], metal: [0.6, 0.25], plaster: [0.35, 0.4], cobble: [0, 0], gravel: [0, 0] };
  const meshes = [];
  for (const [m, g] of Object.entries(groups)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.C, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.U, 2));
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(g.L, 2));
    geo.setAttribute('aLm', new THREE.Float32BufferAttribute(g.M, 2));
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

// ---------- 遠景：牆外的剪影（工業區、舊城屋頂與山、城市高樓與電塔），不再像關在盒子裡 ----------
function buildSkyline(style, topC, botC) {
  const P = [], C = [], I = []; const c = new THREE.Color(), top = new THREE.Color(topC || '#a7a2ad'), bot = new THREE.Color(botC || '#6b6772');
  const box = (x0, z0, x1, z1, h, y0 = 0, tx = 0) => {
    const s = P.length / 3;
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0 + tx, h, z0 + tx], [x1 - tx, h, z0 + tx], [x1 - tx, h, z1 - tx], [x0 + tx, h, z1 - tx]];
    for (const p of v) { P.push(...p); c.copy(bot).lerp(top, clamp((p[1] - y0) / 30, 0, 1)); C.push(c.r, c.g, c.b); }
    for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]) I.push(s + f[0], s + f[2], s + f[1], s + f[0], s + f[3], s + f[2]);
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ring = (n, r0, r1, fn) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rnd() * 0.08, r = r0 + rnd() * (r1 - r0); fn(Math.cos(a) * r * 1.25, Math.sin(a) * r); } };
  if (style === 'town') {
    // 舊城：一圈高低錯落的屋子（屋頂收窄像斜屋頂）、兩座鐘塔、遠山
    ring(60, 60, 110, (x, z) => { const w = 6 + rnd() * 9, d = 6 + rnd() * 9, h = 6 + rnd() * 9; box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h); box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h + 2.5, h, Math.min(w, d) * 0.45); });
    for (const [x, z] of [[-90, 55], [70, -80]]) { box(x - 3, z - 3, x + 3, z + 3, 26); box(x - 3, z - 3, x + 3, z + 3, 34, 26, 2.8); }
    ring(14, 220, 260, (x, z) => { const w = 90 + rnd() * 60; box(x - w / 2, z - w / 3, x + w / 2, z + w / 3, 25 + rnd() * 30, 0, w * 0.3); });
  } else if (style === 'rail') {
    // 鐵道：遠處的高樓、電塔、一座高架橋
    ring(40, 80, 150, (x, z) => { const w = 8 + rnd() * 14, h = 15 + rnd() * 45; box(x - w / 2, z - w / 2, x + w / 2, z + w / 2, h); });
    for (let k = 0; k < 6; k++) { const x = -120 + k * 48, z = 90; box(x - 0.8, z - 0.8, x + 0.8, z + 0.8, 34, 0, 0.6); box(x - 6, z - 0.3, x + 6, z + 0.3, 30, 29.4); }
    box(-160, -95, 160, -88, 14, 12); for (let x = -150; x <= 150; x += 25) box(x - 1.2, -93, x + 1.2, -90, 12);
  } else {
    for (let k = 0; k < 46; k++) {
      const a = k / 46 * Math.PI * 2 + rnd() * 0.08, r = 70 + rnd() * 70, x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r;
      const w = 8 + rnd() * 18, d = 8 + rnd() * 14, h = 7 + rnd() * 20;
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h);
      if (rnd() < 0.25) box(x - 1, z - 1, x + 1, z + 1, h + 14 + rnd() * 16);     // 煙囪
    }
    // 兩座龍門吊
    for (const [x, z] of [[-60, 70], [75, -66]]) { box(x - 9, z - 1, x - 7.5, z + 1, 32); box(x + 7.5, z - 1, x + 9, z + 1, 32); box(x - 12, z - 1.2, x + 22, z + 1.2, 34, 30); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// 天空：反面的大球，頂點顏色畫破曉漸層；太陽一張發光的圓（不受色調映射影響，照原色）
function buildSky(th) {
  const g = new THREE.SphereGeometry(400, 48, 24);
  const pos = g.attributes.position, cols = [], k = th || MAP.theme.sky;
  const zen = new THREE.Color(k.zen), mid = new THREE.Color(k.mid), hor = new THREE.Color(k.hor), low = new THREE.Color(k.low);
  const warm = new THREE.Color(k.warm), c = new THREE.Color();
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
