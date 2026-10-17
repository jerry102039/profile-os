// App 註冊表：哪個視窗、哪個終端機指令屬於哪個功能開關（profile.yaml 的 features）。
// build 時（Desktop.astro）與瀏覽器端（終端機、快速開啟、檔案系統…）共用，不碰 node API。
import type { Features } from '../profile/schema';

/** 功能開關的扁平名稱，例如 'games.snake'、'widgets.weather' */
export type FeatureKey =
  | 'finder' | 'projects' | 'notes' | 'skills' | 'status' | 'taskmgr' | 'music' | 'calculator' | 'calendar'
  | 'contact' | 'resume' | 'certs' | 'editor' | 'appearance'
  | 'games.snake' | 'games.dino' | 'games.mines' | 'games.g2048'
  | 'widgets.weather' | 'widgets.notes'
  | 'ctf' | 'bootAnimation' | 'languageSwitcher' | 'easterEggs';
export type FlatFeatures = Record<FeatureKey, boolean>;

/** 視窗 id → 控制它的開關；不在表裡的視窗（終端機、系統資訊、文字檢視）永遠存在 */
const WINDOW_FEATURE: Record<string, FeatureKey> = {
  finder: 'finder', projects: 'projects', project: 'projects', notes: 'notes', skills: 'skills', status: 'status',
  taskmgr: 'taskmgr', music: 'music', calculator: 'calculator', calendar: 'calendar', contact: 'contact',
  resume: 'resume', certs: 'certs', pdf: 'certs', editor: 'editor', appearance: 'appearance',
  snake: 'games.snake', dino: 'games.dino', mines: 'games.mines', g2048: 'games.g2048',
};
export const ALL_WINDOWS = ['about', 'viewer', 'sysinfo', ...Object.keys(WINDOW_FEATURE)];

/** 終端機指令 → 需要的開關或視窗（'win:<id>'） */
const COMMAND_NEEDS: Record<string, FeatureKey | `win:${string}`> = {
  finder: 'finder', calc: 'calculator', cal: 'calendar', certs: 'certs', project: 'projects', projects: 'projects',
  notes: 'notes', skills: 'skills', status: 'status', contact: 'contact', resume: 'resume', ssh: 'contact',
  top: 'taskmgr', htop: 'taskmgr', taskmgr: 'taskmgr',
  music: 'music', play: 'music', pause: 'music', stop: 'music', next: 'music', prev: 'music',
  snake: 'games.snake', dino: 'games.dino', mines: 'games.mines', minesweeper: 'games.mines', 2048: 'games.g2048',
  nano: 'editor', vi: 'editor', pico: 'editor', weather: 'widgets.weather',
  base64: 'ctf', unlock: 'ctf', hint: 'ctf',
  sl: 'easterEggs', cowsay: 'easterEggs', party: 'easterEggs', confetti: 'easterEggs', matrix: 'easterEggs',
  lang: 'languageSwitcher',
};

/** hasCtfData：profile.yaml 有沒有 ctf: 區塊；沒有的話解謎無法完成，等於關掉 */
export function flatFeatures(f: Features, hasCtfData = true): FlatFeatures {
  return {
    finder: f.finder, projects: f.projects, notes: f.notes, skills: f.skills, status: f.status, taskmgr: f.taskmgr,
    music: f.music, calculator: f.calculator, calendar: f.calendar, contact: f.contact, resume: f.resume, certs: f.certs,
    editor: f.editor, appearance: f.appearance,
    'games.snake': f.games.snake, 'games.dino': f.games.dino, 'games.mines': f.games.mines, 'games.g2048': f.games.g2048,
    'widgets.weather': f.widgets.weather, 'widgets.notes': f.widgets.notes,
    ctf: f.ctf && hasCtfData, bootAnimation: f.bootAnimation, languageSwitcher: f.languageSwitcher, easterEggs: f.easterEggs,
  };
}

/** 會輸出到頁面上的視窗 */
export const enabledApps = (f: FlatFeatures) => new Set(ALL_WINDOWS.filter((id) => !WINDOW_FEATURE[id] || f[WINDOW_FEATURE[id]]));

/** 開機後要打開的視窗：濾掉關掉的；一個都不剩就開終端機 */
export function resolveStartup(startup: string[], on: Set<string>): string[] {
  const list = startup.filter((id) => on.has(id));
  return list.length ? list : ['about'];
}

/** 終端機指令現在能不能用 */
export function commandOn(cmd: string, f: FlatFeatures, on: Set<string>): boolean {
  const need = COMMAND_NEEDS[cmd];
  if (!need) return true;
  return need.startsWith('win:') ? on.has(need.slice(4)) : f[need as FeatureKey];
}

/** 遊戲有沒有任何一個開著（決定 Games 資料夾與桌面圖示） */
export const anyGame = (f: FlatFeatures) => f['games.snake'] || f['games.dino'] || f['games.mines'] || f['games.g2048'];

/** 依賴其他 App 的入口：垃圾桶、新增資料夾、Games 圖示都要靠檔案總管打開；nano 要編輯器 */
export function entryOn(entry: 'open-trash' | 'new-folder' | 'finder' | 'games-icon' | 'nano', f: FlatFeatures, on: Set<string>): boolean {
  if (entry === 'nano') return on.has('editor');
  if (entry === 'games-icon') return anyGame(f) && on.has('finder');
  return on.has('finder');
}
