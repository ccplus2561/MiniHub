// 全域狀態：純邏輯、無 DOM。只存在記憶體中——關閉或重新整理網頁後一律回到初始狀態，不寫入任何儲存空間。
import { createDefaultState } from '../config/defaults.js';

let state = createDefaultState();
const listeners = new Set();

/** 取得目前狀態（唯讀參考，請勿直接修改；用 setState） */
export function getState() {
  return state;
}

/**
 * 更新狀態。patch 格式：{ settings?, game?, ui? }，每個區塊做淺層合併
 * （陣列與物件欄位會整個取代）。更新後通知訂閱者。
 */
export function setState(patch = {}) {
  state = {
    settings: { ...state.settings, ...(patch.settings || {}) },
    game: { ...state.game, ...(patch.game || {}) },
    ui: { ...state.ui, ...(patch.ui || {}) },
  };
  notify();
  return state;
}

/** 訂閱狀態變化，回傳取消訂閱函式 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of [...listeners]) {
    try {
      fn(state);
    } catch (err) {
      console.error('[state] 訂閱者發生錯誤', err);
    }
  }
}

/** 回到 setup 預設狀態 */
export function reset() {
  state = createDefaultState();
  notify();
  return state;
}
