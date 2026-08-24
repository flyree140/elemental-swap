# Elemental Swap V2｜GitHub Pages 部署與 2P 教學

這個專案是靜態 HTML / CSS / JavaScript，所以可以直接使用 GitHub Pages。

GitHub 官方目前仍支援從 repository 的某個 branch 發布，來源資料夾可選 repository 根目錄 `/(root)` 或 `/docs`。

官方參考：

```text
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://docs.github.com/en/pages/quickstart
```

---

# 方法 A：最適合初學者，直接網頁上傳

## Step 1：解壓縮 ZIP

解壓後應該看到：

```text
Elemental_Swap_V2/
├─ index.html
├─ styles.css
├─ .nojekyll
├─ js/
└─ ...
```

重要：**不要把 ZIP 本身當網頁上傳。**

---

## Step 2：GitHub 建 repository

GitHub：

```text
New repository
```

Repository name 例如：

```text
elemental-swap-v2
```

如果你是 GitHub Free，最簡單就是建立 Public repository。

---

## Step 3：Upload files

進 repository：

```text
Add file
→ Upload files
```

把 `Elemental_Swap_V2` **裡面的檔案**拖進去。

完成後 repository 根目錄必須直接看到：

```text
index.html
styles.css
js/
README.md
```

錯誤結構：

```text
elemental-swap-v2/
└─ Elemental_Swap_V2/
   └─ index.html
```

如果變成上面這種，多包一層資料夾，Pages 根目錄會找不到首頁。

---

## Step 4：開啟 Pages

Repository：

```text
Settings
→ Pages
```

Build and deployment：

```text
Source: Deploy from a branch
```

Branch：

```text
main
```

Folder：

```text
/(root)
```

按：

```text
Save
```

---

## Step 5：打開網址

Project Pages 通常是：

```text
https://你的帳號.github.io/elemental-swap-v2/
```

若你建立的是特殊 repository：

```text
你的帳號.github.io
```

則網址會是：

```text
https://你的帳號.github.io/
```

---

# 方法 B：GitHub Desktop

如果你之後會一直修改遊戲，建議改用 GitHub Desktop。

流程：

```text
Create / Clone repository
→ 把遊戲檔案放進 repository 資料夾
→ GitHub Desktop 看 Changes
→ Summary 寫更新內容
→ Commit to main
→ Push origin
```

Pages 設定完成後，每次 push 到發布 branch，GitHub 會重新發布。

---

# 方法 C：Git 指令

第一次：

```bash
git init
git add .
git commit -m "Initial Elemental Swap V2"
git branch -M main
git remote add origin https://github.com/你的帳號/elemental-swap-v2.git
git push -u origin main
```

之後：

```bash
git add .
git commit -m "feat: add new stage"
git push
```

---

# 2P 怎麼測

本專案使用 PeerJS + WebRTC DataConnection。

PeerJS 文件：

```text
https://peerjs.com/client/api/data-connection
```

## 玩家 1

1. 開 GitHub Pages 遊戲網址。
2. 按「建立房間」。
3. 等畫面產生房間代碼。
4. 把代碼傳給朋友。

## 玩家 2

1. 開同一個 GitHub Pages 網址。
2. 把代碼貼到「房間代碼」。
3. 按「加入房間」。
4. 等狀態顯示「2P 已連線」。

---

# 為什麼 GitHub Pages 沒有遊戲 server 也能 2P？

目前架構：

```text
GitHub Pages
只負責把 HTML/CSS/JS 網頁送到兩個人的瀏覽器

PeerJS signaling
協助兩邊找到彼此、交換 WebRTC 連線資訊

WebRTC DataChannel
兩個瀏覽器之間傳玩家狀態
```

所以 GitHub Pages 不需要自己執行 Node server。

---

# 目前 2P 原型同步什麼？

目前主要同步：

```text
x / y
vx / vy
面向方向
職業
HP
姿態
基本動畫狀態
換位位置事件
```

這個版本主要讓：

> 「我跟朋友打開同一個網址，可以看到彼此並一起測地圖。」

---

# 為什麼它還不是正式線上遊戲架構？

如果是正式 PvP / 高速動作遊戲，還要處理：

```text
延遲
丟包
Host作弊
兩邊同時打怪時誰說了算
敵人狀態衝突
瞬移
斷線重連
NAT / 防火牆
TURN relay
Rollback / reconciliation
```

目前是作品集與好友測試等級。

---

# 常見錯誤 1：404

檢查 GitHub repository 根目錄是不是有：

```text
index.html
```

不是：

```text
Elemental_Swap_V2/index.html
```

---

# 常見錯誤 2：畫面有 UI，但遊戲不動

F12 → Console。

看是否有：

```text
ES_CONFIG 未載入
```

確認：

```text
js/config.js
js/network.js
js/game.js
```

都存在，而且大小寫一致。

GitHub Pages 的路徑對大小寫是敏感的。

---

# 常見錯誤 3：單人可玩，2P 建房失敗

先 F12 看：

```text
Peer is not defined
```

若有，代表 PeerJS CDN 沒載到。

檢查：

```html
<script src="https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"></script>
```

公司、學校或特定網路可能會擋 CDN / WebRTC。

---

# 常見錯誤 4：兩台都在線，但 P2P 連不上

WebRTC 不一定能穿過所有 NAT / 防火牆。

正式化時可加入 TURN server。

概念：

```text
能直連 → WebRTC P2P
不能直連 → TURN 幫忙 relay
```

---

# 發布前檢查

至少跑一次：

```text
TEST_CHECKLIST.md
```

特別是：

- 10 元素全部射一次／換一次。
- 四職業都切過。
- Boss 區能到。
- GitHub Pages 沒 404。
- 兩台裝置實測建立／加入房間。
