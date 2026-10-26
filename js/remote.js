// 遠端內容：公告 + 開發中的遊戲，資料來自 Google 試算表（Apps Script 網頁應用程式）。
// 更新內容只要改試算表，網站不用重新部署。API_URL 留空 = 完全不連線。
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbxl_vvSh3jclgzhfGix_F_btn-oAAAvyQKr2YlAI31T4bYnmaO3RdFTlOQHcgNJXKQQ/exec";                 // 貼上 Apps Script 網頁應用程式網址（結尾是 /exec）
  const ALLOWED_HOSTS = ["github.io"]; // 外部遊戲連結只接受這些網域（含子網域）；可加自己的網域
  if (!API_URL) return;

  const on = v => String(v == null ? "" : v).trim() === "顯示";   // 「狀態」欄：顯示 / 關閉
  const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
  const https = u => { try { const x = new URL(String(u).trim()); return x.protocol === "https:" ? x : null; } catch (e) { return null; } };
  const hostOk = h => ALLOWED_HOSTS.some(d => h === d || h.endsWith("." + d));
  const hue = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };   // 依名稱產生固定的卡片顏色

  function toNotices(rows) {
    return (rows || []).filter(r => on(r["狀態"]) && str(r["標題"], 80))
      .map(r => {
        const link = https(r["連結"]);
        return { title: str(r["標題"], 60), body: str(r["內容"], 800), date: str(r["日期"], 10), hot: str(r["等級"], 8) === "重要", link: link ? link.href : "" };
      })
      .sort((a, b) => (b.hot - a.hot) || b.date.localeCompare(a.date))
      .slice(0, 20);
  }

  function toGames(rows) {
    return (rows || []).filter(r => on(r["狀態"]) && str(r["名稱"], 30)).map((r, i) => {
      const name = str(r["名稱"], 30), h = hue(name);
      const u = https(r["遊戲連結"]);
      const path = u && hostOk(u.hostname) ? u.href : "";
      if (u && !path) console.warn("[MiniHub] 遊戲連結的網域不在允許清單，已略過：", u.hostname);
      const img = https(r["圖示連結"]);   // 填「無」或不是網址 = 用預設圖示；圖片載入失敗也會退回預設圖示
      return {
        id: "ext-" + (Number(r["_row"]) || i + 2), title: name, category: str(r["分類"], 8) || "其他",
        emoji: "🎮", icon: img ? img.href : "",
        colors: ["hsl(" + h + ",55%,38%)", "hsl(" + h + ",60%,16%)"],
        path, badge: path ? "開發中" : "封測中", desc: "", featured: false
      };
    });
  }

  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  fetch(API_URL, { signal: ctl.signal })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(d => {
      clearTimeout(t);
      const games = toGames(d.games), notices = toNotices(d.notices);
      if (games.length && window.MiniHubAddGames) window.MiniHubAddGames(games);
      if (window.MiniHubSetNotices) window.MiniHubSetNotices(notices, !/play=/.test(location.hash));
    })
    .catch(() => {});   // 失敗就安靜略過，不影響網站
})();
