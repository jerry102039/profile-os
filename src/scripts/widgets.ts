// 桌面小工具：天氣（Open-Meteo 真實資料）與便利貼（存在訪客的瀏覽器）。可拖曳，位置會記住。
import { $, $$, B, t, getPrefs, savePrefs, toast, clamp, mq, emit, feat } from './core';

const layer = () => $('#widgets');
const W = () => t.widgets;
type Pos = { x: number; y: number };
const DEFAULT_POS: Record<string, Pos> = { weather: { x: innerWidth - 300, y: 52 } };
const HOME = { lat: B.lat, lon: B.lon };

const prefs = () => getPrefs().widgets ?? {};
const save = (patch: Partial<NonNullable<ReturnType<typeof getPrefs>['widgets']>>) => savePrefs({ widgets: { ...prefs(), ...patch } });
export const widgetsOn = () => prefs().on !== false && (feat('widgets.weather') || feat('widgets.notes'));

/* ── 拖曳 ── */
function draggable(el: HTMLElement, id: string) {
  const pos = prefs().pos?.[id] ?? DEFAULT_POS[id] ?? { x: 40 + Math.random() * 200, y: 80 + Math.random() * 200 };
  const place = (p: Pos) => {
    const x = clamp(p.x, 4, Math.max(4, innerWidth - el.offsetWidth - 4));
    const y = clamp(p.y, 40, Math.max(40, innerHeight - el.offsetHeight - 90));
    el.style.transform = `translate(${x}px,${y}px)`;
    return { x, y };
  };
  let cur = pos;
  requestAnimationFrame(() => (cur = place(pos)));
  const head = el.querySelector<HTMLElement>('.wg-head')!;
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('button, input, textarea')) return;
    e.preventDefault();
    const sx = e.clientX - cur.x, sy = e.clientY - cur.y;
    head.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    $$('.widget', layer()).forEach((w) => (w.style.zIndex = ''));
    el.style.zIndex = '2';
    const move = (ev: PointerEvent) => { cur = place({ x: ev.clientX - sx, y: ev.clientY - sy }); };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      el.classList.remove('dragging');
      save({ pos: { ...(prefs().pos ?? {}), [id]: cur } });
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
}

const el = (tag: string, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (cls: string, label: string, title: string) => { const b = el('button', cls, label) as HTMLButtonElement; b.title = title; b.setAttribute('aria-label', title); return b; };

/* ── 天氣 ── */
type Wx = {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number; is_day: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
};
const ICON = (code: number, day = true) =>
  code === 0 ? (day ? '☀' : '☾') : code <= 2 ? (day ? '⛅' : '☁') : code === 3 ? '☁' : code < 50 ? '🌫' : code < 70 ? '🌧' : code < 80 ? '❄' : code < 90 ? '🌦' : '⛈';
let wxCache: { ts: number; key: string; data: Wx } | null = null;
try { wxCache = JSON.parse(localStorage.getItem(`${B.storageKey}-wx`) || 'null'); } catch {}
let wxBody: HTMLElement;
let wxTitle: HTMLElement;

const locName = () => getPrefs().wxLoc?.name ?? W().weather.home;
const loc = () => getPrefs().wxLoc ?? HOME;

async function fetchWx(force = false): Promise<Wx | null> {
  const { lat, lon } = loc();
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (!force && wxCache && wxCache.key === key && Date.now() - wxCache.ts < 30 * 60_000) return wxCache.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Wx;
    wxCache = { ts: Date.now(), key, data };
    try { localStorage.setItem(`${B.storageKey}-wx`, JSON.stringify(wxCache)); } catch {}
    return data;
  } catch { return null; }
}

function renderWx(data: Wx | null, loading = false) {
  const w = W().weather;
  wxTitle.textContent = `${w.title} · ${locName()}`;
  wxBody.replaceChildren();
  if (loading) { wxBody.append(el('div', 'wg-dim', w.loading)); return; }
  if (!data) { wxBody.append(el('div', 'wg-dim', w.error)); return; }
  const c = data.current;
  const now = el('div', 'wx-now');
  now.append(el('span', 'wx-icon', ICON(c.weather_code, !!c.is_day)), el('b', 'wx-temp', `${Math.round(c.temperature_2m)}°`));
  const desc = el('div', 'wx-desc');
  desc.append(el('div', '', w.codes[c.weather_code] ?? '—'), el('small', '', `${w.feels} ${Math.round(c.apparent_temperature)}° · ${w.humidity} ${c.relative_humidity_2m}% · ${w.wind} ${Math.round(c.wind_speed_10m)} km/h`));
  now.append(desc);
  const days = el('div', 'wx-days');
  data.daily.time.slice(1).forEach((d, i) => {
    const day = el('div', 'wx-day');
    const dt = new Date(d + 'T12:00');
    day.append(el('span', 'wx-dn', t.cal.weekdays[dt.getDay()]), el('span', 'wx-di', ICON(data.daily.weather_code[i + 1])), el('span', 'wx-dt', `${Math.round(data.daily.temperature_2m_max[i + 1])}° / ${Math.round(data.daily.temperature_2m_min[i + 1])}°`));
    days.append(day);
  });
  const foot = el('div', 'wg-foot', `${w.source} · ${new Date(wxCache?.ts ?? Date.now()).toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}`);
  wxBody.append(now, days, foot);
}

