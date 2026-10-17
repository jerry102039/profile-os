// 檔案總管：側邊欄、上一頁／下一頁、路徑列、圖示／列表、搜尋、隱藏檔、右鍵選單
import { $, $$, B, t, run, toast, beep, on, fmt, pn } from '../core';
import { HOME, lookup, resolve, isHidden, kindLabel, iconFor, mkdir, trash, emptyTrash, type VNode } from '../vfs';
import { setTitle, focusWin } from '../wm';

const root = $('#finder');
const items = $('#fd-items');
const crumbs = $('#fd-crumbs');
const status = $('#fd-status');
const search = $<HTMLInputElement>('#fd-search');
const emptyBtn = $('#fd-empty');

let path = HOME + '/Desktop';
let back: string[] = [];
let fwd: string[] = [];
let view: 'grid' | 'list' = 'grid';
let showHidden = false;
let selected: string | null = null;

const placeName = (p: string) => {
  if (p === HOME) return t.finder.places.home;
  const name = p.split('/').pop() || B.os;
  return name === 'home' ? name : t.finder.places[name] ?? name;
};

function render() {
  const node = lookup(path);
  if (!node || node.kind !== 'dir') { path = HOME; return render(); }
  const q = search.value.trim().toLowerCase();
  const list = (node.children ?? []).filter((c) => (showHidden || !isHidden(c)) && (!q || c.name.toLowerCase().includes(q)));

  // 路徑列
  crumbs.replaceChildren();
  const segs = path.split('/').filter(Boolean);
  const rootBtn = document.createElement('button');
  rootBtn.textContent = B.os;
  rootBtn.onclick = () => go('/');
  crumbs.append(rootBtn);
  segs.forEach((_, i) => {
    const sep = document.createElement('span');
    sep.textContent = '›';
    const b = document.createElement('button');
    const p = '/' + segs.slice(0, i + 1).join('/');
    b.textContent = placeName(p);
    b.onclick = () => go(p);
    crumbs.append(sep, b);
  });

  // 項目
  items.className = `fd-items ${view}`;
  items.replaceChildren();
  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'fd-empty';
    e.textContent = t.finder.empty;
    items.append(e);
  }
  for (const c of list) {
    const el = document.createElement('div');
    el.className = 'fd-item' + (selected === c.name ? ' sel' : '');
    el.dataset.name = c.name;
    el.setAttribute('role', 'option');
    const ico = document.createElement('span');
    ico.className = `fd-ico ${c.kind}${isHidden(c) ? ' hidden' : ''}`;
    ico.textContent = iconFor(c);
    const nm = document.createElement('span');
    nm.className = 'fd-name';
    nm.textContent = c.name;
    const kind = document.createElement('span');
    kind.className = 'fd-meta';
    kind.textContent = kindLabel(c);
    const size = document.createElement('span');
    size.className = 'fd-meta';
    size.textContent = c.kind === 'dir' ? '—' : c.size ?? '—';
    el.append(ico, nm, kind, size);
    items.append(el);
  }

  // 其餘狀態
  status.textContent = pn(t.finder.items, list.length);
  $$('.fd-place', root).forEach((b) => b.classList.toggle('active', b.dataset.path === path));
  $('[data-fd="back"]', root).toggleAttribute('disabled', !back.length);
  $('[data-fd="forward"]', root).toggleAttribute('disabled', !fwd.length);
  $('[data-fd="grid"]', root).classList.toggle('on', view === 'grid');
  $('[data-fd="list"]', root).classList.toggle('on', view === 'list');
  $('[data-fd="hidden"]', root).classList.toggle('on', showHidden);
  emptyBtn.hidden = path !== '/Trash';
  setTitle('finder', placeName(path));
}

export function go(p: string, record = true) {
  if (p === path) return;
  if (record) { back.push(path); fwd = []; }
  path = p;
  selected = null;
  search.value = '';
  render();
}

function openItem(name: string) {
  const p = resolve(path, name);
  const n = lookup(p) as VNode;
  if (!n) return;
  if (n.kind === 'trash') { beep('error'); return toast(t.finder.trashOpen, t.finder.title); }
  if (n.action?.startsWith('cd:')) return go(n.action.slice(3));
  if (n.kind === 'dir') return go(p);
  if (n.action) return run(n.action);
  if (n.user) return run(`nano:${p}`);
  if (n.text !== undefined) return run(`viewer:${p}`);
}

