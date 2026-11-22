(() => {
  "use strict";

  // ══ 設定常數 ══════════════════════════════════════════
  const GAME_ID = "tetris";
  const BOARD_COLUMNS = 10;
  const BOARD_ROWS = 20;
  const SPAWN_X = Math.floor((BOARD_COLUMNS - 4) / 2);
  const BASE_DROP_INTERVAL = 850;
  const MIN_DROP_INTERVAL = 90;
  const DROP_STEP = 65;
  const LINES_PER_LEVEL = 10;
  const LINE_SCORES = [0, 100, 300, 500, 800];
  const SOFT_DROP_POINTS = 1;
  const HARD_DROP_POINTS = 2;
  const ROTATE_KICKS = [0, -1, 1, -2, 2];
  const ROTATE_LIFTS = [0, 1, 2, 3, 4];
  const SLOW_SECONDS = 10;
  const SLOW_FACTOR = 2;
  const THEME_STEP = 600;
  const TOAST_MS = 2200;
  const PENALTY_FLASH_MS = 600;
  const REPEAT_DELAY_MS = 220;
  const REPEAT_RATE_MS = 70;
  const TOP_N = 3;
  const SIDE_WIDTH = 260;

  const STATUS = { READY: "ready", RUNNING: "running", PAUSED: "paused", OVER: "over" };

  // 方塊：cells 為 [x, y]；color 對應 style.css 的顏色 class
  const PIECES = {
    I: { name: "直線方塊", color: "cyan", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { name: "正方方塊", color: "yellow", cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { name: "T 形方塊", color: "purple", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { name: "S 形方塊", color: "green", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { name: "Z 形方塊", color: "red", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { name: "J 形方塊", color: "blue", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { name: "L 形方塊", color: "orange", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
    DOT: { name: "單格方塊", color: "slate", cells: [[1, 0]] },
    DOMINO: { name: "雙格方塊", color: "pink", cells: [[1, 0], [2, 0]] },
    I3: { name: "三格直線", color: "teal", cells: [[0, 0], [1, 0], [2, 0]] },
    CORNER: { name: "三格轉角", color: "lime", cells: [[1, 0], [1, 1], [2, 1]] },
    I5: { name: "五格直線", color: "indigo", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
    RECT: { name: "長方方塊", color: "brown", cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
    P: { name: "P 形方塊", color: "magenta", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] }
  };
  const PIECE_KEYS = Object.keys(PIECES);
  const CODEX_GROUPS = [
    { title: "經典方塊", keys: ["I", "O", "T", "S", "Z", "J", "L"] },
    { title: "新增方塊", keys: ["DOT", "DOMINO", "I3", "CORNER", "I5", "RECT", "P"] }
  ];

  // 道具：每次使用扣分 = base ×（本局已使用次數 + 1）
  const PROPS = {
    reroll: { name: "換方塊", base: 100, key: "1", hint: "重抽目前的方塊", sound: "rotate" },
    clearRow: { name: "消底行", base: 300, key: "2", hint: "清除最底下一整行（不計消行數）", sound: "clear" },
    slow: { name: "減速", base: 150, key: "3", hint: `方塊下落速度變慢 ${SLOW_SECONDS} 秒`, sound: "move" }
  };
  const PROP_BY_KEY = Object.fromEntries(Object.entries(PROPS).map(([id, prop]) => [prop.key, id]));

  // 鍵盤：event.key（小寫）→ 動作
  const KEY_ACTIONS = {
    arrowleft: "left", a: "left",
    arrowright: "right", d: "right",
    arrowdown: "down", s: "down",
    arrowup: "rotate", w: "rotate",
    " ": "drop"
  };
  const PAUSE_KEY = "p";
  const CLOSE_KEY = "escape";
  const REPEAT_ACTIONS = ["left", "right", "down"];
  const ANYTIME_ACTIONS = ["pause"];

  const OVERLAYS = {
    [STATUS.READY]: { title: "準備好了嗎？", message: "按下開始，挑戰你的最高分。", button: "開始遊戲" },
    [STATUS.PAUSED]: { title: "稍作休息", message: "準備好後，繼續你的方塊挑戰。", button: "繼續遊戲" },
    [STATUS.OVER]: { title: "遊戲結束", message: "本局最高 {score} 分，再挑戰一次吧！", button: "重新開始" }
  };
  const START_LABELS = {
    [STATUS.READY]: { symbol: "▶", text: "開始遊戲" },
    [STATUS.RUNNING]: { symbol: "Ⅱ", text: "暫停遊戲" },
    [STATUS.PAUSED]: { symbol: "▶", text: "繼續遊戲" },
    [STATUS.OVER]: { symbol: "▶", text: "開始遊戲" }
  };

  // 方塊主題（依本局最高分切換，每 THEME_STEP 分換下一個）
  const THEME_COLOR_KEYS = ["cyan", "yellow", "purple", "green", "red", "blue", "orange", "slate", "pink", "teal", "lime", "indigo", "brown", "magenta"];
  const THEMES = [
    { name: "經典", style: "classic", colors: null },
    { name: "午夜", style: "dark", colors: { cyan: "#0e7490", yellow: "#b7791f", purple: "#5b3fa8", green: "#1f7a4d", red: "#a12a3a", blue: "#2745b8", orange: "#b4531a", slate: "#55657f", pink: "#a63a78", teal: "#0f766e", lime: "#5d8a1a", indigo: "#3b3f9e", brown: "#7a4a28", magenta: "#8b2a9e" } },
    { name: "熔岩", style: "lava", colors: { cyan: "#2a7f93", yellow: "#c58a12", purple: "#7a3a8c", green: "#4a7a2a", red: "#b3261e", blue: "#3b5fa8", orange: "#d1621a", slate: "#6a5a58", pink: "#b0405a", teal: "#2b7a62", lime: "#8a8f1c", indigo: "#5a4aa0", brown: "#8a4b25", magenta: "#a0307a" } },
    { name: "復古像素", style: "pixel", colors: { cyan: "#1c7fb0", yellow: "#b88400", purple: "#4b2fc0", green: "#057a05", red: "#a81f00", blue: "#0a3fb8", orange: "#c25a3a", slate: "#7a7a7a", pink: "#b24ab2", teal: "#037a3c", lime: "#7fae0a", indigo: "#2c2c8c", brown: "#7a4415", magenta: "#a8009c" } },
    { name: "冰晶", style: "ice", colors: { cyan: "#2a8fb0", yellow: "#b09a4a", purple: "#6a5ab0", green: "#2f9a7a", red: "#b04a62", blue: "#3a62b8", orange: "#b0703f", slate: "#6b7f96", pink: "#a8628f", teal: "#2a8f93", lime: "#7a9a3a", indigo: "#4a56b0", brown: "#7f6a58", magenta: "#9a52b0" } },
    { name: "金屬", style: "metal", colors: { cyan: "#4a8794", yellow: "#a8892f", purple: "#6b5a96", green: "#4f8068", red: "#8f4540", blue: "#4a64a0", orange: "#98602e", slate: "#6c7480", pink: "#96647a", teal: "#3f7a70", lime: "#7a8c3a", indigo: "#51599a", brown: "#6f5038", magenta: "#7e4b86" } },
    { name: "寶石", style: "gem", colors: { cyan: "#00838f", yellow: "#b28704", purple: "#6a1b9a", green: "#1b7a43", red: "#a30d3d", blue: "#1a3fb3", orange: "#b34f00", slate: "#5e717b", pink: "#b0306f", teal: "#00796b", lime: "#6b8e23", indigo: "#3a2a9a", brown: "#6d3f14", magenta: "#8b0f5f" } },
    { name: "日落斜紋", style: "stripe", colors: { cyan: "#2b8f85", yellow: "#c29a2e", purple: "#7a4aa8", green: "#4a8a52", red: "#b3304e", blue: "#3f41a8", orange: "#c4561e", slate: "#86708a", pink: "#c24a84", teal: "#247f70", lime: "#9aa845", indigo: "#5a48b0", brown: "#96562a", magenta: "#a82f78" } },
    { name: "大地磚", style: "mosaic", colors: { cyan: "#3f7f74", yellow: "#a88a2a", purple: "#5e4a82", green: "#3f7a3f", red: "#8f3a38", blue: "#3f5f8a", orange: "#a8661f", slate: "#6d7467", pink: "#a06a6a", teal: "#2d7468", lime: "#7a9230", indigo: "#434d82", brown: "#6a4a2e", magenta: "#7e456a" } },
    { name: "線框", style: "wire", colors: { cyan: "#0b6a82", yellow: "#a67c00", purple: "#5a2d9c", green: "#167a40", red: "#9c1c2c", blue: "#1738a8", orange: "#a64510", slate: "#4a5870", pink: "#9c2c68", teal: "#0b6a60", lime: "#557a10", indigo: "#2c308c", brown: "#6a3c1c", magenta: "#7e1c8e" } }
  ];

  // ══ DOM ═══════════════════════════════════════════════
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value).toLocaleString("en-US");
  const boardElement = $("gameBoard");
  const nextPieceElement = $("nextPiece");
  const scoreElement = $("scoreValue");
  const bestScoreElement = $("bestScore");
  const overlayElement = $("gameOverlay");
  const overlayTitleElement = $("overlayTitle");
  const overlayMessageElement = $("overlayMessage");
  const overlayStartButton = $("overlayStart");
  const startButton = $("startButton");
  const startSymbolElement = $("startSymbol");
  const startLabelElement = $("startLabel");
  const propButtons = Array.from(document.querySelectorAll("[data-prop]"));
  const padElement = $("padControls");
  const kbdBarElement = $("kbdBar");
  const codexButton = $("codexButton");
  const codexModal = $("codexModal");
  const codexClose = $("codexClose");
  const codexGrid = $("codexGrid");
  const themeNameElement = $("themeName");
  const themeNextElement = $("themeNext");
  const themeToastElement = $("themeToast");
  const sideElement = $("side");
  const sideToggle = $("sideTog");
  const meBox = $("meBox");
  const rankBox = $("rankBox");
  const meBestElement = $("meBest");
  const rankList = $("rankList");
  const appShell = document.querySelector(".app-shell");
  const boardFrame = document.querySelector(".board-frame");
  const touchOnly = matchMedia("(hover: none) and (pointer: coarse)").matches;

  // 音效只透過 window.GameAudio；失敗不能影響遊戲
  const sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      try { window.GameAudio && window.GameAudio[name](...args); } catch (e) { /* 音訊失敗不影響遊戲 */ }
    }
  });

  // ══ 狀態 ══════════════════════════════════════════════
  let board = [];
  let currentPiece = null;
  let nextPieceKey = null;
  let bag = [];
  let score = 0;
  let peak = 0;              // 本局最高分（道具會扣分，排行榜與主題以 peak 為準）
  let lines = 0;
  let level = 1;
  let elapsedSeconds = 0;
  let best = 0;              // 本次開啟頁面期間的最高分（只在記憶體）
  let status = STATUS.READY;
  let dropTimer = null;
  let clockTimer = null;
  let repeatTimer = null;
  let cellElements = [];
  let propUses = {};
  let slowRemaining = 0;
  let penaltyTimer = null;
  let toastTimer = null;
  let themeLevel = 0;
  let asking = false;        // 正在等大廳詢問「開始下一局」
  let hub = { logged: false, rankOn: false, myName: "", uid: "", best: 0, top: [], myRank: 0 };
  let userSide = null;       // 寬螢幕：右側面板是否展開（記住使用者選擇）
  let floatSide = false;     // 窄螢幕：面板浮在棋盤上，預設收合
  let floatOpen = false;

  // ══ 大廳整合（獨立開啟時 SDK 會自動略過）═════════════
  const MH = window.MiniHub;
  const lb = MH.board(GAME_ID, { top: TOP_N, onUpdate: onBoardUpdate });

  function onBoardUpdate(state) {
    hub = state;
    renderBest();
    paintRank();
  }

  function submitScore() {
    if (peak > 0) lb.submit(peak);
  }

  function leaveRound() {
    if (peak > best) best = peak;
    submitScore();
  }

  function pauseFromHub() {
    floatOpen = false;
    paintSide();
    pauseGame();
  }

  function sideIsOpen() {
    return floatSide ? floatOpen : userSide !== false;
  }

  function paintSide() {
    const open = sideIsOpen();
    sideElement.classList.toggle("closed", !open);
    sideElement.classList.toggle("float", floatSide);
    sideToggle.setAttribute("aria-expanded", String(open));
    sideToggle.title = open ? "收合" : "展開";
  }

  function fitSide() {
    const frame = boardFrame.getBoundingClientRect();
    const shell = appShell.getBoundingClientRect();
    sideElement.style.top = `${Math.max(8, Math.round(frame.top))}px`;
    sideElement.style.maxHeight = `${Math.max(160, Math.round(frame.height))}px`;
    floatSide = (innerWidth - shell.width) / 2 < SIDE_WIDTH + 12 + 34 + 8;
    paintSide();
  }

  function addRankRow(rank, name, value, className) {
    const item = document.createElement("li");
    if (className) item.className = className;
    [rank, name, value].forEach((text, index) => {
      const span = document.createElement("span");
      if (index === 2) span.className = "sc";
      span.textContent = text;
      item.appendChild(span);
    });
    rankList.appendChild(item);
  }

  function addRankGap() {
    const item = document.createElement("li");
    item.className = "gap";
    item.textContent = "⋯";
    rankList.appendChild(item);
  }

  function paintRankRows() {
    for (let index = 0; index < TOP_N; index += 1) {
      const row = hub.top[index];
      if (!row) addRankRow(`#${index + 1}`, "—", "", "empty");
      else if (row.uid === hub.uid) addRankRow(`#${index + 1}`, hub.myName, fmt(row.score), "me");
      else addRankRow(`#${index + 1}`, row.name || "*", fmt(row.score));
    }
    if (hub.top.some(row => row.uid === hub.uid)) return;
    addRankGap();
    if (hub.best > 0) addRankRow(hub.myRank ? `#${hub.myRank}` : "#?", hub.myName, fmt(hub.best), "me");
    else addRankRow("—", hub.myName, "尚無成績", "me");
  }

  function paintRank() {
    const showRank = hub.logged && hub.rankOn;
    meBox.hidden = !hub.logged;
    rankBox.hidden = !showRank;
    sideElement.hidden = !hub.logged && !showRank;   // 未登入或不允許排行榜：整個面板不顯示
    meBestElement.textContent = fmt(Math.max(hub.best || 0, peak));
    rankList.textContent = "";
    if (!sideElement.hidden) fitSide();
    if (showRank) paintRankRows();
  }

  function revealRank() {
    if (!(hub.logged && hub.rankOn)) return;
    if (floatSide) floatOpen = true; else userSide = true;
    paintSide();
  }

  function toggleSide() {
    sound.click();
    if (floatSide) floatOpen = !floatOpen; else userSide = !sideIsOpen();
    paintSide();
  }

  // 大廳「允許鍵盤快捷鍵」開啟且不是純觸控裝置：顯示底部快捷鍵提示；否則顯示畫面按鍵
  function applyInputMode() {
    const showKeys = MH.kbdOn() && !touchOnly;
    kbdBarElement.hidden = !showKeys;
    document.body.classList.toggle("pad-on", !showKeys);
    document.body.classList.toggle("has-kbd", showKeys);
  }

  function requestStart() {
    if (asking) return;
    asking = true;
    if (status === STATUS.RUNNING) pauseGame();
    leaveRound();
    MH.requestNext().then(
      ok => { asking = false; if (ok) startRound(); },
      () => { asking = false; }
    );
  }

  function requestRestart() {   // 大廳頂端「重新載入」：已開始過才處理
    if (status !== STATUS.READY) requestStart();
  }

  // ══ HUD ═══════════════════════════════════════════════
  function formatScore(value) {
    return String(Math.max(0, value)).padStart(6, "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function currentBest() {
    return Math.max(best, hub.best || 0, peak);
  }

  function renderBest() {
    bestScoreElement.textContent = formatScore(currentBest());
  }

  function getPropCost(id) {
    return PROPS[id].base * ((propUses[id] || 0) + 1);
  }

  function canUseProp(id) {
    if (status !== STATUS.RUNNING || !currentPiece) return false;
    if (score < getPropCost(id)) return false;
    if (id === "clearRow") return board[BOARD_ROWS - 1].some(cell => cell !== null);
    return true;
  }

  function renderProp(button) {
    const id = button.dataset.prop;
    const prop = PROPS[id];
    const slowActive = id === "slow" && slowRemaining > 0;
    button.querySelector(".prop-cost").textContent = `-${getPropCost(id)}`;
    button.querySelector(".prop-name").textContent = slowActive ? `${prop.name} ${slowRemaining}s` : prop.name;
    button.classList.toggle("is-active", slowActive);
    button.disabled = !canUseProp(id);
    button.setAttribute("aria-label", `${prop.name}，扣 ${getPropCost(id)} 分，本局已使用 ${propUses[id] || 0} 次`);
  }

  function renderStartButton() {
    const label = START_LABELS[status];
    startSymbolElement.textContent = label.symbol;
    startLabelElement.textContent = label.text;
  }

  function updateHUD() {
    scoreElement.textContent = formatScore(score);
    renderBest();
    propButtons.forEach(renderProp);
    renderStartButton();
  }

  function showOverlay(kind) {
    const text = OVERLAYS[kind];
    overlayTitleElement.textContent = text.title;
    overlayMessageElement.textContent = text.message.replace("{score}", fmt(peak));
    overlayStartButton.textContent = text.button;
    overlayElement.classList.remove("is-hidden");
  }

  function hideOverlay() {
    overlayElement.classList.add("is-hidden");
  }

  function flashPenalty() {
    scoreElement.classList.add("is-penalty");
    window.clearTimeout(penaltyTimer);
    penaltyTimer = window.setTimeout(() => scoreElement.classList.remove("is-penalty"), PENALTY_FLASH_MS);
  }

  // 方塊主題
  function themeThreshold(level) {
    return THEME_STEP * level;
  }

  function mixHex(hex, target, amount) {
    const parse = value => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
    const [r1, g1, b1] = parse(hex);
    const [r2, g2, b2] = parse(target);
    const channel = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
    return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
  }

  function applyTheme(index) {
    const theme = THEMES[index % THEMES.length];
    const root = document.documentElement;
    root.dataset.bstyle = theme.style;
    THEME_COLOR_KEYS.forEach(key => {
      if (theme.colors) {
        root.style.setProperty(`--b-${key}-hi`, mixHex(theme.colors[key], "#ffffff", 0.16));
        root.style.setProperty(`--b-${key}-lo`, mixHex(theme.colors[key], "#000000", 0.22));
      } else {
        root.style.removeProperty(`--b-${key}-hi`);
        root.style.removeProperty(`--b-${key}-lo`);
      }
    });
    themeNameElement.textContent = theme.name;
    themeNextElement.textContent = `下一個：${fmt(themeThreshold(index + 1))} 分`;
  }

  function showThemeToast(text) {
    themeToastElement.textContent = text;
    themeToastElement.classList.add("is-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => themeToastElement.classList.remove("is-show"), TOAST_MS);
  }

  function resetTheme() {
    themeLevel = 0;
    applyTheme(0);
    themeToastElement.classList.remove("is-show");
  }

  function checkTheme() {
    let next = themeLevel;
    while (peak >= themeThreshold(next + 1)) next += 1;
    if (next === themeLevel) return;
    themeLevel = next;
    applyTheme(next);
    renderBoard();
    renderNextPiece();
    showThemeToast(`方塊主題 · ${THEMES[next % THEMES.length].name}`);
    sound.theme();
  }

  // ══ 遊戲流程 ══════════════════════════════════════════
  function createEmptyBoard() {
    return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLUMNS).fill(null));
  }

  function shuffleBag() {
    bag = [...PIECE_KEYS];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [bag[index], bag[random]] = [bag[random], bag[index]];
    }
  }

  function drawPieceKey() {
    if (bag.length === 0) shuffleBag();
    return bag.pop();
  }

  function createPiece(key) {
    return {
      key,
      color: PIECES[key].color,
      cells: PIECES[key].cells.map(([x, y]) => [x, y]),
      x: SPAWN_X,
      y: 0
    };
  }

  function spawnPiece() {
    currentPiece = createPiece(nextPieceKey || drawPieceKey());
    nextPieceKey = drawPieceKey();
    renderNextPiece();
    return !hasCollision(currentPiece, 0, 0);
  }

  function changeScore(delta) {
    score += delta;
    if (score > peak) peak = score;
    checkTheme();
  }

  function startRound() {
    stopTimers();
    board = createEmptyBoard();
    bag = [];
    score = 0;
    peak = 0;
    lines = 0;
    level = 1;
    elapsedSeconds = 0;
    propUses = {};
    slowRemaining = 0;
    resetTheme();
    status = STATUS.RUNNING;
    nextPieceKey = drawPieceKey();
    spawnPiece();
    hideOverlay();
    updateHUD();
    renderBoard();
    startTimers();
    sound.start();
    sound.musicStart();
  }

  function pauseGame() {
    if (status !== STATUS.RUNNING) return;
    status = STATUS.PAUSED;
    stopTimers();
    stopRepeat();
    sound.musicStop();
    showOverlay(STATUS.PAUSED);
    updateHUD();
  }

  function resumeGame() {
    if (status !== STATUS.PAUSED) return;
    status = STATUS.RUNNING;
    hideOverlay();
    updateHUD();
    startTimers();
    sound.musicStart();
  }

  function togglePause() {
    if (status === STATUS.RUNNING) pauseGame();
    else resumeGame();
  }

  function endGame() {
    status = STATUS.OVER;
    stopTimers();
    stopRepeat();
    sound.musicStop();
    leaveRound();
    updateHUD();
    showOverlay(STATUS.OVER);
    revealRank();
    sound.gameOver();
  }

  function onClockTick() {
    if (status !== STATUS.RUNNING) return;
    elapsedSeconds += 1;
    if (slowRemaining > 0) {
      slowRemaining -= 1;
      if (slowRemaining === 0) refreshDropSpeed();
    }
    updateHUD();
  }

  function startTimers() {
    stopTimers();
    dropTimer = window.setInterval(tick, getDropInterval());
    clockTimer = window.setInterval(onClockTick, 1000);
  }

  function stopTimers() {
    window.clearInterval(dropTimer);
    window.clearInterval(clockTimer);
    dropTimer = null;
    clockTimer = null;
  }

  function getDropInterval() {
    const base = Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * DROP_STEP);
    return slowRemaining > 0 ? base * SLOW_FACTOR : base;
  }

  function refreshDropSpeed() {
    if (dropTimer === null) return;
    window.clearInterval(dropTimer);
    dropTimer = window.setInterval(tick, getDropInterval());
  }

  function tick() {
    if (status !== STATUS.RUNNING) return;
    if (!movePiece(0, 1)) lockPiece();
  }

  function isInside(x, y) {
    return x >= 0 && x < BOARD_COLUMNS && y >= 0 && y < BOARD_ROWS;
  }

  function hasCollision(piece, offsetX, offsetY, cells = piece.cells) {
    return cells.some(([cellX, cellY]) => {
      const x = piece.x + cellX + offsetX;
      const y = piece.y + cellY + offsetY;
      if (x < 0 || x >= BOARD_COLUMNS || y >= BOARD_ROWS) return true;
      return y >= 0 && board[y][x] !== null;
    });
  }

  function movePiece(offsetX, offsetY) {
    if (!currentPiece || hasCollision(currentPiece, offsetX, offsetY)) return false;
    currentPiece.x += offsetX;
    currentPiece.y += offsetY;
    renderBoard();
    return true;
  }

  function getRotatedCells(cells) {
    const turned = cells.map(([x, y]) => [-y, x]);
    const shiftX = Math.min(...cells.map(([x]) => x)) - Math.min(...turned.map(([x]) => x));
    const shiftY = Math.min(...cells.map(([, y]) => y)) - Math.min(...turned.map(([, y]) => y));
    return turned.map(([x, y]) => [x + shiftX, y + shiftY]);
  }

  function rotatePiece() {
    if (!currentPiece) return;
    const rotated = getRotatedCells(currentPiece.cells);
    const minY = Math.min(...rotated.map(([, y]) => y));
    for (const lift of ROTATE_LIFTS) {
      if (currentPiece.y - lift + minY < 0) break;
      for (const kick of ROTATE_KICKS) {
        if (hasCollision(currentPiece, kick, -lift, rotated)) continue;
        currentPiece.cells = rotated;
        currentPiece.x += kick;
        currentPiece.y -= lift;
        renderBoard();
        sound.rotate();
        return;
      }
    }
  }

  function shiftPiece(offsetX) {
    if (movePiece(offsetX, 0)) sound.move();
  }

  function softDrop() {
    if (movePiece(0, 1)) {
      sound.move();
      changeScore(SOFT_DROP_POINTS);
      updateHUD();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    if (!currentPiece) return;
    let distance = 0;
    while (movePiece(0, 1)) distance += 1;
    changeScore(distance * HARD_DROP_POINTS);
    sound.drop();
    lockPiece();
  }

  function mergePiece() {
    currentPiece.cells.forEach(([cellX, cellY]) => {
      const x = currentPiece.x + cellX;
      const y = currentPiece.y + cellY;
      if (isInside(x, y)) board[y][x] = currentPiece.color;
    });
  }

  function lockPiece() {
    mergePiece();
    clearCompletedLines();
    if (!spawnPiece()) {
      renderBoard();
      endGame();
      return;
    }
    renderBoard();
    updateHUD();
  }

  function clearCompletedLines() {
    const remaining = board.filter(row => row.some(cell => cell === null));
    const cleared = BOARD_ROWS - remaining.length;
    if (cleared === 0) return;
    while (remaining.length < BOARD_ROWS) remaining.unshift(Array(BOARD_COLUMNS).fill(null));
    board = remaining;
    lines += cleared;
    level = Math.floor(lines / LINES_PER_LEVEL) + 1;
    changeScore(LINE_SCORES[cleared] * level);
    refreshDropSpeed();
    sound.clear();
  }

  // 道具
  function rerollPiece() {
    const key = drawPieceKey();
    const candidate = createPiece(key);
    candidate.x = currentPiece.x;
    candidate.y = currentPiece.y;
    if (hasCollision(candidate, 0, 0)) {
      candidate.x = SPAWN_X;
      candidate.y = 0;
    }
    if (hasCollision(candidate, 0, 0)) {
      bag.push(key);
      return false;
    }
    currentPiece = candidate;
    return true;
  }

  function clearBottomRow() {
    const removed = board.pop();
    board.unshift(Array(BOARD_COLUMNS).fill(null));
    if (!hasCollision(currentPiece, 0, 0)) return true;
    board.shift();
    board.push(removed);
    return false;
  }

  function slowDown() {
    slowRemaining = SLOW_SECONDS;
    refreshDropSpeed();
    return true;
  }

  const PROP_ACTIONS = { reroll: rerollPiece, clearRow: clearBottomRow, slow: slowDown };

  function useProp(id) {
    if (!PROPS[id] || !canUseProp(id)) return;
    const cost = getPropCost(id);
    if (!PROP_ACTIONS[id]()) return;
    propUses[id] = (propUses[id] || 0) + 1;
    changeScore(-cost);
    flashPenalty();
    renderBoard();
    updateHUD();
    sound[PROPS[id].sound]();
  }

  // ══ 繪製 ══════════════════════════════════════════════
  function createBoardCells() {
    const fragment = document.createDocumentFragment();
    cellElements = [];
    for (let index = 0; index < BOARD_ROWS * BOARD_COLUMNS; index += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      fragment.appendChild(cell);
      cellElements.push(cell);
    }
    boardElement.replaceChildren(fragment);
  }

  function getGhostY() {
    let ghostY = currentPiece.y;
    while (!hasCollision(currentPiece, 0, ghostY - currentPiece.y + 1)) ghostY += 1;
    return ghostY;
  }

  function stampPiece(grid, top, ghost) {
    currentPiece.cells.forEach(([cellX, cellY]) => {
      const x = currentPiece.x + cellX;
      const y = top + cellY;
      if (!isInside(x, y)) return;
      if (ghost && grid[y][x]) return;
      grid[y][x] = { color: currentPiece.color, ghost };
    });
  }

  function buildDisplayGrid() {
    const grid = board.map(row => row.map(color => (color ? { color, ghost: false } : null)));
    if (!currentPiece) return grid;
    stampPiece(grid, getGhostY(), true);
    stampPiece(grid, currentPiece.y, false);
    return grid;
  }

  function paintCell(cell, entry) {
    cell.className = "cell";
    if (!entry) return;
    cell.classList.add(entry.color, "filled");
    if (entry.ghost) cell.classList.add("ghost");
  }

  function renderBoard() {
    if (cellElements.length === 0) return;
    buildDisplayGrid().forEach((row, y) => {
      row.forEach((entry, x) => paintCell(cellElements[y * BOARD_COLUMNS + x], entry));
    });
  }

  // 把方塊轉成以左上角為原點的格子（預覽與圖鑑共用）
  function createPieceCells(piece) {
    const minX = Math.min(...piece.cells.map(([x]) => x));
    const minY = Math.min(...piece.cells.map(([, y]) => y));
    const width = Math.max(...piece.cells.map(([x]) => x)) - minX + 1;
    const height = Math.max(...piece.cells.map(([, y]) => y)) - minY + 1;
    const fragment = document.createDocumentFragment();
    piece.cells.forEach(([x, y]) => {
      const cell = document.createElement("i");
      cell.className = piece.color;
      cell.style.gridColumn = String(x - minX + 1);
      cell.style.gridRow = String(y - minY + 1);
      fragment.appendChild(cell);
    });
    return { fragment, width, height };
  }

  function renderNextPiece() {
    if (!nextPieceKey) return;
    const { fragment, width, height } = createPieceCells(PIECES[nextPieceKey]);
    nextPieceElement.style.gridTemplateColumns = `repeat(${width}, var(--next-cell))`;
    nextPieceElement.style.gridTemplateRows = `repeat(${height}, var(--next-cell))`;
    nextPieceElement.replaceChildren(fragment);
  }

  function buildCodexCard(key) {
    const { fragment, width, height } = createPieceCells(PIECES[key]);
    const card = document.createElement("div");
    const shape = document.createElement("div");
    const name = document.createElement("strong");
    card.className = "codex-card";
    shape.className = "codex-shape";
    shape.style.gridTemplateColumns = `repeat(${width}, var(--codex-cell))`;
    shape.style.gridTemplateRows = `repeat(${height}, var(--codex-cell))`;
    shape.appendChild(fragment);
    name.textContent = PIECES[key].name;
    card.append(shape, name);
    return card;
  }

  function buildCodex() {
    const fragment = document.createDocumentFragment();
    CODEX_GROUPS.forEach(group => {
      const heading = document.createElement("h3");
      const grid = document.createElement("div");
      heading.className = "codex-group-title";
      heading.textContent = group.title;
      grid.className = "codex-grid";
      group.keys.forEach(key => grid.appendChild(buildCodexCard(key)));
      fragment.append(heading, grid);
    });
    codexGrid.replaceChildren(fragment);
  }

  function buildProps() {
    propButtons.forEach(button => {
      const prop = PROPS[button.dataset.prop];
      button.querySelector(".prop-key").textContent = prop.key;
      button.title = prop.hint;
    });
  }

  function openCodex() {
    pauseGame();
    codexModal.classList.remove("is-hidden");
    codexClose.focus();
    sound.click();
  }

  function closeCodex() {
    codexModal.classList.add("is-hidden");
    if (document.activeElement) document.activeElement.blur();
    sound.click();
  }

  // ══ 輸入 ══════════════════════════════════════════════
  const ACTION_HANDLERS = {
    left: () => shiftPiece(-1),
    right: () => shiftPiece(1),
    down: softDrop,
    rotate: rotatePiece,
    drop: hardDrop,
    pause: () => { togglePause(); sound.click(); }
  };

  function runAction(action) {
    const handler = ACTION_HANDLERS[action];
    if (!handler) return;
    if (status !== STATUS.RUNNING && !ANYTIME_ACTIONS.includes(action)) return;
    handler();
  }

  function isCodexOpen() {
    return !codexModal.classList.contains("is-hidden");
  }

  function onKeydown(event) {
    if (!MH.kbdOn()) return;
    const key = event.key.toLowerCase();
    if (isCodexOpen()) {
      if (key === CLOSE_KEY) closeCodex();
      return;
    }
    if (key === PAUSE_KEY) {
      if (status === STATUS.RUNNING || status === STATUS.PAUSED) { togglePause(); sound.click(); }
      return;
    }
    const propId = PROP_BY_KEY[key];
    if (propId) {
      event.preventDefault();
      useProp(propId);
      return;
    }
    const action = KEY_ACTIONS[key];
    if (!action) return;
    event.preventDefault();
    runAction(action);
  }

  function stopRepeat() {
    window.clearTimeout(repeatTimer);
    repeatTimer = null;
  }

  function scheduleRepeat(action, delay) {
    repeatTimer = window.setTimeout(() => {
      runAction(action);
      scheduleRepeat(action, REPEAT_RATE_MS);
    }, delay);
  }

  function onPadDown(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (event.pointerType !== "mouse" && !MH.touchOn()) return;   // 大廳關閉「允許觸控」
    event.preventDefault();
    const action = button.dataset.action;
    runAction(action);
    stopRepeat();
    if (REPEAT_ACTIONS.includes(action)) scheduleRepeat(action, REPEAT_DELAY_MS);
  }

  function onStartButton() {
    if (status === STATUS.READY || status === STATUS.OVER) requestStart();
    else togglePause();
    sound.click();
    startButton.blur();
  }

  function onOverlayButton() {
    if (status === STATUS.PAUSED) resumeGame();
    else requestStart();
    sound.click();
    overlayStartButton.blur();
  }

  function onPropButton(event) {
    const button = event.currentTarget;
    if (!canUseProp(button.dataset.prop)) sound.click();   // 無法使用也給點擊回饋
    useProp(button.dataset.prop);
    button.blur();
  }

  function onVisibilityChange() {
    if (document.hidden) pauseGame();
  }

  function onCodexBackdrop(event) {
    if (event.target === codexModal) closeCodex();
  }

  // ══ 啟動 ══════════════════════════════════════════════
  function bindEvents() {
    startButton.addEventListener("click", onStartButton);
    overlayStartButton.addEventListener("click", onOverlayButton);
    propButtons.forEach(button => button.addEventListener("click", onPropButton));
    codexButton.addEventListener("click", openCodex);
    codexClose.addEventListener("click", closeCodex);
    codexModal.addEventListener("click", onCodexBackdrop);
    sideToggle.addEventListener("click", toggleSide);
    padElement.addEventListener("pointerdown", onPadDown);
    document.addEventListener("pointerup", stopRepeat);
    document.addEventListener("pointercancel", stopRepeat);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    addEventListener("resize", () => { if (!sideElement.hidden) fitSide(); });
    addEventListener("pagehide", leaveRound);
  }

  function initializeGame() {
    board = createEmptyBoard();
    createBoardCells();
    nextPieceKey = drawPieceKey();
    buildProps();
    buildCodex();
    resetTheme();
    renderNextPiece();
    renderBoard();
    updateHUD();
    showOverlay(STATUS.READY);
    bindEvents();
    applyInputMode();
    MH.onChange(applyInputMode);
    MH.onPause(pauseFromHub);        // 大廳要求暫停（window.MiniHubPause）
    MH.onRestart(requestRestart);    // 大廳頂端「重新載入」
    lb.refresh();
  }

  initializeGame();
})();
