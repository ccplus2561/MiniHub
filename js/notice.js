/**
 * MiniHub 共用提示框（大廳與所有遊戲共用）
 *   MiniHubNotice("訊息")                              一般提示
 *   MiniHubNotice("訊息", { type, title, duration })   type: info | success | warn | error
 * 樣式：圖示 + 標題/文字 + 「了解」按鈕；數秒後自動消失（滑鼠移上去或聚焦時暫停計時）。
 */
(function () {
  if (window.MiniHubNotice) return;

  var CSS =
    "#mh-notice-root{position:fixed;left:0;right:0;bottom:var(--mh-notice-bottom,28px);z-index:2147483000;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px;pointer-events:none;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif}" +
    ".mh-notice{pointer-events:auto;box-sizing:border-box;width:min(560px,100%);display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;color:#16314a;background:#dff0fa;border:2.5px solid #1c7ec0;box-shadow:0 10px 30px rgba(0,0,0,.35);animation:mhNIn .28s cubic-bezier(.2,.9,.3,1.1) both}" +
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
    "@keyframes mhNIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}" +
    "@keyframes mhNOut{to{opacity:0;transform:translateY(10px) scale(.97)}}" +
    "@media (max-width:600px){.mh-notice{padding:12px;gap:10px}.mh-notice-ti{font-size:17px}.mh-notice-ms{font-size:15px}.mh-notice-bt{min-width:64px;height:40px;padding:0 12px;font-size:16px}}" +
    "@media (prefers-reduced-motion:reduce){.mh-notice,.mh-notice.out{animation:none}}";

  var ICON = {
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.3v.1"/>',
    success: '<circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.4 3 3 5.6-6.4"/>',
    warn: '<path d="M12 3.2 22 20.4H2z"/><path d="M12 10v5"/><path d="M12 17.6v.1"/>',
    error: '<path d="M12 3.2 22 20.4H2z"/><path d="M12 10v5"/><path d="M12 17.6v.1"/>'
  };
  var TITLE = { info: "提示", success: "完成", warn: "注意", error: "發生錯誤" };
  var MAX = 3;

  function guess(msg) {
    if (/失敗|錯誤|無法|有誤|不允許|封鎖|擋住|過多|不穩|沒有被刪除|未完成/.test(msg)) return "error";
    if (/請先|需要登入|不支援|僅限|尚未|即將推出|敬請期待|再按一次|要連成|還沒/.test(msg)) return "warn";
    if (/成功|歡迎|已(登出|儲存|修改|變更|連結|刪除|載入|開新局|還原|恢復|清除|撤銷|通知|重新開始|開啟|關閉|登錄)|開始抽獎|完成|達成|鎖定/.test(msg)) return "success";
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
    var type = ICON[opts.type] ? opts.type : guess(msg);
    var title = opts.title || TITLE[type];
    var ms = opts.duration || (type === "error" ? 6000 : 4200);
    var r = root();

    // 相同內容不重複疊加
    var old = r.querySelectorAll(".mh-notice");
    for (var i = 0; i < old.length; i++) if (old[i]._msg === msg) old[i]._close(true);
    while (r.children.length >= MAX) r.firstChild._close(true);

    var box = document.createElement("div");
    box.className = "mh-notice " + type; box._msg = msg;
    box.setAttribute("role", type === "error" ? "alert" : "status");
    box.innerHTML =
      '<span class="mh-notice-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[type] + "</svg></span>" +
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
    r.appendChild(box); start();
    return close;
  }

  window.MiniHubNotice = notice;
})();
