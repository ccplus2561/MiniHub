import { SIZE, MIN, MAX, isFree } from './config.js';

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill('')); }

/** 從 1～75 不重複抽號，填滿 24 格（中央 FREE 留空）。可傳入既有卡片以保留已填數字。 */
export function fillBlanks(grid = emptyGrid()) {
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
export const generateGrid = () => fillBlanks(emptyGrid());
