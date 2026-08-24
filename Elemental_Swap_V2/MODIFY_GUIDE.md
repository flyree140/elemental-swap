# Elemental Swap V2｜完整中文修改教學

這份教學的目標不是只告訴你「哪一行改數字」，而是讓你理解這個專案之後要怎麼長大。

---

# 0. 先建立一個觀念：資料跟規則要分開

目前專案最重要的三個 JS：

```text
js/config.js   → 資料表：數字、名稱、顏色、敵人模板、職業模板、按鍵
js/game.js     → 規則：移動、攻擊、元素命中、換位、AI、機關
js/network.js  → 連線：建立房間、加入房間、傳送玩家狀態
```

如果你只是想：

- 火球傷害 18 改成 30
- 冰球速度 300 改成 230
- 召喚師 HP 135 改成 150
- 某隻怪血量加倍

**只改 `config.js`。**

如果你想：

- 火換位不是爆炸，而是留下火焰路徑
- 新增「毒素會疊層」
- Boss 半血後會瞬移
- 箱子碰到雷變成磁鐵

才需要改 `game.js`。

---

# 1. 建議使用的工具

初學可以先用：

- Visual Studio Code
- Chrome / Edge
- GitHub Desktop（不想背 Git 指令時）

在 VS Code 打開整個 `Elemental_Swap_V2` 資料夾，不要只單獨開 `index.html`。

推薦啟動本機伺服器：

```bash
python -m http.server 8000
```

瀏覽器開：

```text
http://localhost:8000
```

每次修改 JS 後：

1. `Ctrl + S`
2. 回瀏覽器
3. `Ctrl + Shift + R` 強制重新整理
4. F12 → Console 看有沒有紅字

---

# 2. 最常改：元素資料

打開：

```text
js/config.js
```

找到：

```js
ELEMENTS: [
```

例如火元素：

```js
{
  id: "fire",
  name: "火焰",
  glyph: "火",
  color: "#ff5a36",
  speed: 410,
  gravity: 0,
  damage: 18,
  size: 13,
  markDuration: 7,
  description: "燃燒持續傷害；換位時在新舊位置各引爆一次。"
}
```

各欄位：

| 欄位 | 意義 |
|---|---|
| `id` | 程式辨識名稱，改了就要同步改 game.js |
| `name` | UI 顯示名稱 |
| `glyph` | 子彈與標記上顯示的中文字 |
| `color` | 顏色 |
| `speed` | 初速 |
| `gravity` | 彈丸下墜；0 為直線、正數向下、負數會飄 |
| `damage` | 命中傷害 |
| `size` | 彈丸大小 |
| `markDuration` | 敵人元素標記維持秒數 |
| `description` | UI 提示 |

## 範例：讓冰彈更像慢速拋射物

原本：

```js
speed: 300,
gravity: 260,
```

可以改：

```js
speed: 220,
gravity: 420,
```

這樣就會更像「拋一塊冰晶」，跟高速雷電更容易感覺出差異。

---

# 3. 元素命中敵人要改哪裡？

打開：

```text
js/game.js
```

搜尋：

```js
applyElementHit(e,el,s)
```

裡面有：

```js
switch(el.id) {
  case "fire":
    e.burn = 4.5;
    break;

  case "ice":
    e.slow = 5;
    e.vx *= 0.25;
    break;
}
```

這代表：

```text
config.js
決定「火球數字」

applyElementHit()
決定「火球打到怪之後，規則上發生什麼」
```

## 範例：把冰改成完全凍結 1 秒

在 `case "ice"` 改成：

```js
case "ice":
  e.slow = 5;
  e.stun = Math.max(e.stun, 1.0);
  e.vx = 0;
  break;
```

這就會從「緩速」變成真正的凍結。

---

# 4. 元素換位效果要改哪裡？

搜尋：

```js
applySwapEffect(el,old,target)
```

例如冰：

```js
case "ice":
  this.tempPlatforms.push({
    x: old.x - 25,
    y: old.y + p.h - 12,
    w: 105,
    h: 18,
    t: 6,
    type: "ice"
  });
  break;
```

