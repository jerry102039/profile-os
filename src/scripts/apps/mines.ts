// 踩地雷：左鍵翻開、右鍵（或長按）插旗、點數字自動翻開周圍；第一下永遠安全，最佳時間存在瀏覽器
import { $, $$, t, getPrefs, savePrefs, beep, fmt } from '../core';

type Level = 'b' | 'i';
const LEVELS: Record<Level, { w: number; h: number; mines: number }> = { b: { w: 9, h: 9, mines: 10 }, i: { w: 16, h: 16, mines: 40 } };
type Cell = { mine: boolean; open: boolean; flag: boolean; n: number; el: HTMLButtonElement };

const board = $('#mines-board');
const countEl = $('#mines-count');
const timeEl = $('#mines-time');
const face = $('#mines-face');
const bestEl = $('#mines-best');
const G = () => t.games.mines;

let level: Level = 'b';
let cells: Cell[] = [];
let state: 'ready' | 'run' | 'won' | 'lost' = 'ready';
let flags = 0, opened = 0, time = 0, timer = 0;
const dim = () => LEVELS[level];
const idx = (r: number, c: number) => r * dim().w + c;
const best = () => getPrefs().minesBest?.[level];

function neighbors(i: number) {
  const { w, h } = dim();
  const r = Math.floor(i / w), c = i % w, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(idx(rr, cc));
  }
  return out;
}

function build() {
  const { w, h } = dim();
  clearInterval(timer);
  state = 'ready'; flags = 0; opened = 0; time = 0;
  board.style.setProperty('--w', String(w));
  board.classList.toggle('big', level === 'i');
  board.replaceChildren();
  cells = Array.from({ length: w * h }, (_, i) => {
    const el = document.createElement('button');
    el.className = 'mc';
    el.dataset.i = String(i);
    el.setAttribute('aria-label', `${Math.floor(i / w) + 1},${(i % w) + 1}`);
    board.append(el);
    return { mine: false, open: false, flag: false, n: 0, el };
  });
  $$('#mines-levels button').forEach((b) => b.classList.toggle('on', b.dataset.level === level));
  paint();
}

/** 第一下點到才放地雷，而且點的那格和周圍都不放 */
function plant(safe: number) {
  const avoid = new Set([safe, ...neighbors(safe)]);
  let left = dim().mines;
  while (left) {
    const i = Math.floor(Math.random() * cells.length);
    if (avoid.has(i) || cells[i].mine) continue;
    cells[i].mine = true;
    left--;
  }
  cells.forEach((c, i) => (c.n = neighbors(i).filter((j) => cells[j].mine).length));
  state = 'run';
  timer = window.setInterval(() => { time++; timeEl.textContent = String(Math.min(999, time)).padStart(3, '0'); }, 1000);
}

function open(i: number) {
  const c = cells[i];
  if (c.open || c.flag || state === 'won' || state === 'lost') return;
  if (state === 'ready') plant(i);
  c.open = true;
  opened++;
  if (c.mine) return lose(i);
  if (c.n === 0) neighbors(i).forEach(open);
  if (opened === cells.length - dim().mines) win();
}
function chord(i: number) {
  const c = cells[i];
  if (!c.open || !c.n) return;
  const ns = neighbors(i);
  if (ns.filter((j) => cells[j].flag).length !== c.n) return;
  ns.forEach((j) => open(j));
}
function flag(i: number) {
  const c = cells[i];
  if (c.open || state === 'won' || state === 'lost') return;
  c.flag = !c.flag;
  flags += c.flag ? 1 : -1;
}
function lose(hit: number) {
  state = 'lost';
  clearInterval(timer);
  beep('error');
  cells.forEach((c, i) => { if (c.mine) c.open = true; if (i === hit) c.el.classList.add('hit'); });
}
function win() {
  state = 'won';
  clearInterval(timer);
  beep('open');
  cells.forEach((c) => { if (c.mine) c.flag = true; });
  flags = dim().mines;
  const b = best();
  if (!b || time < b) savePrefs({ minesBest: { ...(getPrefs().minesBest ?? {}), [level]: time } });
}

function paint() {
  cells.forEach((c) => {
    c.el.className = 'mc' + (c.open ? ' open' : '') + (c.flag ? ' flag' : '') + (c.open && c.mine ? ' mine' : '') + (c.el.classList.contains('hit') ? ' hit' : '') + (state === 'lost' && c.flag && !c.mine ? ' wrong' : '');
    c.el.dataset.n = c.open && !c.mine && c.n ? String(c.n) : '';
    c.el.textContent = c.open ? (c.mine ? '✸' : c.n ? String(c.n) : '') : c.flag ? '⚑' : '';
  });
  countEl.textContent = String(Math.max(0, dim().mines - flags)).padStart(3, '0');
  timeEl.textContent = String(Math.min(999, time)).padStart(3, '0');
  face.textContent = state === 'won' ? '😎' : state === 'lost' ? '😵' : '🙂';
  const b = best();
  bestEl.textContent = b ? `${G().best} ${b}s` : '';
  $('#mines-msg').textContent = state === 'won' ? fmt(G().won, { s: time }) : state === 'lost' ? G().lost : '';
}

export function initMines() {
  level = (getPrefs().minesLevel as Level) || 'b';
  build();
  // 滑鼠：左鍵翻、右鍵旗、同時按或點數字＝周圍全翻
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  let pressTimer = 0, longPressed = false;
  board.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mc');
    if (!el) return;
    const i = Number(el.dataset.i);
    if (e.button === 2) { e.preventDefault(); flag(i); paint(); return; }
    if (e.button !== 0) return;
    face.textContent = '😮';
    longPressed = false;
    clearTimeout(pressTimer);
    if (e.pointerType === 'touch') pressTimer = window.setTimeout(() => { longPressed = true; flag(i); paint(); }, 380);
  });
  board.addEventListener('pointerup', (e) => {
    clearTimeout(pressTimer);
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mc');
    if (!el || e.button !== 0) { paint(); return; }
    if (longPressed) return;
    const i = Number(el.dataset.i);
    if (cells[i].open) chord(i); else open(i);
    paint();
  });
  board.addEventListener('pointerleave', () => { clearTimeout(pressTimer); if (state === 'run' || state === 'ready') face.textContent = '🙂'; });
  face.addEventListener('click', build);
  $('#mines-levels').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
    if (!b) return;
    level = b.dataset.level as Level;
    savePrefs({ minesLevel: level });
    build();
  });
}
