/* ===== 90-web：只有公開網頁 App 版才有——離線快取（加到主畫面後沒網路也能玩）、安裝到主畫面的提示 ===== */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* 註冊不了就只是不能離線 */ }); });
}
(function installHint() {
  const standalone = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const box = $('installBox'), txt = $('installT'), btn = $('bInstall');
  if (standalone) { box.hidden = false; txt.textContent = '已加到主畫面：沒網路也能玩。'; return; }
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  // Android／電腦 Chrome：瀏覽器願意安裝時會給這個事件，按鈕就能直接安裝
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; box.hidden = false; btn.hidden = false; txt.textContent = '加到主畫面：全螢幕、沒網路也能玩。'; });
  onTap(btn, () => { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(() => { deferred = null; btn.hidden = true; txt.textContent = '裝好後從主畫面的圖示打開。'; }); });
  if (ios) { box.hidden = false; txt.textContent = 'iPhone：在 Safari 按下方的「分享」→「加入主畫面」，就能全螢幕、沒網路也能玩。'; }
})();
