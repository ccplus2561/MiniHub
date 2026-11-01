// 啟動入口：建立分頁並載入各視圖
import { getState, setState, subscribe } from './core/state.js';
import { initTabs } from './ui/tabs.js';
import { initSettings } from './ui/settings-view.js';
import { initDrawView } from './ui/draw-view.js';
import { initTickerView } from './ui/ticker-view.js';
import { initPrizeView } from './ui/prize-view.js';
import { initBoardView } from './ui/board-view.js';
import { initEffects } from './ui/effects.js';
import { initRulesView } from './ui/rules-view.js';
import { openReceipt } from './ui/receipt-view.js';
import { el } from './utils/dom.js';
import { createDeskBrand } from './ui/more-menu.js';

const STATUS_TEXT = { setup: '設定中', playing: '遊戲進行中', ended: '已結束' };

function start() {
  // 資料不保存：順手清掉舊版本留在瀏覽器裡的存檔
  try { localStorage.removeItem('bingo-board-v1'); } catch { /* 忽略 */ }
  setState({ ui: { layout: 'desktop' } });
  initTabs(document.querySelectorAll('[data-panel]'));
  initPrizeView(document.getElementById('pool-root'));
  initDrawView(document.getElementById('draw-root'));
  initTickerView(document.getElementById('ticker-root'));
  initBoardView(document.getElementById('board-root'));
  initSettings(document.getElementById('settings-root'));
  initEffects();

  document.querySelectorAll('.desk-slot').forEach((slot) => slot.replaceChildren(createDeskBrand({ back: !!slot.closest('[data-panel="settings"]') })));
  initRulesView(document.getElementById('rules-btn'));
  const receiptBtn = document.getElementById('receipt-btn');
  receiptBtn.addEventListener('click', openReceipt);

  // 電腦版沒有分頁列：右上「設定」按鈕在抽號卡與設定頁之間切換
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    setState({ ui: { tab: getState().ui.tab === 'settings' ? 'draw' : 'settings' } });
  });
  const updateSettingsBtn = () => {
    const { tab } = getState().ui;
    const inSettings = tab === 'settings';
    settingsBtn.replaceChildren(
      el('span', { class: 'hdr-icon', 'aria-hidden': 'true' }, inSettings ? '🎲' : '⚙️'),
      el('span', { class: 'hdr-text' }, inSettings ? '抽號' : '設定'));
    settingsBtn.setAttribute('aria-label', inSettings ? '回到抽號卡' : '設定');
  };
  updateSettingsBtn();
  subscribe(updateSettingsBtn);

  const updateBadge = () => {
    const status = getState().game.status;
    document.querySelectorAll('.status-badge').forEach((badge) => {
      badge.textContent = STATUS_TEXT[status] ?? status;
      badge.dataset.status = status;
    });
    receiptBtn.hidden = status !== 'ended'; // 結束後才顯示「🧾 收據」
  };
  updateBadge();
  subscribe(updateBadge);

  // 離開網站的保護由大廳（guard.js）負責，這裡不再另外攔截

  // 載入完成：移除載入畫面
  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
}

start();
