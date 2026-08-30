# itch.io 免費素材匯入指南

V4 已附可直接玩的原創 fallback 素材；以下素材是「建議你自行到作者頁下載後替換」，不是直接重包進 ZIP。

## 1. Brackeys' Platformer Bundle

```text
https://brackeysgames.itch.io/brackeys-platformer-bundle
```

用途：角色、史萊姆、平台、金幣與基礎世界圖塊。

作者頁標示 CC0。適合學習 Sprite Sheet、平台 Tile 與角色動畫。

推薦放置：

```text
assets/itch/brackeys/
```

再依 `tools/generate_assets.py` 的輸出尺寸重排，或修改 `drawPlayer()`／`drawEnemies()` 的 frameWidth、frameHeight。

## 2. Dark Forest Platform Pack — Atari Boy

```text
https://atari-boy.itch.io/dark-forest-platform-pack
```

用途：16×16 森林 Tile、三層背景。作者頁標示 CC0。

可替換：

```text
assets/backgrounds/*_far.png
assets/backgrounds/*_mid.png
assets/backgrounds/*_near.png
```

但你的參考圖更明亮，因此建議只取 Tile／樹木，不要整張背景原色照搬；可提高天空亮度與綠色飽和度。

## 3. Free Pixel Art Asset Pack — Sidescroller Fantasy Forest — Anokolisa

```text
https://anokolisa.itch.io/sidescroller-pixelart-sprites-asset-pack-forest-16x16
```

用途：角色、敵人、森林物件與 Tile。

推薦用來替換：

```text
assets/sprites/player_rift.png
assets/sprites/enemy_*.png
```

下載後先確認作者頁與包內授權，尤其是是否允許重新散布原始 PNG。

## 4. Pixel Art VFX — Slashes — Frostwindz

```text
https://frostwindz.itch.io/pixel-art-slashes
```

用途：Slash、Hit、技能前景特效。

可替換：

```text
assets/vfx/slash_cyan.png
assets/vfx/slash_gold.png
assets/vfx/launcher.png
```

V4 預設 Slash Sheet：

```text
128 × 128 px / frame
10 frames / horizontal sheet
```

如果來源規格不同，修改 `drawFrontEffects()` 的 frame size／frame count。

## 5. Brackeys' VFX Bundle

```text
https://brackeysgames.itch.io/brackeys-vfx-bundle
```

用途：爆炸、火、煙、閃光等。作者頁標示 CC0。

適合替換：

```text
assets/vfx/explosion.png
assets/vfx/hit.png
assets/vfx/shockwave.png
```

## 匯入原則

1. 先讀作者頁與壓縮包內 license。
2. 不要把「免費用於遊戲」誤認成「可重新出售或重新散布素材包」。
3. 統一 Sprite 腳底 pivot，否則動畫會上下抖。
4. 攻擊動畫換掉後，必須重新調 `const A` 的 Active Frame。
5. 背景可以亮，但角色、敵人、危險預警必須保持更高對比。
