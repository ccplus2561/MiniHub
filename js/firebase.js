// Firebase 整合：Google / GitHub / 帳號密碼 登入（含同 email 帳號連結）+ 玩家資料（使用者名稱 / 遊戲 UID）
// 登入後會保存：帳號資料、隱私設定，以及 prefs（動畫效果、遊戲全螢幕、語言、音效、操作）；圖卡大小、顯示模式不保存。
// 未登入時完全不連線：Firebase SDK 只在「按下登入」或「分頁內已有登入狀態」時才載入。

// 總開關：false = 不寫入 / 不讀取 Firestore（每次登入都視為首次登入）
const SAVE_PROFILE = true;

const firebaseConfig = {
  apiKey: "AIzaSyD_-2fhVRM-cDlCP8a6NweD99Gkwk5iaz8",
  authDomain: "minihub-2f1d9.firebaseapp.com",
  projectId: "minihub-2f1d9",
  storageBucket: "minihub-2f1d9.firebasestorage.app",
  messagingSenderId: "510418849193",
  appId: "1:510418849193:web:c5ee0c48af80dbd9ce88b8"
};
const BASE = "https://www.gstatic.com/firebasejs/10.14.1/";

// 本次開啟網頁、這台裝置的讀寫次數（估算；不是專案總用量）
const use = { reads: 0, writes: 0 };
const bump = (r, w) => { use.reads += r; use.writes += w; document.dispatchEvent(new CustomEvent("minihub:usage")); };
const emit = detail => document.dispatchEvent(new CustomEvent("minihub:auth", { detail }));
const ms = t => (t && t.toMillis ? t.toMillis() : null);
const norm = d => ({ name: d.name, gameUid: d.gameUid, email: d.email, createdAt: ms(d.createdAt), nameChangedAt: ms(d.nameChangedAt), lastLoginAt: ms(d.lastLoginAt), publicName: typeof d.publicName === "boolean" ? d.publicName : null, joinRank: typeof d.joinRank === "boolean" ? d.joinRank : null, prefs: d.prefs && typeof d.prefs === "object" ? d.prefs : null,
  mPoints: Number(d.mPoints) || 0, streak: Number(d.streak) || 0, totalCheckins: Number(d.totalCheckins) || 0, lastCheckinAt: ms(d.lastCheckinAt) });

// 「上次登入」：每次新的登入（分頁關閉後重開 / 登出後再登入）記錄一次；畫面顯示的是「這次登入之前」的那一次
const SS = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; };
const prevFromSession = uid => { const v = SS("mh_prev_" + uid); return v ? Number(v) : null; };

// 這個分頁是否已有 Firebase 登入狀態（有才需要在開啟網頁時載入 SDK 並還原登入）
const hasSession = () => {
  try { for (let i = 0; i < sessionStorage.length; i++) if ((sessionStorage.key(i) || "").startsWith("firebase:authUser:")) return true; } catch (e) {}
  return false;
};

/* ---------- 登入供應商 ---------- */
const PROV = {
  google:    { label: "Google" },
  github:    { label: "GitHub" }
};
function makeProvider(f, key) {
  if (key === "github") { const p = new f.GithubAuthProvider(); p.addScope("user:email"); return p; }
  return new f.GoogleAuthProvider();
}
function credFromError(f, key, e) {
  const C = key === "github" ? f.GithubAuthProvider : f.GoogleAuthProvider;
  return C.credentialFromError(e);
}
let pending = null;   // 等待連結的憑證（只存在記憶體）

