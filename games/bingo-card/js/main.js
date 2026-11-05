import { SIZE, MIN, MAX, FILLABLE, CENTER, isFree } from './config.js';
import { validateGrid } from './validation.js';
import { generateGrid, fillBlanks, emptyGrid } from './random.js';
import { findCompletedLines, LINES } from './bingo.js';
import { launchConfetti } from './confetti.js';
import { beep, fanfare } from './sound.js';

// 遊戲資料只存在記憶體（不使用 localStorage / IndexedDB）；登入後才會透過 MiniHub.cloud 存到雲端
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
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const hubAnim = () => { try { return MiniHub.prefs().anim !== false; } catch { return true; } };
const kbdOn = () => { try { return MiniHub.kbdOn(); } catch { return true; } };
const touchOn = () => { try { return MiniHub.touchOn(); } catch { return true; } };
// 以 getter 取代常數，讓大廳「動畫」設定改變時即時生效
const reducedNow = () => reducedMQ.matches || !hubAnim();

function newMarked() {
  const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  m[CENTER][CENTER] = true;
  return m;
}

/* ---------- 小工具：對話框、提示、震動 ---------- */
// 不用 <form method="dialog">（嵌在大廳的 CSP form-action 會讓它卡住），改由按鈕直接關閉
function ask(title, text, okLabel = '確定', altLabel = '') {
  // 有 altLabel 時多一個按鈕，回傳 'ok' / 'alt' / false；否則回傳 true / false
  const dlg = $('dlg'), alt = $('dlg-alt');
  $('dlg-title').textContent = title; $('dlg-text').textContent = text; $('dlg-ok').textContent = okLabel;
  alt.hidden = !altLabel; alt.textContent = altLabel;
  return new Promise(res => {
    const onClick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v) dlg.close(v); };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('close', () => { dlg.removeEventListener('click', onClick); res(altLabel ? (dlg.returnValue === 'ok' || dlg.returnValue === 'alt') && dlg.returnValue : dlg.returnValue === 'ok'); }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const buzz = ms => { if (touchOn()) navigator.vibrate?.(ms); };
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
      if (animate && !reducedNow()) { wrap.classList.add('enter'); wrap.style.animationDelay = `${i++ * 18}ms`; }
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
          const d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
          if (!kbdOn()) return;
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
          beep(marked[r][c] ? 740 : 420, .07); buzz(12);
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
  queueSave();
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
    if (key === poppedKey && on && !reducedNow()) { wrap.classList.remove('stamp'); void wrap.offsetWidth; wrap.classList.add('stamp'); }
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
    launchConfetti(); fanfare(); buzz([60, 40, 120]);
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
  if (!await MiniHub.requestNext()) return;
  mode = 'play'; ended = false; marked = newMarked(); prevLines = 0; notice = ''; animate = true;
  buildGrid(); refresh(); toast('卡片已鎖定，開始遊戲！');
}

async function restart() {
  // 每次重新開始時才選擇：保留數字（預設、主按鈕）或清空整張卡片
  const r = await ask('重新開始？', '標記都會清除並回到填寫畫面。\n要保留卡片上的數字，還是連數字一起清空（無法復原）？', '保留數字', '清空數字');
  if (!r) return;
  mode = 'edit'; ended = false; if (r === 'alt') grid = emptyGrid(); marked = newMarked(); prevLines = 0; notice = ''; animate = true;
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


/* ---------- 雲端存檔（登入後：記住卡片數字、標記與上次遊玩狀態） ---------- */
const cloud = MiniHub.cloud ? MiniHub.cloud('bingo-card') : null;
let cloudUid = '', cloudBusy = false; // cloudUid：已完成讀取（才允許寫入）的帳號
const myUid = () => { try { return MiniHub.player().uid || ''; } catch { return ''; } };
function queueSave() {
  if (!cloud || !cloudUid || cloudUid !== myUid()) return;
  cloud.save({ v: 1, mode, ended, grid, marked });
}
const hasLocalData = () => mode === 'play' || grid.some(row => row.some(v => v !== ''));
function cleanGrid(g) {
  if (!Array.isArray(g) || g.length !== SIZE) return null;
  const out = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    if (!Array.isArray(g[r]) || g[r].length !== SIZE) return null;
    for (let c = 0; c < SIZE; c++) {
      const v = String(g[r][c] ?? '');
      if (isFree(r, c)) continue;
      if (!/^\d{0,2}$/.test(v)) return null;
      out[r][c] = v;
    }
  }
  return out;
}
function applySave(d) {
  const g = cleanGrid(d && d.grid);
  if (!g) return false;
  let m = d.mode === 'play' ? 'play' : 'edit';
  if (m === 'play') { const v = validateGrid(g); if (v.filled < FILLABLE || v.messages.length) m = 'edit'; }
  const mk = newMarked();
  if (m === 'play' && Array.isArray(d.marked)) for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (d.marked[r] && d.marked[r][c] === true) mk[r][c] = true;
  grid = g; mode = m; marked = mk; ended = m === 'play' && d.ended === true;
  prevLines = findCompletedLines(marked).length; notice = ''; animate = true;
  buildGrid(); refresh();
  return true;
}
async function syncCloud() {
  if (!cloud) return;
  const uid = myUid();
  if (!uid) { cloudUid = ''; return; }
  if (uid === cloudUid || cloudBusy) return;
  cloudBusy = true;
  try {
    const r = await cloud.load();
    if (!r.ok) return; // 讀取失敗：不寫入，避免覆蓋雲端資料；下次狀態改變再試
    if (r.data && cleanGrid(r.data.grid)) {
      if (!hasLocalData() || await ask('載入雲端存檔？', '偵測到你上次的卡片與進度，要載入嗎？目前畫面上的內容會被取代。', '載入')) {
        if (applySave(r.data)) toast(mode === 'play' ? '已載入上次的遊玩狀態' : '已載入上次填寫的數字');
      }
    }
    cloudUid = uid;
    if (hasLocalData()) queueSave();
  } finally { cloudBusy = false; }
}
if (cloud) {
  MiniHub.onChange(syncCloud);
  syncCloud();
  addEventListener('pagehide', () => cloud.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloud.flush(); });
}

buildGrid();
refresh();

// 大廳要求暫停（點左側導覽）：關閉開啟中的對話框與提示
MiniHub.onPause(() => { const d = $('dlg'); if (d.open) d.close('cancel'); $('toast').classList.remove('show'); });

// 所有按鈕（含對話框內）的點擊音效；是否播放由大廳音效設定決定
document.addEventListener('click', e => {
  const b = e.target.closest('.btn');
  if (b && !b.disabled) beep(b.classList.contains('primary') ? 880 : 520, .07, 'triangle', .1);
});
