// 🧾 本局結果（全螢幕）：結束遊戲流程、開新局。
import { getState, setState, reset } from '../core/state.js';
import { endGame, buildReceipt } from '../core/receipt.js';
import { el, toast, confirmDialog, kbdOn, nextOk } from '../utils/dom.js';
import { formatNumber } from '../utils/format.js';

let openOverlay = null;

const dateText = () => new Date().toLocaleString('zh-TW', { hour12: false });

const line = (label, value, cls = '') =>
  el('div', { class: `rc-row ${cls}` }, el('span', { class: 'rc-label' }, label), el('strong', { class: 'rc-value' }, value));

/** 開啟（或重新開啟）全螢幕收據。只有已結束的局才可開啟 */
export function openReceipt() {
  const state = getState();
  if (state.game.status !== 'ended') return;
  closeReceipt();
  document.querySelector('.celebrate')?.remove(); // 結束時若慶祝動畫還在播，先清掉避免蓋住收據
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
  const onKey = (e) => { if (e.key === 'Escape' && kbdOn() && !document.querySelector('.modal-overlay')) close(); };

  const onNewGame = async () => {
    const ok = await confirmDialog({
      title: '開新局？',
      message: '將清除本局所有設定與紀錄，回到初始狀態，此操作無法復原。建議先截圖。',
      confirmText: '🔄 開新局',
      danger: true,
    });
    if (!ok) return;
    if (!(await nextOk())) return;
    close();
    reset();
    setState({ ui: { tab: 'settings' } });
    toast('已開新局');
  };

  const kpi = (label, value, cls = '') =>
    el('div', { class: `rc-kpi ${cls}` }, el('span', { class: 'rc-kpi-label' }, label), el('strong', { class: 'rc-kpi-value' }, value));
  const card = (title, ...body) => el('section', { class: 'rc-card' }, el('h3', { class: 'rc-h' }, title), ...body);

  const body = el('div', { class: 'rc-body rc-plain' },
    el('div', { class: 'rc-kpis' }, kpi('抽號次數', `${formatNumber(r.drawCount)} 次`), kpi('已抽出號碼', `${r.drawnCount} / 75`), kpi('登錄名次', `${r.ranks.length} 個`)),
    card('名次', ...(r.ranks.length
      ? r.ranks.map((k) => line(`🏆 第 ${k.rank} 名`, k.tieCount > 1 ? `同時 ${k.tieCount} 人` : '1 人', 'is-prize'))
      : [line('名次', '無人登錄', 'is-none')])));

  const overlay = el('div', { class: 'receipt-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '本局結果' },
    el('header', { class: 'receipt-head' },
      el('div', { class: 'rc-headtext' },
        el('h2', { class: 'rc-title' }, '🧧 本局結果'),
        el('p', { class: 'rc-sub' }, `${when}｜抽號 ${formatNumber(r.drawCount)} 次`)),
      el('div', { class: 'receipt-actions' },
        el('button', { type: 'button', class: 'btn btn-danger-outline', onClick: onNewGame }, '🔄 開新局'),
        el('button', { type: 'button', class: 'btn btn-primary', onClick: close }, '關閉'))),
    el('div', { class: 'receipt-scroll' }, el('article', { class: 'receipt' }, body)));

  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  openOverlay = { close };
  overlay.querySelector('.receipt-actions .btn:last-child').focus();
}

export function closeReceipt() {
  if (openOverlay) openOverlay.close();
}

/** 「結束遊戲」流程：二次確認 → status='ended' → 彈出本局結果 */
export async function endGameFlow() {
  const ok = await confirmDialog({
    title: '結束遊戲？',
    message: '結束後將顯示本局結果，之後無法再抽號或撤回，確定要結束本局嗎？',
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
