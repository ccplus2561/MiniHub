// 雲端存檔：登入後，只在「遊戲進行中」保存設定與抽號紀錄；遊戲結束或開新局就清除（不保存）。
// 資料路徑 games/bingo/saves/{uid}（單筆上限 20000 字元，所以紀錄與設定都做精簡）
import { getState, setState, subscribe } from './state.js';
import { DEFAULT_SETTINGS } from '../config/defaults.js';
import { toast, confirmDialog } from '../utils/dom.js';

const TYPES = ['new', 'repeat', 'blank'];
const cloud = window.MiniHub && MiniHub.cloud ? MiniHub.cloud('bingo') : null;
let cloudUid = '';   // 已完成讀取（才允許寫入）的帳號
let busy = false;
let hasRemote = false; // 雲端目前是否有進行中的存檔（結束時才需要清除）
let applying = false;

const myUid = () => { try { return MiniHub.player().uid || ''; } catch { return ''; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pack(state) {
  const { settings, game } = state;
  const s = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (!same(settings[k], DEFAULT_SETTINGS[k])) s[k] = settings[k];
  const batches = [];
  const h = game.history.map((r) => {
    let b = -1;
    if (r.batchId != null) { b = batches.indexOf(r.batchId); if (b < 0) b = batches.push(r.batchId) - 1; }
    return [TYPES.indexOf(r.type), r.number, r.paid ? 1 : 0, b, r.ts];
  });
  return { v: 1, playing: true, s, h, b: batches, r: game.ranks };
}

function unpack(d) {
  if (!d || d.v !== 1 || d.playing !== true || !Array.isArray(d.h)) return null;
  const settings = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const def = DEFAULT_SETTINGS[k];
    const v = d.s && k in d.s ? d.s[k] : def;
    const ok = Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v));
    settings[k] = ok ? v : def;
  }
  settings.locked = true;
  const batches = Array.isArray(d.b) ? d.b : [];
  const history = [];
  for (const row of d.h) {
    if (!Array.isArray(row)) return null;
    const type = TYPES[row[0]];
    if (!type) return null;
    const seq = history.length + 1;
    history.push({ id: `d${seq}`, seq, type, number: type === 'blank' ? null : row[1], paid: row[2] === 1, batchId: row[3] >= 0 ? batches[row[3]] ?? null : null, ts: row[4] });
  }
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].type !== 'new'; i--) streak++;
  const ranks = Array.isArray(d.r) ? d.r : [];
  return {
    settings,
    game: { status: 'playing', history, paidDrawCount: history.filter((r) => r.paid).length, invalidStreak: streak, ranks },
  };
}

function queueSave() {
  if (!cloud || !cloudUid || cloudUid !== myUid() || applying) return;
  const st = getState();
  if (st.game.status === 'playing') { hasRemote = true; cloud.save(pack(st)); }
  else if (hasRemote) { hasRemote = false; cloud.save({ v: 1, playing: false }); cloud.flush(); } // 結束／開新局：清除存檔
}

async function syncCloud() {
  if (!cloud) return;
  const uid = myUid();
  if (!uid) { cloudUid = ''; hasRemote = false; return; }
  if (uid === cloudUid || busy) return;
  busy = true;
  try {
    const r = await cloud.load();
    if (!r.ok) return; // 讀取失敗：不寫入，避免覆蓋雲端資料
    const restored = unpack(r.data);
    hasRemote = !!restored;
    if (restored) {
      const local = getState().game.status;
      const take = local !== 'playing' || await confirmDialog({
        title: '載入雲端存檔？',
        message: '偵測到你上次進行中的抽獎盤，要載入嗎？目前畫面上的進行中資料會被取代。',
        confirmText: '載入',
      });
      if (take) {
        applying = true;
        try { setState({ settings: restored.settings, game: restored.game, ui: { tab: 'draw' } }); } finally { applying = false; }
        toast('已載入上次的遊戲進度');
      }
    }
    cloudUid = uid;
    queueSave();
  } finally { busy = false; }
}

export function initCloudSave() {
  if (!cloud) return;
  subscribe(queueSave);
  MiniHub.onChange(syncCloud);
  syncCloud();
  addEventListener('pagehide', () => cloud.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloud.flush(); });
}
