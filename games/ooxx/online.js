(() => {
  "use strict";
  const S = window.OOXXOnline;
  const $ = id => document.getElementById(id);
  const el = {
    createBox: $("create-box"), name: $("room-name"), createBtn: $("create-btn"),
    owned: $("owned-box"), code: $("owned-code"), ownedName: $("owned-name"), ownedStatus: $("owned-status"),
    del: $("del-btn"), enter: $("enter-btn"), note: $("my-note"), err: $("my-err"),
    list: $("room-list"), count: $("room-count"), empty: $("list-empty"), search: $("search"),
    confirm: $("confirm"), confirmDesc: $("confirm-desc"), yes: $("confirm-yes"), no: $("confirm-no"),
  };
  let rooms = [];
  let busy = false;

  const goRoom = id => { location.href = `play.html?mode=online&room=${id}`; };
  const statusText = r => (r.guestUid ? "對戰中" : "等待對手加入");
  const ERR = {
    owned: "你已經有一間房間，請先刪除後再建立。",
    gone: "房間已不存在。", full: "房間已滿。", id: "無法產生房號，請稍後再試。",
  };
  function showErr(msg) { el.err.textContent = msg || ""; el.err.hidden = !msg; }

  function mk(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    const uid = S.me().uid;
    const mine = rooms.find(r => r.hostUid === uid) || null;

    el.createBox.hidden = !!mine;
    el.owned.hidden = !mine;
    el.note.hidden = false;
    if (mine) {
      el.code.textContent = mine.id;
      el.ownedName.textContent = mine.name || "未命名房間";
      el.ownedStatus.textContent = statusText(mine) + (mine.guestUid ? `：${mine.guestName || "對手"}` : "");
    }

    const q = S.normalizeId(el.search.value);
    const shown = rooms.filter(r => !q || r.id.includes(q));
    el.count.textContent = rooms.length;
    el.list.textContent = "";
    shown.forEach(r => {
      const isMine = r.hostUid === uid;
      const inRoom = isMine || r.guestUid === uid;
      const full = !!r.guestUid;
      const card = mk("div", "room-card" + (isMine ? " is-mine" : ""));
      card.appendChild(mk("span", "room-code", r.id));
      const meta = mk("div", "room-meta");
      meta.appendChild(mk("strong", "", r.name || "未命名房間"));
      meta.appendChild(mk("span", "", `房主：${r.hostName || "玩家"}`));
      card.appendChild(meta);
      card.appendChild(mk("span", "pill " + (full ? "busy" : "open"), `${full ? 2 : 1}/2 ${full ? "對戰中" : "等待中"}`));
      const btn = mk("button", "btn sm" + (!full || inRoom ? " btn-primary" : ""), isMine ? "進入" : inRoom ? "回到房間" : full ? "已滿" : "加入");
      btn.type = "button";
      btn.disabled = full && !inRoom;
      btn.addEventListener("click", () => join(r.id));
      card.appendChild(btn);
      el.list.appendChild(card);
    });
    el.empty.hidden = shown.length > 0;
    if (!shown.length) el.empty.textContent = q ? "找不到這個房號" : "目前沒有房間，建立一間吧！";
  }

  async function join(id) {
    if (busy) return;
    busy = true; showErr("");
    try {
      const res = await S.joinRoom(id);
      if (res.ok) goRoom(id);
      else showErr(ERR[res.error] || "無法加入房間。");
    } finally { busy = false; }
  }

  el.createBox.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;
    busy = true; showErr(""); el.createBtn.disabled = true;
    try {
      const res = await S.createRoom(el.name.value);
      if (res.ok) goRoom(res.room.id);
      else showErr(ERR[res.error] || "建立失敗，請稍後再試。");
    } finally { busy = false; el.createBtn.disabled = false; }
  });

  el.enter.addEventListener("click", () => {
    const mine = rooms.find(r => r.hostUid === S.me().uid);
    if (mine) goRoom(mine.id);
  });

  // 刪除房間（二次確認）
  el.del.addEventListener("click", () => {
    const mine = rooms.find(r => r.hostUid === S.me().uid);
    if (!mine) return;
    el.confirmDesc.textContent = mine.guestUid
      ? `房間 ${mine.id} 正在對戰，刪除後對手會被請出房間。`
      : `房間 ${mine.id} 將被刪除。`;
    el.confirm.hidden = false;
    el.yes.focus();
  });
  el.no.addEventListener("click", () => { el.confirm.hidden = true; });
  el.confirm.addEventListener("click", e => { if (e.target === el.confirm) el.confirm.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") el.confirm.hidden = true; });
  el.yes.addEventListener("click", async () => {
    const mine = rooms.find(r => r.hostUid === S.me().uid);
    el.confirm.hidden = true;
    if (mine) await S.deleteRoom(mine.id);
  });

  el.search.addEventListener("input", () => { el.search.value = S.normalizeId(el.search.value); render(); });
  $("back").addEventListener("click", () => { location.href = "index.html"; });

  S.subscribeList(rows => { rooms = rows; render(); });
  try { MiniHub.onChange(render); } catch (e) { /* 忽略 */ }
})();
