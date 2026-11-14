// ⚙️ 設定頁：抽號設定、規則內容、開始遊戲（鎖定）、重新開始
import { getState, setState, reset, subscribe } from '../core/state.js';
import { DEFAULT_RULES, DEFAULT_RULES_NOTE } from '../config/defaults.js';
import { openRules } from './rules-view.js';
import { el, toast, confirmDialog, nextOk } from '../utils/dom.js';

// ---------- 可編輯規則 ----------

// 遊戲進行中，僅開放「規則內容」
const EDITABLE_WHILE_PLAYING = ['rules'];

function isEditable(key, status) {
  if (status === 'setup') return true;
  if (status === 'playing') return EDITABLE_WHILE_PLAYING.includes(key);
  return false;
}

// ---------- 畫面（電腦版：左側分類導覽＋右側設定列表＋底部操作） ----------

const SECTIONS = [
  { id: 'draw', icon: '🎲', title: '抽號設定', desc: '抽號規則：是否允許重複號碼與銘謝惠顧。' },
  { id: 'rules', icon: '📜', title: '規則內容', desc: '開始抽獎前會先向所有人顯示。' },
];

export function initSettings(root) {
  let signature = '';
  let active = 'draw';

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

  function toggleRow(key, label, hint, status) {
    const { settings } = getState();
    const editable = isEditable(key, status);
    const input = el('input', {
      type: 'checkbox', class: 'switch', id: `f-${key}`, checked: settings[key], disabled: !editable,
      onChange: () => setState({ settings: { [key]: input.checked } }),
    });
    return row({ label, hint, forId: `f-${key}`, editable, control: input });
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
        const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; commit(); paint(); };
        return el('div', { class: 'rule-edit' },
          el('div', { class: 'rule-edit-head' },
            el('span', { class: 'rule-no', 'aria-hidden': 'true' }, String(i + 1)),
            title,
            el('button', { type: 'button', class: 'btn btn-small btn-secondary rule-ico', disabled: !editable || i === 0, 'aria-label': '上移', onClick: () => move(-1) }, '↑'),
            el('button', { type: 'button', class: 'btn btn-small btn-secondary rule-ico', disabled: !editable || i === list.length - 1, 'aria-label': '下移', onClick: () => move(1) }, '↓'),
            el('button', { type: 'button', class: 'btn btn-small btn-danger-outline rule-ico', disabled: !editable, 'aria-label': '刪除此段', onClick: () => { list.splice(i, 1); commit(); paint(); } }, '✕')),
          body);
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
    const ok = await confirmDialog({
      title: '開始抽獎？',
      message: '接著會先顯示規則給所有人確認；開始後將無法再修改抽號設定。',
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
    active = 'draw';
    setState({ ui: { tab: 'settings' } }); // 重新開始後停留在設定頁
    render();
    toast('已重新開始');
  }

  // ---------- 分類切換（不重繪，輸入內容不會遺失） ----------
  function showSection(id) {
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
    signature = `${status}|${settings.locked}`;
    const defs = SECTIONS;
    if (!defs.some((d) => d.id === active)) active = 'draw';
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
          el('p', { class: 'field-hint' }, '先顯示規則，再開始抽獎。'))
      : el('div', { class: 'set-start is-note' },
          el('strong', {}, status === 'playing' ? '遊戲進行中' : '本局已結束'),
          el('p', { class: 'field-hint' }, status === 'playing'
            ? '抽號設定已鎖定；仍可修改規則內容。'
            : '所有設定已鎖定，請按「重新開始」開新局。'));

    const side = el('aside', { class: 'set-side' },
      nav,
      el('div', { class: 'set-actions' },
        statusBox,
        el('button', { type: 'button', class: 'btn btn-danger-outline btn-block', onClick: onReset }, '🔄 重新開始')));

    // ---- 右側：各分類內容 ----
    const content = el('div', { class: 'set-content' },
      section(by('draw'),
        toggleRow('allowRepeat', '允許重複數字', '可能抽到已出現過的號碼', status),
        toggleRow('allowBlank', '允許銘謝惠顧', '可能抽到無號碼的空籤', status)),
      section(by('rules'), rulesEditor(status)));

    root.replaceChildren(side, content);
  }

  render();
  // 只有開局狀態改變時才整頁重繪，避免輸入中失去焦點
  subscribe((s) => {
    if (`${s.game.status}|${s.settings.locked}` !== signature) render();
  });
}
