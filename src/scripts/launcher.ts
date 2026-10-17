// 快速開啟（Ctrl/⌘ + K）：搜尋視窗、專案、筆記、動作
import { $, D, t, run, fmt, isOn, feat } from './core';
import { PALETTES, WALLPAPERS, wallpaperName } from './theme';

type Item = { group: keyof typeof t.launcher.groups; icon: string; label: string; hint?: string; action: string; keys?: string };

const box = $('#launcher');
const input = $<HTMLInputElement>('#launcher-input');
const list = $('#launcher-list');
let shown: Item[] = [];
let active = 0;
let lastFocus: HTMLElement | null = null;

const APP_ICONS: Record<string, string> = {
  finder: '◫', about: '>_', projects: '▤', notes: '✎', skills: '%', status: '◉', calculator: '±', calendar: '▦', contact: '@', resume: '↓', sysinfo: '◈', taskmgr: '◔', music: '♫', certs: '⎙', appearance: '◑', snake: '🐍', dino: '🦖', mines: '✸', g2048: '⊞',
};

function items(): Item[] {
  const A = t.launcher.actions;
  const apps: Item[] = Object.entries(APP_ICONS).filter(([id]) => isOn(id)).map(([id, icon]) => ({ group: 'app', icon, label: t.appNames[id], hint: id, action: id === 'sysinfo' ? 'sysinfo' : `open:${id}`, keys: id }));
  const projects: Item[] = D.projects.map((p) => ({ group: 'project', icon: '▤', label: p.title, hint: p.slug, action: `project:${p.slug}`, keys: p.desc }));
  const notes: Item[] = D.notes.map((n) => ({ group: 'note', icon: '✎', label: n.title, action: `href:${n.href}`, keys: n.desc }));
  const certs: Item[] = D.certItems.filter((c) => c.available).map((c) => ({ group: 'cert', icon: '⎙', label: c.title, hint: c.issuer, action: `cert:${c.id}`, keys: 'cert pdf 證照' }));
  const v = t.mb.view, ap = t.mb.apple;
  const actions: Item[] = [
    ...D.locales.filter((l) => l.code !== D.locale.toLowerCase()).map((l) => ({ group: 'action' as const, icon: '⇄', label: fmt(A.lang, { lang: l.name }), action: `lang:${l.code}`, keys: `language lang ${l.code} ${l.name}` })),
    { group: 'action', icon: '☀', label: v.light, action: 'mode:light', keys: 'theme light' },
    { group: 'action', icon: '☾', label: v.dark, action: 'mode:dark', keys: 'theme dark' },
    { group: 'action', icon: '◐', label: v.auto, action: 'mode:auto', keys: 'theme auto system' },
    ...D.accents.map((c) => ({ group: 'action' as const, icon: '●', label: `${A.accent} ${c}`, action: `accent:${c}`, keys: 'color accent' })),
    ...PALETTES.map((p) => ({ group: 'action' as const, icon: '◑', label: `${A.palette}：${t.appearance.palettes[p]}`, action: `palette:${p}`, keys: `theme palette ${p}` })),
    ...WALLPAPERS.map((w) => ({ group: 'action' as const, icon: '▦', label: `${A.wallpaper}：${wallpaperName(w)}`, action: `wallpaper:${w}`, keys: `wallpaper ${w}` })),
    ...(feat('widgets.notes') ? [{ group: 'action' as const, icon: '▤', label: A.note, action: 'add-note', keys: 'sticky note memo 便利貼' }] : []),
    ...(isOn('music') ? [{ group: 'action' as const, icon: '♫', label: A.music, action: 'music:play', keys: 'music play song' }] : []),
    ...(D.resume ? [{ group: 'action' as const, icon: '⤓', label: A.resume, action: 'download-resume', keys: 'cv pdf' }] : []),
    ...(feat('easterEggs') ? [{ group: 'action' as const, icon: '🎉', label: A.party, action: 'party', keys: 'confetti' }] : []),
    { group: 'action', icon: '☾', label: ap.sleep, action: 'sleep' },
    { group: 'action', icon: '🔒', label: ap.lock, action: 'lock' },
    { group: 'action', icon: '↻', label: ap.restart, action: 'restart', keys: 'reboot' },
    { group: 'action', icon: '⏻', label: ap.shutdown, action: 'shutdown', keys: 'power off' },
  ];
  return [...apps, ...projects, ...notes, ...certs, ...actions];
}

/** 子序列比對：字元依序出現就算命中，越緊湊分數越高 */
function score(q: string, s: string) {
  if (!q) return 1;
  s = s.toLowerCase();
  const direct = s.indexOf(q);
  if (direct >= 0) return 100 - direct;
  let i = 0, last = -1, gaps = 0;
  for (const ch of q) {
    const j = s.indexOf(ch, last + 1);
    if (j < 0) return 0;
    if (last >= 0) gaps += j - last - 1;
    last = j;
    i++;
  }
  return Math.max(1, 50 - gaps);
}

function render() {
  const q = input.value.trim().toLowerCase();
  shown = items()
    .map((it) => ({ it, s: Math.max(score(q, it.label), score(q, `${it.hint ?? ''} ${it.keys ?? ''}`) * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => (q ? b.s - a.s : 0))
    .map((x) => x.it)
    .slice(0, q ? 12 : 40);
  active = Math.min(active, Math.max(0, shown.length - 1));
  list.replaceChildren();
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = t.launcher.empty;
    list.append(li);
    return;
  }
  let group = '';
  shown.forEach((it, i) => {
    if (!q && it.group !== group) {
      group = it.group;
      const g = document.createElement('li');
      g.className = 'grp';
      g.textContent = t.launcher.groups[it.group];
      list.append(g);
    }
    const li = document.createElement('li');
    li.className = 'it' + (i === active ? ' active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === active));
    const ic = document.createElement('i');
    ic.textContent = it.icon;
    const lb = document.createElement('span');
    lb.textContent = it.label;
    li.append(ic, lb);
    if (it.hint) { const h = document.createElement('small'); h.textContent = it.hint; li.append(h); }
    li.addEventListener('pointermove', () => { if (active !== i) { active = i; paint(); } });
    li.addEventListener('click', () => choose(i));
    list.append(li);
  });
}

function paint() {
  list.querySelectorAll('.it').forEach((li, i) => {
    li.classList.toggle('active', i === active);
    li.setAttribute('aria-selected', String(i === active));
  });
  list.querySelector('.it.active')?.scrollIntoView({ block: 'nearest' });
}

function choose(i: number) {
  const it = shown[i];
  if (!it) return;
  closeLauncher();
  run(it.action);
}

export function openLauncher() {
  lastFocus = document.activeElement as HTMLElement;
  box.hidden = false;
  input.value = '';
  active = 0;
  render();
  input.focus();
}
export function closeLauncher() {
  if (box.hidden) return;
  box.hidden = true;
  lastFocus?.focus?.({ preventScroll: true });
}
export const launcherOpen = () => !box.hidden;
export const toggleLauncher = () => (box.hidden ? openLauncher() : closeLauncher());

export function initLauncher() {
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); closeLauncher(); }
  });
  box.addEventListener('pointerdown', (e) => { if (e.target === box) closeLauncher(); });
}
