// 主題：主題模式（明亮 / 灰暗）+ 色彩主題。在 <head> 載入，先套用再繪製畫面以避免閃爍。
(() => {
  const KEY = "minihub.appearance";

  // 色彩主題：id、名稱、四段幻彩漸層
  const THEMES = [
    { id: "mint",     name: "薄荷",   c: ["#9fdcb8", "#8fd8e8", "#b8c8f4", "#c8f0d8"] },
    { id: "peach",    name: "蜜桃",   c: ["#fbd98c", "#f7b8a0", "#f4a8c8", "#c8b0f0"] },
    { id: "lavender", name: "薰衣草", c: ["#b8b8dc", "#8ec0d4", "#c8a8e8", "#a8e0d8"] },
    { id: "cream",    name: "奶綠",   c: ["#d6ecc8", "#f6d6c0", "#f4e4a0", "#c0e4e8"] },
    { id: "berry",    name: "莓果",   c: ["#c88cb0", "#d4c490", "#a88cd0", "#e0889c"] },
    { id: "blush",    name: "粉彩",   c: ["#f8d4e0", "#d8d8f8", "#c8ecf4", "#f8e4c8"] },
    { id: "sky",      name: "晴空",   c: ["#d2e6fb", "#d4f0dc", "#e4d4f8", "#bce8f0"] },
    { id: "sand",     name: "米白",   c: ["#f0ead0", "#f2d8c4", "#d8e4d0", "#d4d8f0"] },
    { id: "dusk",     name: "暮光",   c: ["#3a2a6a", "#b0703a", "#7a3a8a", "#2a5a8a"] },
  ];

  const state = { mode: "dark", color: "default" };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  if (state.mode !== "light" && state.mode !== "dark") state.mode = "dark";
  if (state.color !== "default" && !THEMES.some(t => t.id === state.color)) state.color = "default";

  /* ----- 顏色運算 ----- */
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function rgb2hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s * 100, l * 100];
  }
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
  }
  const toHex = rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
  const lum = rgb => {
    const [r, g, b] = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * b;
  };

  // 背景色：保留色相，深色模式壓成飽和的深色調、明亮模式拉成飽和的淺色調，確保文字可讀
  function bgTone(hex, mode) {
    const [h, s, l] = rgb2hsl(hex2rgb(hex));
    const s2 = Math.max(48, Math.min(85, s));
    const l2 = mode === "dark" ? 22 + l * 0.16 : 78 + (100 - l) * 0 + Math.min(l, 90) * 0.12;
    return toHex(hsl2rgb(h, s2, l2));
  }
  // 單一強調色（按鈕框 / 文字）：取主題中最飽和的色相，一個顏色，不用漸層
  function accentOf(theme, mode) {
    const best = theme.c.map(c => rgb2hsl(hex2rgb(c))).sort((a, b) => b[1] - a[1])[0];
    const h = best[0];
    return mode === "dark"
      ? { a: toHex(hsl2rgb(h, 75, 70)), a2: toHex(hsl2rgb(h, 70, 58)) }
      : { a: toHex(hsl2rgb(h, 80, 32)), a2: toHex(hsl2rgb(h, 80, 24)) };
  }
  function onColor(hex) {
    const L = lum(hex2rgb(hex));
    return (1.05 / (L + .05)) > ((L + .05) / .057) ? "#ffffff" : "#06161a";
  }

  /* ----- 套用 ----- */
  const listeners = [];
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = state.mode;
    root.dataset.color = state.color;
    const props = ["--accent", "--accent-2", "--on-accent", "--g1", "--g2", "--g3", "--g4"];
    const theme = THEMES.find(t => t.id === state.color);
    if (theme) {
      const ac = accentOf(theme, state.mode);
      root.style.setProperty("--accent", ac.a);
      root.style.setProperty("--accent-2", ac.a2);
      root.style.setProperty("--on-accent", onColor(ac.a));
      theme.c.forEach((c, i) => root.style.setProperty("--g" + (i + 1), bgTone(c, state.mode)));
    } else {
      props.forEach(p => root.style.removeProperty(p));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.mode === "light" ? "#f2f5f9" : "#0b0e14";
    listeners.forEach(fn => fn(state));
  }

  function set(patch) {
    Object.assign(state, patch);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    apply();
  }

  window.MiniHubTheme = { THEMES, state, set, onChange: fn => listeners.push(fn) };
  apply();
})();
