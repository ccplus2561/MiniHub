/* 水果忍者音訊：全部用 Web Audio 即時合成，不需要任何音檔。
   音效／音樂是否播放由大廳設定決定（MiniHub.sfxOn / musicOn）；單獨開啟本頁時預設開啟。 */
(() => {
  "use strict";

  let ctx = null, master = null, musicBus = null;
  let musicPlaying = false, wantMusic = false, schedTimer = 0, nextTime = 0, step = 0;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    return true;
  }
  const unlock = () => { if (init() && ctx.state === "suspended") ctx.resume(); };

  /* ---------- 音效 ---------- */
  function blip({ type = "sine", from, to, vol, dur = 0.15 }) {
    if (!MiniHub.sfxOn() || !init()) return;
    unlock();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + 0.13);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.01);
  }

  /* ---------- 背景音樂：五聲音階的輕快循環 ---------- */
  const BPM = 108, STEP = 60 / BPM / 2;                       // 八分音符
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  // C 大調五聲：C D E G A；和弦根音循環 C - A - F - G
  const ROOTS = [48, 45, 41, 43];
  const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];
  const MELODY = [0, 2, 4, 2, 3, 2, 1, 2,  4, 5, 4, 3, 2, 3, 1, 0,
                  2, 4, 5, 4, 3, 2, 4, 2,  3, 1, 2, 3, 4, 2, 1, 0];

  function note(t, f, dur, type, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(t, hi) {
    const len = hi ? 0.04 : 0.08, n = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = "highpass"; f.frequency.value = hi ? 7000 : 2500;
    g.gain.value = hi ? 0.05 : 0.08;
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t);
  }
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8) % 4, root = ROOTS[bar], k = i % 8;
    if (k % 4 === 0) note(t, hz(root), STEP * 3.6, "triangle", 0.16, musicBus);              // 低音
    if (k === 0) [0, 7, 12].forEach(o => note(t, hz(root + 12 + o), STEP * 7.5, "sine", 0.045, musicBus)); // 和弦墊音
    if (i % 2 === 0 || Math.random() < 0.3) {
      const m = MELODY[i % MELODY.length]; note(t, hz(SCALE[m]), STEP * 1.6, "square", 0.04, musicBus); // 旋律
    }
    if (k === 2 || k === 6) drum(t, false);                                                    // 小鼓
    drum(t, true);                                                                             // 節拍
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.3) { scheduleStep(step++, nextTime); nextTime += STEP; }
  }
  function musicStart() {
    wantMusic = true;
    if (musicPlaying || !MiniHub.musicOn() || !init()) return;
    unlock();
    musicPlaying = true; nextTime = ctx.currentTime + 0.08;
    scheduler(); schedTimer = setInterval(scheduler, 100);
  }
  function halt() { musicPlaying = false; clearInterval(schedTimer); }
  function musicStop() { wantMusic = false; halt(); }
  // 大廳設定改變時：音樂關閉就停、重新開啟就接著播
  function sync() { if (!MiniHub.musicOn()) halt(); else if (wantMusic) musicStart(); }
  try { MiniHub.onChange(sync); } catch (_) {}

  const api = {
    slice: () => blip({ from: 510, to: 260, vol: 0.075 }),
    combo: () => blip({ from: 760, to: 1080, vol: 0.075 }),
    bomb:  () => blip({ type: "sawtooth", from: 115, to: 42, vol: 0.16 }),
    unlock, musicStart, musicStop, sync
  };

  window.GameAudio = api;
})();