/* ── 右鍵選單（只在檔案總管裡） ── */
function itemMenu(e: MouseEvent, name: string) {
  const ctx = document.createElement('div');
  ctx.className = 'ctx';
  ctx.style.left = `${e.clientX}px`;
  ctx.style.top = `${e.clientY}px`;
  const mk = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { ctx.remove(); fn(); };
    return b;
  };
  const n = lookup(resolve(path, name))!;
  ctx.append(
    mk(t.finder.open, () => openItem(name)),
    mk(t.finder.info, () => toast(fmt(t.finder.infoToast, { name, kind: `${kindLabel(n)} · ${n.size ?? '—'}` }), t.finder.title)),
    document.createElement('hr'),
    mk(t.finder.trash, () => { const e = trash(resolve(path, name)); if (e) { beep('error'); toast(e, t.finder.title); } else render(); }),
  );
  document.body.append(ctx);
  const close = () => { ctx.remove(); removeEventListener('pointerdown', outside, true); };
  const outside = (ev: Event) => { if (!ctx.contains(ev.target as Node)) close(); };
  setTimeout(() => addEventListener('pointerdown', outside, true));
}

export function initFinder() {
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const place = el.closest<HTMLElement>('.fd-place');
    if (place) return go(place.dataset.path!);
    const tool = el.closest<HTMLElement>('[data-fd]');
    if (tool) {
      const a = tool.dataset.fd!;
      if (a === 'back' && back.length) { fwd.push(path); path = back.pop()!; selected = null; render(); }
      else if (a === 'forward' && fwd.length) { back.push(path); path = fwd.pop()!; selected = null; render(); }
      else if (a === 'grid' || a === 'list') { view = a; render(); }
      else if (a === 'hidden') { showHidden = !showHidden; render(); }
      else if (a === 'empty-trash') { const n = emptyTrash(); if (n) toast(pn(t.finder.items, n), t.finder.emptyTrash); else { beep('error'); toast(t.toast.trash, t.finder.title); } }
      else if (a === 'new-folder') {
        let i = 1, name = t.ctx.newFolder;
        while (lookup(`${path}/${name}`)) name = `${t.ctx.newFolder} ${++i}`;
        const e = mkdir(`${path}/${name}`);
        if (e) { beep('error'); toast(t.finder.denied, t.finder.title); } else { selected = name; render(); }
      }
      return;
    }
    const item = el.closest<HTMLElement>('.fd-item');
    selected = item?.dataset.name ?? null;
    $$('.fd-item', items).forEach((i) => i.classList.toggle('sel', i.dataset.name === selected));
  });
  items.addEventListener('dblclick', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fd-item');
    if (item) openItem(item.dataset.name!);
  });
  items.addEventListener('contextmenu', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fd-item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    selected = item.dataset.name!;
    $$('.fd-item', items).forEach((i) => i.classList.toggle('sel', i.dataset.name === selected));
    itemMenu(e, selected);
  });
  // 觸控裝置：點一下就開
  items.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fd-item');
    if (item) openItem(item.dataset.name!);
  });
  items.addEventListener('keydown', (e) => {
    const names = $$('.fd-item', items).map((i) => i.dataset.name!);
    const i = selected ? names.indexOf(selected) : -1;
    const cols = view === 'grid' ? Math.max(1, Math.floor(items.clientWidth / 98)) : 1;
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      selected = names[Math.max(0, Math.min(names.length - 1, i + move))] ?? null;
      render();
      items.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && selected) openItem(selected);
    else if (e.key === 'Backspace' || (e.key === 'ArrowUp' && e.metaKey)) { const up = resolve(path, '..'); if (up !== path) go(up); }
    else if (e.key === '.' && e.shiftKey && (e.metaKey || e.ctrlKey)) { showHidden = !showHidden; render(); }
  });
  search.addEventListener('input', render);
  on('vfs', render);
  render();
  focusWin('finder');
}

/** 從外部打開某個資料夾（例如 Dock 的垃圾桶） */
export const openPath = (p: string) => go(p);
