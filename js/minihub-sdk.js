/**
 * MiniHub 遊戲共用 SDK —— 新遊戲只要在 <head> 或 <body> 底部加一行：
 *   <script src="../../js/minihub-sdk.js"></script>
 * 之後就能用 window.MiniHub（大廳改版時只需要改這支檔案，遊戲不用動）。
 * 單獨開啟遊戲頁（不在大廳裡）時，所有函式都有安全的預設值，不會報錯。
 *
 * ── 設定 ──────────────────────────────────────────────
 *   MiniHub.embedded            是否在大廳裡執行
 *   MiniHub.prefs()             目前生效的大廳設定 { mute, music, sfx, kbd, touch, anim, ... }
 *   MiniHub.sfxOn() / musicOn() 音效 / 音樂是否該播放（已考慮「全部靜音」）
 *   MiniHub.kbdOn() / touchOn() 是否接受鍵盤 / 觸控操作
 *   MiniHub.onChange(fn)        設定或登入狀態改變時呼叫 fn；回傳取消函式（離開頁面會自動取消）
 * ── 大廳互動 ──────────────────────────────────────────
 *   MiniHub.onPause(fn)         大廳要求暫停時（玩家點左側導覽）呼叫 fn
 *   MiniHub.action({ title, path, onClick })  在大廳頂端「背景音樂」左邊放一顆遊戲專屬按鈕（path = 24×24 線條圖示的 SVG path）；傳 null 移除
 *   MiniHub.onRestart(fn)       登記後，大廳頂端的「重新載入」改由遊戲自己處理（可先彈確認視窗）
 *   MiniHub.requestNext()       開始下一局前呼叫；未登入時大廳會詢問同意條款。回傳 Promise<boolean>
 * ── 玩家 / 排行榜 ─────────────────────────────────────
 *   MiniHub.player()            { loggedIn, uid, name, canRank, displayName, maskName(name) }
 *   MiniHub.board(gameId, { top: 3, mode, onUpdate(state) })
 *       自動處理「個人最高 + 排行榜前 N 名 + 自己的名次」，並讓雲端資料跟大廳隱私設定一致。
 *       前提：該遊戲已在 js/games.js 宣告 board 規格（排序方向、單位、模式…），否則 state.supported = false。
 *       state = { supported, logged, rankOn, myName, uid, mode, order, unit, best, top:[{uid,name,score,extra}], myRank }
 *       回傳 { submit(score, { extra }), setMode(mode), state, destroy() }
 *       遊戲結束時呼叫 submit(分數) 即可（只有比個人最高更好才會寫入；order 為 "asc" 時越低越好）。
 *       有多個排行榜時用 mode / setMode 切換；extra 只能帶 games.js 的 board.fields 允許的欄位。
 *       onUpdate 在任何資料變動時呼叫，請在裡面重畫畫面。
 */
