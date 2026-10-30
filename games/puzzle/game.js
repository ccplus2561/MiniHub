(() => {
  "use strict";

  const SIZE = 5;
  const SLIDE_MS = 110;      // 需與 style.css 的 --slide 一致
  const SWIPE_MIN = 28;      // 滑動 / 拖曳判定距離（px）
  const COST = { remove: 300, swap: 150, undo: 100 };   // 開局價格（用分數購買），可自行調整
  const COST_STEP = 0.5;     // 清除 / 交換：同一局每多用一次漲價 50%（復原固定價）

  /* ---------- 難度設定：隨場上最大方塊提升 ---------- */
  // tier = log2(最大方塊) − 8（512→1、1024→2、2048→3 …），tier 0 為初期
  const SPAWN_TABLE = [      // 新方塊 [數值, 權重]
    [[2, 90], [4, 10]],
    [[2, 80], [4, 18], [8, 2]],
    [[2, 70], [4, 25], [8, 5]],
    [[2, 60], [4, 28], [8, 12]],
    [[2, 50], [4, 30], [8, 15], [16, 5]]
  ];
  const MEAN_PER_TIER = 0.12, MEAN_MAX = 0.7;   // 「刁難出生」機率：不生在能立刻合併的位置
  const EXTRA_PER_TIER = 0.06, EXTRA_MAX = 0.3; // tier ≥ 2 時，每步額外多生一塊的機率

  const sound = new Proxy({}, { get: (_, k) => (...a) => { try { window.GameAudio && window.GameAudio[k](...a); } catch (_) { /* 音訊失敗不影響遊戲 */ } } });
  const $ = id => document.getElementById(id);
  const tilesEl = $("tiles");
  const scoreEl = $("score");
  const bestEl = $("best");
  const undoButton = $("undo");
  const overlay = $("overlay");
  const overlayTitle = $("overlay-title");
  const overlayMessage = $("overlay-message");
  const overlayButton = $("overlay-button");
  const noteEl = $("note");
  // 依裝置顯示操作提示：觸控裝置顯示滑動，其他顯示鍵盤／滑鼠
  const touchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const kbdBar = $("kbd");
  const NOTE_TOUCH = "在畫面上滑動即可移動方塊";
  const NOTE_DEFAULT = NOTE_TOUCH;
  const puButtons = { remove: $("pu-remove"), swap: $("pu-swap") };
  const costEls = { remove: $("cost-remove"), swap: $("cost-swap") };
  const costUndoEl = $("cost-undo");

  // 底層 SIZE × SIZE 個空格
  const cellsEl = document.querySelector(".cells");
  for (let i = 0; i < SIZE * SIZE; i++) cellsEl.appendChild(document.createElement("i"));

  let tiles = [];            // 場上所有方塊 { v, r, c, el, inner }
  let score = 0;
  let best = readBest();
  let peak = 0;              // 本局最高分（道具會扣分，排行榜以本局達到的最高分計）
  const hub = window.MiniHub || null;
  const kbdOK = () => { try { return !hub || hub.kbdOn(); } catch (_) { return true; } };
  const touchOK = () => { try { return !hub || hub.touchOn(); } catch (_) { return true; } };
  const askNext = () => { try { return hub ? hub.requestNext() : Promise.resolve(true); } catch (_) { return Promise.resolve(true); } };
  const submitScore = () => { try { if (hub && peak > 0) board.submit(peak); } catch (_) { /* 略過 */ } };
  let previous = null;       // 復原用快照（只存數值）
  let gameOver = false;
  let won = false;
  let keepPlayingAfterWin = false;
  let pending = null;        // 動畫收尾工作 { timer, fn }
  let mode = null;           // 道具模式："remove" | "swap" | null
  let picked = null;         // 交換道具：已選的第一個方塊
  let used = { remove: 0, swap: 0 };   // 本局道具使用次數（影響價格）

  function readBest() {
    try { return Number(localStorage.getItem("tileBloom2048Best")) || 0; }
    catch (_) { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem("tileBloom2048Best", String(best)); }
    catch (_) { /* localStorage 可能無法使用 */ }
  }

  /* ---------- 里程碑特效（粒子 / 光環 / 閃光） ---------- */
  const boardWrap = document.querySelector(".board-wrap");
  const fxCanvas = document.createElement("canvas");
  fxCanvas.className = "fx";
  fxCanvas.setAttribute("aria-hidden", "true");
  boardWrap.appendChild(fxCanvas);
  const fxCtx = fxCanvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FX_COLORS = {                     // 與 style.css 的方塊色階對應
    512: "#bd80b0", 1024: "#d88c9e", 2048: "#e7b95e", 4096: "#f0975a",
    8192: "#e8685c", 16384: "#cf4768", 32768: "#9a52b8", 65536: "#5a6fc4", 131072: "#2f9fb5"
  };
  const FX_RAINBOW = ["#e7b95e", "#d88c9e", "#8e7ac8", "#4f9fc6", "#76b9ac"];
  let fxParts = [], fxRaf = 0, fxLast = 0, fxW = 0, fxH = 0;

  function fxResize() {
    const r = fxCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    fxW = r.width; fxH = r.height;
    fxCanvas.width = Math.round(fxW * dpr);
    fxCanvas.height = Math.round(fxH * dpr);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (window.ResizeObserver) new ResizeObserver(fxResize).observe(boardWrap);
  window.addEventListener("resize", fxResize);
  fxResize();

  function burst(t) {
    if (reduceMotion.matches || !fxW) return;
    const level = Math.min(Math.log2(t.v) - 8, 9);          // 512→1、1024→2、2048→3 …
    const cr = fxCanvas.getBoundingClientRect();
    const tr = tilesEl.getBoundingClientRect();
    const cw = t.el.offsetWidth;
    const gap = (tilesEl.clientWidth - 5 * cw) / 4;
    const x = tr.left - cr.left + t.c * (cw + gap) + cw / 2;
    const y = tr.top - cr.top + t.r * (cw + gap) + cw / 2;
    const base = t.v > 131072 ? null : FX_COLORS[t.v];
    const pick = () => base || FX_RAINBOW[Math.floor(Math.random() * FX_RAINBOW.length)];
    const unit = cw / 90;

    fxParts.push({ kind: "glow", x, y, r: cw * (1 + level * 0.3), color: pick(), life: 28 + level * 3, max: 28 + level * 3 });
    fxParts.push({ kind: "ring", x, y, r: cw * 0.4, to: cw * (1.3 + level * 0.3), color: pick(), life: 24, max: 24 });
    if (level >= 3) fxParts.push({ kind: "ring", x, y, r: cw * 0.2, to: cw * (2 + level * 0.35), color: pick(), life: 34, max: 34 });
    if (level >= 3) fxParts.push({ kind: "flash", color: pick(), life: 20, max: 20 });

    const n = Math.min(14 + level * 8, 90);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.6 + Math.random() * (2.2 + level * 0.35)) * unit * 1.6;
      const life = 26 + Math.random() * 26;
      fxParts.push({
        kind: Math.random() < 0.3 ? "streak" : "dot",
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - unit * 0.6,
        size: (2 + Math.random() * 2.6) * Math.max(unit, .6) * (1 + level * 0.06),
        color: Math.random() < 0.28 ? "#fff6d8" : pick(), life, max: life, g: 0.05 * unit
      });
    }
    if (!fxRaf) { fxLast = performance.now(); fxRaf = requestAnimationFrame(fxFrame); }
  }

  function fxFrame(now) {
    const dt = Math.min(2.5, (now - fxLast) / 16.67);
    fxLast = now;
    fxCtx.clearRect(0, 0, fxW, fxH);
    fxParts = fxParts.filter(p => (p.life -= dt) > 0);
    for (const p of fxParts) {
      const k = p.life / p.max;                              // 1 → 0
      if (p.kind === "glow") {
        const g = fxCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.color); g.addColorStop(1, "transparent");
        fxCtx.globalAlpha = k * 0.5; fxCtx.fillStyle = g;
        fxCtx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else if (p.kind === "ring") {
        const e = 1 - k, r = p.r + (p.to - p.r) * (1 - (1 - e) * (1 - e));
        fxCtx.globalAlpha = k * 0.85; fxCtx.strokeStyle = p.color; fxCtx.lineWidth = 1 + 5 * k;
        fxCtx.beginPath(); fxCtx.arc(p.x, p.y, r, 0, Math.PI * 2); fxCtx.stroke();
      } else if (p.kind === "flash") {
        fxCtx.globalAlpha = k * 0.22; fxCtx.fillStyle = p.color;
        fxCtx.fillRect(0, 0, fxW, fxH);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= Math.pow(0.985, dt);
        fxCtx.globalAlpha = Math.min(1, k * 1.6); fxCtx.fillStyle = fxCtx.strokeStyle = p.color;
        if (p.kind === "streak") {
          fxCtx.lineWidth = p.size * 0.7; fxCtx.lineCap = "round";
          fxCtx.beginPath(); fxCtx.moveTo(p.x, p.y); fxCtx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); fxCtx.stroke();
        } else {
          fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2); fxCtx.fill();
        }
      }
    }
    fxCtx.globalAlpha = 1;
    fxRaf = fxParts.length ? requestAnimationFrame(fxFrame) : 0;
    if (!fxRaf) fxCtx.clearRect(0, 0, fxW, fxH);
  }

  /* ---------- 方塊 DOM ---------- */
  function paintValue(t) {
    const v = t.v;
    t.inner.textContent = String(v);
    t.inner.className = "tile-in " + (v <= 131072 ? `tile-${v}` : "tile-super") + (v >= 100 ? ` d${String(v).length}` : "");
    t.el.setAttribute("aria-label", String(v));
  }
  function place(t) {
    t.el.style.setProperty("--x", t.c);
    t.el.style.setProperty("--y", t.r);
  }
  function createTile(r, c, v, anim) {   // anim: "pop" 立即彈出；"wait" 先隱藏，等滑動結束再彈出；null 無動畫
    const el = document.createElement("div");
    const inner = document.createElement("div");
    el.className = "tile";
    el.setAttribute("role", "gridcell");
    el.appendChild(inner);
    const t = { v, r, c, el, inner };
    paintValue(t);
    place(t);
    if (anim === "pop") popIn(t);
    if (anim === "wait") inner.classList.add("wait");
    tilesEl.appendChild(el);
    tiles.push(t);
    return t;
  }
  function animate(t, cls) {
    t.inner.classList.remove("wait", "pop", "merge", "mile");
    void t.inner.offsetWidth;                       // 重新觸發動畫
    t.inner.classList.add(cls);
    t.inner.addEventListener("animationend", () => t.inner.classList.remove(cls), { once: true });
  }
  const popIn = t => animate(t, "pop");

  /* ---------- 狀態輔助 ---------- */
  function valuesGrid() {
    const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    tiles.forEach(t => { g[t.r][t.c] = t.v; });
    return g;
  }
  function emptyCells() {
    const g = valuesGrid(), out = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!g[r][c]) out.push([r, c]);
    return out;
  }
  function canMove() {
    const g = valuesGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!g[r][c]) return true;
        if (c < SIZE - 1 && g[r][c] === g[r][c + 1]) return true;
        if (r < SIZE - 1 && g[r][c] === g[r + 1][c]) return true;
      }
    }
    return false;
  }
  const costOf = k => Math.round(COST[k] * (1 + COST_STEP * (used[k] || 0)) / 10) * 10;
  function tier() {
    const top = tiles.reduce((m, t) => Math.max(m, t.v), 0);
    return top >= 512 ? Math.min(Math.log2(top) - 8, 99) : 0;
  }
  function pickValue(tr) {
    const table = SPAWN_TABLE[Math.min(tr, SPAWN_TABLE.length - 1)];
    let x = Math.random() * table.reduce((a, e) => a + e[1], 0);
    for (const [v, w] of table) { if ((x -= w) < 0) return v; }
    return table[0][0];
  }
  function spawn(anim) {
    const empty = emptyCells();
    if (!empty.length) return null;
    const tr = tier();
    const v = pickValue(tr);
    let pool = empty;
    if (Math.random() < Math.min(MEAN_MAX, tr * MEAN_PER_TIER)) {
      // 刁難：優先選「相鄰沒有同數字」的空格，破壞固定繞圈的套路
      const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      tiles.forEach(t => { if (!t.el.classList.contains("under")) g[t.r][t.c] = t.v; });
      const friendly = ([r, c]) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE && g[y][x] === v).length;
      const lowest = Math.min(...empty.map(friendly));
      pool = empty.filter(e => friendly(e) === lowest);
    }
    const [r, c] = pool[Math.floor(Math.random() * pool.length)];
    return createTile(r, c, v, anim);
  }
  function setScore(gained) {
    scoreEl.textContent = score.toLocaleString("en-US");
    bestEl.textContent = best.toLocaleString("en-US");
    refreshPowerups();
    if (gained) {
      const card = scoreEl.parentElement;
      card.classList.remove("bump"); void card.offsetWidth; card.classList.add("bump");
      const add = document.createElement("span");
      add.className = "score-add" + (gained < 0 ? " neg" : "");
      add.textContent = (gained > 0 ? "+" : "−") + Math.abs(gained);
      card.appendChild(add);
      add.addEventListener("animationend", () => add.remove(), { once: true });
      setTimeout(() => add.remove(), 900);   // 動畫被關閉時的保險
    }
  }

  /* ---------- 道具：清除 / 交換（用分數購買） ---------- */
  function refreshPowerups() {
    for (const k in puButtons) {
      const active = mode === k;
      puButtons[k].classList.toggle("active", active);
      puButtons[k].disabled = !active && (gameOver || score < costOf(k));
      costEls[k].textContent = `−${costOf(k)}`;
    }
    tilesEl.classList.toggle("picking", !!mode);
  }
  let kbdShown = false;
  function setNote(text) { noteEl.textContent = text || NOTE_DEFAULT; noteEl.hidden = kbdShown && !text; }   // 快捷介面顯示時，預設提示隱藏（道具操作提示仍會顯示）
  // 鍵盤快捷介面：只在「鍵盤快捷鍵」開啟時顯示；關閉時隱藏，改顯示滑動提示
  function applyKbd() {
    kbdShown = kbdOK() && !touchOnly;
    kbdBar.hidden = !kbdShown;
    document.body.classList.toggle("has-kbd", kbdShown);
    if (!mode) setNote();
  }
  function cancelMode() {
    if (picked) picked.el.classList.remove("selected");
    mode = null; picked = null;
    setNote();
    refreshPowerups();
  }
  function togglePowerup(kind) {
    flush();
    if (mode === kind) return cancelMode();
    cancelMode();
    if (gameOver || score < costOf(kind) || !tiles.length) { sound.error(); return; }
    mode = kind;
    sound.click();
    setNote(kind === "remove" ? "點選要清除的方塊（再按一次按鈕或 Esc 取消）" : "點選第一個要交換的方塊（Esc 取消）");
    refreshPowerups();
  }
  function snapshot() {
    previous = { grid: valuesGrid(), score, gameOver, won, keepPlayingAfterWin, used: { ...used } };
    refreshUndo();
  }
  function refreshUndo() {
    undoButton.disabled = !previous || previous.score < COST.undo;   // 復原後的分數需足夠支付
    costUndoEl.textContent = `−${COST.undo}`;
  }
  function spend(kind) {
    const cost = costOf(kind);
    used[kind]++;
    score -= cost;
    setScore(-cost);
  }
  tilesEl.addEventListener("click", e => {
    if (!mode) return;
    const el = e.target.closest(".tile");
    const t = el && tiles.find(x => x.el === el);
    if (!t) return;
    if (mode === "remove") {
      snapshot();
      tiles = tiles.filter(x => x !== t);
      t.el.classList.add("removing");
      setTimeout(() => t.el.remove(), 230);
      spend("remove");
      sound.remove();
      cancelMode();
    } else if (!picked) {
      picked = t;
      sound.select();
      t.el.classList.add("selected");
      setNote("再點選第二個方塊（點同一個可取消選取）");
    } else if (t === picked) {
      t.el.classList.remove("selected");
      picked = null;
      setNote("點選第一個要交換的方塊（Esc 取消）");
    } else if (t.v === picked.v) {
      setNote("兩個數字相同，換了也一樣，請選不同數字的方塊");
      sound.error();
    } else {
      snapshot();
      [t.r, picked.r] = [picked.r, t.r];
      [t.c, picked.c] = [picked.c, t.c];
      place(t); place(picked);
      spend("swap");
      sound.swap();
      cancelMode();
    }
  });
  puButtons.remove.addEventListener("click", () => togglePowerup("remove"));
  puButtons.swap.addEventListener("click", () => togglePowerup("swap"));

  /* ---------- 開始 / 復原 ---------- */
  function flush() { if (pending) { clearTimeout(pending.timer); pending.fn(); } }

  function rebuild(values) {
    tilesEl.innerHTML = "";
    tiles = [];
    values.forEach((row, r) => row.forEach((v, c) => { if (v) createTile(r, c, v, null); }));
  }

  function startGame() {
    flush();
    cancelMode();
    tilesEl.innerHTML = "";
    tiles = [];
    fxParts = [];
    submitScore();
    score = 0;
    peak = 0;
    previous = null;
    used = { remove: 0, swap: 0 };
    gameOver = won = keepPlayingAfterWin = false;
    hideOverlay();
    spawn("pop");
    spawn("pop");
    sound.start();
    setScore(0);
    refreshUndo();
  }

  function undo() {
    flush();
    cancelMode();
    if (!previous || previous.score < COST.undo) { sound.error(); return; }
    sound.undo();
    rebuild(previous.grid);
    tiles.forEach(t => animate(t, "pop"));
    score = previous.score - COST.undo;   // 復原要付分數
    used = previous.used;
    gameOver = previous.gameOver;
    won = previous.won;
    keepPlayingAfterWin = previous.keepPlayingAfterWin;
    previous = null;
    hideOverlay();
    setScore(-COST.undo);
    refreshUndo();
  }

  /* ---------- 移動 ---------- */
  // 第 i 條線、距離出發邊第 k 格的座標
  const slot = {
    left:  (i, k) => [i, k],
    right: (i, k) => [i, SIZE - 1 - k],
    up:    (i, k) => [k, i],
    down:  (i, k) => [SIZE - 1 - k, i]
  };

  function move(direction) {
    flush();
    if (gameOver || mode) return false;

    const before = valuesGrid();
    const at = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles.forEach(t => { at[t.r][t.c] = t; });

    const pos = slot[direction];
    const absorbed = [], merged = [];
    let gained = 0, moved = false;

    for (let i = 0; i < SIZE; i++) {
      const seq = [];
      for (let k = 0; k < SIZE; k++) {
        const [r, c] = pos(i, k);
        if (at[r][c]) seq.push(at[r][c]);
      }
      let out = 0;
      for (let j = 0; j < seq.length; j++, out++) {
        const t = seq[j];
        const [nr, nc] = pos(i, out);
        if (j + 1 < seq.length && seq[j + 1].v === t.v) {
          const o = seq[j + 1];
          if (o.r !== nr || o.c !== nc) moved = true;
          o.r = nr; o.c = nc;
          absorbed.push(o);
          t.v *= 2;                     // 畫面上的數字等滑動結束後再更新
          gained += t.v;
          merged.push(t);
          j++;
        }
        if (t.r !== nr || t.c !== nc) moved = true;
        t.r = nr; t.c = nc;
      }
    }

    if (!moved) return false;

    previous = { grid: before, score, gameOver, won, keepPlayingAfterWin, used: { ...used } };
    refreshUndo();

    sound.move();
    absorbed.forEach(o => o.el.classList.add("under"));
    tiles.forEach(place);               // 觸發滑動動畫

    score += gained;
    if (score > peak) { peak = score; if (typeof paintMe === "function") paintMe(); }
    if (score > best) { best = score; saveBest(); }
    setScore(gained);

    const absorbedSet = new Set(absorbed);
    const born = spawn("wait");         // 狀態立即生效，畫面等滑動結束
    const tr = tier();
    const extra = born && tr >= 2 && Math.random() < Math.min(EXTRA_MAX, (tr - 1) * EXTRA_PER_TIER)
      ? spawn("wait") : null;           // 高階段偶爾多生一塊

    const fn = () => {
      pending = null;
      absorbed.forEach(o => o.el.remove());
      tiles = tiles.filter(t => !absorbedSet.has(t));
      if (merged.length) {
        const top = Math.max(...merged.map(t => t.v));
        if (top >= 512) sound.mile(top); else sound.merge(top);
      }
      merged.forEach(t => {
        paintValue(t);
        if (t.v >= 512) { animate(t, "mile"); burst(t); }   // 512 以上的里程碑特效
        else animate(t, "merge");
      });
      if (born) popIn(born);
      if (extra) popIn(extra);

      if (!won && merged.some(t => t.v >= 2048)) {   // 第一次合成 2048：提示後繼續
        won = true;
        showToast("達成 2048！繼續挑戰");
      }
      if (!canMove()) {   // 合成 2048 不會過關，無限繼續，直到沒有可移動的方塊
        gameOver = true;
        sound.over();
        submitScore();
        revealRankOnGameOver();
        refreshPowerups();
        setTimeout(() => showOverlay("沒有可移動的方塊", `本局分數：${score.toLocaleString("en-US")}`), 250);
      }
    };
    pending = { timer: setTimeout(fn, SLIDE_MS), fn };
    return true;
  }

  /* ---------- 小提示 ---------- */
  let toastEl = null, toastTimer = 0;
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      boardWrap.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.remove("show"); void toastEl.offsetWidth; toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------- 結束畫面 ---------- */
  function hideOverlay() { overlay.classList.add("hidden"); }
  function showOverlay(title, message, buttonText = "再玩一次") {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlayButton.textContent = buttonText;
    overlay.classList.remove("hidden");
  }

  /* ---------- 輸入：鍵盤 / 觸控滑動 / 滑鼠拖曳 / 滾輪 ---------- */
  const KEYS = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down"
  };
  document.addEventListener("keydown", e => {
    if (!kbdOK()) return;
    const dir = KEYS[e.key];
    if (dir) { e.preventDefault(); move(dir); }
    else if (e.key === "Escape" && mode) cancelMode();
    else if (e.key === "Escape" && !overlay.classList.contains("hidden") && !gameOver) hideOverlay();
  });

  // 整頁都可以滑動 / 拖曳（按鈕與結束視窗除外），超過距離就立刻移動，不必等放開
  let drag = null;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (mode || e.target.closest("button, .overlay-card, .rank-pop")) return;
    if (e.pointerType !== "mouse" && !touchOK()) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  document.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    drag = null;                        // 一次手勢只觸發一次
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });
  const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  // 滑鼠滾輪：上下（Shift + 滾輪或觸控板橫向為左右）；加冷卻避免觸控板慣性連續觸發
  let wheelLock = 0;
  document.addEventListener("wheel", e => {
    e.preventDefault();
    const now = performance.now();
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if (now < wheelLock || Math.max(ax, ay) < 4) return;
    wheelLock = now + 220;
    if (ay >= ax) move(e.deltaY > 0 ? "down" : "up");
    else move(e.deltaX > 0 ? "right" : "left");
  }, { passive: false });

  undoButton.addEventListener("click", undo);
  overlayButton.addEventListener("click", newGame);
  // 下一局：未登入時由大廳詢問是否同意條款；單獨開啟本頁時直接重來
  let asking = false;
  function newGame() {
    if (asking) return;
    asking = true;
    askNext().then(ok => { asking = false; if (ok) startGame(); });
  }

  /* ---------- 個人最高 / 排行榜（登入後；資料由大廳 SDK 處理） ---------- */
  const meBestEl = $("me-best"), rankList = $("rank-list");
  const side = $("side"), tog = $("sideTog"), gameEl = document.querySelector(".game"), PW = 260;
  let st = { logged: false, rankOn: false, best: 0, top: [], myRank: 0, myName: "", uid: "" };
  let userSide = null, floatSide = false, floatOpen = false;   // 寬螢幕：固定在右側，記住展開 / 收合；窄螢幕（含手機）：浮在棋盤上，預設收合
  const fmt = n => Number(n).toLocaleString("en-US");
  const sideOpen = () => floatSide ? floatOpen : userSide !== false;
  function paintSide() {
    const o = sideOpen();
    side.classList.toggle("closed", !o); side.classList.toggle("float", floatSide);
    tog.setAttribute("aria-expanded", String(o)); tog.title = o ? "收合" : "展開";
  }
  function fitSide() {
    const r = $("board").getBoundingClientRect(), g = gameEl.getBoundingClientRect();
    side.style.top = Math.max(8, Math.round(r.top)) + "px";
    side.style.maxHeight = Math.max(160, Math.round(r.height)) + "px";
    floatSide = (innerWidth - g.width) / 2 < PW + 12 + 34 + 8;
    paintSide();
  }
  function paintMe() { meBestEl.textContent = fmt(Math.max(st.best, peak)); }
  function paintRank() {
    const showRank = st.logged && st.rankOn;
    $("meBox").hidden = !st.logged;
    $("rankBox").hidden = !showRank;
    side.hidden = !st.logged && !showRank;      // 未登入或不允許排行榜：整個面板不顯示
    paintMe();
    rankList.textContent = "";
    if (!side.hidden) fitSide();
    if (!showRank) return;
    const add = (rank, name, sc, cls) => {
      const li = document.createElement("li"); if (cls) li.className = cls;
      [rank, name, sc].forEach((t, i) => { const e = document.createElement("span"); if (i === 2) e.className = "sc"; e.textContent = t; li.appendChild(e); });
      rankList.appendChild(li);
    };
    for (let i = 0; i < 3; i++) {
      const r = st.top[i];
      if (!r) add("#" + (i + 1), "—", "", "empty");
      else if (r.uid === st.uid) add("#" + (i + 1), st.myName, fmt(r.score), "me");
      else add("#" + (i + 1), r.name || "*", fmt(r.score));
    }
    if (!st.top.some(r => r.uid === st.uid)) {
      const g = document.createElement("li"); g.className = "gap"; g.textContent = "⋯"; rankList.appendChild(g);
      if (st.best > 0) add(st.myRank ? "#" + st.myRank : "#?", st.myName, fmt(st.best), "me");
      else add("—", st.myName, "尚無成績", "me");
    }
  }
  tog.addEventListener("click", () => { if (floatSide) floatOpen = !floatOpen; else userSide = !sideOpen(); paintSide(); });
  addEventListener("resize", () => { if (!side.hidden) fitSide(); });
  function revealRankOnGameOver() {      // 已登入且允許排行榜時，遊戲結束自動展開
    if (!(st.logged && st.rankOn)) return;
    if (floatSide) floatOpen = true; else userSide = true;
    paintSide();
  }
  let board = { submit() {} };
  if (hub) {
    board = hub.board("puzzle", { top: 3, onUpdate: s => {
      st = { logged: s.logged, rankOn: s.rankOn, best: s.best, top: s.top, myRank: s.myRank, myName: s.myName, uid: s.uid };
      if (s.best > best) { best = s.best; bestEl.textContent = fmt(best); }
      applyKbd();
      paintRank();
    } });
    window.addEventListener("pagehide", submitScore);
    hub.onPause(() => { submitScore(); cancelMode(); floatOpen = false; paintSide(); });   // 回合制，無計時器；暫停時送出成績並收起面板
  }

  applyKbd();
  startGame();
  if (hub) board.refresh();
})();
