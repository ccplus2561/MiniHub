// 以 WebAudio 產生簡短音效（無音檔）。是否播放由大廳設定決定（MiniHub.sfxOn）。
let ctx;
export const isSoundOn = () => { try { return window.MiniHub ? MiniHub.sfxOn() : true; } catch { return true; } };
export function beep(freq = 660, dur = 0.09, type = 'sine', gain = 0.12) {
  if (!isSoundOn()) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* 靜默失敗 */ }
}
export function fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .16, 'triangle', .14), i * 110)); }
