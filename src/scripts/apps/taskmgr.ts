// 工作管理員：處理程序（排序、選取、結束工作）與效能（CPU／記憶體／網路／畫面更新率即時圖表）
// 記憶體、網路、FPS、處理器數、解析度讀的是瀏覽器真的數值；CPU 是模擬值（瀏覽器不給網頁讀 CPU）
import { $, $$, t, toast, on, root, bootTime, fmtDuration, pn } from '../core';
import { isOpen, openWin } from '../wm';
import { procs, killProc, fmtMem, type Proc } from '../procs';

type Key = 'name' | 'pid' | 'user' | 'state' | 'cpu' | 'mem';
type MetricKey = 'cpu' | 'mem' | 'net' | 'fps';

const rowsEl = $('#tm-rows');
const endBtn = $<HTMLButtonElement>('#tm-end');
const HIST = 60;

let sortKey: Key = 'cpu';
let desc = true;
let selected: number | null = null;
let tab: 'procs' | 'perf' = 'procs';
let metric: MetricKey = 'cpu';
let current: Proc[] = [];

/* ── 取樣來源 ── */
type MemInfo = { usedJSHeapSize: number; jsHeapSizeLimit: number };
const heap = () => (performance as Performance & { memory?: MemInfo }).memory;
const conn = () => (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;
const deviceMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

// 網路：累計這個分頁真的下載的位元組（Resource Timing）
let netTotal = 0, netPrev = -1;
try {
  netTotal += (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.transferSize ?? 0;
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (netTotal += (e as PerformanceResourceTiming).transferSize || 0)))
    .observe({ type: 'resource', buffered: true });
} catch {}

// FPS：工作管理員開著時才量
let frames = 0, frameSum = 0, lastFrame = 0, raf = 0, fps = 0, frameMs = 0;
function loop(now: number) {
  if (!isOpen('taskmgr')) { raf = 0; return; }
  if (lastFrame) { frames++; frameSum += now - lastFrame; }
  lastFrame = now;
  raf = requestAnimationFrame(loop);
}
const startLoop = () => { if (!raf) { lastFrame = 0; raf = requestAnimationFrame(loop); } };

const hist: Record<MetricKey, number[]> = { cpu: [], mem: [], net: [], fps: [] };
const push = (k: MetricKey, v: number) => { hist[k].push(v); if (hist[k].length > HIST) hist[k].shift(); };
const lastOf = (k: MetricKey) => hist[k][hist[k].length - 1] ?? 0;

function sample() {
  current = procs();
  push('cpu', Math.min(100, current.reduce((s, p) => s + p.cpu, 0)));
  const h = heap();
  push('mem', h ? h.usedJSHeapSize / 1048576 : current.reduce((s, p) => s + p.mem, 0));
  push('net', netPrev < 0 ? 0 : Math.max(0, netTotal - netPrev) / 1024);
  netPrev = netTotal;
  if (frames) { fps = Math.round(frames / (frameSum / 1000)); frameMs = frameSum / frames; }
  frames = 0; frameSum = 0;
  push('fps', fps);
}

/* ── 處理程序分頁 ── */
const cell = (cls: string, text: string) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };

function rowEl(p: Proc) {
  const r = document.createElement('div');
  r.className = 'tm-row' + (p.pid === selected ? ' sel' : '') + (p.win ? '' : ' sys');
  r.dataset.pid = String(p.pid);
  r.setAttribute('role', 'option');
  r.setAttribute('aria-selected', String(p.pid === selected));
  const name = cell('c-name', '');
  name.append(cell('tm-ico', p.icon), cell('tm-nm', p.name));
  const cpu = cell('c-cpu', `${p.cpu.toFixed(1)}%`);
  cpu.style.setProperty('--heat', String(Math.min(1, p.cpu / 25)));
  r.append(name, cell('c-pid', String(p.pid)), cell('c-user', p.user), cell('c-state', t.tm.states[p.state] ?? p.state), cpu, cell('c-mem', fmtMem(p.mem)));
  return r;
}

function renderProcs() {
  const dir = desc ? -1 : 1;
  const list = [...current].sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
    return c * dir || a.pid - b.pid;
  });
  if (selected !== null && !list.some((p) => p.pid === selected)) selected = null;
  rowsEl.replaceChildren(...list.map(rowEl));
  endBtn.disabled = selected === null;
  const cpu = Math.round(lastOf('cpu'));
  $('#tm-summary').textContent = pn(t.tm.summary, list.length, { cpu, mem: fmtMem(list.reduce((s, p) => s + p.mem, 0)) });
  $$('#tm [data-sort]').forEach((b) => {
    const on = b.dataset.sort === sortKey;
    b.classList.toggle('sorted', on);
    b.dataset.dir = on ? (desc ? '▾' : '▴') : '';
  });
}