意思是：

> 玩家從 A 換到 B 後，A 的舊位置生成一塊 6 秒冰平台。

你可以把：

```js
t: 6
```

改成：

```js
t: 12
```

冰台就存在 12 秒。

---

# 5. 怎麼新增第 11 種元素？以「毒」示範

目前快捷鍵只預留 1–0 共 10 格，因此要真正變 11 種，需要同時新增按鍵。

假設使用 `E` 當毒元素。

## Step 1：在 ELEMENTS 最後加資料

```js
{
  id: "poison",
  name: "劇毒",
  glyph: "毒",
  color: "#9be34b",
  speed: 315,
  gravity: 80,
  damage: 5,
  size: 13,
  markDuration: 12,
  description: "低直接傷害，但會持續中毒；換位留下毒霧。"
}
```

## Step 2：DEFAULT_KEYS 新增

```js
element11: "KeyE",
```

`ACTION_LABELS` 也新增：

```js
element11: "劇毒",
```

## Step 3：game.js 原本只檢查 10 個元素

搜尋：

```js
for (let i=0;i<10;i++)
```

改成：

```js
for (let i=0;i<C.ELEMENTS.length;i++)
```

更推薦你直接永久改成這種寫法，之後加第 12 種也不用再改。

## Step 4：命中效果

在 `applyElementHit()` 增加：

```js
case "poison":
  e.poison = 8;
  break;
```

接著敵人的物件初始化時，加：

```js
poison: 0,
```

在 `updateEnemies(dt)` 裡加：

```js
if (e.poison > 0) {
  e.poison -= dt;
  e.hp -= 3 * dt;
}
```

## Step 5：換位效果

在 `applySwapEffect()` 加：

```js
case "poison":
  this.effects.push({
    type: "poisonCloud",
    x: old.x,
    y: old.y,
    t: 6,
    color: el.color,
    r: 180
  });
  break;
```

再到 `updateEffects()` 寫毒霧碰敵人的規則。

這就是完整的新元素流程：

```text
config.js 資料
↓
鍵位
↓
fireElement 發射（共用）
↓
applyElementHit 命中效果
↓
applySwapEffect 換位效果
↓
draw / effect 如果需要新視覺
```

---

# 6. Combo 怎麼改？

搜尋：

```js
doCommand(kind)
```

最重要的參數：

```js
damage
range
knockX
knockY
duration
```

生活化理解：

```text
damage   = 打多痛
range    = 手伸多長
knockX   = 往左右噴多遠
knockY   = 往上或往下飛多少
duration = 這一招動作鎖多久
```

`knockY` 是負數代表往上。

所以挑空現在是：

```js
knockY = -520;
```

若你想做得更誇張：

```js
knockY = -780;
```

敵人就會被打得更高，可以讓空中追擊更明顯。

---

# 7. 如何新增一組 Command？例如 Z → X → X

現在原型用 `attackStep` 記住玩家是否在短時間內繼續輸入。

如果要做完整格鬥指令樹，推薦下一版把：

```js
attackStep
attackKind
```

改成：

```js
commandBuffer = ["Z", "X", "X"]
```

然後用表格：

```js
const COMMANDS = {
  "Z": {...},
  "Z,Z": {...},
  "Z,Z,X": {...},
  "Z,X,X": {...},
  "X,X,Z": {...}
};
```

這會比一直寫 if/else 更適合之後擴大成艾爾之光式 Command Tree。

推薦 V2.2 就優先重構這裡。

---

# 8. 技能在哪裡改？

搜尋：

```js
useSkill(index)
```

它負責：

```text
檢查 CD
檢查 MP
扣 MP
設定 CD
根據職業呼叫不同技能
```

接著：

```js
riftSkill(i)
summonerSkill(i)
beastSkill(i)
artificerSkill(i)
```

各自是四職業的 C/V/B。

## 改 MP 消耗

搜尋：