/* ---------- 帳號密碼（不需要電子郵件、不驗證、無法找回密碼） ----------
   Firebase 的「電子郵件/密碼」一定要 email 格式 → 把帳號名稱（NFKC + 小寫）轉成「不會寄信的內部 email」，Authentication 後台可直接辨識：
     英數與 - 原樣保留：Alice-01 → alice-01@minihub.github
     其他字元（中文、符號、底線）→ _編碼_：小明 → _1a8z__1n5c_@minihub.github（編碼 = Unicode 碼位的 36 進位）
     若編碼後超過 64 字元（極少見的長中文名）→ _h_ + 雜湊，仍保證不重複。
   Firebase 保證 email 不重複 = 帳號名稱不重複（不分大小寫）。注意：更換 ACCT_DOMAIN 或編碼規則，舊帳號會無法登入。
   若 Firebase 拒絕此網域（auth/invalid-email），只需改 ACCT_DOMAIN。 */
const ACCT_DOMAIN = "@minihub.github";
const acctKey = s => String(s || "").normalize("NFKC").trim().toLowerCase();
async function acctEmail(name) {
  const key = acctKey(name);
  let local = "";
  for (const ch of key) local += /^[a-z0-9-]$/.test(ch) ? ch : "_" + ch.codePointAt(0).toString(36) + "_";
  if (!local || local.length > 64 || /^-|-$/.test(local)) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("minihub:" + key));
    local = "_h_" + Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  }
  return local + ACCT_DOMAIN;
}
const provKey = u => { const p = ((u && u.providerData || [])[0] || {}).providerId; return p === "github.com" ? "github" : p === "google.com" ? "google" : "password"; };
const isPwUser = u => !!u && (u.providerData || []).some(p => p.providerId === "password");
let gate = null;   // 帳號密碼登入時，等「大小寫是否與註冊時一致」檢查完才讓 onAuthStateChanged 繼續
let regName = "";   // 剛註冊時，displayName 還沒寫入前先用這個顯示帳號名稱
const bad = code => Object.assign(new Error(code), { code });
const load = async () => { try { return await boot(); } catch (e) { throw Object.assign(new Error("sdk-load-failed"), { code: "sdk-load-failed" }); } };

/* ---------- 延遲載入 SDK ---------- */
let F = null, bootP = null;
function boot() {
  if (bootP) return bootP;
  bootP = (async () => {
    const [A, S, FS] = await Promise.all([
      import(BASE + "firebase-app.js"), import(BASE + "firebase-auth.js"), import(BASE + "firebase-firestore.js")
    ]);
    const app = A.initializeApp(firebaseConfig);
    const auth = S.getAuth(app), db = FS.getFirestore(app);
    try { await S.setPersistence(auth, S.browserSessionPersistence); } catch (e) {}   // 登入狀態只保留到分頁關閉
    F = { auth, db, ...S, ...FS };
    S.onAuthStateChanged(auth, async user => {
      if (!user) return emit({ user: null });
      const g = gate;
      if (g && !(await g)) return;   // 大小寫不符：已在 signInPw 內登出，這裡不處理
      if (!user.email) {   // 帳號必須有電子郵件（例如 GitHub 設為私人且無公開信箱時會沒有）
        emit({ user: null });
        try { await S.signOut(auth); } catch (e) {}
        if (window.MiniHubToast) window.MiniHubToast("此帳號沒有可用的電子郵件，無法登入，請改用其他方式");
        return;
      }
      const u = { uid: user.uid, email: user.email, photoURL: user.photoURL || "", account: isPwUser(user) ? (user.displayName || regName || "帳號") : "", provider: provKey(user) };
      try {
        const profile = await loadProfile(user.uid);
        if (profile) profile.prevLoginAt = await recordLogin(user.uid, profile);
        emit({ user: u, profile });
      }
      catch (error) { emit({ user: u, error }); }
    });
    return F;
  })();
  bootP.catch(() => { bootP = null; });   // 載入失敗（例如離線）→ 下次可重試
  return bootP;
}

async function recordLogin(uid, profile) {
  if (SS("mh_logged_" + uid)) return prevFromSession(uid);        // 同一次登入內重新整理，不重複記錄
  const prev = (profile && profile.lastLoginAt) || null;
  SS("mh_logged_" + uid, "1"); SS("mh_prev_" + uid, prev ? String(prev) : "");
  if (SAVE_PROFILE) {
    try { bump(0, 1); await F.updateDoc(F.doc(F.db, "users", uid), { lastLoginAt: F.serverTimestamp() }); } catch (e) {}   // 規則不允許時略過，不影響登入
  }
  return prev;
}

