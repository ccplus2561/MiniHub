// 名次登錄與同時賓果：純函式、無 DOM。不修改傳入物件，回傳新的 game 欄位。
import { FINANCE } from '../config/defaults.js';
import { floorTo10 } from '../utils/format.js';

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

/**
 * 前三名內「實際得獎人數」：已登錄各名次人數加總，加上尚未登錄的名次各 1 人。
 * 無人登錄時為 3；2 人同為第 1 名則為 3；第 1 名 1 人＋第 2 名 3 人同時則為 4。
 */
export function winnerCount(ranks) {
  const covered = coveredPositions(ranks);
  return covered + Math.max(0, FINANCE.prizeRankCount - covered);
}

/** 目前是否可登錄名次（遊戲進行中、至少抽過一次、名次未滿、本次抽號尚未登錄過） */
export function canDeclareRank(state) {
  return declareBlocker(state) === null;
}

function declareBlocker(state) {
  const { game } = state;
  if (game.status !== 'playing') return fail('NOT_PLAYING', '遊戲尚未開始或已結束');
  if (game.history.length === 0) return fail('NO_DRAWS', '尚未抽號');
  if (nextRank(state) > FINANCE.prizeRankCount) return fail('RANKS_FULL', '前三名已全數登錄');
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

/** 第 2 名（含同時賓果占到第 2 名）出爐後，才顯示安慰獎資訊 */
export function isConsolationVisible(state) {
  return state.game.status === 'ended' || coveredPositions(state.game.ranks) >= 2;
}

/**
 * 依結算結果計算各名次得獎者。同時賓果 k 人：該名次與其後 k−1 個名次獎金加總後平均分給 k 人
 * （每人無條件捨去至 10 元）；超過第 3 名的名次不領獎。
 * 回傳 [{ rank, positions, winners, groupPool, perPerson }]（只含已登錄名次）
 */
export function calcPayouts(state, settlement) {
  const amounts = settlement.prizes.map((p) => p.amount);
  return state.game.ranks.map(({ rank, tieCount }) => {
    const positions = [];
    for (let p = rank; p < rank + tieCount && p <= FINANCE.prizeRankCount; p++) positions.push(p);
    const groupPool = positions.reduce((sum, p) => sum + (amounts[p - 1] ?? 0), 0);
    return {
      rank,
      positions,
      winners: tieCount,
      groupPool,
      perPerson: floorTo10(Math.floor(groupPool / tieCount)),
    };
  });
}

/** 實發前三名獎金總額（每人金額 × 人數） */
export function calcPayoutTotal(payouts) {
  return payouts.reduce((sum, p) => sum + p.perPerson * p.winners, 0);
}

/**
 * 前三名各名次的顯示狀態（獎金池畫面用）：
 * open＝尚未出爐（附預估獎金）、declared＝已出爐（同時人數與每人實領）、
 * merged＝被同時賓果併入前一名次平分。
 */
export function rankSlots(state, settlement) {
  const payouts = calcPayouts(state, settlement);
  const slots = [];
  for (let position = 1; position <= FINANCE.prizeRankCount; position++) {
    const owner = payouts.find((p) => p.positions.includes(position));
    if (!owner) slots.push({ position, status: 'open', estimate: settlement.prizes[position - 1].amount });
    else if (owner.rank === position) {
      slots.push({ position, status: 'declared', winners: owner.winners, perPerson: owner.perPerson });
    } else slots.push({ position, status: 'merged', mergedInto: owner.rank });
  }
  return slots;
}
