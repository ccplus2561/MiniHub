// 氣氛層（階段 6）：頂部音效開關、依 state 變化播放音效、賓果慶祝動畫。
// 設計：只「訂閱」state 並比對前後差異，不介入 draw-view 的操作流程，也不修改 core。
//   抽出新的一筆 → 滾動聲 ＋ 結果音效
//   history 變短  → 撤回提示音
//   登錄名次      → 賓果慶祝音 ＋ 紅包彩帶動畫
import { getState, subscribe } from '../core/state.js';
import * as sound from '../audio/sound.js';
import { el } from '../utils/dom.js';

const CONFETTI_COUNT = 36;
const ENVELOPE_COUNT = 8;
const CELEBRATE_MS = 4200;
const CELEBRATE_REDUCED_MS = 2200;
const ROLL_SECONDS = 0.3; // 滾動聲長度，結果音效排在其後

/**
 * 純函式：比對前後狀態，回傳要觸發的事件清單（可在 Node 測試）。
 * 事件：{type:'draw', record} | {type:'undo'} | {type:'reset'} | {type:'rank', rank, tieCount} | {type:'rankRetract'}
 */
export function diffEvents(prev, next) {
  const events = [];
  const ph = prev.game.history.length;
  const nh = next.game.history.length;
  if (nh > ph) {
    events.push({ type: 'draw', record: next.game.history[nh - 1] });
  } else if (nh < ph) {
    events.push({ type: next.game.status === 'playing' ? 'undo' : 'reset' });
  }
  const pr = prev.game.ranks.length;
  const nr = next.game.ranks.length;
  if (nr > pr && nh >= ph) {
    const r = next.game.ranks[nr - 1];
    events.push({ type: 'rank', rank: r.rank, tieCount: r.tieCount });
  } else if (nr < pr && nh >= ph) {
    events.push({ type: 'rankRetract' });
  }
  return events;
}

function snapshot(state) {
  return { game: { history: state.game.history, ranks: state.game.ranks, status: state.game.status } };
}

export function prefersReducedMotion() {
  try {
    if (window.MiniHub && MiniHub.prefs().anim === false) return true; // 大廳關閉動畫
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// 音效開關由大廳設定決定（MiniHub.sfxOn）；單獨開啟本頁時預設開啟
const sfxOn = () => { try { return window.MiniHub ? MiniHub.sfxOn() : true; } catch { return true; } };

/** 依大廳設定同步音效引擎（開啟需在使用者手勢內，所以也掛在 pointerdown） */
function syncSound() {
  if (sfxOn()) { if (!sound.isEnabled()) sound.setEnabled(true); }
  else if (sound.isEnabled()) sound.setEnabled(false);
}

// 最近一次「抽獎相關音效」的時間：同一次操作已播抽獎／賓果／撤回音效時，不再疊加按鈕音效
let lastEffectAt = -1e9;

/** 依按鈕種類挑選介面音效；回傳 null 代表不播 */
function uiSoundFor(target) {
  const node = target.closest?.('button, summary, input[type="checkbox"]');
  if (!node || node.disabled || node.closest('[data-nosfx]')) return null;
  if (node.matches('input[type="checkbox"]')) return node.checked ? 'on' : 'off';
  if (node.closest('.stepper') || node.classList.contains('rule-ico')) return 'tick';
  if (node.matches('.btn-primary, .btn-gold, .btn-danger')) return 'confirm';
  if (node.matches('.btn-secondary') && node.closest('.modal-actions')) return 'back';
  return 'click';
}

/** 全頁按鈕音效（冒泡階段：目標按鈕的處理與 state 音效先執行，才能判斷是否已播抽獎音效） */
function initUiSounds() {
  document.addEventListener('click', (e) => {
    const name = uiSoundFor(e.target);
    if (!name) return;
    syncSound();
    if (performance.now() - lastEffectAt < 80) return;
    sound.play(name);
  });
}

export function initEffects() {
  initUiSounds();
  document.addEventListener('pointerdown', syncSound, true);
  try { MiniHub.onChange(syncSound); } catch { /* 單獨開啟 */ }
  // 大廳要求暫停（玩家點左側導覽）：停掉慶祝動畫與音效
  try { MiniHub.onPause(() => { document.querySelector('.celebrate')?.remove(); sound.setEnabled(false); }); } catch { /* 單獨開啟 */ }

  // ---- 依 state 變化觸發 ----
  let prev = snapshot(getState());

  function onState(state) {
    const events = diffEvents(prev, snapshot(state));
    prev = snapshot(state);
    for (const e of events) handle(e);
  }

  function handle(e) {
    syncSound();
    lastEffectAt = performance.now();
    switch (e.type) {
      case 'draw': {
        const kind = e.record.type;
        sound.play('roll');
        sound.play(kind, { delay: ROLL_SECONDS });
        break;
      }
      case 'undo':
        sound.play('undo');
        break;
      case 'rankRetract':
        sound.play('undo');
        break;
      case 'rank':
        sound.play('bingo');
        celebrate(e.rank, e.tieCount);
        break;
    }
  }

  onState(getState());
  subscribe(onState);
}

// ---- 賓果慶祝：CSS 紅包與彩帶 ----
let celebrateTimer = null;

export function celebrate(rank, tieCount = 1) {
  document.querySelector('.celebrate')?.remove();
  clearTimeout(celebrateTimer);

  const reduce = prefersReducedMotion();
  const banner = el('div', { class: 'celebrate-banner', role: 'status' },
    el('strong', {}, `🎉 第 ${rank} 名賓果！`),
    tieCount > 1 ? el('small', {}, `同時 ${tieCount} 人`) : null
  );
  const layer = el('div', { class: `celebrate${reduce ? ' is-static' : ''}` }, banner);

  if (!reduce) {
    const rand = (min, max) => min + Math.random() * (max - min);
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const piece = el('i', { class: `confetti c${i % 5}`, 'aria-hidden': 'true' });
      piece.style.setProperty('--x', `${rand(2, 98).toFixed(1)}vw`);
      piece.style.setProperty('--delay', `${rand(0, 1.2).toFixed(2)}s`);
      piece.style.setProperty('--dur', `${rand(2.4, 3.6).toFixed(2)}s`);
      piece.style.setProperty('--rot', `${Math.round(rand(360, 1080))}deg`);
      layer.append(piece);
    }
    for (let i = 0; i < ENVELOPE_COUNT; i++) {
      const env = el('span', { class: 'envelope', 'aria-hidden': 'true' }, '🧧');
      env.style.setProperty('--x', `${rand(4, 92).toFixed(1)}vw`);
      env.style.setProperty('--delay', `${rand(0, 1.4).toFixed(2)}s`);
      env.style.setProperty('--dur', `${rand(2.8, 3.8).toFixed(2)}s`);
      layer.append(env);
    }
  }

  document.body.append(layer);
  celebrateTimer = setTimeout(() => layer.remove(), reduce ? CELEBRATE_REDUCED_MS : CELEBRATE_MS);
}
