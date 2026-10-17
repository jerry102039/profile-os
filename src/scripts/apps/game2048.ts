// 2048：方向鍵／WASD／滑動合併方塊，最高分存在瀏覽器
import { $, t, getPrefs, savePrefs, beep, typing, fmt } from '../core';
import { isOpen, topWindow } from '../wm';

type Tile = { id: number; v: number; r: number; c: number; el: HTMLElement; dead?: boolean };
const N = 4;
const grid = $('#g2048-grid');
const scoreEl = $('#g2048-score');
const bestEl = $('#g2048-best');
const msgEl = $('#g2048-msg');
const G = () => t.games.g2048;

let tiles: Tile[] = [];
let score = 0, best = getPrefs().g2048Best ?? 0, nextId = 1;
let over = false, won = false, keepGoing = false, busy = false;

const at = (r: number, c: number) => tiles.find((x) => !x.dead && x.r === r && x.c === c);
const place = (x: Tile) => { x.el.style.setProperty('--r', String(x.r)); x.el.style.setProperty('--c', String(x.c)); };

function spawn() {
  const empty: [number, number][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!at(r, c)) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const el = document.createElement('div');
  const v = Math.random() < 0.9 ? 2 : 4;
  el.className = `tile new v${v}`;
  el.textContent = String(v);
  const tile: Tile = { id: nextId++, v, r, c, el };
  place(tile);
  grid.append(el);
  tiles.push(tile);
}

function reset() {
  tiles.forEach((x) => x.el.remove());
  tiles = [];
  score = 0; over = false; won = false; keepGoing = false;
  spawn(); spawn();
  paint();
}

function canMove() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = at(r, c);
    if (!x) return true;
    if ((c + 1 < N && at(r, c + 1)?.v === x.v) || (r + 1 < N && at(r + 1, c)?.v === x.v)) return true;
  }
  return false;
}

/** dr/dc = 方向；每一行（或列）從靠近邊的那端開始處理 */
function move(dr: number, dc: number) {
  if (busy || over) return;
  let moved = false;
  const order = [...Array(N).keys()];
  const rows = dr === 1 ? [...order].reverse() : order;
  const cols = dc === 1 ? [...order].reverse() : order;
  const mergedIds = new Set<number>();
  for (const r of rows) for (const c of cols) {
    const x = at(r, c);
    if (!x) continue;
    let nr = r, nc = c;
    while (nr + dr >= 0 && nr + dr < N && nc + dc >= 0 && nc + dc < N && !at(nr + dr, nc + dc)) { nr += dr; nc += dc; }
    const nxt = nr + dr >= 0 && nr + dr < N && nc + dc >= 0 && nc + dc < N ? at(nr + dr, nc + dc) : undefined;
    if (nxt && nxt.v === x.v && !mergedIds.has(nxt.id)) {
      // 合併：舊的滑過去後消失，目標變兩倍
      x.dead = true; x.r = nxt.r; x.c = nxt.c; place(x);
      nxt.v *= 2; mergedIds.add(nxt.id);
      score += nxt.v;
      if (nxt.v === 2048 && !won) { won = true; }
      moved = true;
    } else if (nr !== r || nc !== c) { x.r = nr; x.c = nc; place(x); moved = true; }
  }
  if (!moved) return;
  busy = true;
  beep('click');
  setTimeout(() => {
    tiles.filter((x) => x.dead).forEach((x) => x.el.remove());
    tiles = tiles.filter((x) => !x.dead);
    for (const id of mergedIds) {
      const x = tiles.find((y) => y.id === id)!;
      x.el.textContent = String(x.v);
      x.el.className = `tile merged v${Math.min(x.v, 4096)}`;
    }
    spawn();
    if (score > best) { best = score; savePrefs({ g2048Best: best }); }
    if (!canMove()) { over = true; beep('error'); }
    busy = false;
    paint();
  }, 110);
  paint();
}

function paint() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  const showWin = won && !keepGoing;
  msgEl.hidden = !(over || showWin);
  msgEl.textContent = over ? fmt(G().over, { score }) : showWin ? G().won : '';
  msgEl.classList.toggle('win', showWin && !over);
}

const KEYS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };

export function init2048() {
  reset();
  addEventListener('keydown', (e) => {
    if (!isOpen('g2048') || topWindow()?.id !== 'g2048' || typing(e) || e.metaKey || e.ctrlKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); if (won && !keepGoing) keepGoing = true; move(...KEYS[k]); }
    else if (k === 'Enter' && (over || (won && !keepGoing))) { e.preventDefault(); if (over) reset(); else { keepGoing = true; paint(); } }
  });
  let sx = 0, sy = 0;
  grid.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  grid.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (won && !keepGoing) keepGoing = true;
    Math.abs(dx) > Math.abs(dy) ? move(0, Math.sign(dx)) : move(Math.sign(dy), 0);
  });
  $('#g2048-new').addEventListener('click', reset);
  msgEl.addEventListener('click', () => { if (over) reset(); else { keepGoing = true; paint(); } });
}
