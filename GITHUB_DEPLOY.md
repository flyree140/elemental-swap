# GitHub Pages 覆蓋成 V5

1. 下載 `Elemental_Swap_V5_GitHub_Ready.zip`。
2. 解壓縮。
3. 把解壓後的所有內容上傳到原 GitHub Repository 根目錄並覆蓋舊檔。
4. 確認根目錄直接存在：

```text
index.html
styles.css
js/
assets/
```

5. Repository → `Settings` → `Pages`。
6. Source 選 `Deploy from a branch`。
7. Branch 選 `main`，Folder 選 `/(root)`。
8. 儲存並等待重新發布。

不要只上傳 `index.html`。`index.html` 是多檔專案入口，必須和 `styles.css`、`js/`、`assets/` 一起存在。

本機單獨測試請開 ZIP 內的 `Elemental_Swap_V5_Standalone.html`，或執行：

```bash
python -m http.server 8000
```
