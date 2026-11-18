(() => {
  "use strict";
  // OOXX 大廳頁（index.html / online.html）的音效接線：音效本身都在 audio.js，這裡只負責呼叫
  const sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      try {
        const G = window.GameAudio;
        if (!G || typeof name !== "string") return;
        if (/^(music|sync|toggle)/.test(name) && typeof G[name] === "function") G[name](...args);
        else G.play(name, ...args);
      } catch (e) { /* 音效失敗不影響頁面 */ }
    }
  });

  const target = e => {
    const b = e.target.closest && e.target.closest("button, a.mode-card");
    return b && !b.hasAttribute("data-audio") && !b.disabled ? b : null;
  };
  // 按下去就先出聲（換頁的按鈕才不會被切掉）；鍵盤操作（click 的 detail 為 0）則在 click 時出聲
  let last = 0;
  const isCard = b => b.classList && b.classList.contains("mode-card");
  document.addEventListener("pointerdown", e => { const b = target(e); if (b) { last = Date.now(); isCard(b) ? sound.start() : sound.click(); } }, true);
  // 滑鼠移到模式卡片上：輕輕的提示音（觸控裝置沒有 hover，不會觸發）
  document.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const b = e.target.closest && e.target.closest("a.mode-card");
    if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) sound.hover();
  }, true);
  document.addEventListener("click", e => {
    const b = target(e);
    if (!b) return;
    if (e.detail === 0 && Date.now() - last > 400) isCard(b) ? sound.start() : sound.click();
    // 連結換頁前多等一下，讓點擊聲播完
    if (b.tagName === "A" && b.href && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.shiftKey && b.target !== "_blank") {
      e.preventDefault();
      setTimeout(() => { location.href = b.href; }, 120);
    }
  }, true);

  try { window.MiniHub && MiniHub.onPause(() => sound.musicStop()); } catch (e) { /* 略過 */ }
  const resume = () => sound.musicStart();
  document.addEventListener("pointerdown", resume, true);
  sound.musicStart();   // 背景音樂（第一次操作後才會出聲）
})();
