// 快速查驗：純函式、無 DOM
import { NUMBER_MIN, NUMBER_MAX } from '../config/defaults.js';

// 半形／全形句點、逗號、頓號、分號、空白皆可當分隔
const SEPARATORS = /[.．。,，、;；\s]+/;

const toHalfWidth = (s) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 解析 "5.12.33.68" → { valid:[5,12,33,68], invalid:[...] }（去除空值與重複，驗證 1~75） */
export function parseNumbers(input) {
  const valid = [];
  const invalid = [];
  for (const token of toHalfWidth(String(input ?? '')).split(SEPARATORS)) {
    if (token === '') continue;
    const n = /^\d+$/.test(token) ? Number(token) : NaN;
    const list = n >= NUMBER_MIN && n <= NUMBER_MAX ? valid : invalid;
    const item = list === valid ? n : token;
    if (!list.includes(item)) list.push(item);
  }
  return { valid, invalid };
}

/** 查詢號碼是否已抽中（new 與 repeat 算已抽中）。seq 為首次抽出順序，count 為出現次數 */
export function checkNumbers(state, numbers) {
  const hits = state.game.history.filter((r) => r.type !== 'blank' && r.number != null);
  return numbers.map((number) => {
    const mine = hits.filter((r) => r.number === number);
    return { number, drawn: mine.length > 0, seq: mine.length ? mine[0].seq : null, count: mine.length };
  });
}
