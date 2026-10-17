// 視窗管理：開／關／縮小／放大／聚焦／拖曳／排列，以及網址 hash 深層連結
import { $, $$, clamp, mq, t, emit, beep } from './core';

type Win = { id: string; el: HTMLElement; x: number; y: number; state: 'closed' | 'open' | 'min'; anim?: Animation };

let topZ = 120;
const wins = new Map<string, Win>();
const hooks = new Map<string, () => void | Promise<void>>();
const activeApp = $('#active-app');

/** 第一次打開某視窗時執行（用來延遲載入該 App 的程式） */
export const onFirstOpen = (id: string, fn: () => void | Promise<void>) => hooks.set(id, fn);

const place = (w: Win) => (w.el.style.transform = `translate(${w.x}px,${w.y}px)`);
const inner = (w: Win) => w.el.querySelector<HTMLElement>('.win-inner')!;

/* ── 動畫：縮小時飛進 Dock、還原時從 Dock 飛出；放大／還原用 FLIP 平滑變形 ── */
const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';

/** 該視窗在 Dock 上的按鈕位置；沒有按鈕的視窗（例如專案詳情）就飛向 Dock 中央 */
function dockTarget(id: string): DOMRect {
  const btn = $$(`.dock-btn[data-open="${id}"]`).find((b) => b.getClientRects().length);
  const dock = document.querySelector<HTMLElement>('.dock');
  if (btn) return btn.getBoundingClientRect();
  if (dock?.getClientRects().length) { const d = dock.getBoundingClientRect(); return new DOMRect(d.left + d.width / 2 - 20, d.top, 40, d.height); }
  return new DOMRect(innerWidth / 2 - 20, innerHeight - 40, 40, 40);
}

/** 視窗 ↔ Dock 的「神燈」動畫；toDock = true 是縮小 */
function genie(w: Win, toDock: boolean) {
  w.anim?.cancel();
  w.anim = undefined;
  if (mq.reduced.matches) return null;
  const el = inner(w);
  const r = el.getBoundingClientRect();
  const d = dockTarget(w.id);
  const dx = d.left + d.width / 2 - (r.left + r.width / 2);
  const dy = d.top + d.height / 2 - (r.top + r.height / 2);
  const sx = Math.max(0.05, d.width / r.width), sy = Math.max(0.05, d.height / r.height);
  const frames: Keyframe[] = [
    { transform: 'none', opacity: 1 },
    // 先往下縮窄、再收進 Dock，看起來像被吸進去
    { transform: `translate(${dx * 0.35}px, ${dy * 0.55}px) scale(${0.55 + sx * 0.45}, ${0.8 + sy * 0.2})`, opacity: 0.9, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 },
  ];
  const a = el.animate(toDock ? frames : frames.reverse(), {
    duration: toDock ? 380 : 340,
    easing: toDock ? 'cubic-bezier(.55, 0, .7, .4)' : EASE_OUT,
    fill: toDock ? 'forwards' : 'none', // 縮小停在最後一格，等隱藏後再取消，避免閃一下
  });
  w.anim = a;
  a.onfinish = () => { if (w.anim === a) w.anim = undefined; };
  return a;
}

