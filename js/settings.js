// 設定頁：帳號 / 顯示 / 音效 / 操作 / 通知 / 資料 / 語言
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

  /* ---------- 可儲存的偏好（開關 / 滑桿 / 分段） ---------- */
  const KEY = "minihub.settings";
  const DEFAULTS = {
    cardSize: "m", anim: true, fsStart: false,
    volMaster: 80, volMusic: 70, volSfx: 80, mute: false,
    touch: true, rumble: true, nNew: true, nEvent: false, nUpdate: true, share: false
  };
  let prefs = { ...DEFAULTS };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };
  const SIZES = { s: "144px", m: "168px", l: "196px" };

  function effects() {
    document.body.classList.toggle("no-anim", !prefs.anim);
    document.documentElement.style.setProperty("--card-w", SIZES[prefs.cardSize] || SIZES.m);
  }

  function paint() {
    $$("[data-set]").forEach(el => {
      const v = prefs[el.dataset.set];
      if (el.classList.contains("switch")) el.setAttribute("aria-checked", !!v);
      else if (el.classList.contains("range")) { el.value = v; el.nextElementSibling.textContent = v; el.style.setProperty("--p", v + "%"); }
      else if (el.classList.contains("seg")) $$("button", el).forEach(b => b.classList.toggle("on", b.dataset.value === v));
    });
    effects();
  }

  document.addEventListener("click", e => {
    const sw = e.target.closest(".switch");
    if (sw) { prefs[sw.dataset.set] = !prefs[sw.dataset.set]; save(); paint(); return; }
    const sb = e.target.closest(".seg button");
    if (sb) { prefs[sb.parentElement.dataset.set] = sb.dataset.value; save(); paint(); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "reset") { prefs = { ...DEFAULTS }; save(); paint(); usage(); window.MiniHubToast && MiniHubToast("已還原預設設定"); }
      if (act.dataset.act === "cache") { window.MiniHubToast && MiniHubToast("已清除快取"); }
    }
  });
  document.addEventListener("input", e => {
    const r = e.target.closest(".range");
    if (r) { prefs[r.dataset.set] = +r.value; save(); paint(); }
  });
  window.MiniHubPrefs = () => prefs;
  paint();

  /* ---------- 資料用量 / 手把偵測 ---------- */
  function usage() {
    let n = 0;
    try { for (const k in localStorage) if (k.startsWith("minihub")) n += (localStorage[k] || "").length * 2; } catch (e) {}
    $("#usage").textContent = (n / 1024).toFixed(1) + " KB（共 5 MB 可用）";
    $("#usageBar").style.width = Math.max(2, n / (5 * 1024 * 1024) * 100) + "%";
  }
  usage();
  const pad = $("#padState");
  const padCheck = () => {
    const g = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean);
    pad.textContent = g ? "已連線：" + g.id.split("(")[0].trim() : "未偵測到手把";
    pad.classList.toggle("on", !!g);
  };
  addEventListener("gamepadconnected", padCheck);
  addEventListener("gamepaddisconnected", padCheck);
  padCheck();

})();
