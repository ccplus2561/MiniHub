/**
 * MiniHub 共用提示框（大廳與所有遊戲共用）
 *   MiniHubNotice("訊息")                              一般提示
 *   MiniHubNotice("訊息", { type, title, duration })   type: info | success | warn | error
 * 樣式：圖示 + 標題/文字 + 「了解」按鈕；數秒後自動消失（滑鼠移上去或聚焦時暫停計時）。
 */
(function () {
  if (window.MiniHubNotice) return;

  var CSS =
    "#mh-notice-root{position:fixed;top:var(--mh-notice-top,20px);right:20px;width:min(440px,calc(100vw - 24px));z-index:2147483000;display:flex;flex-direction:column;align-items:stretch;gap:10px;pointer-events:none;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif}" +
    ".mh-notice{pointer-events:auto;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;color:#16314a;background:#dff0fa;border:2.5px solid #1c7ec0;box-shadow:0 10px 30px rgba(0,0,0,.35);animation:mhNIn .3s cubic-bezier(.2,.9,.3,1.05) both}" +
    ".mh-notice.out{animation:mhNOut .22s ease both}" +
    ".mh-notice-ic{flex:none;width:30px;height:30px;color:#16314a}" +
    ".mh-notice-ic svg{width:100%;height:100%;display:block}" +
    ".mh-notice-tx{flex:1;min-width:0;text-align:left}" +
    ".mh-notice-ti{font-size:18px;font-weight:800;line-height:1.35}" +
    ".mh-notice-ms{margin-top:2px;font-size:16px;font-weight:500;line-height:1.5;word-break:break-word}" +
    ".mh-notice-bt{flex:none;min-width:72px;height:42px;padding:0 16px;border:0;border-radius:10px;font:inherit;font-size:17px;font-weight:700;color:#fff;background:#1c7ec0;cursor:pointer;transition:filter .15s,transform .15s}" +
    ".mh-notice-bt:hover{filter:brightness(1.1)}.mh-notice-bt:active{transform:scale(.96)}" +
    ".mh-notice-bt:focus-visible{outline:3px solid #16314a;outline-offset:2px}" +
    ".mh-notice.error{background:#fde8ea;border-color:#d4405a}.mh-notice.error .mh-notice-bt{background:#d4405a}" +
    ".mh-notice.success{background:#e1f6e8;border-color:#2c9a5b}.mh-notice.success .mh-notice-bt{background:#2c9a5b}" +
    ".mh-notice.warn{background:#fff3d6;border-color:#d99a1c}.mh-notice.warn .mh-notice-bt{background:#c98512}" +
    "@keyframes mhNIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}@keyframes mhNInM{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:none}}" +
    "@keyframes mhNOut{to{opacity:0;transform:translateX(40px)}}@keyframes mhNOutM{to{opacity:0;transform:translateY(-24px)}}" +
    "body.m #mh-notice-root{right:auto;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top))}body.m .mh-notice{animation-name:mhNInM}body.m .mh-notice.out{animation-name:mhNOutM}" +
    "@media (max-width:600px){#mh-notice-root{right:auto;left:50%;transform:translateX(-50%);top:calc(var(--mh-notice-top-m,10px) + env(safe-area-inset-top))}.mh-notice{animation-name:mhNInM}.mh-notice.out{animation-name:mhNOutM}.mh-notice{padding:12px;gap:10px}.mh-notice-ti{font-size:17px}.mh-notice-ms{font-size:15px}.mh-notice-bt{min-width:64px;height:40px;padding:0 12px;font-size:16px}}" +
    "@media (prefers-reduced-motion:reduce){.mh-notice,.mh-notice.out{animation:none}}";

  var ICON = {
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.3v.1"/>',
    success: '<circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.4 3 3 5.6-6.4"/>',
    warn: '<path d="M12 3.2 22 20.4H2z"/><path d="M12 10v5"/><path d="M12 17.6v.1"/>',
    error: '<circle cx="12" cy="12" r="9.5"/><path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4"/>',
    offline: '<path d="M2.5 9a15 15 0 0 1 4-2.6M21.5 9a15 15 0 0 0-9.5-3.7M5.6 12.6a10 10 0 0 1 3-1.9M18.4 12.6a10 10 0 0 0-4-2.3M8.9 16.2a5 5 0 0 1 3.1-1.2 5 5 0 0 1 2.9 1"/><path d="M12 19.6v.1"/><path d="M3 3l18 18"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
    welcome: '<circle cx="12" cy="12" r="9.5"/><path d="M8.2 14a4.6 4.6 0 0 0 7.6 0"/><path d="M8.8 9.4v.1M15.2 9.4v.1" stroke-width="3"/>',
    logout: '<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9.5"/>',
    mpoint: '<circle cx="12" cy="12" r="10" fill="#f5a623" stroke="#b36b00"/><circle cx="12" cy="12" r="7.2" fill="#ffd770" stroke="#d98a0c" stroke-width="1.2"/><path d="M8.3 15.6V8.6l3.7 4.2 3.7-4.2v7" stroke="#7a4300" stroke-width="2.2"/>'
  };
  var TITLE = { info: "提示", success: "完成", warn: "注意", error: "發生錯誤", offline: "連線失敗", bell: "通知", welcome: "歡迎", mpoint: "每日簽到", logout: "登出" };
  var TYPE_OF = { offline: "error", bell: "info", welcome: "success", mpoint: "success", logout: "info" };
  var MAX = 3;

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
    var ms = opts.duration || (type === "error" ? 6000 : 4200);
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
      '<button type="button" class="mh-notice-bt">了解</button>';
    box.querySelector(".mh-notice-ti").textContent = title;
    box.querySelector(".mh-notice-ms").textContent = msg;

    var timer = 0, done = false;
    function close(now) {
      if (done) return; done = true; clearTimeout(timer);
      if (now) { box.remove(); return; }
      box.classList.add("out"); setTimeout(function () { box.remove(); }, 220);
    }
    function start() { clearTimeout(timer); timer = setTimeout(close, ms); }
    box._close = close;
    box.querySelector(".mh-notice-bt").addEventListener("click", function () { close(); });
    box.addEventListener("mouseenter", function () { clearTimeout(timer); });
    box.addEventListener("mouseleave", start);
    box.addEventListener("focusin", function () { clearTimeout(timer); });
    box.addEventListener("focusout", start);
    r.insertBefore(box, r.firstChild); start();   // 新訊息在最上面，舊的往下

    return close;
  }

  window.MiniHubNotice = notice;
})();
