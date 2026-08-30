# 十元素程式修改指南

元素資料在：

```text
js/config.js → ES4.ELEMENTS
```

元素規則在：

```text
js/game.js
```

主要函式：

```text
elementPress(index)       按元素鍵時，判斷發射或換位
fireElement(element)      建立彈丸
updateProjectiles(dt)     彈丸飛行、引力吸附、命中
applyElementHit(...)      命中敵人狀態
swapElement(...)          真正交換位置
elementSwapEffect(...)    元素換位能力
updateFields(dt)          火區、噴泉、引力井、分身等持續效果
handleElementPuzzle(...)  解謎機關
checkElementCombo(...)    雙元素連鎖
```

## 火焰

設定：

```js
{id:'fire', damage:16, ...}
```

命中後：

```js
e.burn = 5;
e.burnTick = 0;
```

`updateEnemies()` 每隔一段時間造成燃燒傷害。

換位後建立兩個：

```js
{type:'flame', life:4, r:115}
```

`updateFields()` 會持續檢查敵人是否位於火區內。

## 冰平台

冰換位會加入：

```js
this.tempSolids.push({
  type:'ice',
  life:10,
  oneWay:true
});
```

它會被 `activeSolids()` 納入碰撞，因此是真的可站立地形，不只是動畫。

## 引力吸怪

引力有兩層：

### 飛行中的引力彈

`updateProjectiles()` 每幀對半徑內敵人、箱子、核心球施加速度。

### 換位後引力井

`elementSwapEffect()` 建立：

```js
{type:'gravity', life:7, r:310}
```

`updateFields()` 在 7 秒內持續吸引物件。

調強吸力時，搜尋：

```text
pullObjects
```

## 新增第十一元素

1. 在 `config.js` 的 `ELEMENTS` 加資料。
2. 在 `DEFAULT_KEYS` 加按鍵。
3. 在 `ACTION_LABELS` 加文字。
4. 在 `applyElementHit()` 加命中狀態。
5. 在 `elementSwapEffect()` 加換位能力。
6. 在 `handleElementPuzzle()` 加機關。
7. 在 `assets/vfx/` 加 `element_<id>.png`。
8. 在素材生成器加入對應動畫，或直接放自己的 Sprite Sheet。
