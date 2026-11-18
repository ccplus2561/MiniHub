(() => {
  "use strict";
  // OOXX 大廳：鍵盤快捷鍵（↑↓ 選擇、Enter 確認、Esc 返回）與底部提示列；大廳設定關閉鍵盤快捷鍵時一律停用並隱藏提示
  const MH = window.MiniHub;
  const kbdOn = () => !MH || MH.kbdOn();
  const bar = document.getElementById("kbdHints");
  const cards = Array.from(document.querySelectorAll("a.mode-card"));
  const paint = () => { if (bar) bar.hidden = !kbdOn() || window.matchMedia("(pointer: coarse)").matches; };
  paint();
  try { MH && MH.onChange(paint); } catch (e) { /* 略過 */ }

  document.addEventListener("keydown", e => {
    if (!kbdOn() || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = cards.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      cards[i < 0 ? (d > 0 ? 0 : cards.length - 1) : (i + d + cards.length) % cards.length].focus();
    } else if (e.key === "Enter" && i >= 0) {
      e.preventDefault();
      cards[i].click();
    } else if (e.key === "Escape") {
      try { window.parent !== window && window.parent.MiniHubAskExit && window.parent.MiniHubAskExit(); } catch (x) { /* 略過 */ }
    }
  });
})();
