# MiniHub 遊戲平台

純 HTML / CSS / JavaScript 的線上遊戲中心，介面參考 DroidDeck（深色、左側導覽、卡片列、大標題＋按鈕）。
無需安裝；僅在瀏覽器 localStorage 記住外觀偏好（主題模式、色彩主題）。

## 部署（GitHub Pages）
1. 把整個資料夾內容放到 GitHub 儲存庫根目錄
2. Settings → Pages → Branch 選 `main` / `(root)` → Save
3. 打開 `https://<帳號>.github.io/<儲存庫>/`

## 結構
```
index.html        主頁面
css/style.css     樣式（顏色在 :root 變數）
js/games.js       遊戲清單（新增遊戲改這裡）
js/app.js         介面邏輯
js/theme.js       主題模式 / 色彩主題（載入最早執行，避免閃爍）
js/settings.js    設定頁：帳號、顯示、外觀、語言
games/<id>/       每個遊戲一個資料夾（入口 index.html）
```

## 新增遊戲
1. 把遊戲放進 `games/<id>/index.html`
2. 在 `js/games.js` 加一筆資料，`path` 填 `games/<id>/index.html`

## 快捷鍵
← → 選擇、Enter 開始、Esc 離開遊戲。分享連結：`index.html#play=snake`

## 設定
- 帳號：顯示電子郵件、遊戲 UID。尚無登入系統，值寫在 `js/settings.js` 最上方的 `MiniHubAccount`
- 顯示：電腦版（預設）；手機版不支援
- 外觀：明亮 / 灰暗、22 組色彩主題（在 `js/theme.js` 的 `THEMES` 增減）
- 語言：繁體中文（預設）
