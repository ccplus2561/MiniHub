/**
 * 遊戲清單
 * 新增遊戲：把資料夾放進 games/，再在這裡加一筆資料。
 *   id        唯一代號（英文）
 *   title     顯示名稱
 *   category  分類（街機／益智／動作／桌遊／紙牌／射擊／音樂；按鈕由 app.js 固定產生）
 *   emoji     卡片圖示（之後可改成 icon: "games/xxx/icon.png"）
 *   colors    卡片漸層 [起, 終]
 *   path      遊戲入口；留空 = 顯示「封測中」
 *   desc      一句話介紹
 *   featured  是否顯示在首頁精選
 *   board     排行榜規格（沒有排行榜的遊戲不要寫）：
 *               order   "desc" = 分數越高越好；"asc" = 越低越好（例如用時）
 *               unit    單位文字（例如 "分"、"秒"）
 *               max     最大合理值（選填；超過視為不合法、不寫入）
 *               modes   多個排行榜（選填，例如 ["easy","hard"]，限小寫英數；第一個為預設）
 *               fields  允許附帶儲存的額外欄位（選填，例如 ["level"]，最多 5 個）
 *             遊戲裡只要呼叫 MiniHub.board(id, ...).submit(分數)；Firebase 的存取、排序、
 *             刪除帳號時的清除，大廳都會依這份規格自動處理，不需要再改 firebase.js。
 */
window.GAMES = [
  {
    id: "snake", title: "貪吃蛇", category: "街機", emoji: "🐍", icon: "icons/snake.svg",
    colors: ["#1f7a4d", "#0c3b2a"], path: "games/snake/index.html",
    desc: "經典街機遊戲，操控小蛇吃食物、越長越高分。\n規則：20 × 20 地圖，撞牆或撞到自己即結束。\n操作：方向鍵／WASD，或在畫面上滑動、拖曳。",
    how: "", featured: true, board: { order: "desc", unit: "分", max: 400 },
    tags: { single: true, multi: false, mobile: true, desktop: true, kbd: true, touch: true, rank: true, personal: true }
  },
  {
    id: "puzzle", title: "2048", category: "益智", emoji: "🧩", icon: "icons/puzzle.svg",
    colors: ["#5b4bd6", "#2a2178"], path: "games/puzzle/index.html",
    desc: "合併相同數字，湊出 2048！\n規則：相同數字相鄰就合併成兩倍，棋盤全滿且無法合併即結束；可用分數買道具。\n操作：方向鍵／WASD，或滑動畫面。",
    how: "", featured: true, board: { order: "desc", unit: "分", max: 5000000 },
    tags: { single: true, multi: false, mobile: true, desktop: true, kbd: true, touch: true, rank: true, personal: true }
  },
  {
    id: "memory", title: "翻牌配對", category: "益智", emoji: "🃏",
    colors: ["#c2410c", "#7c2d12"], path: "",
    desc: "記住位置，找出所有成對的卡牌。", featured: true
  },
  {
    id: "racer", title: "極速賽車", category: "街機", emoji: "🏎️",
    colors: ["#b91c1c", "#4c0f0f"], path: "",
    desc: "閃避障礙，跑得越遠分數越高。", featured: true
  },
  {
    id: "shooter", title: "星際防衛", category: "射擊", emoji: "🚀",
    colors: ["#0e7490", "#14284b"], path: "",
    desc: "擊退來襲的外星艦隊。", featured: true
  },
  {
    id: "rhythm", title: "節奏點點", category: "音樂", emoji: "🎵",
    colors: ["#be185d", "#4a0d2e"], path: "",
    desc: "跟著節拍點擊，連擊越高越爽。", featured: true
  }
];
