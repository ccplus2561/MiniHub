/**
 * 遊戲清單
 * 新增遊戲：把資料夾放進 games/，再在這裡加一筆資料。
 *   id        唯一代號（英文）
 *   title     顯示名稱
 *   category  分類（會自動產生分類按鈕）
 *   emoji     卡片圖示（之後可改成 icon: "games/xxx/icon.png"）
 *   colors    卡片漸層 [起, 終]
 *   path      遊戲入口；留空 = 顯示「即將推出」
 *   desc      一句話介紹
 *   featured  是否顯示在首頁精選
 */
window.GAMES = [
  {
    id: "snake", title: "貪吃蛇", category: "街機", emoji: "🐍",
    colors: ["#1f7a4d", "#0c3b2a"], path: "games/snake/index.html",
    desc: "經典貪吃蛇：方向鍵 / WASD 或在螢幕上滑動操作。", featured: true
  },
  {
    id: "puzzle", title: "數字方塊", category: "益智", emoji: "🧩",
    colors: ["#5b4bd6", "#2a2178"], path: "",
    desc: "把相同數字合併，挑戰更高分。", featured: true
  },
  {
    id: "memory", title: "翻牌配對", category: "益智", emoji: "🃏",
    colors: ["#c2410c", "#7c2d12"], path: "",
    desc: "記住位置，找出所有成對的卡牌。", featured: true
  },
  {
    id: "racer", title: "極速賽車", category: "競速", emoji: "🏎️",
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
