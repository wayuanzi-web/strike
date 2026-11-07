/* ===== 10-core：共用工具、設定 ===== */
const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
// 常態分布的亂數（兩個均勻亂數平均，夠用）
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3();

// 角度差，結果在 -π～π
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------- 設定（存在這台手機的瀏覽器裡，讀不到就用預設） ----------
const DEFAULTS = { sens: 1.0, adsSens: 0.6, autoFire: true, aimAssist: true, difficulty: 'normal', quality: 'high', sound: true, showFps: false };
const S = Object.assign({}, DEFAULTS);
try { const raw = localStorage.getItem('strike.settings'); if (raw) Object.assign(S, JSON.parse(raw)); } catch (e) { /* 私密瀏覽或被擋，就用預設 */ }
function saveSettings() { try { localStorage.setItem('strike.settings', JSON.stringify(S)); } catch (e) { /* 存不了也照玩 */ } }
// 畫質：渲染解析度上限（設計筆記：預設 1.5 倍，省電 1 倍）
const QUALITY = { eco: 1.0, std: 1.25, high: 1.5 };

// 觸控裝置判斷：有觸控就顯示觸控按鈕；電腦上的鍵盤滑鼠是測試用的備用操作
const isTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;

// 難度：反應時間（秒）、基本誤差（度）、距離誤差（每公尺幾度）、傷害倍數
const DIFF = {
  easy:   { react: 0.8, base: 2.2, distK: 0.06, dmg: 0.45, burst: [2, 4] },
  normal: { react: 0.55, base: 1.6, distK: 0.05, dmg: 0.62, burst: [3, 5] },
  hard:   { react: 0.32, base: 0.8, distK: 0.035, dmg: 0.9, burst: [3, 6] },
};
