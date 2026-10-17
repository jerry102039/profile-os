// profile-os 進入點：初始化各模組、註冊動作、延遲載入 App
import { $, $$, D, t, register, run, on, toast, typing, bootTime, fmtDuration, mq, getPrefs, savePrefs, feat, isOn } from './core';
import { matchLocale } from '../i18n/locale';
import { initTheme, setMode, toggleMode, setWallpaper, nextWallpaper, setAccent, type Mode } from './theme';
import { initWM, openWin, closeWin, closeAll, cascade, tile, onFirstOpen, openFromHash, setTitle, topWindow, winBody } from './wm';
import { initTerminal, exec, focusTerminal } from './terminal';
import { initCtf } from './ctf';
import { initLauncher, toggleLauncher, closeLauncher, launcherOpen } from './launcher';
import { initSystem, closePopups, coffee } from './system';
import { initWallpaper } from './wallpaper';
import { initBoot, sleep, lock, shutdown, restart, panic } from './power';
import { initSelect, clearSelection, selectedIcons, selectAll } from './select';
import { initWidgets, addNote, toggleWidgets } from './widgets';
import { setPalette } from './theme';
import { HOME, mkdir, lookup } from './vfs';

/* ── 延遲載入的 App：第一次打開視窗時才下載程式 ── */
let finder: typeof import('./apps/finder') | null = null;
onFirstOpen('finder', async () => { finder = await import('./apps/finder'); finder.initFinder(); });
onFirstOpen('calculator', async () => (await import('./apps/calculator')).initCalculator());
onFirstOpen('calendar', async () => (await import('./apps/calendar')).initCalendar());
onFirstOpen('status', async () => (await import('./apps/status')).initStatus());
onFirstOpen('taskmgr', async () => (await import('./apps/taskmgr')).initTaskmgr());
onFirstOpen('editor', async () => (await import('./apps/editor')).initEditor());
onFirstOpen('appearance', async () => (await import('./apps/appearance')).initAppearance());
let music: typeof import('./apps/music') | null = null;
const loadMusic = async () => (music ??= await import('./apps/music'));
onFirstOpen('music', async () => (await loadMusic()).initMusic());
onFirstOpen('snake', async () => (await import('./apps/snake')).initSnake());
onFirstOpen('mines', async () => (await import('./apps/mines')).initMines());
onFirstOpen('g2048', async () => (await import('./apps/game2048')).init2048());
let dino: typeof import('./apps/dino') | null = null;
onFirstOpen('dino', async () => { dino = await import('./apps/dino'); dino.initDino(); });
on('open', (id: string) => { if (id === 'music') music?.resumeViz(); if (id === 'dino') dino?.resume(); });
onFirstOpen('resume', () => {
  // 沒有轉成圖片時才有 iframe，這時候打開視窗才載入 PDF
  const f = document.querySelector<HTMLIFrameElement>('#win-resume iframe');
  if (f?.dataset.src) { f.src = f.dataset.src; delete f.dataset.src; }
});

/* ── 專案詳情 ── */
function openProject(slug: string) {
  const art = $$('[data-detail]');
  if (!art.some((a) => a.dataset.detail === slug)) return;
  art.forEach((a) => (a.hidden = a.dataset.detail !== slug));
  setTitle('project', `~/projects/${slug}`);
  openWin('project', { hash: `projects/${slug}` });
  winBody('project').scrollTop = 0;
}
on('project', openProject);
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-project]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  openProject(a.dataset.project!);
});

