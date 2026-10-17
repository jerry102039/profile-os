// 處理程序模型：工作管理員與終端機的 ps / kill 共用
// 「應用程式」就是目前開著（或縮到 Dock）的視窗，記憶體用該視窗真的 DOM 節點數估算；
// 「系統程序」是假的常駐服務，結束它們會觸發對應的彩蛋。
import { t, B, run, root, fmt, feat } from './core';
import { windowList, closeWin, closeAll, topWindow } from './wm';
import { cpuLoad } from './system';

export type Proc = {
  pid: number; name: string; cmd: string; icon: string; user: string;
  state: 'R' | 'S'; cpu: number; mem: number; win?: string;
};

export const APP_ICONS: Record<string, string> = {
  finder: '◫', about: '>_', projects: '▤', project: '▤', skills: '%', notes: '✎', status: '◉', calculator: '±',
  calendar: '▦', contact: '@', resume: '↓', viewer: '≡', sysinfo: '◈', taskmgr: '◔', music: '♫', certs: '⎙', pdf: '⎙', editor: '✎', appearance: '◑', snake: '🐍', dino: '🦖', mines: '✸', g2048: '⊞',
};
const BIN: Record<string, string> = {
  about: 'zsh', finder: 'finder', projects: 'projects', project: 'project-viewer', skills: 'skills.sys', notes: 'notes',
  status: 'monitor.app', calculator: 'calc', calendar: 'cal', contact: 'contact.app', resume: 'preview', viewer: 'textedit',
  sysinfo: 'sysinfo', taskmgr: 'taskmgr', music: 'music', certs: 'certs', pdf: 'pdf-viewer', editor: 'nano', appearance: 'appearance', snake: 'snake', dino: 'dino', mines: 'mines', g2048: '2048',
};

type Sys = {
  pid: number; cmd: string; user: string; mem: number;
  cpu: () => number; show?: () => boolean; kill: () => string; fail?: boolean;
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wallpaper = () => root.dataset.wallpaper ?? 'grid';
const K = () => t.tm.kill;

const SYS: Sys[] = [
  { pid: 1, cmd: 'systemd', user: 'root', mem: 11.8, cpu: () => rnd(0, 0.2), kill: () => { setTimeout(() => run('panic'), 700); return K().systemd; } },
  { pid: 2, cmd: 'kthreadd', user: 'root', mem: 0, cpu: () => 0, kill: () => K().kthreadd, fail: true },
  { pid: 212, cmd: `${B.os.toLowerCase().replace(/-?os$/, '') || 'os'}-wm`, user: B.user, mem: 63.5, cpu: () => rnd(0.4, 1.4) + cpuLoad() * 4, kill: () => { closeAll(); return K().wm; } },
  {
    pid: 230, cmd: 'wallpaperd', user: B.user, mem: 22.4, show: () => wallpaper() !== 'off',
    cpu: () => (wallpaper() === 'matrix' ? rnd(6, 11) : wallpaper() === 'starfield' ? rnd(2.5, 5) : rnd(0.4, 1.2)),
    kill: () => { run('wallpaper:off'); return K().wallpaper; },
  },
  { pid: 241, cmd: 'coffee-daemon', user: B.user, mem: 4.2, cpu: () => rnd(0.1, 0.9), kill: () => { setTimeout(() => run('sleep'), 1200); return K().coffee; } },
  { pid: 256, cmd: 'clockd', user: 'root', mem: 1.9, cpu: () => rnd(0, 0.1), kill: () => K().clock },
  { pid: 263, cmd: 'NetworkManager', user: 'root', mem: 18.7, cpu: () => rnd(0, 0.4), kill: () => K().net },
  { pid: 277, cmd: 'pipewire', user: B.user, mem: 7.3, cpu: () => ((window as any).__music ? rnd(2.5, 4.5) : rnd(0, 0.3)), kill: () => { run('music:pause'); return K().audio; } },
  { pid: 1337, cmd: 'ctf-guard', user: 'root', mem: 0.4, cpu: () => rnd(0, 0.05), show: () => feat('ctf'), kill: () => K().ctf },
];

// 讓 CPU 數字平滑一點，不要每秒亂跳
const last = new Map<number, number>();
const smooth = (pid: number, v: number) => {
  const p = last.get(pid);
  const s = p === undefined ? v : p * 0.55 + v * 0.45;
  last.set(pid, s);
  return Math.round(s * 10) / 10;
};

const appPid = (i: number) => 1024 + i * 13;

/** 目前所有處理程序（每次呼叫都是一次新的取樣） */
export function procs(): Proc[] {
  const top = topWindow()?.id;
  const load = cpuLoad();
  const apps: Proc[] = windowList().flatMap(({ id, state, el }, i) => {
    if (state === 'closed') return [];
    const pid = appPid(i);
    const nodes = el.getElementsByTagName('*').length;
    const cpu = state === 'min' ? 0 : id === top ? rnd(1.5, 4) + load * 16 : rnd(0.1, 1.2);
    return [{
      pid, name: t.appNames[id] ?? id, cmd: BIN[id] ?? id, icon: APP_ICONS[id] ?? '◆', user: B.user,
      state: state === 'min' ? 'S' as const : 'R' as const, cpu: smooth(pid, cpu),
      mem: Math.round((12 + nodes * 0.045 + (id === 'resume' && el.querySelector('iframe[src]') ? 38 : 0)) * 10) / 10, win: id,
    }];
  });
  const sys: Proc[] = SYS.filter((s) => !s.show || s.show()).map((s) => {
    const cpu = smooth(s.pid, s.cpu());
    return { pid: s.pid, name: s.cmd, cmd: s.cmd, icon: '⚙', user: s.user, state: cpu >= 1 ? 'R' : 'S', cpu, mem: s.mem };
  });
  return [...apps, ...sys];
}

/** 結束處理程序；回傳要顯示的訊息 */
export function killProc(pid: number): { ok: boolean; msg: string } {
  const p = procs().find((x) => x.pid === pid);
  if (!p) return { ok: false, msg: fmt(K().notFound, { pid }) };
  if (p.win) { closeWin(p.win); return { ok: true, msg: fmt(K().ok, { name: `${p.name} (${pid})` }) }; }
  const s = SYS.find((x) => x.pid === pid)!;
  return { ok: !s.fail, msg: s.kill() };
}

export const fmtMem = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`);
