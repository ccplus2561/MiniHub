// Firebase 整合：Google / GitHub 登入（含同 email 帳號連結）+ 玩家資料（使用者名稱 / 遊戲 UID）
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
const norm = d => ({ name: d.name, gameUid: d.gameUid, email: d.email, createdAt: ms(d.createdAt), nameChangedAt: ms(d.nameChangedAt), lastLoginAt: ms(d.lastLoginAt), publicName: typeof d.publicName === "boolean" ? d.publicName : null, joinRank: typeof d.joinRank === "boolean" ? d.joinRank : null, prefs: d.prefs && typeof d.prefs === "object" ? d.prefs : null });

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
      if (!user.email) {   // 帳號必須有電子郵件（例如 GitHub 設為私人且無公開信箱時會沒有）
        emit({ user: null });
        try { await S.signOut(auth); } catch (e) {}
        if (window.MiniHubToast) window.MiniHubToast("此帳號沒有可用的電子郵件，無法登入，請改用其他方式");
        return;
      }
      const u = { uid: user.uid, email: user.email, photoURL: user.photoURL || "" };
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
    tx.set(uRef, { name, gameUid, email: user.email, createdAt: F.serverTimestamp(), publicName: !!publicName, joinRank: !!joinRank, ...(prefs ? { prefs } : {}) });
  });
  await recordLogin(user.uid, null);                               // 首次登入也記一筆，下次登入時才有「上次」可顯示
  return loadProfile(user.uid);
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

// 刪除帳號：先重新驗證（刪除帳號需要「最近登入」）→ 刪 Firestore 玩家資料（users + uids）→ 刪登入帳號
async function deleteAccount() {
  const user = F && F.auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  const pid = ((user.providerData[0] || {}).providerId) || "google.com";
  await F.reauthenticateWithPopup(user, makeProvider(F, pid === "github.com" ? "github" : "google"));   // 需在點擊後立即呼叫，才不會被瀏覽器擋彈窗
  if (SAVE_PROFILE) {
    bump(1, 2);
    const snap = await F.getDoc(F.doc(F.db, "users", user.uid));
    const batch = F.writeBatch(F.db);
    if (snap.exists() && snap.data().gameUid) batch.delete(F.doc(F.db, "uids", snap.data().gameUid));
    batch.delete(F.doc(F.db, "users", user.uid));
    await batch.commit();
  }
  SS("mh_logged_" + user.uid, null); SS("mh_prev_" + user.uid, null);
  await F.deleteUser(user);   // 之後 onAuthStateChanged 會回報已登出
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

window.MiniHubAuth = {
  hasSession,
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
  createProfile, updateName, setPublicName, setJoinRank, savePrefs, deleteAccount,
  // 預先檢查 UID 是否已被使用（僅供顯示用；真正的唯一性由交易與 Firestore 規則保證）
  isUidFree: async g => { if (!SAVE_PROFILE) return true; bump(1, 0); return !(await F.getDoc(F.doc(F.db, "uids", g))).exists(); },
  loadProfile: () => loadProfile(F.auth.currentUser.uid)
};

// 啟動：分頁內有登入狀態才載入並還原；否則直接視為未登入，不連線
if (hasSession()) boot().catch(() => emit({ user: null }));
else emit({ user: null });
