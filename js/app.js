(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const games = window.GAMES || [];
  const featured = games.filter(g => g.featured);

  let selected = 0;
  let category = "全部";

  /* ---------- 卡片 ---------- */
  function cardEl(g, idx = 0) {
    const soon = !g.path;
    const el = document.createElement("button");
    el.className = "card" + (soon ? " soon" : "");
    el.dataset.id = g.id;
    el.style.setProperty("--i", idx);
    el.style.setProperty("--c1", g.colors[0]);
    el.style.setProperty("--c2", g.colors[1]);
    el.innerHTML = `
      <div class="card-art"><span class="emoji">${g.emoji}</span></div>
      ${soon ? '<span class="badge">即將推出</span>' : ""}
      <div class="card-info">
        <div class="card-name">${g.title}</div>
        <div class="card-sub">${g.category}</div>
      </div>`;
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
    if (!g.path) return toast("「" + g.title + "」即將推出，敬請期待！");
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
    closing = true;
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
  const kbdOn = () => !window.MiniHubPrefs || MiniHubPrefs().kbd;
  function stepTab(d) {
    const tabs = $$(".nav-item");
    const cur = tabs.findIndex(n => n.classList.contains("active"));
    showView(tabs[(cur + d + tabs.length) % tabs.length].dataset.view);
  }
  document.addEventListener("keydown", e => {
    if (!player.hidden) { if (e.key === "Escape") closeGame(); return; }
    if (!kbdOn() || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "ArrowUp" || k === "w") { stepTab(-1); e.preventDefault(); return; }
    if (k === "ArrowDown" || k === "s") { stepTab(1); e.preventDefault(); return; }
    if (!$("#view-home").classList.contains("active")) return;
    if (k === "ArrowRight" || k === "d") { select(selected + 1); e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "a") { select(selected - 1); e.preventDefault(); }
    else if (k === "Enter" && e.target === document.body) { featured[selected] && openGame(featured[selected], $("#featuredRow .card.selected")); }
  });

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
  $("#loginBtn").addEventListener("click", () => toast("登入功能即將推出"));

  /* ---------- 初始化 ---------- */
  document.body.dataset.view = "home";
  renderFeatured();
  renderChips();
  renderLibrary();

  // 分享連結：index.html#play=snake
  const m = location.hash.match(/play=([\w-]+)/);
  if (m) { const g = games.find(x => x.id === m[1]); if (g) openGame(g); }
})();