async function loadProfile(authUid) {
  if (!SAVE_PROFILE) return null;
  bump(1, 0);
  const snap = await F.getDoc(F.doc(F.db, "users", authUid));
  if (!snap.exists()) return null;
  const p = norm(snap.data());
  p.prevLoginAt = prevFromSession(authUid);
  return p;
}

// 註冊帳號首次登入（建立玩家資料）贈送 10 M 點
const SIGNUP_BONUS = 10;
// 建立玩家資料：users/{authUid} 與 uids/{gameUid} 在同一筆交易寫入（UID 唯一、只能建立一次）
async function createProfile({ name, gameUid, publicName, joinRank, prefs }) {
  const user = F && F.auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  if (!SAVE_PROFILE) return { name, gameUid, email: user.email, createdAt: Date.now(), nameChangedAt: null };
  bump(2, 2);
  await F.runTransaction(F.db, async tx => {
    const uRef = F.doc(F.db, "users", user.uid), idRef = F.doc(F.db, "uids", gameUid);
    if ((await tx.get(uRef)).exists()) throw Object.assign(new Error("already"), { code: "already-has-profile" });
    if ((await tx.get(idRef)).exists()) throw Object.assign(new Error("taken"), { code: "uid-taken" });
    tx.set(idRef, { owner: user.uid });
    tx.set(uRef, { name, gameUid, email: user.email, createdAt: F.serverTimestamp(), publicName: !!publicName, joinRank: !!joinRank, mPoints: SIGNUP_BONUS, streak: 0, totalCheckins: 0, ...(prefs ? { prefs } : {}) });
  });
  // 交易已成功＝資料已建立；之後的讀取失敗（規則 / 網路）不應讓畫面顯示「建立失敗」
  try { await recordLogin(user.uid, null); } catch (e) {}          // 首次登入也記一筆，下次登入時才有「上次」可顯示
  try { return await loadProfile(user.uid); }
  catch (e) { return { name, gameUid, email: user.email, createdAt: Date.now(), nameChangedAt: null, publicName: !!publicName, joinRank: !!joinRank, prefs: prefs || null, prevLoginAt: null, mPoints: SIGNUP_BONUS, streak: 0, totalCheckins: 0, lastCheckinAt: null }; }
}

// 變更使用者名稱：14 天限制由 Firestore 規則強制，前端只負責顯示
async function updateName(name, current) {
  const user = F && F.auth.currentUser;
  if (!SAVE_PROFILE) return { ...current, name, nameChangedAt: Date.now() };
  bump(0, 1);
  await F.updateDoc(F.doc(F.db, "users", user.uid), { name, nameChangedAt: F.serverTimestamp() });
  return loadProfile(user.uid);
}

// 設定 > 隱私：允許公開使用者名稱（僅登入後同步；訪客不連線）
async function setPublicName(v) {
  const user = F && F.auth.currentUser;
  if (!user || !SAVE_PROFILE) return;
  bump(0, 1);
  await F.updateDoc(F.doc(F.db, "users", user.uid), { publicName: !!v });
}

// 同步偏好設定（動畫 / 全螢幕 / 語言 / 音效 / 操作）；僅登入後寫入，訪客不連線
async function savePrefs(prefs) {
  const user = F && F.auth.currentUser;
  if (!user || !SAVE_PROFILE) return;
  bump(0, 1);
  await F.updateDoc(F.doc(F.db, "users", user.uid), { prefs });
}

// 設定 > 隱私：允許加入排行榜（僅登入後同步；訪客不連線）
async function setJoinRank(v) {
  const user = F && F.auth.currentUser;
  if (!user || !SAVE_PROFILE) return;
  bump(0, 1);
  await F.updateDoc(F.doc(F.db, "users", user.uid), { joinRank: !!v });
}

