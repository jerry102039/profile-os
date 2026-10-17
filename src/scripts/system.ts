// 系統列：選單、右鍵選單、時鐘、CPU 曲線、咖啡因、電量（真的 Battery API）、網路（真的 navigator.connection）、
// 快速設定面板與 Konami 彩蛋
import { $, $$, D, B, t, run, on, toast, getPrefs, savePrefs, beep, typing, feat } from './core';
import { getMode, setMode, setNight, setBrightness, isLight, setWallpaper } from './theme';
import { root } from './core';
import { widgetsOn } from './widgets';

/* ── 選單列下拉 ── */
function closeMenus() { $$('.mb-menu.open').forEach((m) => m.classList.remove('open')); }
export function closePopups() {
  closeMenus();
  $('#ctx').hidden = true;
  $('#qs').hidden = true;
}

function initMenus() {
  $$('.mb-menu').forEach((m) => {
    const btn = m.querySelector<HTMLElement>('.mb-btn')!;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const was = m.classList.contains('open');
      closePopups();
      if (!was) { m.classList.add('open'); syncChecks(); }
    });
    // 已經有選單打開時，滑過其他選單就切換（跟真的系統一樣）
    btn.addEventListener('pointerenter', () => {
      if ($$('.mb-menu.open').length && !m.classList.contains('open')) { closeMenus(); m.classList.add('open'); syncChecks(); }
    });
  });
  // 所有 data-action 按鈕
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLElement>('[data-action]');
    if (a) { e.preventDefault(); closePopups(); run(a.dataset.action!); return; }
    if (!(e.target as Element).closest('.mb-menu, .qs, #tray-qs, .ctx')) closePopups();
  });
}

function syncChecks() {
  const mode = getMode();
  const wp = root.dataset.wallpaper ?? 'grid';
  $$('[data-check]').forEach((b) => {
    const [k, v] = b.dataset.check!.split(':');
    const on = k === 'mode' ? v === mode : k === 'wallpaper' ? v === wp : k === 'widgets' ? widgetsOn() : false;
    b.classList.toggle('checked', on);
    b.setAttribute('aria-checked', String(on));
  });
}

/* ── 桌面右鍵選單 ── */
function initContextMenu() {
  const ctx = $('#ctx');
  addEventListener('contextmenu', (e) => {
    const target = e.target as Element;
    if (target.closest('.win, .menubar, .dock, .qs, .launcher, .power, .boot, input, a')) return;
    e.preventDefault();
    closePopups();
    ctx.hidden = false;
    syncChecks();
    const x = Math.min(e.clientX, innerWidth - ctx.offsetWidth - 6);
    const y = Math.min(e.clientY, innerHeight - ctx.offsetHeight - 6);
    ctx.style.left = `${x}px`;
    ctx.style.top = `${y}px`;
  });
}

/* ── 時鐘 ── */
function initClock() {
  const c = $('#clock');
  const upd = () => {
    const d = new Date();
    const date = d.toLocaleDateString(t.dateLocale, { weekday: 'short', month: 'numeric', day: 'numeric' });
    const time = d.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
    const ds = document.createElement('span');
    ds.className = 'clock-date';
    ds.textContent = date + '  ';
    c.replaceChildren(ds, time);
    // Dock 上的行事曆圖示
    $('#dock-cal-m').textContent = d.toLocaleDateString(t.dateLocale, { month: 'short' });
    $('#dock-cal-d').textContent = String(d.getDate());
  };
  upd();
  setTimeout(() => { upd(); setInterval(upd, 60_000); }, (60 - new Date().getSeconds()) * 1000);
}

