# 素材與授權說明

## 本 ZIP 內實際包含的素材

`assets/sprites/`、`assets/vfx/`、`assets/backgrounds/` 是為 Elemental Swap V4 生成的原創可替換素材。

目的：

- ZIP 下載後可離線執行。
- GitHub Pages 不會因第三方下載連結失效而黑屏。
- 不把禁止重新散布的 itch.io 原始素材包再次打包。

生成程式：

```text
tools/generate_assets.py
```

## 參考圖片

使用者提供的四張植生廢墟圖片僅作美術方向參考；本專案沒有把圖片直接當遊戲背景重新發佈，也沒有直接描摹其標誌或文字。

## itch.io 素材

推薦清單與匯入位置請看：

```text
ITCH_ASSET_IMPORT.md
```

下載第三方素材後請保存作者頁、下載日期與 license.txt，並遵守是否允許商用、修改、署名與重新散布的條款。

## PeerJS

2P 模式透過 CDN 載入 PeerJS。單人模式不依賴 PeerJS 才能玩。正式發布時請依 PeerJS 專案授權保存相應 license / notice。
