(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const games = window.GAMES || [];
  const featured = games.filter(g => g.featured);

  const sfx = n => window.MiniHubSfx && MiniHubSfx(n);
  let selected = 0;
  let category = "全部";

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
      ${badge ? `<span class="badge">${esc(badge)}</span>` : ""}
      <div class="card-info">
        <div class="card-name">${esc(g.title)}</div>
        <div class="card-sub">${esc(g.category)}</div>
      </div>`;
    const img = $("img.icon", el);
    if (img) img.addEventListener("error", () => { const s = document.createElement("span"); s.className = "emoji"; s.textContent = g.emoji || "🎮"; img.replaceWith(s); });
    return el;
  }

  /* ---------- 首頁 ---------- */
  function renderFeatured() {
    const row = $("#featuredRow");
    row.innerHTML = "";
    featured.forEach((g, i) => {
      const el = cardEl(g, i);
      el.addEventListener("click", () => (i === selected ? openGame(g, el) : select(i)));
      el.addEventListener("dblclick", () => openGame(g, el));
      row.appendChild(el);
    });
    select(0);
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
    el.textContent = g.emoji;
    bds.forEach((b, i) => b.classList.toggle("on", i === bdIdx));
  }

  function select(i) {
    if (!featured.length) return;
    selected = (i + featured.length) % featured.length;
    const g = featured[selected];
    setBackdrop(g);
    $$("#featuredRow .card").forEach((c, idx) => c.classList.toggle("selected", idx === selected));
    $("#heroTitle").textContent = g.title;
    $("#heroDesc").textContent = g.desc;
    $("#playBtn span").textContent = g.path ? "開始遊戲" : "即將推出";
    $$("#featuredRow .card")[selected].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  /* ---------- 遊戲庫 / 分類 ---------- */
  function renderGrid(target, list) {
    target.innerHTML = "";
    list.forEach((g, i) => {
      const el = cardEl(g, i);
      el.addEventListener("click", () => openGame(g, el));
      target.appendChild(el);
    });
  }

  function renderChips() {
    const cats = ["全部", ...new Set(games.map(g => g.category))];
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
    renderGrid($("#libraryGrid"), games.filter(g => category === "全部" || g.category === category));
  }

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

  function openGame(g, el) {
    if (!g.path) { sfx("deny"); return toast("「" + g.title + "」即將推出，敬請期待！"); }
    sfx("open");
    current = g;
    srcEl = el || $("#featuredRow .card.selected");
    $("#playerTitle").textContent = g.title;
    frame.src = g.path;
    player.hidden = false;
    closing = false;
    player.animate(
      [{ clipPath: clipFrom(srcEl), opacity: .3 }, { clipPath: "inset(0 round 0)", opacity: 1 }],
      { duration: 460, easing: EASE });
    history.replaceState(null, "", "#play=" + g.id);
    if (window.MiniHubPrefs && MiniHubPrefs().fsStart && player.requestFullscreen) player.requestFullscreen().catch(() => {});
    frame.focus();
  }

  function closeGame() {
    if (!current || closing) return;
    closing = true; sfx("close");
    if (document.fullscreenElement) document.exitFullscreen();
    history.replaceState(null, "", location.pathname + location.search);
    const done = () => { player.hidden = true; frame.src = "about:blank"; current = null; closing = false; };
    const a = player.animate(
      [{ clipPath: "inset(0 round 0)", opacity: 1 }, { clipPath: clipFrom(srcEl), opacity: .3 }],
      { duration: 340, easing: EASE });
    a.onfinish = done;
  }

  $("#closeBtn").addEventListener("click", closeGame);
  $("#reloadBtn").addEventListener("click", () => { if (current) frame.src = current.path; });
  $("#fsBtn").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else player.requestFullscreen && player.requestFullscreen();
  });

  /* ---------- 首頁按鈕 ---------- */
  $("#playBtn").addEventListener("click", () => featured[selected] && openGame(featured[selected], $("#featuredRow .card.selected")));
  $("#libBtn").addEventListener("click", () => showView("library"));
  $("#randBtn").addEventListener("click", () => {
    const playable = games.filter(g => g.path);
    if (playable.length) openGame(playable[Math.floor(Math.random() * playable.length)], $("#randBtn"));
  });

  /* ---------- 鍵盤（需在設定中允許） ---------- */
  // 兩個區域：nav = 最左側分頁；mid = 中間內容。預設在最左側，滑鼠點到哪一區就切到哪一區
  const kbdOn = () => !window.MiniHubPrefs || MiniHubPrefs().kbd;
  const touchOn = () => !window.MiniHubPrefs || MiniHubPrefs().touch;
  let zone = "nav", kEl = null;

  function clearK() { if (kEl) kEl.classList.remove("kfocus"); kEl = null; document.body.classList.remove("login-k"); }
  function setK(el, quiet) {
    clearK(); kEl = el; el.classList.add("kfocus");
    if (!quiet) sfx("move");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (!quiet && el.classList.contains("set-item") && !el.classList.contains("active")) el.click();   // 設定左側分類：移到哪就顯示哪一頁
  }
  function midItems() {
    const v = document.body.dataset.view, P = ".pane.active ";
    let list = [];
    if (v === "library") list = $$("#chips .chip, #libraryGrid .card");
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
    const home = document.body.dataset.view === "home";
    const onLogin = document.body.classList.contains("login-k");
    const list = zone === "nav" && onLogin
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
    if (!$("#profileModal").hidden) return;   // 建立資料視窗不可用 Esc 關閉
    if (!$("#nameModal").hidden) { if (e.key === "Escape") closeModal("nameModal"); return; }
    if (!$("#logoutModal").hidden) { if (e.key === "Escape") closeModal("logoutModal"); return; }
    if (!$("#termsModal").hidden) { if (e.key === "Escape") closeModal("termsModal"); return; }
    if (!$("#noticeModal").hidden) { if (e.key === "Escape" || e.key === "Enter") { closeModal("noticeModal"); e.preventDefault(); } return; }
    if (!$("#linkModal").hidden) { if (e.key === "Escape") closeModal("linkModal"); return; }
    if (!$("#loginModal").hidden) {
      if (e.key === "Escape") closeModal("loginModal");
      else if (kbdOn() && /^(ArrowUp|ArrowDown|w|s)$/i.test(e.key)) {   // ↑↓ 在「登入方式 / 取消」之間移動焦點（關閉快捷鍵時停用）
        const b = $$(".btn-google, .btn-ghost", $("#loginModal"));
        const up = /^(ArrowUp|w)$/i.test(e.key), i = b.indexOf(document.activeElement);
        b[(i + (up ? -1 : 1) + b.length) % b.length].focus(); e.preventDefault();
      }
      return;
    }
    if (!player.hidden) { if (e.key === "Escape") closeGame(); return; }
    if (!kbdOn() || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = DIRS[k], enter = k === "Enter", esc = k === "Escape";
    if (!dir && !enter && !esc) return;
    e.preventDefault();
    document.body.classList.add("kb");

    if (zone === "nav") {                       // 最左側：上下換分頁（最後一個分頁再往下 / 第一個再往上 = 登入、登出按鈕），Enter / D / → 進入中間
      const tabs = $$(".nav-item"), login = $("#loginBtn");
      const cur = tabs.findIndex(n => n.classList.contains("active"));
      const focusLogin = () => { sfx("move"); clearK(); kEl = login; login.classList.add("kfocus"); document.body.classList.add("login-k"); paintHints(); };
      if (kEl === login) {                      // 目前停在登入 / 登出按鈕
        if (dir === "up" || dir === "down") { sfx("move"); clearK(); showView(tabs[dir === "up" ? tabs.length - 1 : 0].dataset.view); paintHints(); }
        else if (enter) { sfx("confirm"); login.click(); }
        else if (esc) { clearK(); paintHints(); }
        return;
      }
      if (dir === "down" && cur === tabs.length - 1) focusLogin();
      else if (dir === "up" && cur === 0) focusLogin();
      else if (dir === "up") stepTab(-1);
      else if (dir === "down") stepTab(1);
      else if (dir === "right" || enter) setZone("mid", true);
      return;
    }
    if (esc) return setZone("nav", true);             // 中間：Esc 回最左側
    if (document.body.dataset.view === "home") {
      if (dir === "right") { sfx("move"); select(selected + 1); }
      else if (dir === "left") { if (selected === 0) setZone("nav", true); else { sfx("move"); select(selected - 1); } }
      else if (enter && featured[selected]) openGame(featured[selected], $("#featuredRow .card.selected"));
      return;
    }
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
    ["loginModal", "termsModal", "logoutModal", "nameModal", "linkModal", "noticeModal"].forEach(closeModal);   // 建立資料視窗必須完成，不在此關閉
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
  $("#logoutOk").addEventListener("click", () => {
    closeModal("logoutModal");
    if (window.MiniHubAuth) MiniHubAuth.signOut();
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
    picking = true; $("#profOk").disabled = true; $("#profUid").textContent = "產生中…";
    let uid = genUid();
    try { for (let i = 0; i < 5 && !(await MiniHubAuth.isUidFree(uid)); i++) uid = genUid(); } catch (e) {}
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
  function startProfile(email) {
    pEmail = email;
    $("#profEmail").textContent = email;
    $("#profName").value = "";
    $("#profPublic").setAttribute("aria-checked", "true");   // 預設開啟
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
    $("#profOk").disabled = r !== "ok" || picking;
  }
  $("#profName").addEventListener("input", validateName);
  $("#profPublic").addEventListener("click", e => {
    const b = e.currentTarget, on = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", on); sfx(on ? "on" : "off");
  });
  $("#profReroll").addEventListener("click", () => { if (!picking) pickUid(); });
  $("#profOk").addEventListener("click", async () => {
    const btn = $("#profOk");
    if (btn.disabled) return;
    btn.disabled = true; $("span", btn).textContent = "建立中…";
    try {
      const p = await MiniHubAuth.createProfile({ name: $("#profName").value, gameUid: $("#profUid").textContent, publicName: $("#profPublic").getAttribute("aria-checked") === "true" });
      closeModal("profileModal");
      setAccount(p);
      toast("歡迎，" + p.name + "！");
    } catch (e) {
      if (e.code === "uid-taken") { pickUid(); toast("UID 已被使用，已換一組新的，請再按一次"); }
      else if (e.code === "already-has-profile") { closeModal("profileModal"); toast("此帳號已有玩家資料"); MiniHubAuth.loadProfile().then(setAccount); }
      else toast("建立失敗：" + (e.code || e.message));
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
      ? { name: p.name, uid: p.gameUid || p.uid, email: p.email, createdAt: p.createdAt || null, nameChangedAt: p.nameChangedAt || null, lastLoginAt: p.prevLoginAt || null, publicName: typeof p.publicName === "boolean" ? p.publicName : null }
      : { name: "", uid: "", email: "", createdAt: null, nameChangedAt: null, lastLoginAt: null, publicName: null };
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
      ["profileModal", "logoutModal", "nameModal", "linkModal"].forEach(closeModal);
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
    if (m.hasAttribute("data-lock")) return;
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

  /* ---------- 初始化 ---------- */
  document.body.dataset.view = "home";
  document.body.dataset.zone = "nav";
  paintHints();
  renderFeatured();
  renderChips();
  renderLibrary();

  /* ---------- 遠端內容（公告 / 開發中遊戲，由 js/remote.js 呼叫） ---------- */
  window.MiniHubAddGames = list => {
    const have = new Set(games.map(g => g.id));
    const add = list.filter(g => !have.has(g.id));
    if (!add.length) return;
    games.push(...add);
    renderChips(); renderLibrary();
    const m2 = location.hash.match(/play=([\w-]+)/);   // 分享連結指向外部遊戲
    if (m2 && player.hidden) { const g = add.find(x => x.id === m2[1]); if (g) openGame(g); }
  };
  let notices = [];
  function renderNotices() {
    const box = $("#noticeList"); box.innerHTML = "";
    notices.forEach(n => {
      const it = document.createElement("article"); it.className = "ann" + (n.hot ? " hot" : "");
      const head = document.createElement("div"); head.className = "ann-head";
      if (n.hot) { const t = document.createElement("span"); t.className = "ann-tag"; t.textContent = "重要"; head.appendChild(t); }
      const h = document.createElement("b"); h.textContent = n.title; head.appendChild(h);
      if (n.date) { const d = document.createElement("small"); d.textContent = n.date; head.appendChild(d); }
      it.appendChild(head);
      if (n.body) { const p = document.createElement("p"); p.textContent = n.body; it.appendChild(p); }
      if (n.link) { const a = document.createElement("a"); a.href = n.link; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "了解更多"; it.appendChild(a); }
      box.appendChild(it);
    });
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
