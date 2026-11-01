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

  const kpi = (label, value, cls = '') =>
    el('div', { class: `rc-kpi ${cls}` }, el('span', { class: 'rc-kpi-label' }, label), el('strong', { class: 'rc-kpi-value' }, value));
  const card = (title, ...body) => el('section', { class: 'rc-card' }, el('h3', { class: 'rc-h' }, title), ...body);

  // 前三名：表格（名次／人數／每人／小計）
  const prizeTable = () => el('table', { class: 'rc-table' },
    el('thead', {}, el('tr', {}, ...['名次', '得獎人數', '每人金額', '小計'].map((t, i) => el('th', { class: i ? 'num' : '' }, t)))),
    el('tbody', {}, ...r.prizeLines.map((l) => {
      if (l.status === 'none') return el('tr', { class: 'is-none' }, el('td', {}, `第 ${l.position} 名`), el('td', { colSpan: 3, class: 'num' }, '無人得獎'));
      if (l.status === 'merged') return el('tr', { class: 'is-none' }, el('td', {}, `第 ${l.position} 名`), el('td', { colSpan: 3, class: 'num' }, `併入第 ${l.mergedInto} 名平分`));
      const range = l.positions.length > 1 ? `（第 ${l.positions[0]}～${l.positions.at(-1)} 名平分）` : '';
      return el('tr', { class: 'is-prize' }, el('td', {}, `🏆 第 ${l.position} 名${range}`),
        el('td', { class: 'num' }, `${l.winners} 人`), el('td', { class: 'num' }, formatMoney(l.perPerson)), el('td', { class: 'num' }, formatMoney(l.subtotal)));
    })),
    el('tfoot', {}, el('tr', {}, el('td', { colSpan: 3 }, '前三名合計'), el('td', { class: 'num' }, formatMoney(r.prizePaid)))));

  const body = plain
    ? el('div', { class: 'rc-body rc-plain' },
        el('div', { class: 'rc-kpis' }, kpi('抽號次數', `${formatNumber(r.drawCount)} 次`), kpi('已抽出號碼', `${r.drawnCount} / 75`), kpi('登錄名次', `${state.game.ranks.length} 個`)),
        card('名次', ...(state.game.ranks.length
          ? state.game.ranks.map((k) => line(`🏆 第 ${k.rank} 名`, k.tieCount > 1 ? `同時 ${k.tieCount} 人` : '1 人', 'is-prize'))
          : [line('名次', '無人登錄', 'is-none')])))
    : el('div', { class: 'rc-body' },
        el('div', { class: 'rc-kpis' },
          kpi('總收入', formatMoney(r.totalPool), 'is-main'),
          kpi('前三名實領', formatMoney(r.prizePaid)),
          kpi('安慰獎', formatMoney(r.consolation.total)),
          kpi('主持人辛苦費', formatMoney(r.hostFee))),
        el('div', { class: 'rc-grid' },
          card('收入明細',
            line('新卡', formatMoney(r.pool.newCards)),
            line('續卡', formatMoney(r.pool.renewCards)),
            line('付費抽號', formatMoney(r.pool.paidDraws)),
            line('總收入', formatMoney(r.totalPool), 'is-sum')),
          card('前三名實領', prizeTable()),
          card('其他',
            line(`安慰獎（${formatNumber(r.consolation.people)} 人 × ${formatMoney(r.consolation.unit)}）`, formatMoney(r.consolation.total)),
            line('主持人辛苦費', formatMoney(r.hostFee)),
            line('零頭', formatMoney(r.remainder)))));

  const overlay = el('div', { class: 'receipt-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '本局結算收據' },
    el('header', { class: 'receipt-head' },
      el('div', { class: 'rc-headtext' },
        el('h2', { class: 'rc-title' }, plain ? '🧧 本局結果' : '🧧 本局結算收據'),
        el('p', { class: 'rc-sub' }, plain ? `${when}｜抽號 ${formatNumber(r.drawCount)} 次` : `${when}｜參加 ${formatNumber(r.players)} 人｜抽號 ${formatNumber(r.drawCount)} 次`)),
      el('div', { class: 'receipt-actions' },
        el('button', { type: 'button', class: 'btn btn-danger-outline', onClick: onNewGame }, '🔄 開新局'),
        el('button', { type: 'button', class: 'btn btn-primary', onClick: close }, '關閉收據'))),
    el('div', { class: 'receipt-scroll' }, el('article', { class: 'receipt' }, body)));

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
