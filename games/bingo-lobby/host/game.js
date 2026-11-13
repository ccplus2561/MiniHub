(() => {
  "use strict";

  // 載入逾時提示（原 index.html 內嵌腳本）
  setTimeout(() => {
    const boot = document.getElementById("boot");
    if (boot && !boot.hidden) {
      document.getElementById("boot-text").textContent = "載入失敗，請重新整理頁面。";
      boot.classList.add("is-failed");
    }
  }, 6000);

  // 模組表：依相依順序排列，每個區塊以函式包住，避免區域名稱互相衝突
  const M = {};

// ===== config/defaults.js =====
M['config/defaults'] = (() => {
// 預設值與常數（單一來源）。其他模組一律由此匯入，不要在別處寫死數字。

// 號碼範圍
const NUMBER_MIN = 1;
const NUMBER_MAX = 75;

// 設定欄位的輸入上限（防呆）
const LIMITS = {
  maxPlayers: 999,
  maxCards: 999,
  maxPrice: 9999,
};

// 連抽依序播放，每筆結果的間隔（毫秒）
const BATCH_PLAY_INTERVAL_MS = 800;

// 走馬燈顯示最新幾次抽號
const TICKER_SIZE = 5;

// 賓果欄位（矩陣標示用）
const BOARD_COLUMNS = [
  { letter: 'B', min: 1, max: 15 },
  { letter: 'I', min: 16, max: 30 },
  { letter: 'N', min: 31, max: 45 },
  { letter: 'G', min: 46, max: 60 },
  { letter: 'O', min: 61, max: 75 },
];


// 抽號暗控參數（單一來源，可自行調整）
const DRAW_RULES = {
  maxInvalidStreak: 4, // 最多連續 4 次無效，第 5 次必定為新有效號
  baseInvalidRate: 0.25, // 壓力 0 時的無效號（repeat/blank）出現率
  boostedInvalidRate: 0.7, // 壓力 1 時的無效號出現率
  repeatShare: 0.5, // 兩個開關皆開時，無效號中 repeat 所占比例（其餘為 blank）
  defaultPressure: 0.5, // 階段 3 接上財務壓力前的預設壓力值（0~1）
};

// 財務與名次常數
const FINANCE = {
  prizeRankCount: 3, // 設獎名次數（前三名）
  consolationDiscount: 30, // 續卡張數 > 新卡張數時的安慰獎單價上限
  hostFeeStep: 1, // 結算強平：辛苦費每步調降 1%
  consolationStep: 10, // 結算強平：安慰獎單價每步調降 10 元
  prizeRounding: 10, // 獎金無條件捨去至 10 元
  comfortRatio: 1.5, // 壓力值：可分配彩池達「最低需求」的 1.5 倍以上視為寬裕（壓力 0）
};

// 預設規則內容（可在設定頁編輯）：每段 { title, body, money? }，body 每一行為一條說明；money 為 true 的段落只在啟用獎金時顯示
const DEFAULT_RULES = [
  { title: '號碼範圍', body: '本局使用 1～75 號。' },
  { title: '獎金機制', body: '設有前三名獎金與安慰獎。總彩池 = 新卡收入 + 續卡收入 + 付費抽號收入。\n前三名依設定比例分配獎金；未得名的玩家每人可領安慰獎。\n玩家使用紙卡，賓果時由主持人在畫面登錄名次；第 2 名出爐後會顯示安慰獎資訊。', money: true },
  { title: '抽號類型', body: '新號：尚未出現過的號碼，正常有效。\n重複號碼：已經抽過的號碼，無效。\n銘謝惠顧：沒有號碼，無效。\n連續最多 4 次無效，第 5 次必定是新號碼。' },
  { title: '連抽', body: '抽號統一使用「連抽」：選擇 1～5 次後按下連抽。\n連抽 2 次以上時，結果會以視窗一次顯示本次所有抽出內容。' },
  { title: '同時賓果', body: '若同一輪抽號有多人同時賓果，依現場規定平分該名次與後續名次的獎金，下一個名次順延。' },
  { title: '結算', body: '主持人按「結束遊戲」後會產生本局結算收據，列出總收入、前三名實領、安慰獎、主持人辛苦費與零頭。', money: true },
];

const DEFAULT_RULES_NOTE = '主持人保留依現場情況調整抽號機率與結算比例之權利。';

const DEFAULT_SETTINGS = {
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
  spectatorShowPool: false, // 旁觀者是否看得到目前獎金池金額（預設不公開）
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  rulesNote: DEFAULT_RULES_NOTE,
};

const DEFAULT_GAME = {
  status: 'setup',
  history: [],
  paidDrawCount: 0,
  invalidStreak: 0,
  ranks: [],
};

const DEFAULT_UI = {
  layout: 'mobile',
  soundOn: false,
  tab: 'draw',
};

/** 取得全新的預設 state（深拷貝，避免共用參考） */
function createDefaultState() {
  return {
    settings: { ...DEFAULT_SETTINGS, prizeRatio: [...DEFAULT_SETTINGS.prizeRatio], rules: DEFAULT_RULES.map((r) => ({ ...r })) },
    game: { ...DEFAULT_GAME, history: [], ranks: [] },
    ui: { ...DEFAULT_UI },
  };
}
return { NUMBER_MIN, NUMBER_MAX, LIMITS, BATCH_PLAY_INTERVAL_MS, TICKER_SIZE, BOARD_COLUMNS, DRAW_RULES, FINANCE, DEFAULT_RULES, DEFAULT_RULES_NOTE, DEFAULT_SETTINGS, DEFAULT_GAME, DEFAULT_UI, createDefaultState };
})();

// ===== core/state.js =====
M['core/state'] = (() => {
const { createDefaultState } = M['config/defaults'];
// 全域狀態：純邏輯、無 DOM。只存在記憶體中——關閉或重新整理網頁後一律回到初始狀態，不寫入任何儲存空間。

let state = createDefaultState();
const listeners = new Set();

/** 取得目前狀態（唯讀參考，請勿直接修改；用 setState） */
function getState() {
  return state;
}

/**
 * 更新狀態。patch 格式：{ settings?, game?, ui? }，每個區塊做淺層合併
 * （陣列與物件欄位會整個取代）。更新後通知訂閱者。
 */
function setState(patch = {}) {
  state = {
    settings: { ...state.settings, ...(patch.settings || {}) },
    game: { ...state.game, ...(patch.game || {}) },
    ui: { ...state.ui, ...(patch.ui || {}) },
  };
  notify();
  return state;
}

/** 訂閱狀態變化，回傳取消訂閱函式 */
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of [...listeners]) {
    try {
      fn(state);
    } catch (err) {
      console.error('[state] 訂閱者發生錯誤', err);
    }
  }
}

/** 回到 setup 預設狀態 */
function reset() {
  state = createDefaultState();
  notify();
  return state;
}
return { getState, setState, subscribe, reset };
})();

// ===== ui/tabs.js =====
M['ui/tabs'] = (() => {
const { getState, subscribe } = M['core/state'];
// 兩個畫面：抽號（draw）與設定（settings），依 state.ui.tab 切換

function initTabs(panels) {
  function apply() {
    let active = getState().ui.tab;
    if (active !== 'settings') active = 'draw'; // 只有抽號與設定兩個畫面
    panels.forEach((p) => { p.hidden = p.dataset.panel !== active; });
    window.scrollTo(0, 0);
  }
  let current = null;
  const run = () => { const t = getState().ui.tab; if (t !== current) { current = t; apply(); } };
  run();
  subscribe(run);
}
return { initTabs };
})();

// ===== utils/dom.js =====
M['utils/dom'] = (() => {
// DOM 小工具：建立元素、提示訊息、確認彈窗

/** el('div', {class:'x', onClick: fn}, '文字', childNode) */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** 畫面下方短暫提示。type: 'info' | 'error' */
function toast(message, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = el('div', { id: 'toast-root', 'aria-live': 'polite' });
    document.body.append(root);
  }
  const item = el('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  root.append(item);
  setTimeout(() => item.remove(), 2800);
}

/** 彈窗關閉：先播淡出動畫再移除 */
function dismiss(overlay) {
  overlay.classList.add('is-closing');
  setTimeout(() => overlay.remove(), 180);
}

/** 確認彈窗，回傳 Promise<boolean> */
function confirmDialog({ title, message, confirmText = '確定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      dismiss(overlay);
      if (previous && previous.focus) previous.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close(false) }, cancelText);
    const okBtn = el('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => close(true) }, confirmText);
    const overlay = el(
      'div',
      { class: 'modal-overlay', onClick: (e) => e.target === overlay && close(false) },
      el(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        el('h3', { class: 'modal-title' }, title),
        el('p', { class: 'modal-message' }, message),
        el('div', { class: 'modal-actions' }, cancelBtn, okBtn)
      )
    );
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    cancelBtn.focus();
  });
}

/**
 * 通用彈窗。actions: [{ text, kind:'primary'|'secondary'|'danger'|'danger-outline', onClick }]，
 * onClick 回傳 false 代表不關閉；沒有 onClick 則直接關閉。回傳 { close }。
 */
function showModal({ title, content, actions = [], wide = false, onClose } = {}) {
  const previous = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    dismiss(overlay);
    if (previous && previous.focus) previous.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  const buttons = actions.map((a) =>
    el('button', {
      type: 'button',
      class: `btn btn-${a.kind ?? 'secondary'}`,
      onClick: async () => {
        const keepOpen = a.onClick ? (await a.onClick()) === false : false;
        if (!keepOpen) close();
      },
    }, a.text)
  );
  const overlay = el('div', { class: 'modal-overlay', onClick: (e) => e.target === overlay && close() },
    el('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('h3', { class: 'modal-title' }, title),
      el('div', { class: 'modal-body' }, content),
      buttons.length ? el('div', { class: 'modal-actions' }, ...buttons) : null
    )
  );
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  const focusable = overlay.querySelector('input, .modal-actions .btn:last-child');
  if (focusable) focusable.focus();
  return { close };
}
return { el, toast, confirmDialog, showModal };
})();

// ===== ui/rules-view.js =====
M['ui/rules-view'] = (() => {
const { el, showModal } = M['utils/dom'];
const { getState } = M['core/state'];
// ❓ 規則說明（全螢幕卡片式）。內容來自 settings.rules（可在設定頁編輯）。
// openRules({ onStart })：開始抽獎前先顯示規則，按「開始抽獎」才執行 onStart。

/** 一段規則 → 卡片（編號徽章＋標題＋逐行說明） */
function ruleCard(rule, index) {
  const lines = String(rule.body).split('\n').map((l) => l.trim()).filter(Boolean);
  const card = el('section', { class: 'rule-card' },
    el('div', { class: 'rule-head' },
      el('span', { class: 'rule-no', 'aria-hidden': 'true' }, String(index + 1)),
      el('h4', { class: 'rule-title' }, rule.title || '（未命名）')),
    el('ul', { class: 'rule-lines' }, ...lines.map((l) => el('li', {}, l))));
  card.style.setProperty('--i', String(index));
  return card;
}

function openRules({ onStart } = {}) {
  const { rules: allRules, rulesNote, prizeEnabled } = getState().settings;
  const rules = allRules.filter((r) => prizeEnabled || !r.money);
  const starting = typeof onStart === 'function';
  const content = el('div', { class: 'rules-wrap' },
    el('header', { class: 'rules-hero' },
      el('span', { class: 'rules-hero-icon', 'aria-hidden': 'true' }, '🧧'),
      el('div', {},
        el('h2', { class: 'rules-hero-title' }, '遊戲規則'),
        el('p', { class: 'rules-hero-sub' }, starting ? '請所有玩家詳閱，確認後即開始抽獎' : '兵果彩盤・賓果抽獎'))),
    el('div', { class: 'rules-grid' }, ...rules.map(ruleCard)),
    rulesNote ? el('p', { class: 'rules-note' }, rulesNote) : null);

  const actions = starting
    ? [{ text: '← 返回設定', kind: 'secondary' }, { text: '🎰 開始抽獎', kind: 'primary', onClick: () => { onStart(); } }]
    : [{ text: '關閉', kind: 'primary' }];
  const modal = showModal({ title: '規則說明', content, wide: true, actions });
  const overlay = [...document.querySelectorAll('.modal-overlay')].at(-1);
  overlay?.classList.add('rules-overlay');
  return modal;
}

/** 綁定頂部「❓」按鈕 */
function initRulesView(button) {
  button.addEventListener('click', () => openRules());
}
return { openRules, initRulesView };
})();