```js
skillCost(index)
```

目前：

```js
return [25,38,70][index];
```

即：

```text
C = 25 MP
V = 38 MP
B = 70 MP
```

---

# 9. 新增第五職業

假設叫：

> 時序術士

## Step 1：config.js → CLASSES

```js
chronomancer: {
  id: "chronomancer",
  name: "時序術士",
  icon: "⌛",
  maxHp: 125,
  maxMp: 210,
  moveScale: 0.95,
  summary: "記錄位置、回溯與延遲爆發。",
  skills: ["延遲裂隙", "時間回溯", "零刻界"]
}
```

HTML 的職業選單不用手動加，因為它是：

```js
Object.values(C.CLASSES)
```

會自動生成。

## Step 2：useSkill()

新增：

```js
else if(id === "chronomancer") this.chronoSkill(index);
```

## Step 3：新增函式

```js
chronoSkill(i) {
  if (i === 0) {
    // 延遲 1 秒後爆炸
  }

  if (i === 1) {
    // 回到 3 秒前位置
  }

  if (i === 2) {
    // 大範圍時間停止
  }
}
```

## Step 4：Q

到 `useClassSkill()` 新增時序術士分支。

---

# 10. 新增敵人

## config.js 先加模板

例如：

```js
assassin: {
  name: "影刃刺客",
  hp: 80,
  speed: 190,
  damage: 17,
  type: "assassin",
  color: "#573f71"
}
```

## buildWorld() 放進地圖

```js
this.spawnEnemy("assassin", 7200, C.GROUND_Y - 58);
```

## updateEnemies() 加 AI

```js
else if (e.type === "assassin") {
  // 例如距離遠就快速接近，近距離瞬移到玩家背後
}
```

建議每種敵人問自己三個問題：

1. 玩家看到它時，第一眼要改變什麼打法？
2. 哪個元素特別克制它？
3. 換位到它身上有沒有特殊風險或獎勵？

這樣敵人比較不會只是「HP 不同的同一隻怪」。

---

# 11. NPC 對話怎麼改？

都在：

```js
NPCS: [ ... ]
```

例如：

```js
{
  name: "機巧匠・鉚釘",
  role: "補給與改裝",
  x: 4700,
  text: "我先免費幫你補滿 HP 與 MP。"
}
```

`x` 是世界座標。

目前 NPC 是一句對話。

之後可以升級成：

```js
dialogue: [
  "第一句",
  "第二句",
  "第三句"
]
```

再新增 `dialogueIndex`。

---

# 12. 地圖怎麼拉長？

config.js：

```js
WORLD_WIDTH: 18000,
```

如果要 30,000：

```js
WORLD_WIDTH: 30000,
```

但不要只改這一個數字。

你還需要：

1. `ZONES` 新增區段。
2. `buildWorld()` 增加地板。
3. 增加平台／敵人／NPC／檢查點。
4. Boss 位置重新配置。

---

# 13. 地形怎麼新增？

平台：

```js
this.platforms.push({
  x: 5000,
  y: 430,
  w: 300,
  h: 24,
  type: "platform"
});
```

基本單位：

```text
x = 世界左右位置
y = 距畫面頂端位置，越小越高
w = 寬
h = 高
```

---

# 14. 新增一個元素解謎機關

假設要做「風車門」。

## buildWorld()

```js
this.puzzles.push({
  type: "windmill",
  x: 6200,
  y: 500,
  w: 80,
  h: 100,
  power: 0
});
```

## handlePuzzleElementHit()

```js
if (z.type === "windmill" && el.id === "wind") {
  z.power++;

  if (z.power >= 3) {
    // 開門
  }
}
```

## drawPuzzles()

補一個：

```js
else if (z.type === "windmill") {
  // 畫風車
}
```

所以任何新機關通常都有三步：

```text
建立資料
→ 寫互動規則
→ 畫出來
```

---

# 15. 如何替換成 itch.io Sprite？

目前 Canvas 是直接用：

```js
ctx.fillRect(...)
```

