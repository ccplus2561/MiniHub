(() => {
'use strict';

const N = 10;
const COLORS = ['blue', 'orange', 'purple', 'green', 'yellow', 'cyan'];
/* 方塊定義：w = 權重 [簡單, 中等, 困難, 超難, 地獄]，依分數階段切換（不顯示難度） */
/* 由基礎形狀自動產生所有不重複的旋轉／鏡像方向 */
function orients(base) {
  const seen = new Set(), out = [];
  let cur = base;
  for (let m = 0; m < 2; m++) {
    for (let r = 0; r < 4; r++) {
      cur = cur.map(([y, x]) => [x, -y]);
      const my = Math.min(...cur.map(c => c[0])), mx = Math.min(...cur.map(c => c[1]));
      const norm = cur.map(([y, x]) => [y - my, x - mx]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const key = JSON.stringify(norm);
      if (!seen.has(key)) { seen.add(key); out.push(norm); }
    }
    cur = cur.map(([y, x]) => [y, -x]);
  }
  return out;
}
const SHAPE_DEFS = [
  { w: [3, 1.5, .5, .2, .1], c: [[[0,0]]] },
  { w: [3, 2, 1, .5, .3], c: [[[0,0],[0,1]], [[0,0],[1,0]]] },
  { w: [2.5, 2, 1.5, 1, .8], c: [[[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]], [[0,0],[1,0],[1,1]], [[0,1],[1,0],[1,1]]] },
  { w: [3, 3, 2, 1.5, 1], c: [[[0,0],[1,0],[2,0]], [[0,0],[0,1],[0,2]]] },
  { w: [3, 3, 2, 1.5, 1], c: [[[0,0],[0,1],[1,0],[1,1]]] },
  { w: [.5, 1, 1.5, 1.5, 1.5], c: [
    [[0,0],[1,0],[2,0],[2,1]], [[0,1],[1,1],[2,1],[2,0]], [[0,0],[0,1],[1,0],[2,0]], [[0,0],[0,1],[1,1],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]], [[0,0],[0,1],[0,2],[1,2]], [[0,2],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,1],[1,2]]] },
  { w: [.5, 1, 1.5, 1.5, 1.2], c: [[[0,1],[1,0],[1,1],[1,2]], [[0,0],[0,1],[0,2],[1,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,1],[1,0],[1,1],[2,1]]] },
  { w: [0, .7, 2, 3, 3], c: [[[0,0],[0,1],[1,1],[1,2]], [[0,1],[0,2],[1,0],[1,1]], [[0,1],[1,0],[1,1],[2,0]], [[0,0],[1,0],[1,1],[2,1]]] },
  { w: [.5, 2, 3, 3, 2.5], c: [[[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]]] },
  { w: [0, .7, 1.5, 2, 2], c: [[[0,0],[1,0],[2,0],[3,0],[4,0]], [[0,0],[0,1],[0,2],[0,3],[0,4]]] },
  { w: [.5, 1.5, 2, 2.5, 2], c: [[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]] },
  { w: [0, .5, 2, 3, 3], c: [[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]] },
  { w: [0, .3, 1.2, 2, 2.5], c: [[[0,0],[1,0],[2,0],[2,1],[2,2]], [[0,0],[0,1],[0,2],[1,0],[2,0]], [[0,0],[0,1],[0,2],[1,2],[2,2]], [[0,2],[1,2],[2,0],[2,1],[2,2]]] },
  { w: [0, .5, 1.5, 2.5, 3], c: [[[0,1],[1,0],[1,1],[1,2],[2,1]]] },
  /* ---- 進階樣式：斜線、金字塔、階梯、W/U/N/P 形、空心環…（越複雜越晚出現）---- */
  /* w = [簡單, 中等, 困難, 超難, 地獄] */
  { w: [0, 0, .6, 1.5, 2.2],  c: orients([[0,0],[0,1],[1,1],[2,1],[2,2]]) },                 // Z/S 五格
  { w: [0, 0, .5, 1.5, 2.2],  c: orients([[0,0],[1,0],[1,1],[2,1],[2,2]]) },                 // W 形
  { w: [0, 0, .6, 1.5, 2.2],  c: orients([[0,0],[0,2],[1,0],[1,1],[1,2]]) },                 // U 形
  { w: [0, 0, .4, 1.2, 2],    c: orients([[0,1],[1,1],[2,0],[2,1],[3,0]]) },                 // N 形
  { w: [0, 0, .5, 1.3, 2],    c: orients([[0,0],[0,1],[1,0],[1,1],[2,0]]) },                 // P 形
  { w: [0, 0, .8, 1.5, 2],    c: orients([[0,0],[0,1],[0,2],[1,1],[2,1]]) },                 // 大 T
  { w: [0, .3, 1.2, 2, 2.5],  c: orients([[0,0],[1,0],[1,1],[2,0],[2,1],[2,2]]) },           // 階梯三角 6 格
  { w: [0, 0, .8, 1.8, 2.5],  c: orients([[0,1],[0,2],[1,0],[1,1],[1,2],[1,3]]) },           // 梯形金字塔 6 格
  { w: [0, 0, 0, .8, 2],      c: orients([[0,2],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4]]) }, // 大金字塔 9 格
  { w: [0, 0, 0, .6, 1.5],    c: orients([[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]]) },       // 空心環 8 格
  { w: [0, 0, .3, 1, 1.5],    c: orients([[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]]) },       // 2×4 長方
];
const SHAPES = [];
const SHAPE_W = [];
SHAPE_DEFS.forEach(d => d.c.forEach(c => { SHAPES.push(c); SHAPE_W.push(d.w); }));
const TIERS = [0, 300, 900, 1800, 3000]; // 各階段起始分數（簡單／中等／困難／超難／地獄）
const CHEERS = ['太棒了！', '漂亮！', '手感很好！', '完美消除！', '繼續保持！'];

