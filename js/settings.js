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

  /* ---------- 外觀 ---------- */
  const T = window.MiniHubTheme;
  const box = $("#swatches");

  // 第一格：調色盤 = 預設色彩
  const def = document.createElement("button");
  def.className = "swatch";
  def.dataset.id = "default";
  def.title = "預設";
  def.setAttribute("aria-label", "預設色彩");
  def.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.5-1-2.7 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.7-9-7.7z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>';
  box.appendChild(def);

  T.THEMES.forEach(t => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.dataset.id = t.id;
    b.title = t.name;
    b.setAttribute("aria-label", t.name);
    b.style.background = `linear-gradient(135deg, ${t.c[0]}, ${t.c[1]})`;
    box.appendChild(b);
  });

  box.addEventListener("click", e => {
    const b = e.target.closest(".swatch");
    if (b) T.set({ color: b.dataset.id });
  });
  $$('[data-group="mode"]').forEach(el => el.addEventListener("click", () => T.set({ mode: el.dataset.value })));

  function sync(st) {
    $$('[data-group="mode"]').forEach(el => el.classList.toggle("selected", el.dataset.value === st.mode));
    $$(".swatch", box).forEach(el => {
      const on = el.dataset.id === st.color;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-pressed", on);
    });
    const colorName = st.color === "default" ? "預設" : T.THEMES.find(t => t.id === st.color).name;
    $("#sumAppearance").textContent = (st.mode === "light" ? "明亮" : "灰暗") + " · " + colorName;
  }
  T.onChange(sync);
  sync(T.state);
})();
