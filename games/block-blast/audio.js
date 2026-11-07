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
  /* ---------- 背景音樂：柔和的 D 大調循環（即時合成，不需音檔） ---------- */
  const BPM = 84, STEP = 60 / BPM / 2;                       // 八分音符
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];   // D - Bm - G - A
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  let mBus = null, mPlaying = false, mWant = false, mTimer = 0, mNext = 0, mStep = 0;

  function mInit() {
    if (!ac()) return false;
    if (!mBus) {
      mBus = ctx.createGain(); mBus.gain.value = 0.55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      mBus.connect(lp); lp.connect(ctx.destination);
    }
    return true;
  }
  function mNote(t, f, d, type, vol, atk) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(mBus);
    o.start(t); o.stop(t + d + 0.03);
  }
  function mSchedule(i, t) {
    const ch = CHORDS[Math.floor(i / 8) % CHORDS.length], k = i % 8;
    if (k === 0) {
      mNote(t, hz(ch[0] - 12), STEP * 7.5, 'triangle', 0.12, 0.05);                         // 低音
      ch.slice(1).forEach(m => mNote(t, hz(m), STEP * 8, 'sine', 0.035, 0.4));              // 和弦墊音
    }
    mNote(t, hz(ch[ARP[k]] + 12), STEP * 1.8, 'triangle', 0.05, 0.01);                      // 琶音
    if (k === 4 && (Math.floor(i / 8) % 2 === 1)) mNote(t, hz(ch[3] + 24), STEP * 3, 'sine', 0.03, 0.02);   // 偶爾的高音點綴
  }
  function mTick() {
    if (!ctx) return;
    while (mNext < ctx.currentTime + 0.3) { mSchedule(mStep++, mNext); mNext += STEP; }
  }
  function mHalt() { mPlaying = false; clearInterval(mTimer); }
  const musicOk = () => { try { return !window.MiniHub || MiniHub.musicOn(); } catch (e) { return true; } };
  function musicStart() {
    mWant = true;
    if (mPlaying || !musicOk() || !mInit()) return;
    mPlaying = true; mNext = ctx.currentTime + 0.08;
    mTick(); mTimer = setInterval(mTick, 100);
  }
  function musicStop() { mWant = false; mHalt(); }
  // 大廳設定／頂端音樂按鈕改變：關閉就停、重新開啟就接著播
  function sync() { if (!musicOk()) mHalt(); else if (mWant) musicStart(); }
  try { window.MiniHub && MiniHub.onChange(sync); } catch (e) {}
  const unlock = () => { try { if (ac() && mWant) sync(); } catch (e) {} };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));

  window.GameAudio = { play, musicStart, musicStop, sync };
})();
