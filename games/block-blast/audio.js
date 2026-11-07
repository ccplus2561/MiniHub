(() => {
  let enabled = true, ctx = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

  function ac() {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, t0, d, o = {}) {
    const { type = 'sine', vol = 0.07, to } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + d + 0.03);
  }
  // 同時遵守大廳的「全部靜音／音效」設定（單獨開啟本頁時預設開啟）
  const hubOn = () => { try { return !window.MiniHub || MiniHub.sfxOn(); } catch (e) { return true; } };
  function play(type, level = 1) {
    if (!enabled || !hubOn()) return;
    try {
      if (!ac()) return;
      const t = ctx.currentTime;
      switch (type) {
        case 'pick': tone(440, t, 0.06, { type: 'triangle', vol: 0.04 }); break;
        case 'select': tone(520, t, 0.09, { type: 'triangle', vol: 0.05 }); break;
        case 'place': tone(320, t, 0.13, { type: 'triangle', vol: 0.09, to: 210 }); tone(660, t, 0.08, { vol: 0.035 }); break;
        case 'clear': {
          const n = Math.min(3 + level, 8);
          for (let i = 0; i < n; i++) tone(NOTES[i], t + i * 0.06, 0.24, { type: 'triangle', vol: 0.07 });
          break;
        }
        case 'error': tone(190, t, 0.16, { type: 'square', vol: 0.035, to: 120 }); break;
        case 'over': [523, 392, 330, 262].forEach((f, i) => tone(f, t + i * 0.17, 0.32, { type: 'triangle', vol: 0.07 })); break;
      }
    } catch (e) {}
  }
  window.GameAudio = {
    play,
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    isEnabled: () => enabled
  };
})();
