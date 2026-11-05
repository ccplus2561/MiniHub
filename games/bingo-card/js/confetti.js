// 輕量紙花特效（無外部套件）。使用者設定「減少動態效果」時不執行。
const COLORS = ['#f2c14e', '#1d4e5f', '#e4572e', '#76b041', '#6c5ce7', '#ff8fab'];
let canvas, ctx, particles = [], running = false;

function setup() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  addEventListener('resize', fit);
  fit();
}

function fit() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst() {
  const w = innerWidth;
  for (let i = 0; i < 110; i++) {
    particles.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 11 - 3,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[i % COLORS.length],
      life: 0,
    });
  }
}

function frame() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter(p => p.life < 150 && p.y < innerHeight + 20);
  for (const p of particles) {
    p.life++;
    p.vy += 0.3; p.vx *= 0.99;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, (150 - p.life) / 40);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  if (particles.length) requestAnimationFrame(frame);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

export function launchConfetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (window.MiniHub && !MiniHub.prefs().anim) return; } catch { /* 忽略 */ }
  setup();
  burst();
  if (!running) { running = true; requestAnimationFrame(frame); }
}
