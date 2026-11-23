(() => {
  "use strict";

  // ── 設定常數 ──────────────────────────────────────────
  const MUSIC_VOLUME = 0.5;
  const MUSIC_LOWPASS_HZ = 2200;
  const MUSIC_BPM = 124;
  const MUSIC_STEP = 60 / MUSIC_BPM / 2;       // 八分音符
  const MUSIC_LOOKAHEAD = 0.3;                  // 提前排程（秒）
  // 原創循環：Am – F – C – G，每小節 8 個八分音符（MIDI 音高）
  const MUSIC_BARS = [
    { bass: 45, chord: [57, 60, 64], lead: [72, null, 76, null, 79, null, 76, null] },
    { bass: 41, chord: [53, 57, 60], lead: [77, null, 76, null, 72, null, 69, null] },
    { bass: 48, chord: [55, 60, 64], lead: [74, null, 77, null, 79, null, 77, null] },
    { bass: 43, chord: [55, 59, 62], lead: [76, null, 74, null, 71, null, 72, null] }
  ];
  const ARPEGGIO = [0, 1, 2, 1, 0, 1, 2, 1];
  const BASS_STEPS = [0, 4];
  const MASTER_VOLUME = 0.8;
  const LOWPASS_HZ = 2600;   // 柔和、不刺耳
  // 每個音效 = 一串音符：f 頻率、d 長度(秒)、type 波形、v 音量、at 延後(秒)、to 滑音終點
  const SOUNDS = {
    click:    [{ f: 460, d: 0.05, type: "triangle", v: 0.02 }],
    start:    [{ f: 392, d: 0.09, type: "triangle", v: 0.03 }, { f: 523, d: 0.12, type: "triangle", v: 0.03, at: 0.08 }],
    move:     [{ f: 280, d: 0.045, type: "sine", v: 0.018 }],
    rotate:   [{ f: 390, d: 0.07, type: "triangle", v: 0.025 }],
    drop:     [{ f: 125, d: 0.12, type: "triangle", v: 0.04 }],
    clear:    [{ f: 520, d: 0.09, type: "sine", v: 0.035 }, { f: 720, d: 0.12, type: "sine", v: 0.03, at: 0.075 }],
    prop:     [{ f: 600, d: 0.08, type: "square", v: 0.012 }, { f: 450, d: 0.1, type: "square", v: 0.012, at: 0.07 }],
    theme:    [{ f: 523, d: 0.1, type: "sine", v: 0.03 }, { f: 659, d: 0.1, type: "sine", v: 0.03, at: 0.09 }, { f: 784, d: 0.16, type: "sine", v: 0.03, at: 0.18 }],
    error:    [{ f: 160, d: 0.12, type: "square", v: 0.012 }, { f: 130, d: 0.16, type: "square", v: 0.012, at: 0.09 }],
    gameOver: [{ f: 260, d: 0.18, type: "triangle", v: 0.035 }, { f: 185, d: 0.28, type: "triangle", v: 0.03, at: 0.15 }]
  };

  // ── 狀態 ──────────────────────────────────────────────
  let context = null;
  let output = null;
  let musicBus = null;
  let musicWanted = false;      // 遊戲要求播放（進行中）
  let musicTimer = null;
  let musicNext = 0;
  let musicIndex = 0;

  // ── 音效 / 音樂開關統一由大廳控制；單獨開啟時預設開啟 ──
  function hubAllows() {
    try { return !window.MiniHub || window.MiniHub.sfxOn(); } catch (e) { return true; }
  }

  function hubMusicAllows() {
    try { return !window.MiniHub || window.MiniHub.musicOn(); } catch (e) { return true; }
  }

  function isAllowed() {
    return hubAllows();
  }

  function isMusicAllowed() {
    return hubMusicAllows();
  }

  // ── 合成 ──────────────────────────────────────────────
  function createOutput(audioContext) {
    const filter = audioContext.createBiquadFilter();
    const master = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = LOWPASS_HZ;
    master.gain.value = MASTER_VOLUME;
    filter.connect(master);
    master.connect((window.MiniHub && MiniHub.volume ? MiniHub.volume(audioContext, "sfx") : audioContext.destination));
    return filter;
  }

  function getContext() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      output = createOutput(context);
    }
    if (context.state === "suspended") context.resume();
    return context;
  }

  function playNote(audioContext, note) {
    const start = audioContext.currentTime + (note.at || 0);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.f, start);
    if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.d);
    gain.gain.setValueAtTime(note.v, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(start);
    oscillator.stop(start + note.d + 0.02);
  }

  function play(name) {
    if (!isAllowed()) return;
    const audioContext = getContext();
    if (!audioContext) return;
    SOUNDS[name].forEach(note => playNote(audioContext, note));
  }

  // ── 背景音樂（即時合成，不用音檔）─────────────────────
  const midiToHz = note => 440 * Math.pow(2, (note - 69) / 12);

  function createMusicBus(audioContext) {
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = MUSIC_LOWPASS_HZ;
    gain.gain.value = MUSIC_VOLUME;
    gain.connect(filter);
    filter.connect((window.MiniHub && MiniHub.volume ? MiniHub.volume(audioContext, "music") : audioContext.destination));
    return gain;
  }

  function musicNote(audioContext, start, midi, length, type, volume, attack) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = midiToHz(midi);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain);
    gain.connect(musicBus);
    oscillator.start(start);
    oscillator.stop(start + length + 0.03);
  }

  function scheduleMusicStep(audioContext, index, start) {
    const bar = MUSIC_BARS[Math.floor(index / 8) % MUSIC_BARS.length];
    const step = index % 8;
    if (BASS_STEPS.includes(step)) musicNote(audioContext, start, bar.bass - 12, MUSIC_STEP * 3.6, "triangle", 0.1, 0.02);
    musicNote(audioContext, start, bar.chord[ARPEGGIO[step]], MUSIC_STEP * 1.7, "sine", 0.045, 0.01);
    const lead = bar.lead[step];
    if (lead !== null) musicNote(audioContext, start, lead, MUSIC_STEP * 1.8, "triangle", 0.05, 0.015);
  }

  function musicTick() {
    if (!context) return;
    while (musicNext < context.currentTime + MUSIC_LOOKAHEAD) {
      scheduleMusicStep(context, musicIndex, musicNext);
      musicIndex += 1;
      musicNext += MUSIC_STEP;
    }
  }

  function haltMusic() {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }

  function playMusic() {
    if (musicTimer !== null || !isMusicAllowed()) return;
    const audioContext = getContext();
    if (!audioContext) return;
    if (!musicBus) musicBus = createMusicBus(audioContext);
    musicNext = audioContext.currentTime + 0.08;
    musicTimer = window.setInterval(musicTick, 100);
    musicTick();
  }

  function musicStart() {
    musicWanted = true;
    playMusic();
  }

  function musicStop() {
    musicWanted = false;
    haltMusic();
  }

  // 大廳設定改變：關閉就停、重新開啟就接著播
  function syncMusic() {
    if (!isMusicAllowed()) haltMusic();
    else if (musicWanted) playMusic();
  }

  function unlockMusic() {
    if (musicWanted) syncMusic();
  }

  function onAudioSettingsChange() {
    syncMusic();
  }

  // ── 對外介面（只暴露 window.GameAudio） ─────────────
  const api = {};
  Object.keys(SOUNDS).forEach(name => { api[name] = () => play(name); });
  api.musicStart = musicStart;
  api.musicStop = musicStop;
  window.GameAudio = api;

  // ── 啟動 ──────────────────────────────────────────────
  ["pointerdown", "keydown", "touchstart"].forEach(name => document.addEventListener(name, unlockMusic, { passive: true }));
  try { if (window.MiniHub) window.MiniHub.onChange(onAudioSettingsChange); } catch (e) { /* 略過 */ }
})();