// ===== utils/format.js =====
M['utils/format'] = (() => {
// 金額、數字格式化
/** 12345 → "12,345 元" */
function formatMoney(n) {
  return `${Number(n).toLocaleString('zh-TW')} 元`;
}

/** 12345 → "12,345" */
function formatNumber(n) {
  return Number(n).toLocaleString('zh-TW');
}

/** 無條件捨去至 10 元（金額計算共用） */
function floorTo10(n) {
  return Math.floor(n / 10) * 10;
}
return { formatMoney, formatNumber, floorTo10 };
})();

// ===== ui/settings-view.js =====
M['ui/settings-view'] = (() => {
const { getState, setState, reset, subscribe } = M['core/state'];
const { DEFAULT_SETTINGS, DEFAULT_RULES, DEFAULT_RULES_NOTE, LIMITS } = M['config/defaults'];
const { openRules } = M['ui/rules-view'];
const { el, toast, confirmDialog } = M['utils/dom'];
const { formatMoney } = M['utils/format'];
// ⚙️ 設定頁：欄位驗證、開始遊戲（鎖定）、重新開始

// ---------- 驗證（純函式，可在 Node 測試） ----------

const NUMBER_RULES = {
  players: { label: '參加總人數', max: LIMITS.maxPlayers },
  newCardPrice: { label: '新卡單價', max: LIMITS.maxPrice },
  renewCardPrice: { label: '續卡單價', max: LIMITS.maxPrice },
  newCardCount: { label: '新卡張數', max: LIMITS.maxCards },
  renewCardCount: { label: '續卡張數', max: LIMITS.maxCards },
  drawPrice: { label: '單抽單價', min: 1 },
  consolationAmount: { label: '安慰獎金額', max: LIMITS.maxPrice },
  hostFeePercent: { label: '主持人辛苦費', max: 100 },
};

const fail = (message) => ({ ok: false, message });

/** 單抽單價上限：只受一般輸入上限限制（連抽付費上限 = 單抽單價 × 連抽上限，自動套用） */
function drawPriceLimit() {
  return LIMITS.maxPrice;
}

/** 驗證單一數字欄位，回傳 {ok:true,value} 或 {ok:false,message} */
function validateNumberField(key, raw, settings = DEFAULT_SETTINGS) {
  const rule = NUMBER_RULES[key];
  if (!rule) return fail('未知欄位');
  const text = String(raw ?? '').trim();
  if (text === '') return fail(`${rule.label}不可空白`);
  const n = Number(text);
  if (!Number.isFinite(n)) return fail(`${rule.label}請輸入數字`);
  if (n < 0) return fail(`${rule.label}不可為負數`);
  if (!Number.isInteger(n)) return fail(`${rule.label}請輸入整數`);
  const min = rule.min ?? 0;
  if (n < min) return fail(`${rule.label}至少為 ${min}`);
  if (key === 'drawPrice') {
    if (n > drawPriceLimit(settings)) return fail(`${rule.label}不可超過 ${drawPriceLimit(settings)}`);
  } else if (rule.max !== undefined && n > rule.max) {
    return fail(`${rule.label}不可超過 ${rule.max}`);
  }
  return { ok: true, value: n };
}

/** 驗證獎金比例（3 個欄位，各為 0~100 整數，合計必須 100） */
function validateRatio(values) {
  const nums = values.map((v) => (String(v ?? '').trim() === '' ? NaN : Number(v)));
  if (nums.length !== 3 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
    return fail('獎金比例請輸入 0~100 的整數，不可為負數或空白');
  }
  const sum = nums[0] + nums[1] + nums[2];
  if (sum !== 100) return fail(`獎金比例合計為 ${sum}，必須為 100`);
  return { ok: true, value: nums };
}

/** 依比例自動換算為合計 100（餘數補在第 1 名） */
function normalizeRatio(values) {
  const nums = values.map((v) => Math.max(0, Math.round(Number(v)) || 0));
  const sum = nums[0] + nums[1] + nums[2];
  if (sum <= 0) return [...DEFAULT_SETTINGS.prizeRatio];
  const scaled = nums.map((n) => Math.floor((n / sum) * 100));
  scaled[0] += 100 - (scaled[0] + scaled[1] + scaled[2]);
  return scaled;
}

// ---------- 可編輯規則 ----------

// 遊戲進行中，僅開放「加買卡」與「人數」；辛苦費 % 與安慰獎金額開局後一律鎖定
const EDITABLE_WHILE_PLAYING = ['players', 'newCardCount', 'renewCardCount', 'rules', 'spectatorShowPool'];

function isEditable(key, status) {
  if (status === 'setup') return true;
  if (status === 'playing') return EDITABLE_WHILE_PLAYING.includes(key);
  if (key === 'spectatorShowPool') return true;   // 旁觀顯示開關：隨時可切換
  return false;
}

// ---------- 畫面 ----------

function initSettings(root) {
  let signature = '';

  function setError(key, message) {
    const node = root.querySelector(`#err-${key}`);
    if (node) node.textContent = message;
  }

  function lockTag(editable) {
    return editable ? null : el('span', { class: 'lock-tag' }, '🔒 已鎖定');
  }

  function numberField(key, label, status, hint) {
    const { settings } = getState();
    const editable = isEditable(key, status);
    const rule = NUMBER_RULES[key];
    const input = el('input', {
      class: 'input',
      id: `f-${key}`,
      type: 'number',
      inputMode: 'numeric',
      min: rule.min ?? 0,
      step: 1,
      value: String(settings[key]),
      disabled: !editable,
      onChange: () => {
        const res = validateNumberField(key, input.value, getState().settings);
        if (!res.ok) {
          setError(key, res.message);
          toast(res.message, 'error');
          input.value = String(getState().settings[key]); // 還原為有效值
          return;
        }
        setError(key, '');
        input.value = String(res.value);
        setState({ settings: { [key]: res.value } });
      },
    });
    return el(
      'div',
      { class: `field${editable ? '' : ' is-locked'}` },
      el('label', { class: 'field-label', htmlFor: `f-${key}` }, label, lockTag(editable)),
      input,
      hint ? el('p', { class: 'field-hint' }, hint) : null,
      el('p', { class: 'field-error', id: `err-${key}`, role: 'alert' })
    );
  }

  function toggleField(key, label, hint, status) {
    const { settings } = getState();
    const editable = isEditable(key, status);
    const input = el('input', {
      type: 'checkbox',
      class: 'switch',
      id: `f-${key}`,
      checked: settings[key],
      disabled: !editable,
      onChange: () => setState({ settings: { [key]: input.checked } }),
    });
    return el(
      'label',
      { class: `switch-row${editable ? '' : ' is-locked'}`, htmlFor: `f-${key}` },
      el('span', { class: 'switch-text' }, el('strong', {}, label, lockTag(editable)), el('small', {}, hint)),
      input
    );
  }

  function ratioField(status) {
    const { settings } = getState();
    const editable = isEditable('prizeRatio', status);
    const sumEl = el('span', { class: 'ratio-sum' });
    const inputs = settings.prizeRatio.map((v, i) =>
      el('input', {
        class: 'input',
        type: 'number',
        inputMode: 'numeric',
        min: 0,
        max: 100,
        step: 1,
        value: String(v),
        disabled: !editable,
        'aria-label': `第 ${i + 1} 名比例`,
        onInput: updateSum,
        onChange: commitRatio,
      })
    );
    function updateSum() {
      const sum = inputs.reduce((acc, i) => acc + (Number(i.value) || 0), 0);
      sumEl.textContent = `合計 ${sum} / 100`;
      sumEl.classList.toggle('is-bad', sum !== 100);
    }
    function commitRatio() {
      const res = validateRatio(inputs.map((i) => i.value));
      if (!res.ok) {
        setError('prizeRatio', res.message);
        toast(res.message, 'error');
        return; // 不儲存；保留輸入內容讓使用者修正
      }
      setError('prizeRatio', '');
      setState({ settings: { prizeRatio: res.value } });
    }
    const autoBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-small btn-secondary',
        disabled: !editable,
        onClick: () => {
          normalizeRatio(inputs.map((i) => i.value)).forEach((v, i) => (inputs[i].value = String(v)));
          updateSum();
          commitRatio();
        },
      },
      '自動換算為 100'
    );
    updateSum();
    return el(
      'div',
      { class: `field${editable ? '' : ' is-locked'}` },
      el('span', { class: 'field-label' }, '獎金分派比例（第 1 : 2 : 3 名）', lockTag(editable)),
      el(
        'div',
        { class: 'ratio-row' },
        ...inputs.flatMap((input, i) => [i > 0 ? el('span', { class: 'ratio-colon' }, ':') : null, input])
      ),
      el('div', { class: 'ratio-foot' }, sumEl, autoBtn),
      el('p', { class: 'field-error', id: 'err-prizeRatio', role: 'alert' })
    );
  }

  // 規則內容編輯器：每段標題＋說明（每行一條），可上下移動、刪除、新增、還原預設
  function rulesEditor(status) {
    const editable = isEditable('rules', status);
    let list = getState().settings.rules.map((r) => ({ ...r }));
    let note = getState().settings.rulesNote;
    const holder = el('div', { class: 'rules-edit-list' });
    const commit = () => setState({ settings: { rules: list.map((r) => ({ ...r })), rulesNote: note } });

    function paint() {
      holder.replaceChildren(...list.map((r, i) => {
        const title = el('input', { class: 'input', value: r.title, disabled: !editable, 'aria-label': `第 ${i + 1} 段標題`, placeholder: '標題',
          onChange: () => { r.title = title.value.trim(); commit(); } });
        const body = el('textarea', { class: 'input rule-textarea', rows: 3, disabled: !editable, 'aria-label': `第 ${i + 1} 段內容`, placeholder: '每一行為一條說明',
          onChange: () => { r.body = body.value; commit(); } });
        body.value = r.body;
        const money = el('label', { class: 'rule-money', title: '關閉獎金功能時隱藏這一段' },
          el('input', { type: 'checkbox', checked: !!r.money, disabled: !editable, onChange: (e) => { if (e.target.checked) r.money = true; else delete r.money; commit(); } }),
          '獎金相關');
        const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; commit(); paint(); };
        return el('div', { class: 'rule-edit' },
          el('div', { class: 'rule-edit-head' },
            el('span', { class: 'rule-no', 'aria-hidden': 'true' }, String(i + 1)),
            title,
            el('button', { type: 'button', class: 'btn btn-small btn-secondary rule-ico', disabled: !editable || i === 0, 'aria-label': '上移', onClick: () => move(-1) }, '↑'),
            el('button', { type: 'button', class: 'btn btn-small btn-secondary rule-ico', disabled: !editable || i === list.length - 1, 'aria-label': '下移', onClick: () => move(1) }, '↓'),
            el('button', { type: 'button', class: 'btn btn-small btn-danger-outline rule-ico', disabled: !editable, 'aria-label': '刪除此段', onClick: () => { list.splice(i, 1); commit(); paint(); } }, '✕')),
          body, money);
      }));
    }
    paint();

    const noteInput = el('input', { class: 'input', value: note, disabled: !editable, placeholder: '底部備註（可留空）', 'aria-label': '規則底部備註',
      onChange: () => { note = noteInput.value.trim(); commit(); } });

    return el('details', { class: 'card prize-fold rules-fold' },
      el('summary', { class: 'prize-sum' },
        el('span', { class: 'card-title' }, '規則內容'),
        el('span', { class: 'prize-sum-hint' }, '開始抽獎前會先向所有人顯示（點擊展開編輯）')),
      el('div', { class: 'rules-edit-body' },
        holder,
        el('div', { class: 'field' }, el('span', { class: 'field-label' }, '底部備註', lockTag(editable)), noteInput),
        el('div', { class: 'rules-edit-actions' },
          el('button', { type: 'button', class: 'btn btn-small btn-secondary', disabled: !editable, onClick: () => { list.push({ title: '新規則', body: '' }); commit(); paint(); holder.lastElementChild?.querySelector('input')?.select(); } }, '＋ 新增段落'),
          el('button', { type: 'button', class: 'btn btn-small btn-secondary', onClick: () => openRules() }, '👁 預覽'),
          el('button', { type: 'button', class: 'btn btn-small btn-danger-outline', disabled: !editable, onClick: async () => {
            const ok = await confirmDialog({ title: '還原預設規則？', message: '目前編輯的規則內容將被預設內容取代。', confirmText: '還原', danger: true });
            if (!ok) return;
            list = DEFAULT_RULES.map((r) => ({ ...r })); note = DEFAULT_RULES_NOTE; noteInput.value = note; commit(); paint();
          } }, '還原預設'))));
  }

  async function onStart() {
    const { settings } = getState();
    if (settings.prizeEnabled && settings.players < 1) {
      setError('players', '開始前請先填寫參加總人數（至少 1 人）');
      toast('請先填寫參加總人數', 'error');
      root.querySelector('#f-players')?.focus();
      return;
    }
    const ok = await confirmDialog({
      title: '開始抽獎？',
      message: settings.prizeEnabled ? '接著會先顯示規則給所有人確認；開始後，主持人辛苦費 % 與安慰獎金額將鎖定，無法修改。' : '接著會先顯示規則給所有人確認；開始後將無法再切換獎金功能。',
      confirmText: '下一步：顯示規則',
    });
    if (!ok) return;
    openRules({
      onStart: () => {
        setState({ settings: { locked: true }, game: { status: 'playing' }, ui: { tab: 'draw' } });
        toast('開始抽獎！');
      },
    });
  }

  async function onReset() {
    const ok = await confirmDialog({
      title: '重新開始？',
      message: '將清除所有設定與對局紀錄，回到初始狀態，此操作無法復原。',
      confirmText: '確定清除',
      danger: true,
    });
    if (!ok) return;
    if (!(await MiniHub.requestNext())) return;
    reset();
    setState({ ui: { tab: 'settings' } }); // 重新開始後停留在設定頁
    render();
    toast('已重新開始');
  }

  function render() {
    const { settings, game } = getState();
    const status = game.status;
    signature = `${status}|${settings.locked}|${settings.prizeEnabled}`;
    const prizeOn = settings.prizeEnabled;

    const startCard =
      status === 'setup'
        ? el(
            'div',
            { class: 'card card-action' },
            el('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: onStart }, '🎰 開始抽獎'),
            el('p', { class: 'field-hint' }, prizeOn ? '先顯示規則，開始後辛苦費 % 與安慰獎金額將鎖定。' : '先顯示規則，再開始抽獎。')
          )
        : el(
            'div',
            { class: 'card card-note' },
            el('strong', {}, status === 'playing' ? '遊戲進行中' : '本局已結束'),
            el(
              'p',
              { class: 'field-hint' },
              status === 'playing'
                ? '辛苦費 % 與安慰獎金額已鎖定；可修改參加人數與新／續卡張數（加買卡）。'
                : '所有設定已鎖定，請按「重新開始」開新局。'
            )
          );

    root.classList.toggle('no-prize', !prizeOn);
    root.replaceChildren(...[
      el(
        'div',
        { class: 'card mode-card' },
        toggleField('prizeEnabled', '啟用獎金功能', '關閉後沒有獎金池與費用，抽獎不受任何金錢限制，只記錄名次', status),
        prizeOn ? toggleField('spectatorShowPool', '旁觀者顯示獎金池', '開啟後旁觀畫面會顯示目前總彩池金額（只顯示總額，不含保底與各項明細）；關閉則完全不傳送金額', status) : null
      ),
      prizeOn ? el(
        'div',
        { class: 'card card-players' },
        el('h2', { class: 'card-title' }, '玩家與卡片'),
        numberField('players', '參加總人數（持卡玩家數）', status, '安慰獎以人數計算，認人不認卡'),
        numberField('newCardPrice', '新卡單價（元）', status),
        numberField('renewCardPrice', '續卡單價（元）', status),
        numberField('newCardCount', '新卡張數', status),
        numberField('renewCardCount', '續卡張數', status)
      ) : null,
      el(
        'div',
        { class: 'card' },
        el('h2', { class: 'card-title' }, '抽號設定'),
        !prizeOn ? null : numberField(
          'drawPrice',
          '單抽單價（元）',
          status,
          `連抽最高 ${settings.maxBatchDraws} 次，單次付費上限 = 單抽單價 × ${settings.maxBatchDraws}（目前 ${formatMoney(settings.drawPrice * settings.maxBatchDraws)}）`
        ),
        toggleField('allowRepeat', '允許重複數字', '可能抽到已出現過的號碼', status),
        toggleField('allowBlank', '允許銘謝惠顧', '可能抽到無號碼的空籤', status)
      ),
      // 預設收合：避免他人看到保底（安慰獎）金額；每次重繪都回到收合
      !prizeOn ? null : el(
        'details',
        { class: 'card prize-fold' },
        el('summary', { class: 'prize-sum' },
          el('span', { class: 'card-title' }, '獎金設定'),
          el('span', { class: 'prize-sum-hint' }, '🔒 點擊展開（含保底金額，請避開他人視線）')),
        el('div', { class: 'prize-body' },
          ratioField(status),
          numberField('consolationAmount', '安慰獎金額（每人，元）', status),
          numberField('hostFeePercent', '主持人辛苦費（%）', status))
      ),
      rulesEditor(status),
      startCard,
      el(
        'div',
        { class: 'card-action' },
        el('button', { type: 'button', class: 'btn btn-danger-outline btn-block', onClick: onReset }, '🔄 重新開始')
      )
    ].filter(Boolean));
  }

  render();
  // 只有開局狀態改變時才整頁重繪，避免輸入中失去焦點
  subscribe((s) => {
    if (`${s.game.status}|${s.settings.locked}|${s.settings.prizeEnabled}` !== signature) render();
  });
}
return { drawPriceLimit, validateNumberField, validateRatio, normalizeRatio, initSettings };
})();

