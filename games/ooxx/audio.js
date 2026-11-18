(() => {
  "use strict";
  /* OOXX 音效 + 背景音樂：全部用 Web Audio 即時合成（不用音檔）。
     對外只有 window.GameAudio：play(name) / musicStart() / musicStop() / sync() / toggle(kind) */

  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = "ooxx:audio:v1";
  let ctx = null, master = null, sfxBus = null, musicBus = null;

  /* ---------- 設定：大廳（parent.MiniHubPrefs）+ 本頁按鈕 ---------- */
  const local = { sfx: true, music: true };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && typeof d.sfx === "boolean") local.sfx = d.sfx;
    if (d && typeof d.music === "boolean") local.music = d.music;
  } catch (e) { /* 讀不到就用預設 */ }

  function hub() {   // 大廳設定 { mute, sfx, music }；單獨開啟本頁（或跨網域）時全部視為開啟
    try {
      const P = parent !== window ? parent : null;
      const f = P && (P.MiniHubGamePrefs || P.MiniHubPrefs);
      return (f && f()) || {};
    } catch (e) { return {}; }
  }
  const sfxOk = () => { const p = hub(); return !p.mute && p.sfx !== false && local.sfx; };
  const musicOk = () => { const p = hub(); return !p.mute && p.music !== false && local.music; };

  /* ---------- 基礎 ---------- */
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.5;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
        musicBus.connect(lp); lp.connect(master);
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

  /* ---------- 按鈕 data-audio="sfx" / "music" ---------- */
  function refresh() {
    document.querySelectorAll("[data-audio]").forEach(b => {
      const on = b.dataset.audio === "music" ? musicOk() : sfxOk();
      b.classList.toggle("off", !on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  function sync() {   // 大廳設定或本頁按鈕改變：關閉就停、重新開啟就接著播
    if (!musicOk()) halt(); else if (want) musicStart();
    refresh();
  }
  function toggle(kind) {
    if (kind !== "sfx" && kind !== "music") return;
    local[kind] = !local[kind];
    try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (e) { /* 無法儲存時忽略 */ }
    sync();
    if (kind === "sfx") play("click");
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-audio]");
    if (b) toggle(b.dataset.audio);
  });
  try { window.MiniHub && MiniHub.onChange(sync); } catch (e) { /* 略過 */ }
  document.addEventListener("DOMContentLoaded", refresh);

  /* ---------- 瀏覽器要求使用者操作後才能出聲；分頁隱藏時暫停 ---------- */
  const unlock = () => { try { if (ensure() && want) sync(); } catch (e) { /* 忽略 */ } };
  ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
  addEventListener("pagehide", () => { halt(); });

  window.GameAudio = { play, musicStart, musicStop, sync, toggle };
})();
