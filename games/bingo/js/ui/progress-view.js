// 🎯 抽獎進度（電腦左欄）：已抽出號碼數、前三名名次狀態、抽號次數。
import { getState, subscribe } from '../core/state.js';
import { drawnNumbers } from '../core/draw-engine.js';
import { NUMBER_MAX, RANK_COUNT } from '../config/defaults.js';
import { el } from '../utils/dom.js';
import { formatNumber } from '../utils/format.js';

const row = (label, value, cls = '') =>
  el('div', { class: `pr-row ${cls}` }, el('span', { class: 'pr-label' }, label), el('strong', { class: 'pr-value' }, value));

export function initProgressView(root) {
  function render() {
    const { game } = getState();
    const rows = [];
    let pos = 1;
    for (const r of game.ranks) {
      rows.push(row(`🎉 第 ${r.rank} 名已出爐`, r.tieCount > 1 ? `同時 ${r.tieCount} 人` : '已登錄', 'is-declared'));
      pos = r.rank + r.tieCount;
    }
    for (; pos <= RANK_COUNT; pos++) rows.push(row(`第 ${pos} 名`, '尚未出爐'));
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
  render();
  subscribe(render);
}
