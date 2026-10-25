// Firebase 整合：Google 登入 + 玩家資料（使用者名稱 / 遊戲 UID）
// 注意：偏好設定（顯示、音效…）仍不保存；這裡只保存「帳號資料」。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
         setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// 本次開啟網頁、這台裝置的讀寫次數（估算；不是專案總用量）
const use = { reads: 0, writes: 0 };
const bump = (r, w) => { use.reads += r; use.writes += w; document.dispatchEvent(new CustomEvent("minihub:usage")); };
const emit = detail => document.dispatchEvent(new CustomEvent("minihub:auth", { detail }));
const ms = t => (t && t.toMillis ? t.toMillis() : null);
const norm = d => ({ name: d.name, gameUid: d.gameUid, email: d.email, createdAt: ms(d.createdAt), nameChangedAt: ms(d.nameChangedAt) });

// 登入狀態只保留到分頁關閉（關掉網頁再開需重新登入）
try { await setPersistence(auth, browserSessionPersistence); } catch (e) {}

async function loadProfile(authUid) {
  if (!SAVE_PROFILE) return null;
  bump(1, 0);
  const snap = await getDoc(doc(db, "users", authUid));
  return snap.exists() ? norm(snap.data()) : null;
}

// 建立玩家資料：users/{authUid} 與 uids/{gameUid} 在同一筆交易寫入（UID 唯一、只能建立一次）
async function createProfile({ name, gameUid }) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  if (!SAVE_PROFILE) return { name, gameUid, email: user.email, createdAt: Date.now(), nameChangedAt: null };
  bump(2, 2);
  await runTransaction(db, async tx => {
    const uRef = doc(db, "users", user.uid), idRef = doc(db, "uids", gameUid);
    if ((await tx.get(uRef)).exists()) throw Object.assign(new Error("already"), { code: "already-has-profile" });
    if ((await tx.get(idRef)).exists()) throw Object.assign(new Error("taken"), { code: "uid-taken" });
    tx.set(idRef, { owner: user.uid });
    tx.set(uRef, { name, gameUid, email: user.email, createdAt: serverTimestamp() });
  });
  return loadProfile(user.uid);
}

// 變更使用者名稱：14 天限制由 Firestore 規則強制，前端只負責顯示
async function updateName(name, current) {
  const user = auth.currentUser;
  if (!SAVE_PROFILE) return { ...current, name, nameChangedAt: Date.now() };
  bump(0, 1);
  await updateDoc(doc(db, "users", user.uid), { name, nameChangedAt: serverTimestamp() });
  return loadProfile(user.uid);
}

// 伺服器狀態檢查：向 Firestore 讀一次；只要伺服器有回應（含被規則拒絕）就代表連得上
async function ping() {
  const t0 = performance.now();
  bump(1, 0);
  try {
    await Promise.race([
      getDoc(doc(db, "uids", "_ping")),
      new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), 8000))
    ]);
  } catch (e) {
    if (!e || (e.code !== "permission-denied" && e.code !== "not-found"))
      return { ok: false, code: (e && (e.code || e.message)) || "unknown" };
  }
  return { ok: true, ms: Math.round(performance.now() - t0) };
}

window.MiniHubAuth = {
  ping, usage: () => ({ ...use }),
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
  signOut: () => signOut(auth),
  createProfile, updateName,
  // 預先檢查 UID 是否已被使用（僅供顯示用；真正的唯一性由交易與 Firestore 規則保證）
  isUidFree: async g => { if (!SAVE_PROFILE) return true; bump(1, 0); return !(await getDoc(doc(db, "uids", g))).exists(); },
  loadProfile: () => loadProfile(auth.currentUser.uid)
};

onAuthStateChanged(auth, async user => {
  if (!user) return emit({ user: null });
  const u = { uid: user.uid, email: user.email, photoURL: user.photoURL || "" };
  try { emit({ user: u, profile: await loadProfile(user.uid) }); }
  catch (error) { emit({ user: u, error }); }
});
