// 共用：頁面資料、偏好設定、通知、動作註冊表、音效
import type { UI } from '../i18n/dict';
import type { Brand } from '../i18n/brand';
import type { Locale } from '../profile/schema';
import { fmt, plural, type Plural } from '../i18n/fmt';
import type { FeatureKey, FlatFeatures } from '../apps/registry';
export { fmt };

export type OSData = {
  locale: Locale;
  /** 啟用的語言：code 是網址用的小寫代碼；suggest / switch 是用該語言寫的首次造訪提示 */
  locales: { id: Locale; code: string; name: string; lang: string; href: string; suggest: string; switch: string }[];
  email: string;
  github: string;
  resume: string;
  resumeName: string;
  about: string[];
  whoami: string;
  interests: string[];
  certs: string[];
  awards: string[];
  oss: string[];
  talks: string[];
  more: string[];
  projects: { slug: string; title: string; desc: string; href: string }[];
  notes: { slug: string; title: string; desc: string; href: string }[];
  ctf: { keyHex: string; cipher: string; secret: string };
  statusUrl: string;
  accents: string[];
  certItems: { id: string; file: string; title: string; issuer: string; available: boolean; image: string | null }[];
  /** profile.yaml 的品牌：作業系統名稱、使用者名稱、logo、localStorage 前綴、天氣預設地點… */
  brand: Brand & { logo: string; version: string; storageKey: string; lat: number; lon: number };
  persona: { lockPassword: string[]; calendar: { date: string; title: string }[]; matrixGlyphs: string; neofetchArt: string[] };
  /** 目前語言的字典檔網址（boot.ts 先下載，放在 window.__osT） */
  dict: string;
  /** 有輸出到頁面的視窗、功能開關、開機後要打開的視窗（見 src/apps/registry.ts） */
  apps: string[];
  features: FlatFeatures;
  startup: string[];
};

export const D: OSData = JSON.parse(document.getElementById('os-data')!.textContent!);
const appSet = new Set(D.apps);
/** 這個視窗有沒有啟用（profile.yaml 的 features） */
export const isOn = (id: string) => appSet.has(id);
/** 功能開關，例如 feat('ctf')、feat('widgets.notes') */
export const feat = (k: FeatureKey) => D.features[k];
export const B = D.brand;
export const t: UI = (window as unknown as { __osT: UI }).__osT;
/** 複數字串：plural 的捷徑，自動帶目前語言 */
export const pn = (p: Plural, n: number, vars: Record<string, string | number> = {}) => plural(p, n, t.dateLocale, vars);
export const root = document.documentElement;
export const bootTime = Date.now();

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, from: ParentNode = document) => from.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, from: ParentNode = document) => [...from.querySelectorAll<T>(sel)];
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const mq = {
  mobile: matchMedia('(max-width: 720px)'),
  fine: matchMedia('(pointer: fine)'),
  reduced: matchMedia('(prefers-reduced-motion: reduce)'),
  light: matchMedia('(prefers-color-scheme: light)'),
};

/** 是否正在輸入文字（快捷鍵要讓路） */
export const typing = (e: Event) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/* ── 偏好設定（存在訪客瀏覽器） ── */
export type Prefs = {
  accent?: string; wallpaper?: string; mode?: 'light' | 'dark' | 'auto';
  night?: boolean; dnd?: boolean; volume?: number; bright?: number; bt?: boolean;
  flag?: boolean; boots?: number; coffee?: number; events?: Record<string, string[]>;
  palette?: string;
  widgets?: { on?: boolean; pos?: Record<string, { x: number; y: number }>; notes?: { id: string; text: string; color: string }[] };
  wxLoc?: { lat: number; lon: number; name: string };
  musicVol?: number; musicRepeat?: 'off' | 'all' | 'one'; musicShuffle?: boolean; musicTrack?: string;
  snakeHi?: number; dinoHi?: number; minesBest?: Record<string, number>; minesLevel?: string; g2048Best?: number;
  /** 已經提示過「本站也有你的語言」 */
  langHint?: boolean;
};
let prefs: Prefs = {};
try { prefs = JSON.parse(localStorage.getItem(B.storageKey) || '{}'); } catch {}
export const getPrefs = () => prefs;
export function savePrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(B.storageKey, JSON.stringify(prefs)); } catch {}
}

/* ── 動作註冊表：選單、右鍵、快速開啟、終端機共用 ── */
type Action = (arg?: string) => void;
const actions = new Map<string, Action>();
export const register = (name: string, fn: Action) => actions.set(name, fn);
export function run(spec: string) {
  const i = spec.indexOf(':');
  const name = i < 0 ? spec : spec.slice(0, i);
  const arg = i < 0 ? undefined : spec.slice(i + 1);
  actions.get(name)?.(arg);
}

/* ── 簡易事件 ── */
type Fn = (...a: any[]) => void;
const listeners = new Map<string, Fn[]>();
export const on = (ev: string, fn: Fn) => listeners.set(ev, [...(listeners.get(ev) ?? []), fn]);
export const emit = (ev: string, ...a: unknown[]) => listeners.get(ev)?.forEach((f) => f(...a));

/* ── 音效：WebAudio 合成，音量由快速設定的滑桿控制（預設靜音） ── */
let actx: AudioContext | null = null;
export function beep(kind: 'open' | 'close' | 'toast' | 'error' | 'click' | 'boot' = 'click') {
  const vol = (prefs.volume ?? 0) / 100;
  if (!vol) return;
  try {
    actx ??= new AudioContext();
    const now = actx.currentTime;
    const notes: Record<string, [number, number][]> = {
      open: [[660, 0], [880, 0.05]],
      close: [[660, 0], [440, 0.05]],
      toast: [[988, 0], [1319, 0.08]],
      error: [[196, 0], [185, 0.09]],
      click: [[1200, 0]],
      boot: [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]],
    };
    for (const [f, at] of notes[kind]) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = kind === 'error' ? 'square' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(0.12 * vol, now + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + (kind === 'boot' ? 0.5 : 0.14));
      o.connect(g).connect(actx.destination);
      o.start(now + at);
      o.stop(now + at + 0.6);
    }
  } catch {}
}

/* ── 通知 ── */
const toastBox = () => document.getElementById('toasts')!;
export function toast(msg: string, title = B.os, force = false, onClick?: () => void) {
  if (prefs.dnd && !force) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const body = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = title;
  body.append(b, msg);
  el.append(body);
  el.addEventListener('click', () => { el.remove(); onClick?.(); });
  if (onClick) el.classList.add('toast-action');
  toastBox().prepend(el);
  beep('toast');
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3600);
  while (toastBox().children.length > 4) toastBox().lastElementChild!.remove();
}

/** 把毫秒變成「3h 12m」這種字串 */
export function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
