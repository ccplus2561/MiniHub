// 介面音效：Web Audio 即時合成（無音檔）。刻意低音量、柔和音色（正弦 / 三角波 + 低通），避免刺耳。
(() => {
  let ctx = null, bus = null, last = 0;
  const lastBy = {};
  const prefs = () => (window.MiniHubPrefs ? MiniHubPrefs() : {});

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const lp = ctx.createBiquadFilter();            // 低通：削掉高頻刺耳成分
    lp.type = "lowpass"; lp.frequency.value = 2200; lp.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();    // 壓縮：多音重疊時也不會突然變大聲
    const master = ctx.createGain(); master.gain.value = 0.7;
    lp.connect(comp); comp.connect(master); master.connect(ctx.destination);
    bus = lp;
    return ctx;
  }

  // [頻率 Hz, 起始秒, 長度秒, 選項]
  const T = "triangle";
  const SOUNDS = {
    move:    [[523, 0, .06, { vol: .05 }]],
    select:  [[494, 0, .07, { vol: .06 }]],
    click:   [[440, 0, .07, { type: T, vol: .07 }], [587, .05, .09, { type: T, vol: .07 }]],
    confirm: [[392, 0, .07, { type: T, vol: .07 }], [523, .06, .10, { type: T, vol: .07 }]],
    back:    [[523, 0, .07, { type: T, vol: .06 }], [392, .06, .10, { type: T, vol: .06 }]],
    on:      [[440, 0, .08, { type: T, vol: .07 }], [660, .07, .12, { type: T, vol: .07 }]],
    off:     [[660, 0, .08, { type: T, vol: .06 }], [440, .07, .12, { type: T, vol: .06 }]],
    open:    [[392, 0, .09, { type: T, vol: .07 }], [494, .07, .09, { type: T, vol: .07 }], [587, .14, .18, { type: T, vol: .07 }]],
    close:   [[587, 0, .08, { type: T, vol: .06 }], [494, .07, .08, { type: T, vol: .06 }], [392, .14, .15, { type: T, vol: .06 }]],
    deny:    [[262, 0, .13, { vol: .06, to: 215 }]]
  };

  function tone(f, at, dur, o) {
    const t = ctx.currentTime + 0.005 + at;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || .06, t + .012);       // 柔和起音，避免爆音
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + .03);
  }

  function play(name) {
    const p = prefs();
    if (p.mute || p.sfx === false) return;
    const def = SOUNDS[name];
    if (!def || !ensure()) return;
    const now = performance.now();
    if (now - (lastBy[name] || 0) < 35) return;                    // 按住不放時不連發
    lastBy[name] = last = now;
    if (ctx.state === "suspended") ctx.resume();
    def.forEach(([f, at, dur, o]) => tone(f, at, dur, o || {}));
  }
  play.recent = () => performance.now() - last < 80;
  window.MiniHubSfx = play;

  // 第一次操作時解鎖音訊（瀏覽器規定需使用者手勢）
  const unlock = () => { if (ensure() && ctx.state === "suspended") ctx.resume(); };
  ["pointerdown", "keydown"].forEach(t => document.addEventListener(t, unlock, { capture: true, once: false, passive: true }));
})();
