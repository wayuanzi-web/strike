/* ===== 10-core：共用工具、設定 ===== */
const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
// 近似標準常態的亂數（三個均勻亂數相加再標準化，標準差 1）
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3();

// 角度差，結果在 -π～π
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------- 設定（存在這台手機的瀏覽器裡，讀不到就用預設） ----------
const DEFAULTS = { sens: 1.0, adsSens: 0.6, autoFire: true, aimAssist: true, followRecoil: true, difficulty: 'normal', quality: 'auto', sound: true, showFps: false, map: 'dawn', lefty: false, btnScale: '1', vibrate: true,
  adsMode: 'toggle', crouchMode: 'toggle', curve: 'linear', joyMode: 'float', runLock: true, gyro: 'off', gyroSens: 1.0, gyroInv: false, killcam: true, soundViz: false, captions: false, palette: 'default', layout: null };
const S = Object.assign({}, DEFAULTS);
try { const raw = localStorage.getItem('strike.settings'); if (raw) Object.assign(S, JSON.parse(raw)); } catch (e) { /* 私密瀏覽或被擋，就用預設 */ }
function buzz(ms) { try { if (S.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* iPhone 不支援震動 */ } }
function saveSettings() { try { localStorage.setItem('strike.settings', JSON.stringify(S)); } catch (e) { /* 存不了也照玩 */ } }
// 畫質：渲染解析度上限（設計筆記：預設 1.5 倍，省電 1 倍）
const BUILD = '__BUILD__';   // 建置時換成日期時間
const QUALITY = { eco: 1.0, std: 1.25, high: 1.5 };
// 自動：手機從「標準」開始、電腦從「清晰」開始，太卡就自動往下降（見 90-main 的 autoQuality）

// 觸控裝置判斷：有觸控就顯示觸控按鈕；電腦上的鍵盤滑鼠是測試用的備用操作
const isTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;

// 難度（依子代理的蒙地卡羅模擬調過：普通難度站著不動在 15 公尺被一隻打死約 4.8 秒、兩隻約 2.8 秒，跑動時約 2.3 倍）
// react 反應秒數、base 基本誤差（度）、distK 每公尺加幾度、dmg 傷害倍數、burst 連發數、pause 連發間停頓、
// pMoveK 你在跑時加幾度、headMul 打你頭的倍數、warn 剛發現時前幾發必定打偏、turn 交戰轉身速度（弧度／秒）、
// maxShooters 同時開火的機器人上限、settleK 剛發現時手不穩加幾度
const DIFF = {
  easy:   { react: 0.9,  base: 1.8,  distK: 0.055, dmg: 0.45, burst: [2, 4], pause: [0.5, 0.9],  pMoveK: 3.0, headMul: 2,   warn: 1, turn: 3.5, maxShooters: 1, settleK: 3.0, mercy: true },
  normal: { react: 0.7,  base: 1.55, distK: 0.045, dmg: 0.52, burst: [3, 4], pause: [0.4, 0.75], pMoveK: 2.8, headMul: 2.5, warn: 1, turn: 4.5, maxShooters: 2, settleK: 2.8, mercy: true },
  hard:   { react: 0.42, base: 1.1,  distK: 0.035, dmg: 0.72, burst: [3, 5], pause: [0.3, 0.55], pMoveK: 2.2, headMul: 3,   warn: 0, turn: 6.5, maxShooters: 3, settleK: 2.4, mercy: false },
};
// 隊友：普通的準度，不需要手下留情（只會打機器人）
DIFF.ally = Object.assign({}, DIFF.normal, { mercy: false, warn: 0 });
// mercy：簡單、普通才有的手下留情（畫面外先打偏、你血少或連死時手抖、血一半以上不會一發死）。困難全部拿掉
