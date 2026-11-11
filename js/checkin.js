/* 每日簽到：以台灣時間（UTC+8）的日曆日為準，每天 00:00 換日。
   資料（存在 users/{uid}）：mPoints 目前 M 點 / streak 連續簽到天數 / totalCheckins 累計簽到次數 / lastCheckinAt 最後簽到時間（伺服器時間）
   規則：每日簽到 +1 M，隔天接著簽 streak + 1，中斷就從 1 重算；連續天數 × 0.5（保留小數）為額外點數。
   註冊帳號首次登入 +10 M 在 firebase.js 的 createProfile()。
   實際寫入與規則檢查在 firebase.js 的 MiniHubAuth.checkin() 與 Firestore 規則；這裡只負責畫面。
   body[data-ci]：guest 未登入 / todo 今天還沒簽到 / done 今天已簽到 */
(function () {
  var DAY = 864e5, TW = 8 * 3600000;
  var twDay = function (t) { return Math.floor((t + TW) / DAY); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sfx = function (n) { if (window.MiniHubSfx) MiniHubSfx(n); };
  var toast = function (m) { if (window.MiniHubToast) MiniHubToast(m); };
  var modal = $("#checkinModal");
  var st = { signedIn: false, mPoints: 0, streak: 0, total: 0, last: null };
  var busy = false, timer = 0;

  var rewardOf = function (n) { return 1 + n * 0.5; };   // n = 簽到後的連續天數；1 + 連續天數×0.5（保留小數）
  var fmt = function (n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); };

  function view() {
    var now = twDay(Date.now());
    if (!st.signedIn) return { mode: "guest", streak: 0, idx: -1, reward: rewardOf(1) };
    var last = st.last === null ? null : twDay(st.last);
    var done = last !== null && last >= now;
    var alive = last !== null && last >= now - 1;          // 昨天或今天有簽 = 連續中
    var streak = alive ? st.streak : 0;                    // 中斷後顯示 0
    if (done) return { mode: "done", streak: streak, idx: ((streak - 1) % 7 + 7) % 7, reward: rewardOf(streak) };
    return { mode: "todo", streak: streak, idx: streak % 7, reward: rewardOf(streak + 1) };
  }

  function render() {
    var v = view();
    document.body.dataset.ci = v.mode;
    var fill = function (sel, val) { $$(sel).forEach(function (e) { e.textContent = val; }); };
    fill("[data-ci-pts]", st.mPoints.toLocaleString("en-US", { maximumFractionDigits: 1 }));
    fill("[data-ci-streak]", v.streak);
    fill("[data-ci-total]", st.total);
    fill("[data-ci-reward]", fmt(v.reward));
    var cur = v.mode === "done" ? v.streak : v.streak + 1;     // 今天（或剛簽到）是連續第幾天
    var base = v.idx >= 0 ? cur - v.idx : 1;                   // 這一輪 7 天的第 1 天
    $$("#ciWeek .ci-day").forEach(function (li, i) {
      li.classList.toggle("is-done", v.idx >= 0 && i < v.idx);
      li.classList.toggle("is-today", v.idx >= 0 && i === v.idx);
      var d = $(".ci-d", li), b = $("b", li);
      if (d) d.textContent = "第 " + (base + i) + " 天";
      if (b) b.textContent = "+" + fmt(rewardOf(base + i));
    });
    schedule(); fitSoon();
  }

  // 點數框禁止換行：內容超出框寬時自動縮小字級（最小 9px）
  var FIT = ".mp-pill .mp-num, .ci-sum b, .ci-reward b, .ci-day b", fitRaf = 0;
  function fit() {
    $$(FIT).forEach(function (el) { el.style.fontSize = ""; });
    $$(FIT).forEach(function (el) {
      if (!el.clientWidth) return;                                // 隱藏中的元素量不到寬度
      var fs = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && fs > 9) { fs -= 0.5; el.style.fontSize = fs + "px"; }
    });
  }
  function fitSoon() { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fit); }
  window.addEventListener("resize", fitSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);

  // 台灣時間 00:00 自動換日（未簽到 → 可簽到）
  function schedule() {
    clearTimeout(timer);
    var next = (twDay(Date.now()) + 1) * DAY - TW;
    timer = setTimeout(render, Math.min(next - Date.now() + 500, 2147483647));
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });

  function load() {
    var a = window.MiniHubAccount || {};
    st.signedIn = !!a.uid;
    st.mPoints = a.mPoints || 0; st.streak = a.streak || 0; st.total = a.totalCheckins || 0; st.last = a.lastCheckinAt || null;
    render();
  }
  document.addEventListener("minihub:account", load);

  function sign() {
    if (busy || document.body.dataset.ci !== "todo" || !window.MiniHubAuth) return;
    busy = true; $$("[data-ci-sign]").forEach(function (b) { b.disabled = true; });
    MiniHubAuth.checkin().then(function (r) {
      st.mPoints = r.mPoints; st.streak = r.streak; st.total = r.totalCheckins; st.last = r.lastCheckinAt;
      var a = window.MiniHubAccount; if (a) { a.mPoints = r.mPoints; a.streak = r.streak; a.totalCheckins = r.totalCheckins; a.lastCheckinAt = r.lastCheckinAt; }
      render(); sfx("confirm");
      toast("簽到成功！+" + fmt(r.reward) + " M 點" + (r.streak > 1 ? "（連續第 " + r.streak + " 天）" : ""));
    }).catch(function (e) {
      var c = (e && e.code) || "";
      if (c === "already-checked-in" || c === "permission-denied") {   // 其他裝置已簽到，或本機時間與伺服器差太多 → 重新讀取最新資料
        return MiniHubAuth.loadProfile().then(function (p) {
          if (p) { st.mPoints = p.mPoints; st.streak = p.streak; st.total = p.totalCheckins; st.last = p.lastCheckinAt; }
          render(); toast(view().mode === "done" ? "今天已經簽到過了" : "簽到失敗，請確認裝置時間正確後再試");
        }, function () { toast("簽到失敗，請稍後再試"); });
      }
      toast(c === "unavailable" || /network/.test(c) ? "網路連線失敗，請稍後再試" : "簽到失敗：" + (c || e.message));
    }).then(function () { busy = false; $$("[data-ci-sign]").forEach(function (b) { b.disabled = false; }); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-ci-open]")) { sfx("open"); modal.hidden = false; fitSoon(); var f = $("[data-ci-sign]:not([hidden])", modal); if (f && document.body.dataset.ci === "todo") setTimeout(function () { f.focus(); }, 60); return; }
    if (t.closest("[data-ci-sign]")) { sign(); return; }
    if (t.closest("[data-ci-login]")) { modal.hidden = true; var b = $("#loginBtn"); if (b) b.click(); }
  });

  load();
})();
