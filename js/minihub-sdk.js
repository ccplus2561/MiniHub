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
    try { if (P && P.MiniHubPrefs) src = P.MiniHubPrefs() || {}; } catch (e) {}
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

  /* ---------- 同步大廳的幻彩主題色 ---------- */
  function theme() {
    try { var v = getComputedStyle(P.document.documentElement).getPropertyValue("--accent").trim(); if (v) document.documentElement.style.setProperty("--accent", v); } catch (e) {}
  }
  theme();

  window.MiniHub = {
    embedded: !!P, prefs: prefs, theme: theme,
    sfxOn: function () { var p = prefs(); return !p.mute && p.sfx !== false; },
    musicOn: function () { var p = prefs(); return !p.mute && p.music !== false; },
    kbdOn: function () { return prefs().kbd !== false; },
    touchOn: function () { return prefs().touch !== false; },
    onChange: onChange,
    onPause: function (fn) { window.MiniHubPause = fn; },
    requestNext: requestNext, player: player, board: board
  };
})();
