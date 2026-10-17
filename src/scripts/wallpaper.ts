// 桌布 canvas（格點／星空／駭客任務／波浪／極光／電路板／光斑）與跟著滑鼠的光暈
import { $, D, root } from './core';
import { accentRgb, accent2Rgb, isLight } from './theme';

const mouse = { x: -9999, y: -9999 };
type RGB = [number, number, number];
const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r},${g},${b},${a})`;

export function initWallpaper() {
  const glow = $('#glow');
  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    glow.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  }, { passive: true });

  const cv = $<HTMLCanvasElement>('#wallpaper');
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  /* ── 各桌布的狀態 ── */
  const stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75, r: 0.5 + Math.random() * 1.4 }));
  const blobs = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.2 + Math.random() * 0.6, r: 0.35 + Math.random() * 0.3, sp: 0.05 + Math.random() * 0.08, ph: i * 1.7, k: i % 3 }));
  const bokeh = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 18 + Math.random() * 70, vx: (Math.random() - 0.5) * 0.00012, vy: -0.00004 - Math.random() * 0.00008, a: 0.03 + Math.random() * 0.07, k: Math.floor(Math.random() * 3), ph: Math.random() * 6.28 }));

  // 駭客任務：每一欄一串往下掉的字
  const glyphs = `アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789${D.persona.matrixGlyphs}ABCDEF<>/{}`;
  let cols: { y: number; speed: number; chars: string[] }[] = [];
  const FS = 16;
  function initMatrix() {
    cols = Array.from({ length: Math.ceil(cv.width / FS) }, () => ({
      y: Math.random() * -cv.height / FS,
      speed: 0.25 + Math.random() * 0.6,
      chars: Array.from({ length: 18 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
    }));
  }

  // 電路板：格點上的直角走線，上面有光點在跑
  type Trace = { pts: [number, number][]; len: number; seg: number[]; pulse: number; sp: number };
  let traces: Trace[] = [];
  const CELL = 30;
  function initCircuit() {
    const cw = Math.floor(cv.width / CELL), ch = Math.floor(cv.height / CELL);
    const used = new Set<string>();
    traces = [];
    for (let n = 0; n < Math.min(55, (cw * ch) / 24); n++) {
      let x = Math.floor(Math.random() * cw), y = Math.floor(Math.random() * ch);
      const pts: [number, number][] = [[x, y]];
      let dir = Math.floor(Math.random() * 4);
      for (let s = 0; s < 4 + Math.floor(Math.random() * 7); s++) {
        const run = 1 + Math.floor(Math.random() * 5);
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
        const nx = Math.max(0, Math.min(cw, x + dx * run)), ny = Math.max(0, Math.min(ch, y + dy * run));
        if ((nx === x && ny === y) || used.has(`${nx},${ny}`)) break;
        x = nx; y = ny;
        pts.push([x, y]);
        used.add(`${x},${y}`);
        dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
      }
      if (pts.length < 3) continue;
      const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      traces.push({ pts, seg, len: seg.reduce((a, b) => a + b, 0), pulse: Math.random(), sp: 0.0015 + Math.random() * 0.003 });
    }
  }
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; initMatrix(); initCircuit(); };
  fit();
  addEventListener('resize', fit);

  let t = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    t += 0.016;
    const W = cv.width, H = cv.height;
    const light = isLight();
    const dim = (c: RGB): RGB => (light ? c.map((v) => Math.round(v * 0.5)) as RGB : c);
    const acc = dim(accentRgb()), acc2 = dim(accent2Rgb());
    const [r, g, b] = acc;
    const base = light ? '30,60,45' : '200,230,215';
    const mode = root.dataset.wallpaper ?? 'grid';

    ctx.clearRect(0, 0, W, H);
    if (mode === 'off') return;

    const mx = mouse.x, my = mouse.y;
    if (mode === 'grid') {
      const sp = 38;
      for (let x = sp / 2; x < W; x += sp) {
        for (let y = sp / 2; y < H; y += sp) {
          const dx = x - mx, dy = y - my;
          const gl = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 200);
          const a = (light ? 0.1 : 0.05) + 0.02 * Math.sin(t + x * 0.02 + y * 0.03) + gl * 0.55;
          const sz = 1 + gl * 1.8;
          ctx.fillStyle = gl > 0.02 ? `rgba(${r},${g},${b},${a})` : `rgba(${base},${a})`;
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
    } else if (mode === 'starfield') {
      const px = (mx - W / 2) / W, py = (my - H / 2) / H;
      for (const s of stars) {
        s.y += 0.00012 * s.z;
        if (s.y > 1) s.y -= 1;
        const x = ((s.x - px * 0.05 * s.z + 1) % 1) * W;
        const y = ((s.y - py * 0.05 * s.z + 1) % 1) * H;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * s.z * 2 + s.x * 9));
        ctx.fillStyle = s.z > 0.8 ? `rgba(${r},${g},${b},${0.55 * tw})` : `rgba(${base},${(light ? 0.45 : 0.3) * tw * s.z})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * s.z, 0, 6.283);
        ctx.fill();
      }
    } else if (mode === 'matrix') {
      ctx.font = `${FS - 2}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      cols.forEach((c, i) => {
        c.y += c.speed;
        if ((c.y - c.chars.length) * FS > H) { c.y = Math.random() * -20; c.speed = 0.25 + Math.random() * 0.6; }
        if (Math.random() < 0.02) c.chars[Math.floor(Math.random() * c.chars.length)] = glyphs[Math.floor(Math.random() * glyphs.length)];
        const head = Math.floor(c.y);
        for (let k = 0; k < c.chars.length; k++) {
          const row = head - k;
          if (row < 0 || row * FS > H) continue;
          const a = k === 0 ? 0.95 : (1 - k / c.chars.length) * 0.5;
          ctx.fillStyle = k === 0 ? (light ? `rgba(${r},${g},${b},1)` : 'rgba(230,255,240,.95)') : `rgba(${r},${g},${b},${a})`;
          ctx.fillText(c.chars[k], i * FS + FS / 2, row * FS);
        }
      });
    } else if (mode === 'waves') {
      // 幾層疊在一起的正弦波，滑鼠位置會輕輕推動相位
      const shift = (mx > 0 ? mx / W : 0.5) * 1.5;
      for (let i = 0; i < 5; i++) {
        const yb = H * (0.5 + i * 0.09), amp = 22 + i * 7, sp = 0.5 + i * 0.13;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6) {
          const y = yb + Math.sin(x * 0.0045 + t * sp + i * 1.3 + shift) * amp + Math.sin(x * 0.012 - t * 0.35 + i) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        const c = i % 2 ? acc2 : acc;
        ctx.fillStyle = rgba(c, (light ? 0.09 : 0.055) - i * 0.006);
        ctx.fill();
        ctx.strokeStyle = rgba(c, light ? 0.35 : 0.28);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (mode === 'aurora') {
      // 幾團大光暈慢慢飄，深色用相加混色才會亮起來
      ctx.globalCompositeOperation = light ? 'multiply' : 'lighter';
      const palette: RGB[] = [acc, acc2, light ? [90, 120, 200] : [110, 150, 255]];
      for (const bl of blobs) {
        const x = ((bl.x + Math.sin(t * bl.sp + bl.ph) * 0.18 + 1) % 1) * W;
        const y = (bl.y + Math.cos(t * bl.sp * 0.7 + bl.ph) * 0.12) * H;
        const rad = bl.r * Math.max(W, H) * 0.7;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const c = palette[bl.k];
        gr.addColorStop(0, rgba(c, light ? 0.22 : 0.16));
        gr.addColorStop(0.5, rgba(c, light ? 0.08 : 0.05));
        gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (mode === 'circuit') {
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      for (const tr of traces) {
        ctx.beginPath();
        tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * CELL + 0.5, y * CELL + 0.5));
        ctx.strokeStyle = `rgba(${base},${light ? 0.16 : 0.09})`;
        ctx.stroke();
        // 端點的焊墊
        for (const [x, y] of [tr.pts[0], tr.pts[tr.pts.length - 1]]) {
          ctx.fillStyle = `rgba(${base},${light ? 0.3 : 0.18})`;
          ctx.fillRect(x * CELL - 2.5, y * CELL - 2.5, 6, 6);
        }
        // 光點
        tr.pulse += tr.sp;
        if (tr.pulse > 1.25) tr.pulse = -0.25;
        let d = Math.max(0, Math.min(1, tr.pulse)) * tr.len, i = 0;
        while (i < tr.seg.length && d > tr.seg[i]) { d -= tr.seg[i]; i++; }
        if (i < tr.seg.length && tr.pulse >= 0 && tr.pulse <= 1) {
          const [x0, y0] = tr.pts[i], [x1, y1] = tr.pts[i + 1];
          const f = d / tr.seg[i];
          const px = (x0 + (x1 - x0) * f) * CELL, py = (y0 + (y1 - y0) * f) * CELL;
          const gr = ctx.createRadialGradient(px, py, 0, px, py, 7);
          gr.addColorStop(0, rgba(acc, 0.85));
          gr.addColorStop(0.4, rgba(acc, 0.35));
          gr.addColorStop(1, rgba(acc, 0));
          ctx.fillStyle = gr;
          ctx.fillRect(px - 7, py - 7, 14, 14);
        }
      }
    } else if (mode === 'bokeh') {
      const palette: RGB[] = [acc, acc2, light ? [40, 60, 50] : [255, 255, 255]];
      for (const bk of bokeh) {
        bk.x += bk.vx; bk.y += bk.vy;
        if (bk.y < -0.15) { bk.y = 1.1; bk.x = Math.random(); }
        if (bk.x < -0.1) bk.x = 1.1; else if (bk.x > 1.1) bk.x = -0.1;
        const x = bk.x * W, y = bk.y * H;
        const a = bk.a * (0.7 + 0.3 * Math.sin(t * 0.8 + bk.ph));
        const gr = ctx.createRadialGradient(x, y, bk.r * 0.6, x, y, bk.r);
        const c = palette[bk.k];
        gr.addColorStop(0, rgba(c, a));
        gr.addColorStop(0.85, rgba(c, a * 1.3));
        gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(x, y, bk.r, 0, 6.283);
        ctx.fill();
      }
    }
  };
  loop();
}
