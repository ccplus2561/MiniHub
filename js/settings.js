// 設定頁：帳號 / 顯示 / 外觀 / 語言
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // 帳號資料（尚無登入系統：串接後填入即可）
  const MiniHubAccount = window.MiniHubAccount = Object.assign({ email: "", uid: "" }, window.MiniHubAccount);

  /* ---------- 左側分類切換 ---------- */
  $$(".set-item").forEach(btn => btn.addEventListener("click", () => {
    $$(".set-item").forEach(b => b.classList.toggle("active", b === btn));
    $$(".pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + btn.dataset.pane));
  }));

  /* ---------- 帳號 ---------- */
  function fill(el, v) {
    el.textContent = v || "尚未綁定";
    el.classList.toggle("empty", !v);
  }
  fill($("#accEmail"), MiniHubAccount.email);
  fill($("#accUid"), MiniHubAccount.uid);

  /* ---------- 顯示 / 語言：目前只有預設項目 ---------- */
  ["display", "lang"].forEach(group => {
    $$(`[data-group="${group}"]:not(:disabled)`).forEach(el => el.addEventListener("click", () => {
      $$(`[data-group="${group}"]`).forEach(x => x.classList.toggle("selected", x === el));
    }));
  });

})();