const COLOR_HEX = { blue: '#6cc0ff', orange: '#ffc36b', purple: '#d1a2ff', green: '#7ce9b0', yellow: '#ffe27a', cyan: '#7ce8ff' };
/* 主題：col 依 COLORS 順序（blue, orange, purple, green, yellow, cyan）各為 [亮, 中, 暗]；br 圓角、bev 立體邊、gloss 高光、glow 背景光 */
const THEMES = [
  { name: '經典', br: '18%', bev: '3px', gloss: 1, glow: '#1d3170', col: [['#6cc0ff','#2674ed','#1454bd'],['#ffc36b','#f27a27','#bd501c'],['#d1a2ff','#8a55e8','#6138ba'],['#7ce9b0','#20b878','#128455'],['#ffe27a','#f5b72d','#bd8318'],['#7ce8ff','#21a9dc','#147ba9']] },
  { name: '糖果', br: '36%', bev: '3px', gloss: 1, glow: '#4a2a6a', col: [['#bfe3ff','#7db8f5','#4f8fd0'],['#ffd3b0','#ff9f7a','#d96f4c'],['#e6c8ff','#b88af0','#8a5cc4'],['#c8f5d2','#82dca0','#4fae72'],['#fff3b0','#ffd96b','#d6a935'],['#ffd0e6','#ff8fc0','#d65f95']] },
  { name: '霓虹', br: '12%', bev: '0px', gloss: 0, glow: '#2a1060', col: [['#5ad1ff','#0077ff','#0043b3'],['#ffb04d','#ff5e00','#b33d00'],['#e07bff','#a200ff','#6a00a8'],['#7bff8a','#00d632','#008a20'],['#fff95e','#ffe600','#b8a600'],['#5cfff0','#00e5d0','#009688']] },
  { name: '森林', br: '22%', bev: '3px', gloss: .6, glow: '#1d4a30', col: [['#8fc7d9','#3f8aa3','#2a6076'],['#e0a96b','#b5733a','#7d4b22'],['#b69bc9','#7d5f96','#553f6b'],['#9bd48a','#4f9a45','#2f6b2c'],['#e8d98a','#c4a93f','#8a7524'],['#8fd6b8','#3f9c80','#2a6e58']] },
  { name: '海洋', br: '50%', bev: '2px', gloss: 1, glow: '#0f4a6a', col: [['#7fd4ff','#1e90d6','#0e5f9a'],['#ffb199','#ff6f61','#b8433b'],['#a9b4ff','#5c6bd6','#3a4599'],['#8ff0d0','#2bbf9a','#16846a'],['#fff0b3','#f2cf72','#b89a3c'],['#9ff5ff','#2ec4de','#1a8499']] },
  { name: '日落', br: '26%', bev: '3px', gloss: .8, glow: '#6a2a3a', col: [['#8d9bff','#5560d9','#3a3f9c'],['#ffb26b','#ff6a2b','#b83f12'],['#e08cff','#a346d6','#702a9a'],['#ff9aa8','#e2486a','#a22848'],['#ffe58a','#ffb320','#b87a0c'],['#ffb0d6','#f06aa8','#a8407a']] },
  { name: '櫻花', br: '40%', bev: '2px', gloss: 1, glow: '#5a2a50', col: [['#cfe0ff','#8fb0f0','#5d7fc2'],['#ffd9c9','#ffa58a','#d2755a'],['#ecd0ff','#c08ee8','#8d5db5'],['#d9f2d0','#9fd68f','#6aa05c'],['#fff0c4','#f5d57a','#c6a43c'],['#ffd6e8','#ff9ac4','#d0689a']] },
  { name: '熔岩', br: '6%', bev: '4px', gloss: .5, glow: '#5a1a10', col: [['#7a8cff','#3f4fd0','#27318f'],['#ffb347','#ff5a14','#a82d00'],['#c45a8f','#8e2a60','#5c1840'],['#9aff7a','#3fc01f','#25820f'],['#fff27a','#ffc400','#b88a00'],['#ff7a6b','#e0301f','#8f1a10']] },
  { name: '黑金', br: '10%', bev: '3px', gloss: .9, glow: '#3a3015', col: [['#d8e2f0','#8fa3bd','#566a85'],['#ffe08a','#d9a521','#8f6a0a'],['#cfc4e0','#8c7aa8','#5a4a74'],['#c9e0cf','#7fa58a','#4d7358'],['#fff1b8','#e6c35a','#a68a2a'],['#c4e4ea','#7fb4c0','#4d808c']] },
  { name: '復古像素', br: '0%', bev: '5px', gloss: 0, glow: '#1a3a2a', col: [['#4da6ff','#1d6fe0','#0f3f94'],['#ff9d3d','#e66a00','#8f3f00'],['#b57bff','#7a3fe0','#472094'],['#6fe06f','#2fb02f','#176817'],['#ffe14d','#e6b800','#8f7000'],['#4de0e0','#1fb0b0','#0f6e6e']] }
];
const THEME_STEP = 600; // 每達 600 分換一次主題；清空棋盤也會換
/* 道具：花費分數取得 */
const POWERS = {
  reroll: { cost: 120, name: '換方塊', icon: '🔄' },
  bomb:   { cost: 250, name: '炸彈',   icon: '💣' },
  row:    { cost: 180, name: '清橫排', icon: '➖' }
};
const ALL_CLEAR = 300; // 清空整個棋盤的額外獎勵
const MIN_COST = Math.min(...Object.values(POWERS).map(p => p.cost));
const KEY_BEST = 'blockblast.best', KEY_GAME = 'blockblast.game';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

const MH = window.MiniHub;
const $ = id => document.getElementById(id);
const el = {
  board: $('board'), wrap: $('boardWrap'), fx: $('fx'), overlay: $('overlay'), tray: $('pieceTray'),
  score: $('score'), powers: $('powers'), best: $('bestScore'), trend: $('trend'), msg: $('message'),
  book: $('bookButton'), bookModal: $('bookModal'), bookGrid: $('bookGrid'), bookClose: $('bookClose')
};
const fmt = n => n.toLocaleString('zh-TW');
const snd = (t, l) => window.GameAudio && GameAudio.play(t, l);
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

