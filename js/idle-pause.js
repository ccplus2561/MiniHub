/* 閒置 / 背景時暫停「無限循環」動畫，需要時才繪製
 * - 分頁在背景、手機切到別的 App 或鎖屏：立刻暫停
 * - 前景但超過 IDLE_MS 沒有任何操作（含正在玩遊戲、畫面停著不動）：暫停
 * - 一有觸控 / 點擊 / 鍵盤 / 捲動 / 滑鼠移動：立刻恢復
 * 只暫停 iterations = Infinity 的循環動畫（呼吸光、掃光、漂浮、光環…）；一次性的進場 / 回饋動畫完全不受影響。 */
(function () {
  "use strict";
  if (!document.getAnimations) return;          // 舊瀏覽器沒有 Web Animations：維持原狀
  var IDLE_MS = 15000;
  var paused = false, last = Date.now(), timer = 0, scanRaf = 0;
  var mine = typeof WeakSet === "function" ? new WeakSet() : null;
  if (!mine) return;

  function isInfinite(a) {
    try { return !!a.effect && a.effect.getComputedTiming().iterations === Infinity; } catch (e) { return false; }
  }
  function scan() {                              // 暫停目前所有正在跑的循環動畫
    scanRaf = 0;
    if (!paused) return;
    var list = document.getAnimations();
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.playState === "running" && isInfinite(a)) { mine.add(a); a.pause(); }
    }
  }
  function pauseAll() { if (paused) return; paused = true; scan(); }
  function resumeAll() {
    if (!paused) return;
    paused = false;
    var list = document.getAnimations();
    for (var i = 0; i < list.length; i++) { var a = list[i]; if (mine.has(a)) { mine.delete(a); try { a.play(); } catch (e) {} } }
  }

  function arm(ms) { clearTimeout(timer); timer = setTimeout(check, ms); }
  function check() {
    if (document.hidden) return;
    var left = IDLE_MS - (Date.now() - last);
    if (left > 50) arm(left); else pauseAll();
  }
  function touch() { last = Date.now(); if (paused) { resumeAll(); arm(IDLE_MS); } }

  ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll"].forEach(function (t) {
    window.addEventListener(t, touch, { passive: true, capture: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { clearTimeout(timer); pauseAll(); }
    else { last = Date.now(); resumeAll(); arm(IDLE_MS); }
  });
  window.addEventListener("pagehide", pauseAll);
  window.addEventListener("pageshow", function () { last = Date.now(); resumeAll(); arm(IDLE_MS); });

  // 暫停期間若有新的循環動畫開始（例如點開視窗），補暫停；只掃一次 / 幀
  document.addEventListener("animationstart", function () {
    if (paused && !scanRaf) scanRaf = requestAnimationFrame(scan);
  }, true);

  arm(IDLE_MS);
})();
