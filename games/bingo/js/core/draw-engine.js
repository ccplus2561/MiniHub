// 抽號引擎：純函式、無 DOM。不直接修改 state，回傳新的 game 欄位供呼叫端 setState。
import { NUMBER_MIN, NUMBER_MAX, DRAW_RULES } from '../config/defaults.js';
import { calcPressure } from './finance.js';

const TOTAL = NUMBER_MAX - NUMBER_MIN + 1;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** 預設壓力值：由 finance 的 calcPressure 提供（無 state 時退回常數） */
export function defaultPressure(state) {
  if (state && state.settings.prizeEnabled === false) return 0; // 獎金關閉：沒有金錢壓力
  return state ? calcPressure(state) : DRAW_RULES.defaultPressure;
}

/** 已抽出的不重複號碼（只有 type='new' 才算首次抽中） */
export function drawnNumbers(history) {
  const set = new Set();
  for (const r of history) if (r.type === 'new' && r.number != null) set.add(r.number);
  return set;
}

/** 由 history 推算「目前連續無效次數」（結尾連續的 repeat/blank） */
export function recomputeStreak(history) {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i].type !== 'new'; i--) n++;
  return n;
}

/** 無效號機率：壓力 0→基礎機率，壓力 1→高壓機率，線性插值 */
export function invalidRate(pressure) {
  const p = clamp01(Number.isFinite(pressure) ? pressure : 0);
  const { baseInvalidRate: lo, boostedInvalidRate: hi } = DRAW_RULES;
  return lo + (hi - lo) * p;
}

/** 在 game 後面追加紀錄，回傳新的 game 欄位（history、paidDrawCount、invalidStreak） */
export function appendRecords(game, records) {
  const history = [...game.history, ...records];
  return {
    ...game,
    history,
    paidDrawCount: game.paidDrawCount + records.filter((r) => r.paid).length,
    invalidStreak: recomputeStreak(history),
  };
}

/**
 * 抽一個號碼。
 * 成功：{ ok:true, record, game }；失敗：{ ok:false, code, message }（75 號抽完為 'ALL_DRAWN'）
 * 選項：paid、batchId、rng（預設 Math.random）、getPressure(state)、now()
 */
export function drawOne(
  state,
  { paid = false, batchId = null, rng = Math.random, getPressure = defaultPressure, now = Date.now } = {}
) {
  const { settings, game } = state;
  const drawn = drawnNumbers(game.history);
  if (drawn.size >= TOTAL) return { ok: false, code: 'ALL_DRAWN', message: '號碼已全部抽出' };

  // 可能出現的無效類型：尚無已抽號時不可出 repeat
  const kinds = [];
  if (settings.allowRepeat && drawn.size > 0) kinds.push('repeat');
  if (settings.allowBlank) kinds.push('blank');

  // 防呆：連續無效達上限，下一次必定為新有效號
  const streak = Math.max(game.invalidStreak || 0, recomputeStreak(game.history));

  let type = 'new';
  if (kinds.length > 0 && streak < DRAW_RULES.maxInvalidStreak) {
    if (rng() < invalidRate(getPressure(state))) {
      type = kinds.length === 1 ? kinds[0] : rng() < DRAW_RULES.repeatShare ? 'repeat' : 'blank';
    }
  }

  let number = null;
  if (type === 'new') {
    const remaining = [];
    for (let n = NUMBER_MIN; n <= NUMBER_MAX; n++) if (!drawn.has(n)) remaining.push(n);
    number = remaining[Math.min(remaining.length - 1, Math.floor(rng() * remaining.length))];
  } else if (type === 'repeat') {
    const pool = [...drawn];
    number = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  }

  const seq = game.history.length + 1;
  const record = { id: `d${seq}`, seq, type, number, paid: !!paid, batchId, ts: now() };
  return { ok: true, record, game: appendRecords(game, [record]) };
}
