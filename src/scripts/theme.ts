// 外觀：深淺色、佈景主題（配色）、強調色、桌布、夜燈、亮度
import { root, getPrefs, savePrefs, mq, emit, toast, t, $, fmt } from './core';

export type Mode = 'light' | 'dark' | 'auto';
export const PALETTES = ['caffeine', 'tokyo', 'nord', 'gruvbox', 'dracula', 'catppuccin', 'solarized', 'amber', 'rose'] as const;
export const WALLPAPERS: readonly string[] = ['grid', 'starfield', 'matrix', 'waves', 'aurora', 'circuit', 'bokeh', 'off'];

type RGB = [number, number, number];
let accRgb: RGB = [93, 255, 166];
let acc2Rgb: RGB = [255, 209, 102];
export const accentRgb = () => accRgb;
export const accent2Rgb = () => acc2Rgb;
export const isLight = () => root.dataset.theme === 'light';

function hexToRgb(h: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** 讀目前生效的強調色（佈景主題或自訂），給 canvas 用 */
function syncAccent() {
  const cs = getComputedStyle(root);
  accRgb = hexToRgb(cs.getPropertyValue('--acc')) ?? accRgb;
  acc2Rgb = hexToRgb(cs.getPropertyValue('--acc2')) ?? acc2Rgb;
}

export const currentAccent = () => root.style.getPropertyValue('--acc').trim() || null;
export function setAccent(hex: string, persist = true) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const v = '#' + hex.trim().replace('#', '').toLowerCase();
  root.style.setProperty('--acc', v);
  accRgb = rgb;
  if (persist) savePrefs({ accent: v });
  emit('theme');
  return true;
}
/** 拿掉自訂強調色，回到佈景主題的顏色 */
export function clearAccent() {
  root.style.removeProperty('--acc');
  savePrefs({ accent: undefined });
  syncAccent();
  emit('theme');
}

export const getPalette = () => root.dataset.palette ?? 'caffeine';
export function setPalette(name: string, announce = false) {
  if (!(PALETTES as readonly string[]).includes(name)) return false;
  if (name === 'caffeine') delete root.dataset.palette;
  else root.dataset.palette = name;
  // 換佈景主題時把自訂強調色清掉，不然每個主題看起來都一樣
  root.style.removeProperty('--acc');
  savePrefs({ palette: name, accent: undefined });
  syncAccent();
  emit('theme');
  if (announce) toast(t.appearance.palettes[name] ?? name, t.appearance.palette);
  return true;
}

export const getMode = (): Mode => (root.dataset.mode as Mode) || 'auto';
export function setMode(m: Mode, announce = false) {
  root.dataset.mode = m;
  root.dataset.theme = m === 'auto' ? (mq.light.matches ? 'light' : 'dark') : m;
  savePrefs({ mode: m });
  syncAccent();
  emit('theme');
  if (announce) toast(t.toast.theme[m]);
}
export const toggleMode = () => setMode(isLight() ? 'dark' : 'light', true);
mq.light.addEventListener('change', () => getMode() === 'auto' && setMode('auto'));

export const getWallpaper = () => root.dataset.wallpaper ?? 'grid';
export const wallpaperName = (w: string) => t.appearance.wallpapers[w] ?? w;
export function setWallpaper(w: string, announce = false) {
  if (!WALLPAPERS.includes(w)) return false;
  root.dataset.wallpaper = w;
  savePrefs({ wallpaper: w });
  emit('theme');
  if (announce) toast(fmt(t.toast.wallpaper, { name: wallpaperName(w) }));
  return true;
}
export const nextWallpaper = () => {
  const list = WALLPAPERS.filter((w) => w !== 'off');
  setWallpaper(list[(list.indexOf(getWallpaper()) + 1) % list.length], true);
};

export const nightOn = () => root.classList.contains('night');
export function setNight(on: boolean) {
  root.classList.toggle('night', on);
  savePrefs({ night: on });
  emit('theme');
}

export function setBrightness(v: number) {
  $('#dim-layer').style.opacity = String((100 - v) / 100 * 0.75);
  savePrefs({ bright: v });
}

export function resetAppearance() {
  setPalette('caffeine');
  setMode('auto');
  setWallpaper('grid');
  setNight(false);
  setBrightness(100);
  $<HTMLInputElement>('#qs-bright').value = '100';
  toast(t.appearance.resetDone);
}

export function initTheme() {
  syncAccent();
  setBrightness(getPrefs().bright ?? 100);
}
