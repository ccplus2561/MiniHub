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
    $$(".help-pane").forEach(p => p.classList.toggle("active", p.id === "help-" + btn.dataset.pane));
    if (btn.dataset.pane === "status") { paintNet(); paintAuth(); paintUsage(); if (!checked) checkServer(); }
  }));

  /* ---------- 伺服器狀態 ---------- */
  const stat = (id, text, s) => { const el = $(id); el.textContent = text; el.dataset.s = s; };
  let authUser;   // undefined = 還沒收到 Firebase 的回報
  const paintNet = () => stat("#stNet", navigator.onLine ? "已連線" : "離線", navigator.onLine ? "ok" : "bad");
  const paintAuth = () => authUser === undefined
    ? stat("#stAuth", window.MiniHubAuth ? "確認中…" : "未載入", window.MiniHubAuth ? "wait" : "bad")
    : stat("#stAuth", authUser ? "已登入" : "訪客（未登入）", authUser ? "ok" : "");
  const paintUsage = () => {
    const u = window.MiniHubAuth && MiniHubAuth.usage ? MiniHubAuth.usage() : { reads: 0, writes: 0 };
    $("#stReads").textContent = u.reads; $("#stWrites").textContent = u.writes;
  };
  let checking = false, checked = false;
  const srvIdle = () => { stat("#stSrv", "未連線", ""); $("#stSrvNote").textContent = "訪客模式不會連線或同步，登入後才會連線並可檢查"; };
  async function checkServer() {
    if (checking) return;
    if (!authUser) { checked = false; paintNet(); paintAuth(); paintUsage(); srvIdle(); return; }   // 未登入：不連線
    checking = true; checked = true;
    const btn = $("#stCheck"), label = $("span", btn);
    btn.disabled = true; label.textContent = "檢查中…";
    paintNet(); paintAuth();
    stat("#stSrv", "檢查中…", "wait"); $("#stSrvNote").textContent = "正在連線…";
    if (!window.MiniHubAuth || !MiniHubAuth.ping) {
      stat("#stSrv", "未載入", "bad"); $("#stSrvNote").textContent = "登入服務載入失敗，請檢查網路後重新整理";
    } else {
      const r = await MiniHubAuth.ping();
      if (r.skipped) srvIdle();
      else if (r.ok) { stat("#stSrv", "運作中", "ok"); $("#stSrvNote").textContent = "回應時間 " + r.ms + " ms（" + new Date().toLocaleTimeString("zh-TW", { hour12: false }) + "）"; }
      else { stat("#stSrv", r.code === "timeout" ? "逾時" : "無法連線", "bad"); $("#stSrvNote").textContent = "錯誤：" + r.code; }
    }
    btn.disabled = false; label.textContent = "重新檢查"; checking = false;
    paintUsage();
  }
  $("#stCheck").addEventListener("click", checkServer);
  document.addEventListener("minihub:usage", paintUsage);
  document.addEventListener("minihub:auth", e => {
    const was = !!authUser;
    authUser = e.detail.user; paintAuth();
    if (!!authUser !== was) { checked = false; if (!authUser) srvIdle(); }   // 登入 / 登出後，下次開啟此頁重新檢查
  });
  addEventListener("online", paintNet); addEventListener("offline", paintNet);
  paintNet(); paintAuth(); paintUsage();
  srvIdle();   // 預設：未連線（登入後才會檢查）

  /* ---------- 帳號 ---------- */
  function fill(el, v, empty) {
    el.textContent = v || empty || "尚未綁定";
    el.classList.toggle("empty", !v);
  }
  const LOCK_MS = 14 * 864e5;
  const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };
  // 電子郵件遮罩：開頭 1–5 碼（依長度）+ **** + @ 之後完整顯示
  const maskEmail = m => {
    const i = m.lastIndexOf("@");
    if (i < 1) return m;
    const n = i, v = n <= 3 ? 1 : n <= 5 ? 3 : n <= 7 ? 4 : 5;
    return m.slice(0, v) + "****" + m.slice(i);
  };
  let showEmail = false;
  const paintEmail = () => {
    const a = window.MiniHubAccount;
    fill($("#accEmail"), a.email ? (showEmail ? a.email : maskEmail(a.email)) : "", "登入後顯示");
    const eye = $("#emailEye");
    eye.hidden = !a.email;
    eye.classList.toggle("shown", showEmail);
    eye.setAttribute("aria-label", showEmail ? "隱藏電子郵件" : "顯示完整電子郵件");
  };
  const fillAccount = () => {
    const a = window.MiniHubAccount;
    const guest = !a.uid, G = "登入後顯示";
    $("#guestNote").hidden = !guest;
    fill($("#accName"), a.name || (guest ? "訪客" : ""), G);
    $("#accName").classList.toggle("empty", false);
    fill($("#accUid"), a.uid, G);
    paintEmail();
    fill($("#accReg"), a.createdAt ? fmtDate(a.createdAt) : "", G);
    fill($("#accLast"), a.lastLoginAt ? fmtDate(a.lastLoginAt) : (a.uid ? "尚無紀錄" : ""), G);
    const until = a.nameChangedAt ? a.nameChangedAt + LOCK_MS : 0;
    const locked = until > Date.now();
    $("#accLock").hidden = !locked;
    if (locked) $("#accLock").textContent = "將於 " + fmtDate(until) + " 後才可變更";
    $("#editNameBtn").hidden = !a.uid;
    $("#editNameBtn").disabled = locked;
  };
  fillAccount();
  $("#emailEye").addEventListener("click", () => { showEmail = !showEmail; paintEmail(); });
  document.addEventListener("minihub:account", () => { showEmail = false; fillAccount(); });

  /* ---------- 顯示 / 語言：目前只有預設項目 ---------- */
  ["display", "lang"].forEach(group => {
    $$(`[data-group="${group}"]:not(:disabled)`).forEach(el => el.addEventListener("click", () => {
      $$(`[data-group="${group}"]`).forEach(x => x.classList.toggle("selected", x === el));
    }));
  });

  /* ---------- 偏好（開關 / 分段）：不保存 ---------- */
  const DEFAULTS = {
    cardSizeD: "m", cardSizeM: "m", anim: true, fsStart: false,   // 圖卡大小：電腦版 / 手機版各自保存
    mute: false, music: true, sfx: true,
    kbd: true, touch: true, publicName: false, joinRank: false,
    lang: "zh-Hant", display: "auto"
  };
  // 登入後同步到帳號的項目（動畫 / 全螢幕 / 語言 / 音效 / 操作；隱私與帳號另外同步）。圖卡大小、顯示模式不保存
  const SYNC = ["anim", "fsStart", "lang", "mute", "music", "sfx", "kbd", "touch", "cardSizeD", "cardSizeM"];
  const LANGS = ["zh-Hant"];
  let prefs = { ...DEFAULTS };
  // 所有參數僅存在記憶體：不寫入 localStorage / cookie，重新開啟網頁即恢復預設
  const save = () => {};
  const SIZES = { s: "132px", m: "168px", l: "212px" };
  const SIZES_M = { s: "112px", m: "140px", l: "172px" };   // 手機版圖卡較小
  const SIZE_KEYS = ["s", "m", "l"];
  const LABELS = { cardSize: "圖卡大小", anim: "動畫效果", fsStart: "遊戲全螢幕", mute: "全部靜音", music: "音樂", sfx: "音效", kbd: "鍵盤快捷鍵", touch: "觸控滑動", publicName: "公開使用者名稱", joinRank: "加入排行榜" };
  const sfx = n => window.MiniHubSfx && MiniHubSfx(n);
  const say = m => window.MiniHubToast && MiniHubToast(m);

  // 顯示模式：auto = 螢幕寬度 ≤ 820px 用手機版；也可手動指定。只影響版面（body.m），不保存
  const narrow = matchMedia("(max-width: 820px)");
  narrow.addEventListener && narrow.addEventListener("change", () => paint());
  // 手機版：鍵盤快捷鍵固定關閉、觸控滑動固定開啟（只改實際效果，不動已保存的電腦版設定）
  const isMobile = () => prefs.display === "mobile" || (prefs.display === "auto" && narrow.matches);
  const sizeKey = () => isMobile() ? "cardSizeM" : "cardSizeD";
  const eff = k => isMobile() && k === "kbd" ? false : isMobile() && k === "touch" ? true : prefs[k];
  function paint() {
    const mob = isMobile();
    $$("[data-set]").forEach(el => {
      const k = el.dataset.set, v = k === "cardSize" ? prefs[sizeKey()] : eff(k);
      if (el.classList.contains("switch")) { el.setAttribute("aria-checked", !!v); el.disabled = mob && (k === "kbd" || k === "touch"); }
      else if (el.classList.contains("seg")) $$("button", el).forEach(b => b.classList.toggle("on", b.dataset.value === v));
    });
    // 全部靜音時，音樂 / 音效列變暗
    // 遊戲播放列的音樂 / 音效按鈕（全部靜音時也顯示為關閉）
    $$(".pm-btn").forEach(b => { const on = !prefs.mute && prefs[b.dataset.pm] !== false; b.classList.toggle("off", !on); b.setAttribute("aria-pressed", String(on)); });
    $$("[data-dep]").forEach(r => r.classList.toggle("off", !!prefs[r.dataset.dep]));
    // 允許鍵盤快捷鍵 → 才顯示快捷鍵介面與底部提示
    $("#kbdPanel").hidden = !eff("kbd");
    $("#kbdOff").hidden = eff("kbd");
    document.body.classList.toggle("no-kbd", !eff("kbd"));
    document.body.classList.toggle("no-anim", !prefs.anim);
    document.body.classList.toggle("no-touch", !eff("touch"));
    document.documentElement.style.setProperty("--card-w", (mob ? SIZES_M : SIZES)[prefs[sizeKey()]] || (mob ? SIZES_M : SIZES).m);
    document.body.classList.toggle("m", mob);
    $$('[data-group="display"]').forEach(x => x.classList.toggle("selected", x.dataset.value === prefs.display));
    $$('[data-group="lang"]').forEach(x => x.classList.toggle("selected", x.dataset.value === prefs.lang));
    const pv = $("#rankPreview");
    if (pv) pv.textContent = !window.MiniHubAccount.uid ? "登入後顯示" : !prefs.joinRank ? "不加入排行榜" : rankName();
    document.dispatchEvent(new CustomEvent("minihub:prefs"));   // 通知遊戲（快捷鍵介面 / 排行榜）設定已變
  }

  /* ---------- 排行榜：名稱遮蔽 / 資格（供遊戲查詢） ---------- */
  // 遮蔽：保留頭尾，中間以 * 取代（2 字只留第一字；1 字全遮），不會整個名稱都是 *
  const maskName = n => {
    const c = Array.from(String(n || ""));
    if (c.length <= 1) return "*";
    if (c.length === 2) return c[0] + "*";
    return c[0] + "*".repeat(c.length - 2) + c[c.length - 1];
  };
  const rankName = () => { const a = window.MiniHubAccount; return prefs.publicName ? a.name : maskName(a.name); };
  const canRank = () => !!window.MiniHubAccount.uid && !!prefs.joinRank;   // 已登入且開啟「允許加入排行榜」才能進行排名比較
  window.MiniHubRank = { canRank, displayName: rankName, maskName };
  // 遊戲（iframe）可傳 { type: "minihub:getPlayer" } 取得排行榜資格與顯示名稱；不提供電子郵件
  addEventListener("message", e => {
    const fr = $("#frame");
    if (!fr || e.source !== fr.contentWindow || !e.data || e.data.type !== "minihub:getPlayer") return;
    const ok = canRank();
    e.source.postMessage({ type: "minihub:player", canRank: ok, name: ok ? rankName() : "", uid: ok ? window.MiniHubAccount.uid : "" }, e.origin === "null" ? "*" : e.origin);
  });

  /* ---------- 同步偏好到帳號（登入後；停手 1 秒才寫入，避免頻繁讀寫） ---------- */
  const syncedPrefs = () => { const o = {}; SYNC.forEach(k => o[k] = prefs[k]); return o; };
  window.MiniHubSyncedPrefs = syncedPrefs;
  let saveT = 0, dirty = false;
  const flush = () => {
    clearTimeout(saveT);
    if (!dirty) return Promise.resolve();
    dirty = false;
    return MiniHubAuth.savePrefs(syncedPrefs()).catch(() => say("設定同步失敗"));
  };
  window.MiniHubFlushPrefs = flush;
  const queueSave = k => {
    if (!SYNC.includes(k) || !window.MiniHubAccount.uid || !window.MiniHubAuth) return;   // 訪客：不連線、不保存
    dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 1000);
  };
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

  // 遊戲播放列：音樂 / 音效快速開關（與設定頁同步；全部靜音中按下 = 解除靜音並開啟該項）
  document.addEventListener("click", e => {
    const pb = e.target.closest(".pm-btn");
    if (!pb) return;
    const k = pb.dataset.pm;
    if (prefs.mute) { prefs.mute = false; prefs[k] = true; queueSave("mute"); }
    else prefs[k] = !prefs[k];
    save(); paint(); queueSave(k); sfx(prefs[k] ? "on" : "off"); say(LABELS[k] + "：" + (prefs[k] ? "開啟" : "關閉"));
    pb.blur(); try { $("#frame").focus(); } catch (x) {}
  });
  document.addEventListener("click", e => {
    const dm = e.target.closest('[data-group="display"]:not(:disabled)');
    if (dm) { prefs.display = dm.dataset.value; paint(); }
    const lg = e.target.closest('[data-group="lang"]:not(:disabled)');
    if (lg && LANGS.includes(lg.dataset.value)) { prefs.lang = lg.dataset.value; paint(); queueSave("lang"); }
    const sw = e.target.closest(".switch[data-set]");
    if (sw) { const k = sw.dataset.set; prefs[k] = !prefs[k]; save(); paint(); queueSave(k); sfx(prefs[k] ? "on" : "off"); say(LABELS[k] + "：" + (prefs[k] ? "開啟" : "關閉"));
      if ((k === "publicName" || k === "joinRank") && window.MiniHubAccount.uid && window.MiniHubAuth) {   // 已登入：同步到帳號
        const v = prefs[k];
        MiniHubAuth[k === "publicName" ? "setPublicName" : "setJoinRank"](v).catch(() => { prefs[k] = !v; paint(); say("同步失敗，已還原"); });
      }
      return; }
    const sb = e.target.closest(".seg button");
    if (sb) { let k = sb.parentElement.dataset.set; const label = LABELS[k]; if (k === "cardSize") k = sizeKey(); prefs[k] = sb.dataset.value; save(); paint(); queueSave(k); sfx("select"); say(label + "：" + sb.textContent); }
  });
  window.MiniHubPrefs = () => ({ ...prefs, kbd: eff("kbd"), touch: eff("touch"), cardSize: prefs[sizeKey()] });   // 供大廳 / 音效使用的「實際生效」設定
  // 登入後套用帳號裡的「公開使用者名稱」；登出（訪客）回到預設
  document.addEventListener("minihub:account", () => {
    const a = window.MiniHubAccount;
    $("#delAccBox").hidden = !a.uid;   // 只有登入後才顯示「刪除帳號」
    if (!a.uid) {   // 登出 / 訪客：回到預設，不留下上一位玩家的設定
      prefs.publicName = DEFAULTS.publicName; prefs.joinRank = DEFAULTS.joinRank;
      SYNC.forEach(k => prefs[k] = DEFAULTS[k]);
      dirty = false; clearTimeout(saveT);
    }
    else {
      if (a.prefs) SYNC.forEach(k => { const v = a.prefs[k]; if (typeof v === typeof DEFAULTS[k] && (k !== "lang" || LANGS.includes(v)) && (!/^cardSize/.test(k) || SIZE_KEYS.includes(v))) prefs[k] = v; });
      if (typeof a.publicName === "boolean") prefs.publicName = a.publicName;
      if (typeof a.joinRank === "boolean") prefs.joinRank = a.joinRank;
    }
    paint();
  });
  paint();
})();
