/* ===== 20-map：地圖資料——三張原創地圖，全部 74×54 公尺、用方塊拼。攻方在西、守方在東，東北包點 A、東南包點 B。
   座標：x 東西（東為正）、z 南北（北為正）、y 往上，單位公尺。
   每張地圖：build() 擺方塊（會擋人、擋子彈）、decor(D) 擺裝飾（只畫不擋）、theme 光線與天色、出生點、包點資料（給機器人用）。
   包點資料：stage 攻方集合點、plants 裝彈點、holds 守方守點 [x, z, 看向 x, 看向 z]、smokes 攻方丟煙的位置、post 攻方占點後站的位置。 */
const COLORS = {
  floor: '#7c8189', outer: '#6c6862', wall: '#bab3a5', pillar: '#8f8a82', low: '#a7a194', shed: '#8c979c',
  rust: '#a65a3d', teal: '#3d7880', olive: '#7a7a42', crate: '#b3884f', dock: '#9b988e', lintel: '#a49d90',
};
const BOXES = [];   // { min:[x,y,z], max:[x,y,z], c:顏色 }
function B(x0, z0, x1, z1, y0, y1, c) { BOXES.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], c }); }
function crate(x, z, n = 1, s = 0.9) { for (let i = 0; i < n; i++) B(x - s / 2, z - s / 2, x + s / 2, z + s / 2, i * s, (i + 1) * s, 'crate'); }
function perimeter(h, c) { B(-37, 26, 37, 27, 0, h, c); B(-37, -27, 37, -26, 0, h, c); B(-37, -26, -36, 26, 0, h, c); B(36, -26, 37, 26, 0, h, c); }
const STD_SPAWN = {
  atk: [[-32.5, 0], [-32.5, -2.2], [-32.5, 2.2], [-30.5, -6], [-30.5, 6]],
  def: [[32.5, 0], [32.5, -2.2], [32.5, 2.2], [30.5, -6.5], [31.5, 6.8]],
};
const MAPS = {
  // ---------- 1. 曙光倉區：破曉的貨櫃倉庫區 ----------
  dawn: {
    id: 'dawn', name: '曙光倉區', sub: '破曉・倉庫與貨櫃場', floor: 'floor',
    theme: { sun: [0.82, 0.22, 0.28], sunColor: '#ffc792', sunI: 2.5, hemi: ['#c4d0ea', '#8a6e56', 1.45], fog: ['#d9c2b0', 45, 190], exposure: 1.0,
      sky: { zen: '#3f6fa6', mid: '#a9bad6', hor: '#ffc79a', low: '#6b6168', warm: '#ffdba8' }, skyline: 'industrial', skyTop: '#a7a2ad', skyBot: '#6b6772', amb: 'harbor' },
    build() {
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

  // 南邊通道中間的貨櫃：擋住兩邊出生點直接對看（兩側各留 2 公尺通道）
  B(-3, -11.4, 3, -9, 0, 2.6, 'olive');
  B(-2.5, 8.8, 1.5, 10.6, 0, 2.6, 'rust');   // 倉庫北邊也一樣
  // 包點 A（東北貨櫃場）：矮牆、木箱堆當掩體
  B(19.5, 21.6, 23, 22.2, 0, 1.1, 'low'); crate(25.6, 18.6, 2); crate(26.5, 18.6); crate(17.2, 23.8); crate(23.6, 24.6, 2);
  // 包點 B（南邊卸貨平台前）：木箱堆、矮牆
  crate(21.2, -16.6, 2); crate(22.1, -16.6); B(14.6, -17.6, 15.2, -15.2, 0, 1.1, 'low'); crate(25.2, -14.9);
  // 兩邊出生點前的矮牆
  B(-29, 3, -27, 3.6, 0, 1.1, 'low'); B(-29, -3.6, -27, -3, 0, 1.1, 'low'); crate(-24, 0);
  B(27, -3.6, 29, -3, 0, 1.1, 'low'); B(27, 3, 29, 3.6, 0, 1.1, 'low'); crate(24, 0);
},
    decor: decorDawn,
    playerSpawns: [[-32, 0], [-32, -8], [-32, 8]], botSpawns: [[32, 0], [32, -8], [32, 8], [31, 18], [33, -20], [22, 23]],
    spawn: STD_SPAWN,
    sites: {
      A: { x0: 14, x1: 27.5, z0: 16.5, z1: 25.8, cx: 21, cz: 20.5, mark: [19.5, 19], stage: [2, 13], plants: [[20.8, 20.3], [24.6, 22.8], [17.8, 21.6]],
        holds: [[24.6, 23.2, 10, 20], [27.2, 16.6, 22, 6], [18.2, 24.6, 10, 20], [22.4, 12.2, 16, 4], [25.2, 20.4, 10, 20]],
        smokes: [[28.8, 13.5], [22, 11.5]], post: [[12, 22], [16, 17.5], [21, 18], [24, 21]] },
      B: { x0: 11, x1: 27, z0: -19, z1: -14.2, cx: 19, cz: -16.6, mark: [15.8, -16], stage: [-5, -10], plants: [[18.6, -17.6], [23.6, -17.4], [13, -17]],
        holds: [[23.4, -15.2, 6, -16.5], [19, -21, 6, -16.5], [16.2, -16.4, 6, -16.5], [18.4, -11, 16, -6], [27.5, -12.5, 16, -6]],   // 第二個在卸貨平台上（俯瞰包點 B）
        smokes: [[26.5, -11.5], [17, -10.2]], post: [[12, -15.5], [17, -18], [22, -18.2], [20, -14.8]] },
    },
  },
  // ---------- 2. 正午舊城：石板路的老市集、鐘樓廣場 ----------
  market: {
    id: 'market', name: '正午舊城', sub: '正午・石板街、鐘樓、市集', floor: 'cobble', defEdge: 0.85,
    theme: { sun: [0.38, 0.82, 0.42], sunColor: '#fff1d6', sunI: 2.3, hemi: ['#cfe0f5', '#9c8466', 1.35], fog: ['#dfe6ee', 60, 220], exposure: 0.95,
      sky: { zen: '#2f6fc0', mid: '#8fb7e6', hor: '#d9e6f2', low: '#8a8478', warm: '#fff4dc' }, skyline: 'town', skyTop: '#b9b2a6', skyBot: '#8b8378', amb: 'town' },
    build() {
      perimeter(6, 'house');
      // 西邊：攻方出生廣場兩側的房子
      B(-36, -26, -10, -17, 0, 6, 'house2'); B(-26, -11, -10, -5, 0, 7, 'house'); B(-26, 5, -10, 11, 0, 7, 'house3'); B(-36, 17, -12, 26, 0, 6, 'house'); B(-12, 17, -6, 26, 0, 5, 'house2');
      // 中央鐘樓廣場
      B(-3, -3, 3, 3, 0, 13, 'stone');
      B(-8.5, 6.5, -6.5, 7.5, 0, 0.8, 'stone'); B(6.5, -7.5, 8.5, -6.5, 0, 0.8, 'stone');      // 花台
      crate(-7.5, -7.5, 2); crate(7.5, 7.5);
      // 北、南中間的房子
      B(-6, 15, 6, 26, 0, 6, 'house2'); B(6, 18, 14, 26, 0, 5, 'house');
      B(-6, -26, 6, -14, 0, 6, 'house3'); B(6, -26, 12, -18, 0, 5, 'house2');
      // 東邊：廣場通往守方的長巷兩側
      B(10, 3, 27, 11, 0, 7, 'house3'); B(10, -11, 27, -3, 0, 7, 'house');
      // 南街中間的推車、北街的木箱（擋住長直線）
      crate(-1, -11.5, 2); crate(-0.1, -11.5); B(-2.2, 11.2, -0.6, 12.6, 0, 1.1, 'stall');
      // 包點入口的小攤亭：把寬入口分成兩條路，守方比較好守
      B(8.6, 12.6, 11.4, 15.4, 0, 3, 'house2'); B(7.6, -16.4, 10.4, -14, 0, 3, 'house3');
      // 包點 A：噴水池廣場
      B(20.5, 18, 22.5, 20, 0, 0.9, 'stone'); B(16.5, 13.8, 19, 14.8, 0, 0.8, 'stone'); B(24, 15.8, 28, 16.4, 0, 1.1, 'stone');
      crate(26.2, 22.2, 2); crate(27.1, 22.2); crate(17.2, 23.6); B(29.5, 19, 31, 21.5, 0, 1.0, 'stall');
      // 包點 B：市集攤位
      B(16, -17.2, 19, -16, 0, 1.0, 'stall'); B(22, -21.2, 25, -20, 0, 1.0, 'stall'); B(27, -16.2, 30, -15, 0, 1.0, 'stall');
      crate(20.2, -14.4, 2); crate(31.2, -23.2, 2); crate(30.3, -23.2); B(14, -22.5, 14.6, -19, 0, 1.1, 'stone');
      // 守方出生點前的矮牆
      B(27.5, -3.6, 29.5, -3, 0, 1.1, 'stone'); B(27.5, 3, 29.5, 3.6, 0, 1.1, 'stone');
      B(-29, 3, -27, 3.6, 0, 1.1, 'stone'); B(-29, -3.6, -27, -3, 0, 1.1, 'stone');
    },
    decor: decorMarket,
    playerSpawns: [[-32, 0], [-32, -8], [-32, 8]], botSpawns: [[32, 0], [32, -8], [32, 8], [24, 22], [24, -22], [0, -9]],
    spawn: STD_SPAWN,
    sites: {
      A: { x0: 15, x1: 32, z0: 12.5, z1: 25.5, cx: 22, cz: 19.5, mark: [18.2, 20.6], stage: [-3, 12.5], plants: [[22, 21.5], [25, 19.5], [18.5, 17]],
        holds: [[22.8, 21.6, 10, 14], [27.8, 24, 10, 14], [18, 24.6, 10, 14], [29.5, 14, 30, 0], [25.6, 17.6, 10, 14]],
        smokes: [[31, 11.5], [12, 13.5]], post: [[16.5, 16.5], [20, 22.5], [25.5, 18.5], [28.5, 23.5]] },
      B: { x0: 13, x1: 33, z0: -25.5, z1: -12.5, cx: 22, cz: -18.5, mark: [26.5, -23.6], stage: [-3, -11.5], plants: [[20.5, -19], [25.5, -17.5], [17.5, -22.5]],
        holds: [[21, -18.5, 9, -14.5], [29, -21.8, 9, -14.5], [17.2, -24, 9, -14.5], [30.5, -13.5, 30, 0], [24.5, -14.6, 9, -14.5]],
        smokes: [[31, -11.5], [11, -14]], post: [[16, -14.8], [20.5, -18.8], [26, -18.5], [28.8, -23.5]] },
    },
  },
  // ---------- 3. 黃昏鐵道：調車場、月台、吊車 ----------
  rail: {
    id: 'rail', name: '黃昏鐵道', sub: '黃昏・調車場與月台', floor: 'gravel', defEdge: 0.68,
    theme: { sun: [-0.84, 0.3, -0.34], sunColor: '#ffa468', sunI: 2.9, hemi: ['#a99fd0', '#8a6a56', 1.75], fog: ['#b98f8a', 55, 230], exposure: 1.12,
      sky: { zen: '#2b2f6a', mid: '#8a6fa8', hor: '#ff9a6a', low: '#4a3a44', warm: '#ffb070' }, skyline: 'rail', skyTop: '#5d5068', skyBot: '#3a3142', amb: 'rail' },
    build() {
      perimeter(4, 'outer');
      // 北邊倉庫、南邊月台（實心）
      B(-36, 21, 8, 26, 0, 6.5, 'shed'); B(-36, -26, 6, -21, 0, 4.5, 'wall');
      // 中央車站
      B(-5, -5, 5, 5, 0, 7, 'wall'); B(-6.5, -6.5, -5, -5, 0, 7, 'pillar'); B(5, 5, 6.5, 6.5, 0, 7, 'pillar');
      // 西邊兩條軌道上的車廂（縫隙錯開，東西向看不穿）
      B(-21.5, -24, -18.5, -12, 0, 3.4, 'car1'); B(-21.5, -6, -18.5, 8, 0, 3.4, 'car2'); B(-21.5, 14, -18.5, 21, 0, 3.4, 'car3');
      B(-14.5, -18, -11.5, -4, 0, 3.4, 'car3'); B(-14.5, 4, -11.5, 18, 0, 3.4, 'car1');
      // 東邊一條軌道：南北兩節當包點的西牆，中間一節
      B(10.5, -24, 13.5, -13, 0, 3.4, 'car2'); B(10.5, -3, 13.5, 5, 0, 3.4, 'car1'); B(10.5, 14, 13.5, 24, 0, 3.4, 'car3');
      // 包點 A：吊車區（四根腳、貨櫃、木箱）
      for (const [x, z] of [[19, 13], [19, 23], [31, 13], [31, 23]]) B(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, 8, 'dark');
      B(23, 17.6, 28, 20, 0, 2.6, 'teal'); crate(21, 15.5, 2); crate(21.9, 15.5); crate(28.5, 22.5); B(16, 19, 17.2, 21.5, 0, 1.1, 'low');
      // 包點 B：號誌房、停著的機車
      B(26, -24.5, 32, -19, 0, 4, 'wall'); B(19, -22, 22, -13, 0, 3.4, 'car2'); crate(25, -15, 2); crate(25.9, -15); B(29, -15.5, 31.5, -14.9, 0, 1.1, 'low');
      // 穿過車廂縫之後的貨櫃：擋住從中間轉點過來的守方（不然入口是交叉火網）
      B(15.5, -9, 18.5, -6.6, 0, 2.6, 'olive'); B(15.5, 6.6, 18.5, 9, 0, 2.6, 'rust');
      // 中間空地的掩體、兩邊出生點
      crate(8, 8, 2); crate(8, -8); B(17, -1.5, 18, 1.5, 0, 1.2, 'low'); B(-28, 3, -26, 3.6, 0, 1.1, 'low'); B(-28, -3.6, -26, -3, 0, 1.1, 'low');
      B(27.5, -3.6, 29.5, -3, 0, 1.1, 'low'); B(27.5, 3, 29.5, 3.6, 0, 1.1, 'low'); crate(-24, -10); crate(-24, 11, 2);
      // 北路、南路上的電箱（擋住東西向長直線）
      B(-4, 15, -2.6, 16.4, 0, 2, 'dark'); B(0, -16.4, 1.4, -15, 0, 2, 'dark');
    },
    decor: decorRail,
    playerSpawns: [[-32, 0], [-32, -8], [-32, 8]], botSpawns: [[32, 0], [32, -8], [32, 8], [25, 22], [24, -17], [0, 12]],
    spawn: STD_SPAWN,
    sites: {
      A: { x0: 15, x1: 33, z0: 10, z1: 25.5, cx: 24, cz: 17, mark: [22, 20.5], stage: [-2, 13], plants: [[24, 15.8], [25.5, 21.6], [18, 17]],
        holds: [[29.6, 18.8, 8, 9], [26.5, 23.6, 8, 9], [20, 16.6, 8, 9], [32, 10.5, 30, 0], [22.5, 21, 8, 9]],
        smokes: [[30, 9], [8, 9.5]], post: [[16.5, 14], [22.5, 21], [27.5, 16], [30, 22]] },
      B: { x0: 15, x1: 33, z0: -25.5, z1: -10, cx: 25, cz: -17, mark: [16.6, -15], stage: [-2, -14], plants: [[24, -18], [17, -18], [28.5, -12.5]],
        holds: [[23.2, -17.4, 8, -8], [30.5, -17, 8, -8], [17, -24, 8, -8], [32, -10.5, 30, 0], [26.5, -13.5, 8, -8]],
        smokes: [[30, -9], [8, -9]], post: [[16.5, -12.5], [23.5, -19], [27.5, -14], [17, -23.5]] },
    },
  },
  // ---------- 4. 烈日工地：蓋到一半的兩層樓、天橋、鷹架平台、墊高的 B 點 ----------
  site: {
    id: 'site', name: '烈日工地', sub: '午後・兩層樓、天橋與鷹架', floor: 'floor', defEdge: 1.3, koth: [0, -10],
    theme: { sun: [0.45, 0.7, -0.35], sunColor: '#fff0d6', sunI: 2.6, hemi: ['#cfdff0', '#9a8a70', 1.5], fog: ['#d6d2c6', 60, 230], exposure: 1.0,
      sky: { zen: '#3a76c0', mid: '#9cc0e6', hor: '#ebe4d4', low: '#8a8478', warm: '#fff2cc' }, skyline: 'rail', skyTop: '#b4b9c2', skyBot: '#7a7e86', amb: 'harbor' },
    build() {
      perimeter(5, 'outer');
      // 中央：蓋到一半的兩層樓（二樓樓板高 3 公尺，一樓四面牆有門，中間一根大柱擋直線）
      B(-8, -6, 8, 6, 2.7, 3.0, 'dock');
      B(-8, -6, -7.4, -1.5, 0, 2.7, 'wall'); B(-8, 1.5, -7.4, 6, 0, 2.7, 'wall');
      B(7.4, -6, 8, 1.5, 0, 2.7, 'wall'); B(7.4, 4.5, 8, 6, 0, 2.7, 'wall');
      B(-7.4, -6, 1, -5.4, 0, 2.7, 'wall'); B(4, -6, 7.4, -5.4, 0, 2.7, 'wall');
      B(-7.4, 5.4, -4, 6, 0, 2.7, 'wall'); B(-1, 5.4, 7.4, 6, 0, 2.7, 'wall');
      B(-1.5, -1, 1.5, 1, 0, 2.7, 'pillar');
      B(-5, 2.2, -3, 3, 0, 1.1, 'low'); crate(3.5, -3.2); crate(4.4, -3.2);
      // 西邊樓梯（攻方上二樓）、東邊樓梯（守方上二樓）：8 階、每階高 0.375、深 0.6
      for (let k = 1; k <= 7; k++) B(-8 - 0.6 * k, 3.5, -8 - 0.6 * (k - 1), 5.5, 0, 3 - 0.375 * k, 'dock');
      for (let k = 1; k <= 7; k++) B(8 + 0.6 * (k - 1), -5.5, 8 + 0.6 * k, -3.5, 0, 3 - 0.375 * k, 'dock');
      // 二樓：東西兩面高牆（擋住看出生區）、南北矮牆（看得到兩邊的路）、樓梯口和天橋口留空
      B(-8, -6, -7.7, 3.3, 3, 5.2, 'wall'); B(7.7, -3.3, 8, 6, 3, 5.2, 'wall');
      B(-8, -6, 8, -5.7, 3, 4.1, 'low'); B(-8, 5.7, 4, 6, 3, 4.1, 'low');
      crate(-2, -3, 1, 0.9); B(-2.45, -3.45, -1.55, -2.55, 3, 3.9, 'crate'); B(2.5, 1.5, 4, 2.4, 3, 4.1, 'low');
      // 北邊天橋（二樓 → 鷹架平台）、鷹架平台、往 A 點的樓梯
      B(4, 6, 8, 16.5, 2.7, 3.0, 'dock'); B(4, 6, 4.2, 13, 3, 4, 'dark'); B(7.8, 6, 8, 13, 3, 4, 'dark');   // 天橋樓板一路鋪到平台北緣（路點才接得起來）
      B(4, 13, 15.5, 16.5, 2.7, 3.0, 'shed'); B(4, 16.3, 15.5, 16.5, 3, 4, 'dark');
      for (const [x, z] of [[4.3, 12.6], [7.7, 12.6], [4.3, 16.1], [10, 16.1], [15.1, 16.1], [15.1, 13.1], [10, 13.1]]) B(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 0, 2.7, 'dark');
      for (let k = 1; k <= 7; k++) B(15.5 + 0.6 * (k - 1), 13.5, 15.5 + 0.6 * k, 15.5, 0, 3 - 0.375 * k, 'dock');
      // 南邊：B 點墊高的混凝土平台（高 1.2）、三邊的台階
      B(18, -24, 30, -14, 0, 1.2, 'dock');
      for (let k = 1; k <= 2; k++) B(18 - 1.2 * k, -22, 18 - 1.2 * (k - 1), -16, 0, 1.2 - 0.4 * k, 'dock');
      for (let k = 1; k <= 2; k++) B(22, -14 + 1.2 * (k - 1), 26, -14 + 1.2 * k, 0, 1.2 - 0.4 * k, 'dock');
      for (let k = 1; k <= 2; k++) B(30 + 1.2 * (k - 1), -21, 30 + 1.2 * k, -17, 0, 1.2 - 0.4 * k, 'dock');
      // B 點上的掩體
      B(21, -20.5, 22.2, -18, 1.2, 2.3, 'low'); crate(26.5, -16.5, 2); B(26.05, -16.95, 26.95, -16.05, 1.2, 1.2, 'crate');
      B(25, -23.5, 28, -21.1, 1.2, 3.8, 'olive');
      // A 點（東北）：貨櫃、木箱、矮牆
      B(24, 18.4, 30, 20.8, 0, 2.6, 'teal'); crate(21, 22.5, 2); crate(21.9, 22.5); crate(29, 13); B(18.6, 11, 19.2, 13.4, 0, 1.1, 'low'); crate(32, 23.5, 2);
      // 北路：貨櫃、鋼筋堆（矮）、水泥攪拌桶的位置
      B(-24, 12, -18, 14.4, 0, 2.6, 'rust'); B(-12, 18, -6, 20.4, 0, 2.6, 'olive'); B(-11.5, 18, -6.5, 20.4, 2.6, 5.2, 'teal');
      B(-2, 20, 4, 21.2, 0, 0.9, 'dark'); crate(-28, 21, 2); crate(-15, 9); crate(2, 23.5);
      B(9, 18.5, 14, 24, 0, 2.8, 'shed');   // 工寮：擋住 A 點往西看北路
      B(5, -20.5, 9, -16.5, 0, 2.8, 'shed');   // 南邊工具間：擋住 B 點往西看
      // 南路：長矮牆三段、貨櫃、木箱
      B(-22, -14, -12, -13.4, 0, 2.8, 'low'); B(-9, -14, -2, -13.4, 0, 2.8, 'low'); B(2, -14, 10, -13.4, 0, 2.8, 'low');
      B(-3, -11.4, 3, -9.2, 0, 1.2, 'low'); crate(-5, -9); crate(5, -11); B(-31, -23, -23, -17, 0, 3.5, 'shed'); crate(-18, -20, 2); crate(10, -21, 2); crate(10.9, -21);
      // 兩邊出生區前的擋牆（不讓出生點對看）
      B(-18, -2.5, -16.5, 2.5, 0, 2.2, 'wall'); B(16.5, -2.5, 18, 2.5, 0, 2.2, 'wall');
      B(-29, 3, -27, 3.6, 0, 1.1, 'low'); B(-29, -3.6, -27, -3, 0, 1.1, 'low'); B(27, -3.6, 29, -3, 0, 1.1, 'low'); B(27, 3, 29, 3.6, 0, 1.1, 'low');
      crate(24, 0); crate(-24, 0);
    },
    decor: decorSite,
    playerSpawns: [[-32, 0], [-32, -8], [-32, 8]], botSpawns: [[32, 0], [32, -8], [32, 8], [25, 22], [24, -19], [3, -3]],
    spawn: STD_SPAWN,
    sites: {
      A: { x0: 17, x1: 33, z0: 10, z1: 25.5, cx: 25, cz: 17, mark: [22, 16], stage: [5, 22], plants: [[24, 15.5], [26.5, 22.5], [20.5, 18.5]],
        holds: [[30.5, 16.5, 10, 14], [27, 23.5, 10, 14], [22.5, 12, 8, 6], [32, 10.5, 30, 0], [19.5, 21.5, 6, 18], [13, 15, -2, 8]],
        smokes: [[17, 8], [12, 19]], post: [[21.5, 11.5], [24, 21.5], [28, 15.5], [31, 22]] },
      B: { x0: 15, x1: 33, z0: -25.5, z1: -10, cx: 24, cz: -18, mark: [20, -15.5], stage: [1, -18.5], plants: [[24, -19], [20, -22.5], [28, -15.5]],
        holds: [[29, -18.5, 8, -14], [24.5, -23, 8, -14], [22.5, -12, 8, -10], [32, -11, 30, 0], [19, -23.5, 8, -18]],
        smokes: [[13, -12], [12, -19]], post: [[18.5, -13], [23, -17.5], [27.5, -20.5], [29, -13]] },
    },
  },
};
const MAP_ORDER = ['dawn', 'market', 'rail', 'site'];
let MAP = MAPS.dawn;
const PLAYER_SPAWNS = [], BOT_SPAWNS = [];
// 換地圖：只換資料（BOXES、出生點），畫面、路點、包點由 switchMap 重建
function setMapData(id) {
  MAP = MAPS[id] || MAPS.dawn;
  BOXES.length = 0;
  B(-37, -27, 37, 27, -1, 0, MAP.floor);
  MAP.build();
  PLAYER_SPAWNS.length = 0; PLAYER_SPAWNS.push(...MAP.playerSpawns);
  BOT_SPAWNS.length = 0; BOT_SPAWNS.push(...MAP.botSpawns);
}
setMapData(S.map);

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
function sweepFree(ax, az, bx, bz, r, y = 0) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!cylinderFree(ax + (bx - ax) * t, az + (bz - az) * t, r, y + 0.05, y + 1.8)) return false; }
  return true;
}
// 路點分層：地面一層，再加上「站得上去的平台」（例如卸貨平台：頂面夠大、頭上有空間）。
// 同一層相鄰的點照舊連；不同層之間（樓梯）用真正的物理走一次，走得上去／下來才連（有方向）。
function surfaceLevels(x, z) {
  const out = [0];
  for (let i = 1; i < BOXES.length; i++) {
    const b = BOXES[i], y = b.max[1];
    if (y < 0.3 || y > 4) continue;
    if (x < b.min[0] + 0.45 || x > b.max[0] - 0.45 || z < b.min[2] + 0.45 || z > b.max[2] - 0.45) continue;
    if (!out.some((v) => Math.abs(v - y) < 0.05)) out.push(y);
  }
  return out;
}
const _walkBody = { pos: null, vel: null, r: 0.35, h: 1.8, onGround: true, jumped: false };
function walkable(a, b) {
  // 從 a 直直走向 b（每秒 4 公尺、最多 3 秒），走得到就算
  const body = _walkBody; body.pos = new V3(a.x, a.y, a.z); body.vel = new V3(); body.onGround = true; body.jumped = false; body.h = 1.8;
  for (let t = 0; t < 3; t += 1 / 30) {
    const dx = b.x - body.pos.x, dz = b.z - body.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5 && Math.abs(body.pos.y - b.y) < 0.25) return true;
    body.vel.x = dx / Math.max(d, 1e-3) * 4; body.vel.z = dz / Math.max(d, 1e-3) * 4;
    moveBody(body, 1 / 30);
  }
  return false;
}
function buildNav() {
  const { cols, rows, x0, z0, step } = NAV; NAV.nodes.length = 0; NAV.cells = [];
  // 地面層：id ＝ j*cols+i（跟以前一樣）
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i * step, z = z0 + j * step, n = { id: j * cols + i, x, z, y: 0, i, j, ok: cylinderFree(x, z, 0.55, 0.05, 1.8), nb: [] };
    NAV.nodes.push(n); NAV.cells[n.id] = [n];
  }
  // 平台層
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    for (const y of surfaceLevels(x, z)) {
      if (y === 0 || !cylinderFree(x, z, 0.45, y + 0.05, y + 1.8)) continue;
      const n = { id: NAV.nodes.length, x, z, y, i, j, ok: true, nb: [], up: true };
      NAV.nodes.push(n); NAV.cells[j * cols + i].push(n);
    }
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? [] : NAV.cells[j * cols + i]);
  for (const n of NAV.nodes) {
    if (!n.ok) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      for (const m of at(n.i + di, n.j + dj)) {
        if (!m.ok || Math.abs(m.y - n.y) > 0.05) continue;
        if (di && dj && !(at(n.i + di, n.j).some((q) => q.ok && Math.abs(q.y - n.y) < 0.05) && at(n.i, n.j + dj).some((q) => q.ok && Math.abs(q.y - n.y) < 0.05))) continue;
        if (sweepFree(n.x, n.z, m.x, m.z, 0.45, n.y)) n.nb.push(m.id);
      }
    }
  }
  // 層和層之間：平台邊緣的點，跟 3 格內不同高度的點試走
  for (const n of NAV.nodes) {
    if (!n.up || !n.ok) continue;
    if (n.nb.length >= 8) continue;                       // 不在邊緣
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      for (const m of at(n.i + di, n.j + dj)) {
        if (!m.ok || Math.abs(m.y - n.y) < 0.05 || Math.abs(m.y - n.y) > 3) continue;
        if (walkable(m, n) && !m.nb.includes(n.id)) m.nb.push(n.id);
        if (walkable(n, m) && !n.nb.includes(m.id)) n.nb.push(m.id);
      }
    }
  }
  // 只留跟出生點走得通的那一大群（上不去的貨櫃頂、噴水池頂之類自己成一群的丟掉）
  const sp = MAP.spawn.atk[0], start = NAV.cells[Math.round((sp[1] - z0) / step) * cols + Math.round((sp[0] - x0) / step)][0];
  // 去得了、也回得來（只能跳下去、爬不回來的點不要）
  const back = new Map(); for (const n of NAV.nodes) for (const m of n.nb) { if (!back.has(m)) back.set(m, []); back.get(m).push(n.id); }
  const reach = (next) => { const seen = new Set([start.id]), q = [start.id]; while (q.length) { const c = q.pop(); for (const m of next(c)) if (!seen.has(m)) { seen.add(m); q.push(m); } } return seen; };
  const fwd = reach((c) => NAV.nodes[c].nb), bwd = reach((c) => back.get(c) || []);
  for (const n of NAV.nodes) if (!(fwd.has(n.id) && bwd.has(n.id))) { n.ok = false; n.nb = []; }
  for (const n of NAV.nodes) n.nb = n.nb.filter((m) => NAV.nodes[m].ok);
  NAV.upCount = NAV.nodes.filter((n) => n.up && n.ok).length;
}
// 最近的路點，而且要能直接走過去（貼著牆時，牆另一邊的點不算）；y：所在高度（優先同一層）
function nearestNode(x, z, y) {
  let best = null, bd = 1e9, fall = null, fd = 1e9;
  for (const n of NAV.nodes) {
    if (!n.ok || !n.nb.length) continue;
    const dy = y === undefined ? 0 : Math.abs(n.y - y);
    if (y !== undefined && dy > 1.2) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2 + dy * dy * 4;
    if (d < fd) { fd = d; fall = n; }
    if (d < bd && d < 64 && sweepFree(x, z, n.x, n.z, 0.3, n.y)) { bd = d; best = n; }
  }
  return best || fall || (y !== undefined ? nearestNode(x, z) : null);
}
// A*：回傳一串 [x, z, y]，再把同一層走得直通的中間點拉掉
function findPath(sx, sz, tx, tz, sy = 0, ty) {
  const s = nearestNode(sx, sz, sy), t = nearestNode(tx, tz, ty);
  if (!s || !t) return null;
  const open = [s.id], g = new Map([[s.id, 0]]), came = new Map(), f = new Map([[s.id, Math.hypot(s.x - t.x, s.z - t.z)]]), closed = new Set();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === t.id) {
      const out = []; let c = cur; while (c !== undefined) { const n = NAV.nodes[c]; out.unshift([n.x, n.z, n.y]); c = came.get(c); }
      out.push([tx, tz, t.y]);
      return smoothPath(sx, sz, out, s.y);
    }
    closed.add(cur);
    const cn = NAV.nodes[cur];
    for (const nb of cn.nb) {
      if (closed.has(nb)) continue;
      const m = NAV.nodes[nb], burn = typeof FIRES !== 'undefined' && FIRES.length && nb !== t.id && fireAt(m.x, m.z, m.y, 0.8) ? 80 : 0;   // 燃燒彈：繞過火
      const ng = g.get(cur) + Math.hypot(m.x - cn.x, m.z - cn.z) + Math.abs(m.y - cn.y) * 1.5 + burn;
      if (ng < (g.has(nb) ? g.get(nb) : 1e9)) {
        came.set(nb, cur); g.set(nb, ng); f.set(nb, ng + Math.hypot(m.x - t.x, m.z - t.z));
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return null;
}
function smoothPath(sx, sz, pts, sy = 0) {
  // 終點如果站不下（例如貼著牆）就丟掉，停在最後一個路點
  const last = pts[pts.length - 1]; if (!cylinderFree(last[0], last[1], 0.4, (last[2] || 0) + 0.05, (last[2] || 0) + 1.8)) pts.pop();
  const out = []; let ax = sx, az = sz, ay = sy, i = 0;
  while (i < pts.length) {
    // 只在同一層裡拉直；要換層（樓梯）的地方保留路點
    let j = pts.length - 1;
    while (j > i && !(sameLevelRun(pts, i, j, ay) && sweepFree(ax, az, pts[j][0], pts[j][1], 0.42, ay) && !fireOnLine(ax, az, pts[j][0], pts[j][1], ay))) j--;
    out.push(pts[j]); ax = pts[j][0]; az = pts[j][1]; ay = pts[j][2] || 0; i = j + 1;
  }
  return out;
}
// 這段直線會不會穿過火（拉直路線時不要抄近路穿火）
function fireOnLine(ax, az, bx, bz, y) {
  if (typeof FIRES === 'undefined' || !FIRES.length) return false;
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 1));
  for (let i = 1; i < n; i++) { const t = i / n; if (fireAt(ax + (bx - ax) * t, az + (bz - az) * t, y, 0.6)) return true; }
  return false;
}
function sameLevelRun(pts, i, j, y) { for (let k = i; k <= j; k++) if (Math.abs((pts[k][2] || 0) - y) > 0.05) return false; return true; }