// 每日簽到：以台灣時間（UTC+8）的日曆日為準，每天 00:00 換日。
// 規則：每日簽到 +1 M；隔天接著簽 = streak + 1，中斷過 = 重設為 1；連續天數有額外點數 = 連續天數 × 0.5（保留小數）。
//   獎勵 = 1 + streak × 0.5，例：第 1 天 +1.5、第 2 天 +2、第 3 天 +2.5、第 4 天 +3、第 10 天 +6。
// 用交易讀最新資料再寫入（多裝置不會算錯）；日期 / 數值是否正確由 Firestore 規則（以伺服器時間）強制檢查。
const TW_DAY = t => Math.floor((t + 8 * 3600000) / 864e5);
async function checkin() {
  const user = F && F.auth.currentUser;
  if (!user) throw bad("not-signed-in");
  if (!SAVE_PROFILE) throw bad("save-disabled");
  const ref = F.doc(F.db, "users", user.uid);
  bump(1, 1);
  const out = await F.runTransaction(F.db, async tx => {
    const s = await tx.get(ref);
    if (!s.exists()) throw bad("no-profile");
    const d = s.data(), last = ms(d.lastCheckinAt), today = TW_DAY(Date.now());
    if (last !== null && TW_DAY(last) >= today) throw bad("already-checked-in");
    const streak = last !== null && TW_DAY(last) === today - 1 ? (Number(d.streak) || 0) + 1 : 1;
    const reward = 1 + streak * 0.5;
    const r = { mPoints: (Number(d.mPoints) || 0) + reward, streak, totalCheckins: (Number(d.totalCheckins) || 0) + 1 };
    tx.update(ref, { ...r, lastCheckinAt: F.serverTimestamp() });
    return { ...r, reward, lastCheckinAt: Date.now() };
  });
  return out;
}

// 修改密碼（僅帳號密碼登入）：先用舊密碼重新驗證，再更新
async function changePassword(oldPw, newPw) {
  const user = F && F.auth.currentUser;
  if (!user || !isPwUser(user)) throw bad("not-password-user");
  if (!oldPw) throw bad("password-required");
  if (typeof newPw !== "string" || newPw.length < 8 || newPw.length > 64 || !/^[\x21-\x7E]+$/.test(newPw)) throw bad("invalid-input");
  await F.reauthenticateWithCredential(user, F.EmailAuthProvider.credential(user.email, oldPw));
  await F.updatePassword(user, newPw);
}

// 刪除帳號：先重新驗證（刪除帳號需要「最近登入」）→ 刪 Firestore 玩家資料（users + uids）→ 刪登入帳號
async function deleteAccount(pw) {
  const user = F && F.auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  if (isPwUser(user)) {   // 帳號密碼：用密碼重新驗證
    if (!pw) throw bad("password-required");
    await F.reauthenticateWithCredential(user, F.EmailAuthProvider.credential(user.email, pw));
  } else {
    const pid = ((user.providerData[0] || {}).providerId) || "google.com";
    await F.reauthenticateWithPopup(user, makeProvider(F, pid === "github.com" ? "github" : "google"));   // 需在點擊後立即呼叫，才不會被瀏覽器擋彈窗
  }
  if (SAVE_PROFILE) {
    bump(1, 6);
    const snap = await F.getDoc(F.doc(F.db, "users", user.uid));
    const batch = F.writeBatch(F.db);
    if (snap.exists() && snap.data().gameUid) batch.delete(F.doc(F.db, "uids", snap.data().gameUid));
    batch.delete(F.doc(F.db, "users", user.uid));
    // 一併清掉所有「有排行榜（games.js 宣告 board）」的遊戲成績 / 排行榜（含各模式）
    (window.GAMES || []).filter(x => x.board).forEach(x => (Array.isArray(x.board.modes) && x.board.modes.length ? x.board.modes : [""]).forEach(m => {
      if (m && !MODE_OK.test(m)) return;
      batch.delete(F.doc(colB(x.id, m), user.uid)); batch.delete(F.doc(colR(x.id, m), user.uid));
    }));
    await batch.commit();
    // 雲端存檔（盡力刪除；規則尚未開放時略過，不影響刪除帳號）
    for (const x of (window.GAMES || []).filter(x => x.tags && x.tags.cloud)) { try { await F.deleteDoc(F.doc(F.db, "games", x.id, "saves", user.uid)); } catch (e) {} }
  }
  SS("mh_logged_" + user.uid, null); SS("mh_prev_" + user.uid, null);
  // 資料已先清除；刪登入帳號失敗（網路等）時重試一次，仍失敗就丟出明確錯誤，讓畫面提示再按一次
  try { await F.deleteUser(user); }
  catch (e) {
    try { await F.deleteUser(user); }
    catch (e2) { throw Object.assign(new Error("account-delete-failed"), { code: "account-delete-failed" }); }
  }   // 之後 onAuthStateChanged 會回報已登出
}

