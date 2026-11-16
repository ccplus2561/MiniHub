/* OOXX 雙人連線：房間資料層
 * ─────────────────────────────────────────────────────────
 * 介面只透過 OOXXOnline 操作房間；實際儲存由 backend 決定。
 * 目前 backend = 本機版（localStorage + storage 事件，同瀏覽器多分頁可測試）。
 * 之後接 Firebase：只要在載入本檔之前（或之後、頁面使用前）設定 window.OOXXRemote，
 * 並實作下列介面，介面程式不用改。（Firestore 路徑建議：games/ooxx/rooms/{房號}，整份房間文件即 room 物件）
 *
 *   backend = {
 *     list()                   → Promise<room[]>
 *     get(id)                  → Promise<room|null>
 *     create(room)             → Promise<{ ok, error? }>      // 同 hostUid 已有房間要回 error:"owned"；房號重複回 "exists"
 *     update(id, fn)           → Promise<{ ok, room?, error? }> // 交易：fn(room) 回傳新 room，回傳 null = 放棄；房間不存在回 error:"gone"
 *     remove(id, uid)          → Promise<void>                // 僅房主可刪
 *     subscribe(id, cb)        → unsubscribe                  // cb(room|null)；null = 房間已被刪除
 *     subscribeList(cb)        → unsubscribe                  // cb(room[])
 *   }
 *
 * room = {
 *   id, name, hostUid, hostName, guestUid, guestName, at,
 *   status: "waiting" | "playing" | "over",
 *   game: { board[9], turn:"X"|"O", starter, round, scores:{X,O,draw}, over, winLine, rev }
 * }
 * 房主固定 X、加入者固定 O；每局輪流先手。
 */
