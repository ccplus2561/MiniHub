/* Tile Bloom 音訊：全部用 Web Audio 即時合成，不需要任何音檔 */
(() => {
  "use strict";

  const KEY = "tileBloom2048Audio";
  const prefs = { music: true, sfx: true };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) { /* 略過 */ } };

  // 大廳設定（全部靜音／音樂／音效）優先；單獨開啟本頁時 MiniHub 不存在或皆預設開啟
  const hubSfx = () => { try { return !window.MiniHub || MiniHub.sfxOn(); } catch (_) { return true; } };
  const hubMusic = () => { try { return !window.MiniHub || MiniHub.musicOn(); } catch (_) { return true; } };
  const sfxAllowed = () => prefs.sfx && hubSfx();
  const musicAllowed = () => prefs.music && hubMusic();

  let ctx = null, master, musicBus, sfxBus, noiseBuf, timer = 0;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [0, 2, 4, 7, 9];
  const noteFor = n => 60 + PENTA[n % 5] + 12 * Math.floor(n / 5);   // 方塊階數 → 五聲音階

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicAllowed() ? 1 : 0;
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxAllowed() ? 1 : 0;
    // 音樂加一點回音，營造空間感
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.42; fb.gain.value = 0.35; wet.gain.value = 0.45;
    musicBus.connect(master);
    musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
  function noise(t, dur, { vol = 0.1, f0 = 600, f1 = 2400, q = 1.2 } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = "bandpass"; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.05);
  }
  const pluck = (t, m, vol = 0.18, dur = 0.35) => {
    tone(t, hz(m), dur, { type: "triangle", vol, lp: 3500 });
    tone(t, hz(m + 12), dur * 0.6, { type: "sine", vol: vol * 0.35 });
  };

  /* ---------- 音效 ---------- */
  const ok = () => !!ctx && ctx.state === "running" && sfxAllowed();
  const sfx = {
    move() { if (!ok()) return; noise(ctx.currentTime, 0.11, { vol: 0.07, f0: 500, f1: 2200 }); },
    merge(v) {
      if (!ok()) return;
      const t = ctx.currentTime, n = Math.max(0, Math.log2(v) - 1), m = noteFor(n);
      pluck(t, m, 0.2, 0.4);
      tone(t, hz(m - 12), 0.18, { type: "sine", vol: 0.12 });
    },
    mile(v) {                                   // 512 以上：上行琶音，階數越高音越多
      if (!ok()) return;
      const t = ctx.currentTime, level = Math.min(Math.log2(v) - 8, 9), n = Math.max(0, Math.log2(v) - 1);
      const count = Math.min(4 + Math.floor(level / 2), 8);
      for (let i = 0; i < count; i++) pluck(t + i * 0.07, noteFor(n - 3 + i * 2) + 12 * (i > 4 ? 1 : 0), 0.17, 0.6);
      tone(t, hz(noteFor(n) - 12), 0.9, { type: "sine", vol: 0.2 });
      noise(t, 0.5, { vol: 0.05, f0: 3000, f1: 9000, q: 0.8 });
    },
    select() { if (!ok()) return; const t = ctx.currentTime; tone(t, 660, 0.12, { type: "triangle", vol: 0.14 }); tone(t + 0.06, 880, 0.14, { type: "triangle", vol: 0.12 }); },
    remove() { if (!ok()) return; const t = ctx.currentTime; tone(t, 520, 0.22, { type: "triangle", vol: 0.16, to: 140 }); noise(t, 0.2, { vol: 0.08, f0: 2500, f1: 400 }); },
    swap() { if (!ok()) return; const t = ctx.currentTime; tone(t, 400, 0.16, { type: "sine", vol: 0.16, to: 800 }); tone(t + 0.1, 800, 0.18, { type: "sine", vol: 0.14, to: 400 }); },
    error() { if (!ok()) return; const t = ctx.currentTime; tone(t, 160, 0.16, { type: "square", vol: 0.07, lp: 700 }); tone(t + 0.1, 130, 0.2, { type: "square", vol: 0.07, lp: 700 }); },
    undo() { if (!ok()) return; const t = ctx.currentTime; tone(t, 700, 0.2, { type: "triangle", vol: 0.14, to: 350 }); },
    click() { if (!ok()) return; tone(ctx.currentTime, 740, 0.07, { type: "triangle", vol: 0.1 }); },
    start() { if (!ok()) return; const t = ctx.currentTime; [0, 4, 7].forEach((s, i) => pluck(t + i * 0.07, 64 + s, 0.14, 0.5)); },
    over() { if (!ok()) return; const t = ctx.currentTime; [67, 64, 60, 55].forEach((m, i) => tone(t + i * 0.22, hz(m), 0.7, { type: "triangle", vol: 0.17, lp: 1800 })); }
  };

  /* ---------- 背景音樂：和弦鋪底 + 隨機琶音（程式即時生成，不會重複得太死板） ---------- */
  const CHORDS = [                    // Am7 → Fmaj7 → Cmaj7 → G6
    { bass: 45, pad: [57, 60, 64, 67] },
    { bass: 41, pad: [53, 57, 60, 64] },
    { bass: 48, pad: [55, 59, 64, 67] },
    { bass: 43, pad: [55, 59, 62, 64] }
  ];
  const BEAT = 60 / 68;               // 68 BPM
  let nextBar = 0, barIdx = 0;

  function scheduleBar(t) {
    const ch = CHORDS[barIdx % CHORDS.length], len = BEAT * 4;
    barIdx++;
    ch.pad.forEach(m => tone(t, hz(m), len + 1.2, { type: "sine", vol: 0.05, attack: 1.2, bus: musicBus }));
    tone(t, hz(ch.bass), len, { type: "triangle", vol: 0.09, attack: 0.08, bus: musicBus, lp: 600 });
    const pool = ch.pad.flatMap(m => [m + 12, m + 24]);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < (i % 2 ? 0.35 : 0.7)) {
        const m = pool[Math.floor(Math.random() * pool.length)];
        tone(t + i * BEAT / 2, hz(m), 1.1, { type: "triangle", vol: 0.045, bus: musicBus, lp: 2600 });
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
  const off = () => evs.forEach(e => document.removeEventListener(e, unlock, true));
  evs.forEach(e => document.addEventListener(e, unlock, true));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  /* ---------- 開關 ---------- */
  function setBus(bus, on) { if (bus) { bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08); } }
  function syncBuses() {
    if (init()) { setBus(musicBus, musicAllowed()); setBus(sfxBus, sfxAllowed()); }
    refreshButtons();
  }
  function refreshButtons() {
    document.querySelectorAll("[data-audio]").forEach(b => {
      const on = b.dataset.audio === "music" ? musicAllowed() : sfxAllowed();
      b.classList.toggle("off", !on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  function toggle(kind) {
    prefs[kind] = !prefs[kind];
    save();
    syncBuses();
    if (prefs[kind]) { unlock(); if (kind === "sfx") setTimeout(sfx.click, 30); }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-audio]");
    if (b) toggle(b.dataset.audio);
  });
  refreshButtons();
  try { if (window.MiniHub) MiniHub.onChange(() => { if (ctx) syncBuses(); else refreshButtons(); }); } catch (_) { /* 略過 */ }

  window.GameAudio = sfx;
})();
