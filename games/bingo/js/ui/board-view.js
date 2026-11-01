// 1~75 矩陣：B1-15、I16-30、N31-45、G46-60、O61-75（欄位由上往下排列）
// 只建立一次 DOM，之後由 state 更新 class，不重建（避免閃爍、保留動畫）。
import { getState, subscribe } from '../core/state.js';
import { drawnNumbers } from '../core/draw-engine.js';
import { BOARD_COLUMNS, NUMBER_MAX } from '../config/defaults.js';
import { el } from '../utils/dom.js';

export function initBoardView(root) {
  const cells = new Map(); // 號碼 → 格子元素
  const rows = BOARD_COLUMNS[0].max - BOARD_COLUMNS[0].min + 1;

  const body = [];
  for (let r = 0; r < rows; r++) {
    for (const c of BOARD_COLUMNS) {
      const n = c.min + r;
      const cell = el('div', { class: 'board-cell', dataset: { n: String(n) } }, String(n));
      cells.set(n, cell);
      body.push(cell);
    }
  }

  const count = el('span', { class: 'board-count' });
  let prevLen = null; // 上次的 history 長度：只有「剛抽出新的一筆」才播放閃爍

  root.replaceChildren(
    el('div', { class: 'board-wrap' },
      el('h2', { class: 'board-title' }, '號碼矩陣', count),
      el('div', { class: 'board', role: 'grid', 'aria-label': '1 到 75 號碼矩陣' }, ...body)
    )
  );

  function update() {
    const { history } = getState().game;
    const drawn = drawnNumbers(history);
    const last = history[history.length - 1];
    const fresh = prevLen !== null && history.length > prevLen;
    prevLen = history.length;
    count.textContent = `已抽 ${drawn.size} / ${NUMBER_MAX}`;
    for (const [n, cell] of cells) {
      cell.classList.toggle('is-drawn', drawn.has(n));
      // 最新一顆（新號）高亮；最新是重複號碼時，該格改用較淡的提示框
      cell.classList.toggle('is-latest', !!last && last.type === 'new' && last.number === n);
      cell.classList.toggle('is-repeat', !!last && last.type === 'repeat' && last.number === n);
      if (fresh && last && last.number === n && last.type !== 'blank') {
        cell.classList.remove('is-flash');
        void cell.offsetWidth; // 重新觸發動畫
        cell.classList.add('is-flash');
      } else if (!last || last.number !== n) {
        cell.classList.remove('is-flash'); // 不是目前這一顆就清掉，撤回後不會誤重播
      }
    }
  }

  update();
  subscribe(update);
}
