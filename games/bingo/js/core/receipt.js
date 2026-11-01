// 結算收據：純函式、無 DOM。只輸出「最終結果」，不含任何調降過程或警告。
// 金額守恆：總彩池 = 主持人辛苦費 + 前三名實發 + 安慰獎實發 + 零頭（零頭 = 其餘全部，歸主持人）。
import { FINANCE } from '../config/defaults.js';
import { settle, calcPoolBreakdown } from './finance.js';
import { calcPayouts, calcPayoutTotal } from './ranks.js';
import { drawnNumbers } from './draw-engine.js';

/** 結束遊戲：只有進行中才能結束，回傳新的 game 欄位（由 UI 套用） */
export function endGame(state) {
  if (state.game.status !== 'playing') return { ok: false, code: 'NOT_PLAYING', message: '遊戲尚未開始或已結束' };
  return { ok: true, game: { ...state.game, status: 'ended' } };
}

/**
 * 組出收據資料。
 * prizeLines：第 1～3 名各一列，status = 'declared'（有人得獎）| 'merged'（併入前一名次平分）| 'none'（無人得獎）。
 */
export function buildReceipt(state) {
  const { settings, game } = state;
  const settlement = settle(state);
  const pool = calcPoolBreakdown(state);
  const payouts = calcPayouts(state, settlement);
  const prizePaid = calcPayoutTotal(payouts);
  const consolationTotal = settlement.consolationTotal;
  const hostFee = settlement.hostFee;
  const remainder = pool.total - hostFee - prizePaid - consolationTotal;

  const prizeLines = [];
  for (let position = 1; position <= FINANCE.prizeRankCount; position++) {
    const owner = payouts.find((p) => p.positions.includes(position));
    if (!owner) prizeLines.push({ position, status: 'none', winners: 0, perPerson: 0, subtotal: 0 });
    else if (owner.rank !== position) prizeLines.push({ position, status: 'merged', mergedInto: owner.rank, winners: 0, perPerson: 0, subtotal: 0 });
    else {
      prizeLines.push({
        position, status: 'declared', winners: owner.winners, perPerson: owner.perPerson,
        subtotal: owner.perPerson * owner.winners, positions: owner.positions,
      });
    }
  }

  return {
    players: settings.players,
    drawCount: game.history.length,
    drawnCount: drawnNumbers(game.history).size,
    pool,
    totalPool: pool.total,
    prizeLines,
    prizePaid,
    consolation: { unit: settlement.consolationUnitUsed, people: settlement.unrankedPlayers, total: consolationTotal },
    hostFee,
    remainder,
    noWinners: payouts.length === 0,
  };
}
