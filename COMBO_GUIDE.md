# X / Y Command 完整指南

V4 將「少量按鍵、多種方向與序列」作為戰鬥核心。

設計方向參考高速橫向動作 RPG 常見的 Command 結構：輕／重攻擊鍵、連打、方向分支、Dash 分支與空中分支。遊戲內改用你指定的 `X / Y` 命名。

## 中立指令

| 指令 | 招式 | 用途 |
|---|---|---|
| X | 疾斬 I | 最快起手 |
| XX | 疾斬 II | 維持硬直 |
| XXX | 裂步斬 | 小位移進攻 |
| XXXX | 終結斬 | 大擊退收尾 |
| Y | 重斷 | 破甲重擊 |
| YY | 裂地終結 | 高 KD／高 BREAK |
| XXY | 逆界挑空 | 標準浮空起手 |
| XY | 交錯斬 | 兩段轉換攻擊 |
| XYY | 旋環破 | 多段範圍終結 |
| XYX | 回身連斬 | 三段快速傷害 |
| YX | 盾裂 | Guard Break |
| YXX | 逆掃收刃 | 掃倒敵人 |
| XXXY | 蒼穹裂 | 強力高浮空 |

## 方向指令

「前」代表玩家目前面向方向；「後」代表反方向。

| 指令 | 招式 | 用途 |
|---|---|---|
| →X | 踏步斬 | 快速前進斬 |
| →Y | 貫穿重突 | 長距離破防突刺 |
| ←X | 退身月斬 | 後撤反斬 |
| ←Y | 反擊架勢 | 高風險反擊 |
| ↑X | 昇刃 | 快速挑空 |
| ↑Y | 天穹破 | 超高浮空／BREAK |
| ↓X | 低空掃 | 低段掃倒 |
| ↓Y | 地脈崩擊 | 重型地面終結 |

## Dash 指令

| 指令 | 招式 |
|---|---|
| Shift + X | 瞬步穿斬 |
| Shift + Y | 破陣衝鋒 |

## 空中指令

| 指令 | 招式 | 用途 |
|---|---|---|
| Air X | 空中追斬 | 維持浮空 |
| Air XX | 雙月追擊 | 空中兩段 |
| Air Y | 隕落斬 | 墜擊／Ground Bounce |
| Air ↑X | 鷹返 | 空中再挑高 |
| Air ↓Y | 墜星 | 大型垂直終結 |

## Active Frame

V4 不會在按鍵瞬間直接扣血。

```text
按鍵
→ 播攻擊動畫
→ 到 active frame
→ 生成 Hitbox
→ 命中後 Hit Stop / VFX / Knockback
```

調整位置：`js/game.js` 的 `const A`。

例如：

```js
X1: {
  duration: .22,
  cancel: .125,
  events: [{at:.075}],
  damage: 8,
  kx: 80,
  ky: -15,
  kd: 7,
  br: 6,
  stop: .036
}
```

- `duration`：整招時間。
- `cancel`：允許接下一招的時間。
- `events.at`：Hitbox 出現時間。
- `kx / ky`：擊退；`ky` 負值向上。
- `kd`：倒地值。
- `br`：Boss BREAK 傷害。
- `stop`：命中停格。

## Input Buffer

若你在 Cancel Window 前太早按下一招，系統會先保存輸入。進入可取消時間後自動接出，避免快按時吞鍵。

## 建議練習

```text
XXY
→ Jump
→ Air X
→ Air XX
→ Air Y
→ Ground Bounce
→ 冰射擊
→ 冰換位追上
→ ↑Y
```
