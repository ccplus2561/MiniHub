// 最新 5 次走馬燈：獨立成一個區塊（手機排在抽號卡下方；電腦版在獎金池與抽號卡的底下）。
// 固定 5 格避免版面跳動；只有「剛抽出新的一筆」最新那格才播放進場動畫。
import { getState, subscribe } from '../core/state.js';
import { TICKER_SIZE } from '../config/defaults.js';
import { el } from '../utils/dom.js';

const TAG = { new: '新號', repeat: '重複', blank: '銘謝惠顧' };

export function initTickerView(root) {
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
