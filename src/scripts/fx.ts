// 特效彩蛋：彩帶、小火車
import { mq, B } from './core';

export function confetti() {
  if (mq.reduced.matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'fx-canvas';
  cv.width = innerWidth;
  cv.height = innerHeight;
  document.body.append(cv);
  const ctx = cv.getContext('2d')!;
  const colors = ['#5dffa6', '#ffd166', '#7dd3fc', '#ff7ab6', '#c792ea', '#ffffff'];
  const ps = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const el = now - start;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / 3200);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (el < 3200) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
}

export function train() {
  const pre = document.createElement('pre');
  pre.className = 'sl';
  // 車頭寫使用者名稱：車廂內寬 11 字，置中（偏右一格，跟原本的設計一樣）
  const name = B.user.slice(0, 9);
  const cab = (' '.repeat(Math.ceil((11 - name.length) / 2)) + name).padEnd(11);
  pre.textContent = [
    '      ___                                     ',
    '   __|o|______   ____________   ____________  ',
    `  |${cab}|=|   coffee   |=|    bugs    | `,
    '  |___________| |____________| |____________| ',
    "   'O-O---O-O'   'O-O----O-O'   'O-O----O-O'  ",
  ].join('\n');
  document.body.append(pre);
  pre.addEventListener('animationend', () => pre.remove());
}
