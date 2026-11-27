(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    slots: $("slots"), msg: $("msg"), keypad: $("keypad"), submit: $("submit"),
    title: $("title"), count: $("count"), time: $("time"), best: $("best"),
    history: $("history"), empty: $("empty"), reveal: $("reveal"),
  };
  const $q = (s) => document.querySelector(s);
  const MH = window.MiniHub;   // 大廳共用 SDK（單獨開啟頁面時也有安全預設值）
  // 音效（audio.js）：開關與音量跟著大廳的音效按鈕；音訊失敗不影響遊戲
  const sound = new Proxy({}, { get: (_, k) => (...a) => { try { window.GameAudio && window.GameAudio[k](...a); } catch (_) { /* 略過 */ } } });
  let len = 4, repeat = false, guessRep = false, started = false, pLen = 4, pRep = false, pGuess = false;
  let dupB = false, pDupB = false;
  let answer = [], input = [], records = [], over = false, won = false, total = 0, nextId = 1, sortDesc = true;
  let locks = [], sel = -1, lastIdx = -1, lpFired = false;
  let startAt = 0, timer = null, elapsed = 0, paused = false, starting = false;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // 以瀏覽器密碼學亂數產生（無偏差取樣），不使用 Math.random
  function rnd(n) {
    const c = window.crypto || window.msCrypto;
    if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
    const buf = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do { c.getRandomValues(buf); } while (buf[0] >= lim);
    return buf[0] % n;
  }

  // 排除過於好猜的答案：全部相同、等差排列（如 1234、4321、2468）
  function tooEasy(a) {
    const d = a[1] - a[0];
    return a.every((x, i) => i === 0 || x - a[i - 1] === d);
  }

  function makeAnswer() {
    let a;
    do {
      if (repeat) a = Array.from({ length: len }, () => rnd(10));
      else {
        const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = pool.length - 1; i > 0; i--) {
          const k = rnd(i + 1);
          [pool[i], pool[k]] = [pool[k], pool[i]];
        }
        a = pool.slice(0, len);
      }
    } while (tooEasy(a));
    return a;
  }

  function judge(guess) {
    let a = 0;
    const ca = Array(10).fill(0), cg = Array(10).fill(0);
    const has = Array(10).fill(false); // 猜測中是否出現過該數字（含已算 A 的位置）
    guess.forEach((d, i) => {
      has[d] = true;
      if (d === answer[i]) a++;
      else { ca[answer[i]]++; cg[d]++; }
    });
    let b = 0;
    // 特殊玩法：猜測中只要出現該數字，答案中重複的每一個都計入 B
    for (let d = 0; d < 10; d++) b += dupB ? (has[d] ? ca[d] : 0) : Math.min(ca[d], cg[d]);
    return { a, b };
  }

  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

  function say(t, kind) {
    el.msg.textContent = t || "";
    el.msg.className = "msg" + (kind ? " " + kind : "");
  }

  const firstEmpty = () => input.findIndex((v) => v === null);

  function renderSlots() {
    el.slots.innerHTML = "";
    const auto = sel < 0 && !over ? firstEmpty() : -1;
    for (let i = 0; i < len; i++) {
      const d = document.createElement("div");
      const filled = input[i] !== null && input[i] !== undefined;
      d.className = "digit-slot" + (filled ? " filled" : " empty") +
        (i === auto || (i === sel && !over) ? " active" : "") +
        (i === sel && !over ? " sel" : "") +
        (locks[i] && !over ? " locked" : "") +
        (filled && i === lastIdx && !over ? " pop" : "") + (won ? " win" : "");
      d.dataset.i = i;
      if (won) d.style.animationDelay = (i * 90) + "ms";
      d.innerHTML = "<span>" + (filled ? input[i] : "-") + "</span>";
      el.slots.appendChild(d);
    }
  }

  function bestKey() { return "1a2b-best-" + len + (repeat ? "r" : "u") + (guessRep ? "g" : "n") + (dupB ? "x" : ""); }

  function renderBest() {
    const b = parseInt(store.get(bestKey()), 10) || 0;
    el.best.innerHTML = b ? b + " <em>次</em>" : "— <em>次</em>";
  }

  function renderCount() {
    el.count.innerHTML = total ? total + " <em>次</em>" : "— <em>次</em>";
  }

  const TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>';

  function renderSort() {
    $("sortText").textContent = sortDesc ? "最新在上" : "最舊在上";
    $("sortBtn").classList.toggle("asc", !sortDesc);
  }

  function renderHistory(scroll) {
    el.history.querySelectorAll(".record").forEach((n) => n.remove());
    el.empty.style.display = records.length ? "none" : "";
    el.history.classList.toggle("has-records", records.length > 0);
    const list = sortDesc ? records.slice().reverse() : records;
    list.forEach((r) => {
      const row = document.createElement("div");
      row.className = "record" + (len >= 7 ? " long" : "") + (r.a === len ? " win" : "") + (r.fresh ? " new" : "");
      r.fresh = false;
      row.dataset.id = r.id;
      row.innerHTML =
        '<span class="record-no">#' + r.id + "</span>" +
        '<span class="record-digits">' + r.guess.join("") + "</span>" +
        '<span class="record-result"><b class="ra">' + r.a + "A</b><b class=\"rb\">" + r.b + "B</b></span>" +
        '<button type="button" class="record-del" title="刪除此紀錄" aria-label="刪除第 ' + r.id + ' 筆紀錄">' + TRASH + "</button>";
      el.history.appendChild(row);
    });
    if (scroll) el.history.scrollTop = sortDesc ? 0 : el.history.scrollHeight;
  }

  function tick() { el.time.textContent = fmt(Math.floor((timer ? Date.now() - startAt : elapsed) / 1000)); }
  function startTimer() {
    if (timer) return;
    startAt = Date.now() - elapsed;
    timer = setInterval(tick, 500);
  }
  function stopTimer() {
    if (timer) elapsed = Date.now() - startAt;
    clearInterval(timer); timer = null;
  }

  // 暫停：大廳點左側導覽時呼叫；計時凍結，點一下或按任意鍵繼續
  function pauseGame() {
    if (!timer || over) return;
    stopTimer(); tick(); paused = true;
    say("已暫停，點一下或按任意鍵繼續", "warn");
  }
  function resumeGame() {
    if (!paused) return;
    paused = false; startTimer(); say("");
  }
  MH.onPause(pauseGame);
  document.addEventListener("pointerdown", resumeGame, true);
  document.addEventListener("keydown", resumeGame, true);

  // 大廳關閉觸控 / 鍵盤操作時，對應輸入一律忽略
  document.addEventListener("click", (e) => {
    if (e.pointerType === "touch" && !MH.touchOn()) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && !MH.touchOn()) e.stopImmediatePropagation();
  }, true);

  // 開始下一局前先向大廳確認（未登入時大廳會詢問同意條款）；回傳 false 就不開始
  async function canStart() {
    if (starting) return false;
    starting = true;
    try { return (await MH.requestNext()) !== false; } catch (e) { return true; } finally { starting = false; }
  }

  function newGame() {
    answer = makeAnswer();
    input = Array(len).fill(null); locks = Array(len).fill(false); sel = -1; lastIdx = -1;
    records = []; over = false; won = false; total = 0; nextId = 1;
    stopTimer(); elapsed = 0; paused = false;
    el.time.textContent = "00:00";
    el.title.textContent = "準備開始推理？";
    el.submit.firstChild.textContent = "送出猜測 ";
    say("");
    $("cfgLen").textContent = len + " 位";
    $("cfgRep").textContent = repeat ? "可重複" : "不重複";
    $("cfgGuess").textContent = guessRep ? "可重複" : "不重複";
    $("cfgDupB").textContent = dupB ? "開啟" : "關閉";
    $("dupBRule").hidden = !dupB;
    $("ruleTitle").textContent = repeat ? "可重複數字" : "不重複數字";
    $("ruleDesc").textContent = repeat ? "電腦的答案可能出現相同數字" : "電腦的答案每個數字都不同";
    el.reveal.disabled = false;
    renderSlots(); renderCount(); renderBest(); renderHistory(true);
  }

  function press(d) {
    if (over) return;
    const t = sel >= 0 ? sel : firstEmpty();
    if (t < 0) { say("已經填滿了，可點格子修改", "warn"); sound.deny(); return; }
    if (locks[t]) { say("第 " + (t + 1) + " 格已鎖定，長按可解鎖", "warn"); sound.deny(); return; }
    if (!guessRep && input.some((v, i) => i !== t && v === d)) { say("數字不可重複", "warn"); sound.deny(); return; }
    say("");
    sound.key(d);
    startTimer();
    input[t] = d; lastIdx = t; sel = -1;
    renderSlots();
  }

  // 刪除：有選取格子 → 只清除該格（不會前移補位）；否則清除最後一個未鎖定的數字
  function back() {
    if (over) return;
    let t = sel;
    if (t < 0) { for (let i = len - 1; i >= 0; i--) if (input[i] !== null && !locks[i]) { t = i; break; } }
    if (t < 0) return;
    if (locks[t]) { say("第 " + (t + 1) + " 格已鎖定，長按可解鎖", "warn"); sound.deny(); return; }
    sound.back();
    input[t] = null; lastIdx = -1; say(""); renderSlots();
  }

  function clearAll() {
    if (over) return;
    sound.clear();
    input = input.map((v, i) => (locks[i] ? v : null));
    sel = -1; lastIdx = -1; say(""); renderSlots();
  }

  // 點擊選取格子；長按鎖定 / 解鎖
  let lpTimer = null, pressEl = null;
  const cancelLP = () => { clearTimeout(lpTimer); lpTimer = null; if (pressEl) pressEl.classList.remove("pressing"); pressEl = null; };
  el.slots.addEventListener("pointerdown", (e) => {
    const n = e.target.closest(".digit-slot");
    if (!n || over) return;
    lpFired = false; cancelLP();
    const i = +n.dataset.i;
    pressEl = n; n.classList.add("pressing");
    lpTimer = setTimeout(() => {
      lpTimer = null; lpFired = true;
      if (input[i] === null) { say("請先輸入數字再鎖定", "warn"); sound.deny(); cancelLP(); return; }
      locks[i] = !locks[i];
      if (locks[i]) sound.lock(); else sound.unlock();
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
      say(locks[i] ? "第 " + (i + 1) + " 格已鎖定（不代表數字正確）" : "第 " + (i + 1) + " 格已解鎖", locks[i] ? "ok" : "");
      cancelLP(); renderSlots();
    }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.slots.addEventListener(ev, cancelLP));
  el.slots.addEventListener("contextmenu", (e) => e.preventDefault());
  el.slots.addEventListener("click", (e) => {
    const n = e.target.closest(".digit-slot");
    if (lpFired) { lpFired = false; return; }
    if (!n || over) return;
    const i = +n.dataset.i;
    sel = sel === i ? -1 : i;
    sound.select();
    say(""); renderSlots();
  });

  function submit() {
    if (over) { canStart().then((ok) => { if (ok) { sound.start(); newGame(); } }); return; }
    if (input.some((v) => v === null)) { say("請輸入 " + len + " 個" + (guessRep ? "" : "不同") + "數字", "warn"); sound.deny(); return; }
    const guess = input.slice();
    const { a, b } = judge(guess);
    total++;
    records.push({ id: nextId++, guess, a, b, fresh: true });
    input = input.map((v, i) => (locks[i] ? v : null)); // 鎖定的格子送出後保留
    sel = -1; lastIdx = -1;
    say("");
    if (a !== len) sound.guess(a, b);
    if (a === len) {
      over = true; won = true; sound.win();
      input = guess.slice(); locks.fill(false); // 猜對後保持顯示答案
      stopTimer(); tick();
      el.title.textContent = "答對了！共猜 " + total + " 次";
      const key = bestKey(), prev = parseInt(store.get(key), 10);
      if (!prev || total < prev) { store.set(key, String(total)); say("新紀錄！", "ok"); }
      else say("太棒了！", "ok");
      el.submit.firstChild.textContent = "再玩一局 ";
      el.reveal.disabled = true;
      renderBest();
    }
    renderSlots(); renderCount(); renderHistory(true);
  }

  el.keypad.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const k = t.textContent.trim();
    if (/^\d$/.test(k)) press(parseInt(k, 10));
    else if (k === "⌫") back();
    else if (k === "清除") clearAll();
  });
  el.submit.addEventListener("click", submit);

  // 排序切換
  sortDesc = store.get("1a2b-sort") !== "asc";
  renderSort();
  $("sortBtn").addEventListener("click", () => {
    sortDesc = !sortDesc;
    store.set("1a2b-sort", sortDesc ? "desc" : "asc");
    renderSort(); renderHistory(true);
  });

  // 刪除單筆紀錄（僅移除顯示，不影響猜測次數與成績）
  el.history.addEventListener("click", (e) => {
    const btn = e.target.closest(".record-del");
    if (!btn) return;
    const row = btn.closest(".record");
    if (!row || row.classList.contains("leaving")) return;
    sound.back();
    row.classList.add("leaving");
    setTimeout(() => {
      const i = records.findIndex((r) => String(r.id) === row.dataset.id);
      if (i >= 0) records.splice(i, 1);
      renderHistory(false);
    }, 240);
  });

  // 手機版：按住「紀錄」鈕顯示懸浮紀錄，放開消失（按住時可用另一指滑動）
  (function () {
    const btn = $("peekBtn"), pop = $("peekPop");
    let pid = null;
    function fill() {
      if (!records.length) { pop.innerHTML = '<div class="peek-empty">還沒有猜測紀錄</div>'; return; }
      const list = sortDesc ? records.slice().reverse() : records;
      pop.innerHTML = list.map((r) =>
        '<div class="peek-row' + (r.a === len ? " win" : "") + '"><span class="peek-no">#' + r.id + '</span><span class="peek-digits">' +
        r.guess.join("") + '</span><span class="peek-res"><b class="ra">' + r.a + 'A</b><b class="rb">' + r.b + "B</b></span></div>").join("");
    }
    function show() {
      fill();
      const top = btn.getBoundingClientRect().bottom + 8;
      pop.style.top = top + "px";
      pop.style.maxHeight = Math.max(120, window.innerHeight - top - 12) + "px";
      pop.classList.add("show");
      pop.setAttribute("aria-hidden", "false");
      pop.scrollTop = sortDesc ? 0 : pop.scrollHeight;
    }
    function hide() {
      pid = null;
      btn.classList.remove("on");
      pop.classList.remove("show");
      pop.setAttribute("aria-hidden", "true");
    }
    btn.addEventListener("pointerdown", (e) => {
      if (pid !== null) return;
      pid = e.pointerId;
      try { btn.setPointerCapture(pid); } catch (_) {}
      btn.classList.add("on");
      show();
    });
    ["pointerup", "pointercancel"].forEach((t) => btn.addEventListener(t, (e) => { if (e.pointerId === pid) hide(); }));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", () => { if (document.hidden) hide(); });
  })();

  // 公布答案：先二次確認
  const confirmModal = $("confirmModal");
  const closeConfirm = () => confirmModal.classList.remove("open");
  el.reveal.addEventListener("click", () => {
    if (over) return;
    confirmModal.classList.add("open");
    $("confirmNo").focus();
  });
  $("confirmNo").addEventListener("click", closeConfirm);
  confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) closeConfirm(); });
  $("confirmYes").addEventListener("click", () => { closeConfirm(); reveal(); });

  // 其餘按鈕（設定、選項、排序、公布答案、取消…）統一的按鈕音效；數字鍵盤、送出、開始、確定公布、刪除紀錄已各自有專屬音效
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.closest("#keypad") || b.closest("#history") || ["submit", "startBtn", "confirmYes"].includes(b.id)) return;
    sound.click();
  });

  function reveal() {
    if (over) return;
    over = true; sound.lose();
    stopTimer();
    input = answer.slice(); locks.fill(false); sel = -1;
    el.title.textContent = "答案公布：" + answer.join("");
    say("本局已結束", "warn");
    el.submit.firstChild.textContent = "再玩一局 ";
    el.reveal.disabled = true;
    renderSlots();
  }

  // ---- settings modal ----
  const modal = $("modal");
  function renderParams() {
    $("lenOut").textContent = pLen;
    $("lenDown").disabled = pLen <= 4;
    $("lenUp").disabled = pLen >= 10;
    document.querySelectorAll("#repSeg button").forEach((b) => b.classList.toggle("active", (b.dataset.rep === "1") === pRep));
    document.querySelectorAll("#guessSeg button").forEach((b) => b.classList.toggle("active", (b.dataset.g === "1") === pGuess));
    if (!pRep) pDupB = false;
    document.querySelectorAll("#dupBSeg button").forEach((b) => { b.classList.toggle("active", (b.dataset.d === "1") === pDupB); b.disabled = !pRep; });
    $("dupBSeg").classList.toggle("disabled", !pRep);
  }
  function setInfo(open) {
    $("dupBInfo").classList.toggle("open", open);
    $("dupBInfo").setAttribute("aria-hidden", open ? "false" : "true");
    $("dupBInfoBtn").setAttribute("aria-expanded", open ? "true" : "false");
    $("dupBInfoBtn").classList.toggle("on", open);
  }
  $("dupBInfoBtn").addEventListener("click", () => setInfo(!$("dupBInfo").classList.contains("open")));
  function openModal() {
    pLen = len; pRep = repeat; pGuess = guessRep; pDupB = dupB; setInfo(false); renderParams();
    $("cancelModal").hidden = !started;
    modal.classList.add("open");
  }
  function closeModal() { modal.classList.remove("open"); }
  $("lenDown").addEventListener("click", () => { pLen = Math.max(4, pLen - 1); renderParams(); });
  $("lenUp").addEventListener("click", () => { pLen = Math.min(10, pLen + 1); renderParams(); });
  $("repSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    pRep = b.dataset.rep === "1"; renderParams();
  });
  $("guessSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    pGuess = b.dataset.g === "1"; renderParams();
  });
  $("dupBSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !pRep) return;
    pDupB = b.dataset.d === "1"; renderParams();
  });
  $("startBtn").addEventListener("click", () => {
    canStart().then((ok) => {
      if (!ok) return;
      len = pLen; repeat = pRep; guessRep = pGuess; dupB = pRep ? pDupB : false; started = true;
      closeModal(); sound.start(); newGame();
    });
  });
  $("cancelModal").addEventListener("click", closeModal);
  $("openSettings").addEventListener("click", openModal);


  document.addEventListener("keydown", (e) => {
    if (!MH.kbdOn()) return;   // 大廳關閉鍵盤操作
    if (confirmModal.classList.contains("open")) {
      if (e.key === "Escape") closeConfirm();
      return;
    }
    if (modal.classList.contains("open")) {
      if (e.key === "Enter") { e.preventDefault(); $("startBtn").click(); }
      else if (e.key === "Escape" && started) closeModal();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) press(parseInt(e.key, 10));
    else if (e.key === "Backspace") back();
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") clearAll();
  });

  newGame();
  openModal();
})();
