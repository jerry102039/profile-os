// 小恐龍：致敬 Chrome 斷線時的那隻。空白鍵／↑ 跳、↓ 蹲、點畫面也能跳；越跑越快，最高分存在瀏覽器
import { $, t, getPrefs, savePrefs, beep, typing, fmt } from '../core';
import { isOpen, topWindow } from '../wm';
import { isLight } from '../theme';

const cv = $<HTMLCanvasElement>('#dino-cv');
const ctx = cv.getContext('2d')!;
const scoreEl = $('#dino-score');
const bestEl = $('#dino-best');
const msgEl = $('#dino-msg');
const G = () => t.games.dino;

const W = cv.width, H = cv.height, GROUND = H - 24;
const GRAVITY = 0.6, JUMP = -11;
type Ob = { x: number; w: number; h: number; y: number; kind: 'cactus' | 'bird'; frame: number };
let state: 'idle' | 'run' | 'over' = 'idle';
let y = 0, vy = 0, duck = false, legs = 0;
let speed = 6, dist = 0, score = 0, best = getPrefs().dinoHi ?? 0;
let obs: Ob[] = [], clouds: { x: number; y: number }[] = [], nextOb = 0;
let raf = 0, frame = 0;

// 用像素格畫恐龍，1 = 有顏色；兩種跑步腳 + 蹲下
const DINO = [
  '      ######', '     ##.#####', '     ########', '     #####', '     ########', '#   #####', '##  ######', '###########', ' #########', '  #######', '   #####', '    ## ##', '    #   #', '    ##  ##',
];
const DINO_LEG2 = [...DINO.slice(0, 11), '    ## ##', '    ##  #', '     #  ##'];
const DUCK = [
  '', '', '', '', '', '', '', '          ######', '#   #####.#####', '###############', ' #############', '   ########', '    ## ##', '    ##  ##',
];
const CACTUS = ['  # ', '# # ', '### ', ' #  ', ' #  ', ' #  '];
const BIRD = ['  ##     ', ' ###     ', '#######  ', ' ########', '  ####   '];
const BIRD2 = ['         ', '#######  ', ' ########', '  ####   ', '   ##    '];

function sprite(rows: string[], x: number, yTop: number, px: number, color: string, eye?: string) {
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const ch = rows[r][c];
    if (ch === '#') { ctx.fillStyle = color; ctx.fillRect(x + c * px, yTop + r * px, px, px); }
    else if (ch === '.' && eye) { ctx.fillStyle = eye; ctx.fillRect(x + c * px, yTop + r * px, px, px); }
  }
}

function reset() {
  y = 0; vy = 0; duck = false; speed = 6; dist = 0; score = 0; obs = []; nextOb = 60;
  clouds = Array.from({ length: 3 }, (_, i) => ({ x: 150 + i * 220, y: 20 + Math.random() * 40 }));
}
function start() { reset(); state = 'run'; msgEl.hidden = true; if (!raf) loop(); }
function jump() {
  if (state !== 'run') { start(); return; }
  if (y === 0) { vy = JUMP; beep('click'); }
}
function gameOver() {
  state = 'over';
  beep('error');
  if (score > best) { best = score; savePrefs({ dinoHi: best }); }
  msgEl.textContent = fmt(G().over, { score });
  msgEl.hidden = false;
  draw();
}

