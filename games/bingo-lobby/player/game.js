(() => {
  "use strict";

  // ===== config =====
  const SIZE = 5;
  const CENTER = 2; // 中央 FREE 格的列／欄索引
  const MIN = 1, MAX = 75; // 可用號碼範圍（整張卡共用，不分欄）
  const FILLABLE = SIZE * SIZE - 1; // 24
  const isFree = (r, c) => r === CENTER && c === CENTER;
  const COL_LETTERS = ['B', 'I', 'N', 'G', 'O'];
  const colRange = c => [c * 15 + 1, c * 15 + 15]; // BINGO 正式版：B 1～15、I 16～30、N 31～45、G 46～60、O 61～75

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
    const off = officialOn(), pools = {};   // 正式版：每欄各自一個號碼池；否則共用 1～75
    const poolFor = c => {
      const k = off ? c : 0;
      if (!pools[k]) {
        const [lo, hi] = off ? colRange(c) : [MIN, MAX], p = [];
        for (let n = lo; n <= hi; n++) if (!used.has(n)) p.push(n);
        pools[k] = shuffle(p);
      }
      return pools[k];
    };
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
      if (!isFree(r, c) && next[r][c] === '') next[r][c] = String(poolFor(c).pop());
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
  function checkCell(raw, c) {
    if (raw === '') return null;
    if (!/^\d{1,2}$/.test(raw)) return '只能輸入數字';
    const n = Number(raw);
    if (n < MIN || n > MAX) return `需為 ${MIN}～${MAX}`;
    if (officialOn() && c != null) { const [lo, hi] = colRange(c); if (n < lo || n > hi) return `${COL_LETTERS[c]} 欄需為 ${lo}～${hi}`; }
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
      const msg = checkCell(raw, c);
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
  let drawn = new Set(); // 多人模式：主持人已抽出的號碼（卡片依此自動對號）
  let hostData = null;   // 多人模式：主持人公開的最新資料
  let auto = false;      // 多人模式：玩家自己選擇「自動對號」（主持人開啟自動對獎功能時才有效）

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

  const officialOn = () => !!(ROOM && hostData && hostData.ob === 1);   // 主持人是否開啟 BINGO 正式版（每欄限定範圍）
  const needLines = () => { const n = hostData && Number(hostData.rl); return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1; };   // 主持人設定：要連成幾條線才能上名次
  const hostAuto = () => !!(ROOM && hostData && hostData.am === 1);   // 主持人是否開啟自動對獎功能
  const autoOn = () => hostAuto() && auto;                            // 這位玩家是否正在自動對號

  /* ---------- 小工具：對話框、提示、震動 ---------- */
  function ask(title, text, okLabel = '確定') {
    const dlg = $('dlg');
    $('dlg-title').textContent = title; $('dlg-text').textContent = text; $('dlg-ok').textContent = okLabel;
    $('dlg-cancel').hidden = false;
    return new Promise(res => {
      dlg.returnValue = '';
      dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true });
      if (dlg.open) dlg.close('cancel');
      dlg.showModal();
    });
  }
  // 對話框按鈕直接關閉（不用 <form method="dialog">：嵌在大廳的沙盒 iframe 沒開表單權限，會讓按鈕沒反應）
  $('dlg-ok').addEventListener('click', () => $('dlg').close('ok'));
  $('dlg-cancel').addEventListener('click', () => $('dlg').close('cancel'));
  /** 只有「知道了」的提示 */
  function tell(title, text, okLabel = '知道了') {
    const dlg = $('dlg');
    $('dlg-title').textContent = title; $('dlg-text').textContent = text; $('dlg-ok').textContent = okLabel;
    $('dlg-cancel').hidden = true;
    return new Promise(res => {
      dlg.returnValue = '';
      dlg.addEventListener('close', () => { $('dlg-cancel').hidden = false; res(); }, { once: true });
      if (dlg.open) dlg.close('cancel');
      dlg.showModal();
    });
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
            if (ROOM) { // 多人模式：自動對號開啟時不用點；否則只能標記主持人已抽出的號碼
              if (autoOn()) { toast('自動對號已開啟，不需要手動標記'); return; }
              if (!drawn.has(Number(grid[r][c]))) { toast('主持人還沒有抽出這個號碼'); sound.beep(300, .07); buzz([30, 30]); return; }
            }
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
    if (ROOM) { // 多人模式：開始 / 結束 / 開新局全由主持人控制，玩家只能在開放時填寫數字
      btn.done.hidden = btn.restart.hidden = btn.end.hidden = btn.unmark.hidden = true;
      document.querySelector('.actions').hidden = playing;
    }
    $('step-1').className = playing ? 'done' : 'on';
    $('step-2').className = playing ? 'on' : '';
    document.body.dataset.mode = mode;
    introEl.textContent = ROOM
      ? (!playing ? `${officialOn() ? '依欄位範圍填入 24 格數字（不可重複）' : `填入 24 格數字（${MIN}～${MAX}，不可重複）`}，或用「隨機產生」。主持人按下開始後，卡片會自動鎖定。`
        : ended ? '本局已結束，等主持人開新局（卡片數字會保留）。'
        : autoOn() ? '卡片已鎖定，主持人抽出的號碼會自動標記。'
        : '卡片已鎖定。主持人抽出號碼後，請點擊卡片上的號碼來標記。')
      : playing
      ? (ended ? '遊戲已結束。' : '點擊被叫出的號碼來標記，連成線後可繼續玩，準備好再按「結束遊戲」。')
      : `填入 24 格數字（${MIN}～${MAX}，不可重複），或使用「隨機產生」。`;
    playing ? refreshPlay(poppedKey) : refreshEdit();
    refreshClaim();
    refreshAuto();
    refreshOfficial();
    queueSave();
  }

  /** 自動對號開關：只有主持人開啟「自動對獎功能」時才顯示 */
  let tipsFolded = false;
  try { tipsFolded = localStorage.getItem('bingoLobby.tipsFolded') === '1'; } catch (e) { /* 忽略 */ }
  function refreshAuto() {
    const row = $('auto-row'); if (!row) return;
    row.hidden = !hostAuto();
    $('auto-toggle').checked = auto;
    // 提示收合：只有主持人開啟自動對獎、出現這個面板時才生效，收合後隱藏說明文字，讓出空間給電子卡
    const folded = hostAuto() && tipsFolded;
    document.body.dataset.tips = folded ? 'folded' : '';
    $('auto-fold').setAttribute('aria-expanded', String(!folded));
    $('auto-fold').textContent = folded ? '▸ 展開提示' : '▾ 收合提示';
  }

  /** BINGO 正式版提示：顯示欄位範圍說明；回傳這次是否剛切換（主持人開關改變） */
  let lastOfficial = false;
  function refreshOfficial() {
    const on = officialOn();
    $('official-note').hidden = $('col-head').hidden = !on;
    if (on === lastOfficial) return false;
    lastOfficial = on;
    if (mode === 'edit') toast(on ? '本房為 BINGO 正式版：每欄數字有固定範圍，請依欄位填寫' : '主持人已關閉 BINGO 正式版：號碼 1～75 不分欄');
    return true;
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
    progressEl.textContent = `已標記 ${count} / 25（含 FREE） ・ 連線 ${lines.length} 條${ROOM ? `（需 ${needLines()} 條才能上名次）` : ''}`;
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
      launchConfetti(); sound.line(lines.length); buzz([60, 40, 120]);
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
    if (ROOM) return; // 多人模式卡片會自動保存並恢復
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
  $('auto-fold').addEventListener('click', () => {
    tipsFolded = !tipsFolded;
    try { localStorage.setItem('bingoLobby.tipsFolded', tipsFolded ? '1' : '0'); } catch (e) { /* 忽略 */ }
    refreshAuto();
  });
  $('auto-toggle').addEventListener('change', e => {
    auto = e.currentTarget.checked;
    if (hostData) reconcile(); else refresh();
    toast(auto ? '自動對號已開啟' : '自動對號已關閉，請自己點擊號碼標記');
  });
  btn.done.addEventListener('click', complete);
  btn.end.addEventListener('click', endGame);
  btn.unmark.addEventListener('click', unmarkAll);
  btn.restart.addEventListener('click', restart);

  /* ---------- 房間同步：卡片數值依「房號 + 玩家」分開保存，意外退出可即時恢復 ---------- */
  // 只有多人模式（mode=multi 且有 6 碼房號）才同步；單人練習不存。
  // 本機（localStorage）每次變動立即寫入 → 重新整理／關掉再開馬上恢復；雲端（Firestore）防抖寫入 → 換裝置也能恢復。
  const ROOM = (() => {
    const q = new URLSearchParams(location.search), id = q.get('room') || '';
    return q.get('mode') === 'multi' && /^\d{6}$/.test(id) ? id : '';
  })();
  const SYNC_TTL = 12 * 60 * 60 * 1000; // 與房間存活時間一致
  const P = (() => { try { return parent !== window && parent.document ? parent : null; } catch (e) { return null; } })();
  const cloud = () => { try { const A = P && P.MiniHubAuth; return A && A.cards && A.rooms.on() ? A.cards : null; } catch (e) { return null; } };
  const uidNow = () => { try { return MiniHub.player().uid || ''; } catch (e) { return ''; } };
  let syncStarted = false, syncReady = false, lastKey = '', saveTimer = 0, cloudPending = false, roomClosed = false;

  const stateKey = () => JSON.stringify({ mode, grid, marked, ended, auto });
  const snapshot = () => ({ v: 1, mode, grid, marked, ended, auto, at: Date.now() });
  const lsKey = () => `bingoLobby.card.${ROOM}.${uidNow()}`;

  function sane(d) {
    const g5 = (a, ok) => Array.isArray(a) && a.length === SIZE && a.every(r => Array.isArray(r) && r.length === SIZE && r.every(ok));
    return !!d && (d.mode === 'edit' || d.mode === 'play') && Date.now() - (d.at || 0) < SYNC_TTL
      && g5(d.grid, v => typeof v === 'string' && /^\d{0,2}$/.test(v)) && g5(d.marked, v => typeof v === 'boolean');
  }
  function readLocal() { try { const d = JSON.parse(localStorage.getItem(lsKey())); return sane(d) ? d : null; } catch (e) { return null; } }
  function writeLocal(d) { try { localStorage.setItem(lsKey(), JSON.stringify(d)); } catch (e) { /* 忽略 */ } }

  function applySaved(d) {
    mode = d.mode; grid = d.grid.map(r => [...r]); marked = d.marked.map(r => [...r]); ended = !!d.ended;
    marked[CENTER][CENTER] = true; notice = ''; animate = false; auto = d.auto === true;
    prevLines = mode === 'play' ? findCompletedLines(marked).length : 0; // 恢復時不重播紙花
    lastKey = stateKey();
    buildGrid(); refresh();
  }

  async function pushCloud() {
    if (roomClosed) return;
    const c = cloud();
    if (!c) { cloudPending = true; return; }
    try { await c.save(ROOM, snapshot()); cloudPending = false; } catch (e) { cloudPending = true; }
  }
  // 狀態有變才存；本機立即、雲端延遲 0.6 秒合併（雲端比對完成前只存本機）
  function queueSave() {
    if (!ROOM || !syncStarted || roomClosed) return;
    const k = stateKey();
    if (k === lastKey) return;
    lastKey = k;
    writeLocal(snapshot());
    if (!syncReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushCloud, 600);
  }
  function flushNow() { if (!ROOM || !syncReady || roomClosed) return; clearTimeout(saveTimer); writeLocal(snapshot()); pushCloud(); }
  addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); else if (cloudPending) pushCloud(); });
  addEventListener('online', () => { if (cloudPending) pushCloud(); });

  // 登入完成（取得 uid）後：先用本機資料立即恢復，再與雲端比較，取較新的一份
  async function startSync() {
    if (!ROOM || syncStarted || !uidNow()) return;
    syncStarted = true;
    const local = readLocal();
    if (local) { applySaved(local); toast(`已恢復房間 ${ROOM} 的卡片`); }
    const base = stateKey();
    let remote = null, reached = false;
    for (let i = 0; i < 6 && !reached; i++) {
      const c = cloud();
      if (c) { try { remote = await c.load(ROOM); reached = true; } catch (e) { break; } }
      else await new Promise(r => setTimeout(r, 1000));
    }
    const untouched = stateKey() === base; // 等雲端回應時玩家若已動過卡片，就以玩家當下的為準
    let applied = false;
    if (sane(remote) && untouched && (!local || remote.at > local.at)) {
      applySaved(remote); writeLocal(remote); applied = true;
      if (!local) toast(`已恢復房間 ${ROOM} 的卡片`);
    }
    syncReady = true;
    lastKey = stateKey();
    reconcile(); // 還原完成後，才套用主持人目前的狀態（避免空卡被先鎖定）
    // 本機較新（或雲端沒有）→ 把目前卡片推上雲端
    if (!applied && (mode === 'play' || grid.some(r => r.some(v => v !== '')))) pushCloud();
  }

  /* ---------- 完成賓果：玩家自行宣告 → 主持人端自動排進名次 ---------- */
  let claimSent = false;   // 本局已送出宣告（等主持人確認；主持人公開的名次會寫回 cl）
  const claimBox = $('claim'), claimBtn = $('btn-bingo'), claimMsg = $('claim-msg');
  const myId = () => uidNow() || (window.BingoRoom ? window.BingoRoom.getUid() : '');
  const hostList = key => (hostData && Array.isArray(hostData[key]) ? hostData[key] : []);

  /** 依主持人抽出的順序重播，回傳「第幾個新號碼時完成第一條線」（尚未完成回傳 0）。同一個 k = 同時賓果 */
  function bingoK() {
    const pos = new Map();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!isFree(r, c) && grid[r][c] !== '') pos.set(Number(grid[r][c]), [r, c]);
    const m = newMarked();
    let k = 0;
    for (const n of drawn) {
      k++;
      const p = pos.get(n);
      if (!p) continue;
      m[p[0]][p[1]] = true;
      if (findCompletedLines(m).length >= needLines()) return k;
    }
    return 0;
  }

  function refreshClaim() {
    if (!ROOM) { claimBox.hidden = true; return; }
    const me = myId();
    const mine = hostList('cl').find(x => x[0] === me);
    const rejected = hostList('rj').includes(me);
    const lines = mode === 'play' ? findCompletedLines(marked).length : 0, need = needLines();
    if (mode !== 'play' || (!lines && !mine && !rejected)) { claimBox.hidden = true; return; }
    claimBox.hidden = false;
    claimBtn.hidden = true;
    claimBox.dataset.s = rejected ? 'bad' : mine ? 'ok' : claimSent ? 'wait' : lines >= need ? 'ready' : 'wait';
    if (rejected) claimMsg.textContent = '主持人已撤銷你的賓果宣告，如有疑問請詢問主持人。';
    else if (mine) claimMsg.textContent = `🏆 你已排進第 ${mine[1]} 名！`;
    else if (claimSent) claimMsg.textContent = '已通知主持人，等待確認排名…';
    else if (ended) { claimMsg.textContent = '本局已結束。'; }
    else if (lines < need) claimMsg.textContent = `目前連成 ${lines} 條，要連成 ${need} 條才能上名次。`;
    else { claimMsg.textContent = `已連成 ${lines} 條（需 ${need} 條）！按下按鈕通知主持人，系統會依完成順序自動排名次。`; claimBtn.hidden = false; }
  }

  async function sendClaim() {
    if (!ROOM || mode !== 'play' || ended) return;
    const k = bingoK();
    if (!k || findCompletedLines(marked).length < needLines()) { toast(`要連成 ${needLines()} 條線才能上名次`); return; }
    if (!await ask('完成賓果？', '會通知主持人並自動排進名次。請確認你的卡片真的有連成線。', '完成賓果')) return;
    const data = { uid: myId(), name: (MiniHub.player().displayName || MiniHub.player().name || '玩家').slice(0, 20), k };
    claimSent = true; refreshClaim();
    try { if (roomConn) roomConn.send(window.BingoRoom.MSG.CLAIM, data); } catch (e) { /* 忽略 */ }
    try {
      const A = P && P.MiniHubAuth, c = A && A.rooms && A.rooms.claims;
      if (c && A.rooms.on()) await c.send(ROOM, data);
    } catch (e) { toast('網路不穩，宣告可能未送出，請再試一次'); claimSent = false; refreshClaim(); return; }
    toast('已通知主持人');
  }
  claimBtn.addEventListener('click', sendClaim);
  function resetClaim() {
    if (!claimSent) return;
    claimSent = false;
    try { const A = P && P.MiniHubAuth, c = A && A.rooms && A.rooms.claims; if (c && A.rooms.on()) c.remove(ROOM); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 主持人同步：開始 → 鎖卡、抽號 → 自動對號、開新局 → 保留數字並解鎖 ---------- */
  const marksFromDrawn = () => {
    const m = newMarked();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
      if (!isFree(r, c) && grid[r][c] !== '' && drawn.has(Number(grid[r][c]))) m[r][c] = true;
    return m;
  };
  // 鎖卡前整理：保留合法且不重複的數字，其餘清空後隨機補齊（晚進房或沒填完也能玩）
  function lockable(g) {
    const seen = new Set();
    return fillBlanks(g.map(row => row.map((v, c) => {
      if (v === '' || checkCell(v, c)) return '';
      const n = Number(v);
      if (seen.has(n)) return '';
      seen.add(n); return v;
    })));
  }
  function reconcile() {
    if (!ROOM || !hostData || !syncReady) return;
    const st = hostData.status;
    drawn = new Set((Array.isArray(hostData.drawn) ? hostData.drawn : []).map(Number));
    if (st === 'playing' || st === 'ended') {
      if (mode === 'edit') {
        const dlg = $('dlg'); if (dlg.open) dlg.close('cancel');
        const before = JSON.stringify(grid), next = lockable(grid);
        grid = next; mode = 'play'; notice = ''; animate = true; prevLines = 0;
        marked = autoOn() ? marksFromDrawn() : newMarked(); ended = st === 'ended'; prevLines = findCompletedLines(marked).length;
        buildGrid(); refresh();
        toast(before === JSON.stringify(grid) ? '主持人已開始，卡片已鎖定' : '主持人已開始，空格已自動補齊並鎖定');
        return;
      }
      // 自動對號：依已抽出號碼全部標記；手動：保留玩家自己點的，但主持人撤回的號碼要取消
      const valid = marksFromDrawn();
      const next = autoOn() ? valid : marked.map((row, r) => row.map((v, c) => v && valid[r][c]));
      let popped = null;
      for (let r = 0; r < SIZE && !popped; r++) for (let c = 0; c < SIZE; c++) if (next[r][c] && !marked[r][c]) { popped = `${r},${c}`; break; }
      const endedChanged = ended !== (st === 'ended');
      marked = next; ended = st === 'ended';
      if (endedChanged) buildGrid();
      if (popped && autoOn()) { sound.beep(740, .07); buzz(12); }
      refresh(popped || undefined);
    } else if (mode === 'play') { // 主持人開新局：數字保留，清除連線與標記，重新開放修改
      resetClaim();
      mode = 'edit'; ended = false; marked = newMarked(); prevLines = 0; notice = ''; animate = true;
      buildGrid(); refresh(); toast('主持人開新局：數字已保留，可重新修改');
    }
  }
  function receiveHost(d) {
    if (!ROOM || roomClosed || !d || d.v !== 1 || d.room !== ROOM) return;
    if (hostData && d.at < hostData.at) return; // 忽略較舊的資料
    hostData = d; reconcile(); refreshAuto();
    if (refreshOfficial()) refresh();   // 正式版開關改變：重新檢查卡片欄位範圍
  }
  /* ---------- 主持人刪除房間：清除這個房間的卡片、宣告與抽號資料，回大廳 ---------- */
  async function onRoomClosed() {
    if (!ROOM || roomClosed) return;
    roomClosed = true;
    clearTimeout(saveTimer);
    try { localStorage.removeItem(lsKey()); } catch (e) { /* 忽略 */ }
    try {
      const A = P && P.MiniHubAuth;
      if (A && A.rooms && A.rooms.on()) {
        if (A.cards) A.cards.remove(ROOM).catch(() => {});
        if (A.rooms.claims) A.rooms.claims.remove(ROOM);
      }
    } catch (e) { /* 忽略 */ }
    try { if (unwatchHost) unwatchHost(); if (unwatchRoom) unwatchRoom(); } catch (e) { /* 忽略 */ }
    grid = emptyGrid(); marked = newMarked(); drawn = new Set(); hostData = null; ended = false; claimSent = false;
    mode = 'edit'; notice = ''; animate = false; prevLines = 0;
    buildGrid(); refresh();
    await tell('房間已被刪除', '主持人已刪除這個房間，你的卡片與本局抽出的資料都已清除。', '回大廳');
    location.href = $('lnk-lobby').getAttribute('href');
  }
  let unwatchRoom = null;
  function attachRoom() {
    if (unwatchRoom) return true;
    try {
      const A = P && P.MiniHubAuth;
      if (!A || !A.rooms || !A.rooms.watch || !A.rooms.on()) return false;
      unwatchRoom = A.rooms.watch(ROOM, ok => { if (!ok) onRoomClosed(); });
      return !!unwatchRoom;
    } catch (e) { return false; }
  }
  const attachAll = () => { const a = attachHost(), b = attachRoom(); return a && b; };
  let unwatchHost = null, roomConn = null;
  function attachHost() {
    if (unwatchHost) return true;
    try {
      const A = P && P.MiniHubAuth;
      if (!A || !A.rooms || !A.rooms.live || !A.rooms.on()) return false;
      unwatchHost = A.rooms.live.watch(ROOM, d => receiveHost(d));
      return !!unwatchHost;
    } catch (e) { return false; }
  }
  (function startHostWatch() {
    if (!ROOM) return;
    try { // 同瀏覽器即時（BroadcastChannel）
      const R = window.BingoRoom;
      if (R) { const conn = roomConn = R.connect({ code: ROOM, role: 'player' }); conn.on(m => { if (m.type === R.MSG.SNAPSHOT) receiveHost(m.data); else if (m.type === R.MSG.CLOSED) onRoomClosed(); }); conn.send(R.MSG.SNAPSHOT_REQ); addEventListener('pagehide', () => { try { conn.close(); } catch (e) { /* 忽略 */ } }); }
    } catch (e) { /* 忽略 */ }
    if (!attachAll()) { const t = setInterval(() => { if (attachAll()) clearInterval(t); }, 2000); }
    try { MiniHub.onChange(attachAll); } catch (e) { /* 忽略 */ }
  })();

  // 大廳整合（SDK）
  (function setupHub() {
    try { MiniHub.onPause(() => sound.suspend()); } catch (e) { /* 忽略 */ }
    try { MiniHub.onChange(startSync); } catch (e) { /* 忽略 */ }
  })();

  buildGrid();
  refresh();
  startSync();
  if (ROOM && !syncStarted) { const t = setInterval(() => { startSync(); if (syncStarted) clearInterval(t); }, 1000); }

})();
