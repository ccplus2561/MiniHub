(() => {
  "use strict";

  // ===== config =====
  const SIZE = 5;
  const CENTER = 2; // 中央 FREE 格的列／欄索引
  const MIN = 1, MAX = 75; // 可用號碼範圍（整張卡共用，不分欄）
  const FILLABLE = SIZE * SIZE - 1; // 24
  const isFree = (r, c) => r === CENTER && c === CENTER;

  // ===== random =====

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill('')); }

  /** 從 1～75 不重複抽號，填滿 24 格（中央 FREE 留空）。可傳入既有卡片以保留已填數字。 */
  function fillBlanks(grid = emptyGrid()) {
    const next = grid.map(row => [...row]);
    const used = new Set();
    for (const row of next) for (const v of row) if (/^\d{1,2}$/.test(v)) used.add(Number(v));
    const pool = [];
    for (let n = MIN; n <= MAX; n++) if (!used.has(n)) pool.push(n);
    shuffle(pool);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
      if (!isFree(r, c) && next[r][c] === '') next[r][c] = String(pool.pop());
    return next;
  }
  const generateGrid = () => fillBlanks(emptyGrid());

  // ===== bingo =====

  /** 12 條線：5 橫、5 直、2 斜。每條線是 [r, c] 座標陣列。 */
  const LINES = (() => {
    const idx = [...Array(SIZE).keys()];
    return [
      ...idx.map(r => idx.map(c => [r, c])),
      ...idx.map(c => idx.map(r => [r, c])),
      idx.map(i => [i, i]),
      idx.map(i => [i, SIZE - 1 - i]),
    ];
  })();

  /** marked 為 5×5 布林陣列；回傳已完成的線（座標陣列）。 */
  function findCompletedLines(marked) {
    return LINES.filter(line => line.every(([r, c]) => marked[r][c]));
  }

  // ===== validation =====

  /** 單格檢查：空白回傳 null；不合法回傳錯誤訊息字串。 */
  function checkCell(raw) {
    if (raw === '') return null;
    if (!/^\d{1,2}$/.test(raw)) return '只能輸入數字';
    const n = Number(raw);
    if (n < MIN || n > MAX) return `需為 ${MIN}～${MAX}`;
    return null;
  }

  /** 掃描整張卡，回傳 { errors, duplicates, messages, filled } */
  function validateGrid(grid) {
    const errors = new Map(), seen = new Map();
    let filled = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (isFree(r, c)) continue;
      const raw = grid[r][c];
      if (raw !== '') filled++;
      const msg = checkCell(raw);
      if (msg) { errors.set(`${r},${c}`, msg); continue; }
      if (raw === '') continue;
      const n = Number(raw);
      if (!seen.has(n)) seen.set(n, []);
      seen.get(n).push(`${r},${c}`);
    }
    const duplicates = new Set(), messages = [];
    for (const [key, msg] of errors) {
      const [r, c] = key.split(',').map(Number);
      messages.push(`第 ${r + 1} 列第 ${c + 1} 欄：${msg}`);
    }
    for (const [n, keys] of seen) if (keys.length > 1) {
      keys.forEach(k => duplicates.add(k));
      messages.push(`數字 ${n} 重複出現 ${keys.length} 次`);
    }
    return { errors, duplicates, messages, filled };
  }

  // ===== confetti =====
  // 輕量紙花特效（無外部套件）。使用者設定「減少動態效果」時不執行。
  const COLORS = ['#f2c14e', '#1d4e5f', '#e4572e', '#76b041', '#6c5ce7', '#ff8fab'];
  let canvas, ctx, particles = [], running = false;

  function setup() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    addEventListener('resize', fit);
    fit();
  }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst() {
    const w = innerWidth;
    for (let i = 0; i < 110; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.3,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 11 - 3,
        size: 6 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length],
        life: 0,
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter(p => p.life < 150 && p.y < innerHeight + 20);
    for (const p of particles) {
      p.life++;
      p.vy += 0.3; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, (150 - p.life) / 40);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (particles.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function launchConfetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setup();
    burst();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  // ===== main =====
  // 音效代理：audio.js 載入失敗也不影響遊戲
  const sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      try {
        const fn = window.GameAudio && window.GameAudio[name];
        if (typeof fn === "function") return fn(...args);
      } catch (e) { /* 忽略音效錯誤 */ }
      return false;
    },
  });

  // 遊戲資料只存在記憶體（不使用 localStorage / IndexedDB）
  let mode = 'edit'; // 'edit' | 'play'
  let grid = emptyGrid();
  let marked = newMarked();
  let cells = {};
  let notice = '';
  let prevLines = 0;
  let ended = false; // 玩家手動結束後不能再標記
  let animate = true; // 只在整張重建時播放入場動畫

  const $ = id => document.getElementById(id);
  const gridEl = $('grid'), progressEl = $('progress'), messagesEl = $('messages');
  const bannerEl = $('banner'), introEl = $('intro'), hintEl = $('hint');
  const btn = { random: $('btn-random'), fill: $('btn-fill'), clear: $('btn-clear'), done: $('btn-done'), unmark: $('btn-unmark'), end: $('btn-end'), restart: $('btn-restart') };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function newMarked() {
    const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    m[CENTER][CENTER] = true;
    return m;
  }

  /* ---------- 小工具：對話框、提示、震動 ---------- */
  function ask(title, text, okLabel = '確定') {
    const dlg = $('dlg');
    $('dlg-title').textContent = title; $('dlg-text').textContent = text; $('dlg-ok').textContent = okLabel;
    return new Promise(res => { dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true }); dlg.showModal(); });
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const buzz = ms => { if (MiniHub.touchOn()) navigator.vibrate?.(ms); };
  function shake() { const c = $('card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); buzz([40, 40, 40]); }

  /* ---------- 建立格子 ---------- */
  function buildGrid() {
    gridEl.replaceChildren();
    cells = {};
    let i = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const wrap = document.createElement('div');
        const key = `${r},${c}`;
        wrap.className = 'cell';
        if (animate && !reduced) { wrap.classList.add('enter'); wrap.style.animationDelay = `${i++ * 18}ms`; }
        if (isFree(r, c)) {
          wrap.classList.add('free');
          wrap.innerHTML = '<span>★</span><small>FREE</small>';
          cells[key] = { wrap };
        } else if (mode === 'edit') {
          const input = document.createElement('input');
          input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 2; input.autocomplete = 'off';
          input.value = grid[r][c];
          input.dataset.r = r; input.dataset.c = c;
          input.setAttribute('aria-label', `第 ${r + 1} 列第 ${c + 1} 欄`);
          input.addEventListener('focus', () => input.select());
          input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '');
            grid[r][c] = input.value; notice = '';
            refresh();
            if (input.value.length === 2) focusNext(r, c, 1); // 填滿兩位自動跳下一格
          });
          input.addEventListener('keydown', e => {
            if (!MiniHub.kbdOn()) return;
            const d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
            if (d) { e.preventDefault(); moveFocus(r + d[0], c + d[1]); }
            else if (e.key === 'Enter') { e.preventDefault(); focusNext(r, c, 1); }
            else if (e.key === 'Backspace' && input.value === '') focusNext(r, c, -1);
          });
          wrap.append(input);
          cells[key] = { wrap, el: input };
        } else {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'num'; b.disabled = ended; b.textContent = grid[r][c];
          b.setAttribute('aria-label', `號碼 ${grid[r][c]}`);
          b.addEventListener('click', () => {
            if (ended) return;
            marked[r][c] = !marked[r][c];
            sound.beep(marked[r][c] ? 740 : 420, .07); buzz(12);
            refresh(key);
          });
          wrap.append(b);
          cells[key] = { wrap, el: b };
        }
        gridEl.append(wrap);
      }
    }
    animate = false;
  }
  function moveFocus(r, c) { cells[`${r},${c}`]?.el?.focus(); }
  function focusNext(r, c, step) { // 依閱讀順序（跳過 FREE）移動
    let k = r * SIZE + c + step;
    while (k >= 0 && k < SIZE * SIZE) {
      const rr = Math.floor(k / SIZE), cc = k % SIZE;
      if (!isFree(rr, cc)) return moveFocus(rr, cc);
      k += step;
    }
  }

  /* ---------- 更新畫面 ---------- */
  function refresh(poppedKey) {
    const playing = mode === 'play';
    for (const b of [btn.random, btn.fill, btn.clear, btn.done]) b.hidden = playing;
    btn.restart.hidden = !playing;
    btn.end.hidden = !playing || ended; btn.unmark.hidden = !playing || ended;
    $('step-1').className = playing ? 'done' : 'on';
    $('step-2').className = playing ? 'on' : '';
    document.body.dataset.mode = mode;
    introEl.textContent = playing
      ? (ended ? '遊戲已結束。' : '點擊被叫出的號碼來標記，連成線後可繼續玩，準備好再按「結束遊戲」。')
      : `填入 24 格數字（${MIN}～${MAX}，不可重複），或使用「隨機產生」。`;
    playing ? refreshPlay(poppedKey) : refreshEdit();
  }

  function refreshEdit() {
    bannerEl.hidden = true; hintEl.hidden = true; drawLines([]);
    const { errors, duplicates, messages, filled } = validateGrid(grid);
    for (const [key, { wrap, el }] of Object.entries(cells)) {
      if (!el) continue;
      const bad = errors.has(key) || duplicates.has(key);
      wrap.classList.toggle('invalid', bad);
      wrap.classList.toggle('filled', el.value !== '' && !bad);
      el.setAttribute('aria-invalid', String(bad));
    }
    $('meter').hidden = false;
    $('meter-bar').style.width = `${(filled / FILLABLE) * 100}%`;
    progressEl.textContent = `已填 ${filled} / ${FILLABLE}`;
    btn.done.classList.toggle('ready', filled === FILLABLE && !messages.length);
    const list = notice ? [notice, ...messages] : messages;
    messagesEl.replaceChildren(...list.map(m => { const li = document.createElement('li'); li.textContent = m; return li; }));
  }

  function refreshPlay(poppedKey) {
    const lines = findCompletedLines(marked);
    const inLine = new Set(lines.flat().map(([r, c]) => `${r},${c}`));
    let count = 0;
    for (const [key, { wrap }] of Object.entries(cells)) {
      const [r, c] = key.split(',').map(Number);
      const on = marked[r][c];
      if (on) count++;
      wrap.classList.toggle('marked', on);
      wrap.classList.toggle('in-line', on && inLine.has(key));
      wrap.firstElementChild?.setAttribute?.('aria-pressed', String(on));
      if (key === poppedKey && on && !reduced) { wrap.classList.remove('stamp'); void wrap.offsetWidth; wrap.classList.add('stamp'); }
    }
    $('meter').hidden = false;
    $('meter-bar').style.width = `${(count / 25) * 100}%`;
    progressEl.textContent = `已標記 ${count} / 25（含 FREE） ・ 連線 ${lines.length} 條`;
    // 「差一格」提示：哪些線只差一個
    const near = LINES.filter(l => l.filter(([r, c]) => !marked[r][c]).length === 1).length;
    hintEl.hidden = !near;
    hintEl.textContent = near ? `🔥 有 ${near} 條線只差 1 格就 BINGO！` : '';
    messagesEl.replaceChildren();
    bannerEl.hidden = lines.length === 0;
    bannerEl.textContent = lines.length ? (ended ? `🏁 遊戲結束，共完成 ${lines.length} 條線` : `🎉 已完成 ${lines.length} 條線，可繼續！`) : '';
    hintEl.hidden = hintEl.hidden || ended;
    drawLines(lines);
    if (lines.length > prevLines) {
      bannerEl.classList.remove('pop'); void bannerEl.offsetWidth; bannerEl.classList.add('pop');
      launchConfetti(); sound.fanfare(); buzz([60, 40, 120]);
    }
    prevLines = lines.length;
  }

  /* ---------- 連線繪製 ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  let lastLines = [];
  function drawLines(lines) {
    lastLines = lines;
    const svg = $('lines'); svg.replaceChildren();
    if (!lines.length) return;
    const g = gridEl.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    const ctr = ([r, c]) => { const b = cells[`${r},${c}`].wrap.getBoundingClientRect(); return [b.left - g.left + b.width / 2, b.top - g.top + b.height / 2]; };
    for (const line of lines) {
      const [x1, y1] = ctr(line[0]), [x2, y2] = ctr(line[SIZE - 1]);
      const L = Math.hypot(x2 - x1, y2 - y1) || 1, ex = (x2 - x1) / L * 14, ey = (y2 - y1) / L * 14;
      const p = document.createElementNS(NS, 'line');
      for (const [k, v] of Object.entries({ x1: x1 - ex, y1: y1 - ey, x2: x2 + ex, y2: y2 + ey, pathLength: 1 })) p.setAttribute(k, v);
      svg.append(p);
    }
  }
  addEventListener('resize', () => lastLines.length && drawLines(lastLines));

  /* ---------- 操作 ---------- */
  function setGrid(next, msg) {
    grid = next; notice = ''; animate = true;
    buildGrid(); refresh(); if (msg) toast(msg);
  }

  async function complete() {
    const { messages, filled } = validateGrid(grid);
    if (filled < FILLABLE) { notice = `還有 ${FILLABLE - filled} 格未填，填滿後才能完成。`; refresh(); shake(); return; }
    if (messages.length) { notice = '請先修正標示的錯誤或重複數字。'; refresh(); shake(); return; }
    if (!await ask('鎖定這張卡片？', '完成後數字將鎖定，無法修改。要開始遊戲嗎？', '開始遊戲')) return;
    mode = 'play'; ended = false; marked = newMarked(); prevLines = 0; notice = ''; animate = true;
    buildGrid(); refresh(); toast('卡片已鎖定，開始遊戲！');
  }

  async function restart() {
    if (!await ask('重新開始？', '會清除這張卡片與所有標記，且無法復原。', '重新開始')) return;
    if (!await MiniHub.requestNext()) return;
    mode = 'edit'; ended = false; grid = emptyGrid(); marked = newMarked(); prevLines = 0; notice = ''; animate = true;
    buildGrid(); refresh();
  }

  async function endGame() {
    const n = findCompletedLines(marked).length;
    if (!await ask('結束遊戲？', `目前完成 ${n} 條線。結束後將無法再標記。`, '結束遊戲')) return;
    ended = true; buildGrid(); refresh(); toast('遊戲結束');
  }

  async function unmarkAll() {
    if (!await ask('清除所有標記？', '數字保持不變，只會取消已標記的格子（FREE 保留）。', '清除標記')) return;
    marked = newMarked(); prevLines = 0; refresh(); toast('已清除標記');
  }

  // 防呆：遊戲中，或編輯中已填入數字時，重新整理／關閉頁面會先跳出警告
  addEventListener('beforeunload', e => {
    if (mode !== 'play' && !grid.some(row => row.some(v => v !== ''))) return;
    e.preventDefault(); e.returnValue = '';
  });

  btn.random.addEventListener('click', async () => {
    const hasData = grid.some(row => row.some(v => v !== ''));
    if (hasData && !await ask('重新隨機？', '目前填寫的數字會被整張覆蓋。若想保留已填數字，請用「補齊空格」。', '重新隨機')) return;
    setGrid(generateGrid(), '已隨機產生，仍可修改');
  });
  btn.fill.addEventListener('click', () => setGrid(fillBlanks(grid), '已補齊空格（保留你填的數字）'));
  btn.clear.addEventListener('click', async () => {
    if (grid.some(row => row.some(v => v !== '')) && !await ask('清空整張卡片？', '所有已填數字會被清除。', '清空')) return;
    setGrid(emptyGrid());
  });
  btn.done.addEventListener('click', complete);
  btn.end.addEventListener('click', endGame);
  btn.unmark.addEventListener('click', unmarkAll);
  btn.restart.addEventListener('click', restart);
  $('btn-sound').addEventListener('click', e => {
    const on = !sound.isSfxOn(); sound.setSfx(on);
    e.currentTarget.textContent = on ? '🔊' : '🔇'; e.currentTarget.setAttribute('aria-pressed', String(on));
    if (on) sound.beep(660); toast(on ? '音效已開啟' : '音效已關閉');
  });

  // 大廳整合（SDK）
  (function setupHub() {
    try { MiniHub.onPause(() => sound.suspend()); } catch (e) { /* 忽略 */ }
  })();

  buildGrid();
  refresh();

})();
