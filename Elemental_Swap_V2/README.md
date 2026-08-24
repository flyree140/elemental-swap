# Elemental Swap V2｜十相回路

一款以「**發射元素 → 再按同元素鍵 → 與元素／被標記敵人交換位置**」為核心的 2D 橫向卷軸網頁遊戲原型。

這個重建版不依賴外部圖片素材即可遊玩：角色、敵人、地形與特效均使用 Canvas 程序繪製。唯一線上依賴是 2P 模式使用的 PeerJS CDN；即使 PeerJS 載入失敗，單人遊戲仍可正常運作。

## 功能

- 18,000px 橫向世界、8 個區域。
- 二段跳；百獸「鷹」姿態可三段跳。
- 10 種元素，各自有不同飛行方式、命中狀態、換位能力。
- 敵人被元素命中會顯示元素標記，可直接與有相同標記的敵人交換位置。
- 元素連鎖：冰→火、水→雷、火→風、岩→自然、光↔影、引力→風。
- Z/X Command Combo：快攻、重攻、挑空、空中追擊、下砸、Dash Attack。
- C/V/B 三技能、Q 職業技能、MP、CD、Hit Stop、擊退、浮空、破甲、霸體。
- 四職業：裂隙劍士、靈契召喚師、百獸憑依者、符文機巧師。
- 8 類敵人含 Boss。
- 4 名 NPC。
- 水池、冰面、火牆、隱形光橋、影牆、種子藤蔓、壓板箱子、雷射、壓碎機、引力核心、脆牆等機關。
- 全鍵盤遊玩、鍵位可修改並存入 localStorage。
- PeerJS + WebRTC 2P prototype。
- GitHub Pages 可直接部署。

## 預設按鍵

| 按鍵 | 動作 |
|---|---|
| A / D | 左右移動 |
| W / S | 上下瞄準 |
| Space | 跳躍／二段跳 |
| Shift | 衝刺 |
| Z | 快攻 |
| X | 重攻 |
| C / V / B | 技能 1 / 2 / 3 |
| Q | 職業特殊能力 |
| 1–0 | 10 種元素；同鍵再次換位 |
| F | NPC 互動 |
| G | 清除元素錨點 |
| R | 回最近檢查點 |
| H | 開啟說明 |
| K | 自訂按鍵 |
| P | 暫停 |

## 最簡單的啟動方式

直接雙擊 `index.html` 可以玩單人。

比較推薦使用本機 HTTP server：

```bash
python -m http.server 8000
```

再用瀏覽器開啟：

```text
http://localhost:8000
```

WebRTC / PeerJS 在 HTTPS 的 GitHub Pages 上測試最接近正式環境。

## 專案結構

```text
Elemental_Swap_V2/
├─ index.html                # 網頁與 HUD / 面板
├─ styles.css                # UI 外觀
├─ .nojekyll                 # GitHub Pages 不經 Jekyll 特殊處理
├─ js/
│  ├─ config.js              # ★ 最常修改：元素、職業、敵人、NPC、按鍵
│  ├─ game.js                # ★ 遊戲規則：戰鬥、物理、AI、元素、機關
│  └─ network.js             # 2P PeerJS / WebRTC
├─ MODIFY_GUIDE.md           # 完整修改教學
├─ GITHUB_DEPLOY.md          # GitHub Pages + 2P 測試教學
├─ CHANGELOG_V2.md           # 本次改動
├─ TEST_CHECKLIST.md         # 上線前測試
└─ ASSET_LICENSE.md          # 素材 / 函式庫說明
```

## 開發者 Debug

F12 → Console：

```js
ElementalSwap.debug.teleport(9000)
ElementalSwap.debug.boss()
ElementalSwap.debug.heal()
ElementalSwap.debug.class("summoner")
ElementalSwap.debug.class("beast")
ElementalSwap.debug.element("fire")
ElementalSwap.debug.spawn("golem")
```

更多請看 `MODIFY_GUIDE.md`。
