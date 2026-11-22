(() => {
  "use strict";

  // ── 設定常數 ──────────────────────────────────────────
  const KEY_SFX = "tetris.sfx";
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
    gameOver: [{ f: 260, d: 0.18, type: "triangle", v: 0.035 }, { f: 185, d: 0.28, type: "triangle", v: 0.03, at: 0.15 }]
  };

  // ── 狀態 ──────────────────────────────────────────────
  let context = null;
  let output = null;
  let localOn = true;

  // ── 本機儲存 ──────────────────────────────────────────
  function loadLocalOn() {
    try { return localStorage.getItem(KEY_SFX) !== "0"; } catch (e) { return true; }
  }

  function saveLocalOn() {
    try { localStorage.setItem(KEY_SFX, localOn ? "1" : "0"); } catch (e) { /* 略過 */ }
  }

  // ── 大廳設定（全部靜音 / 音效）；單獨開啟時預設開啟 ──
  function hubAllows() {
    try { return !window.MiniHub || window.MiniHub.sfxOn(); } catch (e) { return true; }
  }

  function isAllowed() {
    return localOn && hubAllows();
  }

  // ── 合成 ──────────────────────────────────────────────
  function createOutput(audioContext) {
    const filter = audioContext.createBiquadFilter();
    const master = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = LOWPASS_HZ;
    master.gain.value = MASTER_VOLUME;
    filter.connect(master);
    master.connect(audioContext.destination);
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

  // ── 音效開關按鈕（data-audio="sfx"） ─────────────────
  function refreshButtons() {
    document.querySelectorAll("[data-audio]").forEach(button => {
      const on = isAllowed();
      button.classList.toggle("off", !on);
      button.setAttribute("aria-pressed", String(on));
    });
  }

  function toggleLocal() {
    localOn = !localOn;
    saveLocalOn();
    refreshButtons();
    if (localOn) play("click");
  }

  function onDocumentClick(event) {
    if (event.target.closest("[data-audio]")) toggleLocal();
  }

  // ── 對外介面（只暴露 window.GameAudio） ─────────────
  const api = {};
  Object.keys(SOUNDS).forEach(name => { api[name] = () => play(name); });
  window.GameAudio = api;

  // ── 啟動 ──────────────────────────────────────────────
  localOn = loadLocalOn();
  document.addEventListener("click", onDocumentClick);
  refreshButtons();
  try { if (window.MiniHub) window.MiniHub.onChange(refreshButtons); } catch (e) { /* 略過 */ }
})();
