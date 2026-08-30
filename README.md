# Elemental Swap V5｜植生舊都・解謎擴充

可直接部署到 GitHub Pages 的 2D 橫向卷軸網頁遊戲。核心規則仍是：第一次按元素鍵發射；同元素再次按下，與元素彈、錨點或被標記敵人安全換位，並觸發元素的真正能力。

## V5 主要更新

- 修正換位落進平台、掉出地圖與立即死亡的問題：換位前會搜尋附近合法平台表面與安全空間。
- 召喚師會產生實際召喚物：常駐靈狐、三狐契陣、守護靈、星獸與靈鴞指令。
- 百獸使會切換狼、鷹、熊 Sprite 與能力；大招進入百獸王型態。
- 機巧師部署的砲台有專屬 Sprite、射擊與超載狀態。
- 四職業不再共用相同技能呈現。
- 8 個區域各有獨立的明亮植生廢墟背景。
- 40 個解謎物件與 10 名 NPC，引導玩家逐步使用十元素、職業能力與元素連鎖。
- 方向鍵＋X/Y 多分支 Command、浮空、倒地、受身、Boss BREAK 與三階段戰鬥保留。

## 啟動

### 最方便：單檔版

直接開啟：

```text
Elemental_Swap_V5_Standalone.html
```

單檔版已內嵌 CSS、JavaScript 與所有本機圖像素材。

### 完整專案版

在專案資料夾執行：

```bash
python -m http.server 8000
```

瀏覽：

```text
http://localhost:8000
```

## 預設按鍵

| 按鍵 | 動作 |
|---|---|
| ← / → | 移動、前後方向 Command |
| ↑ / ↓ | 上下方向 Command、元素彈瞄準 |
| Space | 跳躍、二段跳、倒地受身 |
| Shift | Dash |
| X / Y | 快攻／重攻 Command |
| C / V / B | 三個職業技能 |
| Q | 職業能力／變身／召喚指令 |
| 1–0 | 十種元素；同鍵再次按下換位 |
| F | NPC 互動 |
| R | 回最近檢查點 |
| H / K / P | 說明／改鍵／暫停 |

## 主要檔案

```text
index.html
styles.css
js/config.js
js/network.js
js/game.js
js/v5_enhancements.js
assets/backgrounds/
assets/sprites/
assets/vfx/
tools/runtime_smoke_test.js
tools/build_release.py
```

## 自動檢查

```bash
node tools/runtime_smoke_test.js
python tools/build_release.py
```

完整結果見 `VERIFICATION.md` 與 `runtime_smoke_test_output.json`。