/** k = 這一幀相當於幾個 60fps 的幀，讓 120Hz 螢幕和被降速的分頁跑一樣快 */
function update(k: number) {
  frame++;
  dist += speed * k;
  score = Math.floor(dist / 10);
  speed = Math.min(14, 6 + Math.floor(dist / 3000) * 0.5);
  vy += GRAVITY * k;
  y = Math.min(0, y + vy * k);
  if (y === 0) vy = 0;
  if (Math.floor(dist / 40) % 2 === 0) legs = 0; else legs = 1;
  clouds.forEach((c) => { c.x -= speed * 0.3 * k; if (c.x < -60) { c.x = W + Math.random() * 100; c.y = 20 + Math.random() * 40; } });
  // 障礙物
  nextOb -= speed * k;
  if (nextOb <= 0) {
    const bird = score > 200 && Math.random() < 0.3;
    const n = bird ? 1 : 1 + Math.floor(Math.random() * Math.min(3, 1 + score / 150));
    const px = 4;
    obs.push(bird
      ? { x: W, w: 9 * px, h: 5 * px, y: GROUND - [40, 60, 24][Math.floor(Math.random() * 3)], kind: 'bird', frame: 0 }
      : { x: W, w: n * 4 * px + (n - 1) * 4, h: 6 * px, y: GROUND - 6 * px, kind: 'cactus', frame: n });
    nextOb = 260 + Math.random() * 300 - Math.min(150, speed * 10);
  }
  obs = obs.filter((o) => o.x + o.w > -10);
  obs.forEach((o) => (o.x -= speed * k));
  // 碰撞：恐龍的方框縮一點，比較不會「明明沒碰到」
  const px = 4;
  const dh = duck ? 7 * px : 14 * px, dw = duck ? 15 * px : 12 * px;
  const dx = 30 + 6, dy = GROUND - dh + y + 4;
  for (const o of obs) {
    if (dx < o.x + o.w - 4 && dx + dw - 12 > o.x && dy < o.y + o.h && dy + dh - 6 > o.y) return gameOver();
  }
}

function draw() {
  const light = isLight();
  const ink = light ? '#3a4a40' : '#cfe9db', dim = light ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.22)';
  ctx.clearRect(0, 0, W, H);
  // 雲、地面
  ctx.fillStyle = dim;
  clouds.forEach((c) => { ctx.fillRect(c.x, c.y + 4, 36, 4); ctx.fillRect(c.x + 8, c.y, 20, 4); });
  ctx.fillRect(0, GROUND, W, 2);
  for (let i = 0; i < 12; i++) ctx.fillRect(((i * 97 - dist) % (W + 40) + W + 40) % (W + 40) - 20, GROUND + 6 + (i % 3) * 3, 6, 2);
  // 障礙物
  const px = 4;
  obs.forEach((o) => {
    if (o.kind === 'bird') sprite(Math.floor(dist / 60) % 2 ? BIRD : BIRD2, o.x, o.y, px, ink);
    else for (let i = 0; i < o.frame; i++) sprite(CACTUS, o.x + i * (4 * px + 4), o.y, px, ink);
  });
  // 恐龍
  const rows = duck && y === 0 ? DUCK : state === 'run' && y === 0 ? (legs ? DINO_LEG2 : DINO) : DINO;
  sprite(rows, 30, GROUND - 14 * px + y, px, ink, light ? '#fff' : '#06110b');
  scoreEl.textContent = String(score).padStart(5, '0');
  bestEl.textContent = String(best).padStart(5, '0');
}

let last = 0;
function loop(now = performance.now()) {
  raf = 0;
  if (!isOpen('dino')) { if (state === 'run') { state = 'idle'; msgEl.textContent = G().start; msgEl.hidden = false; } last = 0; return; }
  const k = last ? Math.min(4, (now - last) / 16.667) : 1;
  last = now;
  if (state === 'run') update(k);
  draw();
  raf = requestAnimationFrame(loop);
}

export function initDino() {
  reset();
  msgEl.textContent = G().start;
  draw();
  addEventListener('keydown', (e) => {
    if (!isOpen('dino') || topWindow()?.id !== 'dino' || typing(e) || e.metaKey || e.ctrlKey) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); jump(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); duck = true; if (state === 'run' && y < 0) vy += 4; }
    else if (e.key === 'Enter' && state !== 'run') { e.preventDefault(); start(); }
  });
  addEventListener('keyup', (e) => { if (e.key === 'ArrowDown' || e.key === 's') duck = false; });
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
  $('#dino-jump').addEventListener('click', jump);
  const duckBtn = $('#dino-duck');
  duckBtn.addEventListener('pointerdown', () => (duck = true));
  duckBtn.addEventListener('pointerup', () => (duck = false));
  duckBtn.addEventListener('pointerleave', () => (duck = false));
  // 視窗打開時恢復畫面更新
  addEventListener('focus', () => { if (!raf && isOpen('dino')) loop(); }, true);
  loop();
}

/** 視窗重新打開時叫一下，讓畫面繼續更新 */
export const resume = () => { if (!raf && isOpen('dino')) loop(); };
