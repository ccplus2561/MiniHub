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
 *   music     false = 這款遊戲沒有背景音樂：遊戲頂端的音樂按鈕會停用（不寫 = 有音樂）
 *   tags      遊戲特色（true = ✔、false = ✘、不寫 = ─）：
 *               single 單人遊玩／multi 多人連線／desktop 支援電腦／mobileP 手機直式／
 *               kbd 鍵盤控制／touch 觸碰滑動／score 成績紀錄（個人最高與排行榜）／cloud 雲端存檔（登入後進度存雲端；遊戲內用 MiniHub.cloud(id) 讀寫）
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
    tags: { single: true, multi: false, desktop: true, kbd: true, mobileP: true, touch: true, score: true, cloud: false }
  },
  {
    id: "puzzle", title: "2048", category: "益智", emoji: "🧩", icon: "icons/puzzle.svg",
    colors: ["#5b4bd6", "#2a2178"], path: "games/puzzle/index.html",
    desc: "合併相同數字，湊出 2048！\n規則：相同數字相鄰就合併成兩倍，棋盤全滿且無法合併即結束；可用分數買道具。\n操作：方向鍵／WASD，或滑動畫面。",
    how: "", featured: true, board: { order: "desc", unit: "分", max: 5000000 },
    tags: { single: true, multi: false, desktop: true, kbd: true, mobileP: true, touch: true, score: true, cloud: false }
  },
  {
    id: "block-blast", title: "方塊消消樂", category: "益智", emoji: "🟦", icon: "icons/block-blast.svg",
    colors: ["#2b62e0", "#0a1128"], path: "games/block-blast/index.html",
    desc: "把方塊放進棋盤，填滿整排或整列就消除！\n規則：10 × 10 棋盤，每次有 3 個方塊可放；連續消除有加成，可花分數換方塊、炸彈、清橫排；沒位置可放且買不起道具即結束。\n操作：拖曳方塊到棋盤，或點選方塊後點棋盤；電腦可按 P 暫停。",
    how: "", featured: true, board: { order: "desc", unit: "分", max: 2000000 },
    tags: { single: true, multi: false, desktop: true, kbd: false, mobileP: true, touch: true, score: true, cloud: true }
  },
  {
    id: "fruit-slice", title: "水果忍者", category: "動作", emoji: "🍉", icon: "icons/fruit-slice.svg",
    colors: ["#0f766e", "#073b4c"], path: "games/fruit-slice/index.html",
    desc: "揮動刀刃切開飛出的水果，連擊越多分數越高！\n規則：60 秒內盡量得分，漏接水果會扣生命，切到炸彈直接結束。\n操作：滑鼠拖曳或手指滑動切水果。",
    how: "", featured: true, board: { order: "desc", unit: "分", max: 5000 },
    tags: { single: true, multi: false, desktop: true, kbd: false, mobileP: true, touch: true, score: true, cloud: false }
  },
  {
    id: "bingo", title: "賓果抽獎盤", category: "桌遊", emoji: "🧧", icon: "icons/bingo.svg",
    colors: ["#a8142a", "#4a0a14"], path: "games/bingo/index.html",
    desc: "聚會用的賓果抽獎盤：抽號、彩池與獎金一目了然。\n規則：主持人抽號、玩家用紙卡對號，登錄名次後自動分配獎金。\n操作：滑鼠／觸控點擊，建議用電腦或平板橫向投屏。",
    how: "", featured: false, music: false,
    tags: { single: true, multi: false, desktop: true, kbd: false, mobileP: false, touch: true, score: false, cloud: true }
  },
  {
    id: "bingo-card", title: "賓果電子卡", category: "桌遊", emoji: "🎱", icon: "icons/bingo-card.svg",
    colors: ["#1f6a80", "#143b49"], path: "games/bingo-card/index.html",
    desc: "自己填號碼的 5 × 5 賓果卡，連線就 BINGO！\n規則：填入 24 格不重複的 1～75 號碼（中央 FREE），鎖定後點擊被叫出的號碼標記，連成線即得分。\n操作：滑鼠／觸控點擊。",
    how: "", featured: false, music: false,
    tags: { single: true, multi: false, desktop: true, kbd: false, mobileP: true, touch: true, score: false, cloud: true }
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
