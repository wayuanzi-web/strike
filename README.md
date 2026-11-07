# 破曉突擊（暫名）

手機網頁上的第一人稱 3D 槍戰，玩法參考 CS 這類回合制團隊射擊。目前是 **M0 手感原型**：灰盒地圖「曙光倉區」、觸控操作、一把步槍、四個會巡邏會還手的機器人。

## 怎麼玩
- 手機橫拿。左半邊拖曳移動（推到底是跑），右半邊拖曳轉視角；開火鍵按住也能拖著瞄。
- 右邊按鈕：開鏡、跳、蹲、換彈、自動開火開關。暫停鍵裡可以調靈敏度、瞄準輔助、機器人難度、畫質。
- 電腦測試：WASD 移動、滑鼠轉視角（點畫面鎖定）、左鍵開火、右鍵開鏡、空白跳、C／Ctrl 蹲、R 換彈、Esc 暫停。

## 開發
```
python3 src/build.py                                   # 產生 src/dist/（Artifact 版與本機測試頁）
python3 src/build.py https://wayuanzi-web.github.io/strike/   # 產生 repo 根目錄的網頁 App
python3 src/gen_icons.py                               # 重畫 App 圖示
cd test && python3 mech.py && python3 touch.py && python3 cdn.py   # 無頭瀏覽器自動測試
```
原始碼在 `src/parts/`，依檔名順序串成一個 HTML。Three.js r160（MIT，授權在 `three-LICENSE.txt`）：Artifact 版從 jsDelivr 載入，Pages 版放在 repo 裡、離線也能玩。
