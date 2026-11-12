(() => {
  "use strict";

  // ===== 設定常數 =====
  const MASTER_VOLUME = 0.18;
  const NOTES = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };

  // ===== 狀態 =====
  let ctx = null;
  let master = null;

  // ===== 內部工具 =====
  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
    return ctx;
  }

  function canPlay() {
    try { return MiniHub.sfxOn(); } catch (e) { return true; }
  }

  function tone(freq, duration, type, delay) {
    const c = ensureContext();
    if (!c || !canPlay()) return;
    if (c.state === "suspended") c.resume();
    const start = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  // ===== 對外音效 =====
  function hover() {
    tone(NOTES.G5, 0.06, "triangle");
  }

  function select() {
    tone(NOTES.C5, 0.1, "triangle");
    tone(NOTES.E5, 0.12, "triangle", 0.07);
  }

  function enter() {
    tone(NOTES.C5, 0.12, "sine");
    tone(NOTES.E5, 0.12, "sine", 0.08);
    tone(NOTES.G5, 0.12, "sine", 0.16);
    tone(NOTES.C6, 0.25, "sine", 0.24);
  }

  function toggle() {
    tone(NOTES.E5, 0.08, "square");
  }

  function suspend() {
    if (ctx && ctx.state === "running") ctx.suspend();
  }

  window.GameAudio = { hover, select, enter, toggle, suspend };
})();