// ===== core/ranks.js =====
M['core/ranks'] = (() => {
const { FINANCE } = M['config/defaults'];
const { floorTo10 } = M['utils/format'];
// 名次登錄與同時賓果：純函式、無 DOM。不修改傳入物件，回傳新的 game 欄位。

const MAX_TIE = 999;
const fail = (code, message) => ({ ok: false, code, message });

/** 已被占用的名次數（tieCount 加總；同時賓果 k 人占 k 個名次） */
function coveredPositions(ranks) {
  return ranks.reduce((sum, r) => sum + r.tieCount, 0);
}

/** 下一個可登錄的名次（第 1 名起，同時賓果會順延） */
function nextRank(state) {
  return coveredPositions(state.game.ranks) + 1;
}

/**
 * 前三名內「實際得獎人數」：已登錄各名次人數加總，加上尚未登錄的名次各 1 人。
 * 無人登錄時為 3；2 人同為第 1 名則為 3；第 1 名 1 人＋第 2 名 3 人同時則為 4。
 */
function winnerCount(ranks) {
  const covered = coveredPositions(ranks);
  return covered + Math.max(0, FINANCE.prizeRankCount - covered);
}

/** 目前是否可登錄名次（遊戲進行中、至少抽過一次、名次未滿、本次抽號尚未登錄過） */
function canDeclareRank(state) {
  return declareBlocker(state) === null;
}

function declareBlocker(state) {
  const { game } = state;
  if (game.status !== 'playing') return fail('NOT_PLAYING', '遊戲尚未開始或已結束');
  if (game.history.length === 0) return fail('NO_DRAWS', '尚未抽號');
  if (nextRank(state) > FINANCE.prizeRankCount) return fail('RANKS_FULL', '前三名已全數登錄');
  const last = game.ranks[game.ranks.length - 1];
  if (last && game.history.length <= last.atSeq) return fail('ALREADY_DECLARED', '此次抽號已登錄過名次，請先抽下一個號碼');
  return null;
}

/**
 * 登錄目前最小未出現的名次，tieCount 為同時賓果人數（≥1）。
 * 成功：{ ok:true, entry, game }；失敗：{ ok:false, code }
 */
function declareRank(state, { tieCount = 1 } = {}) {
  const blocker = declareBlocker(state);
  if (blocker) return blocker;
  if (!Number.isInteger(tieCount) || tieCount < 1 || tieCount > MAX_TIE) {
    return fail('INVALID_TIE_COUNT', '同時賓果人數需為 1 以上的整數');
  }
  const entry = { rank: nextRank(state), tieCount, atSeq: state.game.history.length };
  return { ok: true, entry, game: { ...state.game, ranks: [...state.game.ranks, entry] } };
}

/** 取消最近一次名次登錄（登錄錯誤時使用） */
function retractLastRank(state) {
  if (state.game.ranks.length === 0) return fail('NO_RANK', '沒有可取消的名次登錄');
  const ranks = state.game.ranks.slice(0, -1);
  return { ok: true, game: { ...state.game, ranks } };
}

/** 第 2 名（含同時賓果占到第 2 名）出爐後，才顯示安慰獎資訊 */
function isConsolationVisible(state) {
  return state.game.status === 'ended' || coveredPositions(state.game.ranks) >= 2;
}

/**
 * 依結算結果計算各名次得獎者。同時賓果 k 人：該名次與其後 k−1 個名次獎金加總後平均分給 k 人
 * （每人無條件捨去至 10 元）；超過第 3 名的名次不領獎。
 * 回傳 [{ rank, positions, winners, groupPool, perPerson }]（只含已登錄名次）
 */
function calcPayouts(state, settlement) {
  const amounts = settlement.prizes.map((p) => p.amount);
  return state.game.ranks.map(({ rank, tieCount }) => {
    const positions = [];
    for (let p = rank; p < rank + tieCount && p <= FINANCE.prizeRankCount; p++) positions.push(p);
    const groupPool = positions.reduce((sum, p) => sum + (amounts[p - 1] ?? 0), 0);
    return {
      rank,
      positions,
      winners: tieCount,
      groupPool,
      perPerson: floorTo10(Math.floor(groupPool / tieCount)),
    };
  });
}

/** 實發前三名獎金總額（每人金額 × 人數） */
function calcPayoutTotal(payouts) {
  return payouts.reduce((sum, p) => sum + p.perPerson * p.winners, 0);
}

/**
 * 前三名各名次的顯示狀態（獎金池畫面用）：
 * open＝尚未出爐（附預估獎金）、declared＝已出爐（同時人數與每人實領）、
 * merged＝被同時賓果併入前一名次平分。
 */
function rankSlots(state, settlement) {
  const payouts = calcPayouts(state, settlement);
  const slots = [];
  for (let position = 1; position <= FINANCE.prizeRankCount; position++) {
    const owner = payouts.find((p) => p.positions.includes(position));
    if (!owner) slots.push({ position, status: 'open', estimate: settlement.prizes[position - 1].amount });
    else if (owner.rank === position) {
      slots.push({ position, status: 'declared', winners: owner.winners, perPerson: owner.perPerson });
    } else slots.push({ position, status: 'merged', mergedInto: owner.rank });
  }
  return slots;
}
return { coveredPositions, nextRank, winnerCount, canDeclareRank, declareRank, retractLastRank, isConsolationVisible, calcPayouts, calcPayoutTotal, rankSlots };
})();