let board, pieces, slotEls = [], cells = [];
let score = 0, peak = 0, best = parseInt(store.get(KEY_BEST), 10) || 0, bestAtStart = 0, combo = 0;   // peak：本局最高分（花分數買道具會讓 score 下降，排行榜以 peak 為準）
let turnTimer = 0, overTimer = 0, power = null, powerAim = null;
const powerBtns = {};
let selected = -1, paused = false, over = false, busy = false, modal = false;
let drag = null, pvKey = '', justDragged = false;
let themeIdx = 0, themeMilestone = 0, themeTimer = 0;

el.best.textContent = fmt(best);

/* ---------- themes ---------- */
function applyTheme(i) {
  themeIdx = ((i % THEMES.length) + THEMES.length) % THEMES.length;
  const t = THEMES[themeIdx], st = document.documentElement.style;
  COLORS.forEach((n, k) => {
    t.col[k].forEach((v, j) => st.setProperty(`--${n}${j + 1}`, v));
    COLOR_HEX[n] = t.col[k][0];
  });
  st.setProperty('--br', t.br); st.setProperty('--bev', t.bev);
  st.setProperty('--gloss', t.gloss); st.setProperty('--glow', t.glow);
}
function switchTheme(why) {
  applyTheme(themeIdx + 1);
  clearTimeout(themeTimer);
  themeTimer = setTimeout(() => { if (!over) banner(`新主題：${THEMES[themeIdx].name}`, why === 'all' ? '全部清空，換新造型！' : '分數里程碑，換新造型！', false); }, why === 'all' ? 900 : 300);
  snd('select');
}
function checkTheme(allClear) {
  const ms = Math.floor(score / THEME_STEP);
  let why = allClear ? 'all' : null;
  if (ms > themeMilestone) { themeMilestone = ms; why = why || 'score'; }
  if (why) switchTheme(why);
}

/* ---------- helpers ---------- */
const emptyBoard = () => Array.from({ length: N }, () => Array(N).fill(null));
const dims = c => ({ h: Math.max(...c.map(x => x[0])) + 1, w: Math.max(...c.map(x => x[1])) + 1 });
const say = t => { if (el.msg) el.msg.textContent = t; };
const blocked = () => paused || over || busy || modal;

function fits(p, r, c, b = board) {
  return p.cells.every(([dr, dc]) => {
    const y = r + dr, x = c + dc;
    return y >= 0 && y < N && x >= 0 && x < N && !b[y][x];
  });
}
function canPlaceAnywhere(p) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p, r, c)) return true;
  return false;
}
function fullLines(b) {
  const rows = [], cols = [];
  for (let y = 0; y < N; y++) if (b[y].every(Boolean)) rows.push(y);
  for (let x = 0; x < N; x++) if (b.every(row => row[x])) cols.push(x);
  return { rows, cols };
}
function tier() {
  let t = 0;
  TIERS.forEach((s, i) => { if (score >= s) t = i; });
  return t;
}
function pickShape() {
  const t = tier();
  let total = 0;
  SHAPE_W.forEach(w => { total += w[t]; });
  let r = Math.random() * total;
  for (let i = 0; i < SHAPES.length; i++) {
    r -= SHAPE_W[i][t];
    if (r < 0) return SHAPES[i];
  }
  return SHAPES[0];
}
function randomPiece() {
  return { cells: pickShape().map(p => p.slice()), color: COLORS[Math.random() * COLORS.length | 0] };
}
/* 檢查三塊方塊是否存在「依某種順序全部放得下」的解（含消除），有運算上限避免卡頓 */
function sequenceSolvable(ps, b) {
  let budget = 30000;
  const go = (bd, rest) => {
    if (!rest.length) return true;
    if (budget-- <= 0) return true;
    for (let k = 0; k < rest.length; k++) {
      const p = rest[k], others = rest.filter((_, j) => j !== k);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!fits(p, r, c, bd)) continue;
        const nb = bd.map(row => row.slice());
        p.cells.forEach(([dr, dc]) => { nb[r + dr][c + dc] = 1; });
        const { rows, cols } = fullLines(nb);
        rows.forEach(y => nb[y].fill(null));
        cols.forEach(x => { for (let y = 0; y < N; y++) nb[y][x] = null; });
        if (go(nb, others)) return true;
      }
    }
    return false;
  };
  return go(b, ps);
}
/* 棋盤偏空（已填格數 ≤ 25%）時，每組方塊保證出現 1 個大塊 */
const BIG_SHAPES = SHAPES.filter(s => { const d = dims(s); return s.length >= 5 && s.length <= 9 && Math.max(d.w, d.h) >= 3; });
const SPARSE_MAX = 25;
function isSparse() { return board.reduce((n, row) => n + row.filter(Boolean).length, 0) <= SPARSE_MAX; }
function bigPiece() {
  const t = tier(), pool = BIG_SHAPES.filter(s => SHAPE_W[SHAPES.indexOf(s)][t] > 0);
  const list = pool.length ? pool : BIG_SHAPES;
  return { cells: list[Math.random() * list.length | 0].map(p => p.slice()), color: COLORS[Math.random() * COLORS.length | 0] };
}
function newPieces() {
  let ps, fallback = null, ok = false;
  const sparse = isSparse();
  for (let i = 0; i < 30 && !ok; i++) {
    ps = [randomPiece(), randomPiece(), randomPiece()];
    if (sparse) ps[Math.random() * 3 | 0] = bigPiece();
    if (sequenceSolvable(ps, board)) ok = true;
    else if (!fallback && ps.some(canPlaceAnywhere)) fallback = ps;
  }
  pieces = ok ? ps : (fallback || ps);
}

/* ---------- geometry ---------- */
function geo() {
  const a = cells[0].getBoundingClientRect(), b = cells[1].getBoundingClientRect();
  return { x0: a.left, y0: a.top, size: a.width, step: b.left - a.left };
}
function cellAt(x, y) {
  const g = geo(), half = (g.step - g.size) / 2;
  const c = Math.floor((x - g.x0 + half) / g.step), r = Math.floor((y - g.y0 + half) / g.step);
  return r >= 0 && r < N && c >= 0 && c < N ? { r, c } : null;
}

