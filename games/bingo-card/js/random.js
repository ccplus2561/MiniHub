import { SIZE, MIN, MAX, isFree, colRange } from './config.js';

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill('')); }

/**
 * 補齊空格（中央 FREE 留空），可傳入既有卡片以保留已填數字。
 * official=true（BINGO 正常版）：每欄只從該欄範圍抽號（B 1～15、I 16～30、N 31～45、G 46～60、O 61～75）；
 * official=false：全部從 1～75 不重複隨機。
 */
export function fillBlanks(grid = emptyGrid(), official = false) {
  const next = grid.map(row => [...row]);
  const used = new Set();
  for (const row of next) for (const v of row) if (/^\d{1,2}$/.test(v)) used.add(Number(v));
  const poolOf = (lo, hi) => {
    const pool = [];
    for (let n = lo; n <= hi; n++) if (!used.has(n)) pool.push(n);
    return shuffle(pool);
  };
  if (official) {
    for (let c = 0; c < SIZE; c++) {
      const { min, max } = colRange(c);
      const pool = poolOf(min, max);
      for (let r = 0; r < SIZE; r++) if (!isFree(r, c) && next[r][c] === '') { const n = pool.pop(); next[r][c] = String(n); used.add(n); }
    }
    return next;
  }
  const pool = poolOf(MIN, MAX);
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
    if (!isFree(r, c) && next[r][c] === '') next[r][c] = String(pool.pop());
  return next;
}
export const generateGrid = (official = false) => fillBlanks(emptyGrid(), official);
