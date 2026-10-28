// 離開保護：① 離開網站時清除瀏覽器裡的網站資料  ② 手機返回鍵 / 滑動返回不會直接退出網站
(function () {
  "use strict";
  var IDB = ["firebaseLocalStorageDb", "firebase-heartbeat-database", "firebase-installations-database"];
  var TAB = "mh_tab";

  /* ---------- 清除 ---------- */
  function wipeLight() {   // 同步、可隨時執行：localStorage / Cookie / CacheStorage / Service Worker
    try { localStorage.clear(); } catch (e) {}
    try {
      var paths = ["/"], acc = "";
      location.pathname.split("/").filter(Boolean).forEach(function (x) { acc += "/" + x; paths.push(acc); });
      var hs = location.hostname.split("."), doms = [null];
      for (var i = 0; i < hs.length - 1; i++) doms.push("." + hs.slice(i).join("."));
      document.cookie.split(";").forEach(function (c) {
        var n = c.split("=")[0].trim(); if (!n) return;
        paths.forEach(function (pa) { doms.forEach(function (d) { document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=" + pa + (d ? "; domain=" + d : ""); }); });
      });
    } catch (e) {}
    try { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }); } catch (e) {}
    try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }); } catch (e) {}
  }
  function wipeIDB() {     // IndexedDB（Firebase 登入 / 安裝資料）；網頁開著時不要刪，避免卡住 Firebase
    try {
      IDB.forEach(function (n) { indexedDB.deleteDatabase(n); });
      if (indexedDB.databases) indexedDB.databases().then(function (ds) { ds.forEach(function (d) { if (d && d.name) indexedDB.deleteDatabase(d.name); }); }).catch(function () {});
    } catch (e) {}
  }

  // 新開的分頁（沒有分頁標記）= 清掉上次殘留的資料
  var fresh = false;
  try { fresh = !sessionStorage.getItem(TAB); sessionStorage.setItem(TAB, "1"); } catch (e) {}
  if (fresh) { wipeLight(); wipeIDB(); }

  // 離開網站 / 關閉分頁 / 切到背景：清除（登入狀態只存在分頁的 sessionStorage，分頁關閉即登出；重新整理仍保留登入）
  window.addEventListener("pagehide", function () { wipeLight(); wipeIDB(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") wipeLight(); });
  window.MiniHubWipeLight = wipeLight;

  /* ---------- 防止手機誤退出 ---------- */
  var leaving = false, lastBack = 0;
  var toast = function (t) { if (window.MiniHubToast) window.MiniHubToast(t); };
  var pushGuard = function () { try { history.pushState({ mhGuard: 1 }, "", location.href); } catch (e) {} };
  try {
    var st = history.state || {};
    if (st.mhBase) pushGuard();
    else if (!st.mhGuard) { history.replaceState({ mhBase: 1 }, "", location.href); pushGuard(); }
  } catch (e) {}

  window.addEventListener("popstate", function (e) {
    var s = e.state || {};
    if (leaving || s.mhGuard || !s.mhBase) return;     // 只處理「退回到最底層」這個動作
    pushGuard();                                        // 先補回，維持在網站內
    if (window.MiniHubIsPlaying && MiniHubIsPlaying()) { if (window.MiniHubAskExit) MiniHubAskExit(); return; }   // 遊戲中：暫停並詢問
    var open = Array.prototype.slice.call(document.querySelectorAll(".modal:not([hidden])"));
    if (open.length) {                                  // 有視窗開著：返回 = 關視窗（必須完成的視窗不關）
      var m = open.filter(function (x) { return !x.hasAttribute("data-lock"); }).pop();
      if (m) m.hidden = true;
      return;
    }
    var now = Date.now();
    if (now - lastBack < 2500) {                        // 2.5 秒內再按一次 = 確定要離開
      leaving = true; lastBack = 0;
      try { history.go(-2); } catch (x) {}
      return;
    }
    lastBack = now;
    toast("再按一次返回即可離開 MiniHub");
  });

  // 遊戲進行中重新整理 / 關閉：先詢問
  window.addEventListener("beforeunload", function (e) {
    if (leaving) return;
    if (window.MiniHubIsPlaying && MiniHubIsPlaying()) { e.preventDefault(); e.returnValue = ""; return ""; }
  });
})();
