export const SIZE = 5;
export const CENTER = 2; // 中央 FREE 格的列／欄索引
export const MIN = 1, MAX = 75; // 可用號碼範圍（整張卡共用，不分欄）
export const FILLABLE = SIZE * SIZE - 1; // 24
export const isFree = (r, c) => r === CENTER && c === CENTER;