// 伺服器狀態檢查：向 Firestore 讀一次；只要伺服器有回應（含被規則拒絕）就代表連得上。未登入不連線。
async function ping() {
  if (!F || !F.auth.currentUser) return { skipped: true };
  const t0 = performance.now();
  bump(1, 0);
  try {
    await Promise.race([
      F.getDoc(F.doc(F.db, "uids", "_ping")),
      new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), 8000))
    ]);
  } catch (e) {
    if (!e || (e.code !== "permission-denied" && e.code !== "not-found"))
      return { ok: false, code: (e && (e.code || e.message)) || "unknown" };
  }
  return { ok: true, ms: Math.round(performance.now() - t0) };
}

/* ---------- 遊戲成績 / 排行榜 ----------
   games/{game}/bests/{uid}  個人最高（只有本人可讀寫）：{ score, inRank, name }
   games/{game}/ranks/{uid}  排行榜（登入者可讀、本人可寫）：{ score, name, updatedAt }；name 寫入時就已依「公開使用者名稱」遮蔽 */
const NOP = () => {};
// ---- 排行榜 / 個人最高：通用存取。每款遊戲在 js/games.js 用 board 欄位宣告規格，這裡不需要為新遊戲改動 ----
//   board: { order: "desc" | "asc"（desc = 越高越好，asc = 越低越好）, unit: "分", max: 最大合理值（選填，超過不寫入）,
//            modes: ["easy","hard"]（選填，每個模式各一份排行榜；第一個為預設，名稱限小寫英數）, fields: ["level"]（選填，允許附帶儲存的額外欄位）}
// 資料路徑：games/{id}/bests[_模式]/{uid} 與 games/{id}/ranks[_模式]/{uid}（沒有 modes 時沒有後綴）
const gameSpec = g => { try { const x = (window.GAMES || []).find(v => v.id === g); return x && x.board && typeof x.board === "object" ? x.board : null; } catch (e) { return null; } };
const MODE_OK = /^[a-z0-9]{1,12}$/;
const modeOf = (spec, m) => Array.isArray(spec.modes) && spec.modes.length ? (spec.modes.includes(m) && MODE_OK.test(m) ? m : spec.modes[0]) : "";
const suf = m => m ? "_" + m : "";
// 取得此遊戲的集合；沒有規格（未宣告 board）的遊戲一律視為不支援
const ctx = (g, m) => { const spec = gameSpec(g); return spec ? { spec, mode: modeOf(spec, m), desc: spec.order !== "asc" } : null; };
const colB = (g, m) => F.collection(F.db, "games", g, "bests" + suf(m));
const colR = (g, m) => F.collection(F.db, "games", g, "ranks" + suf(m));
const cloudOK = g => { try { const x = (window.GAMES || []).find(v => v.id === g); return !!(x && x.tags && x.tags.cloud); } catch (e) { return false; } };
const scoreUid = () => (F && F.auth.currentUser ? F.auth.currentUser.uid : "");
const cleanExtra = (spec, x) => {
  const o = {}, keys = Array.isArray(spec.fields) ? spec.fields : [];
  if (x && typeof x === "object") keys.slice(0, 5).forEach(k => { const v = x[k]; if (typeof v === "number" && isFinite(v)) o[k] = v; else if (typeof v === "string") o[k] = v.slice(0, 40); });
  return o;
};
const scores = {
  uid: scoreUid,
  // 遊戲規格（供 SDK 判斷排序 / 單位 / 模式）；沒有規格回傳 null
  spec(game) { const c = ctx(game); return c ? { order: c.desc ? "desc" : "asc", unit: String(c.spec.unit || ""), modes: Array.isArray(c.spec.modes) ? c.spec.modes.slice() : null, fields: Array.isArray(c.spec.fields) ? c.spec.fields.slice() : [] } : null; },
  // 個人最高（即時）：cb({ score, inRank, name, extra } | null)
  watchBest(game, cb, mode) {
    const u = scoreUid(), c = ctx(game, mode);
    if (!u || !c || !SAVE_PROFILE) return NOP;
    return F.onSnapshot(F.doc(colB(game, c.mode), u), s => { bump(1, 0); const d = s.exists() ? s.data() : null; cb(d ? { score: Number(d.score) || 0, inRank: !!d.inRank, name: String(d.name || ""), extra: d.extra || {} } : null); }, NOP);
  },
  // 排行榜前 n 名（即時）：cb([{ uid, name, score, extra }])
  watchTop(game, n, cb, mode) {
    const c = ctx(game, mode);
    if (!scoreUid() || !c || !SAVE_PROFILE) return NOP;
    return F.onSnapshot(F.query(colR(game, c.mode), F.orderBy("score", c.desc ? "desc" : "asc"), F.limit(Math.min(Math.max(n | 0, 1), 20))), s => {
      bump(s.size || 1, 0);
      cb(s.docs.map(d => ({ uid: d.id, name: String(d.data().name || "").slice(0, 40), score: Number(d.data().score) || 0, extra: d.data().extra || {} })));
    }, NOP);
  },
  // 雲端存檔：games/{game}/saves/{uid} 只有本人可讀寫；遊戲需在 js/games.js 設 tags.cloud = true。資料以 JSON 字串存放（Firestore 不支援巢狀陣列）
  async loadSave(game) {
    const u = scoreUid();
    if (!u || !cloudOK(game) || !SAVE_PROFILE) return { ok: true, data: null };
    bump(1, 0);
    const s = await F.getDoc(F.doc(F.db, "games", game, "saves", u));
    if (!s.exists()) return { ok: true, data: null };
    try { return { ok: true, data: JSON.parse(String(s.data().data || "")) }; } catch (e) { return { ok: true, data: null }; }
  },
  async saveSave(game, obj) {
    const u = scoreUid();
    if (!u || !cloudOK(game) || !SAVE_PROFILE) return;
    const str = JSON.stringify(obj);
    if (str.length > 20000) return;
    bump(0, 1);
    await F.setDoc(F.doc(F.db, "games", game, "saves", u), { data: str, updatedAt: F.serverTimestamp() });
  },
  // 目前名次 = 比我好的人數 + 1
  async rankOf(game, score, mode) {
    const c = ctx(game, mode);
    if (!c) return 0;
    bump(1, 0);
    const r = await F.getCountFromServer(F.query(colR(game, c.mode), F.where("score", c.desc ? ">" : "<", score)));
    return r.data().count + 1;
  },
  // 寫入個人最高；rank = true 同步寫進排行榜（name 為已處理好的顯示名稱），false 則自排行榜移除
  async saveScore(game, score, { rank, name, mode, extra } = {}) {
    const u = scoreUid(), c = ctx(game, mode);
    if (!u || !c || !SAVE_PROFILE) return;
    score = Number(score);
    if (!Number.isInteger(score) || score <= 0 || (typeof c.spec.max === "number" && score > c.spec.max)) { console.warn("[MiniHub] 分數不合法（需為大於 0 的整數且不超過 max；計時請用毫秒整數），已略過：", game, score); return; }
    const ex = cleanExtra(c.spec, extra), nm = String(name || "").slice(0, 40);
    bump(0, 2);
    const b = F.writeBatch(F.db);
    const hasEx = Object.keys(ex).length > 0;   // 沒有額外欄位就不寫 extra（與舊資料格式相同）
    b.set(F.doc(colB(game, c.mode), u), { score, inRank: !!rank, name: rank ? nm : "", ...(hasEx ? { extra: ex } : {}) });
    if (rank) b.set(F.doc(colR(game, c.mode), u), { score, name: nm, ...(hasEx ? { extra: ex } : {}), updatedAt: F.serverTimestamp() });
    else b.delete(F.doc(colR(game, c.mode), u));
    await b.commit();
  }
};


