(() => {
  "use strict";
  /* OOXX 音效 + 背景音樂：全部用 Web Audio 即時合成（不用音檔）。
     對外只有 window.GameAudio：play(name) / musicStart() / musicStop() / sync() */

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, sfxBus = null, musicBus = null;

  /* ---------- 設定：完全交給 MiniHub（頂端音效／背景音樂按鈕 + 設定頁）；單獨開啟本頁時預設開啟 ---------- */
  const sfxOk = () => { try { return !window.MiniHub || MiniHub.sfxOn(); } catch (e) { return true; } };
  const musicOk = () => { try { return !window.MiniHub || MiniHub.musicOn(); } catch (e) { return true; } };

  /* ---------- 基礎 ---------- */
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 1; master.connect((window.MiniHub && MiniHub.volume ? MiniHub.volume(ctx, "sfx") : ctx.destination));
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.5;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
        musicBus.connect(lp); lp.connect((window.MiniHub && MiniHub.volume ? MiniHub.volume(ctx, "music") : ctx.destination));
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(bus, freq, t0, dur, type, vol, slideTo, atk) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + (atk || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(bus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- 音效 ---------- */
  const SOUNDS = {
    click:   t => { tone(sfxBus, 920, t, 0.05, "triangle", 0.05, 640); },
    hover:   t => { tone(sfxBus, 740, t, 0.04, "sine", 0.025, 880); },
    start:   t => { tone(sfxBus, 523.25, t, 0.09, "triangle", 0.08); tone(sfxBus, 784, t + 0.07, 0.14, "triangle", 0.08, 1046.5); },
    x:       t => { tone(sfxBus, 520, t, 0.09, "square", 0.05); tone(sfxBus, 390, t + 0.05, 0.1, "square", 0.04); },
    o:       t => { tone(sfxBus, 660, t, 0.12, "sine", 0.09, 880); },
    invalid: t => { tone(sfxBus, 180, t, 0.08, "sawtooth", 0.04); tone(sfxBus, 150, t + 0.07, 0.08, "sawtooth", 0.035); },
    reset:   t => { tone(sfxBus, 300, t, 0.1, "sine", 0.07, 600); tone(sfxBus, 600, t + 0.08, 0.1, "sine", 0.05, 900); },
    // 連成一條：掃線音 + 上行琶音 + 結尾和弦
    win: t => {
      t += 0.12;
      tone(sfxBus, 300, t, 0.28, "sawtooth", 0.035, 1250);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfxBus, f, t + 0.1 + i * 0.09, 0.24, "triangle", 0.1));
      [523.25, 659.25, 783.99].forEach(f => tone(sfxBus, f, t + 0.5, 0.5, "sine", 0.06, null, 0.03));
    },
    // 對手連成一條：下行小調
    lose: t => {
      t += 0.12;
      [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(sfxBus, f, t + i * 0.13, 0.26, "triangle", 0.08));
    },
    draw: t => { t += 0.1; tone(sfxBus, 440, t, 0.18, "triangle", 0.08); tone(sfxBus, 330, t + 0.16, 0.26, "triangle", 0.08); }
  };

  function play(name) {
    if (!sfxOk() || !SOUNDS[name] || !ensure()) return;
    try { SOUNDS[name](ctx.currentTime + 0.005); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 背景音樂：霓虹風 Am - F - C - G 循環 ---------- */
  const BPM = 96, STEP = 60 / BPM / 2;   // 八分音符
  const CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];   // Am F C G
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
  let want = false, playing = false, timer = 0, nextT = 0, step = 0;

  function schedule(i, t) {
    const ch = CHORDS[Math.floor(i / 8) % CHORDS.length], k = i % 8;
    if (k === 0) {
      tone(musicBus, hz(ch[0] - 24), t, STEP * 3.6, "triangle", 0.16, null, 0.02);                 // 低音
      ch.slice(1).forEach(m => tone(musicBus, hz(m), t, STEP * 8, "sine", 0.03, null, 0.35));      // 和弦墊音
    }
    if (k === 4) tone(musicBus, hz(ch[0] - 24), t, STEP * 3.2, "triangle", 0.12, null, 0.02);
    tone(musicBus, hz(ch[ARP[k]] + 12), t, STEP * 1.7, "square", 0.018, null, 0.01);               // 琶音
    if (k === 6 && Math.floor(i / 8) % 2 === 1) tone(musicBus, hz(ch[3] + 12), t, STEP * 2, "sine", 0.04);   // 點綴
  }
  function tick() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.35) { schedule(step++, nextT); nextT += STEP; }
  }
  function halt() { playing = false; clearInterval(timer); timer = 0; }
  function musicStart() {
    want = true;
    if (playing || !musicOk() || !ensure()) return;
    playing = true; nextT = ctx.currentTime + 0.08;
    try { tick(); timer = setInterval(() => { try { tick(); } catch (e) { /* 忽略 */ } }, 100); } catch (e) { halt(); }
  }
  function musicStop() { want = false; halt(); }

  /* ---------- 大廳設定／頂端按鈕改變：關閉就停、重新開啟就接著播 ---------- */
  function sync() { if (!musicOk()) halt(); else if (want) musicStart(); }
  try { window.MiniHub && MiniHub.onChange(sync); } catch (e) { /* 略過 */ }

  /* ---------- 瀏覽器要求使用者操作後才能出聲；分頁隱藏時暫停 ---------- */
  const unlock = () => { try { if (ensure() && want) sync(); } catch (e) { /* 忽略 */ } };
  ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
  addEventListener("pagehide", () => { halt(); });

  window.GameAudio = { play, musicStart, musicStop, sync };
})();