/* ---------- rendering ---------- */
function initBoard() {
  el.board.innerHTML = '';
  cells = [];
  for (let i = 0; i < N * N; i++) {
    const d = document.createElement('div');
    d.setAttribute('role', 'gridcell');
    el.board.append(d);
    cells.push(d);
  }
}
function renderBoard() {
  cells.forEach((e, i) => {
    const r = i / N | 0, c = i % N, v = board[r][c];
    e.className = 'cell' + (((r >= N / 2 ? 1 : 0) + (c >= N / 2 ? 1 : 0)) & 1 ? ' alt' : '') + (v ? ' f c-' + v : '');
    e.style.animationDelay = '';
  });
  pvKey = '';
}
function buildPiece(cs, color) {
  const { w, h } = dims(cs);
  const shape = document.createElement('div');
  shape.className = 'piece';
  shape.style.setProperty('--w', w);
  shape.style.setProperty('--h', h);
  shape.style.setProperty('--m', Math.max(w, h, 3));
  cs.forEach(([r, c]) => {
    const t = document.createElement('i');
    t.className = 'blk c-' + color;
    t.style.gridRow = r + 1; t.style.gridColumn = c + 1;
    shape.append(t);
  });
  return shape;
}
function renderPieces() {
  el.tray.innerHTML = '';
  slotEls = pieces.map((p, i) => {
    const slot = document.createElement('div');
    slot.className = 'piece-slot' + (p ? '' : ' used') + (selected === i ? ' selected' : '');
    if (p) {
      const shape = buildPiece(p.cells, p.color);
      slot.append(shape);
      slot.addEventListener('pointerdown', e => onSlotDown(e, i));
    } else {
      slot.innerHTML = '<span class="piece-used">已放置</span>';
    }
    el.tray.append(slot);
    return slot;
  });
  if (!busy) updateWarn();
}
/* 預告：目前棋盤放不下的方塊，在托盤中閃淡紅色警告 */
function updateWarn() {
  slotEls.forEach((s, i) => {
    const p = pieces[i], bad = !!p && !canPlaceAnywhere(p);
    s.classList.toggle('nofit', bad);
    if (p) s.title = bad ? '目前棋盤放不下這個方塊' : '';
  });
}
function updateScore() {
  if (score > peak) peak = score;
  el.score.textContent = fmt(score);
  el.score.classList.remove('bump'); void el.score.offsetWidth; el.score.classList.add('bump');
  if (score > best) {
    best = score;
    el.best.textContent = fmt(best);
    store.set(KEY_BEST, String(best));
  }
  updatePowerUI();
}
function updatePowerUI() {
  if (power && score < POWERS[power].cost) power = null;
  Object.entries(powerBtns).forEach(([k, b]) => {
    b.disabled = score < POWERS[k].cost;
    b.classList.toggle('active', power === k);
  });
}
function setTrend() {
  if (!el.trend) return;
  if (combo >= 2) { el.trend.textContent = `COMBO ×${combo}`; el.trend.classList.add('hot'); }
  else { el.trend.textContent = ''; el.trend.classList.remove('hot'); }
}
function updateSelection() {
  slotEls.forEach((s, i) => s.classList.toggle('selected', i === selected));
}

/* ---------- preview ---------- */
function anchorFor(p, cell) {
  const { w, h } = dims(p.cells);
  return { r: cell.r - Math.floor((h - 1) / 2), c: cell.c - Math.floor((w - 1) / 2) };
}
function showPreview(p, r, c) {
  const key = `${r},${c},${pieces.indexOf(p)}`;
  if (key === pvKey) return true;
  renderBoard();
  if (!fits(p, r, c)) return false;
  pvKey = key;
  const sim = board.map(row => row.slice());
  p.cells.forEach(([dr, dc]) => { sim[r + dr][c + dc] = p.color; });
  const { rows, cols } = fullLines(sim);
  rows.forEach(y => { for (let x = 0; x < N; x++) cells[y * N + x].classList.add('hl'); });
  cols.forEach(x => { for (let y = 0; y < N; y++) cells[y * N + x].classList.add('hl'); });
  p.cells.forEach(([dr, dc]) => {
    const e = cells[(r + dr) * N + c + dc];
    e.classList.add('pv', 'f', 'c-' + p.color);
  });
  return true;
}
function clearPreview() { if (pvKey) renderBoard(); }