// ===== core/finance.js =====
M['core/finance'] = (() => {
const { FINANCE } = M['config/defaults'];
const { floorTo10 } = M['utils/format'];
const { winnerCount } = M['core/ranks'];
// 財務計算、防虧本、結算強平：純函式、無 DOM、不修改傳入物件。
// 所有金額公式集中於此（單一來源）。

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** 總彩池 = 新卡收入 + 續卡收入 + 累計付費抽號次數 × 單抽單價 */
function calcTotalPool(state) {
  const { settings: s, game } = state;
  return s.newCardCount * s.newCardPrice + s.renewCardCount * s.renewCardPrice + game.paidDrawCount * s.drawPrice;
}

/** 彩池分項：新卡、續卡、付費抽號收入與合計（合計與 calcTotalPool 相同） */
function calcPoolBreakdown(state) {
  const { settings: s, game } = state;
  const newCards = s.newCardCount * s.newCardPrice;
  const renewCards = s.renewCardCount * s.renewCardPrice;
  const paidDraws = game.paidDrawCount * s.drawPrice;
  return { newCards, renewCards, paidDraws, total: newCards + renewCards + paidDraws };
}

/** 有效未得名人數（認人不認卡）= max(0, 人數 − 得獎人數)，預設得獎人數 3 */
function calcUnrankedPlayers(settings, winners = FINANCE.prizeRankCount) {
  return Math.max(0, settings.players - winners);
}

/**
 * 當期安慰獎單價（單一來源）：續卡張數 > 新卡張數時降至 30 元；
 * 設定金額若本來就更低則取較小者。
 */
function calcConsolationUnit(settings) {
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
function calcPressure(state) {
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
function settle(state) {
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
return { calcTotalPool, calcPoolBreakdown, calcUnrankedPlayers, calcConsolationUnit, calcPressure, settle };
})();

// ===== core/draw-engine.js =====
M['core/draw-engine'] = (() => {
const { NUMBER_MIN, NUMBER_MAX, DRAW_RULES } = M['config/defaults'];
const { calcPressure } = M['core/finance'];
// 抽號引擎：純函式、無 DOM。不直接修改 state，回傳新的 game 欄位供呼叫端 setState。

const TOTAL = NUMBER_MAX - NUMBER_MIN + 1;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** 預設壓力值：由 finance 的 calcPressure 提供（無 state 時退回常數） */
function defaultPressure(state) {
  if (state && state.settings.prizeEnabled === false) return 0; // 獎金關閉：沒有金錢壓力
  return state ? calcPressure(state) : DRAW_RULES.defaultPressure;
}

/** 已抽出的不重複號碼（只有 type='new' 才算首次抽中） */
function drawnNumbers(history) {
  const set = new Set();
  for (const r of history) if (r.type === 'new' && r.number != null) set.add(r.number);
  return set;
}

/** 由 history 推算「目前連續無效次數」（結尾連續的 repeat/blank） */
function recomputeStreak(history) {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i].type !== 'new'; i--) n++;
  return n;
}

/** 無效號機率：壓力 0→基礎機率，壓力 1→高壓機率，線性插值 */
function invalidRate(pressure) {
  const p = clamp01(Number.isFinite(pressure) ? pressure : 0);
  const { baseInvalidRate: lo, boostedInvalidRate: hi } = DRAW_RULES;
  return lo + (hi - lo) * p;
}

/** 在 game 後面追加紀錄，回傳新的 game 欄位（history、paidDrawCount、invalidStreak） */
function appendRecords(game, records) {
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
function drawOne(
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
return { defaultPressure, drawnNumbers, recomputeStreak, invalidRate, appendRecords, drawOne };
})();

// ===== core/batch-draw.js =====
M['core/batch-draw'] = (() => {
const { drawOne } = M['core/draw-engine'];
// 付費單抽／連抽：純函式、無 DOM

/** 單次連抽的次數上限 = 連抽上限（5）；單次付費上限 = 單抽單價 × 連抽上限，由單價自動算出 */
function maxBatchCount(settings) {
  return Math.max(1, settings.maxBatchDraws);
}

/** 單次連抽的付費上限（元）= 單抽單價 × 連抽上限 */
function maxBatchAmount(settings) {
  return settings.drawPrice * settings.maxBatchDraws;
}

const fail = (code, message) => ({ ok: false, code, message });

/**
 * 付費抽號 count 次（1 ~ maxBatchDraws）。
 * 同一次共用 batchId；遇到 75 號抽完就停，只計實際次數。
 * 成功：{ ok:true, records, requested, drawn, game }
 * 失敗：INVALID_COUNT / EXCEEDS_BATCH_DRAWS / ALL_DRAWN
 */
function paidDraw(state, count, opts = {}) {
  const { settings } = state;
  if (!Number.isInteger(count) || count < 1) return fail('INVALID_COUNT', '次數需為 1 以上的整數');
  if (count > settings.maxBatchDraws) {
    return fail('EXCEEDS_BATCH_DRAWS', `單次最多連抽 ${settings.maxBatchDraws} 次`);
  }

  const now = opts.now ?? Date.now;
  const batchId = opts.batchId ?? `b${state.game.history.length + 1}-${now()}`;
  const records = [];
  let working = { settings, game: state.game };

  for (let i = 0; i < count; i++) {
    const res = drawOne(working, { ...opts, paid: true, batchId });
    if (!res.ok) {
      if (res.code === 'ALL_DRAWN' && records.length > 0) break; // 抽完為止
      return res;
    }
    records.push(res.record);
    working = { settings, game: res.game };
  }
  return { ok: true, records, requested: count, drawn: records.length, game: working.game };
}
return { maxBatchCount, maxBatchAmount, paidDraw };
})();

// ===== core/checker.js =====
M['core/checker'] = (() => {
const { NUMBER_MIN, NUMBER_MAX } = M['config/defaults'];
// 快速查驗：純函式、無 DOM

// 半形／全形句點、逗號、頓號、分號、空白皆可當分隔
const SEPARATORS = /[.．。,，、;；\s]+/;

const toHalfWidth = (s) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 解析 "5.12.33.68" → { valid:[5,12,33,68], invalid:[...] }（去除空值與重複，驗證 1~75） */
function parseNumbers(input) {
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
function checkNumbers(state, numbers) {
  const hits = state.game.history.filter((r) => r.type !== 'blank' && r.number != null);
  return numbers.map((number) => {
    const mine = hits.filter((r) => r.number === number);
    return { number, drawn: mine.length > 0, seq: mine.length ? mine[0].seq : null, count: mine.length };
  });
}
return { parseNumbers, checkNumbers };
})();

// ===== ui/check-view.js =====
M['ui/check-view'] = (() => {
const { getState, subscribe } = M['core/state'];
const { parseNumbers, checkNumbers } = M['core/checker'];
const { el } = M['utils/dom'];
// 🔍 驗卡：輸入 5 或 5.12.33.68，即時顯示每個號碼是否已抽中。
// createCheckPanel() 可重複建立：手機為分頁、電腦版也可在抽號頁以彈窗開啟（免離開抽號畫面）。

function createCheckPanel() {
  const input = el('input', {
    class: 'input check-input', type: 'text', inputMode: 'decimal', autocomplete: 'off',
    placeholder: '例如 5.12.33.68', 'aria-label': '要查驗的號碼',
    onInput: () => render(),
  });
  const clearBtn = el('button', {
    type: 'button', class: 'btn btn-secondary btn-small',
    onClick: () => { input.value = ''; render(); input.focus(); },
  }, '清除');
  const summary = el('p', { class: 'check-summary', 'aria-live': 'polite' });
  const list = el('ul', { class: 'check-list' });

  const node = el('div', { class: 'check-panel' },
    el('div', { class: 'check-form' }, input, clearBtn),
    el('p', { class: 'field-hint' }, '多個號碼用「.」分隔；賓果卡上的號碼可一次查多個。'),
    summary,
    list
  );

  function render() {
    const { valid, invalid } = parseNumbers(input.value);
    const results = checkNumbers(getState(), valid);
    const hit = results.filter((r) => r.drawn).length;

    if (results.length === 0 && invalid.length === 0) {
      summary.textContent = '';
      list.replaceChildren(el('li', { class: 'check-empty' }, '輸入號碼後會立即顯示結果'));
      return;
    }
    const parts = [];
    if (results.length) parts.push(`已抽中 ${hit}／${results.length}`);
    if (invalid.length) parts.push(`無效輸入 ${invalid.length}`);
    summary.textContent = parts.join('，');

    list.replaceChildren(
      ...results.map((r) =>
        el('li', { class: `check-row ${r.drawn ? 'is-hit' : 'is-miss'}` },
          el('span', { class: 'check-icon', 'aria-hidden': 'true' }, r.drawn ? '✅' : '❌'),
          el('strong', { class: 'check-num' }, `${r.number}`),
          el('span', { class: 'check-text' },
            r.drawn ? `已抽中（第 ${r.seq} 次${r.count > 1 ? `，重複出現 ${r.count} 次` : ''}）` : '未抽中'))
      ),
      ...invalid.map((token) =>
        el('li', { class: 'check-row is-invalid' },
          el('span', { class: 'check-icon', 'aria-hidden': 'true' }, '⚠'),
          el('strong', { class: 'check-num' }, token),
          el('span', { class: 'check-text' }, '無效輸入（需為 1~75 的整數）'))
      )
    );
  }

  const unsubscribe = subscribe(render); // 抽號／撤回後結果即時更新
  render();
  return { node, focus: () => input.focus(), destroy: unsubscribe };
}
return { createCheckPanel };
})();

// ===== core/receipt.js =====
M['core/receipt'] = (() => {
const { FINANCE } = M['config/defaults'];
const { settle, calcPoolBreakdown } = M['core/finance'];
const { calcPayouts, calcPayoutTotal } = M['core/ranks'];
const { drawnNumbers } = M['core/draw-engine'];
// 結算收據：純函式、無 DOM。只輸出「最終結果」，不含任何調降過程或警告。
// 金額守恆：總彩池 = 主持人辛苦費 + 前三名實發 + 安慰獎實發 + 零頭（零頭 = 其餘全部，歸主持人）。

/** 結束遊戲：只有進行中才能結束，回傳新的 game 欄位（由 UI 套用） */
function endGame(state) {
  if (state.game.status !== 'playing') return { ok: false, code: 'NOT_PLAYING', message: '遊戲尚未開始或已結束' };
  return { ok: true, game: { ...state.game, status: 'ended' } };
}

/**
 * 組出收據資料。
 * prizeLines：第 1～3 名各一列，status = 'declared'（有人得獎）| 'merged'（併入前一名次平分）| 'none'（無人得獎）。
 */
function buildReceipt(state) {
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
return { endGame, buildReceipt };
})();

// ===== ui/receipt-view.js =====
M['ui/receipt-view'] = (() => {
const { getState, setState, reset } = M['core/state'];
const { endGame, buildReceipt } = M['core/receipt'];
const { el, toast, confirmDialog } = M['utils/dom'];
const { formatMoney, formatNumber } = M['utils/format'];
// 🧾 本局結算收據（全螢幕）：結束遊戲流程、開新局。
// 只呈現最終結果；不顯示辛苦費或安慰獎被調降的過程，也不顯示任何警告。

let openOverlay = null;

const dateText = () => new Date().toLocaleString('zh-TW', { hour12: false });

const line = (label, value, cls = '') =>
  el('div', { class: `rc-row ${cls}` }, el('span', { class: 'rc-label' }, label), el('strong', { class: 'rc-value' }, value));

function prizeRow(l) {
  if (l.status === 'none') return line(`第 ${l.position} 名`, '無人得獎', 'is-none');
  if (l.status === 'merged') return line(`第 ${l.position} 名`, `併入第 ${l.mergedInto} 名平分`, 'is-none');
  const range = l.positions.length > 1 ? `（第 ${l.positions[0]}～${l.positions.at(-1)} 名獎金平分）` : '';
  const who = l.winners > 1 ? `${l.winners} 人 × ${formatMoney(l.perPerson)}` : formatMoney(l.perPerson);
  return line(`🏆 第 ${l.position} 名${range}`, who, 'is-prize');
}

/** 開啟（或重新開啟）全螢幕收據。只有已結束的局才可開啟 */
function openReceipt() {
  const state = getState();
  if (state.game.status !== 'ended') return;
  closeReceipt();
  document.querySelector('.celebrate')?.remove(); // 結束時若慶祝動畫還在播，先清掉避免蓋住收據
  const plain = !state.settings.prizeEnabled;
  const r = buildReceipt(state);
  const when = dateText();
  const previous = document.activeElement;

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    openOverlay = null;
    if (previous && previous.focus) previous.focus();
  };
  // 只在沒有其他彈窗時，Esc 才關閉收據
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) close(); };

  const onNewGame = async () => {
    const ok = await confirmDialog({
      title: '開新局？',
      message: '將清除本局所有設定與紀錄，回到初始狀態，此操作無法復原。建議先截圖或複製收據。',
      confirmText: '🔄 開新局',
      danger: true,
    });
    if (!ok) return;
    if (!(await MiniHub.requestNext())) return;
    close();
    reset();
    setState({ ui: { tab: 'settings' } });
    toast('已開新局');
  };

  const overlay = el('div', { class: 'receipt-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '本局結算收據' },
    el('div', { class: 'receipt-scroll' },
      el('article', { class: 'receipt' },
        el('h2', { class: 'rc-title' }, plain ? '🧧 本局結果' : '🧧 本局結算收據'),
        el('p', { class: 'rc-sub' }, plain ? `${when}｜抽號 ${formatNumber(r.drawCount)} 次` : `${when}｜參加 ${formatNumber(r.players)} 人｜抽號 ${formatNumber(r.drawCount)} 次`),
        plain ? el('section', { class: 'rc-sec' },
          el('h3', { class: 'rc-h' }, '名次'),
          ...(state.game.ranks.length
            ? state.game.ranks.map((k) => line(`🏆 第 ${k.rank} 名`, k.tieCount > 1 ? `同時 ${k.tieCount} 人` : '1 人', 'is-prize'))
            : [line('名次', '無人登錄', 'is-none')]),
          line('已抽出號碼', `${r.drawnCount} / 75`, 'is-sum')) : null,
        ...(plain ? [] : [
        el('section', { class: 'rc-sec' },
          el('div', { class: 'rc-total' }, el('span', {}, '總收入'), el('strong', {}, formatMoney(r.totalPool))),
          line('新卡', formatMoney(r.pool.newCards)),
          line('續卡', formatMoney(r.pool.renewCards)),
          line('付費抽號', formatMoney(r.pool.paidDraws))),

        el('section', { class: 'rc-sec' },
          el('h3', { class: 'rc-h' }, '前三名實領'),
          ...r.prizeLines.map(prizeRow),
          line('前三名合計', formatMoney(r.prizePaid), 'is-sum')),

        el('section', { class: 'rc-sec' },
          el('h3', { class: 'rc-h' }, '其他'),
          line(`安慰獎（${formatNumber(r.consolation.people)} 人 × ${formatMoney(r.consolation.unit)}）`, formatMoney(r.consolation.total)),
          line('主持人辛苦費', formatMoney(r.hostFee)),
          line('零頭', formatMoney(r.remainder)))]))),
    el('div', { class: 'receipt-actions' },
      el('button', { type: 'button', class: 'btn btn-danger-outline', onClick: onNewGame }, '🔄 開新局'),
      el('button', { type: 'button', class: 'btn btn-primary', onClick: close }, '關閉收據')));

  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  openOverlay = { close };
  overlay.querySelector('.receipt-actions .btn:last-child').focus();
}

function closeReceipt() {
  if (openOverlay) openOverlay.close();
}

/** 「結束遊戲」流程：二次確認 → status='ended' → 彈出收據 */
async function endGameFlow() {
  const ok = await confirmDialog({
    title: '結束遊戲？',
    message: getState().settings.prizeEnabled ? '結束後將進入結算並產生收據，之後無法再抽號或撤回，確定要結束本局嗎？' : '結束後將顯示本局結果，之後無法再抽號或撤回，確定要結束本局嗎？',
    confirmText: '🏁 結束遊戲',
    danger: true,
  });
  if (!ok) return;
  const result = endGame(getState());
  if (!result.ok) {
    toast(result.message, 'error');
    return;
  }
  setState({ game: result.game });
  openReceipt();
}
return { openReceipt, closeReceipt, endGameFlow };
})();

// ===== ui/draw-view.js =====
M['ui/draw-view'] = (() => {
const { getState, setState, subscribe } = M['core/state'];
const { drawnNumbers, appendRecords } = M['core/draw-engine'];
const { paidDraw, maxBatchCount, maxBatchAmount } = M['core/batch-draw'];
const { canDeclareRank, declareRank, nextRank, retractLastRank, coveredPositions } = M['core/ranks'];
const { NUMBER_MAX, FINANCE, BATCH_PLAY_INTERVAL_MS } = M['config/defaults'];
const { el, toast, confirmDialog, showModal } = M['utils/dom'];
const { formatMoney } = M['utils/format'];
const { createCheckPanel } = M['ui/check-view'];
const { endGameFlow } = M['ui/receipt-view'];
// 抽號卡：大號碼＋連抽（1～5 次；1 次直接顯示，2 次以上以懸浮視窗顯示）／撤回／名次登錄／結束遊戲＋最新 5 次走馬燈。
// DOM 只建立一次，之後由 state.subscribe 驅動更新（按鈕不會被重建，鍵盤焦點與遙控器操作不中斷）。

const KIND = {
  none: { caption: '尚未抽號', tag: '' },
  new: { caption: '新號碼', tag: '新號' },
  repeat: { caption: '重複號碼（無效）', tag: '重複' },
  blank: { caption: '銘謝惠顧（無號碼）', tag: '銘謝惠顧' },
};

const MESSAGES = {
  ALL_DRAWN: '號碼已全部抽出',
  NOT_PLAYING: '請先到設定頁開始遊戲',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 數字步進器：− N +，到達上下限時對應按鈕禁用 */
function createStepper({ min = 1, max = 10, value = 1, label, onChange }) {
  let current = value;
  const out = el('output', { class: 'stepper-value', 'aria-label': label });
  const minus = el('button', { type: 'button', 'aria-label': `${label}減一`, onClick: () => set(current - 1, true) }, '−');
  const plus = el('button', { type: 'button', 'aria-label': `${label}加一`, onClick: () => set(current + 1, true) }, '+');
  const node = el('div', { class: 'stepper' }, minus, out, plus);
  function set(n, notify = false) {
    current = Math.min(max, Math.max(min, n));
    out.textContent = String(current);
    minus.disabled = current <= min;
    plus.disabled = current >= max;
    if (notify && onChange) onChange(current);
  }
  set(current);
  return {
    node,
    get: () => current,
    set,
    setBounds(lo, hi) { min = lo; max = hi; set(current); },
    setDisabled(flag) { if (flag) { minus.disabled = true; plus.disabled = true; } else set(current); },
  };
}

/** 驗卡視窗（由「更多」選單開啟） */
function openCheckModal() {
  const panel = createCheckPanel();
  showModal({ title: '🔍 驗卡', content: panel.node, wide: true, actions: [{ text: '關閉', kind: 'primary' }], onClose: panel.destroy });
  panel.focus();
}

function initDrawView(root) {
  let prevLen = null; // 上次渲染時的 history 長度，用來判斷「剛抽出新的一筆」才播放動畫
  let busy = false; // 連抽播放中：鎖住所有抽號／名次／結束按鈕

  // ---- 大號碼區 ----
  const ball = el('div', { class: 'ball-xl', dataset: { kind: 'none' }, 'aria-live': 'polite', 'aria-atomic': 'true' });
  const stage = el('div', { class: 'stage' }, ball);
  const caption = el('p', { class: 'ball-caption-xl', dataset: { kind: 'none' } });
  const hint = el('p', { class: 'draw-hint' });
  // 空狀態：尚未開始時，直接提供前往設定頁的按鈕
  const gotoSettings = el('button', { type: 'button', class: 'btn btn-primary btn-block btn-goto', onClick: () => setState({ ui: { tab: 'settings' } }) }, '⚙️ 前往設定並開始遊戲');

  // ---- 連抽 ----
  const stepper = createStepper({ min: 1, max: 5, value: 1, label: '連抽次數', onChange: () => update() });
  const batchSub = el('small', { class: 'btn-sub' });
  const batchLabel = el('span', {});
  const batchBtn = el('button', { type: 'button', class: 'btn btn-gold btn-batch', onClick: onBatch }, batchLabel, batchSub);

  // ---- 其他操作 ----
  const rankBtn = el('button', { type: 'button', class: 'btn btn-primary btn-tool', onClick: onRankBtn });

  root.replaceChildren(
    el('div', { class: 'draw-panel' },
      el('div', { class: 'draw-topbar' }, rankBtn),
      stage,
      caption,
      gotoSettings,
      el('div', { class: 'batch-row' }, stepper.node, batchBtn),
      hint
    )
  );

  // ---------- 動作 ----------

  function apply(result) {
    if (!result.ok) {
      toast(MESSAGES[result.code] ?? result.message, 'error');
      return false;
    }
    setState({ game: result.game });
    return true;
  }

  function run(action) {
    if (busy) return;
    apply(action());
  }

  /** 一筆抽號結果的小卡（連抽視窗用） */
  function resultChip(record, isLast) {
    return el('div', { class: `chip chip-${record.type} is-fresh${isLast ? ' is-newest' : ''}`, role: 'listitem' },
      el('span', { class: 'chip-num' }, record.type === 'blank' ? '🙏' : `${record.number}`),
      el('span', { class: 'chip-tag' }, KIND[record.type].tag));
  }

  /**
   * 連抽：先一次算出結果，再每 0.8 秒套用一筆（每一步的 state 都一致，彩池逐筆增加）。
   * 同時開啟懸浮視窗，逐筆顯示本次所有抽出內容；抽完後按「確定」關閉，次數恢復為 1。
   */
  async function onBatch() {
    if (busy) return;
    const result = paidDraw(getState(), stepper.get());
    if (!result.ok) {
      toast(MESSAGES[result.code] ?? result.message, 'error');
      return;
    }
    // 連抽 1 次：直接更新大號碼與最新 5 次，不開全螢幕視窗
    if (result.requested === 1) {
      apply({ ok: true, game: result.game });
      stepper.set(1);
      update();
      return;
    }

    busy = true;
    update();

    const total = result.records.length;
    const price = getState().settings.drawPrice;
    const prizeOn = getState().settings.prizeEnabled;
    const grid = el('div', { class: 'batch-results', role: 'list', 'aria-label': '本次連抽結果' },
      ...Array.from({ length: total }, () => el('div', { class: 'chip is-empty', role: 'listitem' })));
    grid.style.setProperty('--n', String(total));
    const summary = el('p', { class: 'batch-summary', 'aria-live': 'polite' }, `連抽 ${total} 次，抽號中…`);
    const modal = showModal({ title: `🎰 連抽 ${total} 次`, content: el('div', { class: 'batch-modal' }, grid, summary), actions: [{ text: '確定', kind: 'primary' }] });
    const overlay = grid.closest('.modal-overlay');
    overlay.classList.add('batch-overlay');
    overlay.querySelector('.modal').classList.add('modal-batch');
    const okBtn = overlay.querySelector('.modal-actions .btn');
    if (okBtn) okBtn.disabled = true;

    const startLen = getState().game.history.length;
    let shown = 0;
    try {
      for (let i = 0; i < total; i++) {
        if (i > 0) await sleep(BATCH_PLAY_INTERVAL_MS);
        const { game } = getState();
        // 播放期間若局面被改動（例如在設定頁重新開始），就中止，避免寫入錯誤的紀錄
        if (game.status !== 'playing' || game.history.length !== startLen + i) break;
        setState({ game: appendRecords(game, [result.records[i]]) });
        grid.children[i].replaceWith(resultChip(result.records[i], i === total - 1));
        shown = i + 1;
      }
    } finally {
      busy = false;
      stepper.set(1); // 每次連抽結束，次數恢復為 1
      update();
    }

    const shownRecords = result.records.slice(0, shown);
    const count = (type) => shownRecords.filter((r) => r.type === type).length;
    const parts = [prizeOn ? `共 ${shown} 次・${formatMoney(shown * price)}` : `共 ${shown} 次`, `新號 ${count('new')}`];
    if (count('repeat')) parts.push(`重複 ${count('repeat')}`);
    if (count('blank')) parts.push(`銘謝惠顧 ${count('blank')}`);
    summary.textContent = parts.join('・');
    if (okBtn) { okBtn.disabled = false; okBtn.focus(); }
    if (result.drawn < result.requested) toast(`號碼已抽完，實際抽出 ${result.drawn} 次`);
    return modal;
  }

  /** 前三名全部登錄後，按鈕變為「結束遊戲」（需確認）；否則開啟名次登錄視窗 */
  function onRankBtn() {
    if (busy) return;
    const { game } = getState();
    if (game.status === 'playing' && coveredPositions(game.ranks) >= FINANCE.prizeRankCount) {
      endGameFlow();
      return;
    }
    openRankDialog();
  }

  function openRankDialog() {
    if (busy) return;
    const state = getState();
    const rank = nextRank(state);
    const canDeclare = canDeclareRank(state);
    const maxTie = state.settings.prizeEnabled ? Math.max(1, state.settings.players) : 99;
    const tie = createStepper({ min: 1, max: maxTie, value: 1, label: '同時賓果人數', onChange: () => refreshNote() });
    const note = el('p', { class: 'field-hint' });
    const refreshNote = () => {
      const n = tie.get();
      const last = Math.min(FINANCE.prizeRankCount, rank + n - 1);
      note.textContent = n > 1 && last > rank
        ? `${n} 人同時賓果：第 ${rank}～${last} 名獎金合併後 ${n} 人平分，下一個名次為第 ${rank + n} 名。`
        : n > 1 ? `${n} 人同時賓果，平分第 ${rank} 名獎金。` : '只有 1 人賓果時維持 1。';
    };
    refreshNote();

    const registered = state.game.ranks;
    const content = el('div', { class: 'rank-dialog' },
      registered.length
        ? el('ul', { class: 'rank-registered' }, ...registered.map((r) =>
            el('li', {}, `第 ${r.rank} 名已登錄${r.tieCount > 1 ? `（同時 ${r.tieCount} 人）` : ''}・第 ${r.atSeq} 次抽號`)))
        : null,
      canDeclare
        ? el('div', {}, el('p', { class: 'field-label' }, `第 ${rank} 名・同時賓果人數`), tie.node, note)
        : el('p', { class: 'field-error' }, declareRank(state).message ?? '目前無法登錄名次'),
      registered.length
        ? el('button', { type: 'button', class: 'btn btn-danger-outline btn-block', style: 'margin-top:12px',
            onClick: async () => {
              modal.close();
              const last = getState().game.ranks.at(-1);
              const ok = await confirmDialog({ title: '取消名次登錄？', message: `將取消第 ${last.rank} 名的登錄。`, confirmText: '取消登錄', danger: true });
              if (ok) apply(retractLastRank(getState()));
            } }, `取消上一個名次登錄（第 ${registered.at(-1).rank} 名）`)
        : null
    );
    const actions = [{ text: canDeclare ? '取消' : '關閉', kind: 'secondary' }];
    if (canDeclare) {
      actions.push({
        text: `🎉 登錄第 ${rank} 名`, kind: 'primary',
        onClick: () => {
          if (apply(declareRank(getState(), { tieCount: tie.get() }))) {
            toast(`第 ${rank} 名已登錄${tie.get() > 1 ? `（同時 ${tie.get()} 人）` : ''}`);
            return true;
          }
          return false;
        },
      });
    }
    const modal = showModal({ title: `🎉 第 ${rank} 名賓果`, content, actions });
  }

  // ---------- 畫面更新 ----------

  function fillBall(last) {
    const kind = last ? last.type : 'none';
    ball.dataset.kind = kind;
    caption.dataset.kind = kind;
    caption.textContent = KIND[kind].caption;
    if (!last) {
      ball.replaceChildren(el('span', { class: 'ball-num' }, '—'));
    } else if (last.type === 'blank') {
      ball.replaceChildren(el('span', { class: 'ball-word' }, '銘謝', el('br'), '惠顧'));
    } else {
      ball.replaceChildren(
        el('span', { class: 'ball-num' }, String(last.number))
      );
    }
  }

  function update() {
    const state = getState();
    const { settings, game } = state;
    const history = game.history;
    const last = history[history.length - 1];
    const fresh = prevLen !== null && history.length > prevLen;

    // 大號碼：只有「抽出新的一筆」才重播彈出動畫
    fillBall(last);
    if (fresh) {
      ball.classList.remove('is-pop');
      void ball.offsetWidth; // 重新觸發動畫
      ball.classList.add('is-pop');
    }

    const playing = game.status === 'playing';
    const allDrawn = drawnNumbers(history).size >= NUMBER_MAX;
    const canDraw = playing && !allDrawn && !busy;

    // 連抽
    const maxCount = maxBatchCount(settings);
    stepper.setBounds(1, maxCount);
    const n = stepper.get();
    const amount = n * settings.drawPrice;
    const overLimit = n > settings.maxBatchDraws;
    batchLabel.textContent = `🎰 連抽 ${n} 次`;
    batchSub.textContent = settings.prizeEnabled ? `${formatMoney(amount)}（上限為 ${formatMoney(maxBatchAmount(settings))}）` : `一次最多 ${maxCount} 次`;
    batchBtn.disabled = !canDraw || overLimit;
    if (busy || !playing) stepper.setDisabled(true);

    // 名次、結束
    const rankFull = coveredPositions(game.ranks) >= FINANCE.prizeRankCount;
    rankBtn.textContent = rankFull && playing ? '🏁 結束遊戲' : rankFull ? '🎉 名次已登錄完' : `🎉 第 ${nextRank(state)} 名賓果`;
    rankBtn.disabled = !playing || busy || (game.ranks.length === 0 && !canDeclareRank(state));
    const ended = game.status === 'ended';

    hint.textContent = ended ? '本局已結束，可查看結算收據或到設定頁開新局' : !playing ? MESSAGES.NOT_PLAYING : busy ? '連抽播放中，請稍候…' : allDrawn ? MESSAGES.ALL_DRAWN : '';
    hint.classList.toggle('is-warn', allDrawn && playing && !busy);
    gotoSettings.hidden = playing || ended;

    prevLen = history.length;
  }

  update();
  subscribe(update);
}
return { openCheckModal, initDrawView };
})();

// ===== ui/ticker-view.js =====
M['ui/ticker-view'] = (() => {
const { getState, subscribe } = M['core/state'];
const { TICKER_SIZE } = M['config/defaults'];
const { el } = M['utils/dom'];
// 最新 5 次走馬燈：獨立成一個區塊（手機排在抽號卡下方；電腦版在獎金池與抽號卡的底下）。
// 固定 5 格避免版面跳動；只有「剛抽出新的一筆」最新那格才播放進場動畫。

const TAG = { new: '新號', repeat: '重複', blank: '銘謝惠顧' };

function initTickerView(root) {
  let prevLen = null;
  const slots = Array.from({ length: TICKER_SIZE }, () => el('div', { class: 'chip is-empty' }));
  const ticker = el('div', { class: 'ticker', role: 'list', 'aria-label': `最新 ${TICKER_SIZE} 次抽號` }, ...slots);
  root.replaceChildren(el('div', { class: 'ticker-wrap ticker-card' }, el('p', { class: 'ticker-title' }, `最新 ${TICKER_SIZE} 次`), ticker));

  function chipFor(record, isNewest, fresh) {
    return el('div', {
      class: `chip chip-${record.type}${isNewest ? ' is-newest' : ''}${isNewest && fresh ? ' is-fresh' : ''}`,
      role: 'listitem',
    },
      el('span', { class: 'chip-num' }, record.type === 'blank' ? '🙏' : `${record.number}`),
      el('span', { class: 'chip-tag' }, TAG[record.type])
    );
  }

  function update() {
    const history = getState().game.history;
    const fresh = prevLen !== null && history.length > prevLen;
    const recent = history.slice(-TICKER_SIZE).reverse(); // 最新在最左
    slots.forEach((slot, i) => {
      const record = recent[i];
      const next = record ? chipFor(record, i === 0, fresh) : el('div', { class: 'chip is-empty' });
      slot.replaceWith(next);
      slots[i] = next;
    });
    prevLen = history.length;
  }
  update();
  subscribe(update);
}
return { initTickerView };
})();

// ===== ui/prize-view.js =====
M['ui/prize-view'] = (() => {
const { getState, subscribe } = M['core/state'];
const { settle, calcPoolBreakdown } = M['core/finance'];
const { isConsolationVisible, rankSlots } = M['core/ranks'];
const { drawnNumbers } = M['core/draw-engine'];
const { NUMBER_MAX } = M['config/defaults'];
const { el } = M['utils/dom'];
const { formatMoney, formatNumber } = M['utils/format'];
// 🏆 獎金池（手機分頁與電腦左欄共用同一份邏輯）：
// 總彩池（新卡／續卡／付費抽分項）、前三名預估獎金、已出爐名次；第 2 名登錄後才顯示安慰獎。
// 遊戲中不顯示主持人辛苦費與零頭，也不顯示任何調降或警告訊息。

const row = (label, value, cls = '') =>
  el('div', { class: `pr-row ${cls}` }, el('span', { class: 'pr-label' }, label), el('strong', { class: 'pr-value' }, value));

function slotRow(slot) {
  if (slot.status === 'declared') {
    const tie = slot.winners > 1 ? `（同時 ${slot.winners} 人）` : '';
    return row(`🎉 第 ${slot.position} 名已出爐${tie}`, `${slot.winners > 1 ? '各 ' : ''}${formatMoney(slot.perPerson)}`, 'is-declared');
  }
  if (slot.status === 'merged') {
    return row(`第 ${slot.position} 名`, `併入第 ${slot.mergedInto} 名平分`, 'is-merged');
  }
  return row(`第 ${slot.position} 名`, `預估 ${formatMoney(slot.estimate)}`);
}

function initPrizeView(root) {
  /** 獎金關閉：只顯示名次與抽號進度，沒有任何金額 */
  function renderPlain(state) {
    const { game } = state;
    const rows = [];
    let pos = 1;
    for (const r of game.ranks) {
      rows.push(row(`🎉 第 ${r.rank} 名已出爐`, r.tieCount > 1 ? `同時 ${r.tieCount} 人` : '已登錄', 'is-declared'));
      pos = r.rank + r.tieCount;
    }
    for (; pos <= 3; pos++) rows.push(row(`第 ${pos} 名`, '尚未出爐'));
    root.replaceChildren(
      el('div', { class: 'card prize-card' },
        el('h2', { class: 'card-title' }, '🎯 抽獎進度'),
        el('div', { class: 'pool-main' },
          el('p', { class: 'pool-label' }, '已抽出'),
          el('p', { class: 'pool-amount pool-amount-xl', 'aria-live': 'polite' }, `${drawnNumbers(game.history).size} / ${NUMBER_MAX}`)),
        el('h3', { class: 'sub-title' }, '名次'),
        el('div', { class: 'pr-group' }, ...rows),
        el('div', { class: 'pr-group pr-foot' }, row('抽號次數', `${formatNumber(game.history.length)} 次`))));
  }

  function render() {
    const state = getState();
    const { settings, game } = state;
    if (!settings.prizeEnabled) { renderPlain(state); return; }
    const pool = calcPoolBreakdown(state);
    const settlement = settle(state);
    const slots = rankSlots(state, settlement);

    root.replaceChildren(
      el('div', { class: 'card prize-card' },
        el('h2', { class: 'card-title' }, '🏆 獎金池'),
        el('div', { class: 'pool-main' },
          el('p', { class: 'pool-label' }, '總彩池'),
          el('p', { class: 'pool-amount pool-amount-xl', 'aria-live': 'polite' }, formatMoney(pool.total))
        ),
        el('div', { class: 'pr-group' },
          row(`新卡 ${formatNumber(settings.newCardCount)} 張`, formatMoney(pool.newCards)),
          row(`續卡 ${formatNumber(settings.renewCardCount)} 張`, formatMoney(pool.renewCards)),
          row(`付費抽號 ${formatNumber(game.paidDrawCount)} 次`, formatMoney(pool.paidDraws))
        ),
        el('h3', { class: 'sub-title' }, '前三名獎金'),
        el('div', { class: 'pr-group' }, ...slots.map(slotRow)),
        isConsolationVisible(state)
          ? el('div', {},
              el('h3', { class: 'sub-title' }, '安慰獎'),
              el('div', { class: 'pr-group' },
                row('每人', formatMoney(settlement.consolationUnitUsed)),
                row('人數', `${formatNumber(settlement.unrankedPlayers)} 人`)))
          : null,
        el('div', { class: 'pr-group pr-foot' }, row('已抽出', `${drawnNumbers(game.history).size} / ${NUMBER_MAX}`))
      )
    );
  }
  render();
  subscribe(render);
}
return { initPrizeView };
})();

// ===== ui/board-view.js =====
M['ui/board-view'] = (() => {
const { getState, subscribe } = M['core/state'];
const { drawnNumbers } = M['core/draw-engine'];
const { BOARD_COLUMNS, NUMBER_MAX } = M['config/defaults'];
const { el } = M['utils/dom'];
// 1~75 矩陣：B1-15、I16-30、N31-45、G46-60、O61-75（欄位由上往下排列）
// 只建立一次 DOM，之後由 state 更新 class，不重建（避免閃爍、保留動畫）。

function initBoardView(root) {
  const cells = new Map(); // 號碼 → 格子元素
  const rows = BOARD_COLUMNS[0].max - BOARD_COLUMNS[0].min + 1;

  const body = [];
  for (let r = 0; r < rows; r++) {
    for (const c of BOARD_COLUMNS) {
      const n = c.min + r;
      const cell = el('div', { class: 'board-cell', dataset: { n: String(n) } }, String(n));
      cells.set(n, cell);
      body.push(cell);
    }
  }

  const count = el('span', { class: 'board-count' });
  let prevLen = null; // 上次的 history 長度：只有「剛抽出新的一筆」才播放閃爍

  root.replaceChildren(
    el('div', { class: 'board-wrap' },
      el('h2', { class: 'board-title' }, '號碼矩陣', count),
      el('div', { class: 'board', role: 'grid', 'aria-label': '1 到 75 號碼矩陣' }, ...body)
    )
  );

  function update() {
    const { history } = getState().game;
    const drawn = drawnNumbers(history);
    const last = history[history.length - 1];
    const fresh = prevLen !== null && history.length > prevLen;
    prevLen = history.length;
    count.textContent = `已抽 ${drawn.size} / ${NUMBER_MAX}`;
    for (const [n, cell] of cells) {
      cell.classList.toggle('is-drawn', drawn.has(n));
      // 最新一顆（新號）高亮；最新是重複號碼時，該格改用較淡的提示框
      cell.classList.toggle('is-latest', !!last && last.type === 'new' && last.number === n);
      cell.classList.toggle('is-repeat', !!last && last.type === 'repeat' && last.number === n);
      if (fresh && last && last.number === n && last.type !== 'blank') {
        cell.classList.remove('is-flash');
        void cell.offsetWidth; // 重新觸發動畫
        cell.classList.add('is-flash');
      } else if (!last || last.number !== n) {
        cell.classList.remove('is-flash'); // 不是目前這一顆就清掉，撤回後不會誤重播
      }
    }
  }

  update();
  subscribe(update);
}
return { initBoardView };
})();

// ===== ui/effects.js =====
M['ui/effects'] = (() => {
const { getState, setState, subscribe } = M['core/state'];
const sound = window.GameAudio;
const { el, toast } = M['utils/dom'];
// 氣氛層（階段 6）：頂部音效開關、依 state 變化播放音效、賓果慶祝動畫。
// 設計：只「訂閱」state 並比對前後差異，不介入 draw-view 的操作流程，也不修改 core。
//   抽出新的一筆 → 滾動聲 ＋ 結果音效
//   history 變短  → 撤回提示音
//   登錄名次      → 賓果慶祝音 ＋ 紅包彩帶動畫

const CONFETTI_COUNT = 36;
const ENVELOPE_COUNT = 8;
const CELEBRATE_MS = 4200;
const CELEBRATE_REDUCED_MS = 2200;
const ROLL_SECONDS = 0.3; // 滾動聲長度，結果音效排在其後

/**
 * 純函式：比對前後狀態，回傳要觸發的事件清單（可在 Node 測試）。
 * 事件：{type:'draw', record} | {type:'undo'} | {type:'reset'} | {type:'rank', rank, tieCount} | {type:'rankRetract'}
 */
function diffEvents(prev, next) {
  const events = [];
  const ph = prev.game.history.length;
  const nh = next.game.history.length;
  if (nh > ph) {
    events.push({ type: 'draw', record: next.game.history[nh - 1] });
  } else if (nh < ph) {
    events.push({ type: next.game.status === 'playing' ? 'undo' : 'reset' });
  }
  const pr = prev.game.ranks.length;
  const nr = next.game.ranks.length;
  if (nr > pr && nh >= ph) {
    const r = next.game.ranks[nr - 1];
    events.push({ type: 'rank', rank: r.rank, tieCount: r.tieCount });
  } else if (nr < pr && nh >= ph) {
    events.push({ type: 'rankRetract' });
  }
  return events;
}

function snapshot(state) {
  return { game: { history: state.game.history, ranks: state.game.ranks, status: state.game.status } };
}

function prefersReducedMotion() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function initEffects({ soundBtn }) {
  // 不支援的功能直接隱藏開關，不報錯
  if (!sound.isSupported()) soundBtn.hidden = true;

  // ---- 開關按鈕 ----
  function paintToggle(btn, name, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${name}：${on ? '開啟，點擊關閉' : '關閉，點擊開啟'}`);
    btn.dataset.on = String(on);
    btn.replaceChildren(
      el('span', { class: 'hdr-icon', 'aria-hidden': 'true' }, on ? '🔊' : '🔇'),
      el('span', { class: 'hdr-text' }, name)
    );
  }

  soundBtn.addEventListener('click', () => {
    const want = !getState().ui.soundOn;
    if (want) {
      // 必須在這個 click 手勢內同步建立並 resume AudioContext
      if (!sound.setEnabled(true)) {
        toast('這個瀏覽器無法啟用音效', 'error');
        return;
      }
      sound.play('new'); // 開啟時的試聽
    } else {
      sound.setEnabled(false);
    }
    setState({ ui: { soundOn: want } });
  });

  // ---- 依 state 變化觸發 ----
  let prev = snapshot(getState());

  function onState(state) {
    paintToggle(soundBtn, '音效', state.ui.soundOn);
    // state 與引擎不同步時（例如重新載入）以 state 為準
    if (!state.ui.soundOn && sound.isEnabled()) sound.setEnabled(false);

    const events = diffEvents(prev, snapshot(state));
    prev = snapshot(state);
    for (const e of events) handle(e);
  }

  function handle(e) {
    switch (e.type) {
      case 'draw': {
        const kind = e.record.type;
        sound.play('roll');
        sound.play(kind, { delay: ROLL_SECONDS });
        break;
      }
      case 'undo':
        sound.play('undo');
        break;
      case 'rankRetract':
        sound.play('undo');
        break;
      case 'rank':
        sound.play('bingo');
        celebrate(e.rank, e.tieCount);
        break;
    }
  }

  onState(getState());
  subscribe(onState);
}

// ---- 賓果慶祝：CSS 紅包與彩帶 ----
let celebrateTimer = null;

function celebrate(rank, tieCount = 1) {
  document.querySelector('.celebrate')?.remove();
  clearTimeout(celebrateTimer);

  const reduce = prefersReducedMotion();
  const banner = el('div', { class: 'celebrate-banner', role: 'status' },
    el('strong', {}, `🎉 第 ${rank} 名賓果！`),
    tieCount > 1 ? el('small', {}, `同時 ${tieCount} 人`) : null
  );
  const layer = el('div', { class: `celebrate${reduce ? ' is-static' : ''}` }, banner);

  if (!reduce) {
    const rand = (min, max) => min + Math.random() * (max - min);
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const piece = el('i', { class: `confetti c${i % 5}`, 'aria-hidden': 'true' });
      piece.style.setProperty('--x', `${rand(2, 98).toFixed(1)}vw`);
      piece.style.setProperty('--delay', `${rand(0, 1.2).toFixed(2)}s`);
      piece.style.setProperty('--dur', `${rand(2.4, 3.6).toFixed(2)}s`);
      piece.style.setProperty('--rot', `${Math.round(rand(360, 1080))}deg`);
      layer.append(piece);
    }
    for (let i = 0; i < ENVELOPE_COUNT; i++) {
      const env = el('span', { class: 'envelope', 'aria-hidden': 'true' }, '🧧');
      env.style.setProperty('--x', `${rand(4, 92).toFixed(1)}vw`);
      env.style.setProperty('--delay', `${rand(0, 1.4).toFixed(2)}s`);
      env.style.setProperty('--dur', `${rand(2.8, 3.8).toFixed(2)}s`);
      layer.append(env);
    }
  }

  document.body.append(layer);
  celebrateTimer = setTimeout(() => layer.remove(), reduce ? CELEBRATE_REDUCED_MS : CELEBRATE_MS);
}
return { diffEvents, prefersReducedMotion, initEffects, celebrate };
})();

// ===== ui/more-menu.js =====
M['ui/more-menu'] = (() => {
const { getState, setState } = M['core/state'];
const { el, showModal } = M['utils/dom'];
const { endGameFlow, openReceipt } = M['ui/receipt-view'];
const { openCheckModal } = M['ui/draw-view'];
// 電腦版：標題列移除後，在獎金池上方顯示「兵果彩盤」＋「更多」按鈕；
// 更多選單依序：規則、驗卡、音效、設定、結束遊戲（結束遊戲有確認視窗，見 endGameFlow）。

const $ = (id) => document.getElementById(id);

function openMoreMenu() {
  const st = getState();
  const { tab } = st.ui;
  const status = st.game.status;
  let modal = null;

  const item = (icon, text, onClick, { keepOpen = false, disabled = false, hidden = false } = {}) => {
    if (hidden) return null;
    const label = el('span', {}, text);
    const btn = el('button', {
      type: 'button', class: 'btn btn-secondary more-item', disabled,
      onClick: () => {
        if (!keepOpen) modal.close();
        const res = onClick(label, iconEl);
        if (res && res.then) res.catch(() => {});
      },
    });
    const iconEl = el('span', { class: 'more-icon', 'aria-hidden': 'true' }, icon);
    btn.append(iconEl, label);
    return btn;
  };

  // 開關類：直接觸發標題列既有按鈕（沿用 effects.js 的全部邏輯），再依其狀態更新文字
  const toggleItem = (btnId, name) => {
    const src = $(btnId);
    if (!src || src.hidden) return null;
    const paint = (label, icon) => {
      const on = src.dataset.on === 'true';
      label.textContent = `${name}：${on ? '開啟（點擊關閉）' : '關閉（點擊開啟）'}`;
      icon.textContent = on ? '🔊' : '🔇';
    };
    const node = item(src.dataset.on === 'true' ? '🔊' : '🔇', '', (label, icon) => { src.click(); paint(label, icon); }, { keepOpen: true });
    paint(node.querySelector('span:last-child'), node.querySelector('.more-icon'));
    return node;
  };

  const content = el('div', { class: 'more-list' },
    item('🏠', '回大廳', () => { window.location.href = '../index.html'; }),
    item('❓', '規則', () => $('rules-btn').click()),
    item('🔍', '驗卡', () => openCheckModal()),
    toggleItem('sound-btn', '音效'),
    item(tab === 'settings' ? '🎲' : '⚙️', tab === 'settings' ? '回到抽號卡' : '設定', () => $('settings-btn').click()),
    item('🏁', status === 'ended' ? '查看結算收據' : '結束遊戲', () => (status === 'ended' ? openReceipt() : endGameFlow()), { disabled: status === 'setup' })
  );
  modal = showModal({ title: '更多', content, actions: [{ text: '關閉', kind: 'secondary' }] });
}

/** 房間資訊（房號＋名稱）：房號來自網址 ?room=，名稱向房間目錄查詢；點一下複製房號 */
let roomInfoPromise = null;
function loadRoomInfo() {
  const R = window.BingoRoom;
  if (!R) return null;
  const id = R.readParams().room;
  if (!id) return null;
  if (!roomInfoPromise) roomInfoPromise = R.directory.get(id).then((r) => ({ id, name: r && r.name ? r.name : '' }), () => ({ id, name: '' }));
  return { id, promise: roomInfoPromise };
}

function createRoomChip() {
  const info = loadRoomInfo();
  if (!info) return null;
  const nameEl = el('span', { class: 'room-name' }, '');
  const tagEl = el('span', { class: 'room-tag' }, '房號');
  const idEl = el('span', { class: 'room-id' }, info.id);
  const chip = el('button', { type: 'button', class: 'room-chip', title: '點一下複製房號', 'aria-label': `房號 ${info.id}，點一下複製` }, tagEl, idEl, nameEl);
  chip.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(info.id); } catch { return; }
    tagEl.textContent = '已複製';
    chip.classList.add('copied');
    setTimeout(() => { tagEl.textContent = '房號'; chip.classList.remove('copied'); }, 1200);
  });
  info.promise.then((r) => {
    nameEl.textContent = r.name;
    nameEl.title = r.name;
    chip.classList.toggle('has-name', !!r.name);
  });
  return chip;
}

/** 建立頂端標題列：品牌＋狀態　｜　房間資訊　｜　（返回）＋更多（電腦版專用，手機版以 CSS 隱藏） */
function createDeskBrand({ back = false } = {}) {
  return el('div', { class: 'desk-brand' },
    el('div', { class: 'desk-brand-main' },
      el('span', { class: 'desk-brand-title' }, '🧧 兵果彩盤'),
      el('span', { class: 'status-badge', dataset: { status: 'setup' } }, '設定中')),
    createRoomChip(),
    el('div', { class: 'desk-actions' },
      back ? el('button', { type: 'button', class: 'btn btn-gold desk-back', onClick: () => setState({ ui: { tab: 'draw' } }) }, '← 返回抽號') : null,
      el('button', { type: 'button', class: 'btn btn-primary desk-more', onClick: openMoreMenu, 'aria-haspopup': 'dialog' }, '☰ 更多')));
}
return { createDeskBrand };
})();

// ===== core/cloud-save.js =====
M['core/cloud-save'] = (() => {
const { getState, setState, subscribe } = M['core/state'];
const { DEFAULT_SETTINGS } = M['config/defaults'];
const { toast, confirmDialog } = M['utils/dom'];
// 主持端雲端同步：登入後，遊戲進行中的設定、全部抽號紀錄與名次宣告會同步到 Firestore（games/bingo-lobby/saves/{uid}）。
// 重新登入、重新整理後進入同一間房，會自動還原上次的進度；結束遊戲、開新局或刪除房間會清除。
// 只有「主持」角色會同步（旁觀不讀不寫）。單筆上限 20000 字元，所以紀錄做精簡。

const TYPES = ['new', 'repeat', 'blank'];
const cloud = window.MiniHub && MiniHub.cloud ? MiniHub.cloud('bingo-lobby') : null;
let cloudUid = '';   // 已完成讀取（才允許寫入）的帳號
let busy = false;
let hasRemote = false;   // 雲端目前是否有進行中的存檔
let applying = false;
let roomId = '';

const myUid = () => { try { return MiniHub.player().uid || ''; } catch { return ''; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pack(state) {
  const { settings, game } = state;
  const s = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (!same(settings[k], DEFAULT_SETTINGS[k])) s[k] = settings[k];
  const batches = [];
  const t0 = game.history.length ? game.history[0].ts : 0;
  const h = game.history.map((r) => {
    let b = -1;
    if (r.batchId != null) { b = batches.indexOf(r.batchId); if (b < 0) b = batches.push(r.batchId) - 1; }
    return [TYPES.indexOf(r.type), r.number, r.paid ? 1 : 0, b, r.ts - t0];
  });
  return { v: 1, playing: true, room: roomId, t0, s, h, b: batches, r: game.ranks };
}

function unpack(d) {
  if (!d || d.v !== 1 || d.playing !== true || !Array.isArray(d.h)) return null;
  if (d.room !== roomId) return null;   // 不是這間房的進度
  const settings = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const def = DEFAULT_SETTINGS[k];
    const v = d.s && k in d.s ? d.s[k] : def;
    const ok = Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v));
    settings[k] = ok ? v : def;
  }
  settings.locked = true;
  const batches = Array.isArray(d.b) ? d.b : [];
  const t0 = Number(d.t0) || 0;
  const history = [];
  for (const row of d.h) {
    if (!Array.isArray(row)) return null;
    const type = TYPES[row[0]];
    if (!type) return null;
    const seq = history.length + 1;
    history.push({ id: `d${seq}`, seq, type, number: type === 'blank' ? null : row[1], paid: row[2] === 1, batchId: row[3] >= 0 ? batches[row[3]] ?? null : null, ts: t0 + row[4] });
  }
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].type !== 'new'; i--) streak++;
  const ranks = Array.isArray(d.r) ? d.r : [];
  return {
    settings,
    game: { status: 'playing', history, paidDrawCount: history.filter((r) => r.paid).length, invalidStreak: streak, ranks },
  };
}

function queueSave() {
  if (!cloud || !cloudUid || cloudUid !== myUid() || applying) return;
  const st = getState();
  if (st.game.status === 'playing') { hasRemote = true; cloud.save(pack(st)); }
  else if (hasRemote) { hasRemote = false; cloud.save({ v: 1, playing: false }); cloud.flush(); }   // 結束／開新局：清除存檔
}

async function syncCloud() {
  if (!cloud) return;
  const uid = myUid();
  if (!uid) { cloudUid = ''; hasRemote = false; return; }
  if (uid === cloudUid || busy) return;
  busy = true;
  try {
    const r = await cloud.load();
    if (!r.ok) return;   // 讀取失敗：不寫入，避免覆蓋雲端資料
    const restored = unpack(r.data);
    hasRemote = !!(r.data && r.data.playing === true && r.data.room === roomId);
    if (restored) {
      const local = getState().game.status;
      const take = local !== 'playing' || await confirmDialog({
        title: '載入雲端進度？',
        message: '偵測到這間房間上次進行中的抽號紀錄，要載入嗎？目前畫面上的進行中資料會被取代。',
        confirmText: '載入',
      });
      if (take) {
        applying = true;
        try { setState({ settings: restored.settings, game: restored.game, ui: { tab: 'draw' } }); } finally { applying = false; }
        toast('已還原上次的抽號進度');
      }
    }
    cloudUid = uid;
    queueSave();
  } finally { busy = false; }
}

function initCloudSave(room) {
  if (!cloud || !room) return;
  roomId = room;
  subscribe(queueSave);
  MiniHub.onChange(syncCloud);
  syncCloud();
  addEventListener('pagehide', () => cloud.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloud.flush(); });
}
return { initCloudSave };
})();

// ===== core/spectate.js =====
M['core/spectate'] = (() => {
const { getState, subscribe } = M['core/state'];
const { calcTotalPool } = M['core/finance'];
// 旁觀公開資料：主持人端把「可公開」的內容送給旁觀頁（同瀏覽器走 BroadcastChannel、跨裝置走 Firestore live 文件）。
// 不含：設定、卡片數量、保底金額、辛苦費；獎金池總額只有在主持人開啟「旁觀者顯示獎金池」時才會寫入。
const CLOUD_DELAY_MS = 1200;
const TYPE_CODE = { new: 0, repeat: 1, blank: 2 };

function snapshot(room) {
  const state = getState();
  const { settings: s, game: g } = state;
  const drawn = [];
  const seen = new Set();
  for (const r of g.history) if (r.type === 'new' && r.number != null && !seen.has(r.number)) { seen.add(r.number); drawn.push(r.number); }
  const row = (r) => [TYPE_CODE[r.type] ?? 2, r.number];
  const last = g.history[g.history.length - 1];
  const showPool = !!(s.prizeEnabled && s.spectatorShowPool);
  return {
    v: 1, room, status: g.status, n: g.history.length,
    drawn, last: last ? row(last) : null, recent: g.history.slice(-5).map(row),
    ranks: g.ranks.map((r) => [r.rank, r.tieCount, r.atSeq]),
    pool: showPool ? calcTotalPool(state) : null,
    at: Date.now(),
  };
}

function initSpectatePublish(room) {
  const R = window.BingoRoom;
  if (!R || !room) return;
  const conn = R.connect({ code: room, role: 'host' });
  let timer = 0, sentKey = '', pending = null;

  const liveApi = () => {
    try {
      const A = window.parent !== window && window.parent.MiniHubAuth;
      return A && A.rooms && A.rooms.live && A.rooms.on() ? A.rooms.live : null;
    } catch (e) { return null; }
  };
  const keyOf = (snap) => JSON.stringify({ ...snap, at: 0 });

  function flushCloud() {
    timer = 0;
    const api = liveApi();
    if (!api || !pending) return;
    const snap = pending, key = keyOf(snap);
    if (key === sentKey) return;
    sentKey = key;
    api.publish(room, snap).catch(() => { sentKey = ''; });
  }

  function push() {
    const snap = snapshot(room);
    pending = snap;
    conn.send(R.MSG.SNAPSHOT, snap);
    if (!timer) timer = setTimeout(flushCloud, CLOUD_DELAY_MS);
  }

  conn.on((m) => { if (m.type === R.MSG.SNAPSHOT_REQ) conn.send(R.MSG.SNAPSHOT, snapshot(room)); });
  subscribe(push);
  try { MiniHub.onChange(() => { sentKey = ''; push(); }); } catch (e) { /* 忽略 */ }
  addEventListener('pagehide', () => { clearTimeout(timer); flushCloud(); conn.close(); });
  push();
}
return { initSpectatePublish };
})();

// ===== main.js =====
M['main'] = (() => {
const { getState, setState, subscribe } = M['core/state'];
const { initTabs } = M['ui/tabs'];
const { initSettings } = M['ui/settings-view'];
const { initDrawView } = M['ui/draw-view'];
const { initTickerView } = M['ui/ticker-view'];
const { initPrizeView } = M['ui/prize-view'];
const { initBoardView } = M['ui/board-view'];
const { initEffects } = M['ui/effects'];
const { initRulesView } = M['ui/rules-view'];
const { openReceipt } = M['ui/receipt-view'];
const { el } = M['utils/dom'];
const { createDeskBrand } = M['ui/more-menu'];
const { initCloudSave } = M['core/cloud-save'];
const { initSpectatePublish } = M['core/spectate'];
// 啟動入口：建立分頁並載入各視圖

const STATUS_TEXT = { setup: '設定中', playing: '遊戲進行中', ended: '已結束' };

function start() {
  // 本機不保存：順手清掉舊版本留在瀏覽器裡的存檔（雲端進度另見 core/cloud-save）
  try { localStorage.removeItem('bingo-board-v1'); } catch { /* 忽略 */ }
  setState({ ui: { layout: 'desktop' } });
  initTabs(document.querySelectorAll('[data-panel]'));
  initPrizeView(document.getElementById('pool-root'));
  initDrawView(document.getElementById('draw-root'));
  initTickerView(document.getElementById('ticker-root'));
  initBoardView(document.getElementById('board-root'));
  initSettings(document.getElementById('settings-root'));
  initEffects({ soundBtn: document.getElementById('sound-btn') });

  document.querySelectorAll('.desk-slot').forEach((slot) => slot.replaceChildren(createDeskBrand({ back: !!slot.closest('[data-panel="settings"]') })));
  initRulesView(document.getElementById('rules-btn'));
  const receiptBtn = document.getElementById('receipt-btn');
  receiptBtn.addEventListener('click', openReceipt);

  // 電腦版沒有分頁列：右上「設定」按鈕在抽號卡與設定頁之間切換
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    setState({ ui: { tab: getState().ui.tab === 'settings' ? 'draw' : 'settings' } });
  });
  const updateSettingsBtn = () => {
    const { tab } = getState().ui;
    const inSettings = tab === 'settings';
    settingsBtn.replaceChildren(
      el('span', { class: 'hdr-icon', 'aria-hidden': 'true' }, inSettings ? '🎲' : '⚙️'),
      el('span', { class: 'hdr-text' }, inSettings ? '抽號' : '設定'));
    settingsBtn.setAttribute('aria-label', inSettings ? '回到抽號卡' : '設定');
  };
  updateSettingsBtn();
  subscribe(updateSettingsBtn);

  const updateBadge = () => {
    const status = getState().game.status;
    document.querySelectorAll('.status-badge').forEach((badge) => {
      badge.textContent = STATUS_TEXT[status] ?? status;
      badge.dataset.status = status;
    });
    receiptBtn.hidden = status !== 'ended'; // 結束後才顯示「🧾 收據」
  };
  updateBadge();
  subscribe(updateBadge);

  // 遊戲進行中（資料不保存）：關閉或重新整理前跳出瀏覽器的確認提示，避免誤觸
  window.addEventListener('beforeunload', (e) => {
    if (getState().game.status !== 'playing') return;
    e.preventDefault();
    e.returnValue = ''; // 舊版瀏覽器需要
  });

  // 主持：把抽號進度同步到 Firestore，重新登入後可還原（旁觀不同步）
  try {
    const p = window.BingoRoom && window.BingoRoom.readParams();
    if (p && p.role === 'host' && p.room) initCloudSave(p.room);
    if (p && p.role === 'host' && p.room) initSpectatePublish(p.room);   // 旁觀：公開抽號資料給旁觀頁
  } catch (e) { console.warn('[cloud-save / spectate]', e); }

  // 載入完成：移除載入畫面
  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
}

start();

// 大廳整合（SDK）
(function setupHub() {
  try { MiniHub.onPause(() => window.GameAudio.suspend()); } catch (e) { /* 忽略 */ }
})();
})();

})();
