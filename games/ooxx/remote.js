/* OOXX 雙人連線：Firebase 後端（Firestore：games/ooxx/rooms/{房號}）
 * ─────────────────────────────────────────────────────────
 * 透過大廳（parent）的 MiniHubAuth.ooxx 讀寫；本檔設定 window.OOXXRemote，online-store.js 會自動改用它。
 * 不在 MiniHub 內單獨開啟時不設定，維持原本的本機版（localStorage）。
 * 房間與對局（棋盤、輪到誰、比分、再來一局）全部存在同一份房間文件，雙方即時同步。
 */
(() => {
  "use strict";
  const P = (() => { try { return parent !== window && parent.document ? parent : null; } catch (e) { return null; } })();
  const api = () => { try { return P && P.MiniHubAuth && P.MiniHubAuth.ooxx; } catch (e) { return null; } };
  if (!api()) return;

  const WAIT_MS = 8000;    // 等 Firebase 還原登入的上限
  const OP_MS = 10000;     // 單次操作逾時
  const RETRY_MS = 1500;   // 監聽中斷後重試間隔
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cloud = () => { const a = api(); return a && a.on() ? a : null; };
  async function ready() {
    const t = Date.now();
    let c = cloud();
    while (!c && Date.now() - t < WAIT_MS) { await sleep(200); c = cloud(); }
    return c;
  }
  // 失敗（未連線 / 逾時 / 權限）一律丟出錯誤，由 online-store.js 統一轉成 { ok:false, error:"network" }
  async function run(fn) {
    const c = await ready();
    if (!c) throw new Error("offline");
    return Promise.race([fn(c), sleep(OP_MS).then(() => { throw new Error("timeout"); })]);
  }

  // 即時監聽：尚未登入 / SDK 未載入時等待；連線中斷或權限錯誤時自動重試
  function watch(start) {
    let off = null, dead = false, timer = 0;
    const stop = () => { if (off) { try { off(); } catch (e) { /* 忽略 */ } off = null; } };
    function attach() {
      clearTimeout(timer);
      if (dead || off) return;
      const c = cloud();
      let u = null;
      if (c) {
        try { u = start(c, () => { stop(); if (!dead) timer = setTimeout(attach, RETRY_MS); }); } catch (e) { u = null; }
      }
      if (u) off = u; else if (!dead) timer = setTimeout(attach, RETRY_MS);
    }
    attach();
    return () => { dead = true; clearTimeout(timer); stop(); };
  }

  window.OOXXRemote = {
    list: () => run(c => c.list()),
    get: id => run(c => c.get(id)),
    create: room => run(c => c.create(room)),
    update: (id, fn) => run(c => c.update(id, fn)),
    remove: (id, uid) => run(c => c.remove(id, uid)),
    subscribe: (id, cb) => watch((c, onErr) => c.subscribe(id, cb, onErr)),
    subscribeList: cb => watch((c, onErr) => c.subscribeList(cb, onErr)),
  };
})();