(() => {
  "use strict";

  const ROOMS_KEY = "ooxx.online.rooms";
  const GUEST_KEY = "ooxx.online.guest";
  const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
  const ID_LEN = 6;
  const NAME_MAX = 20;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  // ===== 小工具 =====
  const other = s => (s === "X" ? "O" : "X");
  const isId = id => /^\d{6}$/.test(String(id));
  const normalizeId = raw => String(raw == null ? "" : raw).replace(/\D/g, "").slice(0, ID_LEN);
  const normalizeName = raw => Array.from(String(raw == null ? "" : raw).replace(/[\r\n\t]+/g, " ").trim()).slice(0, NAME_MAX).join("");
  const clone = o => JSON.parse(JSON.stringify(o));
  function randomDigits(n) {
    const buf = new Uint32Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(buf, v => String(v % 10)).join("");
  }
  function findWin(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { player: board[a], line };
    }
    return null;
  }
  const newGame = (starter, round, scores) => ({
    board: Array(9).fill(null), turn: starter, starter, round: round || 1,
    scores: scores || { X: 0, O: 0, draw: 0 }, over: false, winLine: null, rev: 0,
  });

  // ===== 身份：已登入用帳號 uid；未登入用「分頁」訪客碼（方便同一瀏覽器開兩個分頁測試）=====
  function me() {
    let p = {};
    try { p = (window.MiniHub && MiniHub.player()) || {}; } catch (e) { /* 忽略 */ }
    if (p.loggedIn && p.uid) return { uid: p.uid, name: normalizeName(p.name || p.displayName) || "玩家", loggedIn: true };
    let g = "";
    try { g = sessionStorage.getItem(GUEST_KEY) || ""; } catch (e) { /* 忽略 */ }
    if (!/^G\d{6}$/.test(g)) {
      g = "G" + randomDigits(6);
      try { sessionStorage.setItem(GUEST_KEY, g); } catch (e) { /* 忽略 */ }
    }
    return { uid: g, name: "訪客 " + g.slice(-4), loggedIn: false };
  }

  // ===== 本機 backend =====
  const local = (() => {
    const listeners = new Set();   // () => void
    const readAll = () => {
      let all = {};
      try { all = JSON.parse(localStorage.getItem(ROOMS_KEY) || "{}") || {}; } catch (e) { all = {}; }
      const now = Date.now();
      Object.keys(all).forEach(k => { if (!all[k] || now - all[k].at > ROOM_TTL_MS) delete all[k]; });
      return all;
    };
    const writeAll = all => {
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(all)); } catch (e) { /* 忽略 */ }
      listeners.forEach(fn => fn());   // 同分頁不會收到 storage 事件，自己通知
    };
    addEventListener("storage", e => { if (e.key === ROOMS_KEY) listeners.forEach(fn => fn()); });

    return {
      async list() { return Object.values(readAll()).sort((a, b) => b.at - a.at); },
      async get(id) { return readAll()[id] || null; },
      async create(room) {
        const all = readAll();
        if (all[room.id]) return { ok: false, error: "exists" };
        if (Object.values(all).some(r => r.hostUid === room.hostUid)) return { ok: false, error: "owned" };
        all[room.id] = room;
        writeAll(all);
        return { ok: true };
      },
      async update(id, fn) {
        const all = readAll();
        if (!all[id]) return { ok: false, error: "gone" };
        const next = fn(clone(all[id]));
        if (!next) return { ok: false, error: "rejected", room: all[id] };
        next.at = Date.now();
        all[id] = next;
        writeAll(all);
        return { ok: true, room: next };
      },
      async remove(id, uid) {
        const all = readAll();
        if (all[id] && all[id].hostUid === uid) { delete all[id]; writeAll(all); }
      },
      subscribe(id, cb) {
        let last = "";
        const fire = () => {
          const r = readAll()[id] || null;
          const s = JSON.stringify(r);
          if (s === last) return;
          last = s;
          cb(r ? clone(r) : null);
        };
        listeners.add(fire);
        fire();
        return () => listeners.delete(fire);
      },
      subscribeList(cb) {
        let last = "";
        const fire = () => {
          const rows = Object.values(readAll()).sort((a, b) => b.at - a.at);
          const s = JSON.stringify(rows);
          if (s === last) return;
          last = s;
          cb(rows);
        };
        listeners.add(fire);
        fire();
        return () => listeners.delete(fire);
      },
    };
  })();

  const be = () => window.OOXXRemote || local;

  // ===== 對外 API =====
  async function newRoomId() {
    const used = new Set((await be().list()).map(r => r.id));
    let id = randomDigits(ID_LEN);
    for (let i = 0; i < 30 && used.has(id); i++) id = randomDigits(ID_LEN);
    return id;
  }

  async function myRoom() {
    const u = me().uid;
    return (await be().list()).find(r => r.hostUid === u) || null;
  }

  // 建立房間：一個帳號只能有一間
  async function createRoom(name) {
    const m = me();
    if (await myRoom()) return { ok: false, error: "owned" };
    for (let i = 0; i < 5; i++) {
      const id = await newRoomId();
      const room = {
        id, name: normalizeName(name), hostUid: m.uid, hostName: m.name, guestUid: "", guestName: "",
        at: Date.now(), status: "waiting", game: newGame("X", 1),
      };
      const res = await be().create(room);
      if (res.ok) return { ok: true, room };
      if (res.error !== "exists") return res;
    }
    return { ok: false, error: "id" };
  }

  // 加入房間（房主 / 已在房內的人直接進入）
  async function joinRoom(id) {
    const m = me();
    const res = await be().update(id, room => {
      if (room.hostUid === m.uid || room.guestUid === m.uid) return room;
      if (room.guestUid) return null;
      room.guestUid = m.uid;
      room.guestName = m.name;
      room.status = "playing";
      room.game = newGame("X", 1);
      return room;
    });
    if (res.ok) return res;
    return { ok: false, error: res.error === "gone" ? "gone" : "full" };
  }

  // 加入者離開：釋出座位、對局重置
  async function leaveRoom(id) {
    const m = me();
    return be().update(id, room => {
      if (room.guestUid !== m.uid) return null;
      room.guestUid = ""; room.guestName = "";
      room.status = "waiting";
      room.game = newGame("X", 1);
      return room;
    });
  }

  async function deleteRoom(id) { return be().remove(id, me().uid); }

  // 落子：只有輪到自己、該格為空才成立（房主 = X、加入者 = O）
  async function move(id, i) {
    const m = me();
    return be().update(id, room => {
      const g = room.game;
      if (room.status !== "playing" || g.over || g.board[i]) return null;
      const mine = room.hostUid === m.uid ? "X" : room.guestUid === m.uid ? "O" : "";
      if (!mine || g.turn !== mine) return null;
      g.board[i] = mine;
      const win = findWin(g.board);
      if (win) { g.over = true; g.winLine = win.line; g.scores[win.player] += 1; room.status = "over"; }
      else if (g.board.every(Boolean)) { g.over = true; g.scores.draw += 1; room.status = "over"; }
      else g.turn = other(mine);
      g.rev += 1;
      return room;
    });
  }

  // 再來一局：結束後任一方可開始，先手輪流
  async function rematch(id) {
    const m = me();
    return be().update(id, room => {
      if (room.hostUid !== m.uid && room.guestUid !== m.uid) return null;
      if (!room.game.over || !room.guestUid) return null;
      const starter = other(room.game.starter);
      const rev = room.game.rev + 1;
      room.game = newGame(starter, room.game.round + 1, room.game.scores);
      room.game.rev = rev;
      room.status = "playing";
      return room;
    });
  }

  window.OOXXOnline = {
    ID_LEN, NAME_MAX, isId, normalizeId, normalizeName, findWin, other, me,
    list: () => be().list(),
    get: id => be().get(id),
    subscribe: (id, cb) => be().subscribe(id, cb),
    subscribeList: cb => be().subscribeList(cb),
    myRoom, createRoom, joinRoom, leaveRoom, deleteRoom, move, rematch,
  };
})();