/* ---------- 多人賓果：房間目錄（Firestore） ----------
   games/bingo-lobby/rooms/{房號}：{ hostUid, at, name, salt, hostPw, roomPw }（hostPw / roomPw 為 SHA-256 雜湊，沒設密碼 = 空字串）
   僅登入後連線；訪客不連線（大廳會改用本機目錄）。 */
const ROOM_TTL = 12 * 3600000;
const roomRef = id => F.doc(F.db, "games", "bingo-lobby", "rooms", String(id));
const roomRow = d => { const x = d.data(); return { id: d.id, hostUid: String(x.hostUid || ""), name: String(x.name || ""), at: ms(x.at) || Date.now(), salt: String(x.salt || ""), hostPw: String(x.hostPw || ""), roomPw: String(x.roomPw || ""), cloud: true }; };
const roomsOn = () => !!(F && F.auth.currentUser && SAVE_PROFILE);
const rooms = {
  on: roomsOn,
  uid: () => (roomsOn() ? F.auth.currentUser.uid : ""),
  async list() {
    if (!roomsOn()) return null;
    bump(1, 0);
    const s = await F.getDocs(F.query(F.collection(F.db, "games", "bingo-lobby", "rooms"), F.orderBy("at", "desc"), F.limit(30)));
    bump(s.size, 0);
    return s.docs.map(roomRow).filter(r => /^\d{6}$/.test(r.id) && Date.now() - r.at < ROOM_TTL);
  },
  async get(id) {
    if (!roomsOn()) return null;
    bump(1, 0);
    const s = await F.getDoc(roomRef(id));
    return s.exists() ? roomRow(s) : null;
  },
  // 建立 / 更新自己的房間；別人未過期的房號回傳 { ok:false, error:"taken" }
  async create(id, { salt, hostPw, roomPw, name }) {
    if (!roomsOn()) return null;
    const uid = F.auth.currentUser.uid;
    bump(1, 1);
    return F.runTransaction(F.db, async tx => {
      const s = await tx.get(roomRef(id));
      if (s.exists()) {
        const r = roomRow(s);
        if (r.hostUid !== uid && Date.now() - r.at < ROOM_TTL) return { ok: false, error: "taken" };
      }
      tx.set(roomRef(id), { hostUid: uid, at: F.serverTimestamp(), name: String(name || "").slice(0, 20), salt: String(salt || ""), hostPw: String(hostPw || ""), roomPw: String(roomPw || "") });
      return { ok: true };
    });
  },
  async remove(id) {
    if (!roomsOn()) return;
    bump(0, 1);
    await F.deleteDoc(roomRef(id));
  }
};

