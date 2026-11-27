/* 1A2B 音訊：全部用 Web Audio 即時合成，不需要任何音檔。
   音效 / 背景音樂的開關與音量，一律跟著大廳頂端的「音效」「背景音樂」按鈕與設定頁（MiniHub.sfxOn / musicOn / volume）。 */
(() => {
  "use strict";

  // 大廳設定（全部靜音 / 音樂 / 音效）；單獨開啟本頁時 MiniHub 不存在，視為全部開啟
  const sfxAllowed = () => { try { return !window.MiniHub || MiniHub.sfxOn(); } catch (_) { return true; } };
  const musicAllowed = () => { try { return !window.MiniHub || MiniHub.musicOn(); } catch (_) { return true; } };

  let ctx = null, musicBus, sfxBus, timer = 0;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [0, 2, 4, 7, 9];
  const noteFor = (n) => 60 + PENTA[n % 5] + 12 * Math.floor(n / 5);   // 階數 → 五聲音階

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const vol = (kind) => (window.MiniHub && MiniHub.volume ? MiniHub.volume(ctx, kind) : ctx.destination);
    const sfxMaster = ctx.createGain(); sfxMaster.gain.value = 0.9; sfxMaster.connect(vol("sfx"));
    const musicMaster = ctx.createGain(); musicMaster.gain.value = 0.9; musicMaster.connect(vol("music"));
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxAllowed() ? 1 : 0; sfxBus.connect(sfxMaster);
    musicBus = ctx.createGain(); musicBus.gain.value = musicAllowed() ? 1 : 0;
    // 音樂加一點回音，營造空間感
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.45; fb.gain.value = 0.35; wet.gain.value = 0.4;
    musicBus.connect(musicMaster);
    musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicMaster);
    return true;
  }

  /* ---------- 基本發聲 ---------- */
  function tone(t, freq, dur, { type = "sine", vol = 0.2, attack = 0.005, bus = sfxBus, to = null, lp = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    o.connect(g);
    if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; g.connect(f); out = f; }
    out.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const pluck = (t, m, vol = 0.16, dur = 0.35) => {
    tone(t, hz(m), dur, { type: "triangle", vol, lp: 3500 });
    tone(t, hz(m + 12), dur * 0.6, { type: "sine", vol: vol * 0.3 });
  };

  /* ---------- 音效 ---------- */
  const ok = () => !!ctx && ctx.state === "running" && sfxAllowed();
  const sfx = {
    key(d) {                                    // 輸入數字：每個數字對應不同音高
      if (!ok()) return;
      tone(ctx.currentTime, hz(noteFor(+d % 10)), 0.11, { type: "triangle", vol: 0.12, lp: 3000 });
    },
    back() { if (!ok()) return; tone(ctx.currentTime, 520, 0.09, { type: "triangle", vol: 0.1, to: 380 }); },
    clear() { if (!ok()) return; const t = ctx.currentTime; tone(t, 600, 0.1, { type: "triangle", vol: 0.1, to: 300 }); tone(t + 0.06, 440, 0.12, { type: "triangle", vol: 0.08, to: 240 }); },
    select() { if (!ok()) return; tone(ctx.currentTime, 700, 0.07, { type: "sine", vol: 0.1 }); },
    lock() { if (!ok()) return; const t = ctx.currentTime; tone(t, 330, 0.08, { type: "square", vol: 0.04, lp: 1200 }); tone(t + 0.07, 495, 0.12, { type: "triangle", vol: 0.12 }); },
    unlock() { if (!ok()) return; const t = ctx.currentTime; tone(t, 495, 0.08, { type: "triangle", vol: 0.1 }); tone(t + 0.07, 330, 0.12, { type: "triangle", vol: 0.1 }); },
    click() { if (!ok()) return; tone(ctx.currentTime, 740, 0.07, { type: "triangle", vol: 0.1 }); },
    deny() { if (!ok()) return; const t = ctx.currentTime; tone(t, 170, 0.14, { type: "square", vol: 0.06, lp: 700 }); tone(t + 0.1, 140, 0.18, { type: "square", vol: 0.06, lp: 700 }); },
    // 送出猜測：A 越多高音越多、B 越多中音越多；0A0B 是一聲低沉的悶響
    guess(a, b) {
      if (!ok()) return;
      const t = ctx.currentTime;
      if (!a && !b) { tone(t, 150, 0.3, { type: "sine", vol: 0.2, to: 90 }); return; }
      let i = 0;
      for (let k = 0; k < Math.min(a, 6); k++, i++) pluck(t + i * 0.075, 79 + (k % 3) * 2, 0.14, 0.4);
      for (let k = 0; k < Math.min(b, 6); k++, i++) tone(t + i * 0.075, hz(64 + (k % 3) * 2), 0.28, { type: "sine", vol: 0.15 });
    },
    start() { if (!ok()) return; const t = ctx.currentTime; [0, 4, 7].forEach((s, i) => pluck(t + i * 0.07, 62 + s, 0.13, 0.5)); },
    win() {
      if (!ok()) return;
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16].forEach((s, i) => pluck(t + i * 0.09, 67 + s, 0.17, 0.7));
      tone(t + 0.45, hz(55), 1.0, { type: "sine", vol: 0.16 });
    },
    lose() { if (!ok()) return; const t = ctx.currentTime; [67, 64, 60, 55].forEach((m, i) => tone(t + i * 0.2, hz(m), 0.6, { type: "triangle", vol: 0.15, lp: 1800 })); }
  };

  /* ---------- 背景音樂：和弦鋪底 + 隨機鈴音（程式即時生成，不會重複得太死板） ---------- */
  const CHORDS = [                    // Dm7 → Bbmaj7 → Gm7 → A7
    { bass: 38, pad: [53, 57, 60, 64] },
    { bass: 34, pad: [50, 53, 57, 62] },
    { bass: 43, pad: [53, 58, 62, 65] },
    { bass: 33, pad: [52, 55, 61, 64] }
  ];
  const BEAT = 60 / 72;               // 72 BPM
  let nextBar = 0, barIdx = 0;

  function scheduleBar(t) {
    const ch = CHORDS[barIdx % CHORDS.length], len = BEAT * 4;
    barIdx++;
    if (!musicAllowed()) return;      // 音樂關閉時不排程，重新開啟後從下一小節接上
    ch.pad.forEach((m) => tone(t, hz(m), len + 1.2, { type: "sine", vol: 0.05, attack: 1.2, bus: musicBus }));
    tone(t, hz(ch.bass), len, { type: "triangle", vol: 0.09, attack: 0.08, bus: musicBus, lp: 600 });
    const pool = ch.pad.flatMap((m) => [m + 12, m + 24]);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < (i % 2 ? 0.3 : 0.65)) {
        const m = pool[Math.floor(Math.random() * pool.length)];
        tone(t + i * BEAT / 2, hz(m), 1.2, { type: "sine", vol: 0.045, bus: musicBus });
      }
    }
  }
  function tick() {
    if (!ctx || ctx.state !== "running") return;
    while (nextBar < ctx.currentTime + 1.0) { scheduleBar(Math.max(nextBar, ctx.currentTime + 0.05)); nextBar = Math.max(nextBar, ctx.currentTime) + BEAT * 4; }
  }
  function startMusic() {
    if (timer || !init()) return;
    nextBar = ctx.currentTime + 0.1;
    timer = setInterval(tick, 250);
    tick();
  }

  /* ---------- 解鎖（瀏覽器要求使用者操作後才能出聲）與分頁切換 ---------- */
  function unlock() {
    if (!init()) return;
    const go = () => { if (ctx.state === "running") { startMusic(); off(); } };
    ctx.resume().then(go, () => {});
    go();
  }
  const evs = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
  const off = () => evs.forEach((e) => document.removeEventListener(e, unlock, true));
  evs.forEach((e) => document.addEventListener(e, unlock, true));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  /* ---------- 跟大廳的按鈕同步 ---------- */
  function setBus(bus, on) { if (bus) { bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08); } }
  function sync() { if (ctx) { setBus(musicBus, musicAllowed()); setBus(sfxBus, sfxAllowed()); } }
  try { if (window.MiniHub) MiniHub.onChange(sync); } catch (_) { /* 略過 */ }

  window.GameAudio = sfx;
})();
