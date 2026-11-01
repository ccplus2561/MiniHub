// ❓ 規則說明（全螢幕卡片式）。內容來自 settings.rules（可在設定頁編輯）。
// openRules({ onStart })：開始抽獎前先顯示規則，按「開始抽獎」才執行 onStart。
import { el, showModal } from '../utils/dom.js';
import { getState } from '../core/state.js';

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

export function openRules({ onStart } = {}) {
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
export function initRulesView(button) {
  button.addEventListener('click', () => openRules());
}
