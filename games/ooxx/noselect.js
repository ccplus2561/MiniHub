/* 禁止文字選取、複製、剪下、拖曳與長按選單（輸入框除外） */
(function () {
  var ok = function (t) { return t && t.closest && t.closest("input, textarea, [contenteditable='true']"); };
  ["selectstart", "copy", "cut", "dragstart", "contextmenu"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (!ok(e.target)) e.preventDefault(); }, true);
  });
})();
