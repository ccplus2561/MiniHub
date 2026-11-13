(() => {
  "use strict";

  // ===== 設定常數 =====
  const MAX = 75;
  const COLS = [["B", 1, 15], ["I", 16, 30], ["N", 31, 45], ["G", 46, 60], ["O", 61, 75]];
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
  const letterOf = n => (COLS.find(c => n >= c[1] && n <= c[2]) || ["?"])[0];
  const money = n => "$" + Number(n || 0).toLocaleString("en-US");
  const pad = n => String(n).padStart(2, "0");

  // ===== 狀態 =====
  let data = null;       // 主持人公開的最新資料
  let prevN = null;      // 上次顯示的抽號次數（只有變多才播動畫）
  let conn = null, unwatch = null, cloudTimer = 0;

  // ===== 號碼表（只建立一次）=====
  function buildBoard() {
    const board = $("board");
    COLS.forEach(([l, lo, hi]) => {
      board.appendChild(el("span", "board__let", l));
      for (let n = lo; n <= hi; n++) {
        const c = el("span", "cell", String(n));
        c.setAttribute("role", "gridcell");
        cells.set(n, c);
        board.appendChild(c);
      }
    });
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
      ball.append(el("span", "ball__let", letterOf(num)), el("span", "ball__txt", String(num)));
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
        row.appendChild(el("span", "", "🎉 已出爐" + (o.tie > 1 ? "（同時 " + o.tie + " 人）" : "") + (o.seq ? " · 第 " + o.seq + " 次抽號" : "")));
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

    const order = $("order");
    order.textContent = "";
    if (!drawn.length) order.appendChild(el("em", "", "尚未抽出任何號碼"));
    drawn.forEach(num => order.appendChild(el("i", "", String(num))));
    order.scrollLeft = order.scrollWidth; order.scrollTop = order.scrollHeight;

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

  buildBoard();
  render();
  start();
})();