/* ── 選單列上的迷你 CPU 曲線（模擬，但會跟著操作與真的長任務變化；工作管理員也讀這個值） ── */
const cpuPts = Array.from({ length: 20 }, () => 0.2 + Math.random() * 0.2);
export const cpuLoad = () => cpuPts[cpuPts.length - 1];
function initCpu() {
  const cv = $<HTMLCanvasElement>('#tray-cpu');
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const pts = cpuPts;
  let busy = 0;
  addEventListener('pointerdown', () => (busy = Math.max(busy, 6)));
  addEventListener('keydown', () => (busy = Math.max(busy, 4)));
  // 主執行緒真的卡住超過 50ms（Chromium 的 Long Tasks API）也算忙
  try { new PerformanceObserver((l) => (busy = Math.max(busy, Math.min(8, l.getEntries().length * 3)))).observe({ type: 'longtask', buffered: false }); } catch {}
  setInterval(() => {
    if (document.hidden) return;
    busy = Math.max(0, busy - 1);
    pts.shift();
    pts.push(Math.min(0.95, 0.15 + Math.random() * 0.25 + busy * 0.1));
    ctx.clearRect(0, 0, 40, 14);
    ctx.strokeStyle = getComputedStyle(root).getPropertyValue(isLight() ? '--fg-3' : '--acc').trim() || '#5dffa6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = (i / (pts.length - 1)) * 40, y = 13 - p * 12; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }, 700);
}

/* ── 咖啡因電量：每分鐘 -1%，點一下補滿 ── */
function initCoffee() {
  const span = $('#tray-coffee span');
  let lv = getPrefs().coffee ?? 87;
  const upd = () => (span.textContent = `${lv}%`);
  upd();
  setInterval(() => {
    if (document.hidden) return;
    lv = Math.max(0, lv - 1);
    savePrefs({ coffee: lv });
    upd();
    if (lv === 20) toast(t.toast.coffeeLow, '☕');
  }, 60_000);
  return () => { lv = 100; savePrefs({ coffee: lv }); upd(); toast(t.toast.coffee, '☕'); };
}

/* ── 電量：支援 Battery API 的瀏覽器顯示真的電量 ── */
let batteryText = '87%';
async function initBattery() {
  const fill = $('#bat-fill'), pct = $('#bat-pct'), bat = $('#bat'), qs = $('#qs-bat');
  const paint = (level: number, charging: boolean, real: boolean) => {
    const p = Math.round(level * 100);
    fill.style.width = `${p}%`;
    pct.textContent = `${p}%`;
    bat.classList.toggle('low', p <= 20 && !charging);
    bat.classList.toggle('charging', charging);
    batteryText = `${charging ? '⚡ ' : ''}${p}%${real ? '' : ' (sim)'}`;
    qs.textContent = `🔋 ${batteryText}`;
    bat.title = batteryText;
  };
  const nav = navigator as Navigator & { getBattery?: () => Promise<any> };
  if (nav.getBattery) {
    try {
      const b = await nav.getBattery();
      const upd = () => paint(b.level, b.charging, true);
      upd();
      b.addEventListener('levelchange', upd);
      b.addEventListener('chargingchange', upd);
      return;
    } catch {}
  }
  // 不支援的瀏覽器：模擬一顆慢慢掉電的電池
  let lv = 0.87;
  paint(lv, false, false);
  setInterval(() => { lv = lv <= 0.15 ? 1 : lv - 0.01; paint(lv, lv === 1, false); }, 90_000);
}

/* ── 網路：真的上線／離線狀態與連線品質 ── */
function initNetwork() {
  const icon = $('#net-icon'), qs = $('#qs-net');
  const conn = (navigator as any).connection as { effectiveType?: string; downlink?: number; rtt?: number; addEventListener?: Function } | undefined;
  const upd = (announce = false) => {
    const online = navigator.onLine;
    icon.classList.toggle('off', !online);
    let txt = online ? t.qs.connected : t.qs.offline;
    if (online && conn?.effectiveType) txt = `${conn.effectiveType} · ${conn.downlink ?? '?'} Mbps · ${conn.rtt ?? '?'} ms`;
    qs.textContent = txt;
    icon.title = txt;
    $('[data-qs="wifi"]').classList.toggle('on', online);
    if (announce) toast(online ? t.qs.backOnline : t.qs.youAreOffline, 'Wi-Fi', true);
  };
  upd();
  addEventListener('online', () => upd(true));
  addEventListener('offline', () => upd(true));
  conn?.addEventListener?.('change', () => upd());
}

/* ── 快速設定面板 ── */
function initQuickSettings() {
  const panel = $('#qs');
  const vol = $<HTMLInputElement>('#qs-vol');
  const bright = $<HTMLInputElement>('#qs-bright');
  const volIcons = [$('#vol-icon'), $('#qs-vol-icon')];
  $('#tray-qs').addEventListener('click', (e) => {
    e.stopPropagation();
    const was = !panel.hidden;
    closePopups();
    panel.hidden = was;
    if (!was) sync();
  });

  const paintVol = (v: number) => volIcons.forEach((i) => { i.classList.toggle('muted', v === 0); i.classList.toggle('low', v > 0 && v < 50); });
  vol.value = String(getPrefs().volume ?? 0);
  paintVol(Number(vol.value));
  vol.addEventListener('input', () => { savePrefs({ volume: Number(vol.value) }); paintVol(Number(vol.value)); });
  vol.addEventListener('change', () => beep('click'));
  bright.value = String(getPrefs().bright ?? 100);
  bright.addEventListener('input', () => setBrightness(Number(bright.value)));

  const sync = () => {
    const p = getPrefs();
    const set = (k: string, on: boolean, sub?: string) => {
      const b = $(`[data-qs="${k}"]`);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      if (sub !== undefined) b.querySelector('small')!.textContent = sub;
    };
    set('bt', !!p.bt, p.bt ? t.qs.searching : t.qs.off);
    set('dark', !isLight(), getMode() === 'auto' ? t.qs.auto : '');
    set('night', root.classList.contains('night'));
    set('dnd', !!p.dnd);
  };
  on('theme', sync);

  panel.addEventListener('click', (e) => {
    const tile = (e.target as Element).closest<HTMLElement>('[data-qs]');
    if (!tile) return;
    const k = tile.dataset.qs!;
    if (k === 'wifi') toast(t.toast.wifi, 'Wi-Fi');
    else if (k === 'bt') {
      const on = !getPrefs().bt;
      savePrefs({ bt: on });
      if (on) setTimeout(() => { if (getPrefs().bt) toast(t.qs.earbuds, t.qs.bluetooth); }, 1800);
    }
    else if (k === 'dark') setMode(isLight() ? 'dark' : 'light');
    else if (k === 'night') setNight(!root.classList.contains('night'));
    else if (k === 'dnd') { const on = !getPrefs().dnd; savePrefs({ dnd: on }); toast(on ? t.qs.dndOn : t.qs.dndOff, B.os, true); }
    sync();
  });
}

/* ── Konami：↑↑↓↓←→←→BA ── */
function initKonami() {
  if (!feat('easterEggs')) return;
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0;
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    i = e.key.toLowerCase() === seq[i].toLowerCase() ? i + 1 : e.key === seq[0] ? 1 : 0;
    if (i === seq.length) { i = 0; setWallpaper('matrix'); toast(t.toast.konami, '🕹'); run('party'); }
  });
}

export function initSystem() {
  initMenus();
  initContextMenu();
  initClock();
  initCpu();
  refillCoffee = initCoffee();
  initBattery();
  initNetwork();
  initQuickSettings();
  initKonami();
  syncChecks();
  on('theme', syncChecks);
}

let refillCoffee = () => {};
export const coffee = () => refillCoffee();
export const battery = () => batteryText;
