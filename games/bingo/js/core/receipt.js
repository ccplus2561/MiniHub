// 本局結果：純函式、無 DOM。
import { drawnNumbers } from './draw-engine.js';

/** 結束遊戲：只有進行中才能結束，回傳新的 game 欄位（由 UI 套用） */
export function endGame(state) {
  if (state.game.status !== 'playing') return { ok: false, code: 'NOT_PLAYING', message: '遊戲尚未開始或已結束' };
  return { ok: true, game: { ...state.game, status: 'ended' } };
}

/** 組出本局結果資料 */
export function buildReceipt(state) {
  const { game } = state;
  return {
    drawCount: game.history.length,
    drawnCount: drawnNumbers(game.history).size,
    ranks: game.ranks.map((k) => ({ rank: k.rank, tieCount: k.tieCount })),
  };
}
