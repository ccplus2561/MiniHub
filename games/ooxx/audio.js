(() => {
  "use strict";

  let ctx = null;

  // 音效是否播放由大廳設定決定（含「全部靜音」）；單獨開啟本頁時預設開啟
  const sfxOn = () => { try { return !window.MiniHub || MiniHub.sfxOn(); } catch (e) { return true; } };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    x:       () => { tone(520, 0, 0.09, "square", 0.05); tone(390, 0.05, 0.1, "square", 0.04); },
    o:       () => { tone(660, 0, 0.12, "sine", 0.09, 880); },
    win:     () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.22, "triangle", 0.1)); },
    draw:    () => { tone(440, 0, 0.18, "triangle", 0.08); tone(330, 0.16, 0.26, "triangle", 0.08); },
    reset:   () => { tone(300, 0, 0.1, "sine", 0.07, 600); },
    invalid: () => { tone(180, 0, 0.08, "sawtooth", 0.04); }
  };

  window.NeonAudio = {
    play(name) {
      if (!sfxOn()) return;
      const fn = SOUNDS[name];
      if (!fn || !ensure()) return;
      try { fn(); } catch (e) { /* 忽略 */ }
    }
  };
})();