async function loadWx(force = false) {
  if (!widgetsOn() || mq.mobile.matches) return;
  renderWx(wxCache && !force ? wxCache.data : null, !wxCache || force);
  renderWx(await fetchWx(force));
}

function locate() {
  if (!navigator.geolocation) return toast(W().weather.error, W().weather.title);
  navigator.geolocation.getCurrentPosition(
    (p) => { savePrefs({ wxLoc: { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: W().weather.here } }); loadWx(true); },
    () => toast(W().weather.error, W().weather.title),
    { maximumAge: 600_000, timeout: 8000 },
  );
}

function buildWeather() {
  const box = el('section', 'widget wx');
  box.dataset.widget = 'weather';
  const head = el('div', 'wg-head');
  wxTitle = el('span', 'wg-title');
  const tools = el('span', 'wg-tools');
  const lb = btn('', '◎', W().weather.locate); lb.onclick = locate;
  const rb = btn('', '↻', W().weather.refresh); rb.onclick = () => loadWx(true);
  tools.append(lb, rb);
  head.append(wxTitle, tools);
  wxBody = el('div', 'wg-body');
  box.append(head, wxBody);
  layer().append(box);
  draggable(box, 'weather');
  loadWx();
}

/** 終端機 `weather` 用 */
export async function weatherSummary(): Promise<string[]> {
  const w = W().weather;
  const data = await fetchWx();
  if (!data) return [w.error];
  const c = data.current;
  return [
    `${locName()}: ${ICON(c.weather_code, !!c.is_day)} ${w.codes[c.weather_code] ?? '—'}  ${Math.round(c.temperature_2m)}°C (${w.feels} ${Math.round(c.apparent_temperature)}°)`,
    `${w.humidity} ${c.relative_humidity_2m}% · ${w.wind} ${Math.round(c.wind_speed_10m)} km/h`,
    ...data.daily.time.slice(1).map((d, i) => `  ${t.cal.weekdays[new Date(d + 'T12:00').getDay()]}  ${ICON(data.daily.weather_code[i + 1])}  ${Math.round(data.daily.temperature_2m_max[i + 1])}° / ${Math.round(data.daily.temperature_2m_min[i + 1])}°`),
    w.source,
  ];
}

/* ── 便利貼 ── */
type Note = { id: string; text: string; color: string };
const COLORS = ['yellow', 'green', 'blue', 'pink'];
const notes = (): Note[] => prefs().notes ?? [];
const saveNotes = (list: Note[]) => save({ notes: list });

function buildNote(n: Note) {
  const box = el('section', 'widget note');
  box.dataset.widget = n.id;
  box.dataset.color = n.color;
  const head = el('div', 'wg-head');
  const dots = el('span', 'note-colors');
  COLORS.forEach((c) => {
    const d = btn('note-dot', '', W().note.color);
    d.dataset.color = c;
    d.onclick = () => { box.dataset.color = c; saveNotes(notes().map((x) => (x.id === n.id ? { ...x, color: c } : x))); };
    dots.append(d);
  });
  const del = btn('note-del', '×', W().note.delete);
  del.onclick = () => { box.remove(); saveNotes(notes().filter((x) => x.id !== n.id)); };
  head.append(dots, del);
  const ta = document.createElement('textarea');
  ta.className = 'note-text';
  ta.placeholder = W().note.placeholder;
  ta.value = n.text;
  ta.spellcheck = false;
  let timer = 0;
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => saveNotes(notes().map((x) => (x.id === n.id ? { ...x, text: ta.value } : x))), 300);
  });
  box.append(head, ta);
  layer().append(box);
  draggable(box, n.id);
  return ta;
}

export function addNote() {
  if (!widgetsOn()) setWidgets(true);
  const n: Note = { id: `note-${Date.now().toString(36)}`, text: '', color: COLORS[notes().length % COLORS.length] };
  saveNotes([...notes(), n]);
  // 新的便利貼放在上一張旁邊
  const last = $$('.widget.note', layer()).pop();
  if (last) {
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(last.style.transform);
    if (m) save({ pos: { ...(prefs().pos ?? {}), [n.id]: { x: +m[1] + 28, y: +m[2] + 28 } } });
  }
  buildNote(n).focus();
}

/* ── 開關 ── */
export function setWidgets(on: boolean) {
  save({ on });
  layer().hidden = !on;
  if (on && !wxCache && feat('widgets.weather')) loadWx();
  emit('theme');
}
export const toggleWidgets = () => setWidgets(!widgetsOn());

export function initWidgets() {
  layer().hidden = !widgetsOn();
  // 天氣與便利貼可以在 profile.yaml 的 features.widgets 分別關掉
  if (feat('widgets.weather')) {
    buildWeather();
    setInterval(() => { if (!document.hidden && widgetsOn()) loadWx(); }, 30 * 60_000);
  }
  if (feat('widgets.notes')) notes().forEach(buildNote);
}
