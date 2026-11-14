(() => {
  "use strict";

  // 玩家端音效（Web Audio 振盪器合成，不使用音檔）。
  // 是否發聲只看大廳設定 MiniHub.sfxOn()（已考慮「全部靜音」）；本頁沒有獨立的音效開關。
  // AudioContext 在第一次點擊／按鍵（使用者手勢）時建立並解鎖，之後即使是主持人抽號觸發的自動標記也能發聲。
  // 本頁沒有背景音樂，所以不使用 MiniHub.musicOn()。

  const MAX_ACTIVE = 60; // 同時存活的音符上限，避免節點堆積
  let ctx = null;
  let active = 0;
  let failed = false;

  const sfxAllowed = () => { try { return MiniHub.sfxOn(); } catch (e) { return true; } };

  // 音效定義：[開始秒數, 頻率, 長度秒, 波形, 音量]
  const DEFS = {
    // ---- 介面按鈕（輕、短）----
    tap: [[0, 660, 0.05, "sine", 0.10]],
    confirm: [[0, 660, 0.06, "sine", 0.11], [0.06, 880, 0.09, "sine", 0.11]],
    cancel: [[0, 520, 0.07, "sine", 0.10], [0.07, 400, 0.08, "sine", 0.10]],
    warn: [[0, 300, 0.07, "triangle", 0.13], [0.09, 240, 0.09, "triangle", 0.13]],
    toggleOn: [[0, 600, 0.06, "sine", 0.11], [0.06, 900, 0.08, "sine", 0.11]],
    toggleOff: [[0, 700, 0.06, "sine", 0.11], [0.06, 450, 0.08, "sine", 0.11]],
    // ---- 連成線：第 1、2、3、4 條以上各有不同音效（越多條越豐富）----
    line1: [ // 叮咚
      [0, 880, 0.18, "sine", 0.16], [0.12, 1318, 0.32, "sine", 0.16],
    ],
    line2: [ // 三連上行＋長音
      [0, 659, 0.12, "triangle", 0.15], [0.1, 784, 0.12, "triangle", 0.15], [0.2, 1047, 0.12, "triangle", 0.15], [0.32, 1318, 0.34, "triangle", 0.16],
    ],
    line3: [ // 琶音＋和弦
      [0, 523, 0.14, "triangle", 0.15], [0.09, 659, 0.14, "triangle", 0.15], [0.18, 784, 0.14, "triangle", 0.15], [0.27, 1047, 0.18, "triangle", 0.16],
      [0.45, 523, 0.5, "triangle", 0.09], [0.45, 659, 0.5, "triangle", 0.09], [0.45, 784, 0.5, "triangle", 0.09], [0.45, 1047, 0.5, "sine", 0.09],
    ],
    line4: [ // 兩個八度琶音＋大和弦＋閃光
      [0, 523, 0.12, "triangle", 0.15], [0.08, 659, 0.12, "triangle", 0.15], [0.16, 784, 0.12, "triangle", 0.15], [0.24, 1047, 0.12, "triangle", 0.15],
      [0.32, 1319, 0.12, "triangle", 0.15], [0.4, 1568, 0.2, "triangle", 0.16],
      [0.62, 523, 0.8, "triangle", 0.09], [0.62, 659, 0.8, "triangle", 0.09], [0.62, 784, 0.8, "triangle", 0.09], [0.62, 1047, 0.8, "sine", 0.09], [0.62, 1568, 0.8, "sine", 0.07],
      [0.78, 2093, 0.08, "sine", 0.08], [0.9, 2349, 0.08, "sine", 0.08], [1.02, 2637, 0.1, "sine", 0.08],
    ],
  };

  function ensureCtx() {
    if (ctx || failed) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { failed = true; ctx = null; }
    return ctx;
  }

  function note(base, [t, freq, dur, type, gain]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = base + t, t1 = t0 + dur;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g).connect(ctx.destination);
    active++;
    osc.onended = () => { active = Math.max(0, active - 1); try { osc.disconnect(); g.disconnect(); } catch (e) { /* 已釋放 */ } };
    osc.start(t0);
    osc.stop(t1 + 0.03);
  }

  function play(name) {
    if (!sfxAllowed() || !ctx) return false;
    const def = DEFS[name];
    if (!def || active + def.length > MAX_ACTIVE) return false;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const base = ctx.currentTime + 0.02;
      for (const n of def) note(base, n);
      return true;
    } catch (e) { return false; }
  }

  /** 單一音（標記格子用） */
  function beep(freq = 660, dur = 0.09, type = "sine", gain = 0.12) {
    if (!sfxAllowed() || !ctx) return;
    if (active + 1 > MAX_ACTIVE) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      note(ctx.currentTime + 0.01, [0, freq, dur, type, gain]);
    } catch (e) { /* 音效失敗不影響遊戲 */ }
  }

  /** 連成線的音效：依目前總線數（1、2、3、4 條以上）各自不同 */
  function line(count) {
    return play("line" + Math.min(4, Math.max(1, count | 0)));
  }

  function suspend() {
    try { if (ctx && ctx.state === "running") ctx.suspend(); } catch (e) { /* 忽略 */ }
  }

  // 第一次使用者手勢：建立並解鎖 AudioContext（大廳音效關閉時不建立）
  const arm = () => {
    if (!sfxAllowed()) return;
    if (ensureCtx() && ctx.state === "suspended") { try { ctx.resume(); } catch (e) { /* 忽略 */ } }
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) addEventListener(ev, arm, { capture: true, passive: true });

  // 每個按鈕的點擊音效（事件委派）。格子本身（.num）有自己的標記音，不重複發聲；加 data-nosfx 可略過單一按鈕。
  addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("button, a.icon-btn, input[type=\"checkbox\"]") : null;
    if (!t || t.disabled || t.closest("[data-nosfx]") || t.classList.contains("num")) return;
    let name = "tap";
    if (t.type === "checkbox") name = t.checked ? "toggleOn" : "toggleOff";
    else if (t.classList.contains("danger")) name = "warn";
    else if (t.classList.contains("primary")) name = "confirm";
    else if (/^(取消|關閉|返回|知道了)/.test((t.textContent || "").trim())) name = "cancel";
    play(name);
  }, true);

  window.GameAudio = { play, beep, line, suspend };
})();
