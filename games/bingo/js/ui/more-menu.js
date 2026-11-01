// 電腦版：標題列移除後，在獎金池上方顯示「兵果彩盤」＋「更多」按鈕；
// 更多選單依序：規則、驗卡、音效、設定、結束遊戲（結束遊戲有確認視窗，見 endGameFlow）。
import { getState, setState } from '../core/state.js';
import { el, showModal } from '../utils/dom.js';
import { endGameFlow, openReceipt } from './receipt-view.js';
import { openCheckModal } from './draw-view.js';

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
    item('❓', '規則', () => $('rules-btn').click()),
    item('🔍', '驗卡', () => openCheckModal()),
    item(tab === 'settings' ? '🎲' : '⚙️', tab === 'settings' ? '回到抽號卡' : '設定', () => $('settings-btn').click()),
    item('🏁', status === 'ended' ? '查看結算收據' : '結束遊戲', () => (status === 'ended' ? openReceipt() : endGameFlow()), { disabled: status === 'setup' })
  );
  modal = showModal({ title: '更多', content, actions: [{ text: '關閉', kind: 'secondary' }] });
}

/** 建立「兵果彩盤＋更多」列（電腦版專用，手機版以 CSS 隱藏） */
export function createDeskBrand({ back = false } = {}) {
  return el('div', { class: 'desk-brand' },
    el('span', { class: 'desk-brand-title' }, '🧧 兵果彩盤'),
    el('span', { class: 'status-badge', dataset: { status: 'setup' } }, '設定中'),
    back ? el('button', { type: 'button', class: 'btn btn-gold desk-back', onClick: () => setState({ ui: { tab: 'draw' } }) }, '← 返回抽號') : null,
    el('button', { type: 'button', class: 'btn btn-primary desk-more', onClick: openMoreMenu, 'aria-haspopup': 'dialog' }, '☰ 更多'));
}