(function () {
  "use strict";
  var P = null;   // 大廳視窗（同源時才拿得到）
  try { if (parent !== window && parent.document) P = parent; } catch (e) {}

  var DEFAULTS = { mute: false, music: true, sfx: true, kbd: true, touch: true, anim: true, fsStart: false, cardSize: "m", lang: "zh-Hant" };
  var noop = function () {};
  var maskFallback = function (n) { var c = Array.from(String(n || "")); return c.length <= 1 ? "*" : c.length === 2 ? c[0] + "*" : c[0] + new Array(c.length - 1).join("*") + c[c.length - 1]; };

  function prefs() {
    var o = {}, k, src = {};
    try { if (P) { var f = P.MiniHubGamePrefs || P.MiniHubPrefs; if (f) src = f() || {}; } } catch (e) {}
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in src) o[k] = src[k];
    return o;
  }

  /* ---------- 設定 / 事件 ---------- */
  var offs = [];
  function onChange(fn) {
    if (!P) return noop;
    var h = function () { try { fn(); } catch (e) {} };
    P.document.addEventListener("minihub:prefs", h);
    P.document.addEventListener("minihub:account", h);
    var off = function () { try { P.document.removeEventListener("minihub:prefs", h); P.document.removeEventListener("minihub:account", h); } catch (e) {} };
    offs.push(off);
    return off;
  }
  addEventListener("pagehide", function () { offs.splice(0).forEach(function (f) { f(); }); });

  function requestNext() {
    try { return P && P.MiniHubRequestNext ? P.MiniHubRequestNext() : Promise.resolve(true); } catch (e) { return Promise.resolve(true); }
  }

  /* ---------- 玩家 ---------- */
  function player() {
    var acc = {}, R = null, A = null, uid = "";
    try { acc = (P && P.MiniHubAccount) || {}; R = P && P.MiniHubRank; A = P && P.MiniHubAuth && P.MiniHubAuth.scores; uid = A && acc.uid ? A.uid() : ""; } catch (e) {}
    var canRank = false, display = "";
    try { canRank = !!(uid && R && R.canRank()); display = canRank ? R.displayName() : (R && acc.name ? R.maskName(acc.name) : maskFallback(acc.name)); } catch (e) {}
    return { loggedIn: !!uid, uid: uid, name: acc.name || "", canRank: canRank, displayName: display, maskName: function (n) { try { return R ? R.maskName(n) : maskFallback(n); } catch (e) { return maskFallback(n); } } };
  }

  /* ---------- 個人最高 + 排行榜 ---------- */
  function board(game, opt) {
    opt = opt || {};
    var topN = opt.top || 3, cb = opt.onUpdate || noop;
    var st = { supported: false, logged: false, rankOn: false, myName: "", uid: "", mode: opt.mode || "", order: "desc", unit: "", best: 0, top: [], myRank: 0 };
    var bestDoc = null, offBest = null, offTop = null, bestKey = "", topKey = "", busy = false, seq = 0, rt = 0, dead = false;
    var A = function () { try { return P && P.MiniHubAuth && P.MiniHubAuth.scores; } catch (e) { return null; } };
    var emit = function () { if (!dead) try { cb(st); } catch (e) {} };

    function calcRank() {   // 沒進前 N 名時，查自己目前的名次（停手 0.3 秒才查，省讀取）
      clearTimeout(rt);
      rt = setTimeout(function () {
        var a = A();
        if (dead) return;
        if (!a || !st.rankOn || st.best <= 0 || st.top.some(function (r) { return r.uid === st.uid; })) { st.myRank = 0; return emit(); }
        var n = ++seq;
        a.rankOf(game, st.best, st.mode).then(function (r) { if (n === seq && !dead) { st.myRank = r; emit(); } }, noop);
      }, 300);
    }
    function reconcile() {   // 讓雲端資料跟目前設定一致（加入 / 退出排行榜、名稱遮蔽改變）
      var a = A();
      if (!a || !st.logged || !bestDoc || bestDoc.score <= 0 || busy) return;
      var nm = st.rankOn ? st.myName : "";
      if (bestDoc.inRank === st.rankOn && (!st.rankOn || bestDoc.name === nm)) return;
      busy = true;
      a.saveScore(game, bestDoc.score, { rank: st.rankOn, name: nm, mode: st.mode, extra: bestDoc.extra }).then(noop, noop).then(function () { busy = false; });
    }
    function stopSubs() { if (offBest) offBest(); if (offTop) offTop(); offBest = offTop = null; bestKey = ""; topKey = ""; }

    function refresh() {
      if (dead) return;
      var a = A(), p = player(), sp = null;
      try { sp = a && a.spec ? a.spec(game) : null; } catch (e) {}
      st.supported = !!sp;
      if (sp) { st.order = sp.order; st.unit = sp.unit; if (sp.modes && sp.modes.indexOf(st.mode) < 0) st.mode = sp.modes[0]; }
      if (!sp) a = null;   // 沒有宣告規格：不連線
      st.logged = !!(a && p.loggedIn); st.uid = st.logged ? p.uid : "";
      st.rankOn = st.logged && p.canRank; st.myName = p.displayName;
      if (!st.logged) { stopSubs(); st.best = 0; bestDoc = null; st.top = []; st.myRank = 0; }
      else {
        if (bestKey !== st.uid + "|" + st.mode) {
          if (offBest) offBest();
          bestKey = st.uid + "|" + st.mode;
          offBest = a.watchBest(game, function (d) { bestDoc = d; st.best = d ? d.score : 0; calcRank(); reconcile(); emit(); }, st.mode);
        }
        if (topKey !== st.rankOn + "|" + st.mode) {
          if (offTop) offTop();
          offTop = null; topKey = st.rankOn + "|" + st.mode;
          if (st.rankOn) offTop = a.watchTop(game, topN, function (rows) { st.top = rows; calcRank(); emit(); }, st.mode);
          else { st.top = []; st.myRank = 0; }
        }
        reconcile();
      }
      emit();
    }
    function submit(score, o) {
      var a = A();
      score = Number(score);
      if (!a || !st.supported || !st.logged || !isFinite(score) || score <= 0) return;
      var better = st.order === "asc" ? (st.best <= 0 || score < st.best) : score > st.best;   // 0 = 還沒有成績
      if (!better) return;
      st.best = score; emit();
      a.saveScore(game, score, { rank: st.rankOn, name: st.rankOn ? st.myName : "", mode: st.mode, extra: o && o.extra }).then(noop, noop);
    }
    function setMode(m) {   // 切換排行榜模式（games.js 的 board.modes）
      if (m === st.mode) return;
      st.mode = m; stopSubs(); bestDoc = null; st.best = 0; st.top = []; st.myRank = 0; refresh();
    }
    function destroy() { dead = true; clearTimeout(rt); stopSubs(); off(); }
    var off = onChange(refresh);
    addEventListener("pagehide", destroy);
    refresh();
    return { submit: submit, setMode: setMode, state: st, destroy: destroy, refresh: refresh };
  }

  /* ---------- 雲端存檔（登入後才會讀寫；遊戲需在 games.js 設 tags.cloud = true） ----------
     var c = MiniHub.cloud(\"遊戲id\");  c.load() → Promise<{ ok, data }>（ok=false 代表讀取失敗，請勿覆蓋）
     c.save(物件)  延遲約 1.2 秒合併寫入；c.flush() 立刻寫入；c.available() 是否已登入可用 */
  function cloud(game) {
    var A = function () { try { return P && P.MiniHubAuth && P.MiniHubAuth.scores; } catch (e) { return null; } };
    var timer = 0, pend = null, has = false;
    function can() { var a = A(); return !!(a && a.loadSave && player().loggedIn); }
    function flush() {
      clearTimeout(timer); timer = 0;
      if (!has) return Promise.resolve();
      var d = pend; pend = null; has = false;
      if (!can()) return Promise.resolve();
      return A().saveSave(game, d).then(noop, noop);
    }
    return {
      available: can, flush: flush,
      load: function () {
        if (!can()) return Promise.resolve({ ok: true, data: null });
        return A().loadSave(game).then(function (r) { return r || { ok: true, data: null }; }, function () { return { ok: false, data: null }; });
      },
      save: function (d) { pend = d; has = true; clearTimeout(timer); timer = setTimeout(flush, 1200); }
    };
  }

  /* ---------- 同步大廳的幻彩主題色 ---------- */
  function theme() {
    try { var v = getComputedStyle(P.document.documentElement).getPropertyValue("--accent").trim(); if (v) document.documentElement.style.setProperty("--accent", v); } catch (e) {}
  }
  theme();

  /* 排行榜收合鈕：固定貼在畫面右緣；長按後可沿右緣拖曳到喜歡的位置（位置會記住） */
  function dragTog() {
    var tog = document.getElementById("sideTog"), side = document.getElementById("side");
    if (!tog || !side || tog._mhDrag) return; tog._mhDrag = 1;
    var KEY = "minihub.sideTogY", f = NaN, timer = 0, id = null, drag = false, sx = 0, sy = 0, off = 0, swallow = false;
    try { f = parseFloat(localStorage.getItem(KEY)); } catch (e) {}
    tog.style.touchAction = "none"; tog.style.userSelect = tog.style.webkitUserSelect = "none"; tog.style.webkitTouchCallout = "none";
    function limits() { var r = side.getBoundingClientRect(), h = tog.offsetHeight || 64; return { top: r.top, min: 8, max: innerHeight - h - 8, h: h }; }
    function place() {                                     // f = 按鈕頂端佔視窗高度的比例；沒拖過就維持遊戲原本位置
      if (!(f >= 0 && f <= 1)) return tog.style.top = "";
      var L = limits(); if (!side.getBoundingClientRect().height) return;
      var y = Math.min(Math.max(f * innerHeight, L.min), L.max); tog.style.top = Math.round(y - L.top) + "px";
    }
    function stop() { clearTimeout(timer); if (drag) { tog.style.filter = tog.style.transform = ""; try { localStorage.setItem(KEY, String(f)); } catch (e) {} } drag = false; id = null; }
    tog.addEventListener("pointerdown", function (e) {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; off = e.clientY - tog.getBoundingClientRect().top; clearTimeout(timer);
      timer = setTimeout(function () { drag = true; swallow = true; tog.style.filter = "brightness(1.5)"; tog.style.transform = "scale(1.08)";
        try { tog.setPointerCapture(id); navigator.vibrate && navigator.vibrate(15); } catch (e) {} }, 350);
    });
    tog.addEventListener("pointermove", function (e) {
      if (e.pointerId !== id) return;
      if (!drag) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer); return; }
      var L = limits(), y = Math.min(Math.max(e.clientY - off, L.min), L.max);
      f = y / innerHeight; tog.style.top = Math.round(y - L.top) + "px"; e.preventDefault();
    });
    ["pointerup", "pointercancel"].forEach(function (t) { tog.addEventListener(t, function (e) { if (e.pointerId === id) stop(); }); });
    tog.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    tog.addEventListener("click", function (e) { if (swallow) { swallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    var re = function () { requestAnimationFrame(place); };
    addEventListener("resize", re); addEventListener("orientationchange", re);
    try { new MutationObserver(re).observe(side, { attributes: true, attributeFilter: ["hidden", "style", "class"] }); } catch (e) {}
    place(); setTimeout(place, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dragTog); else dragTog();

  /* ---------- 動畫效果：大廳關閉時，遊戲內所有 CSS 動畫 / 轉場同步關閉（即時生效） ---------- */
  (function () {
    var st = document.createElement("style");
    st.textContent = "html.mh-no-anim *,html.mh-no-anim *::before,html.mh-no-anim *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}";
    (document.head || document.documentElement).appendChild(st);
    function sync() { document.documentElement.classList.toggle("mh-no-anim", prefs().anim === false); }
    sync(); onChange(sync);
  })();

  window.MiniHub = {
    embedded: !!P, prefs: prefs, theme: theme,
    sfxOn: function () { var p = prefs(); return !p.mute && p.sfx !== false; },
    musicOn: function () { var p = prefs(); return !p.mute && p.music !== false; },
    kbdOn: function () { return prefs().kbd !== false; },
    touchOn: function () { return prefs().touch !== false; },
    onChange: onChange,
    onPause: function (fn) { window.MiniHubPause = fn; },
    onRestart: function (fn) { window.MiniHubRestart = fn; },
    action: function (cfg) { try { if (P && P.MiniHubGameAction) P.MiniHubGameAction(cfg); } catch (e) {} },
    requestNext: requestNext, player: player, board: board, cloud: cloud
  };
})();