例如 `drawPlayer()`。

如果你有：

```text
assets/player.png
```

可以在遊戲初始化前：

```js
const playerImg = new Image();
playerImg.src = "assets/player.png";
```

然後原本：

```js
ctx.fillRect(...)
```

改：

```js
ctx.drawImage(
  playerImg,
  p.x,
  p.y,
  p.w,
  p.h
);
```

真正做動畫時則要使用 Sprite Sheet：

```js
ctx.drawImage(
  image,
  sourceX, sourceY, frameWidth, frameHeight,
  drawX, drawY, drawWidth, drawHeight
);
```

推薦你之後建立：

```text
assets/
├─ characters/
├─ enemies/
├─ tiles/
├─ effects/
├─ ui/
└─ audio/
```

---

# 16. 自訂按鍵的結構

預設鍵在：

```js
DEFAULT_KEYS
```

玩家修改後存在：

```js
localStorage.setItem("esv2_keys", ...)
```

所以重新整理後還在。

清除測試：

F12：

```js
localStorage.removeItem("esv2_keys")
```

再重新整理。

---

# 17. 2P 程式怎麼看？

`network.js` 幾乎完全獨立。

最重要三個概念：

```text
createRoom()
建立 Peer，等待另一個玩家連進來

joinRoom(code)
建立 Peer，主動 connect 到 Host

sendState()
固定頻率傳自己的狀態
```

目前約每 50ms 傳一次：

```js
if (nowMs - this.lastSent < 50) return;
```

也就是大約：

```text
20 次 / 秒
```

遊戲畫面仍是 60fps 左右，遠端玩家可以日後再加 interpolation 平滑化。

---

# 18. 為什麼 GitHub Pages 可以放這個遊戲？

因為現在主體是：

```text
HTML
CSS
JavaScript
```

沒有要求 GitHub Pages 執行 Node.js server。

PeerJS signaling 是外部服務；玩家真正的資料連線走 WebRTC DataConnection。

這很適合：

- Demo
- 朋友測試
- 個人作品集
- 面試展示

但不代表適合：

- 大型 MMO
- 排名競技
- 防作弊要求很高的遊戲
- 房主不能被信任的 PvP

---

# 19. Debug 指令

## 傳送

```js
ElementalSwap.debug.teleport(9000)
```

## Boss

```js
ElementalSwap.debug.boss()
```

## 補滿

```js
ElementalSwap.debug.heal()
```

## 切職業

```js
ElementalSwap.debug.class("rift")
ElementalSwap.debug.class("summoner")
ElementalSwap.debug.class("beast")
ElementalSwap.debug.class("artificer")
```

## 直接觸發元素鍵

```js
ElementalSwap.debug.element("fire")
ElementalSwap.debug.element("ice")
```

## 生怪

```js
ElementalSwap.debug.spawn("slime")
ElementalSwap.debug.spawn("golem")
ElementalSwap.debug.spawn("mage", 12000)
```

---

# 20. 我最推薦的下一步開發順序

不要一次做 RPG 所有東西。建議：

## V2.2：戰鬥手感

1. Command Buffer
2. 完整 Z/X 指令樹
3. 動畫取消窗口
4. 受身
5. 倒地
6. Super Armor
7. Boss Break Gauge

## V2.3：技能成長

1. 技能樹
2. 每技能兩個分支
3. 元素強化
4. 職業被動

## V2.4：遊戲循環

1. 掉寶
2. 裝備
3. 商店
4. NPC 任務
5. 存檔

## V2.5：多人強化

1. 遠端插值
2. Host authoritative enemy state
3. 房間重新連線
4. TURN
5. 玩家倒地救援
6. 2P 專屬合作機關

---

# 21. 修改前最重要的習慣

每完成一個小功能就 commit：

```text
feat: add poison element
fix: prevent ice platform collision bug
balance: slow lightning projectile
map: expand beast forest
```

這樣某次改壞時，你可以回到上一個可玩的版本，而不是整份程式一起報廢。
