(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const games = window.GAMES || [];
  const featured = games.filter(g => g.featured);

  let selected = 0;
  let category = "全部";

  /* ---------- 卡片 ---------- */
  function cardEl(g, { selectable = false } = {}) {
    const soon = !g.path;
    const el = document.createElement("button");
    el.className = "card" + (soon ? " soon" : "");
    el.dataset.id = g.id;
    el.style.setProperty("--c1", g.colors[0]);
    el.style.setProperty("--c2", g.colors[1]);
    el.innerHTML = `
      <div class="card-art">${g.emoji}</div>
      <span class="badge">${soon ? "即將推出" : "開始"}</span>
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
      const el = cardEl(g);
      el.addEventListener("click", () => select(i));
      el.addEventListener("dblclick", () => openGame(g));
      $(".badge", el).addEventListener("click", e => { e.stopPropagation(); select(i); openGame(g); });
      row.appendChild(el);
    });
    select(0);
  }

  function select(i) {
    if (!featured.length) return;
    selected = (i + featured.length) % featured.length;
    const g = featured[selected];
    $$("#featuredRow .card").forEach((c, idx) => c.classList.toggle("selected", idx === selected));
    $("#heroTitle").textContent = g.title;
    $("#heroDesc").textContent = g.desc;
    $("#playBtn span").textContent = g.path ? "開始遊戲" : "即將推出";
    $$("#featuredRow .card")[selected].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  /* ---------- 遊戲庫 / 分類 ---------- */
  function renderGrid(target, list) {
    target.innerHTML = "";
    list.forEach(g => {
      const el = cardEl(g);
      el.addEventListener("click", () => openGame(g));
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
      b.addEventListener("click", () => { category = c; renderChips(); renderCategory(); });
      box.appendChild(b);
    });
  }

  function renderCategory() {
    renderGrid($("#categoryGrid"), games.filter(g => category === "全部" || g.category === category));
  }

  /* ---------- 頁面切換 ---------- */
  function showView(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  }
  $$(".nav-item").forEach(n => n.addEventListener("click", () => showView(n.dataset.view)));

  /* ---------- 播放層 ---------- */
  const player = $("#player"), frame = $("#frame");
  let current = null;

  function openGame(g) {
    if (!g.path) return toast("「" + g.title + "」即將推出，敬請期待！");
    current = g;
    $("#playerTitle").textContent = g.title;
    frame.src = g.path;
    player.hidden = false;
    history.replaceState(null, "", "#play=" + g.id);
    frame.focus();
  }

  function closeGame() {
    player.hidden = true;
    frame.src = "about:blank";
    current = null;
    history.replaceState(null, "", location.pathname + location.search);
    if (document.fullscreenElement) document.exitFullscreen();
  }

  $("#closeBtn").addEventListener("click", closeGame);
  $("#reloadBtn").addEventListener("click", () => { if (current) frame.src = current.path; });
  $("#fsBtn").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else player.requestFullscreen && player.requestFullscreen();
  });

  /* ---------- 首頁按鈕 ---------- */
  $("#playBtn").addEventListener("click", () => featured[selected] && openGame(featured[selected]));
  $("#libBtn").addEventListener("click", () => showView("library"));
  $("#randBtn").addEventListener("click", () => {
    const playable = games.filter(g => g.path);
    if (playable.length) openGame(playable[Math.floor(Math.random() * playable.length)]);
  });

  /* ---------- 鍵盤 ---------- */
  document.addEventListener("keydown", e => {
    if (!player.hidden) { if (e.key === "Escape") closeGame(); return; }
    if (!$("#view-home").classList.contains("active")) return;
    if (e.key === "ArrowRight") { select(selected + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { select(selected - 1); e.preventDefault(); }
    else if (e.key === "Enter") { featured[selected] && openGame(featured[selected]); }
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

  /* ---------- 初始化 ---------- */
  renderFeatured();
  renderGrid($("#libraryGrid"), games);
  renderChips();
  renderCategory();

  // 分享連結：index.html#play=snake
  const m = location.hash.match(/play=([\w-]+)/);
  if (m) { const g = games.find(x => x.id === m[1]); if (g) openGame(g); }
})();
