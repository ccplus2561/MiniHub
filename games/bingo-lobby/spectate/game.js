(() => {
  "use strict";

  // ===== 設定常數 =====
  const MAX = 75;
    const RANK_COUNT = 3;
  const STATUS_TEXT = { setup: "設定中", playing: "進行中", ended: "已結束", wait: "等待主持人" };
  const CLOUD_RETRY_MS = 2000;
  const STALE_MS = 90 * 1000;   // 超過這段時間沒收到更新，提示可能已離線

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  const Room = window.BingoRoom;
  const room = Room.readParams().room;
  const ball = $("ball"), cells = new Map();

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const money = n => "$" + Number(n || 0).toLocaleString("en-US");
  const pad = n => String(n).padStart(2, "0");

  // ===== 狀態 =====
  let data = null;       // 主持人公開的最新資料
  let prevN = null;      // 上次顯示的抽號次數（只有變多才播動畫）
  let conn = null, unwatch = null, cloudTimer = 0;
  let burst = [];        // 尚未看完的連抽結果：{ seq, t, num }
  let burstOpen = false;

  // ===== 號碼表（只建立一次）=====
  function buildBoard() {
    const board = $("board");
    for (let n = 1; n <= MAX; n++) {
      const c = el("span", "cell", String(n));
      c.setAttribute("role", "gridcell");
      cells.set(n, c);
      board.appendChild(c);
    }
  }

  // ===== 繪製 =====
  function setBall(last) {
    ball.textContent = "";
    ball.classList.remove("is-pop");
    if (!last) {
      ball.dataset.kind = "none";
      ball.appendChild(el("span", "ball__txt", "—"));
      $("ballNote").textContent = "等待主持人抽號";
      return;
    }
    const [t, num] = last;
    if (t === 2 || num == null) {
      ball.dataset.kind = "blank";
      ball.appendChild(el("span", "ball__word", "銘謝惠顧"));
      $("ballNote").textContent = "這次沒有號碼";
    } else {
      ball.dataset.kind = t === 1 ? "repeat" : "new";
      ball.appendChild(el("span", "ball__txt", String(num)));
      $("ballNote").textContent = t === 1 ? "重複號碼（已抽過）" : "新號碼";
    }
  }

  function renderRecent(recent) {
    const box = $("recent");
    box.textContent = "";
    const rows = (recent || []).slice();
    for (let i = 0; i < 5 - rows.length; i++) box.appendChild(el("span", "chip is-empty", "·"));
    rows.forEach(([t, num]) => {
      if (t === 2 || num == null) box.appendChild(el("span", "chip is-blank", "銘謝"));
      else box.appendChild(el("span", "chip " + (t === 1 ? "is-repeat" : "is-new"), String(num)));
    });
  }

  function renderRanks(ranks) {
    const box = $("ranks");
    box.textContent = "";
    const owner = {};   // 名次 → 登錄資料（同時賓果會佔用後面的名次）
    (ranks || []).forEach(([rank, tie, seq]) => {
      for (let p = rank; p < rank + tie && p <= RANK_COUNT; p++) owner[p] = { rank, tie, seq };
    });
    for (let p = 1; p <= RANK_COUNT; p++) {
      const o = owner[p];
      const row = el("div", "rk");
      row.appendChild(el("b", "", "第 " + p + " 名"));
      if (!o) row.appendChild(el("span", "", "尚未出爐"));
      else if (o.rank !== p) { row.classList.add("is-merged"); row.appendChild(el("span", "", "併入第 " + o.rank + " 名")); }
      else {
        row.classList.add("is-done");
        row.appendChild(el("span", "", "🎉 已出爐" + (o.tie > 1 ? "（同時 " + o.tie + " 人）" : "") + (o.seq ? " · 第 " + o.seq + " 次" : "")));
      }
      box.appendChild(row);
    }
  }

  function render() {
    const d = data;
    const status = d ? d.status : "wait";
    const badge = $("badge");
    badge.dataset.s = status;
    badge.textContent = STATUS_TEXT[status] || "進行中";

    const drawn = d && Array.isArray(d.drawn) ? d.drawn : [];
    const n = d ? d.n | 0 : 0;
    const last = d ? d.last : null;

    setBall(last);
    if (d && prevN !== null && n > prevN && last) { void ball.offsetWidth; ball.classList.add("is-pop"); }
    if (burstOpen && n > (prevN || 0)) closeBurst();   // 主持又抽了新號碼：沒按「我看完了」也自動關閉
    if (d && prevN !== null && n - prevN >= 2) addBurst(n, n - prevN, d.recent || []);
    if (!d || n < (prevN || 0)) closeBurst();   // 新局或沒資料：清掉未看完的結果
    prevN = n;

    $("count").textContent = d ? "已抽出 " + drawn.length + " / " + MAX + "　·　共抽 " + n + " 次" : "";
    $("boardCount").textContent = d ? drawn.length + " / " + MAX : "";
    renderRecent(d ? d.recent : []);
    renderRanks(d ? d.ranks : []);

    const drawnSet = new Set(drawn);
    const nowNum = last && last[0] === 0 ? last[1] : null;
    cells.forEach((c, num) => {
      c.classList.toggle("on", drawnSet.has(num));
      c.classList.toggle("now", num === nowNum);
    });

    // 獎金池：只有主持人開放時，資料裡才會有金額
    const showPool = !!d && d.pool != null;
    $("pool").hidden = !showPool;
    if (showPool) $("poolAmt").textContent = money(d.pool);

    const nt = $("notice");
    if (!d) { nt.hidden = false; nt.textContent = "尚未收到主持人的資料，主持人進入房間並開始後會自動顯示。"; }
    else if (d.status === "ended") { nt.hidden = false; nt.textContent = "本局已結束，等待主持人開新局。"; }
    else nt.hidden = true;

    if (d && d.at) { const t = new Date(d.at); $("stamp").textContent = "更新於 " + pad(t.getHours()) + ":" + pad(t.getMinutes()) + ":" + pad(t.getSeconds()); }
  }

  // ===== 連續抽號：全螢幕逐一顯示，看完才關閉（避免漏看）=====
  function addBurst(n, k, recent) {
    const rows = recent.slice(-Math.min(k, recent.length));
    rows.forEach(([t, num], i) => burst.push({ seq: n - rows.length + i + 1, t, num }));
    renderBurst();
  }
  function renderBurst() {
    const box = $("burst");
    if (!burst.length) { closeBurst(); return; }
    burstOpen = true;
    box.hidden = false;
    $("burstTitle").textContent = "連續抽出 " + burst.length + " 個號碼";
    const list = $("burstList");
    list.textContent = "";
    burst.forEach(b => {
      const blank = b.t === 2 || b.num == null;
      const item = el("div", "bb bb--" + (blank ? "blank" : b.t === 1 ? "repeat" : "new"));
      item.appendChild(el("span", "bb__seq", "第 " + b.seq + " 次"));
      item.appendChild(el("span", blank ? "bb__word" : "bb__num", blank ? "銘謝惠顧" : String(b.num)));
      if (!blank && b.t === 1) item.appendChild(el("span", "bb__tag", "重複"));
      list.appendChild(item);
    });
  }
  function closeBurst() {
    burst = []; burstOpen = false;
    const box = $("burst"); if (box) box.hidden = true;
  }

  function apply(d) {
    if (!d || d.v !== 1 || d.room !== room) return;
    if (data && d.at < data.at) return;   // 忽略比較舊的資料（同時收到本機與雲端兩份時）
    data = d;
    render();
  }

  // ===== 資料來源 =====
  // 1) 同瀏覽器：BroadcastChannel（即時）　2) 跨裝置：Firestore live 文件（登入後自動連線）
  function attachCloud() {
    if (unwatch) return true;
    try {
      const A = window.parent !== window && window.parent.MiniHubAuth;
      if (!A || !A.rooms || !A.rooms.live || !A.rooms.on()) return false;
      unwatch = A.rooms.live.watch(room, (d, err) => {
        if (err) { $("notice").hidden = false; $("notice").textContent = "無法讀取房間資料（雲端權限或網路問題）。"; return; }
        apply(d);
      });
      return !!unwatch;
    } catch (e) { return false; }
  }

  function start() {
    if (!Room.isValid(room)) {
      $("notice").hidden = false; $("notice").textContent = "房號不正確，請回大廳重新選擇房間。";
      $("badge").textContent = "無法旁觀";
      return;
    }
    $("roomName").textContent = "房間 " + room;
    Room.directory.get(room).then(r => {
      if (!r) return;
      $("roomName").textContent = r.name || "未命名房間";
      $("roomMeta").textContent = "房號 " + r.id;
    }).catch(() => { /* 取不到名稱就維持房號 */ });

    conn = Room.connect({ code: room, role: "spectator" });
    conn.on(m => { if (m.type === Room.MSG.SNAPSHOT) apply(m.data); });
    conn.send(Room.MSG.SNAPSHOT_REQ);

    if (!attachCloud()) cloudTimer = setInterval(() => { if (attachCloud()) clearInterval(cloudTimer); }, CLOUD_RETRY_MS);
    try { MiniHub.onChange(attachCloud); } catch (e) { /* 忽略 */ }
    setInterval(() => {   // 久未更新時提示
      if (data && data.status === "playing" && Date.now() - data.at > STALE_MS) {
        $("notice").hidden = false; $("notice").textContent = "已有一段時間沒有新資料，主持人可能暫時離線或在思考中。";
      }
    }, 15000);
    addEventListener("pagehide", () => { try { if (unwatch) unwatch(); if (conn) conn.close(); } catch (e) { /* 忽略 */ } });
  }

  $("burstOk").addEventListener("click", closeBurst);
  buildBoard();
  render();
  start();
})();
