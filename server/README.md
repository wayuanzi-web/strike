# 排行榜伺服器（選配）

遊戲本身不需要伺服器。這個資料夾是**排行榜**用的小程式，部署到 Cloudflare Workers（免費方案）後，遊戲的「成長」畫面才會出現排行榜。沒部署就完全不顯示、也不會連任何地方。

## 會存什麼

- 暱稱（1–12 個字，擋掉髒話和 HTML 符號）。
- 隨機玩家編號：遊戲第一次上傳時產生，不是帳號，也不會在排行榜上公開。
- 分數：
  - 練槍場：平均反應、打倒數、命中率、爆頭。
  - 生涯：場數、勝場、擊殺。
- 日期。

**不存 IP、不存任何個資。** IP 只拿來限制「每小時最多上傳 20 次」，當作計數的鑰匙，1 小時後自動刪掉。

## 防亂填（擋得住亂填，擋不住有心人偽造）

- 每筆分數都檢查合不合理：
  - 練槍場：反應 150 毫秒以上、打倒 20–30 個、命中率不超過 100%。
  - 生涯：至少 10 場、勝場不超過場數。
- 同一個 IP 每小時最多 20 次。
- 同一個玩家只留最好的一筆。
- 遊戲在瀏覽器裡跑，分數一定能被偽造。要更嚴格，可以再加 Cloudflare Turnstile（免費的人機驗證），或只把網址給朋友。

## 部署（約 10 分鐘，要自己的 Cloudflare 帳號）

1. 到 <https://dash.cloudflare.com/sign-up> 註冊免費帳號。
2. 左邊選「Storage & Databases → KV」→「Create」，名稱填 `strike-lb`。
3. 左邊選「Workers & Pages」→「Create」→「Create Worker」，名稱填 `strike-lb` →「Deploy」。
4. 進這個 Worker →「Edit code」，把 `leaderboard-worker.js` 的內容整個貼上去取代 →「Deploy」。
5. Worker 的「Settings」裡：
   - 「Bindings」→「Add」→「KV namespace」：變數名稱填 `LB`，選第 2 步建的 `strike-lb`。
   - 「Variables」→「Add」：名稱 `ALLOWED_ORIGINS`，值 `https://wayuanzi-web.github.io`（只讓你的遊戲網址呼叫）。
6. 複製 Worker 的網址（像 `https://strike-lb.<你的帳號>.workers.dev`）：
   - 寫進這個資料夾的 `lb-url.txt`，再重新建置、推上 GitHub。
   - 或直接把網址貼給 Claude，請它做這一步。

會用指令的話，也可以裝 `wrangler` 用 `wrangler.toml` 部署：`npx wrangler kv namespace create LB`，把產生的 id 填進 `wrangler.toml`，再 `npx wrangler deploy`。

## 免費方案的上限

- 每天 10 萬次請求。
- KV 每天 1000 次寫入：每次上傳寫 2 次，大約每天 500 次上傳。

朋友之間玩綽綽有餘。

## 測試

```
node test/lb-test.mjs        # Worker 本身：驗證、排序、限流、不外洩編號
python3 test/m11lb.py        # 遊戲端：用本機假伺服器（同一份程式）跑一遍
```
