// 金額、數字格式化
/** 12345 → "12,345 元" */
export function formatMoney(n) {
  return `${Number(n).toLocaleString('zh-TW')} 元`;
}

/** 12345 → "12,345" */
export function formatNumber(n) {
  return Number(n).toLocaleString('zh-TW');
}

/** 無條件捨去至 10 元（金額計算共用） */
export function floorTo10(n) {
  return Math.floor(n / 10) * 10;
}
