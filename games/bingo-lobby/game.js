(() => {
  "use strict";

  // ===== 設定常數 =====
  const NAV_DELAY_MS = 260;

  // 各角色的目的頁：改網址只要改這張表（房號由 room.js 統一附加 ?room=）
  const DEST = {
    solo:      "player/index.html?mode=solo",
    host:      "host/index.html?role=host",
    player:    "player/index.html?mode=multi&role=player",
    spectator: "host/index.html?role=spectator",
  };

  const SUBTITLE = {
    identity: "請先選擇你的身份",
    host: "自訂房間號碼，建立後讓大家加入",
    rooms: "點選房間即可直接進入",
  };

  // 身份畫面的鍵盤快速鍵
  const HOTKEYS = { "1": "host", "2": "player", "3": "spectator" };
  const ROLE_NAME = { host: "主持", player: "玩家", spectator: "旁觀" };

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  const Room = window.BingoRoom;
  const backBtn = $("backBtn");
  const screens = Array.from(document.querySelectorAll("[data-screen]"));
  const roleBtns = Array.from(document.querySelectorAll("[data-role]"));
  const hostForm = $("hostForm");
  const hostRoomId = $("hostRoomId");
  const hostErr = $("hostErr");
  const hostOwned = $("hostOwned"), ownedErr = $("ownedErr");
  const hostName = $("hostName"), hostCreate = $("hostCreate"), hostCancel = $("hostCancel");
  let editing = false;   // 修改自己房間的模式
  let mine = null;   // 我目前擁有的房間（一個帳號 / UID 同時只能有一間）
  const roomSearch = $("roomSearch");
  const roomList = $("roomList");
  const roomEmpty = $("roomEmpty");
  const roomPw = $("roomPw");
  const pwModal = $("pwModal"), enterPw = $("enterPw"), enterErr = $("enterErr");

  // ===== 狀態 =====
  const state = {
    navigating: false,
    timer: 0,
    screen: "identity",
    role: "",     // 第一步選的身份：host | player | spectator
    rooms: [],
    room: null,   // 等待輸入密碼的房間資料
  };

  // ===== 音效（Proxy，失敗不影響流程）=====
  const sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      try {
        const fn = window.GameAudio && window.GameAudio[name];
        if (typeof fn === "function") fn(...args);
      } catch (e) { /* 忽略音效錯誤 */ }
    },
  });

  // ===== 大廳整合（SDK；單獨開啟時全部有安全預設值）=====
  function pause() {
    cancelNavigation();
    sound.suspend();
  }

  // ===== 畫面切換 =====
  function showScreen(name) {
    state.screen = name;
    screens.forEach(s => { s.hidden = s.dataset.screen !== name; });
    backBtn.hidden = name === "identity";
    $("subtitle").textContent = SUBTITLE[name];
    focusFirst(name);
  }

  function focusFirst(name) {
    if (name === "identity") roleBtns[0].focus();
    else if (name === "host") hostRoomId.focus();
    else if (name === "rooms") roomSearch.focus();
  }

  function goBack() {
    if (state.navigating) return;
    if (!pwModal.hidden) closePw();
    else if (state.screen === "rooms" || state.screen === "host") showScreen("identity");
  }

  function toast(msg) {
    if (window.parent !== window && window.parent.MiniHubToast) { try { window.parent.MiniHubToast(msg); return; } catch (e) { /* 改用下方提示 */ } }
    const sub = $("subtitle"); if (sub) sub.textContent = msg;
  }

  // ===== 步驟 1：選身份 =====
  function chooseRole(role) {
    if (state.navigating) return;
    if (role === "host" && Room.isPhone()) { sound.hover(); toast("主持僅限平板、電腦使用，手機請改用「玩家」或「旁觀」。"); return; }
    state.role = role;
    sound.enter();
    if (role === "host") openHost();
    else openRooms();
  }

  // ===== 步驟 2（主持）：自訂房號 =====
  async function findMine() {
    let rows = [];
    try { rows = await Room.directory.list(); } catch (e) { /* 忽略 */ }
    const me = Room.ownerId();
    return rows.find(r => r.hostUid === me) || null;
  }

  function setEditMode(on) {
    editing = on;
    hostRoomId.disabled = on;
    hostCancel.hidden = !on;
    hostCreate.textContent = on ? "儲存修改" : "建立並進入";
    $("clrRoomPwRow").hidden = !on;
    $("clrRoomPw").checked = false;
    roomPw.placeholder = on ? "不修改請留空" : "不設定可留空";
    $("gHost").textContent = on ? "修改房間" : "建立房間";
  }

  async function openHost() {
    setEditMode(false);
    hostName.value = "";
    hostRoomId.value = Room.newRoomId();
    roomPw.value = "";
    hostErr.hidden = true;
    ownedErr.hidden = true;
    hostForm.hidden = true; hostOwned.hidden = true;
    showScreen("host");
    mine = await findMine();
    if (state.screen !== "host") return;
    if (mine) {
      $("ownedId").textContent = mine.id;
      const on = $("ownedName"); on.hidden = !mine.name; on.textContent = mine.name ? "房間名稱：" + mine.name : "";
      hostOwned.hidden = false;
    } else {
      hostForm.hidden = false;
      hostRoomId.focus();
    }
  }

  async function ownedAction(act) {
    const del = act === "delete";
    if (!mine || state.navigating) return;
    ownedErr.hidden = true;
    try {
      if (del) {
        await Room.directory.remove(mine.id);
        clearHostSave();   // 房間刪除後，一併清除雲端上的抽號進度
        try { sessionStorage.removeItem("bingoLobby.myRoom"); } catch (e) { /* 忽略 */ }
        sound.enter();
        openHost();
      } else if (act === "edit") {
        setEditMode(true);
        hostRoomId.value = mine.id;
        hostName.value = mine.name || "";
        roomPw.value = ""; hostErr.hidden = true;
        hostOwned.hidden = true; hostForm.hidden = false;
        hostName.focus();
      } else {
        Room.saveMyRoom(mine.id);
        go("host", mine.id);
      }
    } catch (e) {
      ownedErr.textContent = "操作失敗，請稍後再試"; ownedErr.hidden = false;
    }
  }

  function showHostError(msg) {
    hostErr.textContent = msg;
    hostErr.hidden = false;
    hostRoomId.focus();
  }

  let creating = false;
  async function createRoom(id) {
    if (creating || state.navigating) return;
    if (!Room.isValid(id)) {
      showHostError(`請輸入 ${Room.ID_LEN} 碼數字`);
      return;
    }
    const rp = Room.normalizePw(roomPw.value);
    if (!Room.pwOk(rp)) {
      showHostError(`密碼需為 ${Room.PW_LEN} 碼英數字，或留空不設定`);
      return;
    }
    const nm = Room.normalizeName(hostName.value);
    creating = true;
    hostErr.hidden = true;
    const okBtn = $("hostCreate"), okTxt = okBtn.textContent;
    okBtn.disabled = true; okBtn.textContent = "建立中…";
    try {
      if (editing) {
        const pw = { room: $("clrRoomPw").checked ? "" : rp || undefined };
        const r = await Room.directory.create(id, pw, nm);
        if (!r.ok) { showHostError("儲存失敗，請稍後再試"); return; }
        sound.enter();
        await openHost();
        return;
      }
      const owned = await findMine();
      if (owned && owned.id !== id) { showHostError(`你已有房間 ${owned.id}，需先刪除才能再建立新房間`); openHost(); return; }
      const res = await Room.directory.create(id, { room: rp }, nm);
      if (!res.ok) {
        showHostError(res.error === "taken" ? "這個房號已被別人使用，請換一個" : res.error === "cloud" ? "雲端同步失敗或逾時，請檢查網路後再試" : "無法建立房間，請稍後再試");
        return;
      }
      Room.saveMyRoom(id);
      go("host", id);
    } catch (e) {
      showHostError("建立房間失敗，請稍後再試");
    } finally {
      creating = false;
      okBtn.disabled = false; okBtn.textContent = okTxt;
    }
  }

  // ===== 步驟 2（玩家 / 旁觀）：房間清單 =====
  async function openRooms() {
    roomSearch.value = "";
    state.rooms = [];
    showScreen("rooms");
    await refreshRooms();
  }

  async function refreshRooms() {
    try {
      state.rooms = await Room.directory.list();
    } catch (e) {
      state.rooms = [];
    }
    renderRooms();
  }

  function timeAgo(at) {
    const min = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (min < 1) return "剛剛建立";
    if (min < 60) return `${min} 分鐘前建立`;
    return `${Math.floor(min / 60)} 小時前建立`;
  }

  function renderRooms() {
    const q = Room.normalize(roomSearch.value);
    const rows = state.rooms.filter(r => !q || r.id.indexOf(q) >= 0);
    const me = Room.ownerId();
    roomList.textContent = "";
    rows.forEach(r => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "room-card" + (r.roomPw ? " is-locked" : "");
      btn.dataset.id = r.id;
      btn.setAttribute("aria-label", `${state.role === "spectator" ? "旁觀" : "加入"}房間 ${r.name || r.id}`);
      const top = document.createElement("span");
      top.className = "room-card__top";
      const badge = document.createElement("span");
      badge.className = "room-card__badge";
      badge.textContent = r.hostUid === me ? "我的房間" : "開放中";
      const lock = document.createElement("span");
      lock.className = "room-card__lock";
      lock.textContent = r.roomPw ? "🔒" : "";
      top.append(badge, lock);
      const name = document.createElement("span");
      name.className = "room-card__name";
      name.textContent = r.name || "未命名房間";
      const id = document.createElement("span");
      id.className = "room-card__id";
      id.textContent = r.id;
      const meta = document.createElement("span");
      meta.className = "room-card__meta";
      meta.textContent = timeAgo(r.at);
      const go = document.createElement("span");
      go.className = "room-card__go";
      go.textContent = state.role === "spectator" ? "👀 旁觀" : "🎴 加入";
      btn.append(top, name, id, meta, go);
      roomList.appendChild(btn);
    });
    roomEmpty.hidden = rows.length > 0;
    if (!rows.length) {
      roomEmpty.textContent = state.rooms.length ? "找不到符合的房間" : "目前還沒有人建立房間，請主持人先建立。";
    }
  }

  // ===== 點房間卡 → 直接進入（有房間密碼才先詢問）=====
  function pickRoom(id) {
    if (state.navigating) return;
    const r = state.rooms.find(x => x.id === id);
    if (!r) return;
    if (r.roomPw && r.hostUid !== Room.ownerId()) { openPw(r); return; }
    go(state.role === "spectator" ? "spectator" : "player", id);
  }

  function openPw(r) {
    state.room = r;
    $("pwRoom").textContent = (r.name ? r.name + " · " : "") + "房號 " + r.id;
    enterPw.value = "";
    enterErr.hidden = true;
    pwModal.hidden = false;
    sound.enter();
    enterPw.focus();
  }

  function closePw() {
    pwModal.hidden = true;
    state.room = null;
  }

  async function submitPw() {
    const r = state.room;
    if (!r) return;
    if (!(await Room.verify(r, Room.normalizePw(enterPw.value)))) {
      enterErr.textContent = "房間密碼不正確";
      enterErr.hidden = false;
      enterPw.focus();
      return;
    }
    const id = r.id;
    closePw();
    go(state.role === "spectator" ? "spectator" : "player", id);
  }

  // 刪除房間時一併清除雲端抽號存檔（主持端存檔路徑與房間無關，只跟帳號有關）
  function clearHostSave() {
    try {
      const c = MiniHub.cloud && MiniHub.cloud("bingo-lobby");
      if (c && c.available()) { c.save({ v: 1, playing: false }); c.flush(); }
    } catch (e) { /* 忽略 */ }
  }

  // ===== 前往遊戲頁 =====
  function go(kind, roomId) {
    if (state.navigating || !DEST[kind]) return;
    state.navigating = true;
    sound.enter();
    const url = Room.buildUrl(DEST[kind], roomId);
    state.timer = window.setTimeout(() => {
      window.location.href = url;
    }, NAV_DELAY_MS);
  }

  function cancelNavigation() {
    window.clearTimeout(state.timer);
    state.navigating = false;
  }

  // ===== 輸入 =====
  function currentButtons() {
    return state.screen === "identity" && pwModal.hidden ? roleBtns : [];
  }

  function moveFocus(step) {
    const list = currentButtons();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement);
    const next = current < 0 ? 0 : current + step;
    if (next < 0 || next >= list.length) return;
    list[next].focus();
    sound.hover();
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!MiniHub.kbdOn()) return;
    if (window.BingoGate && BingoGate.blocked()) return;   // 未登入：鍵盤不作用
    if (e.key === "Escape") { goBack(); return; }
    if (!pwModal.hidden) return;
    if (state.screen === "identity" && HOTKEYS[e.key]) {
      e.preventDefault();
      chooseRole(HOTKEYS[e.key]);
      return;
    }
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (step !== undefined && currentButtons().length) {
      e.preventDefault();
      moveFocus(step);
    }
  }

  function bindInput() {
    roleBtns.forEach(btn => {
      btn.addEventListener("click", () => chooseRole(btn.dataset.role));
      btn.addEventListener("mouseenter", () => sound.hover());
    });
    hostRoomId.addEventListener("input", () => {
      hostRoomId.value = Room.normalize(hostRoomId.value);
      hostErr.hidden = true;
    });
    [roomPw, enterPw].forEach(inp => inp.addEventListener("input", () => {
      inp.value = Room.normalizePw(inp.value);
      hostErr.hidden = true;
      enterErr.hidden = true;
    }));
    // 外層頁面的 iframe 沒開 allow-forms，表單 submit 會被瀏覽器靜默擋掉，所以改用按鈕 click / Enter 自行處理
    const submitHost = () => createRoom(Room.normalize(hostRoomId.value));
    hostForm.addEventListener("submit", e => e.preventDefault());
    $("hostCreate").addEventListener("click", submitHost);
    [hostRoomId, hostName, roomPw].forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitHost(); } }));
    $("ownedEnter").addEventListener("click", () => ownedAction("enter"));
    $("ownedEdit").addEventListener("click", () => ownedAction("edit"));
    hostCancel.addEventListener("click", () => openHost());
    $("ownedDelete").addEventListener("click", () => ownedAction("delete"));
    roomSearch.addEventListener("input", () => {
      roomSearch.value = Room.normalize(roomSearch.value);
      renderRooms();
    });
    $("roomRefresh").addEventListener("click", refreshRooms);
    roomList.addEventListener("click", e => {
      const btn = e.target.closest(".room-card");
      if (btn) pickRoom(btn.dataset.id);
    });
    $("pwOk").addEventListener("click", submitPw);
    $("pwCancel").addEventListener("click", closePw);
    enterPw.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitPw(); } });
    backBtn.addEventListener("click", goBack);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", cancelNavigation); // 從上一頁返回時還原
  }

  // ===== 啟動 =====
  function init() {
    if (Room.isPhone()) {   // 手機：主持鈕停用並標示
      const hb = document.querySelector('[data-role="host"]');
      if (hb) { hb.classList.add("is-disabled"); hb.setAttribute("aria-disabled", "true"); const t = hb.querySelector(".mode-btn__tag"); if (t) t.textContent = "僅限平板 / 電腦"; }
    }
    MiniHub.onPause(pause);
    bindInput();
    showScreen("identity");
  }

  init();
})();
