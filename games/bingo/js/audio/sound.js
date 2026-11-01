// Web Audio 振盪器合成音效（不使用外部音檔）。
// 重點：
// 1. AudioContext 只在「使用者點擊開啟」的同一次手勢內建立並 resume()，載入頁面時完全無聲、也不會觸發瀏覽器警告。
// 2. 關閉時 play() 為無動作、不報錯；不支援 Web Audio 的環境同樣安全。
// 3. 每個音符的 oscillator／gain 播完即 disconnect 釋放；同時存活節點有上限，連抽也不會累積。

/**
 * 音效定義（純資料，可在 Node 測試）。
 * 每個音符：t 開始秒數、dur 長度、freq 起始頻率、freqEnd 結束頻率（滑音，可省略）、type 波形、gain 音量。
 * 六種音效的音色與節奏刻意拉開：
 *   roll    ＝ 連續輕快的「嗒嗒嗒」上行（滾動）
 *   new     ＝ 明亮上行雙音「叮咚」（新號）
 *   repeat  ＝ 兩聲平的低頻方波「嗶嗶」（重複）
 *   blank   ＝ 單一下滑鋸齒波「喔～」（銘謝惠顧）
 *   bingo   ＝ 上行琶音＋和弦的小號式慶祝（賓果）
 *   undo    ＝ 短促下滑「咻」（撤回）
 */
export const SOUND_DEFS = {
  roll: {
    duration: 0.34,
    notes: Array.from({ length: 8 }, (_, i) => ({
      t: i * 0.04, dur: 0.03, freq: 520 + i * 70, type: 'triangle', gain: 0.35,
    })),
  },
  new: {
    duration: 0.62,
    notes: [
      { t: 0, dur: 0.22, freq: 880, type: 'sine', gain: 0.5 },
      { t: 0, dur: 0.22, freq: 1760, type: 'sine', gain: 0.12 },
      { t: 0.14, dur: 0.46, freq: 1318.5, type: 'sine', gain: 0.5 },
      { t: 0.14, dur: 0.46, freq: 2637, type: 'sine', gain: 0.1 },
    ],
  },
  repeat: {
    duration: 0.42,
    notes: [
      { t: 0, dur: 0.14, freq: 300, type: 'square', gain: 0.22 },
      { t: 0.22, dur: 0.14, freq: 300, type: 'square', gain: 0.22 },
    ],
  },
  blank: {
    duration: 0.7,
    notes: [
      { t: 0, dur: 0.65, freq: 440, freqEnd: 150, type: 'sawtooth', gain: 0.22 },
      { t: 0, dur: 0.65, freq: 443, freqEnd: 152, type: 'sawtooth', gain: 0.12 },
    ],
  },
  bingo: {
    duration: 1.6,
    notes: [
      { t: 0, dur: 0.16, freq: 523.25, type: 'triangle', gain: 0.45 },
      { t: 0.12, dur: 0.16, freq: 659.25, type: 'triangle', gain: 0.45 },
      { t: 0.24, dur: 0.16, freq: 783.99, type: 'triangle', gain: 0.45 },
      { t: 0.36, dur: 0.24, freq: 1046.5, type: 'triangle', gain: 0.5 },
      { t: 0.62, dur: 0.9, freq: 523.25, type: 'triangle', gain: 0.32 },
      { t: 0.62, dur: 0.9, freq: 659.25, type: 'triangle', gain: 0.32 },
      { t: 0.62, dur: 0.9, freq: 783.99, type: 'triangle', gain: 0.32 },
      { t: 0.62, dur: 0.9, freq: 1046.5, type: 'sine', gain: 0.3 },
      { t: 0.8, dur: 0.08, freq: 2093, type: 'sine', gain: 0.18 },
      { t: 0.92, dur: 0.08, freq: 2349, type: 'sine', gain: 0.18 },
      { t: 1.04, dur: 0.08, freq: 2637, type: 'sine', gain: 0.18 },
    ],
  },
  undo: {
    duration: 0.22,
    notes: [{ t: 0, dur: 0.18, freq: 720, freqEnd: 360, type: 'sine', gain: 0.4 }],
  },
};


