# 破曉突擊

手機網頁上的第一人稱 3D 槍戰，玩法參考 CS 這類回合制團隊射擊：五對五炸彈模式，你和 4 個電腦隊友對上 5 個電腦敵人。

**開始玩**：https://wayuanzi-web.github.io/strike/ （手機橫拿。加到主畫面後全螢幕、沒網路也能玩）

## 玩法
- **對戰 5v5**：攻方把炸彈裝在 A 或 B 點，守方阻止或拆彈；一條命一回合，第 6 回合後換邊，先贏 7 回合獲勝。準備時間用賺來的錢買槍、護甲、投擲物。
- **練習**：4 個敵人、陣亡馬上重生、所有武器免費試。
- **新手教學**：10 步，約 2 分鐘。
- **四張地圖**：曙光倉區（破曉）、正午舊城（正午）、黃昏鐵道（黃昏）、烈日工地（午後，兩層樓、天橋、鷹架）。
- **更多模式**：個人死鬥、搶點 4v4、練槍場（反應時間與命中率）。
- **武器**：手槍、重手槍、衝鋒槍、霰彈槍、步槍、卡賓槍、狙擊槍；手榴彈、閃光彈、煙霧彈、燃燒彈；護甲會被打掉；陣亡掉槍、可以撿槍丟槍。
- **操作**：按鈕位置、大小、透明度自訂；固定或浮動搖桿、前進鎖定；開鏡與蹲按住或切換；陀螺儀瞄準。
- **戰績**：場數、勝率、K/D、爆頭率、命中率、各地圖、各武器、最近 10 場（存在這台裝置）。

## 操作
- 手機：左半邊拖曳移動（推到底是跑），右半邊拖曳轉視角；開火鍵按住也能拖著瞄。按鈕：開鏡、跳、蹲、換彈、換槍、投擲、自動開火、按住裝彈／拆彈、購買。
- 設定：靈敏度、開鏡靈敏度、左右手（搖桿換邊）、按鈕大小、震動、自動開火、瞄準輔助、難度、畫質（自動／省電／標準／清晰）。
- 電腦：WASD 移動、滑鼠轉視角（點畫面鎖定）、左鍵開火、右鍵開鏡、空白跳、C／Ctrl 蹲、R 換彈、1／2／Q 換槍、G 投擲物、B 購買、E 按住裝彈／拆彈、Esc 暫停。

## 開發
```
python3 src/build.py                                          # 產生 src/dist/（Artifact 版與本機測試頁）
python3 src/build.py https://wayuanzi-web.github.io/strike/   # 產生 repo 根目錄的網頁 App
python3 src/gen_icons.py                                      # 重畫 App 圖示
cd test
python3 mech.py; python3 touch.py; python3 cdn.py             # 手感、觸控、CDN 版
python3 m2mech.py; python3 m2touch.py                         # 武器、經濟、炸彈、投擲物
python3 maps.py; python3 m3ui.py; python3 m4.py               # 地圖檢查、選地圖與畫質、教學與戰績與左手模式
python3 m6.py; python3 m7.py; python3 m8a.py; python3 m8b.py; python3 m8c.py   # 操作進階、AI、武器、模式、第四張地圖
python3 m2sim.py 3 ghost market                               # 整場模擬（攻守勝率）
```
原始碼在 `src/parts/`，依檔名順序串成一個 HTML。Three.js r160（MIT，授權在 `three-LICENSE.txt`）：Artifact 版從 jsDelivr 載入，Pages 版放在 repo 裡、離線也能玩。地圖、武器名稱與美術都是原創，貼圖與音效全部用程式產生。
