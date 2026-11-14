// 預設值與常數（單一來源）。其他模組一律由此匯入，不要在別處寫死數字。

// 號碼範圍
export const NUMBER_MIN = 1;
export const NUMBER_MAX = 75;

// 連抽依序播放，每筆結果的間隔（毫秒）
export const BATCH_PLAY_INTERVAL_MS = 800;

// 走馬燈顯示最新幾次抽號
export const TICKER_SIZE = 5;

// 賓果欄位（矩陣標示用）
export const BOARD_COLUMNS = [
  { letter: 'B', min: 1, max: 15 },
  { letter: 'I', min: 16, max: 30 },
  { letter: 'N', min: 31, max: 45 },
  { letter: 'G', min: 46, max: 60 },
  { letter: 'O', min: 61, max: 75 },
];


// 抽號暗控參數（單一來源，可自行調整）
export const DRAW_RULES = {
  maxInvalidStreak: 4, // 最多連續 4 次無效，第 5 次必定為新有效號
  baseInvalidRate: 0.25, // 壓力 0 時的無效號（repeat/blank）出現率
  boostedInvalidRate: 0.7, // 壓力 1 時的無效號出現率
  repeatShare: 0.5, // 兩個開關皆開時，無效號中 repeat 所占比例（其餘為 blank）
};

// 無效號出現率的壓力值（固定使用壓力 0 的基礎機率）
export const DEFAULT_PRESSURE = 0;

// 名次常數
export const RANK_COUNT = 3; // 設名次數（前三名）

// 預設規則內容（可在設定頁編輯）：每段 { title, body }，body 每一行為一條說明
export const DEFAULT_RULES = [
  { title: '號碼範圍', body: '本局使用 1～75 號。' },
  { title: '名次', body: '設有前三名。玩家使用紙卡，賓果時由主持人在畫面登錄名次。' },
  { title: '抽號類型', body: '新號：尚未出現過的號碼，正常有效。\n重複號碼：已經抽過的號碼，無效。\n銘謝惠顧：沒有號碼，無效。\n連續最多 4 次無效，第 5 次必定是新號碼。' },
  { title: '連抽', body: '抽號統一使用「連抽」：選擇 1～5 次後按下連抽。\n連抽 2 次以上時，結果會以視窗一次顯示本次所有抽出內容。' },
  { title: '同時賓果', body: '若同一輪抽號有多人同時賓果，依現場規定處理，這些人共同占用相同數量的名次，下一個名次順延。' },
  { title: '結束', body: '主持人按「結束遊戲」後會顯示本局結果，列出已登錄的名次與抽號進度。' },
];

export const DEFAULT_RULES_NOTE = '主持人保留依現場情況調整抽號機率之權利。';

export const DEFAULT_SETTINGS = {
  maxBatchDraws: 5, // 連抽最高 5 次
  allowRepeat: true,
  allowBlank: true,
  locked: false,
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  rulesNote: DEFAULT_RULES_NOTE,
};

export const DEFAULT_GAME = {
  status: 'setup',
  history: [],
  invalidStreak: 0,
  ranks: [],
};

export const DEFAULT_UI = {
  layout: 'mobile',
  soundOn: false,
  tab: 'draw',
};

/** 取得全新的預設 state（深拷貝，避免共用參考） */
export function createDefaultState() {
  return {
    settings: { ...DEFAULT_SETTINGS, rules: DEFAULT_RULES.map((r) => ({ ...r })) },
    game: { ...DEFAULT_GAME, history: [], ranks: [] },
    ui: { ...DEFAULT_UI },
  };
}
