/* ===== 90-web：只有公開網頁 App 版才有——離線快取（加到主畫面後沒網路也能玩） ===== */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* 註冊不了就只是不能離線 */ }); });
}