window.MiniHubAuth = {
  hasSession, scores, rooms,
  preload: () => boot().catch(() => {}),     // 按下「登入」時預先載入，之後彈出視窗才不會被瀏覽器擋
  ping, usage: () => ({ ...use }),
  // key: "google" | "github"
  // 若該 email 已用「另一種方式」註冊過，會丟出 code = "needs-link"（附 email 與 provider），
  // 畫面請使用者改用原本的方式登入，再呼叫 linkPending(原本的方式) 把新方式連結到同一個帳號。
  signIn: async key => {
    const f = await load();
    try { return await f.signInWithPopup(f.auth, makeProvider(f, key || "google")); }
    catch (e) {
      if (e && e.code === "auth/account-exists-with-different-credential") {
        const cred = credFromError(f, key, e);
        pending = cred ? { cred, key, email: (e.customData && e.customData.email) || "" } : null;
        throw Object.assign(new Error("needs-link"), { code: "needs-link", email: pending && pending.email, provider: key });
      }
      throw e;
    }
  },
  // 帳號密碼：註冊 / 登入（帳號重複會丟出 code = "account-taken"）
  signUpPw: async (name, pw) => {
    const n = Array.from(acctKey(name)).length;
    if (n < 3 || n > 20 || typeof pw !== "string" || pw.length < 8 || pw.length > 64 || !/^[\x21-\x7E]+$/.test(acctKey(name)) || !/^[\x21-\x7E]+$/.test(pw)) throw bad("invalid-input");
    const f = await load();
    regName = String(name).trim();
    try {
      const r = await f.createUserWithEmailAndPassword(f.auth, await acctEmail(name), pw);
      try { await f.updateProfile(r.user, { displayName: regName }); } catch (e) {}   // 之後登入時用來顯示帳號名稱
      return r;
    } catch (e) {
      regName = "";
      if (e && e.code === "auth/email-already-in-use") throw bad("account-taken");
      throw e;
    }
  },
  signInPw: async (name, pw) => {
    const f = await load();
    regName = "";
    const email = await acctEmail(name);
    let release; gate = new Promise(r => { release = r; });
    let ok = false;
    try {
      const r = await f.signInWithEmailAndPassword(f.auth, email, pw);
      // 帳號大小寫必須和註冊時完全一致（Firebase 內部不分大小寫，所以用註冊時存的 displayName 比對）
      const reg = r.user.displayName;
      if (reg && reg !== String(name).trim()) { release(false); try { await f.signOut(f.auth); } catch (e) {} throw bad("auth/invalid-credential"); }
      ok = true; release(true);
      return r;
    } finally { if (!ok) release(false); gate = null; }
  },
  hasPending: () => !!pending,
  clearPending: () => { pending = null; },
  linkPending: async key => {
    if (!pending) throw Object.assign(new Error("no-pending"), { code: "no-pending" });
    const f = await load();
    const res = await f.signInWithPopup(f.auth, makeProvider(f, key));   // 用原本的方式登入
    const mail = (res.user.email || "").toLowerCase();
    if (pending.email && mail && mail !== pending.email.toLowerCase()) {
      await f.signOut(f.auth);
      throw Object.assign(new Error("email-mismatch"), { code: "link-email-mismatch" });
    }
    const label = PROV[pending.key].label;
    try { await f.linkWithCredential(res.user, pending.cred); }
    catch (e) { if (!e || e.code !== "auth/provider-already-linked") throw e; }
    pending = null;
    return label;
  },
  signOut: async () => {
    if (!F) return;
    const u = F.auth.currentUser;
    if (u) { SS("mh_logged_" + u.uid, null); SS("mh_prev_" + u.uid, null); }
    return F.signOut(F.auth);
  },
  createProfile, changePassword, updateName, setPublicName, setJoinRank, savePrefs, deleteAccount, checkin,
  // 預先檢查 UID 是否已被使用（僅供顯示用；真正的唯一性由交易與 Firestore 規則保證）
  isUidFree: async g => { if (!SAVE_PROFILE) return true; bump(1, 0); return !(await F.getDoc(F.doc(F.db, "uids", g))).exists(); },
  loadProfile: () => loadProfile(F.auth.currentUser.uid)
};

// 啟動：分頁內有登入狀態才載入並還原；否則直接視為未登入，不連線
if (hasSession()) boot().catch(() => emit({ user: null }));
else emit({ user: null });
