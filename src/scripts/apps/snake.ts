// 貪食蛇：方向鍵／WASD／滑動操作，越吃越快，最高分存在瀏覽器
import { $, t, getPrefs, savePrefs, beep, typing, fmt } from '../core';
import { isOpen, topWindow } from '../wm';
import { accentRgb, accent2Rgb, isLight } from '../theme';

const N = 20;                       // 格數
const cv = $<HTMLCanvasElement>('#snake-cv');
const scoreEl = $('#snake-score');
const bestEl = $('#snake-best');
const msgEl = $('#snake-msg');
const G = () => t.games.snake;

type P = { x: number; y: number };
let snake: P[] = [];
let dir: P = { x: 1, y: 0 };
let queue: P[] = [];                 // 連按時排隊，避免 180 度回頭
let food: P = { x: 5, y: 5 };
let score = 0, best = getPrefs().snakeHi ?? 0;
let state: 'idle' | 'run' | 'pause' | 'over' = 'idle';
let timer = 0, raf = 0;

const same = (a: P, b: P) => a.x === b.x && a.y === b.y;
const rgb = ([r, g, b]: number[], a = 1) => `rgba(${r},${g},${b},${a})`;

function reset() {
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  dir = { x: 1, y: 0 };
  queue = [];
  score = 0;
  placeFood();
  paint();
}
function placeFood() {
  do food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
  while (snake.some((s) => same(s, food)));
}
const speed = () => Math.max(60, 150 - Math.floor(score / 3) * 8);

function start() {
  if (state === 'over' || state === 'idle') reset();
  state = 'run';
  schedule();
  paint();
}
function schedule() { clearTimeout(timer); timer = window.setTimeout(step, speed()); }
function step() {
  if (state !== 'run') return;
  if (queue.length) dir = queue.shift()!;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some((s) => same(s, head))) return gameOver();
  snake.unshift(head);
  if (same(head, food)) {
    score++;
    beep('click');
    if (score > best) { best = score; savePrefs({ snakeHi: best }); }
    placeFood();
  } else snake.pop();
  paint();
  schedule();
}
function gameOver() {
  state = 'over';
  beep('error');
  paint();
}
function turn(d: P) {
  const last = queue[queue.length - 1] ?? dir;
  if (d.x === -last.x && d.y === -last.y) return; // 不能直接回頭
  if (queue.length < 2) queue.push(d);
  if (state !== 'run') start();
}

function paint() {
  const size = cv.width / N;
  const ctx = cv.getContext('2d')!;
  const light = isLight();
  const acc = accentRgb(), acc2 = accent2Rgb();
  ctx.clearRect(0, 0, cv.width, cv.height);
  // 棋盤格
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x + y) % 2) { ctx.fillStyle = light ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.03)'; ctx.fillRect(x * size, y * size, size, size); }
  }
  // 食物
  ctx.fillStyle = rgb(acc2);
  ctx.beginPath();
  ctx.arc(food.x * size + size / 2, food.y * size + size / 2, size * 0.32, 0, 6.283);
  ctx.fill();
  // 蛇：頭最亮，往尾巴漸淡
  snake.forEach((s, i) => {
    const a = i === 0 ? 1 : Math.max(0.35, 1 - i / (snake.length + 4));
    ctx.fillStyle = rgb(light ? acc.map((v) => v * 0.6) : acc, a);
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(s.x * size + pad, s.y * size + pad, size - pad * 2, size - pad * 2, i === 0 ? 5 : 3);
    ctx.fill();
  });
  // 眼睛
  const h = snake[0];
  ctx.fillStyle = light ? '#fff' : '#06110b';
  const ex = h.x * size + size / 2 + dir.x * size * 0.18, ey = h.y * size + size / 2 + dir.y * size * 0.18;
  const ox = dir.y * size * 0.18, oy = dir.x * size * 0.18;
  ctx.beginPath(); ctx.arc(ex + ox, ey + oy, 2, 0, 6.283); ctx.arc(ex - ox, ey - oy, 2, 0, 6.283); ctx.fill();

  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  msgEl.textContent = state === 'idle' ? G().start : state === 'over' ? fmt(G().over, { score }) : state === 'pause' ? G().paused : '';
  msgEl.hidden = state === 'run';
}

const KEYS: Record<string, P> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };

export function initSnake() {
  reset();
  addEventListener('keydown', (e) => {
    if (!isOpen('snake') || topWindow()?.id !== 'snake' || typing(e) || e.metaKey || e.ctrlKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); turn(KEYS[k]); }
    else if (k === ' ' || k === 'p') { e.preventDefault(); if (state === 'run') { state = 'pause'; clearTimeout(timer); paint(); } else start(); }
    else if (k === 'Enter' && state !== 'run') { e.preventDefault(); start(); }
  });
  // 觸控：滑動
  let sx = 0, sy = 0;
  cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  cv.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { if (state !== 'run') start(); return; }
    turn(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
  });
  $('#snake-pad').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-dir]');
    if (b) turn(KEYS[b.dataset.dir!]);
  });
  // 視窗關掉或縮小就暫停
  const watch = () => { if (state === 'run' && !isOpen('snake')) { state = 'pause'; clearTimeout(timer); paint(); } raf = requestAnimationFrame(watch); };
  if (!raf) watch();
}
