// 名次登錄與同時賓果：純函式、無 DOM。不修改傳入物件，回傳新的 game 欄位。
import { RANK_COUNT } from '../config/defaults.js';

const MAX_TIE = 999;
const fail = (code, message) => ({ ok: false, code, message });

/** 已被占用的名次數（tieCount 加總；同時賓果 k 人占 k 個名次） */
export function coveredPositions(ranks) {
  return ranks.reduce((sum, r) => sum + r.tieCount, 0);
}

/** 下一個可登錄的名次（第 1 名起，同時賓果會順延） */
export function nextRank(state) {
  return coveredPositions(state.game.ranks) + 1;
}

/** 目前是否可登錄名次（遊戲進行中、至少抽過一次、名次未滿、本次抽號尚未登錄過） */
export function canDeclareRank(state) {
  return declareBlocker(state) === null;
}

function declareBlocker(state) {
  const { game } = state;
  if (game.status !== 'playing') return fail('NOT_PLAYING', '遊戲尚未開始或已結束');
  if (game.history.length === 0) return fail('NO_DRAWS', '尚未抽號');
  if (nextRank(state) > RANK_COUNT) return fail('RANKS_FULL', '前三名已全數登錄');
  const last = game.ranks[game.ranks.length - 1];
  if (last && game.history.length <= last.atSeq) return fail('ALREADY_DECLARED', '此次抽號已登錄過名次，請先抽下一個號碼');
  return null;
}

/**
 * 登錄目前最小未出現的名次，tieCount 為同時賓果人數（≥1）。
 * 成功：{ ok:true, entry, game }；失敗：{ ok:false, code }
 */
export function declareRank(state, { tieCount = 1 } = {}) {
  const blocker = declareBlocker(state);
  if (blocker) return blocker;
  if (!Number.isInteger(tieCount) || tieCount < 1 || tieCount > MAX_TIE) {
    return fail('INVALID_TIE_COUNT', '同時賓果人數需為 1 以上的整數');
  }
  const entry = { rank: nextRank(state), tieCount, atSeq: state.game.history.length };
  return { ok: true, entry, game: { ...state.game, ranks: [...state.game.ranks, entry] } };
}

/** 取消最近一次名次登錄（登錄錯誤時使用） */
export function retractLastRank(state) {
  if (state.game.ranks.length === 0) return fail('NO_RANK', '沒有可取消的名次登錄');
  const ranks = state.game.ranks.slice(0, -1);
  return { ok: true, game: { ...state.game, ranks } };
}
