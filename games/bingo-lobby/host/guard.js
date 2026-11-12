(() => {
  "use strict";
  // 主持頁門檻：主持僅限平板、電腦；手機直接開網址會被送回大廳
  const R = window.BingoRoom;
  const p = R.readParams();
  if (p.role !== "host") return;
  if (R.isPhone()) window.location.replace("../index.html");
})();
