/* 每日簽到：以台灣時間（UTC+8）的日曆日為準，每天 00:00 換日。
   資料（存在 users/{uid}）：mPoints 目前 M 點 / streak 連續簽到天數 / totalCheckins 累計簽到次數 / lastCheckinAt 最後簽到時間（伺服器時間）
   規則：每日簽到 +1 M，隔天接著簽 streak + 1，中斷就從 1 重算；連續天數 × 0.5（保留小數）為額外點數。
   連續天數最多 7 天：第 7 天之後的隔天（第 8 天）重新從第 1 天計算。
   註冊帳號首次登入 +10 M 在 firebase.js 的 createProfile()。
   實際寫入與規則檢查在 firebase.js 的 MiniHubAuth.checkin() 與 Firestore 規則；這裡只負責畫面。
   排行榜加碼：貪吃蛇 / 2048 / 方塊消消樂 / 水果忍者 排行榜第 1 名，每款每天可多領 +1 M，與簽到同一次領取（資料 users/{uid}.rankBonus，邏輯在 firebase.js checkin()）。
   登入後自動簽到：帳號資料載入完成後自動呼叫領取（簽到＋排行榜加碼；今天已簽到時只補領加碼），每個帳號每次開啟網頁只自動嘗試一次；手動按鈕仍保留作為備援。
   body[data-ci]：guest 未登入 / todo 今天還沒簽到 / done 今天已簽到 */
