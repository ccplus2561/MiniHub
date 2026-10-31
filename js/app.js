(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const games = window.GAMES || [];
  
  const sfx = n => window.MiniHubSfx && MiniHubSfx(n);
  // 遊戲頁（iframe）加上時間參數，避免吃到瀏覽器快取的舊版；外部網址不動
  const bust = p => /^(https?:)?\/\//i.test(p) ? p : p + (p.includes("?") ? "&" : "?") + "t=" + Date.now();
  const splash = $("#splash"), splashHTML = splash ? splash.outerHTML : "";
  let selected = -1;
  let shown = [];
  let category = "全部";
  const CATEGORIES = ["街機", "益智", "動作", "桌遊", "紙牌", "射擊", "音樂"];   // 分類按鈕固定順序
  // 排序：無標籤（可遊玩）→ 開發中 → 即將推出（其餘未開放）；同標籤內依分類順序（街機>益智>動作>桌遊>紙牌>射擊>音樂，其他最後）；再同則維持原本順序
  const rank = g => !g.path ? 2 : (g.badge === "開發中" ? 1 : 0);
  const catRank = g => { const i = CATEGORIES.indexOf(g.category); return i < 0 ? CATEGORIES.length : i; };

  /* ---------- 卡片 ---------- */
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function cardEl(g, idx = 0) {
    const soon = !g.path;
    const badge = g.badge || (soon ? "即將推出" : "");
    const el = document.createElement("button");
    el.className = "card" + (soon ? " soon" : "");
    el.dataset.id = g.id;
    el.style.setProperty("--i", idx);
    el.style.setProperty("--c1", g.colors[0]);
    el.style.setProperty("--c2", g.colors[1]);
    el.innerHTML = `
      <div class="card-art">${g.icon ? `<img class="icon" src="${esc(g.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="emoji">${esc(g.emoji)}</span>`}</div>
      ${badge ? `<span class="badge ${badge === "開發中" ? "dev" : "soon"}">${badge === "開發中" ? "🛠 " : "⏳ "}${esc(badge)}</span>` : ""}
      <div class="card-info">
        <div class="card-name">${esc(g.title)}</div>
        <div class="card-sub">${esc(g.category)}</div>
      </div>`;
    const img = $("img.icon", el);
    if (img) img.addEventListener("error", () => { const s = document.createElement("span"); s.className = "emoji"; s.textContent = g.emoji || "🎮"; img.replaceWith(s); });
    return el;
  }

  /* ---------- 背景交叉淡入 ---------- */
  let bdIdx = 0;
  function setBackdrop(g) {
    const bds = $$("#backdrop .bd");
    bdIdx ^= 1;
    const el = bds[bdIdx];
    el.style.background =
      `radial-gradient(1000px 700px at 75% 25%, ${g.colors[0]}, transparent 70%),` +
      `radial-gradient(900px 700px at 0% 100%, ${g.colors[1]}, transparent 70%)`;
    el.innerHTML = g.icon ? `<img src="${esc(g.icon)}" alt="">` : `<span>${esc(g.emoji)}</span>`;
    bds.forEach((b, i) => b.classList.toggle("on", i === bdIdx));
  }

  function select(i, quiet) {
    const hero = $("#hero");
    if (!shown.length || i < 0) {
      selected = -1; hero.hidden = true;
      $$("#libraryRow .card").forEach(c => c.classList.remove("selected"));
      return;
    }
    selected = (i + shown.length) % shown.length;
    const g = shown[selected];
    setBackdrop(g);
    const cards = $$("#libraryRow .card");
    cards.forEach((c, idx) => c.classList.toggle("selected", idx === selected));
    $("#heroTitle").textContent = g.title;
    $("#heroDesc").textContent = g.desc || g.category;
    $("#heroHow").textContent = g.how || ""; $("#heroHow").hidden = !g.how;
    $("#playBtn span").textContent = g.path ? "開始遊戲" : (g.badge || "即將推出");
    paintTags(g);
    setTagsOpen(false);   // 手機版切換遊戲時預設收合
    hero.hidden = false;
    hero.classList.remove("pop"); void hero.offsetWidth; hero.classList.add("pop");   // 每次選擇都從底部跳出
    cards[selected].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  /* ---------- 遊戲標籤（✔ / ✘） ---------- */
  const TAG_DEFAULT = {};   // 未設定 = 「─」；true = ✔；false = ✘
  const TAG_ROWS = [[["single", "單人模式"], ["multi", "多人連線"]], [["mobile", "支援手機"], ["desktop", "支援電腦"]],
                    [["kbd", "鍵盤快捷"], ["touch", "觸碰滑動"]], [["rank", "排行榜"], ["personal", "個人成績"]]];
  function setTagsOpen(open) {
    const box = $("#gameTags"), btn = $("#tagsToggle");
    box.classList.toggle("open", open);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open);
  }
  $("#tagsToggle").addEventListener("click", () => setTagsOpen(!$("#gameTags").classList.contains("open")));
  function paintTags(g) {
    const t = Object.assign({}, TAG_DEFAULT, g.tags || {});
    $("#gameTags").innerHTML = TAG_ROWS.map(r => r.map(([k, n]) =>
      `<span class="${t[k] === true ? "yes" : t[k] === false ? "no" : "na"}"><i>${t[k] === true ? "✔" : t[k] === false ? "✘" : "─"}</i>${n}</span>`).join("")).join("");
  }

  /* ---------- 遊戲庫 / 分類 ---------- */
  function renderGrid(target, list) {
    target.innerHTML = "";
    list.forEach((g, i) => {
      const el = cardEl(g, i);
      el.addEventListener("click", () => { if (i !== selected) select(i); });   // 只選取，不直接進入遊戲
      target.appendChild(el);
    });
  }

  function renderChips() {
    const cats = ["全部", ...CATEGORIES];
    const box = $("#chips");
    box.innerHTML = "";
    cats.forEach(c => {
      const b = document.createElement("button");
      b.className = "chip" + (c === category ? " active" : "");
      b.textContent = c;
      b.addEventListener("click", () => { category = c; renderChips(); renderLibrary(); });
      box.appendChild(b);
    });
  }

  function renderLibrary() {
    const keep = shown[selected] && shown[selected].id;
    shown = games.filter(g => category === "全部" || g.category === category)
      .map((g, i) => [g, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || catRank(a[0]) - catRank(b[0]) || a[1] - b[1]).map(x => x[0]);
    renderGrid($("#libraryRow"), shown);
    if (!shown.length) $("#libraryRow").innerHTML = '<div class="lib-empty">此分類暫無遊戲，敬請期待！</div>';
    const i = shown.findIndex(g => g.id === keep);
    select(i);   // 原本選的還在清單裡就維持選取，否則收起底部資訊
  }

  /* ---------- 首頁圖卡牆：用遊戲庫全部圖卡排成斜向牆面，各欄上下交錯緩慢漂移 ---------- */
  function renderHome() {
    const wall = $("#homeWall");
    if (!wall) return;
    const list = games.slice();
    const sub = $("#homeSub");
    if (sub) sub.textContent = list.length ? `${list.length} 款遊戲，隨時開玩` : "小遊戲大集合";
    wall.innerHTML = "";
    if (!list.length) return;
    const COLS = 9, PER = Math.max(8, list.length);   // 每欄一組至少 8 張，確保比螢幕高
    for (let c = 0; c < COLS; c++) {
      const col = document.createElement("div");
      col.className = "hw-col";
      col.style.setProperty("--dur", (70 + (c * 37) % 40) + "s");     // 各欄速度略有不同
      col.style.setProperty("--off", "-" + ((c * 17) % 50) + "s");    // 各欄起點錯開
      if (c % 2) col.style.animationDirection = "reverse";             // 奇偶欄方向相反
      const track = document.createElement("div");
      track.className = "hw-track";
      for (let rep = 0; rep < 2; rep++) {                              // 內容複製兩份，捲動 -50% 即可無縫循環
        for (let k = 0; k < PER; k++) {
          const g = list[(k + c * 2) % list.length];
          const el = document.createElement("div");
          el.className = "hw-card" + (g.path ? "" : " soon");
          el.style.setProperty("--c1", g.colors[0]);
          el.style.setProperty("--c2", g.colors[1]);
          el.innerHTML = (g.icon ? `<img src="${esc(g.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="e">${esc(g.emoji || "🎮")}</span>`) +
            `<b>${esc(g.title)}</b>`;
          const im = $("img", el);
          if (im) im.addEventListener("error", () => { const s = document.createElement("span"); s.className = "e"; s.textContent = g.emoji || "🎮"; im.replaceWith(s); });
          track.appendChild(el);
        }
      }
      col.appendChild(track);
      wall.appendChild(col);
    }
  }
  $("#homeGo") && $("#homeGo").addEventListener("click", () => { sfx("confirm"); showView("library"); });

  /* ---------- 頁面切換 ---------- */
  function showView(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
    document.body.dataset.view = name;
    clearK(); paintHints();
  }
  $$(".nav-item").forEach(n => n.addEventListener("click", () => showView(n.dataset.view)));

  /* ---------- 播放層 ---------- */
  const player = $("#player"), frame = $("#frame");
  let current = null;

  let srcEl = null, closing = false;
  // 從卡片位置展開 / 收回的裁切範圍
  function clipFrom(el) {
    const W = innerWidth, H = innerHeight;
    let r = el && el.isConnected ? el.getBoundingClientRect() : null;
    if (!r || !r.width) r = { top: H / 2 - 60, bottom: H / 2 + 60, left: W / 2 - 90, right: W / 2 + 90 };
    return `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round 16px)`;
  }
  const EASE = "cubic-bezier(.2, .8, .2, 1)";

  /* ---------- 未登入：開始 / 繼續遊玩前需同意條款 ---------- */
  let authReady = false, consent = null;
  document.addEventListener("minihub:auth", () => { authReady = true; });
  function askConsent(yes, no) {
    if (consent) return false;                                  // 已在詢問中
    const wasFs = !!document.fullscreenElement;
    if (wasFs) document.exitFullscreen().catch(() => {});       // 全螢幕時視窗會被蓋住，先退出
    consent = { yes, no, wasFs }; cRun(0, 5);
    try { document.activeElement && document.activeElement.blur(); } catch (e) {}   // 把鍵盤焦點從遊戲拿回來
    sfx("open"); openModal("playConsentModal");
    return true;
  }
  function settleConsent(ok) {
    if (!consent) return;
    const c = consent; consent = null; clearInterval(cTick); closeModal("playConsentModal");
    if (ok && c.wasFs && !player.hidden && player.requestFullscreen) player.requestFullscreen().catch(() => {});
    (ok ? c.yes : c.no)();
  }
  // 同意鈕：開啟後等 5 秒才能按 → 按一次變「再次確認」（5 秒內不按就恢復）→ 再按才真正同意
  const cBtn = $("#consentOk"), cLbl = $("span", cBtn);
  let cStage = 0, cTick = null;      // 0 = 等待、1 = 可按、2 = 再次確認
  function cPaint(left) {
    cBtn.disabled = cStage === 0;
    cBtn.classList.toggle("reconfirm", cStage === 2);
    cLbl.textContent = cStage === 0 ? "同意並遊玩（" + left + "）" : cStage === 1 ? "同意並遊玩" : "再次確認（" + left + "）";
  }
  function cRun(stage, secs) {
    clearInterval(cTick); cStage = stage; let left = secs; cPaint(left);
    cTick = setInterval(() => { left--; if (left <= 0) { clearInterval(cTick); cStage = 1; cPaint(0); } else cPaint(left); }, 1000);
  }
  cBtn.addEventListener("click", () => {
    if (cStage === 0) return;
    if (cStage === 1) { sfx("confirm"); cRun(2, 5); return; }
    clearInterval(cTick); sfx("confirm"); settleConsent(true);
  });
  $("#consentNo").addEventListener("click", () => { sfx("close"); settleConsent(false); });
  // 遊戲「下一局」前呼叫：已登入直接 true；未登入需同意，不同意則回首頁並回傳 false
  window.MiniHubRequestNext = () => new Promise(res => {
    if (signedIn) return res(true);
    const asked = askConsent(() => { res(true); try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} }, () => { res(false); closeGame(); });
    if (!asked) res(false);
  });
  // 跨網域的外部遊戲：postMessage({type:"minihub:next"}) → 回覆 {type:"minihub:next-result", ok}
  window.addEventListener("message", e => {
    if (!e.data || e.data.type !== "minihub:next" || !frame.contentWindow || e.source !== frame.contentWindow) return;
    MiniHubRequestNext().then(ok => { try { e.source.postMessage({ type: "minihub:next-result", ok }, "*"); } catch (x) {} });
  });

  function openGame(g, el) {
    if (g.path) {
      if (!authReady) {   // 還在還原登入狀態（firebase.js 是最後才載入的模組，此時 MiniHubAuth 可能還不存在）：等第一次回報再決定
        let done = false; const go = () => { if (done) return; done = true; openGame(g, el); };
        document.addEventListener("minihub:auth", go, { once: true }); setTimeout(() => { authReady = true; go(); }, 5000);
        return;
      }
      if (!signedIn) { askConsent(() => launchGame(g, el), () => {}); return; }   // 不同意：不進入遊戲
    }
    launchGame(g, el);
  }
  // 用 replace 載入遊戲，不在瀏覽紀錄裡多加一筆（否則手機返回鍵會先退回 iframe 的上一頁）
  function setFrame(u) { try { frame.contentWindow.location.replace(u); } catch (e) { frame.src = u; } }
  // 載入遊戲前，先向伺服器確認共用 SDK 是最新版（沒變動只回 304，很輕量；最多等 1.5 秒，連不上就照常載入），
  // 這樣遊戲頁面載入 SDK 時一定拿到最新的，不會吃到瀏覽器的舊快取
  const SDK_URL = "js/minihub-sdk.js";
  const loadGame = g => {
    const fresh = Promise.race([fetch(SDK_URL, { cache: "no-cache" }).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
    fresh.then(() => { if (current === g) setFrame(bust(g.path)); });
  };
  function launchGame(g, el) {
    if (!g.path) { sfx("deny"); return toast("「" + g.title + "」" + (g.badge || "即將推出") + "，敬請期待！"); }
    sfx("open");
    if (window.MiniHubTemp) { MiniHubTemp.music = MiniHubTemp.sfx = true; paintAudio(); }   // 每次開啟遊戲都恢復為設定值
    current = g;
    srcEl = el || $("#libraryRow .card.selected");
    $("#playerTitle").textContent = g.title;
    loadGame(g);
    // 設定 > 顯示 > 遊戲全螢幕：開啟 = 整個畫面都是遊戲；關閉 = 保留左側導覽列（手機版保留上下列）
    const fsOn = !!(window.MiniHubPrefs && MiniHubPrefs().fsStart);
    player.classList.toggle("with-rail", !fsOn);
    player.hidden = false;
    closing = false;
    player.animate(
      [{ clipPath: clipFrom(srcEl), opacity: .3 }, { clipPath: "inset(0 round 0)", opacity: 1 }],
      { duration: 460, easing: EASE });
    history.replaceState(history.state, "", "#play=" + g.id);
    if (fsOn && player.requestFullscreen) player.requestFullscreen().catch(() => {});
    frame.focus();
  }

  function closeGame(cb) {
    if (!current || closing) return;
    closing = true; sfx("close");
    if (document.fullscreenElement) document.exitFullscreen();
    history.replaceState(history.state, "", location.pathname + location.search);
    const done = () => { player.hidden = true; setFrame("about:blank"); current = null; closing = false; if (typeof cb === "function") cb(); };
    const a = player.animate(
      [{ clipPath: "inset(0 round 0)", opacity: 1 }, { clipPath: clipFrom(srcEl), opacity: .3 }],
      { duration: 340, easing: EASE });
    a.onfinish = done;
  }

  // 返回鍵 / Esc：先暫停並詢問是否退出遊戲
  function askExit() {
    if (!current || closing || leaveTo) return;
    pauseGame();
    try { document.activeElement && document.activeElement.blur(); } catch (x) {}
    leaveTo = () => closeGame();
    sfx("open");
    // 全螢幕時只有播放層看得到，需先退出全螢幕才能顯示確認視窗
    if (document.fullscreenElement) { wasFs = true; Promise.resolve(document.exitFullscreen()).catch(() => {}).then(() => openModal("exitModal")); }
    else { wasFs = false; openModal("exitModal"); }
  }
  $("#closeBtn").addEventListener("click", askExit);
  window.MiniHubAskExit = askExit; window.MiniHubIsPlaying = () => !!current && !closing;   // 供 guard.js（返回鍵 / 滑動返回）使用

  /* ---------- 遊戲中點左側導覽（只接受滑鼠 / 觸控）：立即暫停並詢問是否退出 ---------- */
  // 退出時本局不另外計入成績；若已刷新個人最高紀錄，遊戲離開時會直接更新（由遊戲自己處理）
  let leaveTo = null, wasFs = false;
  function pauseGame() {
    try { frame.contentWindow.MiniHubPause && frame.contentWindow.MiniHubPause(); } catch (e) {}
    try { frame.contentWindow.postMessage({ type: "minihub:pause" }, "*"); } catch (e) {}   // 外部遊戲可自行監聽
  }
  function settleLeave(ok) {
    if (!leaveTo) return;
    const go = leaveTo; leaveTo = null; closeModal("exitModal"); if (ok) wasFs = false;
    if (ok) { sfx("confirm"); go(); }
    else { sfx("close"); if (wasFs && player.requestFullscreen) player.requestFullscreen().catch(() => {}); wasFs = false; try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} }
  }
  document.addEventListener("click", e => {
    if (player.hidden || closing || !e.target.closest) return;
    const b = e.target.closest(".rail button");
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.detail === 0 || !touchOn() || leaveTo) return;   // 鍵盤 / 程式觸發一律不處理，避免與遊戲按鍵衝突
    pauseGame();
    try { document.activeElement && document.activeElement.blur(); } catch (x) {}
    leaveTo = b.matches(".nav-item") ? () => { showView(b.dataset.view); closeGame(); } : () => closeGame(() => b.click());
    sfx("open"); openModal("exitModal");
  }, true);
  $("#exitNo").addEventListener("click", () => settleLeave(false));
  $("#exitOk").addEventListener("click", () => settleLeave(true));
  /* 音樂 / 音效：頂端按鈕只暫時開關目前這款遊戲，不改設定頁 */
  const audioBtns = { music: $("#musicBtn"), sfx: $("#sfxBtn") };
  const paintAudio = () => {
    const p = window.MiniHubGamePrefs ? MiniHubGamePrefs() : { music: true, sfx: true };
    Object.keys(audioBtns).forEach(k => {
      const on = !p.mute && p[k];
      audioBtns[k].classList.toggle("off", !on);
      audioBtns[k].setAttribute("aria-pressed", String(!!on));
    });
  };
  Object.keys(audioBtns).forEach(k => audioBtns[k].addEventListener("click", () => {
    if (window.MiniHubTemp) MiniHubTemp[k] = !MiniHubTemp[k];   // 只影響目前遊戲，不改設定
    paintAudio(); sfx(MiniHubTemp[k] ? "on" : "off");
    document.dispatchEvent(new CustomEvent("minihub:prefs"));   // 通知遊戲立即套用
    try { frame.focus(); frame.contentWindow.focus(); } catch (e) {}
  }));
  document.addEventListener("minihub:prefs", paintAudio);
  paintAudio();
  $("#reloadBtn").addEventListener("click", () => { if (current) MiniHubRequestNext().then(ok => { if (ok && current) loadGame(current); }); });
  $("#fsBtn").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else player.requestFullscreen && player.requestFullscreen();
  });

  /* ---------- 遊戲庫：開始遊戲按鈕 ---------- */
  $("#playBtn").addEventListener("click", () => shown[selected] && openGame(shown[selected], $("#libraryRow .card.selected")));

  /* ---------- 鍵盤（需在設定中允許） ---------- */
  // 兩個區域：nav = 最左側分頁；mid = 中間內容。預設在最左側，滑鼠點到哪一區就切到哪一區
  const kbdOn = () => !window.MiniHubPrefs || MiniHubPrefs().kbd;
  const touchOn = () => !window.MiniHubPrefs || MiniHubPrefs().touch;
  let zone = "nav", kEl = null;

  function clearK() { if (kEl) kEl.classList.remove("kfocus"); kEl = null; document.body.classList.remove("login-k", "brand-k"); }
  function setK(el, quiet) {
    clearK(); kEl = el; el.classList.add("kfocus");
    if (!quiet) sfx("move");
    if (el.matches("#libraryRow .card")) {   // 鍵盤移到哪張圖卡，就放大並跳出標題與按鈕
      const i = Array.prototype.indexOf.call(el.parentNode.children, el);
      if (i !== selected) select(i);
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (!quiet && el.classList.contains("set-item") && !el.classList.contains("active")) el.click();   // 設定左側分類：移到哪就顯示哪一頁
  }
  function midItems() {
    const v = document.body.dataset.view, P = ".pane.active ";
    let list = [];
    if (v === "library") list = $$("#chips .chip, #libraryRow .card, #playBtn");
    else if (v === "about") list = $$("#view-about .legal-tab");
    else if (v === "settings") list = $$(".set-item, " + P + ".switch, " + P + ".seg button, " + P + ".radio-card, " + P + ".row-btn, " + P + ".btn-primary");
    return list.filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
  }
  function move(dir) {
    const items = midItems();
    if (!items.length) return false;
    if (!kEl || !items.includes(kEl)) { setK(items[0]); return true; }
    const ctr = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const c = ctr(kEl);
    let best = null, bs = Infinity;
    for (const el of items) {
      if (el === kEl) continue;
      const p = ctr(el), dx = p.x - c.x, dy = p.y - c.y;
      const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
      const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
      if (along < 8) continue;
      const sc = along + across * 2.5;
      if (sc < bs) { bs = sc; best = el; }
    }
    if (best) setK(best);
    return !!best;
  }
  function activate() {
    if (!kEl || !kEl.isConnected) return;
    if (kEl.matches("#libraryRow .card")) {   // 已選到圖卡：Enter 跳到「開始遊戲」按鈕，再按一次才進入
      const b = $("#playBtn");
      if (!$("#hero").hidden && b.offsetParent) { sfx("confirm"); setK(b, true); }
      return;
    }
    const txt = kEl.classList.contains("chip") ? kEl.textContent : null;
    if (!kEl.matches(".switch, .seg button")) sfx("confirm");   // 開關 / 分段選項的聲音由設定頁自己處理
    kEl.click();
    if (txt) { const n = $$("#chips .chip").find(c => c.textContent === txt); if (n) setK(n, true); }   // 分類按鈕會重繪
  }
  function setZone(z, byKey) {
    zone = z; document.body.dataset.zone = z; clearK();
    if (byKey) sfx(z === "mid" ? "confirm" : "back");
    if (z === "mid" && byKey && document.body.dataset.view !== "home") {
      const items = midItems();
      const first = document.body.dataset.view === "settings" ? $(".set-item.active") : items[0];
      if (first) setK(first, true);
    }
    paintHints();
  }

  // 右下角提示：依目前區域顯示「現在能按的鍵」
  function paintHints() {
    const K = (...a) => a.map(x => `<kbd>${x}</kbd>`).join("");
    const home = false;
    const onLogin = document.body.classList.contains("login-k");
    const onBrand = document.body.classList.contains("brand-k");
    const list = zone === "nav" && onBrand
      ? [[K("↑", "↓"), "切換"], [K("Enter"), "公告"]]
      : zone === "nav" && onLogin
      ? [[K("↑", "↓"), "切換"], [K("Enter"), signedIn ? "登出" : "登入"]]
      : zone === "nav"
      ? [[K("↑", "↓"), "切換分頁"], [K("Enter", "D", "→"), "進入"]]
      : home
        ? [[K("←", "→"), "選擇"], [K("Enter"), "開始"], [K("Esc", "A"), "返回分頁"]]
        : [[K("↑", "↓", "←", "→"), "移動"], [K("Enter"), "確認"], [K("Esc", "A"), "返回分頁"]];
    $(".hints").innerHTML = list.map(([k, t]) => `<span>${k} ${t}</span>`).join("");
  }

  function stepTab(d) {
    const tabs = $$(".nav-item");
    const cur = tabs.findIndex(n => n.classList.contains("active"));
    sfx("move");
    showView(tabs[(cur + d + tabs.length) % tabs.length].dataset.view);
  }
  const DIRS = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
  document.addEventListener("keydown", e => {
    if (!$("#playConsentModal").hidden) {      // 同意視窗：Esc = 不同意；方向鍵在兩個按鈕間移動
      if (e.key === "Escape") { settleConsent(false); e.preventDefault(); }
      else if (kbdOn() && /^(Arrow(Up|Down|Left|Right)|[wasd])$/i.test(e.key)) {
        const b = [$("#consentNo"), $("#consentOk")]; b[b.indexOf(document.activeElement) === 1 ? 0 : 1].focus(); e.preventDefault();
      }
      return;
    }
    if (!$("#exitModal").hidden) {            // 退出確認：Esc = 繼續遊戲；方向鍵在兩個按鈕間移動
      if (e.key === "Escape") { settleLeave(false); e.preventDefault(); }
      else if (kbdOn() && /^(Arrow(Up|Down|Left|Right)|[wasd])$/i.test(e.key)) {
        const b = [$("#exitNo"), $("#exitOk")]; b[b.indexOf(document.activeElement) === 1 ? 0 : 1].focus(); e.preventDefault();
      }
      return;
    }
    if (!$("#profileModal").hidden) return;   // 建立資料視窗不可用 Esc 關閉
    if (!$("#nameModal").hidden) { if (e.key === "Escape") closeModal("nameModal"); return; }
    if (!$("#logoutModal").hidden) { if (e.key === "Escape") closeModal("logoutModal"); return; }
    if (!$("#deleteModal").hidden) { if (e.key === "Escape" && !deleting) closeModal("deleteModal"); return; }
    if (!$("#termsModal").hidden) { if (e.key === "Escape") closeModal("termsModal"); return; }
    if (!$("#noticeModal").hidden) { if (e.key === "Escape" || e.key === "Enter") { closeModal("noticeModal"); e.preventDefault(); } return; }
    if (!$("#linkModal").hidden) { if (e.key === "Escape") closeModal("linkModal"); return; }
    if (!$("#loginModal").hidden) {
      if (e.key === "Escape") closeModal("loginModal");
      else if (kbdOn() && /^t$/i.test(e.key)) { $(".legal-link", $("#loginModal")).focus(); e.preventDefault(); }   // T：直接跳到服務條款（Enter 開啟）
      else if (kbdOn() && /^(ArrowUp|ArrowDown|w|s)$/i.test(e.key)) {   // ↑↓ 在「登入方式 / 取消」之間移動焦點（關閉快捷鍵時停用）
        const b = $$(".btn-google, .btn-ghost, .legal-link", $("#loginModal"));
        const up = /^(ArrowUp|w)$/i.test(e.key), i = b.indexOf(document.activeElement);
        b[(i + (up ? -1 : 1) + b.length) % b.length].focus(); e.preventDefault();
      }
      return;
    }
    if (!player.hidden) { if (e.key === "Escape") askExit(); return; }
    if (!kbdOn() || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = DIRS[k], enter = k === "Enter", esc = k === "Escape";
    if (!dir && !enter && !esc) return;
    e.preventDefault();
    document.body.classList.add("kb");

    if (zone === "nav") {                       // 最左側：上下換分頁（最後一個分頁再往下 / 第一個再往上 = 登入、登出按鈕），Enter / D / → 進入中間
      const tabs = $$(".nav-item"), login = $("#loginBtn"), brand = $("#brandBtn");
      const cur = tabs.findIndex(n => n.classList.contains("active"));
      // 左側導覽順序：MiniHub（公告）→ 各分頁 → 登入 / 登出，上下循環
      const focusSpecial = el => { sfx("move"); clearK(); kEl = el; el.classList.add("kfocus"); document.body.classList.add(el === login ? "login-k" : "brand-k"); paintHints(); };
      if (kEl === login || kEl === brand) {     // 目前停在 MiniHub 或登入 / 登出按鈕
        const isBrand = kEl === brand;
        if (dir === "up" || dir === "down") {
          if (isBrand) { if (dir === "up") focusSpecial(login); else { sfx("move"); clearK(); showView(tabs[0].dataset.view); paintHints(); } }
          else if (dir === "up") { sfx("move"); clearK(); showView(tabs[tabs.length - 1].dataset.view); paintHints(); }
          else focusSpecial(brand);
        }
        else if (enter) { sfx("confirm"); kEl.click(); }   // MiniHub = 跳出公告視窗
        else if (esc) { clearK(); paintHints(); }
        return;
      }
      if (dir === "down" && cur === tabs.length - 1) focusSpecial(login);
      else if (dir === "up" && cur === 0) focusSpecial(brand);
      else if (dir === "up") stepTab(-1);
      else if (dir === "down") stepTab(1);
      else if (dir === "right" || enter) setZone("mid", true);
      return;
    }
    if (esc) return setZone("nav", true);             // 中間：Esc 回最左側
    if (document.body.dataset.view === "home") { if (dir === "left") setZone("nav", true); else if (enter) $("#homeGo").click(); return; }   // 首頁：Enter 進入遊戲庫
    if (dir) {
      if (!move(dir)) {
        if (dir === "left") setZone("nav", true);
        else if (document.body.dataset.view === "about" && (dir === "up" || dir === "down")) {   // 條款內容：↑↓ 捲動
          const d = $(".legal-doc:not([hidden])"); if (d) d.scrollBy({ top: dir === "up" ? -140 : 140, behavior: "smooth" });
        }
      }
    }   // 已在最左邊再按 ← / A → 回最左側
    else if (enter) activate();
  });

  // 滑鼠 / 觸控點按鈕的提示音（已被封鎖的點擊不會走到這裡；若同一下已有專屬音效就不重複）
  document.addEventListener("click", e => {
    if (e.detail === 0 || !e.target.closest) return;
    const b = e.target.closest("button");
    if (b && !b.disabled && !b.matches(".switch, .seg button") && !(window.MiniHubSfx && MiniHubSfx.recent())) sfx("click");
  });

  /* ---------- 滑鼠 / 觸控：點到哪一區，快捷鍵就跟著切到哪一區 ---------- */
  document.addEventListener("pointerdown", e => {
    document.body.classList.remove("kb");
    if (!touchOn() || !e.target.closest) return;
    if (e.target.closest(".rail")) setZone("nav");
    else if (e.target.closest(".main")) {
      setZone("mid");
      const hit = midItems().find(i => i.contains(e.target));
      if (hit) setK(hit, true);
    }
  }, true);

  // 設定 > 操作 > 允許觸控滑動 關閉：滑鼠與觸控的點擊全部失效（鍵盤、程式觸發的 click detail 為 0，不受影響）
  // 例外：「鍵盤快捷鍵 / 觸控滑動」兩個開關本身仍可點，避免整個鎖死
  document.addEventListener("click", blockPointer, true);
  document.addEventListener("dblclick", blockPointer, true);
  document.addEventListener("auxclick", blockPointer, true);
  function blockPointer(e) {
    if (touchOn() || e.detail === 0) return;
    if (e.target.closest && e.target.closest('.switch[data-set="touch"], .switch[data-set="kbd"]')) return;
    e.stopPropagation(); e.preventDefault();
  }

  /* ---------- 法律條款頁（服務條款 / 隱私權政策 / 使用規定） ---------- */
  // 條款內容直接放在「關於」頁，上方三個按鈕切換（預設：服務條款）
  function legalTab(tab) {
    $$(".legal-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".legal-doc").forEach(d => { d.hidden = d.dataset.doc !== tab; d.scrollTop = 0; });
  }
  function showLegal(tab) {
    if (consent) settleConsent(false);   // 看條款 = 先不遊玩（下一局的情況會回首頁）
    ["loginModal", "termsModal", "logoutModal", "nameModal", "linkModal", "noticeModal", "deleteModal"].forEach(closeModal);   // 建立資料視窗必須完成，不在此關閉
    legalTab(tab);
    showView("about");
  }
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("[data-legal]");
    if (!a) return;
    e.preventDefault(); sfx("confirm"); showLegal(a.dataset.legal);
  });
  $$(".legal-tab").forEach(b => b.addEventListener("click", () => legalTab(b.dataset.tab)));

  /* ---------- Toast ---------- */
  let timer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  window.MiniHubToast = toast;

  /* ---------- 登入（Google / GitHub） ---------- */
  function openModal(id) {
    const m = $("#" + id); m.hidden = false;
    const f = $("[data-autofocus]", m);
    if (f) setTimeout(() => f.focus(), 60);   // 讓鍵盤 / 手把可直接按 Enter
  }
  function closeModal(id) { $("#" + id).hidden = true; }
  let signedIn = false;
  $("#loginBtn").addEventListener("click", () => {
    if (!signedIn) { if (window.MiniHubAuth) MiniHubAuth.preload(); return openModal("loginModal"); }   // 按登入才開始載入 Firebase
    openModal("logoutModal");
  });
  /* ---------- 刪除帳號（設定 > 隱私） ---------- */
  let deleting = false;
  const delOk = $("#delOk"), delInput = $("#delInput");
  $("#delAccBtn").addEventListener("click", () => {
    delInput.value = ""; delOk.disabled = true;
    openModal("deleteModal");
    setTimeout(() => delInput.focus(), 60);
  });
  delInput.addEventListener("input", () => { delOk.disabled = deleting || delInput.value.trim() !== "刪除"; });
  delInput.addEventListener("keydown", e => { if (e.key === "Enter" && !delOk.disabled) delOk.click(); });
  delOk.addEventListener("click", async () => {
    if (delOk.disabled || deleting || !window.MiniHubAuth) return;
    deleting = true; delOk.disabled = true; $("span", delOk).textContent = "刪除中…";
    try {
      await MiniHubAuth.deleteAccount();
      closeModal("deleteModal");
      toast("帳號已刪除，所有資料已清空");
    } catch (e) {
      const c = e.code || "";
      if (/popup-closed|cancelled-popup|popup-blocked/.test(c)) toast("未完成身分驗證，帳號沒有被刪除");
      else if (c === "permission-denied") toast("伺服器規則不允許刪除，帳號沒有被刪除");
      else if (c === "account-delete-failed") toast("玩家資料已清除，但登入帳號尚未刪除，請再按一次「永久刪除」");
      else toast("刪除失敗：" + (c || e.message));
    }
    deleting = false; $("span", delOk).textContent = "永久刪除";
    delOk.disabled = delInput.value.trim() !== "刪除";
  });

  /* ---------- 登出：顯示「登出中...」載入畫面，徹底清除網站上的登入與本機資料後重新載入 ---------- */
  let bye = false;
  ["keydown", "keyup"].forEach(t => window.addEventListener(t, e => { if (bye) { e.preventDefault(); e.stopImmediatePropagation(); } }, true));
  async function wipeSiteData() {
    const wait = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]);
    try { sessionStorage.clear(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    try {   // Cookie：各種路徑 / 網域組合都清
      const paths = ["/"]; let acc = "";
      location.pathname.split("/").filter(Boolean).forEach(x => { acc += "/" + x; paths.push(acc); });
      const hs = location.hostname.split("."), doms = [null];
      for (let i = 0; i < hs.length - 1; i++) doms.push("." + hs.slice(i).join("."));
      document.cookie.split(";").forEach(c => {
        const n = c.split("=")[0].trim(); if (!n) return;
        paths.forEach(pa => doms.forEach(d => { document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=" + pa + (d ? "; domain=" + d : ""); }));
      });
    } catch (e) {}
    const jobs = [];
    try {   // IndexedDB（Firebase 登入 / 安裝資料）
      let names = ["firebaseLocalStorageDb", "firebase-heartbeat-database", "firebase-installations-database"];
      if (indexedDB.databases) { try { names = names.concat((await indexedDB.databases()).map(d => d.name)); } catch (e) {} }
      [...new Set(names.filter(Boolean))].forEach(n => jobs.push(wait(new Promise(r => {
        const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r();   // 被占用時，重新載入後會自動完成刪除
      }), 1500)));
    } catch (e) {}
    try { if (window.caches) jobs.push(wait(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))), 1500)); } catch (e) {}
    try { if (navigator.serviceWorker) jobs.push(wait(navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))), 1500)); } catch (e) {}
    await Promise.all(jobs);
  }
  function showBye() {
    document.body.classList.add("bye");
    const t = document.createElement("template");
    t.innerHTML = splashHTML || '<div class="splash" role="status"><b class="splash-name">MiniHub</b><span class="splash-text">載入中<i>.</i><i>.</i><i>.</i></span><div class="splash-spin"></div></div>';
    const el = t.content.firstElementChild, tx = el.querySelector(".splash-text");
    el.removeAttribute("id"); el.classList.remove("out");
    if (tx && tx.firstChild) tx.firstChild.nodeValue = "登出中";
    document.body.appendChild(el);
  }
  $("#logoutOk").addEventListener("click", async () => {
    if (bye) return; bye = true;
    closeModal("logoutModal");
    showBye();
    const t0 = Date.now(), lim = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]);
    if (window.MiniHubFlushPrefs) await lim(MiniHubFlushPrefs(), 2500);   // 登出前先把還沒送出的設定存起來
    if (window.MiniHubAuth) await lim(MiniHubAuth.signOut(), 2500);
    await wipeSiteData();
    await new Promise(r => setTimeout(r, Math.max(0, 900 - (Date.now() - t0))));
    try { sessionStorage.setItem("mh_bye", "1"); } catch (e) {}      // 重新載入後的載入畫面延續顯示「登出中...」
    location.replace(location.pathname);                              // 重新載入（同時清掉網址上的參數 / 記憶體中的狀態）
  });
  const PNAME = { google: "Google", github: "GitHub" };
  let chosen = "google";
  $$("#loginModal [data-provider]").forEach(b => b.addEventListener("click", () => { chosen = b.dataset.provider; openModal("termsModal"); }));   // 先確認條款
  $("#termsCancel").addEventListener("click", () => closeModal("termsModal"));
  function signInFail(e) {
    const c = e.code || "";
    if (c === "sdk-load-failed") toast("無法載入登入服務，請檢查網路後再試");
    else if (c === "needs-link") {
      const bad = e.provider;
      $("#linkText").textContent = (e.email ? e.email + " " : "此電子郵件") + "已經用其他方式註冊過。請先用原本的登入方式登入，系統會自動把 " + (PNAME[bad] || "新的方式") + " 連結到同一個帳號。";
      $$("#linkModal [data-link]").forEach(b => b.hidden = b.dataset.link === bad);   // 不列出剛剛失敗的那一種
      openModal("linkModal");
    }
    else if (c === "auth/popup-blocked") toast("登入視窗被瀏覽器擋住，請允許彈出視窗後再試");
    else if (c === "auth/operation-not-allowed") toast("此登入方式尚未在 Firebase 後台啟用（Authentication > Sign-in method）");
    else if (c === "auth/unauthorized-domain") toast("此網域未加入 Firebase 授權網域（Authentication > Settings）");
    else if (c === "auth/network-request-failed") toast("網路連線失敗，請稍後再試");
    else if (c === "auth/web-storage-unsupported") toast("瀏覽器封鎖了儲存空間，請關閉無痕 / 阻擋第三方 Cookie 後再試");
    else if (c === "auth/internal-error" || c === "auth/invalid-credential") toast("登入設定有誤（" + c + "），請檢查 Firebase 後台的供應商設定");
    else if (c === "auth/account-exists-with-different-credential") toast("此電子郵件已用其他方式註冊，請改用原本的登入方式");
    else if (!/popup-closed|cancelled-popup/.test(c)) toast("登入失敗：" + (c || e.message));
  }
  $("#termsOk").addEventListener("click", () => {
    closeModal("termsModal"); closeModal("loginModal");
    if (!window.MiniHubAuth) return toast("登入服務載入失敗，請檢查網路後重新整理");
    MiniHubAuth.signIn(chosen).catch(signInFail);
  });
  // 連結：用原本的方式登入，成功後把剛才的新方式連到同一個帳號
  $$("#linkModal [data-link]").forEach(b => b.addEventListener("click", () => {
    closeModal("linkModal");
    MiniHubAuth.linkPending(b.dataset.link)
      .then(label => toast("已連結 " + label + "，之後兩種方式都能登入"))
      .catch(e => {
        if (e.code === "link-email-mismatch") toast("登入的帳號與原本註冊的電子郵件不同，無法連結");
        else signInFail(e);
      });
  }));
  $("#linkModal").addEventListener("click", e => { if (e.target.id === "linkModal" || e.target.closest("[data-close]")) MiniHubAuth.clearPending(); });

  /* ---------- 首次登入：建立使用者名稱 / 遊戲 UID ---------- */
  const NAME_MIN = 2, NAME_MAX = 12;
  const NAME_RE = /^[\u4e00-\u9fffA-Za-z0-9_]+$/;
  const BANNED = ["官方", "管理員", "客服", "admin", "gm", "minihub", "system"];
  const genUid = () => String(Math.floor(1e8 + Math.random() * 9e8));   // 9 位、首位不為 0
  let pEmail = "", picking = false;
  // 產生 UID 並先向資料庫確認沒人用（最多重試 5 次）
  async function pickUid() {
    picking = true; updateProf(); $("#profUid").textContent = "產生中…";
    let uid = genUid();
    const free = u => Promise.race([MiniHubAuth.isUidFree(u), new Promise(r => setTimeout(() => r(true), 6000))]);   // 逾時就略過檢查（建立時交易仍會確認唯一）
    try { for (let i = 0; i < 5 && !(await free(uid)); i++) uid = genUid(); } catch (e) {}
    $("#profUid").textContent = uid; picking = false; validateName();
  }
  function checkName(v) {
    const n = Array.from(v).length;
    if (!n) return "";
    if (v !== v.trim() || /\s/.test(v)) return "不可包含空白";
    if (n < NAME_MIN) return "至少 " + NAME_MIN + " 個字";
    if (n > NAME_MAX) return "最多 " + NAME_MAX + " 個字";
    if (!NAME_RE.test(v)) return "只能使用中文、英文、數字、底線";
    if (BANNED.some(w => v.toLowerCase().includes(w))) return "名稱含有保留字，請換一個";
    return "ok";
  }
  /* 手機版：分 3 步（名稱 → UID → 隱私）；電腦版維持單頁 */
  let pStep = 1;
  const isMob = () => document.body.classList.contains("m");
  function showErr(msg) { const el = $("#profErr"); el.hidden = !msg; el.textContent = msg || ""; }
  function updateProf() {
    const m = isMob(), last = pStep === 3, ok = checkName($("#profName").value) === "ok";
    $$("#profileModal .pstep").forEach(x => x.classList.toggle("on", Number(x.dataset.step) === pStep));
    $$("#profDots i").forEach((d, i) => d.classList.toggle("on", i === pStep - 1));
    $("#profCancel").hidden = m && pStep > 1;
    $("#profBack").hidden = !m || pStep === 1;
    $("#profNext").hidden = !m || last;
    $("#profOk").hidden = m && !last;
    $("#profNext").disabled = pStep === 1 ? !ok : picking;
    $("#profOk").disabled = !ok || picking;
  }
  function goStep(n) { pStep = Math.max(1, Math.min(3, n)); showErr(""); updateProf(); if (pStep === 1) setTimeout(() => $("#profName").focus(), 60); }
  $("#profNext").addEventListener("click", () => { if (!$("#profNext").disabled) { sfx("move"); goStep(pStep + 1); } });
  $("#profBack").addEventListener("click", () => { sfx("move"); goStep(pStep - 1); });
  $("#profName").addEventListener("keydown", e => { if (e.key === "Enter" && isMob() && !$("#profNext").hidden && !$("#profNext").disabled) { e.preventDefault(); $("#profNext").click(); } });
  window.addEventListener("resize", () => { if (!$("#profileModal").hidden) updateProf(); });
  function startProfile(email) {
    pEmail = email; pStep = 1; showErr("");
    $("#profEmail").textContent = email;
    $("#profName").value = "";
    $("#profPublic").setAttribute("aria-checked", "true");   // 預設開啟
    $("#profJoin").setAttribute("aria-checked", "true");
    validateName();
    pickUid();
    openModal("profileModal");
    setTimeout(() => $("#profName").focus(), 60);
  }
  function validateName() {
    const v = $("#profName").value, r = checkName(v), hint = $("#profHint");
    $("#profCount").textContent = Array.from(v).length + "/" + NAME_MAX;
    hint.classList.toggle("bad", r && r !== "ok");
    hint.classList.toggle("good", r === "ok");
    hint.textContent = !r ? "可使用中文、英文、數字、底線 _" : r === "ok" ? "名稱可以使用" : r;
    updateProf();
  }
  $("#profName").addEventListener("input", validateName);
  ["#profPublic", "#profJoin"].forEach(id => $(id).addEventListener("click", e => {
    const b = e.currentTarget, on = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", on); sfx(on ? "on" : "off");
  }));
  $("#profReroll").addEventListener("click", () => { if (!picking) pickUid(); });
  $("#profOk").addEventListener("click", async () => {
    const btn = $("#profOk");
    if (btn.disabled) return;
    btn.disabled = true; $("span", btn).textContent = "建立中…"; showErr("");
    try {
      const p = await Promise.race([MiniHubAuth.createProfile({ name: $("#profName").value, gameUid: $("#profUid").textContent, publicName: $("#profPublic").getAttribute("aria-checked") === "true", joinRank: $("#profJoin").getAttribute("aria-checked") === "true", prefs: window.MiniHubSyncedPrefs && MiniHubSyncedPrefs() }),
        new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), 20000))]);
      closeModal("profileModal");
      setAccount(p);
      toast("歡迎，" + p.name + "！");
    } catch (e) {
      console.error("createProfile failed", e);
      if (e.code === "uid-taken") { pickUid(); showErr("UID 已被使用，已換一組新的，請再按一次"); }
      else if (e.code === "already-has-profile") { closeModal("profileModal"); toast("此帳號已有玩家資料"); MiniHubAuth.loadProfile().then(setAccount); }
      else if (e.code === "permission-denied") showErr("伺服器拒絕建立資料（permission-denied）。請檢查 Firestore 規則是否允許 users/{uid} 與 uids/{gameUid} 的建立。");
      else if (e.code === "timeout" || e.code === "unavailable") showErr("連線逾時，請檢查網路後再按一次「建立並進入」。");
      else if (e.code === "not-signed-in") showErr("登入狀態已失效，請取消後重新登入。");
      else showErr("建立失敗：" + (e.code || e.message));
    }
    $("span", btn).textContent = "建立並進入";
    validateName();
  });
  $("#profCancel").addEventListener("click", () => {
    closeModal("profileModal");
    if (window.MiniHubAuth) MiniHubAuth.signOut();   // 未完成建立就取消 → 同時登出
  });

  function setAccount(p) {
    window.MiniHubAccount = p
      ? { name: p.name, uid: p.gameUid || p.uid, email: p.email, createdAt: p.createdAt || null, nameChangedAt: p.nameChangedAt || null, lastLoginAt: p.prevLoginAt || null, publicName: typeof p.publicName === "boolean" ? p.publicName : null, joinRank: typeof p.joinRank === "boolean" ? p.joinRank : null, prefs: p.prefs || null }
      : { name: "", uid: "", email: "", createdAt: null, nameChangedAt: null, lastLoginAt: null, publicName: null, joinRank: null, prefs: null };
    document.dispatchEvent(new CustomEvent("minihub:account"));
  }
  let photo = "";
  function paintLogin() {
    const btn = $("#loginBtn"), img = $("#loginAvatar");
    const name = (window.MiniHubAccount && MiniHubAccount.name) || "";
    $("span", btn).textContent = signedIn ? "登出" : "登入";
    btn.setAttribute("aria-label", signedIn ? "帳號（點擊登出）" : "登入");
    const show = signedIn && photo;
    if (show && img.getAttribute("src") !== photo) img.src = photo;
    btn.classList.toggle("has-avatar", !!show);
    btn.classList.toggle("signed", signedIn);
  }
  $("#loginAvatar").addEventListener("error", () => $("#loginBtn").classList.remove("has-avatar"));   // 載入失敗 → 退回預設圖示

  /* ---------- Firebase 登入狀態 ---------- */
  document.addEventListener("minihub:auth", e => {
    const { user, profile, error } = e.detail;
    photo = (user && user.photoURL) || "";
    if (error) { toast("讀取資料失敗：" + (error.code || error.message)); MiniHubAuth.signOut(); return; }
    if (!user) {                       // 已登出
      const wasIn = signedIn;
      signedIn = false; setAccount(null); paintLogin();
      ["profileModal", "logoutModal", "nameModal", "linkModal", "deleteModal"].forEach(closeModal);
      if (wasIn) toast("已登出");
      return;
    }
    if (profile) {                     // 老玩家
      const first = !signedIn;
      signedIn = true; setAccount(profile); paintLogin(); closeModal("profileModal");
      if (first) toast("歡迎回來，" + profile.name + "！");
    } else {                           // 首次登入
      signedIn = true; paintLogin(); closeModal("noticeModal");
      startProfile(user.email);
    }
  });
  /* ---------- 修改使用者名稱（14 天一次；正式限制由 Firestore 規則強制） ---------- */
  const LOCK_MS = 14 * 864e5;
  function nameCheckEdit() {
    const v = $("#nameNew").value, r = checkName(v), hint = $("#nameHint");
    $("#nameCount").textContent = Array.from(v).length + "/" + NAME_MAX;
    const same = r === "ok" && v === MiniHubAccount.name;
    hint.classList.toggle("bad", (r && r !== "ok") || same);
    hint.classList.toggle("good", r === "ok" && !same);
    hint.textContent = !r ? "可使用中文、英文、數字、底線 _" : same ? "與目前名稱相同" : r === "ok" ? "名稱可以使用" : r;
    $("#nameOk").disabled = r !== "ok" || same;
  }
  $("#editNameBtn").addEventListener("click", () => {
    const a = MiniHubAccount;
    if (a.nameChangedAt && a.nameChangedAt + LOCK_MS > Date.now()) return;
    $("#nameCur").textContent = a.name;
    $("#nameNew").value = "";
    nameCheckEdit();
    openModal("nameModal");
    setTimeout(() => $("#nameNew").focus(), 60);
  });
  $("#nameNew").addEventListener("input", nameCheckEdit);
  $("#nameOk").addEventListener("click", async () => {
    const btn = $("#nameOk");
    if (btn.disabled) return;
    btn.disabled = true; $("span", btn).textContent = "變更中…";
    try {
      const p = await MiniHubAuth.updateName($("#nameNew").value, { ...MiniHubAccount, gameUid: MiniHubAccount.uid });
      closeModal("nameModal"); setAccount(p); paintLogin();
      toast("使用者名稱已變更");
    } catch (err) {
      toast(err.code === "permission-denied" ? "目前無法變更使用者名稱（14 天內僅限一次）" : "變更失敗：" + (err.code || err.message));
    }
    $("span", btn).textContent = "確認變更";
    nameCheckEdit();
  });

  $$(".modal").forEach(m => m.addEventListener("click", e => {
    if (m.hasAttribute("data-lock") || (m.id === "deleteModal" && deleting)) return;
    if (e.target === m || e.target.closest("[data-close]")) closeModal(m.id);
  }));

  /* ---------- 滑鼠光影：全域光暈 + 按鈕 / 卡片聚光 ---------- */
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  $("#backdrop").after(glow);
  const SPOT = ".card, .set-item, .radio-card, .chip, .btn-icon, .btn-ghost, .btn-google, .btn-primary, .nav-item, .login-btn, .row-btn, .info-card";
  let raf = 0, mx = 0, my = 0, target = null;
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX; my = e.clientY; target = e.target.closest ? e.target.closest(SPOT) : null;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      glow.style.setProperty("--mx", mx + "px");
      glow.style.setProperty("--my", my + "px");
      if (target) {
        const r = target.getBoundingClientRect();
        // 卡片被放大時，座標以元素實際大小換算
        target.style.setProperty("--px", (mx - r.left) + "px");
        target.style.setProperty("--py", (my - r.top) + "px");
      }
    });
  }, { passive: true });
  document.addEventListener("pointerleave", () => glow.style.setProperty("--mx", "-999px"));

  /* ---------- 載入畫面（遠端資料抓完才收起；最多等 3 秒） ---------- */
  const splashT0 = Date.now();
  let splashDone = false;
  window.MiniHubSplashHide = quick => {
    if (splashDone || !splash) return;
    splashDone = true;
    setTimeout(() => { splash.classList.add("out"); setTimeout(() => splash.remove(), 600); }, Math.max(0, (quick ? 350 : 800) - (Date.now() - splashT0)));
  };
  setTimeout(() => window.MiniHubSplashHide(), 3000);

  /* ---------- 初始化 ---------- */
  document.body.dataset.view = "home";
  document.body.dataset.zone = "nav";
  paintHints();
  renderChips();
  renderLibrary();
  renderHome();

  /* ---------- 遠端內容（公告 / 開發中遊戲，由 js/remote.js 呼叫） ---------- */
  window.MiniHubAddGames = list => {
    const have = new Set(games.map(g => g.id));
    const add = list.filter(g => !have.has(g.id));
    if (!add.length) return;
    games.push(...add);
    renderChips(); renderLibrary(); renderHome();
    const m2 = location.hash.match(/play=([\w-]+)/);   // 分享連結指向外部遊戲
    if (m2 && player.hidden) { const g = add.find(x => x.id === m2[1]); if (g) openGame(g); }
  };
  // 取代所有外部（試算表）遊戲：新增、更新、下架都會反映；目前選取的遊戲仍在就維持選取
  window.MiniHubSetExternalGames = list => {
    for (let i = games.length - 1; i >= 0; i--) if (String(games[i].id).startsWith("ext-")) games.splice(i, 1);
    games.push(...list);
    renderChips(); renderLibrary(); renderHome();
    const m2 = location.hash.match(/play=([\w-]+)/);   // 分享連結指向外部遊戲
    if (m2 && player.hidden) { const g = list.find(x => x.id === m2[1]); if (g) openGame(g); }
  };
  let notices = [];
  const ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.1"/></svg>';
  const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function renderNotices() {
    const box = $("#noticeList"); box.innerHTML = "";
    $("#annMeta").textContent = "共 " + notices.length + " 則公告";
    const fresh = d => { const t = Date.parse(d); return t && Date.now() - t < 7 * 864e5; };   // 7 天內顯示「新」
    notices.forEach((n, i) => {
      const it = document.createElement("article"); it.className = "ann" + (n.hot ? " hot" : ""); it.style.setProperty("--i", i);
      const meta = document.createElement("div"); meta.className = "ann-meta";
      if (n.hot) { const t = document.createElement("span"); t.className = "ann-tag hot"; t.innerHTML = ICON_WARN + "重要"; meta.appendChild(t); }
      if (fresh(n.date)) { const t = document.createElement("span"); t.className = "ann-tag new"; t.textContent = "新"; meta.appendChild(t); }
      if (n.date) { const d = document.createElement("span"); d.className = "ann-date"; d.textContent = n.date; meta.appendChild(d); }
      if (n.link) { const a = document.createElement("a"); a.className = "ann-link"; a.href = n.link; a.target = "_blank"; a.rel = "noopener noreferrer"; a.innerHTML = "<span>了解更多</span>" + ICON_ARROW; meta.appendChild(a); }   // 連結按鈕放在標籤列最右側
      it.appendChild(meta);
      const h = document.createElement("h4"); h.textContent = n.title; it.appendChild(h);
      if (n.body) { const p = document.createElement("p"); p.textContent = n.body; it.appendChild(p); }
      box.appendChild(it);
    });
    box.scrollTop = 0;
  }
  window.MiniHubSetNotices = (list, autoOpen) => {
    notices = list || [];
    if (!notices.length) return;
    renderNotices();
    // 進站時自動彈出一次（其他視窗、遊戲、建立資料視窗開著時不打擾）
    if (autoOpen && player.hidden && !$$(".modal:not([hidden])").length) { sfx("open"); openModal("noticeModal"); }
  };
  $("#brandBtn").addEventListener("click", () => {
    if (!notices.length) return toast("目前沒有公告");
    sfx("open"); openModal("noticeModal");
  });

  // 分享連結：index.html#play=snake
  const m = location.hash.match(/play=([\w-]+)/);
  if (m) { const g = games.find(x => x.id === m[1]); if (g) openGame(g); }
})();