function select(pid: number | null) {
  selected = pid;
  $$('.tm-row[data-pid]', rowsEl).forEach((r) => {
    const on = Number(r.dataset.pid) === pid;
    r.classList.toggle('sel', on);
    r.setAttribute('aria-selected', String(on));
    if (on) r.scrollIntoView({ block: 'nearest' });
  });
  endBtn.disabled = pid === null;
}

function endSelected() {
  if (selected === null) return;
  const res = killProc(selected);
  toast(res.msg, t.appNames.taskmgr, true);
  selected = null;
  if (isOpen('taskmgr')) { current = procs(); renderProcs(); }
}

/* ── 效能分頁 ── */
const css = (v: string) => getComputedStyle(root).getPropertyValue(v).trim();
const COLORS: Record<MetricKey, () => string> = {
  cpu: () => css('--acc') || '#5dffa6',
  mem: () => '#b48cff',
  net: () => '#6cb6ff',
  fps: () => '#febc2e',
};

function scaleMax(k: MetricKey) {
  if (k === 'cpu') return 100;
  if (k === 'fps') return Math.max(60, ...hist.fps) * 1.1;
  if (k === 'mem') { const h = heap(); return h ? Math.max(...hist.mem, 1) * 1.6 : Math.max(...hist.mem, 1) * 1.4; }
  return Math.max(16, ...hist.net) * 1.25;
}

function valueText(k: MetricKey) {
  const v = lastOf(k);
  if (k === 'cpu') return `${Math.round(v)}%`;
  if (k === 'mem') return fmtMem(v);
  if (k === 'net') return `${v.toFixed(1)} KB/s`;
  return `${Math.round(v)} FPS`;
}

