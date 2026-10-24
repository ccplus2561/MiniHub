// 主題：主題模式（明亮 / 灰暗）+ 色彩主題。在 <head> 載入，先套用再繪製畫面以避免閃爍。
(() => {
  const KEY = "minihub.appearance";

  // 色彩主題：id、名稱、漸層兩端顏色（第一個「default」為原本的青色）
  const THEMES = [
    { id: "mint",     name: "薄荷", c: ["#9fdcb8", "#b8e2d4"] },
    { id: "peach",    name: "蜜桃", c: ["#fbd98c", "#f7b8a0"] },
    { id: "lavender", name: "薰衣草", c: ["#b8b8dc", "#8ec0d4"] },
    { id: "cream",    name: "奶綠", c: ["#d6ecc8", "#f6d6c0"] },
    { id: "berry",    name: "莓果", c: ["#c88cb0", "#d4c490"] },
    { id: "blush",    name: "粉彩", c: ["#f8d4e0", "#d8d8f8"] },
    { id: "sky",      name: "晴空", c: ["#d2e6fb", "#d4f0dc"] },
    { id: "sand",     name: "米白", c: ["#f0ead0", "#ebe3c8"] },
    { id: "dusk",     name: "暮光", c: ["#3a2a6a", "#b0703a"] },
    { id: "aurora",   name: "極光", c: ["#1a3ad8", "#d03060"] },
    { id: "forest",   name: "森林", c: ["#1c3a34", "#8a6a38"] },
    { id: "ember",    name: "暗紅", c: ["#1a0000", "#a00a0a"] },
    { id: "midnight", name: "午夜", c: ["#14102c", "#3a30a0"] },
    { id: "rust",     name: "赭紅", c: ["#7a3a34", "#8a4a40"] },
    { id: "slate",    name: "石板", c: ["#4a4a60", "#7a86a8"] },
    { id: "sage",     name: "灰綠", c: ["#4a6a5c", "#4a6a60"] },
    { id: "indigo",   name: "靛青", c: ["#4a4a80", "#2a6a8a"] },
    { id: "lagoon",   name: "湖光", c: ["#109a9a", "#a02a8a"] },
    { id: "sunset",   name: "日落", c: ["#a0206a", "#d09a20"] },
    { id: "ocean",    name: "深海", c: ["#1a8a60", "#1a40a0"] },
    { id: "olive",    name: "橄欖", c: ["#6a5a40", "#4a3a20"] },
    { id: "royal",    name: "靛藍", c: ["#1a2ab0", "#2a2a80"] },
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

  // 由漸層取較飽和的一端作為強調色，亮度依主題模式調整以維持可讀性
  function accentFor(theme, mode) {
    const hsls = theme.c.map(c => rgb2hsl(hex2rgb(c)));
    const [h, s0] = hsls.sort((a, b) => b[1] * (1 - Math.abs(2 * b[2] / 100 - 1)) - a[1] * (1 - Math.abs(2 * a[2] / 100 - 1)))[0];
    const s = Math.max(40, Math.min(85, s0));
    const l = mode === "dark" ? 62 : 38;
    const rgb = hsl2rgb(h, s, l);
    const rgb2 = hsl2rgb(h, s, l + (mode === "dark" ? -10 : -8));
    return { accent: toHex(rgb), accent2: toHex(rgb2), on: lum(rgb) > .4 ? "#06161a" : "#ffffff" };
  }

  /* ----- 套用 ----- */
  const listeners = [];
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = state.mode;
    root.dataset.color = state.color;
    const props = ["--accent", "--accent-2", "--on-accent", "--g1", "--g2"];
    const theme = THEMES.find(t => t.id === state.color);
    if (theme) {
      const a = accentFor(theme, state.mode);
      root.style.setProperty("--accent", a.accent);
      root.style.setProperty("--accent-2", a.accent2);
      root.style.setProperty("--on-accent", a.on);
      root.style.setProperty("--g1", theme.c[0]);
      root.style.setProperty("--g2", theme.c[1]);
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
