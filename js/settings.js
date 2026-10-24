// 設定頁：帳號 / 顯示 / 音效 / 操作 / 隱私 / 語言
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // 帳號資料（尚無登入系統：串接後填入即可）
  const MiniHubAccount = window.MiniHubAccount = Object.assign({ name: "", uid: "", email: "" }, window.MiniHubAccount);

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
  fill($("#accName"), MiniHubAccount.name);
  fill($("#accUid"), MiniHubAccount.uid);
  fill($("#accEmail"), MiniHubAccount.email);

  /* ---------- 顯示 / 語言：目前只有預設項目 ---------- */
  ["display", "lang"].forEach(group => {
    $$(`[data-group="${group}"]:not(:disabled)`).forEach(el => el.addEventListener("click", () => {
      $$(`[data-group="${group}"]`).forEach(x => x.classList.toggle("selected", x === el));
    }));
  });

  /* ---------- 可儲存的偏好（開關 / 分段） ---------- */
  const KEY = "minihub.settings";
  const DEFAULTS = {
    cardSize: "m", anim: true, fsStart: false,
    mute: false, music: true, sfx: true,
    kbd: true, touch: true, publicName: false
  };
  let prefs = { ...DEFAULTS };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };
  const SIZES = { s: "144px", m: "168px", l: "196px" };

  function paint() {
    $$("[data-set]").forEach(el => {
      const v = prefs[el.dataset.set];
      if (el.classList.contains("switch")) el.setAttribute("aria-checked", !!v);
      else if (el.classList.contains("seg")) $$("button", el).forEach(b => b.classList.toggle("on", b.dataset.value === v));
    });
    // 全部靜音時，音樂 / 音效列變暗
    $$("[data-dep]").forEach(r => r.classList.toggle("off", !!prefs[r.dataset.dep]));
    // 允許鍵盤快捷鍵 → 才顯示快捷鍵介面與底部提示
    $("#kbdPanel").hidden = !prefs.kbd;
    document.body.classList.toggle("no-kbd", !prefs.kbd);
    document.body.classList.toggle("no-anim", !prefs.anim);
    document.documentElement.style.setProperty("--card-w", SIZES[prefs.cardSize] || SIZES.m);
  }

  document.addEventListener("click", e => {
    const sw = e.target.closest(".switch");
    if (sw) { prefs[sw.dataset.set] = !prefs[sw.dataset.set]; save(); paint(); return; }
    const sb = e.target.closest(".seg button");
    if (sb) { prefs[sb.parentElement.dataset.set] = sb.dataset.value; save(); paint(); }
  });
  window.MiniHubPrefs = () => prefs;
  paint();
})();
