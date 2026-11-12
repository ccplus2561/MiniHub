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
    rooms: "選擇要加入的房間",
    role: "選擇進入的方式",
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
  const pickBtns = Array.from(document.querySelectorAll("[data-pick]"));
  const hostForm = $("hostForm");
  const hostRoomId = $("hostRoomId");
  const hostErr = $("hostErr");
  const hostResume = $("hostResume");
  const roomSearch = $("roomSearch");
  const roomList = $("roomList");
  const roomEmpty = $("roomEmpty");
  const hostPw = $("hostPw");
  const roomPw = $("roomPw");
  const roomPwRow = $("roomPwRow");
  const enterPw = $("enterPw");
  const enterErr = $("enterErr");

  // ===== 狀態 =====
  const state = {
    navigating: false,
    timer: 0,
    screen: "identity",
    role: "",     // 第一步選的身份：host | player | spectator
    pick: "",     // 選定房間後的角色：player | spectator
    roomId: "",
    rooms: [],
    room: null,   // 選定的房間資料
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
    else if (name === "role") (pickBtns.find(b => b.dataset.pick === state.pick) || pickBtns[0]).focus();
  }

  function goBack() {
    if (state.navigating) return;
    if (state.screen === "role") showScreen("rooms");
    else if (state.screen === "rooms" || state.screen === "host") showScreen("identity");
  }

  // ===== 步驟 1：選身份 =====
  function chooseRole(role) {
    if (state.navigating) return;
    state.role = role;
    sound.enter();
    if (role === "host") openHost();
    else openRooms();
  }

  // ===== 步驟 2（主持）：自訂房號 =====
  function openHost() {
    const mine = Room.loadMyRoom();
    hostRoomId.value = mine || Room.newRoomId();
    hostPw.value = "";
    roomPw.value = "";
    hostPw.disabled = false;
    hostErr.hidden = true;
    hostResume.hidden = !mine;
    hostResume.textContent = mine ? `繼續上次房間 ${mine}` : "";
    showScreen("host");
  }

  function showHostError(msg) {
    hostErr.textContent = msg;
    hostErr.hidden = false;
    hostRoomId.focus();
  }

  let creating = false;
  async function createRoom(id, resume) {
    if (creating || state.navigating) return;
    if (!Room.isValid(id)) {
      showHostError(`請輸入 ${Room.ID_LEN} 碼數字`);
      return;
    }
    const hp = Room.normalizePw(hostPw.value), rp = Room.normalizePw(roomPw.value);
    if (!Room.pwOk(hp) || !Room.pwOk(rp)) {
      showHostError(`密碼需為 ${Room.PW_LEN} 碼英數字，或留空不設定`);
      return;
    }
    creating = true;
    hostErr.hidden = true;
    const okBtn = hostForm.querySelector('[type="submit"]'), okTxt = okBtn.textContent;
    okBtn.disabled = true; okBtn.textContent = "建立中…";
    try {
      // 回到自己已有的房間：若設有主持人密碼，需先輸入
      const old = await Room.directory.get(id);
      if (old && old.hostUid === Room.ownerId() && old.hostPw && !(await Room.verify(old, "host", hp))) {
        showHostError("這間房間已設定主持人密碼，請在上方輸入正確的主持人密碼");
        return;
      }
      const res = await Room.directory.create(id, { set: !resume && !!(hp || rp), host: hp, room: rp });
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
    roomList.textContent = "";
    rows.forEach(r => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "room-item";
      btn.dataset.id = r.id;
      const id = document.createElement("span");
      id.className = "room-item__id";
      id.textContent = r.id;
      const meta = document.createElement("span");
      meta.className = "room-item__meta";
      meta.textContent = (r.roomPw ? "🔒 " : "") + (r.hostUid === Room.ownerId() ? "我的房間 · " : "") + timeAgo(r.at);
      btn.append(id, meta);
      li.appendChild(btn);
      roomList.appendChild(li);
    });
    roomEmpty.hidden = rows.length > 0;
    if (!rows.length) {
      roomEmpty.textContent = state.rooms.length ? "找不到符合的房間" : "目前還沒有人建立房間，請主持人先建立。";
    }
  }

  // ===== 步驟 3：選定房間 → 再選一次角色 =====
  function openRoleStep(id) {
    state.roomId = id;
    state.room = state.rooms.find(r => r.id === id) || null;
    roomPwRow.hidden = !(state.room && state.room.roomPw);
    enterPw.value = "";
    enterErr.hidden = true;
    state.pick = state.role === "spectator" ? "spectator" : "player";
    $("roleRoomId").textContent = id;
    renderPick();
    sound.enter();
    showScreen("role");
  }

  function renderPick() {
    pickBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pick === state.pick)));
  }

  async function enterRoom() {
    if (!state.roomId || !state.pick) return;
    const r = state.room;
    if (r && r.roomPw && !(await Room.verify(r, "room", Room.normalizePw(enterPw.value)))) {
      enterErr.textContent = "房間密碼不正確";
      enterErr.hidden = false;
      enterPw.focus();
      return;
    }
    go(state.pick, state.roomId);
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
    return state.screen === "identity" ? roleBtns : state.screen === "role" ? pickBtns : [];
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
    pickBtns.forEach(btn => {
      btn.addEventListener("click", () => { state.pick = btn.dataset.pick; renderPick(); sound.hover(); });
      btn.addEventListener("mouseenter", () => sound.hover());
    });
    hostRoomId.addEventListener("input", () => {
      hostRoomId.value = Room.normalize(hostRoomId.value);
      hostErr.hidden = true;
    });
    [hostPw, roomPw, enterPw].forEach(inp => inp.addEventListener("input", () => {
      inp.value = Room.normalizePw(inp.value);
      hostErr.hidden = true;
      enterErr.hidden = true;
    }));
    hostForm.addEventListener("submit", e => { e.preventDefault(); createRoom(Room.normalize(hostRoomId.value)); });
    hostResume.addEventListener("click", () => createRoom(Room.loadMyRoom(), true));
    roomSearch.addEventListener("input", () => {
      roomSearch.value = Room.normalize(roomSearch.value);
      renderRooms();
    });
    $("roomRefresh").addEventListener("click", refreshRooms);
    roomList.addEventListener("click", e => {
      const btn = e.target.closest(".room-item");
      if (btn) openRoleStep(btn.dataset.id);
    });
    $("enterBtn").addEventListener("click", enterRoom);
    backBtn.addEventListener("click", goBack);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", cancelNavigation); // 從上一頁返回時還原
  }

  // ===== 啟動 =====
  function init() {
    MiniHub.onPause(pause);
    bindInput();
    showScreen("identity");
  }

  init();
})();
