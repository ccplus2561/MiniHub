(() => {
  "use strict";

  // ===== 設定常數 =====
  const FANFARE_NOTES = [523, 659, 784, 1047];
  const FANFARE_STEP_MS = 110;

  // ===== 狀態（預設關閉，由使用者開啟）=====
  let ctx = null;
  let sfxOn = false;

  // ===== 內部工具 =====
  function canPlay() {
    try { return sfxOn && MiniHub.sfxOn(); } catch (e) { return sfxOn; }
  }

  // ===== 對外音效 =====
  function beep(freq = 660, dur = 0.09, type = "sine", gain = 0.12) {
    if (!canPlay()) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) { /* 音效失敗不影響遊戲 */ }
  }

  function fanfare() {
    FANFARE_NOTES.forEach((f, i) => {
      setTimeout(() => beep(f, 0.16, "triangle", 0.14), i * FANFARE_STEP_MS);
    });
  }

  // ===== 設定 =====
  function setSfx(on) {
    sfxOn = !!on;
  }

  function isSfxOn() {
    return sfxOn;
  }

  function suspend() {
    if (ctx && ctx.state === "running") ctx.suspend();
  }

  window.GameAudio = { beep, fanfare, setSfx, isSfxOn, suspend };
})();
