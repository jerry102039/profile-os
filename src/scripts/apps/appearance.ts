// 外觀設定：深淺色、佈景主題、強調色、桌布、效果
import { $, D, t, on } from '../core';
import {
  PALETTES, WALLPAPERS, getPalette, setPalette, getMode, setMode, setAccent, clearAccent, currentAccent,
  getWallpaper, setWallpaper, wallpaperName, nightOn, setNight, resetAppearance, type Mode,
} from '../theme';
import { widgetsOn, setWidgets } from '../widgets';

const A = () => t.appearance;
const root = $('#ap-root');

const el = (tag: string, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const section = (title: string, body: HTMLElement) => { const s = el('section', 'ap-sec'); s.append(el('h3', '', title), body); return s; };

function build() {
  // 外觀
  const modes = el('div', 'ap-seg');
  (['light', 'dark', 'auto'] as Mode[]).forEach((m) => {
    const b = el('button', '', t.mb.view[m]);
    b.dataset.mode = m;
    b.onclick = () => setMode(m);
    modes.append(b);
  });

  // 佈景主題：每張卡片用該主題自己的變數畫小預覽
  const pals = el('div', 'ap-grid');
  PALETTES.forEach((p) => {
    const card = el('button', 'ap-card ap-pal');
    card.dataset.palette = p;
    card.dataset.pick = p;
    const prev = el('span', 'ap-prev');
    const bar = el('span', 'ap-prev-bar');
    const win = el('span', 'ap-prev-win');
    win.append(el('i', 'ap-prev-dot'), el('i', 'ap-prev-line'), el('i', 'ap-prev-line short'));
    prev.append(bar, win);
    card.append(prev, el('span', 'ap-name', A().palettes[p] ?? p));
    card.onclick = () => setPalette(p);
    pals.append(card);
  });

  // 強調色
  const accs = el('div', 'ap-accents');
  D.accents.forEach((c) => {
    const b = el('button', 'ap-swatch');
    b.style.setProperty('--c', c);
    b.dataset.accent = c;
    b.title = c;
    b.onclick = () => setAccent(c);
    accs.append(b);
  });
  const custom = el('label', 'ap-swatch ap-custom');
  custom.title = A().custom;
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', A().custom);
  input.addEventListener('input', () => setAccent(input.value));
  custom.append(input, el('span', '', '+'));
  const reset = el('button', 'ap-swatch ap-reset', '×');
  reset.title = A().reset;
  reset.onclick = clearAccent;
  accs.append(custom, reset);

  // 桌布
  const wps = el('div', 'ap-grid');
  WALLPAPERS.forEach((w) => {
    const card = el('button', 'ap-card ap-wp');
    card.dataset.wp = w;
    const prev = el('span', `ap-prev wp-${w}`);
    card.append(prev, el('span', 'ap-name', wallpaperName(w)));
    card.onclick = () => setWallpaper(w);
    wps.append(card);
  });

  // 效果
  const fx = el('div', 'ap-toggles');
  const toggle = (key: string, label: string, get: () => boolean, set: (v: boolean) => void) => {
    const row = el('button', 'ap-toggle', label);
    row.dataset.toggle = key;
    row.setAttribute('role', 'switch');
    row.append(el('span', 'ap-knob'));
    row.onclick = () => set(!get());
    fx.append(row);
  };
  toggle('night', A().night, nightOn, setNight);
  toggle('widgets', A().widgets, widgetsOn, setWidgets);
  const resetBtn = el('button', 'btn ghost ap-reset-all', A().reset);
  resetBtn.onclick = resetAppearance;

  root.replaceChildren(section(A().mode, modes), section(A().palette, pals), section(A().accent, accs), section(A().wallpaper, wps), section(A().effects, fx), resetBtn);
}

function sync() {
  const pal = getPalette(), mode = getMode(), wp = getWallpaper(), acc = currentAccent();
  root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  root.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.classList.toggle('on', b.dataset.pick === pal));
  root.querySelectorAll<HTMLElement>('[data-wp]').forEach((b) => b.classList.toggle('on', b.dataset.wp === wp));
  root.querySelectorAll<HTMLElement>('[data-accent]').forEach((b) => b.classList.toggle('on', b.dataset.accent === acc));
  const states: Record<string, boolean> = { night: nightOn(), widgets: widgetsOn() };
  root.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => { const v = states[b.dataset.toggle!]; b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); });
}

export function initAppearance() {
  build();
  sync();
  on('theme', sync);
}