/** FLIP：記下變化前的位置，套用新狀態後從舊位置平滑變形過去 */
function flip(w: Win, change: () => void) {
  const el = inner(w);
  const a = el.getBoundingClientRect();
  w.anim?.cancel();
  w.anim = undefined;
  change();
  if (mq.reduced.matches || w.el.hidden) return;
  const b = el.getBoundingClientRect();
  if (!b.width || !b.height) return;
  const anim = el.animate([
    { transformOrigin: '0 0', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
    { transformOrigin: '0 0', transform: 'none' },
  ], { duration: 300, easing: EASE_OUT });
  w.anim = anim;
  anim.onfinish = () => { if (w.anim === anim) w.anim = undefined; };
}

function setDock(id: string) {
  const w = wins.get(id)!;
  $$(`.dock-btn[data-open="${id}"]`).forEach((b) => {
    b.classList.toggle('is-open', w.state === 'open');
    b.classList.toggle('is-min', w.state === 'min');
  });
}

function refreshActive() {
  let top: Win | null = null;
  wins.forEach((w) => {
    const on = w.state === 'open';
    w.el.classList.toggle('inactive', on);
    if (on && (!top || Number(w.el.style.zIndex) > Number(top.el.style.zIndex))) top = w;
  });
  if (top) (top as Win).el.classList.remove('inactive');
  activeApp.textContent = top ? t.appNames[(top as Win).id] ?? (top as Win).id : t.appNames.desktop;
  emit('focus', top ? (top as Win).id : null);
}

export const isOpen = (id: string) => wins.get(id)?.state === 'open';
/** 所有視窗的 id 與狀態（工作管理員、ps 用） */
export const windowList = () => [...wins.values()].map(({ id, state, el }) => ({ id, state, el }));
export const topWindow = () => {
  let top: Win | null = null;
  wins.forEach((w) => { if (w.state === 'open' && (!top || Number(w.el.style.zIndex) > Number(top.el.style.zIndex))) top = w; });
  return top as Win | null;
};

export function focusWin(id: string) {
  const w = wins.get(id);
  if (!w) return;
  if (Number(w.el.style.zIndex) !== topZ) w.el.style.zIndex = String(++topZ);
  refreshActive();
}

function setHash(h: string) {
  const url = h ? `#${h}` : location.pathname + location.search;
  if (location.hash.slice(1) !== h) history.replaceState(null, '', url);
}

export async function openWin(id: string, opts: { hash?: string; bounce?: boolean } = {}) {
  const w = wins.get(id);
  if (!w) return;
  const hook = hooks.get(id);
  if (hook) {
    hooks.delete(id);
    // 部署新版後，舊分頁要載的 chunk 可能已經不在了 → 重新整理拿新版
    try { await hook(); } catch { location.reload(); return; }
  }
  const wasClosed = w.state === 'closed';
  const wasMin = w.state === 'min';
  w.el.hidden = false;
  if (w.state === 'closed') {
    // 依實際尺寸把視窗夾在畫面內
    w.x = clamp(w.x, 8, Math.max(8, innerWidth - w.el.offsetWidth - 16));
    w.y = clamp(w.y, 40, Math.max(40, innerHeight - w.el.offsetHeight - 90));
    place(w);
  }
  if (wasClosed) beep('open');
  if (wasMin) genie(w, false);
  w.state = 'open';
  focusWin(id);
  setDock(id);
  if (opts.bounce !== false && wasClosed) {
    $$(`.dock-btn[data-open="${id}"]`).forEach((b) => { b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce'); });
  }
  setHash(opts.hash ?? id);
  emit('open', id);
}

export function closeWin(id: string) {
  const w = wins.get(id);
  if (!w || w.state === 'closed') return;
  w.state = 'closed';
  w.anim?.cancel();
  w.el.classList.remove('is-max');
  w.el.hidden = true;
  setDock(id);
  beep('close');
  const [head, sub] = location.hash.slice(1).split('/');
  if ((head === id && !sub) || (id === 'project' && head === 'projects' && sub)) setHash('');
  refreshActive();
  emit('close', id);
}

export function minimizeWin(id: string) {
  const w = wins.get(id);
  if (!w || w.state !== 'open') return;
  w.state = 'min';
  const a = genie(w, true);
  if (a) a.addEventListener('finish', () => { if (w.state === 'min') { w.el.hidden = true; a.cancel(); } });
  else w.el.hidden = true;
  setDock(id);
  refreshActive();
  emit('close', id);
}

export function toggleMax(id: string) {
  const w = wins.get(id);
  if (w) flip(w, () => w.el.classList.toggle('is-max'));
}
export const closeAll = () => wins.forEach((w) => closeWin(w.id));
export const setTitle = (id: string, title: string) => { const el = wins.get(id)?.el.querySelector('[data-title]'); if (el) el.textContent = title; };
export const winBody = (id: string) => wins.get(id)!.el.querySelector<HTMLElement>('.win-body')!;

/** 層疊：每個開著的視窗往右下錯開 */
export function cascade() {
  let i = 0;
  [...wins.values()].filter((w) => w.state === 'open').forEach((w) => {
    w.el.classList.remove('is-max');
    w.x = 120 + i * 32; w.y = 50 + i * 32; i++;
    place(w); focusWin(w.id);
  });
}

/** 並排：依視窗數量切成格子，視窗寬度不變、位置對齊格子 */
export function tile() {
  const open = [...wins.values()].filter((w) => w.state === 'open');
  if (!open.length) return;
  const cols = Math.ceil(Math.sqrt(open.length));
  const rows = Math.ceil(open.length / cols);
  const cw = (innerWidth - 120) / cols, ch = (innerHeight - 140) / rows;
  open.forEach((w, i) => {
    w.el.classList.remove('is-max');
    w.x = 110 + (i % cols) * cw;
    w.y = 42 + Math.floor(i / cols) * ch;
    place(w);
  });
}

/** 依 hash 開啟視窗；回傳是否有對應 */
export function openFromHash(): boolean {
  const [id, ...rest] = location.hash.slice(1).split('/');
  if (!id || !wins.has(id)) return false;
  if (id === 'projects' && rest[0]) { emit('project', rest[0]); return true; }
  if (id === 'certs' && rest[0]) { emit('cert', rest[0]); return true; }
  openWin(id);
  return true;
}

export function initWM() {
  $$('[data-win]').forEach((el, i) => {
    const id = el.dataset.win!;
    const w: Win = { id, el, x: Number(el.dataset.x), y: Number(el.dataset.y), state: 'closed' };
    wins.set(id, w);
    el.style.zIndex = String(110 + i);
    place(w);
    el.addEventListener('pointerdown', () => focusWin(id));
    el.querySelector('[data-close]')!.addEventListener('click', (e) => { e.stopPropagation(); closeWin(id); });
    el.querySelector('[data-min]')!.addEventListener('click', (e) => { e.stopPropagation(); minimizeWin(id); });
    el.querySelector('[data-max]')!.addEventListener('click', (e) => { e.stopPropagation(); toggleMax(id); });

    const bar = el.querySelector<HTMLElement>('[data-drag]')!;
    bar.addEventListener('dblclick', (e) => { if (!(e.target as Element).closest('button')) toggleMax(id); });
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || mq.mobile.matches || el.classList.contains('is-max') || (e.target as Element).closest('button')) return;
      e.preventDefault();
      focusWin(id);
      const sx = e.clientX - w.x, sy = e.clientY - w.y;
      let raf = 0;
      bar.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        w.x = clamp(ev.clientX - sx, -w.el.offsetWidth + 120, innerWidth - 90);
        w.y = clamp(ev.clientY - sy, 34, innerHeight - 60);
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(w); });
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
  });

  // 開啟按鈕：桌面圖示、Dock
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-open]');
    if (!b) return;
    const id = b.dataset.open!;
    // Dock 上已經在最上層的視窗 → 縮小（跟 macOS 一樣）
    if (b.classList.contains('dock-btn') && topWindow()?.id === id && !mq.mobile.matches) minimizeWin(id);
    else openWin(id);
  });

  addEventListener('hashchange', openFromHash);
}
