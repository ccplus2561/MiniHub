// 數字格式化
/** 12345 → "12,345" */
export function formatNumber(n) {
  return Number(n).toLocaleString('zh-TW');
}
