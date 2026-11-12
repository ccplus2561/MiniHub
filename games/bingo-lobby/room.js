(() => {
  "use strict";

  // ===== 設定常數 =====
  const UID_KEY = "bingoLobby.uid";
  const MY_ROOM_KEY = "bingoLobby.myRoom";
  const DIR_KEY = "bingoLobby.dirStub";
  const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
  const ID_LEN = 6; // 房號：固定 6 碼數字
  const UID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // UID 用，去掉易混淆字元
  const UID_LEN = 6;
  const CHANNEL_PREFIX = "bingo-room-";

  // 訊息類型：主持端是唯一真相來源，其他角色只送請求、收快照
  const MSG = {
    HELLO: "hello", SNAPSHOT_REQ: "snapshot?", SNAPSHOT: "snapshot",
    DRAW: "draw", MARK: "mark", CLAIM: "claim", BYE: "bye",
  };

  // ===== 本機儲存 =====
  // 本頁資料只存在「這個分頁」的 sessionStorage（關閉分頁即消失）；
  // 房間目錄需要讓同瀏覽器的其他分頁看到，改放 localStorage（大廳離開網站時會自動清除）。
  function read(key, shared) {
    try { return JSON.parse((shared ? localStorage : sessionStorage).getItem(key)); } catch (e) { return null; }
  }
  function write(key, value, shared) {
    try { (shared ? localStorage : sessionStorage).setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
  }

  // ===== 房號 / UID =====
  // 房號：6 碼數字（只能數字）。預設隨機產生，也可自訂。
  function normalize(raw) {
    return String(raw == null ? "" : raw).replace(/\D/g, "").slice(0, ID_LEN);
  }
  function isValid(id) {
    return /^\d{6}$/.test(String(id));
  }
  function randomDigits(len) {
    const buf = new Uint32Array(len);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(buf, n => String(n % 10)).join("");
  }
  // 產生一組目前沒人使用的隨機房號
  function newRoomId() {
    const used = new Set(directory._all().map(r => r.id));
    let id = randomDigits(ID_LEN);
    for (let i = 0; i < 20 && used.has(id); i++) id = randomDigits(ID_LEN);
    return id;
  }

  // 每個人（每個分頁）一組 UID（只用來辨識房主，不對外顯示成房號）。日後換成 Firebase Auth 的 uid，只要改這個函式。
  function getUid() {
    let uid = read(UID_KEY);
    if (!/^[A-Z0-9]{6}$/.test(String(uid))) {
      const buf = new Uint32Array(UID_LEN);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
      else for (let i = 0; i < UID_LEN; i++) buf[i] = Math.floor(Math.random() * 4294967296);
      uid = Array.from(buf, n => UID_ALPHABET[n % UID_ALPHABET.length]).join("");
      write(UID_KEY, uid);
    }
    return uid;
  }

  // 主持端上次建立的房間（方便重新整理後回到同一間）
  function loadMyRoom() {
    const r = read(MY_ROOM_KEY);
    return r && isValid(r.id) && Date.now() - r.at < ROOM_TTL_MS ? r.id : "";
  }
  // 主持人已通過密碼驗證的房間（只存這個分頁；主持頁用它擋住直接開網址的人）
  const HOST_OK_KEY = "bingoLobby.hostOk";
  function allowHost(id) { write(HOST_OK_KEY, id); }
  function hostAllowed(id) { return read(HOST_OK_KEY) === id; }
  // 手機判斷：優先採用 MiniHub 首頁的裝置模式（body.m），沒有外層頁面時用 UA / 觸控 + 螢幕寬度判斷。主持僅限平板、電腦。
  function isPhone() {
    try { if (window.parent !== window && window.parent.document.body.classList.contains("m")) return true; } catch (e) { /* 跨網域：改用下面判斷 */ }
    const ua = navigator.userAgent || "";
    if (/iPhone|iPod|Android.*Mobile|Windows Phone|Mobile Safari/i.test(ua) && !/iPad|Tablet/i.test(ua)) return true;
    return window.matchMedia && matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 600;
  }
  function saveMyRoom(id) { write(MY_ROOM_KEY, { id, at: Date.now() }); }

  // ===== 密碼（選填，固定 5 碼英數）=====
  // 只存「加鹽的 SHA-256 雜湊」，不存明碼；這是大廳的入口門檻，不是高強度防護。
  const PW_LEN = 5;
  function normalizePw(raw) { return String(raw == null ? "" : raw).replace(/[^A-Za-z0-9]/g, "").slice(0, PW_LEN); }
  function pwOk(pw) { return pw === "" || new RegExp("^[A-Za-z0-9]{" + PW_LEN + "}$").test(pw); }
  async function hashPw(salt, pw) {
    if (!pw) return "";
    const text = salt + ":" + pw;
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "p" + text; }
  }
  const NAME_MAX = 20;   // 房間名稱：可中文 / 英數 / 符號，最多 20 字
  function normalizeName(raw) { return Array.from(String(raw == null ? "" : raw).replace(/[\r\n\t]+/g, " ").trim()).slice(0, NAME_MAX).join(""); }
  function newSalt() { return randomDigits(8); }
  async function verify(room, kind, pw) {   // kind: "host" | "room"
    const stored = kind === "host" ? room.hostPw : room.roomPw;
    if (!stored) return true;
    return (await hashPw(room.salt || "", pw)) === stored;
  }

  // ===== 房間目錄 =====
  // 已登入：同步到 Firestore（games/bingo-lobby/rooms/{房號}），不同裝置都看得到；
  // 訪客：不連線，只存本機 localStorage（同一個瀏覽器才看得到）。
  function cloud() {
    try {
      const A = window.parent !== window && window.parent.MiniHubAuth;
      return A && A.rooms && A.rooms.on() ? A.rooms : null;
    } catch (e) { return null; }
  }
  // 雲端呼叫逾時保護：連線卡住時不讓畫面一直沒反應
  const CLOUD_TIMEOUT_MS = 8000;
  const timeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), CLOUD_TIMEOUT_MS))]);
  // 房主身份：登入用帳號 uid，訪客用分頁 UID
  function ownerId() { const c = cloud(); return c ? c.uid() : getUid(); }
  const local = {
    _all() {
      const now = Date.now();
      return (read(DIR_KEY, true) || []).filter(r => r && isValid(r.id) && now - r.at < ROOM_TTL_MS);
    },
    save(rooms) { write(DIR_KEY, rooms, true); },
  };
  const directory = {
    _all() { return local._all(); },
    async list() {
      const c = cloud();
      let rows = local._all();
      if (c) {
        try {
          const remote = await timeout(c.list());
          if (remote) { const ids = new Set(remote.map(r => r.id)); rows = remote.concat(rows.filter(r => !ids.has(r.id))); }
        } catch (e) { /* 雲端失敗時只顯示本機 */ }
      }
      return rows.sort((a, b) => b.at - a.at);
    },
    async get(id) {
      const c = cloud();
      if (c) { try { const r = await timeout(c.get(id)); if (r) return r; } catch (e) { /* 改查本機 */ } }
      return local._all().find(r => r.id === id) || null;
    },
    // 同一房主可重複建立（＝回到自己的房間）；別人的房號不可佔用
    // pw = { host, room }：明碼只在這裡雜湊，之後不保留
    // pw = { host, room }：undefined = 沿用原本、"" = 清除、字串 = 設為新密碼（明碼只在這裡雜湊，之後不保留）
    // name = 房間名稱（undefined = 沿用原本）
    async create(id, pw, name) {
      if (!isValid(id)) return { ok: false, error: "invalid" };
      pw = pw || {};
      const me = ownerId();
      const old = await this.get(id);
      if (old && old.hostUid !== me) return { ok: false, error: "taken" };
      const salt = old && old.salt ? old.salt : newSalt();
      const hostPw = pw.host === undefined ? (old ? old.hostPw : "") : await hashPw(salt, pw.host);
      const roomPw = pw.room === undefined ? (old ? old.roomPw : "") : await hashPw(salt, pw.room);
      const nm = name === undefined ? (old ? old.name || "" : "") : normalizeName(name);
      const c = cloud();
      if (c) {
        try {
          const res = await timeout(c.create(id, { salt, hostPw, roomPw, name: nm }));
          if (res && !res.ok) return res;
        } catch (e) { return { ok: false, error: "cloud" }; }
      }
      const next = local._all().filter(r => r.id !== id);
      next.push({ id, hostUid: me, at: Date.now(), name: nm, salt, hostPw, roomPw });
      local.save(next);
      return { ok: true };
    },
    async remove(id) {
      const me = ownerId(), c = cloud();
      if (c) { try { await c.remove(id); } catch (e) { /* 忽略 */ } }
      local.save(local._all().filter(r => !(r.id === id && r.hostUid === me)));
    },
  };

  // ===== 入口網址：三種角色共用 room 參數 =====
  function buildUrl(base, id) {
    const sep = base.indexOf("?") >= 0 ? "&" : "?";
    return id ? `${base}${sep}room=${id}` : base;
  }
  function readParams(search) {
    const p = new URLSearchParams(search || window.location.search);
    const id = normalize(p.get("room"));
    return { room: isValid(id) ? id : "", role: p.get("role") || "", mode: p.get("mode") || "" };
  }

  // ===== 傳輸層（可抽換，目前 BroadcastChannel 僅同瀏覽器；同步之後再做）=====
  function connect({ code, role, clientId }) {
    const id = clientId || `${role}-${Math.random().toString(36).slice(2, 8)}`;
    const handlers = new Set();
    let seq = 0;
    let ch = null;
    try { ch = new BroadcastChannel(CHANNEL_PREFIX + code); } catch (e) { /* 空殼 */ }
    if (ch) {
      ch.onmessage = ev => {
        const m = ev.data;
        if (!m || m.room !== code || m.from === id) return;
        handlers.forEach(fn => { try { fn(m); } catch (e) { /* 忽略 */ } });
      };
    }
    function send(type, data) {
      const msg = { room: code, from: id, role, type, seq: ++seq, at: Date.now(), data: data === undefined ? null : data };
      if (ch) ch.postMessage(msg);
      return msg;
    }
    function on(fn) { handlers.add(fn); return () => handlers.delete(fn); }
    function close() { send(MSG.BYE); handlers.clear(); if (ch) ch.close(); }
    send(MSG.HELLO);
    return { id, code, role, send, on, close };
  }

  window.BingoRoom = {
    ID_LEN, PW_LEN, NAME_MAX, normalizeName, MSG, normalize, normalizePw, pwOk, verify, ownerId, isValid, newRoomId, getUid,
    loadMyRoom, saveMyRoom, isPhone, allowHost, hostAllowed, directory, buildUrl, readParams, connect,
  };
})();
