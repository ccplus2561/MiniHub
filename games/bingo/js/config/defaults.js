// 預設值與常數（單一來源）。其他模組一律由此匯入，不要在別處寫死數字。

// 號碼範圍
export const NUMBER_MIN = 1;
export const NUMBER_MAX = 75;

// 設定欄位的輸入上限（防呆）
export const LIMITS = {
  maxPlayers: 999,
  maxCards: 999,
  maxPrice: 9999,
};

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
  defaultPressure: 0.5, // 階段 3 接上財務壓力前的預設壓力值（0~1）
};

// 財務與名次常數
export const FINANCE = {
  prizeRankCount: 3, // 設獎名次數（前三名）
  consolationDiscount: 30, // 續卡張數 > 新卡張數時的安慰獎單價上限
  hostFeeStep: 1, // 結算強平：辛苦費每步調降 1%
  consolationStep: 10, // 結算強平：安慰獎單價每步調降 10 元
  prizeRounding: 10, // 獎金無條件捨去至 10 元
  comfortRatio: 1.5, // 壓力值：可分配彩池達「最低需求」的 1.5 倍以上視為寬裕（壓力 0）
};

// 預設規則內容（可在設定頁編輯）：每段 { title, body, money? }，body 每一行為一條說明；money 為 true 的段落只在啟用獎金時顯示
export const DEFAULT_RULES = [
  { title: '號碼範圍', body: '本局使用 1～75 號。' },
  { title: '獎金機制', body: '設有前三名獎金與安慰獎。總彩池 = 新卡收入 + 續卡收入 + 付費抽號收入。\n前三名依設定比例分配獎金；未得名的玩家每人可領安慰獎。\n玩家使用紙卡，賓果時由主持人在畫面登錄名次；第 2 名出爐後會顯示安慰獎資訊。', money: true },
  { title: '抽號類型', body: '新號：尚未出現過的號碼，正常有效。\n重複號碼：已經抽過的號碼，無效。\n銘謝惠顧：沒有號碼，無效。\n連續最多 4 次無效，第 5 次必定是新號碼。' },
  { title: '連抽', body: '抽號統一使用「連抽」：選擇 1～5 次後按下連抽。\n連抽 2 次以上時，結果會以視窗一次顯示本次所有抽出內容。' },
  { title: '同時賓果', body: '若同一輪抽號有多人同時賓果，依現場規定平分該名次與後續名次的獎金，下一個名次順延。' },
  { title: '結算', body: '主持人按「結束遊戲」後會產生本局結算收據，列出總收入、前三名實領、安慰獎、主持人辛苦費與零頭。', money: true },
];

export const DEFAULT_RULES_NOTE = '主持人保留依現場情況調整抽號機率與結算比例之權利。';

export const DEFAULT_SETTINGS = {
  players: 0,
  newCardPrice: 50,
  renewCardPrice: 30,
  newCardCount: 0,
  renewCardCount: 0,
  drawPrice: 10,
  maxBatchDraws: 5, // 連抽最高 5 次
  maxBatchAmount: 100,
  prizeRatio: [50, 30, 20],
  consolationAmount: 50,
  allowRepeat: true,
  allowBlank: true,
  hostFeePercent: 10,
  locked: false,
  prizeEnabled: true, // 關閉後：沒有獎金池、不收費、抽號不受任何金錢限制
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  rulesNote: DEFAULT_RULES_NOTE,
};

export const DEFAULT_GAME = {
  status: 'setup',
  history: [],
  paidDrawCount: 0,
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
    settings: { ...DEFAULT_SETTINGS, prizeRatio: [...DEFAULT_SETTINGS.prizeRatio], rules: DEFAULT_RULES.map((r) => ({ ...r })) },
    game: { ...DEFAULT_GAME, history: [], ranks: [] },
    ui: { ...DEFAULT_UI },
  };
}
