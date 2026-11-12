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
  function saveMyRoom(id) { write(MY_ROOM_KEY, { id, at: Date.now() }); }

  // ===== 房間目錄（暫時的本機替身，介面為 Promise，日後換 Firestore）=====
  // 換成 Firestore 時：list → 查 rooms 集合（依 at 排序）；create → 寫入 rooms/{id}；
  // remove → 刪文件；不用改大廳程式。
  // 目前只存在 localStorage，所以只有「同一個瀏覽器」看得到彼此建立的房間。
  const directory = {
    _all() {
      const now = Date.now();
      const rooms = (read(DIR_KEY, true) || []).filter(r => r && isValid(r.id) && now - r.at < ROOM_TTL_MS);
      return rooms;
    },
    async list() {
      return this._all().sort((a, b) => b.at - a.at);
    },
    // 同一 UID 可重複建立（＝回到自己的房間）；別人的房號不可佔用
    async create(id, hostUid) {
      if (!isValid(id)) return { ok: false, error: "invalid" };
      const rooms = this._all();
      const hit = rooms.find(r => r.id === id);
      if (hit && hit.hostUid !== hostUid) return { ok: false, error: "taken" };
      const next = rooms.filter(r => r.id !== id);
      next.push({ id, hostUid, at: Date.now() });
      write(DIR_KEY, next, true);
      return { ok: true };
    },
    async remove(id, hostUid) {
      write(DIR_KEY, this._all().filter(r => !(r.id === id && r.hostUid === hostUid)), true);
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
    ID_LEN, MSG, normalize, isValid, newRoomId, getUid,
    loadMyRoom, saveMyRoom, directory, buildUrl, readParams, connect,
  };
})();
