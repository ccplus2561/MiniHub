(() => {
  "use strict";

  // 設定常數
  const GAME_ID = "ooxx";
  const MH = window.MiniHub;                       // 大廳共用 SDK（單獨開啟時也有安全預設值）
  const QS = new URLSearchParams(location.search);
  const SOLO = QS.get("mode") === "solo";          // 由 OOXX 大廳決定：?mode=solo 單人，?mode=online 雙人連線，其餘同機雙人
  const ONLINE = QS.get("mode") === "online" && !!window.OOXXOnline;
  const ROOM_ID = ONLINE ? window.OOXXOnline.normalizeId(QS.get("room")) : "";
  const storeKey = () => (SOLO ? `${GAME_ID}:solo:v1` : `${GAME_ID}:v1`);
  const AI_DELAY = 550;
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  const SYMBOL = { X: "×", O: "○" };
  const other = p => (p === "X" ? "O" : "X");
  const num = s => (s === state.p1 ? 1 : 2);
  const isAI = s => SOLO && s === other(state.p1);
  let room = null;                                  // 連線模式：目前房間資料（由 OOXXOnline 同步）
  const mySym = () => (!room ? "" : room.hostUid === window.OOXXOnline.me().uid ? "X" : room.guestUid === window.OOXXOnline.me().uid ? "O" : "");
  const onlineName = s => {
    const n = s === "X" ? (room && room.hostName) : (room && room.guestUid ? room.guestName : "");
    return (n || (s === "O" ? "等待加入…" : "玩家 1")) + (mySym() === s ? "（你）" : "");
  };
  const nameOf = s => (ONLINE ? onlineName(s) : SOLO ? (isAI(s) ? "電腦" : "你") : `玩家 ${num(s)}`);
  const labelOf = s => (SOLO ? (isAI(s) ? "AI" : "YOU") : `PLAYER 0${num(s)}`);

  // DOM
  const $ = id => document.getElementById(id);
  const els = {
    board: $("board"),
    cells: Array.from(document.querySelectorAll("#board .cell")),
    banner: $("turn-banner"),
    turnIcon: $("turn-icon"),
    turnLabel: $("turn-label"),
    turnName: $("turn-name"),
    card: { X: $("card-x"), O: $("card-o") },
    status: { X: $("status-x"), O: $("status-o") },
    score: { X: $("score-x"), O: $("score-o"), draw: $("score-draw") },
    match: $("match"),
    restart: $("restart-btn"),
    hint: $("hint"),
    pick: $("pick"),
    name: { X: $("name-x"), O: $("name-o") },
    label: { X: $("label-x"), O: $("label-o") },
    modeTag: $("mode-tag"),
    repick: $("repick-btn"),
    soloOpts: $("solo-opts"),
    soloStart: $("solo-start"),
    soloScore: $("solo-score"),
    sc: { win: $("sc-win"), draw: $("sc-draw"), loss: $("sc-loss") },
    pickTitle: $("pick-title"),
    roomBar: $("room-bar"), roomCode: $("room-code"), roomTitle: $("room-title"),
    roomCopy: $("room-copy"), roomExit: $("room-exit"),
    notice: $("notice"), noticeTitle: $("notice-title"), noticeDesc: $("notice-desc"),
    noticeOk: $("notice-ok"), noticeCancel: $("notice-cancel")
  };
  const IS_TOUCH = window.matchMedia && window.matchMedia("(hover: none)").matches;
  // 提示文字依大廳的「鍵盤」設定顯示
  const defaultHint = () => (IS_TOUCH || !MH.kbdOn() ? "輕觸棋盤格子即可落子。" : "點擊棋盤落子，也可按 1–9 鍵；按 R 重新開始。");
  els.hint.textContent = defaultHint();
  let hintTimer = 0;
  let aiTimer = 0;
  let paused = false;
  let asking = false;

  // 狀態
  const state = {
    board: Array(9).fill(null),
    turn: "X",
    starter: "X",
    over: false,
    winLine: null,
    round: 1,
    p1: "X",
    picking: true,
    scores: { X: 0, O: 0, draw: 0 }
  };

  // 本機儲存
  const isCount = n => Number.isInteger(n) && n >= 0 && n < 100000;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(storeKey()) || "null");
      if (!d || typeof d !== "object") return;
      const s = d.scores || {};
      if (isCount(s.X) && isCount(s.O) && isCount(s.draw)) {
        state.scores = { X: s.X, O: s.O, draw: s.draw };
      }
      if (Number.isInteger(d.round) && d.round >= 1 && d.round < 100000) state.round = d.round;
      if (d.starter === "X" || d.starter === "O") state.starter = d.starter;
    } catch (e) { /* 讀取失敗就使用預設值 */ }
  }

  function save(round, starter) {
    try {
      localStorage.setItem(storeKey(), JSON.stringify({ scores: state.scores, round, starter }));
    } catch (e) { /* 無法儲存時忽略 */ }
  }

  // 大廳整合：開始下一局前先詢問大廳（未登入會跳出同意條款），回傳 false 就不開始
  async function askNext() {
    if (asking) return false;
    asking = true;
    try { return (await MH.requestNext()) !== false; }
    catch (e) { return true; }
    finally { asking = false; }
  }

  function flashHint(text) {
    els.hint.textContent = text;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { els.hint.textContent = defaultHint(); hintTimer = 0; }, 2600);
  }

  // 遊戲流程
  function findWin(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { player: board[a], line };
      }
    }
    return null;
  }

  function play(i, fromAI) {
    if (ONLINE) { onlineMove(i); return; }
    if (state.picking) return;
    if (SOLO && isAI(state.turn) && !fromAI) return;
    if (state.over || state.board[i]) {
      if (!state.over) window.NeonAudio && window.NeonAudio.play("invalid");
      return;
    }
    const player = state.turn;
    state.board[i] = player;

    const win = findWin(state.board);
    if (win) {
      state.over = true;
      state.winLine = win.line;
      state.scores[win.player] += 1;
      save(state.round + 1, other(state.starter));
      window.NeonAudio && window.NeonAudio.play("win");
    } else if (state.board.every(Boolean)) {
      state.over = true;
      state.scores.draw += 1;
      save(state.round + 1, other(state.starter));
      window.NeonAudio && window.NeonAudio.play("draw");
    } else {
      state.turn = other(player);
      window.NeonAudio && window.NeonAudio.play(player === "X" ? "x" : "o");
    }
    render();
    scheduleAI();
  }

  // ===== AI：完整 minimax + alpha-beta（不會輸；有機會就贏，且偏好最快獲勝／最慢落敗）=====
  function minimax(board, turn, me, depth, alpha, beta) {
    const w = findWin(board);
    if (w) return w.player === me ? 10 - depth : depth - 10;
    if (board.every(Boolean)) return 0;
    const maximizing = turn === me;
    let best = maximizing ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = turn;
      const v = minimax(board, other(turn), me, depth + 1, alpha, beta);
      board[i] = null;
      if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
      else { best = Math.min(best, v); beta = Math.min(beta, v); }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseAIMove() {
    const me = other(state.p1);
    const board = state.board.slice();
    const empty = board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    if (empty.length === 9) {                       // 開局：角或中心皆最優，隨機增加變化
      const opening = [0, 2, 4, 6, 8];
      return opening[Math.floor(Math.random() * opening.length)];
    }
    let bestScore = -Infinity, moves = [];
    for (const i of empty) {
      board[i] = me;
      const v = minimax(board, other(me), me, 1, -Infinity, Infinity);
      board[i] = null;
      if (v > bestScore) { bestScore = v; moves = [i]; }
      else if (v === bestScore) moves.push(i);
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function scheduleAI() {
    clearTimeout(aiTimer);
    if (paused || !SOLO || state.picking || state.over || !isAI(state.turn)) return;
    aiTimer = setTimeout(() => {
      if (state.picking || state.over || !isAI(state.turn)) return;
      play(chooseAIMove(), true);
    }, AI_DELAY);
  }

  async function newRound() {
    if (ONLINE) { onlineRematch(); return; }
    if (state.picking) return;
    clearTimeout(aiTimer);
    if (!(await askNext())) { scheduleAI(); return; }
    if (state.picking) return;
    if (state.over) {
      state.round += 1;
      state.starter = other(state.starter);
    }
    state.board = Array(9).fill(null);
    state.turn = state.starter;
    state.over = false;
    state.winLine = null;
    window.NeonAudio && window.NeonAudio.play("reset");
    render();
    scheduleAI();
  }

  // 繪製
  function makeMark(player) {
    const span = document.createElement("span");
    if (player === "X") {
      span.className = "mark mark-x";
      span.appendChild(document.createElement("i"));
      span.appendChild(document.createElement("i"));
    } else {
      span.className = "mark mark-o";
      span.appendChild(document.createElement("i"));
    }
    return span;
  }

  function renderBoard() {
    els.cells.forEach((cell, i) => {
      const v = state.board[i];
      if ((cell.dataset.mark || "") !== (v || "")) {
        cell.textContent = "";
        if (v) cell.appendChild(makeMark(v));
        cell.dataset.mark = v || "";
      }
      const row = Math.floor(i / 3) + 1;
      const col = (i % 3) + 1;
      const name = v === "X" ? "叉" : v === "O" ? "圈" : "空格";
      cell.setAttribute("aria-label", `第 ${row} 列第 ${col} 行，${name}`);
      cell.classList.toggle("is-empty", !v);
      const inWin = !!state.winLine && state.winLine.includes(i);
      cell.classList.toggle("win", inWin);
      cell.classList.toggle("dim", !!state.winLine && !inWin);
    });
    els.board.classList.toggle("is-waiting", ONLINE && (!room || !room.guestUid));   // 連線模式：玩家 2 未到齊禁止開始
    els.board.dataset.turn = state.turn.toLowerCase();
    els.board.dataset.over = String(state.over);
  }

  function renderHud() {
    const winner = state.winLine ? state.board[state.winLine[0]] : null;
    const draw = state.over && !winner;

    if (els.match) els.match.textContent = `MATCH ${String(state.round).padStart(3, "0")}`;
    ["X", "O", "draw"].forEach(k => {
      if (els.score[k]) els.score[k].textContent = state.scores[k];
    });

    ["X", "O"].forEach(p => {
      els.name[p].textContent = nameOf(p);
      els.label[p].textContent = labelOf(p);
      els.card[p].style.order = num(p);
      const active = state.over ? p === winner : p === state.turn;
      els.card[p].classList.toggle("active-player", active);
      els.status[p].className = active ? "player-status" : "waiting-status";
      if (ONLINE && room && !room.guestUid) els.status[p].textContent = p === "X" ? "已就緒" : "等待好友進入中…";
      else if (!state.over) els.status[p].textContent = active ? (ONLINE ? (p === mySym() ? "你的回合" : "對手回合") : isAI(p) ? "思考中…" : "你的回合") : "等待中";
      else if (draw) els.status[p].textContent = "平手";
      else els.status[p].textContent = p === winner ? "獲勝！" : "落敗";
    });

    els.banner.classList.toggle("is-over", state.over);
    els.turnIcon.classList.toggle("is-o", (state.over ? winner : state.turn) === "O");
    els.turnIcon.classList.toggle("is-draw", draw);
    if (ONLINE && room && !room.guestUid) {
      els.turnIcon.textContent = "…";
      els.turnIcon.classList.remove("is-o", "is-draw");
      els.turnLabel.textContent = "房間狀態";
      els.turnName.textContent = "等待好友進入中…";
    } else if (draw) {
      els.turnIcon.textContent = "＝";
      els.turnLabel.textContent = "對局結果";
      els.turnName.textContent = "平手！";
    } else if (winner) {
      els.turnIcon.textContent = SYMBOL[winner];
      els.turnLabel.textContent = "對局結果";
      els.turnName.textContent = ONLINE ? (winner === mySym() ? "你贏了！" : "對手獲勝") : SOLO ? (isAI(winner) ? "電腦獲勝" : "你贏了！") : `玩家 ${num(winner)} 獲勝！`;
    } else {
      els.turnIcon.textContent = SYMBOL[state.turn];
      els.turnLabel.textContent = "現在輪到";
      els.turnName.textContent = nameOf(state.turn);
    }
    if (SOLO) {
      const human = state.p1;
      els.sc.win.textContent = state.scores[human];
      els.sc.draw.textContent = state.scores.draw;
      els.sc.loss.textContent = state.scores[other(human)];
    }
    els.restart.lastChild.textContent = state.over ? " 再來一局" : " 重新開始";
    if (ONLINE) { els.restart.hidden = !state.over; els.repick.hidden = true; }
  }

  function choose(sym, first) {
    clearTimeout(aiTimer);
    state.p1 = sym;
    state.starter = first || "X";
    state.turn = state.starter;
    state.board = Array(9).fill(null);
    state.over = false;
    state.winLine = null;
    state.picking = false;
    els.pick.hidden = true;
    window.NeonAudio && window.NeonAudio.play("reset");
    render();
    scheduleAI();
  }

  // 開局選擇（單人 / 雙人共用）：符號 + 先後手，按「開始對戰」才開始
  const sel = { sym: "X", first: "me" };
  function openPick() {
    clearTimeout(aiTimer);
    state.picking = true;
    els.pick.hidden = false;
  }
  async function startGame() {
    if (!(await askNext())) return;
    if (!state.picking) return;
    const p1 = sel.sym;
    const f = sel.first === "rand" ? (Math.random() < 0.5 ? "me" : "ai") : sel.first;
    const starter = f === "me" ? p1 : other(p1);
    state.scores = { X: 0, O: 0, draw: 0 };
    state.round = 1;
    choose(p1, starter);
    const who = SOLO ? (f === "me" ? "你" : "電腦") : (f === "me" ? "玩家 1" : "玩家 2");
    flashHint(`${SOLO ? "你" : "玩家 1"}是 ${SYMBOL[p1]}，${who}先手。`);
  }
  function applyModeUI() {
    els.modeTag.textContent = SOLO ? "單人對戰" : ONLINE ? "雙人連線" : "雙人對戰";
    document.title = SOLO ? "OOXX — 單人" : ONLINE ? "OOXX — 雙人連線" : "OOXX — 雙人";
    els.soloScore.hidden = !SOLO;
    els.pickTitle.textContent = SOLO ? "挑戰電腦" : "雙人對戰";
    $("pick-desc").textContent = SOLO ? "電腦會使用另一個符號，先選符號與先後手。" : "玩家 2 會使用另一個符號，先選符號與先後手。";
    $("opt-sym-title").textContent = SOLO ? "你要使用" : "玩家 1 使用";
    $("first-me").textContent = SOLO ? "我先" : "玩家 1 先";
    $("first-ai").textContent = SOLO ? "電腦先" : "玩家 2 先";
  }
  function backToLobby() { location.href = ONLINE ? "online.html" : "index.html"; }
  function setupPickUI() {
    applyModeUI();
    els.soloOpts.querySelectorAll(".seg").forEach(seg => {
      seg.querySelectorAll(".seg-btn").forEach(b => b.addEventListener("click", () => {
        seg.querySelectorAll(".seg-btn").forEach(x => x.classList.toggle("is-on", x === b));
        sel[seg.dataset.group] = b.dataset.val;
      }));
    });
    $("pick-back").addEventListener("click", backToLobby);
    $("lobby-btn").addEventListener("click", backToLobby);
    els.soloStart.addEventListener("click", startGame);
    els.repick.addEventListener("click", openPick);
  }

  // ===== 雙人連線 =====
  // 房間資料與規則在 online-store.js；這裡只負責「把房間資料畫出來」與「把操作送出去」。
  let noticeOnOk = null;
  function showNotice(title, desc, okText, onOk, cancelable) {
    els.noticeTitle.textContent = title;
    els.noticeDesc.textContent = desc;
    els.noticeOk.textContent = okText;
    els.noticeCancel.hidden = !cancelable;
    noticeOnOk = onOk;
    els.notice.hidden = false;
    els.noticeOk.focus();
  }
  function hideNotice() { els.notice.hidden = true; noticeOnOk = null; }

  let lastRev = -1, lastOver = false, joined = false, leaving = false;
  function applyRoom(r) {
    if (!r) {   // 房間被房主刪除（或已過期）
      room = null;
      if (leaving) return;
      showNotice("房間已關閉", "房主已刪除這間房間。", "回到房間列表", backToLobby, false);
      return;
    }
    const prev = room;
    room = r;
    const g = r.game;
    state.board = g.board.slice();
    state.turn = g.turn;
    state.starter = g.starter;
    state.round = g.round;
    state.scores = { X: g.scores.X, O: g.scores.O, draw: g.scores.draw };
    state.over = g.over;
    state.winLine = g.winLine;
    state.p1 = "X";
    state.picking = false;
    if (joined && g.rev !== lastRev) {
      const N = window.NeonAudio;
      if (N) {
        if (g.over) N.play(g.winLine ? (state.board[g.winLine[0]] === mySym() ? "win" : "draw") : "draw");
        else if (g.rev === 0) N.play("reset");
        else N.play(g.turn === "X" ? "o" : "x");
      }
    }
    if (prev && !prev.guestUid && r.guestUid) flashHint(`${r.guestName || "對手"} 已加入，開始對戰！`);
    if (prev && prev.guestUid && !r.guestUid) flashHint("對手已離開房間。");
    lastRev = g.rev; lastOver = g.over; joined = true;
    renderRoomBar();
    render();
  }
  function renderRoomBar() {
    els.roomBar.hidden = false;
    els.roomCode.textContent = room.id;
    els.roomTitle.textContent = room.name || "";
    els.roomExit.textContent = room.hostUid === window.OOXXOnline.me().uid ? "刪除房間" : "離開房間";
  }
  async function onlineMove(i) {
    if (!room) return;
    if (!room.guestUid) { flashHint("等待好友進入中…，玩家 2 加入後才能開始。"); return; }
    if (state.over || state.board[i]) { if (!state.over) window.NeonAudio && window.NeonAudio.play("invalid"); return; }
    if (state.turn !== mySym()) { flashHint("還沒輪到你。"); return; }
    const res = await window.OOXXOnline.move(ROOM_ID, i);
    if (res && res.error === "gone") applyRoom(null);
    else if (res && res.error === "network") flashHint("連線不穩，這一步沒有送出，請再試一次。");
  }
  async function onlineRematch() {
    if (!room || !state.over) return;
    await window.OOXXOnline.rematch(ROOM_ID);
  }
  function exitRoom() {
    const O = window.OOXXOnline;
    if (!room) { backToLobby(); return; }
    if (room.hostUid === O.me().uid) {
      showNotice("刪除房間？", room.guestUid ? "目前正在對戰，刪除後對手會被請出房間。" : "房間將被刪除。", "確定刪除",
        async () => { hideNotice(); leaving = true; await O.deleteRoom(ROOM_ID); backToLobby(); }, true);
    } else {
      O.leaveRoom(ROOM_ID).then(backToLobby, backToLobby);
    }
  }
  let onlineBound = false;
  async function startOnline() {
    const O = window.OOXXOnline;
    els.pick.hidden = true;
    state.picking = false;
    if (!onlineBound) { onlineBound = true; bindOnline(); }
    startOnlineJoin();
  }
  function bindOnline() {
    const O = window.OOXXOnline;
    $("lobby-btn").lastChild.textContent = " 房間列表";
    els.roomCopy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(ROOM_ID); flashHint("已複製房號。"); } catch (e) { flashHint(`房號：${ROOM_ID}`); }
    });
    els.roomExit.addEventListener("click", exitRoom);
    els.noticeOk.addEventListener("click", () => { const f = noticeOnOk; hideNotice(); if (f) f(); });
    els.noticeCancel.addEventListener("click", hideNotice);
  }
  async function startOnlineJoin() {
    const O = window.OOXXOnline;
    if (!O.isId(ROOM_ID)) { showNotice("找不到房間", "房號不正確。", "回到房間列表", backToLobby, false); return; }
    if (!O.me().loggedIn) {   // 未登入：等待登入（登入遮罩由 gate.js 顯示），登入後再進房
      const off = MH.onChange(() => { if (O.me().loggedIn) { off(); startOnlineJoin(); } });
      return;
    }
    const res = await O.joinRoom(ROOM_ID, "");   // 房主 / 已在房內：直接進入；其他人：佔用空位
    if (!res.ok) {
      const T = { network: ["連線失敗", "無法連線到伺服器，請檢查網路後再試。"], gone: ["房間不存在", "這間房間已被刪除或已過期。"], pass: ["🔒 需要密碼", "這間房間有設定密碼，請從房間列表輸入密碼加入。"] }[res.error] || ["房間已滿", "這間房間已經有兩位玩家。"];
      showNotice(T[0], T[1], "回到房間列表", backToLobby, false);
      return;
    }
    O.subscribe(ROOM_ID, applyRoom);
  }

  function render() {
    renderBoard();
    renderHud();
  }

  // 輸入
  els.cells.forEach((cell, i) => {
    cell.addEventListener("click", e => {
      if (e.pointerType === "touch" && !MH.touchOn()) return;   // 大廳關閉觸控操作
      play(i);
    });
    cell.addEventListener("keydown", e => {
      if (!MH.kbdOn()) return;                                  // 大廳關閉鍵盤操作
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(i);
      }
    });
  });
  els.restart.addEventListener("click", e => {
    if (e.pointerType === "touch" && !MH.touchOn()) return;
    newRound();
  });
  document.addEventListener("keydown", e => {
    if (!MH.kbdOn()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (state.picking) {
      if (e.key === "Enter") startGame();
      return;
    }
    if (/^[1-9]$/.test(e.key)) play(Number(e.key) - 1);
    else if (e.key === "r" || e.key === "R") newRound();
  });

  // 啟動
  load();
  state.starter = "X";
  state.turn = "X";
  state.scores = { X: 0, O: 0, draw: 0 };
  setupPickUI();
  render();
  if (ONLINE) startOnline();

  // 暫停：大廳要求暫停時（點左側導覽）停止電腦思考，玩家下一次操作（點一下或按鍵）時繼續
  MH.onPause(() => { paused = true; clearTimeout(aiTimer); });
  const resume = () => { if (paused) { paused = false; scheduleAI(); } };
  document.addEventListener("pointerdown", resume, true);
  document.addEventListener("keydown", resume, true);
  MH.onChange(() => { if (!hintTimer) els.hint.textContent = defaultHint(); });
})();