const MASTER_GAIN = 0.6;
const MAX_ACTIVE_NODES = 80; // 安全上限：極端情況下直接略過，避免節點堆積

/** 取得瀏覽器的 AudioContext 建構子（含舊版 Safari 的 webkit 前綴）；不支援回傳 null */
function detectAudioContext() {
  const g = globalThis;
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/**
 * 建立音效控制器。getAudioContextClass 可注入（測試用），預設每次呼叫時才偵測瀏覽器環境。
 */
export function createSound({ getAudioContextClass = detectAudioContext } = {}) {
  let enabled = false;
  let ctx = null;
  let master = null;
  let active = 0;
  let failed = false; // 建立 AudioContext 失敗過一次就不再重試，避免重複報錯

  function isSupported() {
    return !!getAudioContextClass();
  }

  /** 必須在使用者手勢內呼叫（開關按鈕的 click），才能建立並解鎖 AudioContext */
  function unlock() {
    if (failed) return false;
    try {
      if (!ctx) {
        const Ctor = getAudioContextClass();
        if (!Ctor) {
          failed = true;
          return false;
        }
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
      }
      // 在使用者手勢內一律呼叫 resume()（已在執行中時為無害空操作），確保各瀏覽器都真正解鎖
      if (typeof ctx.resume === 'function') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      // iOS Safari：在手勢內播一個極短的靜音緩衝，確保真正解鎖
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      }
      return true;
    } catch (err) {
      failed = true;
      ctx = null;
      master = null;
      console.warn('[sound] 無法啟用音效', err);
      return false;
    }
  }

  /** 開關音效。開啟需在使用者手勢內呼叫。回傳最終是否啟用（不支援或失敗時為 false） */
  function setEnabled(flag) {
    if (flag) {
      enabled = unlock();
    } else {
      enabled = false;
      try {
        if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') {
          const p = ctx.suspend();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      } catch {
        /* 忽略 */
      }
    }
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  /**
   * 播放音效。delay 為延後秒數（用 AudioContext 時間排程，不需計時器，撤回／關閉也不會殘留）。
   * 關閉、不支援或任何錯誤時都靜默略過。
   */
  function play(name, { delay = 0 } = {}) {
    if (!enabled || !ctx || !master) return false;
    const def = SOUND_DEFS[name];
    if (!def) return false;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      if (active + def.notes.length > MAX_ACTIVE_NODES) return false;
      const base = ctx.currentTime + 0.02 + Math.max(0, delay);
      for (const n of def.notes) scheduleNote(base, n);
      return true;
    } catch (err) {
      console.warn('[sound] 播放失敗', err);
      return false;
    }
  }

  function scheduleNote(base, n) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const t0 = base + n.t;
    const t1 = t0 + n.dur;
    osc.type = n.type;
    osc.frequency.setValueAtTime(n.freq, t0);
    if (n.freqEnd) osc.frequency.exponentialRampToValueAtTime(n.freqEnd, t1);
    // 包絡線：快速淡入、指數淡出，避免爆音
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(n.gain, t0 + Math.min(0.012, n.dur / 3));
    amp.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(amp);
    amp.connect(master);
    active++;
    osc.onended = () => {
      active = Math.max(0, active - 1);
      try {
        osc.disconnect();
        amp.disconnect();
      } catch {
        /* 已釋放 */
      }
    };
    osc.start(t0);
    osc.stop(t1 + 0.03);
  }

  return { play, setEnabled, isEnabled, isSupported, _activeNodes: () => active };
}

// 全站共用的單一實例
const sound = createSound();
export const play = sound.play;
export const setEnabled = sound.setEnabled;
export const isEnabled = sound.isEnabled;
export const isSupported = sound.isSupported;
export default sound;
