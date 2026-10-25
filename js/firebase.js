// Firebase 整合：Google 登入 + 玩家資料（使用者名稱 / 遊戲 UID）
// 注意：偏好設定（顯示、音效…）仍不保存；這裡只保存「帳號資料」。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
         setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
const emit = detail => document.dispatchEvent(new CustomEvent("minihub:auth", { detail }));

// 登入狀態只保留到分頁關閉（關掉網頁再開需重新登入）
try { await setPersistence(auth, browserSessionPersistence); } catch (e) {}

async function loadProfile(authUid) {
  if (!SAVE_PROFILE) return null;
  const snap = await getDoc(doc(db, "users", authUid));
  return snap.exists() ? snap.data() : null;
}

// 建立玩家資料：users/{authUid} 與 uids/{gameUid} 在同一筆交易寫入（UID 唯一、只能建立一次）
async function createProfile({ name, gameUid }) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("not-signed-in"), { code: "not-signed-in" });
  const profile = { name, gameUid, email: user.email };
  if (!SAVE_PROFILE) return profile;
  await runTransaction(db, async tx => {
    const uRef = doc(db, "users", user.uid), idRef = doc(db, "uids", gameUid);
    if ((await tx.get(uRef)).exists()) throw Object.assign(new Error("already"), { code: "already-has-profile" });
    if ((await tx.get(idRef)).exists()) throw Object.assign(new Error("taken"), { code: "uid-taken" });
    tx.set(idRef, { owner: user.uid });
    tx.set(uRef, { name, gameUid, email: user.email, createdAt: serverTimestamp() });
  });
  return profile;
}

window.MiniHubAuth = {
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
  signOut: () => signOut(auth),
  createProfile,
  loadProfile: () => loadProfile(auth.currentUser.uid)
};

onAuthStateChanged(auth, async user => {
  if (!user) return emit({ user: null });
  const u = { uid: user.uid, email: user.email };
  try { emit({ user: u, profile: await loadProfile(user.uid) }); }
  catch (error) { emit({ user: u, error }); }
});
