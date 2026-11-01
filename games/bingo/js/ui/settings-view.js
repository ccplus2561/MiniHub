// ⚙️ 設定頁：欄位驗證、開始遊戲（鎖定）、重新開始
import { getState, setState, reset, subscribe } from '../core/state.js';
import { DEFAULT_SETTINGS, DEFAULT_RULES, DEFAULT_RULES_NOTE, LIMITS } from '../config/defaults.js';
import { openRules } from './rules-view.js';
import { el, toast, confirmDialog, nextOk } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';

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
export function drawPriceLimit() {
  return LIMITS.maxPrice;
}

/** 驗證單一數字欄位，回傳 {ok:true,value} 或 {ok:false,message} */
export function validateNumberField(key, raw, settings = DEFAULT_SETTINGS) {
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
export function validateRatio(values) {
  const nums = values.map((v) => (String(v ?? '').trim() === '' ? NaN : Number(v)));
  if (nums.length !== 3 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
    return fail('獎金比例請輸入 0~100 的整數，不可為負數或空白');
  }
  const sum = nums[0] + nums[1] + nums[2];
  if (sum !== 100) return fail(`獎金比例合計為 ${sum}，必須為 100`);
  return { ok: true, value: nums };
}

/** 依比例自動換算為合計 100（餘數補在第 1 名） */
export function normalizeRatio(values) {
  const nums = values.map((v) => Math.max(0, Math.round(Number(v)) || 0));
  const sum = nums[0] + nums[1] + nums[2];
  if (sum <= 0) return [...DEFAULT_SETTINGS.prizeRatio];
  const scaled = nums.map((n) => Math.floor((n / sum) * 100));
  scaled[0] += 100 - (scaled[0] + scaled[1] + scaled[2]);
  return scaled;
}

// ---------- 可編輯規則 ----------

// 遊戲進行中，僅開放「加買卡」與「人數」；辛苦費 % 與安慰獎金額開局後一律鎖定
const EDITABLE_WHILE_PLAYING = ['players', 'newCardCount', 'renewCardCount', 'rules'];

function isEditable(key, status) {
  if (status === 'setup') return true;
  if (status === 'playing') return EDITABLE_WHILE_PLAYING.includes(key);
  return false;
}

// ---------- 畫面（電腦版：左側分類導覽＋右側設定列表＋底部操作） ----------

const SECTIONS = [
  { id: 'mode', icon: '🎛️', title: '遊戲模式', desc: '決定本局是否使用獎金功能。' },
  { id: 'players', icon: '👥', title: '玩家與卡片', desc: '參加人數與新卡／續卡的單價與張數。', needPrize: true },
  { id: 'draw', icon: '🎲', title: '抽號設定', desc: '單抽單價與抽號規則。' },
  { id: 'prize', icon: '💰', title: '獎金設定', desc: '名次分派、安慰獎與主持人辛苦費。', needPrize: true },
  { id: 'rules', icon: '📜', title: '規則內容', desc: '開始抽獎前會先向所有人顯示。' },
];

export function initSettings(root) {
  let signature = '';
  let active = 'mode';
  let prizeShown = false; // 獎金設定含保底金額：每次進入都先遮蔽

  function setError(key, message) {
    const node = root.querySelector(`#err-${key}`);
    if (node) node.textContent = message;
  }

  const lockTag = (editable) => (editable ? null : el('span', { class: 'lock-tag' }, '🔒 已鎖定'));

  /** 一列設定：左側名稱＋說明＋錯誤訊息，右側控制項 */
  function row({ label, hint, control, key, forId, editable = true, wide = false }) {
    return el('div', { class: `set-row${editable ? '' : ' is-locked'}${wide ? ' is-wide' : ''}` },
      el('div', { class: 'set-info' },
        el(forId ? 'label' : 'span', { class: 'set-label', htmlFor: forId }, label, lockTag(editable)),
        hint ? el('p', { class: 'field-hint' }, hint) : null,
        key ? el('p', { class: 'field-error', id: `err-${key}`, role: 'alert' }) : null),
      el('div', { class: 'set-control' }, control));
  }

  function numberRow(key, label, status, { hint, unit } = {}) {
    const { settings } = getState();
    const editable = isEditable(key, status);
    const rule = NUMBER_RULES[key];
    const input = el('input', {
      class: 'input', id: `f-${key}`, type: 'number', inputMode: 'numeric',
      min: rule.min ?? 0, step: 1, value: String(settings[key]), disabled: !editable,
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
    return row({ label, hint, key, forId: `f-${key}`, editable,
      control: el('div', { class: 'unit-input' }, input, unit ? el('span', { class: 'unit' }, unit) : null) });
  }

  function toggleRow(key, label, hint, status) {
    const { settings } = getState();
    const editable = isEditable(key, status);
    const input = el('input', {
      type: 'checkbox', class: 'switch', id: `f-${key}`, checked: settings[key], disabled: !editable,
      onChange: () => setState({ settings: { [key]: input.checked } }),
    });
    return row({ label, hint, forId: `f-${key}`, editable, control: input });
  }

  function ratioRow(status) {
    const { settings } = getState();
    const editable = isEditable('prizeRatio', status);
    const sumEl = el('span', { class: 'ratio-sum' });
    const inputs = settings.prizeRatio.map((v, i) =>
      el('input', {
        class: 'input', type: 'number', inputMode: 'numeric', min: 0, max: 100, step: 1,
        value: String(v), disabled: !editable, 'aria-label': `第 ${i + 1} 名比例`,
        onInput: updateSum, onChange: commitRatio,
      }));
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
    const autoBtn = el('button', {
      type: 'button', class: 'btn btn-small btn-secondary', disabled: !editable,
      onClick: () => {
        normalizeRatio(inputs.map((i) => i.value)).forEach((v, i) => (inputs[i].value = String(v)));
        updateSum();
        commitRatio();
      },
    }, '自動換算為 100');
    updateSum();
    return row({ label: '獎金分派比例', hint: '第 1 : 2 : 3 名，合計必須為 100', key: 'prizeRatio', editable, wide: true,
      control: el('div', {},
        el('div', { class: 'ratio-row' }, ...inputs.flatMap((input, i) => [i > 0 ? el('span', { class: 'ratio-colon' }, ':') : null, input])),
        el('div', { class: 'ratio-foot' }, sumEl, autoBtn)) });
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
        const body = el('textarea', { class: 'input rule-textarea', rows: 4, disabled: !editable, 'aria-label': `第 ${i + 1} 段內容`, placeholder: '每一行為一條說明',
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

    return el('div', { class: 'rules-edit-body' },
      el('div', { class: 'rules-toolbar' },
        el('button', { type: 'button', class: 'btn btn-small btn-secondary', disabled: !editable, onClick: () => { list.push({ title: '新規則', body: '' }); commit(); paint(); holder.lastElementChild?.querySelector('input')?.select(); } }, '＋ 新增段落'),
        el('button', { type: 'button', class: 'btn btn-small btn-secondary', onClick: () => openRules() }, '👁 預覽'),
        el('button', { type: 'button', class: 'btn btn-small btn-danger-outline', disabled: !editable, onClick: async () => {
          const ok = await confirmDialog({ title: '還原預設規則？', message: '目前編輯的規則內容將被預設內容取代。', confirmText: '還原', danger: true });
          if (!ok) return;
          list = DEFAULT_RULES.map((r) => ({ ...r })); note = DEFAULT_RULES_NOTE; noteInput.value = note; commit(); paint();
        } }, '還原預設')),
      holder,
      row({ label: '底部備註', hint: '顯示在規則最下方，可留空', editable, control: noteInput }));
  }

  async function onStart() {
    const { settings } = getState();
    if (settings.prizeEnabled && settings.players < 1) {
      showSection('players');
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
      onStart: async () => {
        if (!(await nextOk())) return;
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
    if (!(await nextOk())) return;
    reset();
    active = 'mode';
    setState({ ui: { tab: 'settings' } }); // 重新開始後停留在設定頁
    render();
    toast('已重新開始');
  }

  // ---------- 分類切換（不重繪，輸入內容不會遺失） ----------
  function showSection(id) {
    if (active === 'prize' && id !== 'prize') { prizeShown = false; paintPrize(); }
    active = id;
    root.querySelectorAll('.set-nav-item').forEach((b) => {
      const on = b.dataset.section === id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    root.querySelectorAll('.set-section').forEach((sec) => { sec.hidden = sec.dataset.section !== id; });
    const content = root.querySelector('.set-content');
    if (content) content.scrollTop = 0;
  }

  function paintPrize() {
    const cover = root.querySelector('.prize-cover');
    const body = root.querySelector('.prize-body');
    if (cover) cover.hidden = prizeShown;
    if (body) body.hidden = !prizeShown;
  }

  function section(def, ...rows) {
    return el('section', { class: 'set-section', dataset: { section: def.id }, hidden: def.id !== active },
      el('header', { class: 'set-head' },
        el('h2', { class: 'set-title' }, el('span', { 'aria-hidden': 'true' }, def.icon), def.title),
        el('p', { class: 'set-desc' }, def.desc)),
      el('div', { class: 'set-group' }, ...rows.filter(Boolean)));
  }

  function render() {
    const { settings, game } = getState();
    const status = game.status;
    signature = `${status}|${settings.locked}|${settings.prizeEnabled}`;
    const prizeOn = settings.prizeEnabled;
    prizeShown = false;
    const defs = SECTIONS.filter((d) => prizeOn || !d.needPrize);
    if (!defs.some((d) => d.id === active)) active = 'mode';
    const by = (id) => SECTIONS.find((d) => d.id === id);

    // ---- 左側：導覽＋操作 ----
    const nav = el('nav', { class: 'set-nav', 'aria-label': '設定分類' },
      ...defs.map((d) => el('button', {
        type: 'button', class: `set-nav-item${d.id === active ? ' is-active' : ''}`, dataset: { section: d.id },
        'aria-current': d.id === active ? 'page' : null, onClick: () => showSection(d.id),
      }, el('span', { class: 'set-nav-icon', 'aria-hidden': 'true' }, d.icon), d.title)));

    const statusBox = status === 'setup'
      ? el('div', { class: 'set-start' },
          el('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: onStart }, '🎰 開始抽獎'),
          el('p', { class: 'field-hint' }, prizeOn ? '先顯示規則，開始後辛苦費 % 與安慰獎金額將鎖定。' : '先顯示規則，再開始抽獎。'))
      : el('div', { class: 'set-start is-note' },
          el('strong', {}, status === 'playing' ? '遊戲進行中' : '本局已結束'),
          el('p', { class: 'field-hint' }, status === 'playing'
            ? '辛苦費 % 與安慰獎金額已鎖定；可修改參加人數與新／續卡張數（加買卡）。'
            : '所有設定已鎖定，請按「重新開始」開新局。'));

    const side = el('aside', { class: 'set-side' },
      nav,
      el('div', { class: 'set-actions' },
        statusBox,
        el('button', { type: 'button', class: 'btn btn-danger-outline btn-block', onClick: onReset }, '🔄 重新開始')));

    // ---- 右側：各分類內容 ----
    const prizeBody = el('div', { class: 'prize-body', hidden: true },
      ratioRow(status),
      numberRow('consolationAmount', '安慰獎金額', status, { hint: '每位持卡玩家可得', unit: '元' }),
      numberRow('hostFeePercent', '主持人辛苦費', status, { hint: '從獎金池抽取的百分比', unit: '%' }),
      el('div', { class: 'prize-hide-row' },
        el('button', { type: 'button', class: 'btn btn-small btn-secondary', onClick: () => { prizeShown = false; paintPrize(); } }, '🙈 隱藏獎金設定')));
    const prizeCover = el('div', { class: 'prize-cover' },
      el('p', {}, '🔒 此區含保底（安慰獎）金額，請避開他人視線'),
      el('button', { type: 'button', class: 'btn btn-primary', onClick: () => { prizeShown = true; paintPrize(); } }, '👁 顯示獎金設定'));

    const content = el('div', { class: 'set-content' },
      section(by('mode'),
        toggleRow('prizeEnabled', '啟用獎金功能', '關閉後沒有獎金池與費用，抽獎不受任何金錢限制，只記錄名次', status)),
      prizeOn ? section(by('players'),
        numberRow('players', '參加總人數', status, { hint: '持卡玩家數；安慰獎以人數計算，認人不認卡', unit: '人' }),
        numberRow('newCardPrice', '新卡單價', status, { unit: '元' }),
        numberRow('renewCardPrice', '續卡單價', status, { unit: '元' }),
        numberRow('newCardCount', '新卡張數', status, { unit: '張' }),
        numberRow('renewCardCount', '續卡張數', status, { unit: '張' })) : null,
      section(by('draw'),
        prizeOn ? numberRow('drawPrice', '單抽單價', status, {
          unit: '元',
          hint: `連抽最高 ${settings.maxBatchDraws} 次，單次付費上限 = 單抽單價 × ${settings.maxBatchDraws}（目前 ${formatMoney(settings.drawPrice * settings.maxBatchDraws)}）`,
        }) : null,
        toggleRow('allowRepeat', '允許重複數字', '可能抽到已出現過的號碼', status),
        toggleRow('allowBlank', '允許銘謝惠顧', '可能抽到無號碼的空籤', status)),
      prizeOn ? section(by('prize'), prizeCover, prizeBody) : null,
      section(by('rules'), rulesEditor(status)));

    root.replaceChildren(side, content);
  }

  render();
  // 只有開局狀態改變時才整頁重繪，避免輸入中失去焦點
  subscribe((s) => {
    if (`${s.game.status}|${s.settings.locked}|${s.settings.prizeEnabled}` !== signature) render();
  });
}
