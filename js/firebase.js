// Firebase 整合：Google 登入 + 玩家資料（使用者名稱 / 遊戲 UID）
// 注意：偏好設定（顯示、音效…）仍不保存；這裡只保存「帳號資料」。
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
const norm = d => ({ name: d.name, gameUid: d.gameUid, email: d.email, createdAt: ms(d.createdAt), nameChangedAt: ms(d.nameChangedAt), lastLoginAt: ms(d.lastLoginAt), publicName: typeof d.publicName === "boolean" ? d.publicName : null });

// 「上次登入」：每次新的登入（分頁關閉後重開 / 登出後再登入）記錄一次；畫面顯示的是「這次登入之前」的那一次
const SS = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; };
const prevFromSession = uid => { const v = SS("mh_prev_" + uid); return v ? Number(v) : null; };

// 這個分頁是否已有 Firebase 登入狀態（有才需要在開啟網頁時載入 SDK 並還原登入）
const hasSession = () => {
  try { for (let i = 0; i < sessionStorage.length; i++) if ((sessionStorage.key(i) || "").startsWith("firebase:authUser:")) return true; } catch (e) {}
  return false;
};

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
async function createProfile({ name, gameUid, publicName }) {
  const user = F && F.auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  if (!SAVE_PROFILE) return { name, gameUid, email: user.email, createdAt: Date.now(), nameChangedAt: null };
  bump(2, 2);
  await F.runTransaction(F.db, async tx => {
    const uRef = F.doc(F.db, "users", user.uid), idRef = F.doc(F.db, "uids", gameUid);
    if ((await tx.get(uRef)).exists()) throw Object.assign(new Error("already"), { code: "already-has-profile" });
    if ((await tx.get(idRef)).exists()) throw Object.assign(new Error("taken"), { code: "uid-taken" });
    tx.set(idRef, { owner: user.uid });
    tx.set(uRef, { name, gameUid, email: user.email, createdAt: F.serverTimestamp(), publicName: !!publicName });
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
  signIn: async () => {
    let f;
    try { f = await boot(); } catch (e) { throw Object.assign(new Error("sdk-load-failed"), { code: "sdk-load-failed" }); }
    return f.signInWithPopup(f.auth, new f.GoogleAuthProvider());
  },
  signOut: async () => {
    if (!F) return;
    const u = F.auth.currentUser;
    if (u) { SS("mh_logged_" + u.uid, null); SS("mh_prev_" + u.uid, null); }
    return F.signOut(F.auth);
  },
  createProfile, updateName, setPublicName,
  // 預先檢查 UID 是否已被使用（僅供顯示用；真正的唯一性由交易與 Firestore 規則保證）
  isUidFree: async g => { if (!SAVE_PROFILE) return true; bump(1, 0); return !(await F.getDoc(F.doc(F.db, "uids", g))).exists(); },
  loadProfile: () => loadProfile(F.auth.currentUser.uid)
};

// 啟動：分頁內有登入狀態才載入並還原；否則直接視為未登入，不連線
if (hasSession()) boot().catch(() => emit({ user: null }));
else emit({ user: null });