/* ---------- drag & tap ---------- */
function onSlotDown(e, i) {
  if (blocked() || !pieces[i] || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (e.pointerType !== 'mouse' && !MH.touchOn()) return;   // 大廳關閉「允許觸控」
  e.preventDefault();
  if (power) setPower(null);
  drag = { i, sx: e.clientX, sy: e.clientY, type: e.pointerType, moved: false, target: null };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}
function startDrag() {
  const p = pieces[drag.i], { w, h } = dims(p.cells), g = geo();
  const gap = g.step - g.size;
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.style.gridTemplateColumns = `repeat(${w}, ${g.size}px)`;
  ghost.style.gridTemplateRows = `repeat(${h}, ${g.size}px)`;
  ghost.style.gap = gap + 'px';
  ghost.style.setProperty('--r', Math.max(4, g.size * 0.18) + 'px');
  p.cells.forEach(([r, c]) => {
    const t = document.createElement('i');
    t.className = 'blk c-' + p.color;
    t.style.gridRow = r + 1; t.style.gridColumn = c + 1;
    ghost.append(t);
  });
  document.body.append(ghost);
  Object.assign(drag, {
    g, ghost, p,
    gw: w * g.size + (w - 1) * gap,
    gh: h * g.size + (h - 1) * gap
  });
  slotEls[drag.i].classList.add('dragging');
  selected = drag.i; updateSelection();
  document.body.classList.add('is-dragging');
  snd('pick');
}
function onMove(e) {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true; startDrag();
  }
  const lift = drag.type === 'mouse' ? 0 : drag.gh / 2 + Math.max(36, drag.g.size * 0.9);
  const left = e.clientX - drag.gw / 2, top = e.clientY - drag.gh / 2 - lift;
  drag.ghost.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  const r = Math.round((top - drag.g.y0) / drag.g.step), c = Math.round((left - drag.g.x0) / drag.g.step);
  drag.target = showPreview(drag.p, r, c) ? { r, c } : null;
}
function endDrag() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
  document.body.classList.remove('is-dragging');
}
function onUp() {
  if (!drag) return;
  const d = drag; drag = null; endDrag();
  if (!d.moved) {                       // tap → toggle selection
    selected = selected === d.i ? -1 : d.i;
    updateSelection(); clearPreview();
    say(selected < 0 ? '已取消選取。' : '已選取方塊，點棋盤放置，或直接拖曳。');
    snd('select');
    return;
  }
  justDragged = true; setTimeout(() => { justDragged = false; }, 50);
  d.ghost.remove();
  slotEls[d.i] && slotEls[d.i].classList.remove('dragging');
  if (d.target) place(d.i, d.target.r, d.target.c);
  else {
    selected = -1; updateSelection(); renderBoard();
    say('放不下，換個位置試試。'); snd('error');
  }
}
function onCancel() {
  if (!drag) return;
  const d = drag; drag = null; endDrag();
  if (d.ghost) d.ghost.remove();
  slotEls[d.i] && slotEls[d.i].classList.remove('dragging');
  selected = -1; updateSelection(); renderBoard();
}

/* board: tap-to-place & mouse hover preview */
el.board.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && power && !drag && !blocked()) {
    const cell = cellAt(e.clientX, e.clientY);
    return cell ? previewPower(cell) : clearPreview();
  }
  if (e.pointerType !== 'mouse' || drag || selected < 0 || blocked()) return;
  const cell = cellAt(e.clientX, e.clientY), p = pieces[selected];
  if (!cell || !p) return clearPreview();
  const a = anchorFor(p, cell);
  showPreview(p, a.r, a.c);
});
el.board.addEventListener('pointerleave', () => { if (!drag) clearPreview(); });
el.board.addEventListener('click', e => {
  if (e.pointerType && e.pointerType !== 'mouse' && !MH.touchOn()) return;
  if (power && !drag && !blocked()) {
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    if (e.pointerType && e.pointerType !== 'mouse' && !(powerAim && powerAim.r === cell.r && powerAim.c === cell.c)) {
      powerAim = cell; previewPower(cell); say('再點一次同一位置確認使用。'); return;   // 觸控：先預覽、再確認
    }
    return applyPower(cell);
  }
  if (justDragged || drag || selected < 0 || blocked()) return;
  const cell = cellAt(e.clientX, e.clientY), p = pieces[selected];
  if (!cell || !p) return;
  const a = anchorFor(p, cell);
  if (fits(p, a.r, a.c)) place(selected, a.r, a.c);
  else { say('這個位置放不下，試試其他空位。'); snd('error'); }
});

/* ---------- power-ups ---------- */
function buildPowers() {
  Object.entries(POWERS).forEach(([k, p]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'power';
    b.setAttribute('aria-label', `${p.name}，花費 ${p.cost} 分`);
    b.innerHTML = `<span class="pw-name">${p.icon} ${p.name}</span><span class="pw-cost">${p.cost}</span>`;
    b.addEventListener('click', () => usePower(k));
    el.powers.append(b);
    powerBtns[k] = b;
  });
  updatePowerUI();
}
function setPower(k) {
  power = k; powerAim = null;
  if (k) { selected = -1; updateSelection(); }
  clearPreview(); updatePowerUI();
}
function powerCells(cell) {
  const out = [];
  if (power === 'bomb') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = cell.r + dr, c = cell.c + dc;
      if (r >= 0 && r < N && c >= 0 && c < N) out.push(r * N + c);
    }
  } else for (let c = 0; c < N; c++) out.push(cell.r * N + c);
  return out;
}
function previewPower(cell) {
  renderBoard(); pvKey = 'power';
  powerCells(cell).forEach(k => cells[k].classList.add('tg'));
}
function spend(n) { score -= n; updateScore(); }
function usePower(k) {
  if (blocked() || drag) return;
  const p = POWERS[k];
  if (score < p.cost) { say(`分數不足，需要 ${p.cost} 分。`); snd('error'); return; }
  if (k === 'reroll') {
    if (!pieces.some(Boolean)) return;
    setPower(null);
    const old = pieces;
    spend(p.cost); newPieces();
    pieces = pieces.map((x, i) => (old[i] ? x : null));
    selected = -1; renderPieces();
    say(`已換一組新方塊（−${p.cost}）。`); snd('select');
    return finishTurn();
  }
  if (power === k) { setPower(null); say('已取消道具。'); return; }
  setPower(k); snd('select');
  say(k === 'bomb' ? '炸彈：點棋盤選擇 3×3 爆破中心。' : '清橫排：點選要清除的那一排。');
}
function applyPower(cell) {
  const k = power, cost = POWERS[k].cost;
  const idx = powerCells(cell).filter(i => board[i / N | 0][i % N]);
  if (!idx.length) { say('那裡沒有方塊可清除。'); snd('error'); return; }
  busy = true; setPower(null); spend(cost);
  idx.forEach(i => {
    const e = cells[i];
    e.classList.remove('tg'); e.classList.add('clearing'); e.style.animationDelay = '';
    burst(e, [...e.classList].find(x => x.startsWith('c-')));
    board[i / N | 0][i % N] = null;
  });
  say(`${POWERS[k].name}！清除了 ${idx.length} 格（−${cost}）。`);
  snd('clear', 2); vib([15, 30]);
  turnTimer = setTimeout(() => { renderBoard(); finishTurn(); }, 450);
}

