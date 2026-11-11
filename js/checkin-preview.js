/* 每日簽到：樣式預覽用（暫時的）。網址加 ?ci=guest / ?ci=todo / ?ci=done 切換狀態；
   只負責開關視窗與換狀態，沒有任何簽到邏輯。正式寫功能時整個檔案刪掉（並從 index.html 的 JS 清單移除）。 */
(function () {
  var m = /[?&]ci=(guest|todo|done)/.exec(location.search);
  if (m) document.body.dataset.ci = m[1];
  var modal = document.getElementById("checkinModal");
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-ci-open]")) { modal.hidden = false; return; }
    if (t.closest("[data-ci-sign]")) { document.body.dataset.ci = "done"; return; }
    if (t.closest("[data-ci-login]")) { modal.hidden = true; var b = document.getElementById("loginBtn"); if (b) b.click(); }
  });
})();
