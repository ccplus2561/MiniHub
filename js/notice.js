/**
 * MiniHub 共用提示框（大廳與所有遊戲共用）
 *   MiniHubNotice("訊息")                              一般提示
 *   MiniHubNotice("訊息", { type, title, duration })   type: info | success | warn | error
 *   MiniHubNotice.tip("說明", { title })               💡 教學提示（燈泡圖示，僅用於教學／操作小技巧，非通知）
 * 樣式：圖示 + 短標題/簡單說明 + 「了解 (Ns)」按鈕；停留秒數依字數與類型自動計算（約 6～15s），滑鼠停在提示上或分頁在背景時暫停倒數，倒數到 0s 自動淡出，點按鈕立即關閉。
 * 標題與內容由 REWRITE 統一改寫成簡短白話（原始訊息仍會印在 console.debug 供除錯）。
 */
(function () {
  if (window.MiniHubNotice) return;

  var CSS =
    "#mh-notice-root{position:fixed;top:var(--mh-notice-top,20px);right:20px;width:min(440px,calc(100vw - 24px));z-index:2147483000;display:flex;flex-direction:column;align-items:stretch;gap:10px;pointer-events:none;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif}" +
    ".mh-notice{pointer-events:auto;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;color:#16314a;background:#dff0fa;border:2.5px solid #1c7ec0;box-shadow:0 2px 4px rgba(0,0,0,.18),0 8px 18px rgba(0,0,0,.28),0 18px 40px rgba(0,0,0,.22);animation:mhNIn .3s cubic-bezier(.2,.9,.3,1.05) both}" +
    ".mh-notice.out{animation:mhNOut .45s ease both}" +
    ".mh-notice-ic{flex:none;width:34px;height:34px;color:#16314a;filter:drop-shadow(0 1px 2px rgba(0,0,0,.28))}" +
    ".mh-notice-ic svg{width:100%;height:100%;display:block}" +
    ".mh-notice-tx{flex:1;min-width:0;text-align:left}" +
    ".mh-notice-ti{font-size:18px;font-weight:800;line-height:1.35}" +
    ".mh-notice-ms{margin-top:2px;font-size:16px;font-weight:500;line-height:1.5;word-break:break-word}" +
    ".mh-notice-bt{flex:none;min-width:104px;white-space:nowrap;font-variant-numeric:tabular-nums;height:42px;padding:0 16px;border:0;border-radius:10px;font:inherit;font-size:17px;font-weight:700;color:#fff;background:#1c7ec0;cursor:pointer;transition:filter .15s,transform .15s}" +
    ".mh-notice-bt small{font-size:.85em;font-weight:600;opacity:.9;margin-left:4px}.mh-notice-bt:hover{filter:brightness(1.1)}.mh-notice-bt:active{transform:scale(.96)}" +
    ".mh-notice-bt:focus-visible{outline:3px solid #16314a;outline-offset:2px}" +
    ".mh-notice.error{background:#fde8ea;border-color:#d4405a}.mh-notice.error .mh-notice-bt{background:#d4405a}" +
    ".mh-notice.success{background:#e1f6e8;border-color:#2c9a5b}.mh-notice.success .mh-notice-bt{background:#2c9a5b}" +
    ".mh-notice.tip{background:#efe9ff;border-color:#7a5ad6}.mh-notice.tip .mh-notice-bt{background:#6a49c8}" +
    ".mh-notice.warn{background:#fff3d6;border-color:#d99a1c}.mh-notice.warn .mh-notice-bt{background:#c98512}" +
    "@keyframes mhNIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}@keyframes mhNInM{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:none}}" +
    "@keyframes mhNOut{to{opacity:0;transform:translateX(24px)}}@keyframes mhNOutM{to{opacity:0;transform:translateY(-14px)}}" +
    "body.m #mh-notice-root{right:auto;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top))}body.m .mh-notice{animation-name:mhNInM}body.m .mh-notice.out{animation-name:mhNOutM}" +
    "@media (max-width:600px){#mh-notice-root{right:auto;left:50%;transform:translateX(-50%);top:calc(var(--mh-notice-top-m,10px) + env(safe-area-inset-top))}.mh-notice{animation-name:mhNInM}.mh-notice.out{animation-name:mhNOutM}.mh-notice{padding:12px;gap:10px}.mh-notice-ti{font-size:17px}.mh-notice-ms{font-size:15px}.mh-notice-bt{min-width:94px;height:40px;padding:0 10px;font-size:16px}}" +
    "@media (prefers-reduced-motion:reduce){.mh-notice,.mh-notice.out{animation:none}}";

  // 交通號誌風圖示：有外形（圓／方／三角）＋顏色＋白（或深色）符號
  function disc(c, d, g) { return '<circle cx="12" cy="12" r="10.6" fill="' + c + '" stroke="' + d + '" stroke-width="1.2"/><circle cx="12" cy="12" r="8.6" fill="none" stroke="#fff" stroke-width=".9" opacity=".85"/>' + g; }
  function sq(c, d, g) { return '<rect x="1.6" y="1.6" width="20.8" height="20.8" rx="5.2" fill="' + c + '" stroke="' + d + '" stroke-width="1.2"/><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.4" fill="none" stroke="#fff" stroke-width=".9" opacity=".85"/>' + g; }
  function wh(g) { return '<g stroke="#fff" stroke-width="2.4" fill="none">' + g + "</g>"; }
  function sm(g, k) { return '<g transform="translate(12 12) scale(' + k + ') translate(-12 -12)" stroke="#fff" stroke-width="2.6" fill="none">' + g + "</g>"; }
  var ICON = {
    info: disc("#1c7ec0", "#0f5a8f", wh('<path d="M12 11v6"/><path d="M12 7.3v.1"/>')),
    success: disc("#2c9a5b", "#1b6e3f", wh('<path d="m7.8 12.4 3 3 5.6-6.4"/>')),
    warn: '<path d="M12 2.8 22 20.4H2z" fill="#ffc933" stroke="#16314a" stroke-width="1.9"/><g stroke="#16314a" stroke-width="2.4" fill="none"><path d="M12 9.6v5"/><path d="M12 17.4v.1"/></g>',
    error: disc("#d4405a", "#a22640", wh('<path d="m8.6 8.6 6.8 6.8M15.4 8.6l-6.8 6.8"/>')),
    offline: disc("#d4405a", "#a22640", sm('<path d="M2.5 9a15 15 0 0 1 4-2.6M21.5 9a15 15 0 0 0-9.5-3.7M5.6 12.6a10 10 0 0 1 3-1.9M18.4 12.6a10 10 0 0 0-4-2.3M8.9 16.2a5 5 0 0 1 3.1-1.2 5 5 0 0 1 2.9 1"/><path d="M12 19.6v.1"/><path d="M3 3l18 18"/>', .6)),
    tip: disc("#6a49c8", "#4b32a0", sm('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>', .6)),
    bell: sq("#1c7ec0", "#0f5a8f", sm('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>', .62)),
    welcome: disc("#ffc933", "#c98512", '<g stroke="#5a3b00" fill="none" stroke-linecap="round"><path d="M8.2 13.6a4.6 4.6 0 0 0 7.6 0" stroke-width="2"/><path d="M8.8 9.4v.1M15.2 9.4v.1" stroke-width="3"/></g>'),
    logout: sq("#1c7ec0", "#0f5a8f", sm('<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9.5"/>', .62)),
    mpoint: '<circle cx="12" cy="12" r="10" fill="#f5a623" stroke="#b36b00"/><circle cx="12" cy="12" r="7.2" fill="#ffd770" stroke="#d98a0c" stroke-width="1.2"/><path d="M8.3 15.6V8.6l3.7 4.2 3.7-4.2v7" stroke="#7a4300" stroke-width="2.2"/>'
  };

  var TITLE = { tip: "小提示", info: "提示", success: "完成", warn: "注意", error: "發生錯誤", offline: "連線失敗", bell: "通知", welcome: "歡迎", mpoint: "每日簽到", logout: "登出" };
  var TYPE_OF = { tip: "tip", offline: "error", bell: "info", welcome: "success", mpoint: "success", logout: "info" };
  var MAX = 3;

  // 標題 ≤ 5 字抓重點；內容一句話、白話。[比對, 標題, 內容（可用 $1 $2）]
  var REWRITE = [
    [/^歡迎回來，(.+)！$/, "歡迎回來", "$1，祝你玩得開心！"],
    [/^歡迎，(.+)！首次登入 \+(\d+) M 點$/, "註冊成功", "歡迎 $1！送你 $2 M 點。"],
    [/^簽到成功！\+(\S+) M 點(?:（連續第 (\d+) 天）)?(?:，(.+))?$/, "簽到成功", function (m) { return "獲得 +" + m[1] + " M 點" + (m[2] ? "，連續 " + m[2] + " 天" : "") + (m[3] ? "。" + m[3] : "。"); }],
    [/^今天已經簽到過了$/, "已簽到", "今天領過了，明天再來！"],
    [/^簽到失敗，請確認裝置時間/, "簽到失敗", "請確認裝置時間後再試。"],
    [/^簽到失敗：/, "簽到失敗", "請稍後再試。"],
    [/^網路連線失敗/, "連線失敗", "請檢查網路後再試。"],
    [/^「(.+)」需要登入後才能遊玩/, "請先登入", "「$1」需登入才能玩。"],
    [/^「(.+)」.+，敬請期待！$/, "尚未開放", "「$1」準備中，敬請期待。"],
    [/^帳號已刪除/, "已刪除", "帳號與資料都已清除。"],
    [/^未完成身分驗證/, "未刪除", "身分驗證未完成，帳號仍保留。"],
    [/^密碼錯誤，帳號沒有被刪除/, "未刪除", "密碼錯誤，帳號仍保留。"],
    [/^嘗試次數過多/, "太頻繁", "操作太多次，請稍後再試。"],
    [/^伺服器規則不允許刪除/, "未刪除", "目前無法刪除，帳號仍保留。"],
    [/^玩家資料已清除，但登入帳號尚未刪除/, "尚未完成", "資料已清除，請再按一次「永久刪除」。"],
    [/^刪除失敗/, "刪除失敗", "請稍後再試。"],
    [/^請先勾選同意/, "請先同意", "勾選同意條款才能繼續。"],
    [/^(登入服務載入失敗|無法載入登入服務)/, "登入失敗", "請檢查網路，再重新整理頁面。"],
    [/^登入視窗被瀏覽器擋住/, "視窗被擋", "請允許彈出視窗後再試。"],
    [/^此登入方式尚未在 Firebase/, "登入失敗", "此登入方式尚未開放。"],
    [/^此網域未加入 Firebase/, "登入失敗", "此網址尚未授權登入。"],
    [/^瀏覽器封鎖了儲存空間/, "儲存被擋", "請關閉無痕模式，或允許 Cookie。"],
    [/^登入設定有誤/, "登入失敗", "登入設定有誤，請稍後再試。"],
    [/^此電子郵件已用其他方式註冊/, "已註冊過", "此信箱用別的方式註冊過，請改用原方式登入。"],
    [/^登入失敗：/, "登入失敗", "請稍後再試。"],
    [/^已連結 (.+)，之後兩種方式都能登入$/, "連結成功", "已連結 $1。"],
    [/^登入的帳號與原本註冊的電子郵件不同/, "無法連結", "兩個帳號的信箱不同。"],
    [/^此帳號已有玩家資料/, "已有資料", "此帳號已建立過玩家資料。"],
    [/^讀取資料失敗/, "讀取失敗", "請稍後再試。"],
    [/^已登出$/, "已登出", "下次再見！"],
    [/^使用者名稱已變更$/, "修改成功", "使用者名稱已更新。"],
    [/^目前無法變更使用者名稱/, "無法修改", "使用者名稱 14 天只能改一次。"],
    [/^變更失敗/, "修改失敗", "請稍後再試。"],
    [/^密碼已修改$/, "修改成功", "下次請用新密碼登入。"],
    [/^目前沒有公告$/, "沒有公告", "目前沒有新公告。"],
    [/^再按一次返回即可離開/, "再按一次", "再按一次返回就會離開。"],

    [/^號碼已抽完，實際抽出 (\d+) 次$/, "號碼抽完", "實際抽出 $1 次。"],
    [/^號碼已全部抽出$/, "號碼抽完", "75 個號碼都抽出了。"],
    [/^請先到設定頁開始遊戲$/, "尚未開始", "請先到設定頁開始遊戲。"],
    [/^遊戲尚未開始或已結束$/, "尚未開始", "遊戲還沒開始，或已經結束。"],
    [/^第 (\d+) 名已登錄(?:（同時 (\d+) 人）)?$/, "名次登錄", function (m) { return "第 " + m[1] + " 名" + (m[2] ? "（同時 " + m[2] + " 人）" : "") + "。"; }],
    [/^開始抽獎！$/, "開始抽獎", "設定已鎖定，祝大家好運！"],
    [/^已重新開始$/, "已重新開始", "已回到初始狀態。"],
    [/^已開新局，設定參數已保留$/, "新的一局", "設定已保留，可直接開始。"],
    [/^已開新局$/, "新的一局", "已開始新的一局。"],
    [/^已載入上次的遊戲進度$/, "已載入", "上次的進度已還原。"],
    [/^已載入上次(.+)$/, "已載入", "已還原上次$1。"],
    [/^主持僅限平板、電腦使用/, "手機不支援", "主持請用平板或電腦；手機請選「玩家」或「旁觀」。"],
    [/^請先填寫參加總人數$/, "請先填寫", "請輸入參加總人數。"],
    [/^🎉 (.+) 完成賓果：第 (\d+) 名$/, "賓果！", "$1 完成賓果，第 $2 名。"],
    [/^已撤銷$/, "已撤銷", "該名次已撤銷。"],
    [/^已恢復，依賓果順序重新排入$/, "已恢復", "已依賓果順序重新排名。"],
    [/^已還原上次的抽號進度$/, "已還原", "上次的抽號進度已回復。"],
    [/^自動對號已開啟，不需要手動標記$/, "自動對號", "已開啟，不必手動標記。"],
    [/^自動對號已開啟$/, "自動對號", "已開啟。"],
    [/^自動對號已關閉/, "自動對號", "已關閉，請自己點號碼標記。"],
    [/^主持人還沒有抽出這個號碼$/, "還沒抽到", "主持人尚未抽出這個號碼。"],
    [/^本房為 BINGO 正式版/, "BINGO 正式版", "每欄數字有固定範圍，請依欄位填寫。"],
    [/^主持人已關閉 BINGO 正式版/, "已關閉正式版", "號碼 1～75 可任意填寫。"],
    [/^卡片已鎖定，開始遊戲！$/, "開始遊戲", "卡片已鎖定，祝你好運！"],
    [/^遊戲結束$/, "遊戲結束", "本局已結束。"],
    [/^已清除標記$/, "已清除", "所有標記都已清除。"],
    [/^已恢復房間 (.+) 的卡片$/, "已恢復", "房間 $1 的卡片已還原。"],
    [/^要連成 (\d+) 條線才能上名次$/, "還不能上榜", "要連成 $1 條線才能上名次。"],
    [/^網路不穩，宣告可能未送出/, "送出失敗", "網路不穩，請再試一次。"],
    [/^已通知主持人$/, "已通知", "主持人已收到。"],
    [/^主持人已開始，卡片已鎖定$/, "遊戲開始", "主持人已開始，卡片已鎖定。"],
    [/^主持人已開始，空格已自動補齊並鎖定$/, "遊戲開始", "空格已自動補齊，卡片已鎖定。"],
    [/^主持人開新局/, "新的一局", "數字已保留，可重新修改。"],
    [/^達成 2048！繼續挑戰$/, "達成 2048", "繼續挑戰更高分！"],
    [/^已開啟正常版：/, "正式版", "超出欄位範圍的數字已標示，請修正。"],
    [/^已開啟 BINGO 正常版$/, "正式版", "已開啟 BINGO 正式版。"],
    [/^已關閉：1～75 全部隨機$/, "已關閉正式版", "1～75 全部隨機。"]
  ];

  function rewrite(msg) {
    for (var i = 0; i < REWRITE.length; i++) {
      var m = REWRITE[i][0].exec(msg);
      if (!m) continue;
      var t = REWRITE[i][2];
      return { title: REWRITE[i][1], msg: typeof t === "function" ? t(m) : t.replace(/\$(\d)/g, function (_, n) { return m[n] || ""; }) };
    }
    return null;
  }

  // 停留秒數：基本 4s + 每字 0.22s（中文約每秒讀 4～5 字），再依類型設下限，最長 15s
  var MIN = { info: 6, success: 6, warn: 8, error: 10, tip: 10 };
  function calc(type, title, shown) {
    var s = Math.round(4 + (String(title).length + String(shown).length) * 0.22);
    return Math.min(15, Math.max(MIN[type] || 6, s));
  }

  function guess(msg) {
    if (/^歡迎/.test(msg)) return "welcome";
    if (/簽到|M 點/.test(msg) && !/失敗/.test(msg)) return "mpoint";
    if (/^已登出/.test(msg)) return "logout";
    if (/連線失敗|網路|離線|斷線/.test(msg)) return "offline";
    if (/失敗|錯誤|無法|有誤|不允許|封鎖|擋住|過多|沒有被刪除|未完成/.test(msg)) return "error";
    if (/公告|通知/.test(msg)) return "bell";
    if (/請先|需要登入|不支援|僅限|尚未|即將推出|敬請期待|再按一次|要連成|還沒/.test(msg)) return "warn";
    if (/成功|已(登出|儲存|修改|變更|連結|刪除|載入|開新局|還原|恢復|清除|撤銷|重新開始|開啟|關閉|登錄)|開始抽獎|完成|達成|鎖定/.test(msg)) return "success";
    return "info";
  }

  function root() {
    var r = document.getElementById("mh-notice-root");
    if (r) return r;
    if (!document.getElementById("mh-notice-css")) {
      var st = document.createElement("style"); st.id = "mh-notice-css"; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    r = document.createElement("div"); r.id = "mh-notice-root"; r.setAttribute("aria-live", "polite");
    (document.body || document.documentElement).appendChild(r);
    return r;
  }

  function notice(msg, opts) {
    opts = opts || {};
    msg = String(msg == null ? "" : msg);
    var icon = ICON[opts.icon] ? opts.icon : (ICON[opts.type] ? opts.type : guess(msg));
    var type = ICON[opts.type] && !ICON[opts.icon] ? opts.type : (TYPE_OF[icon] || icon);
    var title = opts.title || TITLE[icon];
    var shown = msg;
    var rw = (opts.title || icon === "tip") ? null : rewrite(msg);
    if (rw) { title = rw.title; shown = rw.msg; try { console.debug("[MiniHubNotice]", msg); } catch (e) {} }
    var secs = opts.duration ? Math.max(1, Math.round(opts.duration / 1000)) : calc(icon === "tip" ? "tip" : type, title, shown);
    var r = root();

    // 相同內容不重複疊加
    var old = r.querySelectorAll(".mh-notice");
    for (var i = 0; i < old.length; i++) if (old[i]._msg === msg) old[i]._close(true);
    while (r.children.length >= MAX) r.lastChild._close(true);

    var box = document.createElement("div");
    box.className = "mh-notice " + type; box._msg = msg;
    box.setAttribute("role", type === "error" ? "alert" : "status");
    box.innerHTML =
      '<span class="mh-notice-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[icon] + "</svg></span>" +
      '<div class="mh-notice-tx"><div class="mh-notice-ti"></div><div class="mh-notice-ms"></div></div>' +
      '<button type="button" class="mh-notice-bt">了解<small></small></button>';
    box.querySelector(".mh-notice-ti").textContent = title;
    box.querySelector(".mh-notice-ms").textContent = shown;

    var timer = 0, done = false, paused = false, left = secs, cd = box.querySelector(".mh-notice-bt small");
    function paint() { cd.textContent = "(" + left + "s)"; }
    function close(now) {
      if (done) return; done = true; clearInterval(timer);
      if (now) { box.remove(); return; }
      box.classList.add("out"); setTimeout(function () { box.remove(); }, 450);
    }
    function start() {
      paint();
      timer = setInterval(function () { if (paused || document.hidden) return; left--; paint(); if (left <= 0) close(); }, 1000);
    }
    box._close = close;
    // 滑鼠移上或鍵盤聚焦時暫停倒數，讓人慢慢讀
    box.addEventListener("mouseenter", function () { paused = true; });
    box.addEventListener("mouseleave", function () { paused = false; });
    box.addEventListener("focusin", function () { paused = true; });
    box.addEventListener("focusout", function () { paused = false; });
    box.querySelector(".mh-notice-bt").addEventListener("click", function () { close(); });
    r.insertBefore(box, r.firstChild); start();   // 新訊息在最上面，舊的往下；倒數到 0s 後淡出

    return close;
  }

  notice.tip = function (msg, opts) { opts = opts || {}; opts.icon = "tip"; return notice(msg, opts); };
  window.MiniHubNotice = notice;
})();