function draw(cv: HTMLCanvasElement, k: MetricKey, mini = false) {
  const dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const color = COLORS[k]();
  if (!mini) {
    ctx.strokeStyle = css('--line') || 'rgba(127,127,127,.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = Math.round((h / 4) * i) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let i = 1; i < 6; i++) { const x = Math.round((w / 6) * i) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }
  const data = hist[k];
  if (data.length < 2) return;
  const max = scaleMax(k);
  const step = w / (HIST - 1);
  const x0 = w - (data.length - 1) * step;
  const pt = (v: number, i: number) => [x0 + i * step, h - 1 - (Math.min(v, max) / max) * (h - 3)] as const;
  ctx.beginPath();
  data.forEach((v, i) => { const [x, y] = pt(v, i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = color;
  ctx.lineWidth = mini ? 1.2 : 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.lineTo(w, h);
  ctx.lineTo(x0, h);
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function stats(k: MetricKey): [string, string][] {
  const S = t.tm.stats;
  const unknown = t.tm.unknown;
  if (k === 'cpu') {
    return [
      [S.util, `${Math.round(lastOf('cpu'))}%`],
      [S.procs, String(current.length)],
      [S.cores, navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : unknown],
      [S.uptime, fmtDuration(Date.now() - bootTime)],
    ];
  }
  if (k === 'mem') {
    const h = heap();
    return [
      [S.heap, h ? fmtMem(h.usedJSHeapSize / 1048576) : unknown],
      [S.heapLimit, h ? fmtMem(h.jsHeapSizeLimit / 1048576) : unknown],
      [S.dom, document.getElementsByTagName('*').length.toLocaleString()],
      [S.device, deviceMem ? `${deviceMem} GB` : unknown],
    ];
  }
  if (k === 'net') {
    const c = conn();
    return [
      [S.rate, `${lastOf('net').toFixed(1)} KB/s`],
      [S.total, fmtMem(netTotal / 1048576)],
      [S.type, c?.effectiveType ?? unknown],
      [S.down, c?.downlink !== undefined ? `${c.downlink} Mbps` : unknown],
      [S.rtt, c?.rtt !== undefined ? `${c.rtt} ms` : unknown],
      [S.online, navigator.onLine ? t.tm.onlineYes : t.tm.onlineNo],
    ];
  }
  return [
    [S.fps, String(fps)],
    [S.frame, frameMs ? `${frameMs.toFixed(1)} ms` : '—'],
    [S.res, `${screen.width}×${screen.height}`],
    [S.refresh, `@${devicePixelRatio}x`],
  ];
}

const KEYS: MetricKey[] = ['cpu', 'mem', 'net', 'fps'];

function buildSide() {
  const side = $('#tm-side');
  side.replaceChildren(...KEYS.map((k) => {
    const b = document.createElement('button');
    b.className = 'tm-metric';
    b.dataset.metric = k;
    b.style.setProperty('--mc', COLORS[k]());
    const cv = document.createElement('canvas');
    const txt = document.createElement('span');
    txt.append(cell('tm-mname', t.tm.metrics[k]), cell('tm-mval', ''));
    b.append(cv, txt);
    return b;
  }));
  side.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-metric]');
    if (b) { metric = b.dataset.metric as MetricKey; renderPerf(); }
  });
}

function renderPerf() {
  $$('.tm-metric').forEach((b) => {
    const k = b.dataset.metric as MetricKey;
    b.classList.toggle('on', k === metric);
    b.style.setProperty('--mc', COLORS[k]());
    b.querySelector('.tm-mval')!.textContent = valueText(k);
    draw(b.querySelector('canvas')!, k, true);
  });
  $('#tm-title').textContent = t.tm.metrics[metric];
  $('#tm-big').textContent = valueText(metric);
  const g = $<HTMLCanvasElement>('#tm-graph');
  g.style.setProperty('--mc', COLORS[metric]());
  draw(g, metric);
  const real = metric !== 'cpu' && !(metric === 'mem' && !heap());
  $('#tm-src').textContent = (real ? '● ' + t.tm.measured : '◌ ' + t.tm.simulated) + (metric === 'mem' && heap() ? ' (JS heap)' : '');
  $('#tm-stats').replaceChildren(...stats(metric).map(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'tm-stat';
    d.append(cell('k', k), cell('v', v));
    return d;
  }));
}

function render() { tab === 'procs' ? renderProcs() : renderPerf(); }

function setTab(next: 'procs' | 'perf') {
  tab = next;
  $$('#tm [data-tab]').forEach((b) => { const on = b.dataset.tab === next; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $$('#tm [data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== next));
  render();
}

export function initTaskmgr() {
  buildSide();
  sample();
  renderProcs();

  $$('#tm [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab as 'procs' | 'perf')));
  $$('#tm [data-sort]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort as Key;
    if (k === sortKey) desc = !desc;
    else { sortKey = k; desc = k === 'cpu' || k === 'mem'; }
    renderProcs();
  }));

  rowsEl.addEventListener('click', (e) => {
    const r = (e.target as Element).closest<HTMLElement>('[data-pid]');
    select(r ? Number(r.dataset.pid) : null);
  });
  // 雙擊應用程式 → 切換到那個視窗
  rowsEl.addEventListener('dblclick', (e) => {
    const r = (e.target as Element).closest<HTMLElement>('[data-pid]');
    const p = r && current.find((x) => x.pid === Number(r.dataset.pid));
    if (p?.win) openWin(p.win);
  });
  rowsEl.addEventListener('keydown', (e) => {
    const pids = $$('.tm-row[data-pid]', rowsEl).map((r) => Number(r.dataset.pid));
    const i = selected === null ? -1 : pids.indexOf(selected);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? Math.min(pids.length - 1, i + 1) : Math.max(0, i - 1);
      select(pids[n] ?? null);
    } else if (e.key === 'Delete') { e.preventDefault(); endSelected(); }
    else if (e.key === 'Enter' && selected !== null) {
      const p = current.find((x) => x.pid === selected);
      if (p?.win) openWin(p.win);
    }
  });
  endBtn.addEventListener('click', endSelected);

  // 開關視窗時，處理程序清單立刻更新
  const refresh = () => { if (isOpen('taskmgr') && tab === 'procs') { current = procs(); renderProcs(); } };
  on('open', (id: string) => { if (id === 'taskmgr') startLoop(); else refresh(); });
  on('close', (id: string) => { if (id !== 'taskmgr') refresh(); });
  on('theme', () => { if (isOpen('taskmgr') && tab === 'perf') renderPerf(); });

  setInterval(() => {
    if (!isOpen('taskmgr') || document.hidden) return;
    sample();
    render();
  }, 1000);
  startLoop();
}
