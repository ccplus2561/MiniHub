(() => {
  "use strict";
  // 主持頁門檻：房間有設主持人密碼時，必須在大廳輸入正確密碼才能進入（直接開網址、重新整理都會被送回大廳）
  const R = window.BingoRoom;
  const p = R.readParams();
  if (p.role !== "host") return;
  if (R.isPhone()) { window.location.replace("../index.html"); return; }   // 主持僅限平板、電腦
  const back = () => { window.location.replace("../index.html"); };
  if (!p.room) return;
  document.documentElement.style.visibility = "hidden";
  R.directory.get(p.room).then(room => {
    if (room && room.hostPw && !R.hostAllowed(p.room)) back();
    else document.documentElement.style.visibility = "";
  }, () => { document.documentElement.style.visibility = ""; });
})();