/* ---------- placing & clearing ---------- */
function place(i, r, c) {
  const p = pieces[i];
  if (!p || !fits(p, r, c)) return;
  busy = true;
  p.cells.forEach(([dr, dc]) => { board[r + dr][c + dc] = p.color; });
  pieces[i] = null; selected = -1;

  const { rows, cols } = fullLines(board);
  const count = rows.length + cols.length;
  let gain = p.cells.length, comboBonus = 0;
  if (count) {
    combo++;
    const lineScore = count * N * 2 + (count - 1) * count * 5;
    /* 連消加成：每多一次連續消除，額外 +50% 的消除分數，再加 20 分 × 連擊數 */
    if (combo > 1) comboBonus = Math.round(lineScore * 0.5 * (combo - 1)) + (combo - 1) * 20;
    gain += lineScore + comboBonus;
  } else combo = 0;

  renderBoard();
  p.cells.forEach(([dr, dc]) => cells[(r + dr) * N + c + dc].classList.add('pop'));
  renderPieces();

  if (count) {
    const idx = new Set();
    rows.forEach(y => { for (let x = 0; x < N; x++) idx.add(y * N + x); });
    cols.forEach(x => { for (let y = 0; y < N; y++) idx.add(y * N + x); });
    const anchor = (r + (dims(p.cells).h - 1) / 2) * N + c + (dims(p.cells).w - 1) / 2;
    [...idx].forEach(k => {
      const e = cells[k], dist = Math.hypot((k / N | 0) - (anchor / N | 0), (k % N) - (anchor % N));
      e.classList.remove('pop'); e.classList.add('clearing');
      e.style.animationDelay = Math.round(dist * 28) + 'ms';
      burst(e, [...e.classList].find(x => x.startsWith('c-')));
    });
    const after = board.map(row => row.slice());
    rows.forEach(y => after[y].fill(null));
    cols.forEach(x => { for (let y = 0; y < N; y++) after[y][x] = null; });
    const allClear = after.every(row => row.every(v => !v));
    if (allClear) { gain += ALL_CLEAR; say(`全部清空！額外 +${ALL_CLEAR}`); banner('全部清空！', `ALL CLEAR +${ALL_CLEAR}`, true); }
    else say(combo >= 2 ? `連擊 ×${combo}！額外 +${comboBonus}` : `${CHEERS[Math.random() * CHEERS.length | 0]} 消除了 ${count} 條`);
    if (!allClear && combo >= 2) banner(`連擊 ×${combo}`, `COMBO +${comboBonus}`, false);
    snd('clear', count + combo); vib([15, 30, 25]);
    score += gain; checkTheme(allClear); updateScore(); setTrend(); popGain(gain);
    turnTimer = setTimeout(() => { board = after; renderBoard(); finishTurn(); }, 560);
  } else {
    say('放置成功！填滿整排或整列即可消除。');
    snd('place'); vib(10);
    score += gain; checkTheme(false); updateScore(); setTrend();
    turnTimer = setTimeout(finishTurn, 60);
  }
}
function finishTurn() {
  if (pieces.every(x => !x)) { newPieces(); renderPieces(); }
  busy = false;
  if (!pieces.some(p => p && canPlaceAnywhere(p))) {
    if (score >= MIN_COST) say('沒有可放的位置了！花分數使用道具來解圍。');
    else gameOver();
  }
  updateWarn();
  saveGame();
}
function saveGame() {
  if (over) { store.del(KEY_GAME); queueCloud(null); return; }
  const d = { board, pieces, score, peak, combo, bestAtStart, themeIdx, themeMilestone };
  store.set(KEY_GAME, JSON.stringify(d));
  queueCloud(d);
}
function restoreGame(fromCloud) {
  let s;
  if (fromCloud) s = fromCloud;
  else { try { s = JSON.parse(store.get(KEY_GAME)); } catch (e) { return false; } }
  const okCell = c => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[0] < N && c[1] >= 0 && c[1] < N;
  if (!s || !Array.isArray(s.board) || s.board.length !== N || !s.board.every(r => Array.isArray(r) && r.length === N)) return false;
  if (!Array.isArray(s.pieces) || s.pieces.length !== 3) return false;
  if (!s.pieces.every(p => p === null || (p && COLORS.includes(p.color) && Array.isArray(p.cells) && p.cells.length && p.cells.every(okCell)))) return false;
  const b = s.board.map(r => r.map(v => (COLORS.includes(v) ? v : null)));
  const ps = s.pieces.map(p => (p ? { cells: p.cells.map(c => c.slice()), color: p.color } : null));
  if (!ps.some(p => p && b.some((row, r) => row.some((_, c) => fits(p, r, c, b))))) return false;
  start();
  board = b; pieces = ps;
  score = Math.max(0, s.score | 0); peak = Math.max(score, s.peak | 0); combo = Math.max(0, s.combo | 0);
  bestAtStart = Number.isFinite(s.bestAtStart) ? s.bestAtStart : best;
  themeMilestone = Math.max(0, s.themeMilestone | 0); applyTheme(Math.max(0, s.themeIdx | 0));
  el.score.textContent = fmt(score); updatePowerUI();
  setTrend(); renderBoard(); renderPieces();
  say(fromCloud ? '已載入雲端存檔。' : '已還原上次的進度。');
  saveGame();
  return true;
}

/* ---------- effects ---------- */
function burst(cellEl, cls) {
  const w = el.wrap.getBoundingClientRect(), r = cellEl.getBoundingClientRect();
  const color = COLOR_HEX[(cls || '').slice(2)] || '#fff';
  for (let k = 0; k < 3; k++) {
    const d = document.createElement('span');
    d.className = 'pt';
    d.style.left = (r.left - w.left + r.width / 2) + 'px';
    d.style.top = (r.top - w.top + r.height / 2) + 'px';
    d.style.background = color;
    d.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    d.style.setProperty('--dy', (Math.random() * 120 - 70) + 'px');
    d.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    el.fx.append(d);
    setTimeout(() => d.remove(), 800);
  }
}
function banner(t, sub, big) {
  const d = document.createElement('div');
  d.className = 'banner' + (big ? ' big' : '');
  d.innerHTML = `<b>${t}</b><span>${sub}</span>`;
  el.fx.append(d);
  setTimeout(() => d.remove(), 1500);
}
function popGain(n) {
  const d = document.createElement('div');
  d.className = 'gain'; d.textContent = '+' + fmt(n);
  el.fx.append(d);
  setTimeout(() => d.remove(), 1000);
}

