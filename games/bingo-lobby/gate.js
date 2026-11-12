(() => {
  "use strict";
  // 多人賓果登入門檻：未登入時蓋上全螢幕提示，登入後自動解除（大廳 / 主持 / 玩家 / 旁觀頁共用）
  const WAIT_RESTORE_MS = 8000;   // 分頁內已有登入狀態時，等 Firebase 還原登入，避免畫面閃一下
  const born = Date.now();
  let el = null, timer = 0;

  const P = (() => { try { return parent !== window && parent.document ? parent : null; } catch (e) { return null; } })();
  const loggedIn = () => { try { return !!(window.MiniHub && MiniHub.player().loggedIn); } catch (e) { return false; } };
  const restoring = () => { try { return !!(P && P.MiniHubAuth && P.MiniHubAuth.hasSession() && Date.now() - born < WAIT_RESTORE_MS); } catch (e) { return false; } };

  function setInert(on) {
    Array.from(document.body.children).forEach(n => {
      if (n === el || n.tagName === "SCRIPT") return;
      if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert");
    });
  }

  function build() {
    const box = document.createElement("div");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#3a0a0f,#14040a 70%);color:#fff4dc;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;text-align:center";
    const card = document.createElement("div");
    card.style.cssText = "max-width:360px;padding:28px 22px;border:1px solid rgba(246,196,83,.4);border-radius:18px;background:rgba(255,255,255,.07)";
    const ico = document.createElement("div"); ico.textContent = "🔒"; ico.style.cssText = "font-size:44px;margin-bottom:8px";
    const h = document.createElement("h2"); h.textContent = "請先登入"; h.style.cssText = "margin:0 0 8px;color:#f6c453;letter-spacing:.1em";
    const p = document.createElement("p");
    p.textContent = P ? "多人賓果需要登入後才能遊玩，房間資料會同步到雲端。" : "多人賓果需要登入後才能遊玩，請從 MiniHub 首頁進入並登入。";
    p.style.cssText = "margin:0 0 18px;line-height:1.6;opacity:.9";
    card.append(ico, h, p);
    const btn = P && P.document.getElementById("loginBtn") ? document.createElement("button") : null;
    if (btn) {
      btn.type = "button"; btn.textContent = "前往登入";
      btn.style.cssText = "min-height:46px;padding:0 28px;border:0;border-radius:999px;background:#f6c453;color:#3a0a0f;font:inherit;font-weight:700;cursor:pointer";
      btn.addEventListener("click", () => { try { P.document.getElementById("loginBtn").click(); } catch (e) { /* 忽略 */ } });
      card.appendChild(btn);
    }
    box.appendChild(card);
    return { box, btn };
  }

  function render() {
    clearTimeout(timer);
    if (loggedIn()) {
      if (el) { el.remove(); el = null; setInert(false); }
      return;
    }
    if (restoring()) { timer = setTimeout(render, 500); return; }
    if (el) return;
    const b = build();
    el = b.box;
    document.body.appendChild(el);
    setInert(true);
    if (b.btn) b.btn.focus();
  }

  window.BingoGate = { blocked: () => !!el };
  try { if (window.MiniHub) MiniHub.onChange(render); } catch (e) { /* 忽略 */ }
  if (document.body) render(); else document.addEventListener("DOMContentLoaded", render);
})();
