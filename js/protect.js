// 網站防護（大廳與所有遊戲頁共用）：禁止選取 / 複製 / 拖曳 / 右鍵、封鎖開發者工具與檢視原始碼快捷鍵、防止被他站嵌入
// 注意：這些屬於前端層級的「嚇阻」，無法取代伺服器端（Firebase 規則）的驗證。
(function () {
  "use strict";
  if (window.__mhProtect) return;
  window.__mhProtect = 1;

  var doc = document;
  var isField = function (t) {   // 輸入框允許正常選取 / 複製貼上，否則無法輸入
    return !!(t && t.closest && t.closest("input, textarea, [contenteditable=''], [contenteditable='true']"));
  };

  /* ---------- 1. 禁止選取文字（CSS） ---------- */
  var css = "html,body,body *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
    "input,textarea,[contenteditable=''],[contenteditable='true']{-webkit-user-select:text;user-select:text}" +
    "img,svg,canvas,a{-webkit-user-drag:none;user-drag:none}";
  var st = doc.createElement("style");
  st.setAttribute("data-mh-protect", "");
  st.textContent = css;
  (doc.head || doc.documentElement).appendChild(st);

  /* ---------- 2. 禁止選取 / 複製 / 拖曳 / 右鍵（事件） ---------- */
  var block = function (e) { if (!isField(e.target)) { e.preventDefault(); } };
  ["selectstart", "dragstart", "copy", "cut"].forEach(function (t) { doc.addEventListener(t, block, true); });
  doc.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);   // 右鍵 / 長按選單（含輸入框）
  doc.addEventListener("selectionchange", function () {   // 保險：任何非輸入框的選取立即取消
    var s = window.getSelection && window.getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      var n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      if (!isField(n)) s.removeAllRanges();
    }
  });

  /* ---------- 3. 封鎖開發者工具 / 原始碼 / 另存 / 列印 快捷鍵 ---------- */
  var isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
  window.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase(), c = (e.code || "");
    var ctrl = e.ctrlKey, meta = e.metaKey, shift = e.shiftKey, alt = e.altKey;
    var bad = false;
    if (k === "f12" || c === "F12") bad = true;                                              // F12
    else if (ctrl && shift && ["i", "j", "c", "k", "e", "m"].indexOf(k) > -1) bad = true;     // Ctrl+Shift+I/J/C/K/E/M（Win/Linux）
    else if (isMac && meta && alt && ["i", "j", "c", "u", "k", "e"].indexOf(k) > -1) bad = true;   // Cmd+Opt+I/J/C/U/K/E（Mac）
    else if (isMac && meta && alt && ["KeyI", "KeyJ", "KeyC", "KeyU", "KeyK", "KeyE"].indexOf(c) > -1) bad = true;   // Mac 的 Option 會改字元，另用 code 比對
    else if ((ctrl || meta) && (k === "u" || c === "KeyU")) bad = true;                      // 檢視原始碼
    else if ((ctrl || meta) && (k === "s" || c === "KeyS")) bad = true;                      // 另存網頁
    else if ((ctrl || meta) && (k === "p" || c === "KeyP")) bad = true;                      // 列印
    else if ((ctrl || meta) && !isField(e.target) && (k === "a" || c === "KeyA")) bad = true;   // 全選（輸入框內仍可用）
    else if (ctrl && shift && (k === "delete" || k === "del")) bad = false;                  // 清除瀏覽資料屬瀏覽器功能，不處理
    if (bad) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); return false; }
  }, true);

  /* ---------- 4. 防止被其他網站以 iframe 嵌入（同網域的遊戲 iframe 不受影響） ---------- */
  try {
    if (window.top !== window.self) {
      var same = false;
      try { same = window.top.location.hostname === location.hostname; } catch (x) { same = false; }   // 跨網域存取會丟錯 = 被別站嵌入
      if (!same) { window.top.location = location.href; }
    }
  } catch (e) {
    try { doc.documentElement.innerHTML = ""; } catch (x) {}
  }

  /* ---------- 5. 限制可被竄改的入口 ---------- */
  try {   // 鎖定防護旗標，避免被輕易改寫成「未載入」
    Object.defineProperty(window, "__mhProtect", { value: 1, writable: false, configurable: false });
  } catch (e) {}
  try {   // Console 警告：提醒勿貼上不明程式碼
    if (window.console && console.log && !window.__mhWarned) {
      window.__mhWarned = 1;
      console.log("%c停止！", "color:#ff4d4f;font-size:36px;font-weight:800");
      console.log("%c這是為開發者準備的功能。請勿在此貼上不明程式碼，否則帳號與資料可能被盜用。", "font-size:15px");
    }
  } catch (e) {}
})();