/* ---------- overlay ---------- */
function showOverlay({ icon, title, text, buttons }) {
  el.overlay.innerHTML = `<div class="ov-card"><div class="ov-icon">${icon}</div><h3>${title}</h3><p>${text || ''}</p><div class="ov-actions"></div></div>`;
  const box = el.overlay.querySelector('.ov-actions');
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = b.label;
    btn.className = 'btn' + (b.primary ? ' primary' : '');
    btn.onclick = b.fn;
    box.append(btn);
  });
  el.overlay.classList.add('show');
}
function hideOverlay() { el.overlay.classList.remove('show'); }

function showPause() {
  showOverlay({ icon: 'Ⅱ', title: '遊戲暫停', text: '準備好了就繼續吧', buttons: [{ label: '繼續遊戲', primary: true, fn: togglePause }] });
}
function togglePause() {
  if (over || busy || modal) return;
  paused = !paused;
  el.board.classList.toggle('is-paused', paused);
  if (paused) showPause(); else hideOverlay();
  syncMusic();
  if (drag) onCancel();
}
// 下一局：未登入時由大廳詢問是否同意條款（不同意就不開始）；單獨開啟本頁時直接開始
let asking = false;
function nextGame() {
  if (asking) return;
  asking = true;
  submitScore();
  MH.requestNext().then(ok => { asking = false; if (ok) start(); }, () => { asking = false; });
}
function askRestart() {
  if (over || score === 0) return nextGame();
  if (drag) onCancel();
  modal = true;
  showOverlay({
    icon: '↻', title: '重新開始？', text: '目前的進度將不會保留',
    buttons: [
      { label: '取消', fn: () => { modal = false; if (paused) showPause(); else hideOverlay(); } },
      { label: '重新開始', primary: true, fn: nextGame }
    ]
  });
}
// 結束遊戲：結算本局成績並清除、重新開局
function askEnd() {
  if (over || busy || modal || score === 0 && peak === 0) return;
  if (drag) onCancel();
  modal = true;
  showOverlay({
    icon: '■', title: '結束遊戲？', text: `將結算本局成績（${fmt(peak)}）並重新開局`,
    buttons: [
      { label: '取消', fn: () => { modal = false; if (paused) showPause(); else hideOverlay(); } },
      { label: '結束並重開', primary: true, fn: nextGame }
    ]
  });
}
function gameOver() {
  over = true; selected = -1; updateSelection(); syncMusic();
  revealRankOnGameOver();
  submitScore();
  const record = score > bestAtStart && score > 0;
  say('沒有可以放置的位置了。');
  snd('over');
  saveGame();
  overTimer = setTimeout(() => {
    showOverlay({
      icon: record ? '♛' : '✦',
      title: record ? '新紀錄！' : '遊戲結束',
      text: `本局得分 <b>${fmt(score)}</b><br>最高紀錄 ${fmt(best)}`,
      buttons: [{ label: '再玩一次', primary: true, fn: nextGame }]
    });
  }, 450);
}

/* ---------- lifecycle ---------- */
function start() {
  clearTimeout(turnTimer); clearTimeout(overTimer); clearTimeout(themeTimer);
  themeMilestone = 0; applyTheme(0);
  board = emptyBoard();
  score = 0; peak = 0; combo = 0; selected = -1;
  paused = false; over = false; busy = false; modal = false; bestAtStart = best;
  el.board.classList.remove('is-paused');
  hideOverlay();
  el.fx.innerHTML = '';
  newPieces();
  el.score.textContent = '0'; power = null; powerAim = null; updatePowerUI();
  setTrend();
  renderBoard(); renderPieces();
  say('拖曳下方方塊到棋盤，填滿一整排或一整列即可消除。');
  saveGame();
  syncMusic();
}
// 背景音樂：遊戲進行中播放；暫停／結束就停（音樂開關由大廳頂端的按鈕控制）
function syncMusic() {
  if (!window.GameAudio) return;
  if (!paused && !over) GameAudio.musicStart(); else GameAudio.musicStop();
}

let bookBuilt = false;
function openBook() {
  if (modal) return;
  if (drag) onCancel();
  if (!bookBuilt) {
    bookBuilt = true;
    const sizes = [...new Set(SHAPES.map(s => s.length))].sort((a, b) => a - b);
    sizes.forEach((n, gi) => {
      const sec = document.createElement('section');
      sec.className = 'book-sec';
      sec.innerHTML = `<h4>${n} 格</h4>`;
      const grid = document.createElement('div');
      grid.className = 'book-row';
      SHAPES.filter(s => s.length === n).forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'book-item';
        item.append(buildPiece(s, COLORS[(gi + i) % COLORS.length]));
        grid.append(item);
      });
      sec.append(grid);
      el.bookGrid.append(sec);
    });
  }
  modal = true;
  el.bookModal.classList.add('show');
  el.bookModal.scrollTop = 0;
  el.bookGrid.scrollTop = 0;
}
function closeBook() {
  if (!el.bookModal.classList.contains('show')) return;
  el.bookModal.classList.remove('show');
  modal = false;
}
el.book.addEventListener('click', openBook);
$('endButton').addEventListener('click', askEnd);
el.bookClose.addEventListener('click', closeBook);
el.bookModal.addEventListener('click', e => { if (e.target === el.bookModal) closeBook(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MH.kbdOn()) closeBook(); });

