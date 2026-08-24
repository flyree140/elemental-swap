# 素材與第三方函式庫說明

## 本重建版的視覺素材

目前遊戲畫面中的角色、敵人、平台、元素球、特效、HUD 幾何圖形皆由本專案使用 HTML Canvas / CSS 程序繪製，沒有把 itch.io 的圖檔包進專案。

這樣做的目的：

- 下載 ZIP 後不會因素材網址失效而壞掉。
- GitHub Pages 可直接部署。
- 你之後可自由把 itch.io、自己畫的 Sprite 或付費素材替換進 `assets/`。

## PeerJS

2P 原型在 `index.html` 透過 CDN 載入 PeerJS：

```text
https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js
```

PeerJS 專案與授權請以官方頁面及其 repository 為準：

```text
https://peerjs.com/
https://github.com/peers/peerjs
```

## 之後使用 itch.io 素材時

每一個 itch.io asset pack 的授權可能不同。不要因為「Free」就直接假設可以商用、改作或免署名。

建議在 `assets/credits/` 建立紀錄，例如：

```text
素材包名稱：
作者：
來源頁：
License：CC0 / CC BY / 個別授權條款
是否可商用：
是否需要署名：
下載日期：
用在哪些檔案：
```

正式發布前逐包確認授權頁。
