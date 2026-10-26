// 遠端內容：公告 + 開發中的遊戲，資料來自 Google 試算表（Apps Script 網頁應用程式）。
// 更新內容只要改試算表，網站不用重新部署。API_URL 留空 = 完全不連線。
(() => {
  const API_URL = "";                 // 貼上 Apps Script 網頁應用程式網址（結尾是 /exec）
  const ALLOWED_HOSTS = ["github.io"]; // 外部遊戲連結只接受這些網域（含子網域）；可加自己的網域
  if (!API_URL) return;

  const yes = v => v === true || String(v).trim().toUpperCase() === "TRUE";
  const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
  const https = u => { try { const x = new URL(String(u).trim()); return x.protocol === "https:" ? x : null; } catch (e) { return null; } };
  const hostOk = h => ALLOWED_HOSTS.some(d => h === d || h.endsWith("." + d));
  const HEX = /^#[0-9a-f]{6}$/i;

  function toNotices(rows) {
    return (rows || []).filter(r => yes(r["顯示"]) && str(r["標題"], 80))
      .map(r => {
        const link = https(r["連結"]);
        return { title: str(r["標題"], 60), body: str(r["內容"], 800), date: str(r["日期"], 10), hot: str(r["等級"], 8) === "重要", link: link ? link.href : "" };
      })
      .sort((a, b) => (b.hot - a.hot) || b.date.localeCompare(a.date))
      .slice(0, 20);
  }

  function toGames(rows) {
    const seen = new Set();
    return (rows || []).filter(r => yes(r["顯示"]) && /^[\w-]{1,30}$/.test(String(r["id"])) && str(r["名稱"], 30)).map(r => {
      const id = "ext-" + r["id"];
      if (seen.has(id)) return null; seen.add(id);
      const u = https(r["連結"]);
      const path = u && hostOk(u.hostname) ? u.href : "";
      if (u && !path) console.warn("[MiniHub] 遊戲連結的網域不在允許清單，已略過：", u.hostname);
      const icon = str(r["圖示"], 300), img = icon.startsWith("https://") && https(icon);
      const c1 = str(r["顏色1"], 7), c2 = str(r["顏色2"], 7);
      return {
        id, title: str(r["名稱"], 30), category: str(r["分類"], 8) || "其他",
        emoji: img ? "🎮" : (icon || "🎮").slice(0, 4), icon: img ? img.href : "",
        colors: [HEX.test(c1) ? c1 : "#334155", HEX.test(c2) ? c2 : "#0f172a"],
        path, badge: str(r["狀態"], 8) || (path ? "" : "即將推出"),
        desc: str(r["簡介"], 120), featured: false
      };
    }).filter(Boolean);
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