(function () {
  var DAY = 864e5, TW = 8 * 3600000;
  var twDay = function (t) { return Math.floor((t + TW) / DAY); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sfx = function (n) { if (window.MiniHubSfx) MiniHubSfx(n); };
  var toast = function (m) { if (window.MiniHubToast) MiniHubToast(m); };
  var modal = $("#checkinModal");
  var st = { signedIn: false, mPoints: 0, streak: 0, total: 0, last: null, rb: {} };
  var CYCLE = 7, BONUS_GAMES = ["snake", "puzzle", "block-blast", "fruit-slice"];
  var busy = false, timer = 0, autoUid = null;

  var rewardOf = function (n) { return 1 + n * 0.5; };   // n = 簽到後的連續天數；1 + 連續天數×0.5（保留小數）
  var fmt = function (n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); };

  // 連續天數換算成 7 天一輪的第幾天（舊資料超過 7 也能正確顯示）
  var cyc = function (n) { return n > 0 ? ((n - 1) % CYCLE) + 1 : 0; };
  // 今天已領的排行榜加碼款數（rankBonus[遊戲] = 領取當天的台灣日編號）
  function bonusToday() {
    var now = twDay(Date.now());
    return BONUS_GAMES.filter(function (g) { return st.rb && st.rb[g] === now; });
  }

  function view() {
    var now = twDay(Date.now());
    if (!st.signedIn) return { mode: "guest", streak: 0, idx: -1, reward: rewardOf(1) };
    var last = st.last === null ? null : twDay(st.last);
    var done = last !== null && last >= now;
    var alive = last !== null && last >= now - 1;          // 昨天或今天有簽 = 連續中
    var streak = alive ? cyc(st.streak) : 0;               // 中斷後顯示 0
    if (done) return { mode: "done", streak: streak, idx: streak - 1, reward: rewardOf(streak) };
    var next = streak >= CYCLE || streak === 0 ? 1 : streak + 1;   // 連續滿 7 天後，今天重新從第 1 天開始
    return { mode: "todo", streak: streak, idx: next - 1, reward: rewardOf(next) };
  }

  function render() {
    var v = view();
    document.body.dataset.ci = v.mode;
    var fill = function (sel, val) { $$(sel).forEach(function (e) { e.textContent = val; }); };
    fill("[data-ci-pts]", st.mPoints.toLocaleString("en-US", { maximumFractionDigits: 1 }));
    fill("[data-ci-streak]", v.streak);
    fill("[data-ci-total]", st.total);
    fill("[data-ci-reward]", fmt(v.reward));
    var base = 1;                                              // 7 天一輪，永遠是第 1～7 天
    $$("#ciWeek .ci-day").forEach(function (li, i) {
      li.classList.toggle("is-done", v.idx >= 0 && i < v.idx);
      li.classList.toggle("is-today", v.idx >= 0 && i === v.idx);
      var d = $(".ci-d", li), b = $("b", li);
      if (d) d.textContent = "第 " + (base + i) + " 天";
      if (b) b.textContent = "+" + fmt(rewardOf(base + i));
    });
    // 排行榜加碼：今天已領的款數與總額（每款 +1 M，最多 4 款）
    var got = bonusToday();
    fill("[data-ci-bonus]", fmt(got.length));
    $$("#ciBonus li").forEach(function (li) { var on = got.indexOf(li.dataset.g) >= 0; li.classList.toggle("is-got", on); });
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
    st.mPoints = a.mPoints || 0; st.streak = a.streak || 0; st.total = a.totalCheckins || 0; st.last = a.lastCheckinAt || null; st.rb = a.rankBonus || {};
    render();
    // 登入後自動簽到（含剛註冊完的首次登入）；登出後 autoUid 清除，下次登入會再判斷一次
    if (!st.signedIn) { autoUid = null; return; }
    if (autoUid !== a.uid && /^(todo|done)$/.test(document.body.dataset.ci)) { autoUid = a.uid; setTimeout(function () { sign(true); }, 1200); }
  }
  document.addEventListener("minihub:account", load);

  function sign(auto) {
    var mode = document.body.dataset.ci;
    if (busy || !window.MiniHubAuth || !(mode === "todo" || (auto && mode === "done"))) return;   // 已簽到時只有自動領取會嘗試補領排行榜加碼
    busy = true; $$("[data-ci-sign]").forEach(function (b) { b.disabled = true; });
    MiniHubAuth.checkin().then(function (r) {
      st.mPoints = r.mPoints; st.streak = r.streak; st.total = r.totalCheckins; st.last = r.lastCheckinAt; st.rb = r.rankBonus || st.rb;
      var a = window.MiniHubAccount; if (a) { a.mPoints = r.mPoints; a.streak = r.streak; a.totalCheckins = r.totalCheckins; a.lastCheckinAt = r.lastCheckinAt; a.rankBonus = st.rb; }
      render(); sfx("confirm");
      var names = (r.bonusGames || []).map(function (id) { var g = (window.GAMES || []).filter(function (x) { return x.id === id; })[0]; return g ? g.title : id; });
      var bonusTxt = r.bonus ? "排行榜第 1 名加碼 +" + fmt(r.bonus) + " M（" + names.join("、") + "）" : "";
      toast(r.signed ? "簽到成功！+" + fmt(r.reward) + " M 點" + (r.streak > 1 ? "（連續第 " + r.streak + " 天）" : "") + (bonusTxt ? "，" + bonusTxt : "") : bonusTxt);
    }).catch(function (e) {
      var c = (e && e.code) || "";
      if (c === "already-checked-in" && auto && view().mode === "done") return;   // 自動領取：今天已簽到、也沒有可補領的加碼 → 不打擾
      if (c === "already-checked-in" || c === "permission-denied") {   // 其他裝置已簽到，或本機時間與伺服器差太多 → 重新讀取最新資料
        return MiniHubAuth.loadProfile().then(function (p) {
          if (p) { st.mPoints = p.mPoints; st.streak = p.streak; st.total = p.totalCheckins; st.last = p.lastCheckinAt; st.rb = p.rankBonus || {}; }
          render(); if (auto && view().mode === "done") return; toast(view().mode === "done" ? "今天已經簽到過了" : "簽到失敗，請確認裝置時間正確後再試");
        }, function () { toast("簽到失敗，請稍後再試"); });
      }
      toast(c === "unavailable" || /network/.test(c) ? "網路連線失敗，請稍後再試" : "簽到失敗：" + (c || e.message));
    }).then(function () { busy = false; $$("[data-ci-sign]").forEach(function (b) { b.disabled = false; }); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-ci-open]")) { sfx("open"); modal.hidden = false; fitSoon(); var f = document.body.dataset.ci === "guest" ? $("[data-ci-login]", modal) : $("[data-ci-sign]:not([hidden])", modal); if (f && /^(todo|guest)$/.test(document.body.dataset.ci)) setTimeout(function () { f.focus(); }, 60); return; }
    if (t.closest("[data-ci-sign]")) { sign(); return; }
    if (t.closest("[data-ci-login]")) { modal.hidden = true; var b = $("#loginBtn"); if (b) b.click(); }
  });

  load();
})();
