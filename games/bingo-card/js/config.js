export const SIZE = 5;
export const CENTER = 2; // 中央 FREE 格的列／欄索引
export const MIN = 1, MAX = 75; // 可用號碼範圍（整張卡共用，不分欄）
export const FILLABLE = SIZE * SIZE - 1; // 24
export const isFree = (r, c) => r === CENTER && c === CENTER;
export const LETTERS = ['B', 'I', 'N', 'G', 'O'];
/** BINGO 正常版：每欄可用號碼範圍（B 1～15、I 16～30、N 31～45、G 46～60、O 61～75） */
export const colRange = c => ({ min: c * 15 + 1, max: c * 15 + 15 });
