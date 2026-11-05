import { SIZE } from './config.js';

/** 12 條線：5 橫、5 直、2 斜。每條線是 [r, c] 座標陣列。 */
export const LINES = (() => {
  const idx = [...Array(SIZE).keys()];
  return [
    ...idx.map(r => idx.map(c => [r, c])),
    ...idx.map(c => idx.map(r => [r, c])),
    idx.map(i => [i, i]),
    idx.map(i => [i, SIZE - 1 - i]),
  ];
})();

/** marked 為 5×5 布林陣列；回傳已完成的線（座標陣列）。 */
export function findCompletedLines(marked) {
  return LINES.filter(line => line.every(([r, c]) => marked[r][c]));
}
