// 🔍 驗卡：輸入 5 或 5.12.33.68，即時顯示每個號碼是否已抽中。
// createCheckPanel() 可重複建立：手機為分頁、電腦版也可在抽號頁以彈窗開啟（免離開抽號畫面）。
import { getState, subscribe } from '../core/state.js';
import { parseNumbers, checkNumbers } from '../core/checker.js';
import { el } from '../utils/dom.js';

export function createCheckPanel() {
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