/* ── 動作註冊表（選單、右鍵、快速開啟、檔案總管、終端機共用） ── */
register('open', (id) => id && openWin(id));
register('close', (id) => id && closeWin(id));
register('project', (slug) => slug && openProject(slug));
register('href', (url) => { if (url) location.href = url; });
register('viewer', (path) => {
  const n = path ? lookup(path) : null;
  if (!n) return;
  $('#viewer-text').textContent = n.text ?? '';
  setTitle('viewer', `${n.name} — ${t.appNames.viewer}`);
  openWin('viewer', { hash: 'viewer' });
});
register('sysinfo', () => openWin('sysinfo'));
register('launcher', () => toggleLauncher());
register('download-resume', () => {
  if (!D.resume) return;
  const a = document.createElement('a');
  a.href = D.resume;
  a.download = D.resumeName;
  a.click();
});
register('close-all', closeAll);
register('tile', tile);
register('cascade', cascade);
register('toast', (k) => {
  const v = k ? (t.toast as Record<string, unknown>)[k] : null;
  if (typeof v === 'string') toast(v);
});
register('copy-email', async () => {
  try { await navigator.clipboard.writeText(D.email); toast(t.toast.copied); } catch { toast(D.email); }
});
register('mode', (m) => (m === 'toggle' ? toggleMode() : setMode(m as Mode, true)));
register('wallpaper', (w) => (w === 'next' ? nextWallpaper() : w && setWallpaper(w, true)));
register('accent', (c) => c && setAccent(c));
register('fullscreen', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
register('term', (cmd) => cmd && exec(cmd));
register('open-trash', async () => { if (!isOn('finder')) return; await openWin('finder'); finder?.openPath('/Trash'); });
register('coffee', coffee);
// 切換語言：到另一個語言的首頁，保留 #視窗 深連結
const goLang = (code?: string) => { const l = D.locales.find((x) => x.code === code); if (l) location.href = l.href + location.hash; };
register('lang', goLang);
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-lang]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  goLang(a.dataset.lang);
});
register('sleep', sleep);
register('lock', lock);
register('shutdown', shutdown);
register('restart', restart);
// 彩蛋（kernel panic、彩帶、小火車）可以在 profile.yaml 用 features.easterEggs 關掉
register('panic', () => { if (feat('easterEggs')) panic(); });
register('party', async () => { if (feat('easterEggs')) (await import('./fx')).confetti(); });
register('sl', async () => { if (feat('easterEggs')) (await import('./fx')).train(); });
register('select-all', selectAll);
// 編輯器關掉時，打開文字檔改用唯讀的文字檢視器
register('nano', async (p) => { if (!isOn('editor')) return void (p && run(`viewer:${p}`)); (await import('./apps/editor')).openEditor(p || null); });
register('music', async (arg) => (await loadMusic()).command(arg));
register('add-note', () => { if (feat('widgets.notes')) addNote(); });
register('widgets', toggleWidgets);
register('palette', (p) => p && setPalette(p, true));
register('finder', async (p) => { if (!isOn('finder')) return; await openWin('finder'); if (p) finder?.openPath(p); });
register('new-folder', () => {
  if (!isOn('finder')) return;
  let i = 1, name = t.ctx.newFolder;
  while (lookup(`${HOME}/Desktop/${name}`)) name = `${t.ctx.newFolder} ${++i}`;
  mkdir(`${HOME}/Desktop/${name}`);
});
register('cert', (id) => {
  const c = D.certItems.find((x) => x.id === id);
  if (!c?.available) return;
  const f = $<HTMLIFrameElement>('#pdf-frame');
  const img = $<HTMLImageElement>('#pdf-img');
  const wrap = $('#pdf-imgwrap');
  const src = `/certs/${c.file}`;
  // 有 PNG 就用圖片預覽（清楚又快），沒有才退回瀏覽器的 PDF 檢視器
  wrap.hidden = !c.image;
  f.hidden = !!c.image;
  if (c.image) { img.src = c.image; img.alt = c.title; }
  else if (f.getAttribute('src') !== src) f.src = src;
  $('#pdf-name').textContent = `${c.title} · ${c.issuer}`;
  const dl = $<HTMLAnchorElement>('#pdf-dl');
  dl.href = src;
  dl.download = c.file;
  setTitle('pdf', c.title);
  openWin('pdf', { hash: `certs/${c.id}` });
});
on('cert', (id: string) => run(`cert:${id}`));

/* ── 桌面上顯示訪客自己建立的檔案（~/Desktop） ── */
function syncDesktop() {
  const nav = $('.icons');
  $$('.icon.user', nav).forEach((e) => e.remove());
  const desk = lookup(`${HOME}/Desktop`);
  desk?.children?.filter((c) => c.user).forEach((c) => {
    const b = document.createElement('button');
    b.className = 'icon user';
    b.dataset.app = '';
    b.dataset.act = c.kind === 'dir' ? `finder:${HOME}/Desktop/${c.name}` : `nano:${HOME}/Desktop/${c.name}`;
    const tile = document.createElement('span');
    tile.className = 'icon-tile';
    tile.textContent = c.kind === 'dir' ? '▰' : '≡';
    const label = document.createElement('span');
    label.className = 'icon-label';
    label.textContent = c.name;
    b.append(tile, label);
    nav.append(b);
  });
}
on('vfs', syncDesktop);

/* ── 全域快捷鍵 ── */
addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); closePopups(); toggleLauncher(); return; }
  if ((e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'q') || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l')) { e.preventDefault(); lock(); return; }
  if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'f') { e.preventDefault(); run('fullscreen'); return; }
  if (e.key === 'Escape') {
    if (launcherOpen()) return closeLauncher();
    if (!$('#qs').hidden || !$('#ctx').hidden || document.querySelector('.mb-menu.open')) return closePopups();
    if (selectedIcons().length && !typing(e)) return clearSelection();
    if (!typing(e) || (e.target as HTMLElement).id === 'term-input') {
      const top = topWindow();
      if (top) closeWin(top.id);
    }
  }
});

/* ── 系統資訊視窗的運作時間 ── */
setInterval(() => {
  const el = document.getElementById('sys-uptime');
  if (el && !document.hidden) el.textContent = fmtDuration(Date.now() - bootTime);
}, 1000);

/* ── 開機 ── */
initTheme();
initWM();
initTerminal();
if (feat('ctf')) initCtf();
initLauncher();
initSystem();
initWallpaper();
initSelect();
initWidgets();
syncDesktop();
// 開機後依 profile.yaml 的 startup 打開視窗（最後一個在最上面）；手機一次只顯示一個視窗，所以只開最後一個
on('booted', async () => {
  if (openFromHash()) return;
  const list = mq.mobile.matches ? D.startup.slice(-1) : D.startup;
  for (const [i, id] of list.entries()) {
    if (i < list.length - 1) await openWin(id, { hash: '', bounce: false });
    else openWin(id, { hash: '' });
  }
});
// 第一次造訪：瀏覽器偏好的語言是另一個啟用中的語言 → 用那個語言提示一次，點了才切換（不自動跳轉）
on('booted', () => {
  if (getPrefs().langHint || D.locales.length < 2) return;
  savePrefs({ langHint: true });
  const want = matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language], D.locales.map((l) => l.id));
  const l = D.locales.find((x) => x.id === want);
  if (l && l.id !== D.locale) setTimeout(() => toast(`${l.suggest} → ${l.switch}`, '🌐', false, () => goLang(l.code)), 1500);
});
on('open', (id: string) => { if (id === 'about') setTimeout(focusTerminal, 50); });
initBoot();
