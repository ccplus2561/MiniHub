// 財務計算、防虧本、結算強平：純函式、無 DOM、不修改傳入物件。
// 所有金額公式集中於此（單一來源）。
import { FINANCE } from '../config/defaults.js';
import { floorTo10 } from '../utils/format.js';
import { winnerCount } from './ranks.js';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** 總彩池 = 新卡收入 + 續卡收入 + 累計付費抽號次數 × 單抽單價 */
export function calcTotalPool(state) {
  const { settings: s, game } = state;
  return s.newCardCount * s.newCardPrice + s.renewCardCount * s.renewCardPrice + game.paidDrawCount * s.drawPrice;
}

/** 彩池分項：新卡、續卡、付費抽號收入與合計（合計與 calcTotalPool 相同） */
export function calcPoolBreakdown(state) {
  const { settings: s, game } = state;
  const newCards = s.newCardCount * s.newCardPrice;
  const renewCards = s.renewCardCount * s.renewCardPrice;
  const paidDraws = game.paidDrawCount * s.drawPrice;
  return { newCards, renewCards, paidDraws, total: newCards + renewCards + paidDraws };
}

/** 有效未得名人數（認人不認卡）= max(0, 人數 − 得獎人數)，預設得獎人數 3 */
export function calcUnrankedPlayers(settings, winners = FINANCE.prizeRankCount) {
  return Math.max(0, settings.players - winners);
}

/**
 * 當期安慰獎單價（單一來源）：續卡張數 > 新卡張數時降至 30 元；
 * 設定金額若本來就更低則取較小者。
 */
export function calcConsolationUnit(settings) {
  const configured = Math.max(0, settings.consolationAmount);
  const cap = settings.renewCardCount > settings.newCardCount ? FINANCE.consolationDiscount : configured;
  return Math.min(configured, cap);
}

/** 以指定辛苦費 % 與安慰獎單價試算一次（內部使用） */
function evaluate(state, hostPercent, consolationUnit) {
  const { settings } = state;
  const totalPool = calcTotalPool(state);
  const hostFee = Math.floor((totalPool * hostPercent) / 100);
  const distributable = totalPool - hostFee;
  const unrankedPlayers = calcUnrankedPlayers(settings, winnerCount(state.game.ranks));
  const consolationTotal = unrankedPlayers * consolationUnit;
  const prizeTotal = Math.max(0, distributable - consolationTotal);
  const prizes = settings.prizeRatio.map((ratio, i) => ({
    rank: i + 1,
    amount: floorTo10(Math.floor((prizeTotal * ratio) / 100)),
  }));
  const ok = distributable - consolationTotal >= 0 && prizes[2].amount > consolationUnit;
  return { totalPool, hostFee, distributable, unrankedPlayers, consolationTotal, prizeTotal, prizes, ok };
}

/**
 * 壓力值（0~1）：寬裕為 0，越吃緊越接近 1。
 * 以「可分配彩池」對比「讓第 3 名獎金 > 安慰獎單價所需的最低可分配彩池」：
 * 比值 ≥ 1.5 → 0；1~1.5 → 0~0.5 線性；< 1（已不足）→ 0.5~1 線性，彩池為 0 時為 1。
 */
export function calcPressure(state) {
  const { settings } = state;
  const ratio3 = settings.prizeRatio[2];
  if (!(ratio3 > 0)) return 1;
  const unit = calcConsolationUnit(settings);
  const totalPool = calcTotalPool(state);
  const distributable = totalPool - Math.floor((totalPool * settings.hostFeePercent) / 100);
  const consolation = calcUnrankedPlayers(settings, winnerCount(state.game.ranks)) * unit;
  const target = floorTo10(unit) + FINANCE.prizeRounding; // 第 3 名至少要領到的金額（> 單價的最小 10 倍數）
  const needed = consolation + Math.ceil((target * 100) / ratio3);
  const r = distributable / needed;
  if (r >= FINANCE.comfortRatio) return 0;
  if (r >= 1) return ((FINANCE.comfortRatio - r) / (FINANCE.comfortRatio - 1)) * 0.5;
  return clamp01(0.5 + 0.5 * (1 - r));
}

/**
 * 結算主函式。依序：原辛苦費 % → 每步 1% 調降至 0% → 每步 10 元調降安慰獎單價至 0，
 * 直到「可分配彩池 ≥ 安慰獎總額」且「第 3 名獎金 > 安慰獎單價」；
 * 極端情況（如總彩池為 0）採安慰獎 0、辛苦費 0。調降過程只記錄於 adjustments（內部用，不顯示）。
 */
export function settle(state) {
  const { settings } = state;
  const originalPercent = Math.max(0, settings.hostFeePercent);
  const originalUnit = calcConsolationUnit(settings);
  const adjustments = [];

  let percent = originalPercent;
  let unit = originalUnit;
  let result = evaluate(state, percent, unit);

  while (!result.ok && percent > 0) {
    percent = Math.max(0, percent - FINANCE.hostFeeStep);
    result = evaluate(state, percent, unit);
  }
  if (percent !== originalPercent) adjustments.push({ type: 'hostFeePercent', from: originalPercent, to: percent });

  const unitBefore = unit;
  while (!result.ok && unit > 0) {
    unit = Math.max(0, unit - FINANCE.consolationStep);
    result = evaluate(state, percent, unit);
  }
  if (unit !== unitBefore) adjustments.push({ type: 'consolationUnit', from: unitBefore, to: unit });

  if (!result.ok) adjustments.push({ type: 'extreme', note: '無法滿足條件，採安慰獎 0、辛苦費 0' });

  const prizeSum = result.prizes.reduce((sum, p) => sum + p.amount, 0);
  return {
    totalPool: result.totalPool,
    hostFeePercentUsed: percent,
    hostFee: result.hostFee,
    distributable: result.distributable,
    consolationUnitUsed: unit,
    unrankedPlayers: result.unrankedPlayers,
    consolationTotal: result.consolationTotal,
    prizePool: result.prizeTotal, // 前三名總獎金池 = max(0, 可分配彩池 − 安慰獎總額)
    prizeTotal: prizeSum, // 實發前三名獎金（各名次已捨去至 10 元）
    prizes: result.prizes,
    remainder: result.distributable - (prizeSum + result.consolationTotal),
    adjustments,
  };
}
