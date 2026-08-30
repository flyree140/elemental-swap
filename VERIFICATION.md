# V5 完整性驗證

## Release 內容

- `index.html`：GitHub Pages 多檔入口。
- `Elemental_Swap_V5_Standalone.html`：CSS、四支 JavaScript 與所有本機圖像完整內嵌。
- 8 區 × 3 層植生都市背景。
- 四職業、四種百獸型態、四種召喚物、砲台、敵人、Boss 與十元素 VFX。
- `PREVIEW_V5.png`：實際以 Chromium 載入單檔版後擷取。

## JavaScript 與 Runtime smoke test

以下檔案通過 `node --check`：

- `js/config.js`
- `js/network.js`
- `js/game.js`
- `js/v5_enhancements.js`

`node tools/runtime_smoke_test.js` 已通過：

- 版本 `5.0.0-living-ruins-puzzle-expansion`
- 初始敵人 27
- 區域 8
- 元素 10
- 解謎物件 40
- NPC 10
- Boss Phase 3 與 BREAK stun 2.6 秒
- 安全區等待 HP 維持不變
- 安全換位、召喚師、百獸變身與解謎門狀態鏈通過

## Chromium 單檔版驗證

由於環境政策會阻擋 Playwright 導航至 localhost/file URL，本次使用 `page.set_content()` 載入真正的完整單檔 HTML；圖像均為單檔內的 data URI，執行的仍是 Release 內同一組 CSS、JavaScript 與素材。

驗證結果：

- `v5Patched: true`
- 內嵌素材 61 個實際載入、61 個 data URI 記錄
- 元素 HUD 10 格、技能 HUD 6 格、解謎清單 3 項
- Canvas 1576 × 884
- 原地等待 3.5 秒：HP 190 → 190
- 方向鍵移動：角色 X 180 → 約 312
- 火元素：成功發射 1 顆，再按 1 完成換位並產生兩個 `flame` 火區
- 平台內錨點安全換位：平台頂 585，玩家底部 583，沒有落入平台、沒有死亡
- 召喚師：產生 3 狐＋守護靈＋星獸，共 5 個實體召喚物
- 百獸使：狼形切換為鷹形，`player_beast_eagle` 圖像已載入
- Browser page error：0
- Console error：0

機器可讀結果：`browser_verification.json`。