// 方塊圖鑑：在大廳裡放到頂端「背景音樂」左邊；單獨開啟本頁時才顯示頁面內的按鈕
if (MH.embedded) {
  document.body.classList.add('embedded');
  MH.action({ title: '方塊圖鑑', path: 'M12 6.5C10.3 5.2 8 4.7 4 4.8v12.9c4-.1 6.3.4 8 1.7 1.7-1.3 4-1.8 8-1.7V4.8c-4-.1-6.3.4-8 1.7z M12 6.5v12.9', onClick: openBook });
}
MH.onRestart(askRestart);   // 大廳頂端的「重新載入」＝重新開始（會先確認）
document.addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'P') && MH.kbdOn()) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !paused && !over && !busy && !modal) togglePause(); });
document.addEventListener('contextmenu', e => { if (e.target.closest('.piece-slot')) e.preventDefault(); });

/* ---------- 大廳整合：個人最高 / 排行榜 / 暫停 ---------- */
const GAME = 'block-blast';
/* ---------- 雲端存檔（登入後保留上局狀態，下次可繼續玩） ---------- */
const cloud = MH.cloud ? MH.cloud(GAME) : null;
let cloudUid = '', cloudBusy = false;   // cloudUid：已完成讀取（才允許寫入）的帳號
const myUid = () => { try { return MH.player().uid || ''; } catch (e) { return ''; } };
function queueCloud(d) {
  if (!cloud || !cloudUid || cloudUid !== myUid()) return;
  cloud.save(d ? { v: 1, s: d } : { v: 1, s: null });   // null = 這局已結束，沒有可繼續的進度
}
const untouched = () => score === 0 && peak === 0 && board.every(r => r.every(v => !v));
async function syncCloud() {
  if (!cloud) return;
  const uid = myUid();
  if (!uid) { cloudUid = ''; return; }
  if (uid === cloudUid || cloudBusy) return;
  cloudBusy = true;
  try {
    const r = await cloud.load();
    if (!r.ok) return;   // 讀取失敗：不寫入，避免覆蓋雲端資料；下次狀態改變再試
    // 目前這局還沒動過才載入雲端進度；已經在玩就保留目前的，並覆蓋雲端
    if (r.data && r.data.s && !over && untouched()) restoreGame(r.data.s);
    cloudUid = uid;
    if (!over) saveGame();
  } finally { cloudBusy = false; }
}
if (cloud) {
  MH.onChange(syncCloud);
  addEventListener('pagehide', () => cloud.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloud.flush(); });
}
const side = $('side'), tog = $('sideTog'), PW = 260;
let userSide = null, floatSide = false, floatOpen = false;   // 寬螢幕：固定在右側並記住展開／收合；窄螢幕（含手機）：浮在棋盤上，預設收合
let hub = { logged: false, rankOn: false, myName: '', uid: '', best: 0, top: [], myRank: 0 };
const lb = MH.board(GAME, { top: 3, onUpdate: st => {
  hub = st;
  if (st.best > best) { best = st.best; el.best.textContent = fmt(best); }
  paintRank();
} });
function submitScore() { if (peak > 0) lb.submit(peak); }
const sideOpen = () => floatSide ? floatOpen : userSide !== false;
function paintSide() {
  const o = sideOpen();
  side.classList.toggle('closed', !o); side.classList.toggle('float', floatSide);
  tog.setAttribute('aria-expanded', String(o)); tog.title = o ? '收合' : '展開';
}
function fitSide() {
  const r = el.wrap.getBoundingClientRect(), g = document.querySelector('.app').getBoundingClientRect();
  side.style.top = Math.max(8, Math.round(r.top)) + 'px';
  side.style.maxHeight = Math.max(160, Math.round(r.height)) + 'px';
  floatSide = (innerWidth - g.width) / 2 < PW + 12 + 34 + 8;
  paintSide();
}
function paintRank() {
  const showRank = hub.logged && hub.rankOn;
  $('meBox').hidden = !hub.logged;
  $('rankBox').hidden = !showRank;
  side.hidden = !hub.logged && !showRank;   // 未登入或不允許排行榜：整個面板不顯示
  $('meBest').textContent = fmt(Math.max(hub.best || 0, peak || 0));
  const ul = $('rankList');
  ul.textContent = '';
  if (!side.hidden) fitSide();
  if (!showRank) return;
  const add = (rank, name, sc, cls) => {
    const li = document.createElement('li'); if (cls) li.className = cls;
    [rank, name, sc].forEach((t, i) => { const s = document.createElement('span'); if (i === 2) s.className = 'sc'; s.textContent = t; li.appendChild(s); });
    ul.appendChild(li);
  };
  for (let i = 0; i < 3; i++) {
    const r = hub.top[i];
    if (!r) add('#' + (i + 1), '—', '', 'empty');
    else if (r.uid === hub.uid) add('#' + (i + 1), hub.myName, fmt(r.score), 'me');
    else add('#' + (i + 1), r.name || '*', fmt(r.score));
  }
  if (!hub.top.some(r => r.uid === hub.uid)) {   // 沒進前 3：多顯示自己目前的名次
    const g = document.createElement('li'); g.className = 'gap'; g.textContent = '⋯'; ul.appendChild(g);
    if (hub.best > 0) add(hub.myRank ? '#' + hub.myRank : '#?', hub.myName, fmt(hub.best), 'me');
    else add('—', hub.myName, '尚無成績', 'me');
  }
}
tog.addEventListener('click', () => { if (floatSide) floatOpen = !floatOpen; else userSide = !sideOpen(); paintSide(); });
addEventListener('resize', () => { if (!side.hidden) fitSide(); });
function revealRankOnGameOver() {   // 已登入且允許排行榜時，遊戲結束自動展開
  if (!(hub.logged && hub.rankOn)) return;
  if (floatSide) floatOpen = true; else userSide = true;
  paintSide();
}
// 大廳要求暫停（玩家點左側導覽）
MH.onPause(() => { floatOpen = false; paintSide(); if (!paused && !over && !busy && !modal) togglePause(); });
addEventListener('pagehide', submitScore);

initBoard(); buildPowers(); if (!restoreGame()) start();
syncMusic();
lb.refresh();
syncCloud();
})();
