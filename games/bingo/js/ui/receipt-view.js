// 🧾 本局結算收據（全螢幕）：結束遊戲流程、開新局。
// 只呈現最終結果；不顯示辛苦費或安慰獎被調降的過程，也不顯示任何警告。
import { getState, setState, reset } from '../core/state.js';
import { endGame, buildReceipt } from '../core/receipt.js';
import { el, toast, confirmDialog, kbdOn, nextOk } from '../utils/dom.js';
import { formatMoney, formatNumber } from '../utils/format.js';

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
export function openReceipt() {
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
  const onKey = (e) => { if (e.key === 'Escape' && kbdOn() && !document.querySelector('.modal-overlay')) close(); };

  const onNewGame = async () => {
    const ok = await confirmDialog({
      title: '開新局？',
      message: '將清除本局所有設定與紀錄，回到初始狀態，此操作無法復原。建議先截圖或複製收據。',
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

export function closeReceipt() {
  if (openOverlay) openOverlay.close();
}

/** 「結束遊戲」流程：二次確認 → status='ended' → 彈出收據 */
export async function endGameFlow() {
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
