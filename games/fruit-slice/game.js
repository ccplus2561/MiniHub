(() => {
  "use strict";

  /* ================= 設定（可自行調整） ================= */
  const LIVES = 3;
  const COMBO_WINDOW = 35;                  // 連擊有效時間（影格，約 0.6 秒）
  const TRAIL_LIFE = 13, TRAIL_MAX = 14;    // 刀光軌跡
  const HIT_PAD = 7;                        // 切中判定的額外容許距離（px）
  const GRAVITY = 0.22, HALF_GRAVITY = 0.2;

  // 經典玩法：時間(秒)、出水果間隔(影格)、炸彈機率
  const MODE = { seconds: 60, interval: 38, bomb: 0.13, lives: true };

  const FRUITS = [
    { kind: "watermelon", color: "#ef4d55", edge: "#267e3d", accent: "#9bdf50" },
    { kind: "orange",     color: "#ff9b2f", edge: "#b95119", accent: "#ffda68" },
    { kind: "apple",      color: "#ed4148", edge: "#9f1e32", accent: "#75c85a" },
    { kind: "kiwi",       color: "#a9c94d", edge: "#55752d", accent: "#f4e1a0" },
    { kind: "pineapple",  color: "#e7ad36", edge: "#9c6423", accent: "#6fbd4b" }
  ];

  const sound = new Proxy({}, { get: (_, k) => (...a) => { try { window.GameAudio && window.GameAudio[k](...a); } catch (_) { /* 音訊失敗不影響遊戲 */ } } });
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString("zh-TW");

  /* ================= DOM ================= */
  const overlay = $("playOverlay"), playWindow = overlay.querySelector(".play-window");
  const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
  const scoreEl = $("liveScore"), timeEl = $("liveTime"), livesEl = $("liveLives"), bestEl = $("liveBest");
  const homeBestEl = $("homeBestScore");
  const gameOverEl = $("gameOver"), pauseScreen = $("pauseScreen"), pauseButton = $("pauseGame");
  const hintEl = $("gameHint"), comboToast = $("comboToast");
  const modal = $("modal"), modalTitle = $("modalTitle"), modalText = $("modalText");

  /* ================= 狀態 ================= */
  let score = 0, lives = LIVES, seconds = 0, combo = 0, comboClock = 0, flash = 0;
  let running = false, paused = false;
  let lastTime = 0, spawnClock = 0, raf = 0, timer = 0;
  let pointerDown = false, lastPoint = null;
  let best = 0, serverBest = 0, logged = false, rankOn = false, myName = "", top = [], asking = false;
  const splats = [], motes = [], fruits = [], halves = [], particles = [], trail = [];

  const mode = () => MODE;
  const isOpen = () => overlay.classList.contains("open");

  /* ================= 個人最高 / 排行榜：由 MiniHub SDK 處理，這裡只負責顯示 ================= */
  const myUid = () => MiniHub.player().uid;
  function paintRank(ul) {
    ul.hidden = !(logged && rankOn);
    if (ul.id === "homeRank") { $("rankBox").hidden = ul.hidden; syncSide(); }
    if (ul.hidden) return;
    ul.textContent = "";
    const me = myUid();
    const add = (rank, name, sc, cls) => {
      const li = document.createElement("li"); if (cls) li.className = cls;
      [rank, name, sc].forEach((t, i) => { const e = document.createElement("span"); if (i === 2) e.className = "sc"; e.textContent = t; li.appendChild(e); });
      ul.appendChild(li);
    };
    for (let i = 0; i < 3; i++) {
      const r = top[i];
      if (!r) add("#" + (i + 1), "—", "", "empty");
      else add("#" + (i + 1), r.uid === me ? myName : (r.name || "*"), r.score, r.uid === me ? "me" : "");
    }
    if (!top.some(r => r.uid === me)) {   // 沒進前 3：多顯示自己目前的名次
      const g = document.createElement("li"); g.className = "gap"; g.textContent = "⋯"; ul.appendChild(g);
      if (serverBest > 0) add(board.state.myRank ? "#" + board.state.myRank : "#?", myName, serverBest, "me");
      else add("—", myName, "尚無成績", "me");
    }
  }
  function paintRanks() { paintRank($("homeRank")); paintRank($("overRank")); }

  /* ================= HUD / 畫面 ================= */
  function updateHud() {
    scoreEl.textContent = fmt(score);
    timeEl.textContent = seconds;
    livesEl.textContent = "♥ ".repeat(lives).trim() || "—";
    bestEl.textContent = fmt(best);
  }
  function refreshBest() {
    bestEl.textContent = fmt(best);
    if (homeBestEl) homeBestEl.textContent = fmt(best);
    $("meBox").hidden = !logged; syncSide();
  }

  /* ================= 右側面板（同貪吃蛇）：寬螢幕固定展開，窄螢幕浮動、預設收合 ================= */
  const side = $("side"), sideTog = $("sideTog");
  let userSide = null, floatSide = false, floatOpen = false;
  const sideOpen = () => floatSide ? floatOpen : userSide !== false;
  function paintSide() {
    const o = sideOpen();
    side.classList.toggle("closed", !o); side.classList.toggle("float", floatSide);
    sideTog.setAttribute("aria-expanded", o); sideTog.title = o ? "收合" : "展開";
  }
  function syncSide() { side.hidden = $("meBox").hidden && $("rankBox").hidden; }
  function fitSide() { floatSide = innerWidth < 900; paintSide(); }
  addEventListener("resize", fitSide); fitSide();
  sideTog.addEventListener("click", () => {
    if (floatSide) floatOpen = !floatOpen; else userSide = !sideOpen();
    paintSide();
  });
  function showModal(title, text) {
    modalTitle.textContent = title; modalText.textContent = text;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  }
  function hideModal() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }

  function addScore(n) {
    score += n;
    if (score > best) { best = score; refreshBest(); }
    updateHud();
  }
  function resizeCanvas() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ================= 遊戲流程 ================= */
  // 開始下一局前先問大廳（未登入時會詢問同意條款；回傳 false 就不開始）
  async function requestStart() {
    if (asking) return;
    asking = true;
    let ok = false;
    try { ok = await MiniHub.requestNext(); } catch (_) { ok = true; } finally { asking = false; }
    if (ok) startGame();
  }
  function startGame() {
    hideModal();
    overlay.classList.add("open"); overlay.setAttribute("aria-hidden", "false");
    score = 0; lives = LIVES; seconds = mode().seconds;
    combo = 0; comboClock = 0; flash = 0;
    comboToast.classList.remove("show");
    fruits.length = halves.length = particles.length = trail.length = 0;
    gameOverEl.hidden = true; pauseScreen.hidden = true; hintEl.style.display = "block";
    pauseButton.textContent = "Ⅱ";
    paused = false; running = true; splats.length = 0; sound.unlock(); sound.musicStart();
    updateHud(); resizeCanvas();
    lastTime = performance.now(); spawnClock = 0;
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function tick() {
    if (!running || paused) return;
    seconds--; updateHud();
    if (seconds <= 0) endGame("時間到！");
  }
  function endGame(title) {
    if (!running) return;
    running = false; clearInterval(timer); sound.musicStop();
    if (score > 0) board.submit(score);
    hintEl.style.display = "none"; pauseScreen.hidden = true;
    $("gameOverTitle").textContent = title;
    $("finalScore").textContent = fmt(score);
    gameOverEl.hidden = false;
  }
  function closeGame() {
    if (!isOpen()) return;
    if (running && score > 0) board.submit(score);
    running = false; paused = false; sound.musicStop();
    clearInterval(timer); cancelAnimationFrame(raf);
    overlay.classList.remove("open"); overlay.setAttribute("aria-hidden", "true");
  }
  function pause() {
    if (!running || paused) return;
    paused = true; pointerDown = false; lastPoint = null;
    pauseScreen.hidden = false; pauseButton.textContent = "▶";
    cancelAnimationFrame(raf); sound.musicStop();
  }
  function resume() {
    if (!running || !paused) return;
    paused = false; pauseScreen.hidden = true; pauseButton.textContent = "Ⅱ";
    lastTime = performance.now(); sound.musicStart();
    raf = requestAnimationFrame(loop);
  }
  const togglePause = () => paused ? resume() : pause();
  MiniHub.onPause(pause);   // 大廳要求暫停（玩家點左側導覽）

  /* ================= 生成 / 特效 ================= */
  function spawn() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const bomb = Math.random() < mode().bomb;
    fruits.push({
      x: w * (0.16 + Math.random() * 0.68), y: h + 45,
      vx: (Math.random() - 0.5) * 3.4, vy: -Math.sqrt(2 * GRAVITY * (h * (0.55 + Math.random() * 0.3) + 45)),  // 依畫面高度決定拋射高度，矮螢幕（手機直向）也一定看得到
      r: bomb ? 25 : 24 + Math.random() * 10,
      bomb, fruit: FRUITS[Math.floor(Math.random() * FRUITS.length)],
      cut: false, missed: false,
      rot: Math.random() * 6.2, spin: (Math.random() - 0.5) * 0.08
    });
  }
  function makeSplat(x, y, color, r) {
    const blobs = [{ dx: 0, dy: 0, r: r * (0.9 + Math.random() * 0.4) }];
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, d = r * (0.9 + Math.random() * 1.6);
      blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 2 + Math.random() * r * 0.28 });
    }
    const drips = [];
    for (let i = 0; i < 3; i++) drips.push({ dx: (Math.random() - 0.5) * r * 1.6, len: 0, max: 25 + Math.random() * 55, w: 2 + Math.random() * 3 });
    splats.push({ x, y, color, blobs, drips, life: 420, max: 420 });
    if (splats.length > 28) splats.shift();
  }
  function drawBackdrop(dt, w, h) {
    // 漂浮的光點（背景氛圍）
    if (motes.length < 26 && Math.random() < 0.08 * dt) motes.push({ x: Math.random() * w, y: h + 10, vy: 0.25 + Math.random() * 0.5, r: 2 + Math.random() * 5, ph: Math.random() * 6.3, hue: Math.random() < 0.5 ? "255,230,150" : "150,225,245" });
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i]; m.y -= m.vy * dt; m.ph += 0.03 * dt; m.x += Math.sin(m.ph) * 0.4 * dt;
      const a = 0.1 + 0.18 * Math.abs(Math.sin(m.ph));
      ctx.fillStyle = `rgba(${m.hue},${a})`; circle(m.x, m.y, m.r);
      if (m.y < -10) motes.splice(i, 1);
    }
    // 留在背景的果汁漬
    for (let i = splats.length - 1; i >= 0; i--) {
      const s = splats[i]; s.life -= dt;
      if (s.life <= 0) { splats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, s.life / 120) * 0.5; ctx.fillStyle = s.color;
      s.blobs.forEach(b => circle(s.x + b.dx, s.y + b.dy, b.r));
      ctx.strokeStyle = s.color; ctx.lineCap = "round";
      s.drips.forEach(d => {
        if (d.len < d.max) d.len += 0.35 * dt;
        ctx.lineWidth = d.w; ctx.beginPath(); ctx.moveTo(s.x + d.dx, s.y); ctx.lineTo(s.x + d.dx, s.y + d.len); ctx.stroke();
        circle(s.x + d.dx, s.y + d.len, d.w * 0.9);
      });
      ctx.globalAlpha = 1;
    }
  }
  function makeJuice(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 6;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 25 + Math.random() * 25, color, r: 2 + Math.random() * 4, drop: true });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 24, color: "#fff1c0", r: 2 + Math.random() * 2, drop: false });
    }
  }
  function makeHalves(f) {
    for (const side of [-1, 1]) {
      halves.push({ x: f.x, y: f.y, r: f.r, rot: f.rot, vy: -2.5 - Math.random() * 2, vx: f.vx + side * (1.8 + Math.random()), spin: side * 0.07, side, fruit: f.fruit, life: 65 });
    }
  }
  function burstBomb(x, y) {
    flash = 0.65;
    const colors = ["#ff5b35", "#ffb33d", "#fff1a0", "#777d8a"];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 10;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 35 + Math.random() * 35, color: colors[i % 4], r: 2 + Math.random() * 6, drop: false });
    }
    playWindow.classList.remove("shake"); void playWindow.offsetWidth; playWindow.classList.add("shake");
  }

  /* ================= 繪製 ================= */
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

  function drawBomb(f) {
    const g = ctx.createRadialGradient(-8, -10, 3, 0, 0, f.r);
    g.addColorStop(0, "#999ca7"); g.addColorStop(0.55, "#292c38"); g.addColorStop(1, "#080c15");
    ctx.fillStyle = g; circle(0, 0, f.r);
    ctx.strokeStyle = "#69717d"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "#e5a64b"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(7, -f.r + 4); ctx.quadraticCurveTo(20, -f.r - 18, 29, -f.r - 11); ctx.stroke();
    ctx.fillStyle = "#fff2a0"; circle(30, -f.r - 10, 4);
  }
  function drawFruit(f) {
    const { r, fruit: c } = f;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    if (f.bomb) drawBomb(f);
    else {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 1.2);
      g.addColorStop(0, "#fff1c0"); g.addColorStop(0.25, c.color); g.addColorStop(1, c.edge);
      ctx.fillStyle = g; circle(0, 0, r);
      ctx.strokeStyle = c.edge; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ffffff55";
      ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.35, r * 0.18, r * 0.34, -0.5, 0, Math.PI * 2); ctx.fill();
      if (c.kind === "watermelon") {
        ctx.strokeStyle = "#b7e85c"; ctx.lineWidth = 4;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 8, 0, r * 0.8, -1.2, 1.2); ctx.stroke(); }
      }
      if (c.kind === "apple" || c.kind === "orange") {
        ctx.strokeStyle = "#633b22"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -r + 3); ctx.lineTo(4, -r - 10); ctx.stroke();
        ctx.fillStyle = "#72c45a";
        ctx.beginPath(); ctx.ellipse(10, -r - 6, 9, 4, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      if (c.kind === "kiwi") {
        ctx.fillStyle = "#f7e6a7"; circle(0, 0, r * 0.55);
        ctx.fillStyle = "#44321d";
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; circle(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 2); }
      }
      if (c.kind === "pineapple") {
        ctx.strokeStyle = "#78bd4b"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-5, -r + 4); ctx.lineTo(-12, -r - 9); ctx.moveTo(2, -r + 3); ctx.lineTo(8, -r - 13); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function halfPath(h) {
    ctx.beginPath();
    if (h.side < 0) ctx.arc(0, 0, h.r, Math.PI / 2, Math.PI * 1.5);
    else ctx.arc(0, 0, h.r, -Math.PI / 2, Math.PI / 2);
  }
  function drawHalf(h) {
    const c = h.fruit, melon = c.kind === "watermelon";
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    halfPath(h); ctx.lineTo(0, h.side < 0 ? h.r : -h.r); ctx.closePath(); ctx.clip();
    const g = ctx.createRadialGradient(-h.r * 0.25, -h.r * 0.3, 2, 0, 0, h.r * 1.2);
    g.addColorStop(0, "#fff2c4"); g.addColorStop(0.28, c.accent); g.addColorStop(1, c.color);
    ctx.fillStyle = g; circle(0, 0, h.r);
    ctx.fillStyle = melon ? "#f36a67" : "#f7e6a7"; circle(0, 0, h.r * 0.77);   // 果肉切面
    ctx.fillStyle = melon ? "#28232a" : "#51402b";
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * h.r * 0.48, Math.sin(a) * h.r * 0.48, 1.8, 3, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 外皮沿著弧形邊緣
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.strokeStyle = c.edge; ctx.lineWidth = 4; halfPath(h); ctx.stroke();
    ctx.strokeStyle = "#fff5d6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -h.r * 0.92); ctx.lineTo(0, h.r * 0.92); ctx.stroke();
    ctx.restore();
  }
  function drawTrail(dt) {
    if (!trail.length) return;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], k = i / trail.length;
      ctx.strokeStyle = `rgba(255,245,170,${k * 0.9})`; ctx.lineWidth = 2 + k * 9;
      ctx.shadowBlur = 18; ctx.shadowColor = "#fff4a2";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    trail.forEach(p => { p.life -= dt; });
    while (trail.length && trail[0].life <= 0) trail.shift();
  }

  /* ================= 主迴圈 ================= */
  function updateFruits(dt, h) {
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += GRAVITY * dt; f.rot += f.spin * dt;
      if (!f.cut) drawFruit(f);
      // 只有「已經在下墜（vy>0）」且掉出畫面底部才算漏接；剛從畫面下方發射、還在上升的水果不算
      if (!f.cut && !f.missed && !f.bomb && mode().lives && f.vy > 0 && f.y > h + f.r + 10) {
        f.missed = true; lives--; combo = 0; updateHud();
        if (lives <= 0) endGame("生命用盡！");
      }
      if (f.cut || f.y > h + 100) fruits.splice(i, 1);
    }
  }
  function updateHalves(dt, h) {
    for (let i = halves.length - 1; i >= 0; i--) {
      const q = halves[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += HALF_GRAVITY * dt; q.rot += q.spin * dt; q.life -= dt;
      drawHalf(q);
      if (q.life <= 0 || q.y > h + 100) halves.splice(i, 1);
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.drop ? 0.16 : 0.12) * dt; p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life / 55); ctx.fillStyle = p.color; ctx.beginPath();
      if (p.drop) ctx.ellipse(p.x, p.y, p.r * 0.7, p.r * 1.5, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill(); ctx.globalAlpha = 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function loop(now) {
    if (!running || paused) return;
    const dt = Math.min((now - lastTime) / 16.67, 2); lastTime = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.65, w * 0.6);
    glow.addColorStop(0, "#4e9bb52b"); glow.addColorStop(1, "#071b2c00");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    drawBackdrop(dt, w, h);

    spawnClock += dt;
    if (spawnClock > mode().interval) { spawn(); if (Math.random() > 0.55) spawn(); spawnClock = 0; }

    updateFruits(dt, h); updateHalves(dt, h); updateParticles(dt); drawTrail(dt);

    if (comboClock > 0) { comboClock -= dt; if (comboClock <= 0) { combo = 0; comboToast.classList.remove("show"); } }
    if (flash > 0) { ctx.fillStyle = `rgba(255,110,55,${flash})`; ctx.fillRect(0, 0, w, h); flash = Math.max(0, flash - 0.035 * dt); }
    raf = requestAnimationFrame(loop);
  }

  /* ================= 切水果判定 / 輸入 ================= */
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    if (!l) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function sliceFruit(f) {
    f.cut = true;
    makeHalves(f); makeJuice(f.x, f.y, f.fruit.color); makeSplat(f.x, f.y, f.fruit.color, f.r);
    combo >= 2 ? sound.combo() : sound.slice();
    combo++; comboClock = COMBO_WINDOW;
    const points = combo >= 5 ? 30 : combo >= 3 ? 20 : 10;
    addScore(points);
    if (combo >= 2) { comboToast.textContent = `${combo} 連擊  +${points}`; comboToast.classList.add("show"); }
  }
  function hitBomb(f) {
    f.cut = true; lives = 0; updateHud();
    burstBomb(f.x, f.y); sound.bomb();
    endGame("碰到炸彈！");
  }
  const pointOf = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener("pointerdown", e => {
    if (!running || paused) return;
    if (e.pointerType === "touch" && !MiniHub.touchOn()) return;
    sound.unlock();
    pointerDown = true; lastPoint = pointOf(e);
    trail.push({ ...lastPoint, life: TRAIL_LIFE });
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointerDown || !running || paused) return;
    const p = pointOf(e);
    trail.push({ ...p, life: TRAIL_LIFE });
    if (trail.length > TRAIL_MAX) trail.shift();
    if (lastPoint) {
      for (const f of fruits) {
        if (f.cut || distToSegment(f.x, f.y, lastPoint.x, lastPoint.y, p.x, p.y) >= f.r + HIT_PAD) continue;
        if (f.bomb) { hitBomb(f); break; }
        sliceFruit(f);
      }
    }
    lastPoint = p;
  });
  const pointerEnd = () => { pointerDown = false; lastPoint = null; };
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => canvas.addEventListener(t, pointerEnd));

  /* ================= 按鈕 / 鍵盤 / 生命週期事件 ================= */
  $("startButton").addEventListener("click", requestStart);
  $("restartGame").addEventListener("click", requestStart);
  $("exitGame").addEventListener("click", closeGame);
  pauseButton.addEventListener("click", togglePause);
  $("resumeGame").addEventListener("click", resume);
  $("howButton").addEventListener("click", () => showModal("遊戲玩法", "按住滑鼠或手指在畫面上滑動，切開飛出的水果即可得分。連續切中可累積連擊；切到炸彈會失去所有生命。時間結束或生命歸零即結算。"));
  $("closeModal").addEventListener("click", hideModal);
  $("modalOk").addEventListener("click", hideModal);
  modal.addEventListener("click", e => { if (e.target === modal) hideModal(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { hideModal(); closeGame(); }
    else if (!MiniHub.kbdOn()) return;
    else if ((e.key === " " || e.key === "p" || e.key === "P") && isOpen() && running) { e.preventDefault(); togglePause(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });   // 切到別的分頁自動暫停
  window.addEventListener("resize", () => { if (isOpen()) resizeCanvas(); });

  addEventListener("pagehide", () => { if (running && score > 0) board.submit(score); });

  /* ================= 啟動 ================= */
  const board = MiniHub.board("fruit-slice", { top: 3, onUpdate: st => {
    logged = st.logged; rankOn = st.rankOn; myName = st.myName; serverBest = st.best; top = st.top;
    best = Math.max(best, serverBest);
    refreshBest(); paintRanks();
  } });
  refreshBest(); paintRanks();
})();
