// 終端機：真的能打字，ls / cd / cat / mkdir / nano… 操作虛擬檔案系統
import { $, D, B, t, run, bootTime, fmtDuration, mq, beep, fmt, isOn } from './core';
import { commandOn } from '../apps/registry';
import { HOME, resolve, lookup, isHidden, pretty, mkdir, writeFile, remove, move, copy, resetFs, type VNode } from './vfs';
import { openWin, isOpen, focusWin, winBody } from './wm';
import { setAccent, setMode, setWallpaper, setPalette, accentRgb, getMode, getPalette, WALLPAPERS, PALETTES, wallpaperName } from './theme';
import { tryUnlock, ctfSolved } from './ctf';
import { procs, killProc, fmtMem } from './procs';
import { weatherSummary } from './widgets';

type Seg = [string, string?];
type Line = string | Seg[];

const term = $('#term');
const out = $('#term-out');
const input = $<HTMLInputElement>('#term-input');
const ps = $('#term-ps');
const scroller = () => winBody('about');

let cwd = HOME;
const history: string[] = [];
let hIdx = -1;
let hintIdx = 0;
/** `cmd > file` 時把輸出收進這裡，而不是印到畫面 */
let capture: string[] | null = null;

const promptText = () => `${B.user}@${B.os} ${pretty(cwd)} %`;
export const terminalCwd = () => cwd;

export function print(cmd: string | null, lines: Line[], prompt = promptText()) {
  if (capture) {
    // 錯誤訊息（stderr）照樣印在畫面上，其他的寫進檔案
    const errs = lines.filter((l) => typeof l !== 'string' && l.some((s) => s[1] === 'err'));
    lines.filter((l) => !errs.includes(l)).forEach((l) => capture!.push(typeof l === 'string' ? l : l.map((s) => s[0]).join('')));
    if (!errs.length) return;
    lines = errs;
    cmd = null;
  }
  const block = document.createElement('div');
  if (cmd !== null) {
    const head = document.createElement('div');
    const p = document.createElement('span');
    p.className = 'ps';
    p.textContent = prompt;
    head.append(p, ' ' + cmd);
    block.append(head);
  }
  for (const l of lines) {
    const d = document.createElement('div');
    d.className = 'out';
    if (typeof l === 'string') d.textContent = l;
    else for (const [text, cls] of l) {
      const s = document.createElement('span');
      if (cls?.startsWith('blk|')) { s.className = 'blk'; s.style.background = cls.slice(4); }
      else if (cls) s.className = cls;
      s.textContent = text;
      d.append(s);
    }
    block.append(d);
  }
  out.append(block);
  const sc = scroller();
  sc.scrollTop = sc.scrollHeight;
}

/** 讓其他模組在終端機裡跑一條指令（選單「說明」用） */
export function exec(cmd: string) {
  openWin('about');
  runCmd(cmd);
}

/* ── 小工具 ── */
const width = (s: string) => [...s].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);
const err = (s: string): Line => [[s, 'err']];
const unquote = (s: string) => s.replace(/^(['"])(.*)\1$/, '$2');
/** 像 shell 一樣切參數：支援引號 */
function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
const globToRe = (g: string) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

function cowsay(text: string): string[] {
  const s = text || 'moo';
  const w = width(s);
  return [' ' + '_'.repeat(w + 2), `< ${s} >`, ' ' + '-'.repeat(w + 2),
    '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'];
}

const nameCls = (c: VNode) => (c.kind === 'dir' ? 'acc' : c.kind === 'app' ? 'acc2' : isHidden(c) ? 'dim' : undefined);
function listDir(node: VNode, all: boolean, long: boolean): Line[] {
  const kids = (node.children ?? []).filter((c) => all || !isHidden(c));
  if (long) {
    return kids.map((c) => {
      const perm = c.kind === 'dir' ? 'drwxr-xr-x' : c.user ? '-rw-r--r--' : '-r--r--r--';
      const owner = c.user ? B.user : 'root ';
      const date = new Date(c.mtime ?? bootTime).toLocaleDateString(t.dateLocale, { month: 'short', day: '2-digit' });
      return [[`${perm}  ${owner}  ${(c.kind === 'dir' ? '-' : c.size ?? '-').padStart(8)}  ${date}  `, 'dim'], [c.name + (c.kind === 'dir' ? '/' : ''), nameCls(c)]] as Seg[];
    });
  }
  const segs: Seg[] = [];
  if (all) segs.push(['.  ', 'dim'], ['..  ', 'dim']);
  kids.forEach((c) => segs.push([c.name + (c.kind === 'dir' ? '/' : ''), nameCls(c)], ['  ']));
  return segs.length ? [segs] : [];
}

function treeLines(node: VNode, prefix = '', all = false): Line[] {
  const kids = (node.children ?? []).filter((c) => all || !isHidden(c));
  return kids.flatMap((c, i) => {
    const last = i === kids.length - 1;
    const line: Seg[] = [[prefix + (last ? '`-- ' : '|-- '), 'dim'], [c.name + (c.kind === 'dir' ? '/' : ''), nameCls(c)]];
    const sub = c.kind === 'dir' && !c.action ? treeLines(c, prefix + (last ? '    ' : '|   '), all) : [];
    return [line, ...sub];
  });
}

function walk(node: VNode, path: string, fn: (n: VNode, p: string) => void) {
  fn(node, path);
  if (node.kind === 'dir' && !node.action) node.children?.forEach((c) => walk(c, path === '/' ? `/${c.name}` : `${path}/${c.name}`, fn));
}

const opening = (app: string) => fmt(t.term.opening, { app });

function neofetch(): Line[] {
  const n = t.term.neofetch;
  const st = (window as any).__homelab as { nodes?: unknown[]; vms?: { running: number; total: number } } | undefined;
  // 左邊的 ASCII 圖來自 profile.yaml 的 persona.neofetchArt（只用 ASCII，避免方框字元掉到中文字型而對不齊）
  const art = D.persona.neofetchArt;
  const pad = ' '.repeat(art[0]?.length ?? 16);
  const [r, g, b] = accentRgb();
  const info: [string, string][] = [
    [n.os, `${B.os} ${B.version}`.trim()],
    [n.host, 'homelab-rack-01'],
    [n.kernel, `${B.user}-6.9.0-coffee`],
    [n.uptime, fmtDuration(Date.now() - bootTime)],
    [n.shell, `lsh 1.0 (${B.os} shell)`],
    [n.res, `${innerWidth}x${innerHeight}`],
    [n.theme, `${getPalette()} · ${getMode()} · rgb(${r},${g},${b})`],
    [n.cpu, n.cpuVal],
    [n.mem, n.memVal],
    [n.cluster, st?.vms ? fmt(n.clusterVal, { nodes: String(st.nodes?.length ?? '?'), vms: `${st.vms.running}/${st.vms.total}` }) : '—'],
  ];
  const lines: Line[] = [[[art[0] ?? pad, 'acc'], [B.user, 'acc'], ['@'], [B.os, 'acc']], [[art[1] ?? pad, 'acc'], ['-'.repeat(B.user.length + B.os.length + 1), 'dim']]];
  info.forEach(([k, v], i) => lines.push([[art[i + 2] ?? pad, 'acc'], [k, 'acc'], [': ' + v]]));
  const blocks: Seg[] = [[pad]];
  ['#ff5f57', '#febc2e', '#28c840', '#6cb6ff', '#c792ea', 'var(--acc)', 'var(--fg)'].forEach((c) => blocks.push([' ', `blk|${c}`]));
  lines.push(blocks);
  return lines;
}

async function ping(host: string | undefined) {
  const h = host || 'localhost';
  if (h === B.user) return print(`ping ${h}`, t.term.pingUser);
  if (!['localhost', '127.0.0.1', B.os.toLowerCase(), location.hostname].includes(h.toLowerCase())) return print(`ping ${h}`, [fmt(t.term.pingSandbox, { host: h })]);
  print(`ping ${h}`, [`PING ${h} (${location.origin}): 56 data bytes`]);
  const times: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    try {
      await fetch(`/favicon.svg?ping=${Date.now()}`, { cache: 'no-store' });
      const ms = performance.now() - t0;
      times.push(ms);
      print(null, [`64 bytes from ${h}: icmp_seq=${i} ttl=64 time=${ms.toFixed(1)} ms`]);
    } catch {
      print(null, [err(t.term.pingFail)]);
    }
  }
  if (times.length) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    print(null, [`--- ${h} ping statistics ---`, `${times.length} packets transmitted, round-trip min/avg/max = ${Math.min(...times).toFixed(1)}/${avg.toFixed(1)}/${Math.max(...times).toFixed(1)} ms`]);
  }
}

function openNode(node: VNode, path: string) {
  if (node.action?.startsWith('cd:')) { cwd = node.action.slice(3); ps.textContent = promptText(); return; }
  if (node.action) return run(node.action);
  if (node.kind === 'dir') { cwd = path; ps.textContent = promptText(); return; }
  if (node.user) return run(`nano:${path}`);
  if (node.text !== undefined) return run(`viewer:${path}`);
}

/* ── 指令 ── */
const ALL_COMMANDS = [
  'help', 'whoami', 'ls', 'll', 'cd', 'pwd', 'cat', 'less', 'more', 'head', 'tail', 'wc', 'grep', 'find', 'tree', 'file', 'stat',
  'mkdir', 'rmdir', 'touch', 'rm', 'mv', 'cp', 'nano', 'echo', 'open', 'project', 'certs', 'awards', 'oss', 'talks', 'notes', 'neofetch',
  'uptime', 'ping', 'status', 'theme', 'palette', 'accent', 'wallpaper', 'lang', 'history', 'date', 'cal', 'sudo', 'clear',
  'env', 'which', 'df', 'free', 'sleep', 'lock', 'reboot', 'shutdown', 'fortune', 'cowsay', 'sl', 'party', 'matrix', 'ssh',
  'base64', 'unlock', 'hint', 'shortcuts', 'exit', 'calc', 'finder', 'ps', 'kill', 'htop', 'taskmgr', 'top', 'music', 'play', 'pause',
  'next', 'prev', 'weather', 'snake', 'dino', 'mines', '2048', 'reset-fs', ...Object.keys(t.term.quips),
];
// profile.yaml 關掉的功能：指令當作不存在（補完、help 也不會出現）
const cmdOn = (c: string) => commandOn(c, D.features, new Set(D.apps));
const COMMANDS = ALL_COMMANDS.filter(cmdOn);
const APPS = ['about', 'finder', 'projects', 'skills', 'notes', 'status', 'calculator', 'calendar', 'contact', 'resume', 'taskmgr', 'music', 'certs', 'appearance', 'snake', 'dino', 'mines', 'g2048'].filter(isOn);
/** help 的一行：裡面提到的指令全都被關掉才拿掉（有任何一個普通指令就保留） */
const helpLineOn = (line: string) => {
  const words = line.trim().split(/[\s·/|]+/).filter((w) => ALL_COMMANDS.includes(w));
  return !words.length || words.some(cmdOn);
};
const ENV: Record<string, string> = {
  HOME, USER: B.user, SHELL: '/bin/lsh', TERM: 'xterm-256color', LANG: `${t.dateLocale.replace('-', '_')}.UTF-8`,
  EDITOR: 'nano', PATH: '/usr/local/bin:/usr/bin:/bin:/opt/coffee/bin', HOSTNAME: B.os, COFFEE: '87%', PWD: HOME,
};

async function runCmd(raw: string) {
  const line = raw.trim();
  if (!line) return;
  history.push(line);
  hIdx = -1;
  // 重新導向：cmd > file / cmd >> file
  const m = /^(.*?)\s*(>>|>)\s*(\S+)$/.exec(line);
  if (m) {
    const [, inner, op, file] = m;
    const target = resolve(cwd, file);
    capture = [];
    try { await execute(inner.trim(), line); } finally {
      const text = capture.join('\n') + (capture.length ? '\n' : '');
      capture = null;
      const e = writeFile(target, text, op === '>>');
      print(line, e ? [err(`lsh: ${e}`)] : []);
    }
    return;
  }
  await execute(line, line);
}

async function execute(cmd: string, shown: string) {
  const [c, ...rest] = tokenize(cmd);
  if (!c) return print(shown, []);
  const arg = rest[0];
  const flags = rest.filter((r) => /^-\w+$/.test(r)).join('');
  const args = rest.filter((r) => !/^-\w+$/.test(r));
  const T = t.term;
  const pre = promptText();
  const say = (...lines: Line[]) => print(shown, lines, pre);
  const path = (p?: string) => resolve(cwd, p);
  const needFile = (name: string, p: string | undefined, allowDir = false): VNode | null => {
    if (!p) { say(err(`${name}: missing operand`)); return null; }
    const n = lookup(path(p));
    if (!n) { say(err(`${name}: ${p}: No such file or directory`)); return null; }
    if (n.kind === 'dir' && !allowDir) { say(err(`${name}: ${p}: Is a directory`)); return null; }
    return n;
  };
  const textOf = (n: VNode) => n.text ?? (n.kind === 'dir' ? '' : `[binary: ${n.kind}]`);
  const refresh = () => { ps.textContent = promptText(); ENV.PWD = cwd; };

  if (!cmdOn(c)) return say(err(fmt(T.notFound, { cmd: c })));
  switch (c) {
    case 'clear': out.replaceChildren(); $('#term-intro').hidden = true; return;
    case 'help': case 'man': return say(...T.help.filter(helpLineOn));
    case 'shortcuts': return say(...T.shortcuts);
    case 'whoami': return say(D.whoami);
    case 'pwd': return say(cwd);
    case 'ls': case 'll': case 'dir': {
      const all = flags.includes('a');
      const long = c === 'll' || flags.includes('l');
      const node = lookup(path(args[0] ?? '.'));
      if (!node) return say(err(`ls: ${args[0]}: No such file or directory`));
      if (node.kind !== 'dir') return say(node.name);
      return say(...listDir(node, all, long));
    }
    case 'cd': {
      const p = path(arg);
      const node = lookup(p);
      if (!node) return say(err(`cd: no such file or directory: ${arg}`));
      if (node.action?.startsWith('cd:')) cwd = node.action.slice(3);
      else if (node.kind !== 'dir') return say(err(`cd: not a directory: ${arg}`));
      else cwd = p;
      refresh();
      return say();
    }
    case 'cat': case 'less': case 'more': {
      if (!args.length) return say(err(`${c}: missing operand`));
      const lines: Line[] = [];
      for (const a of args) {
        const n = lookup(path(a));
        if (!n) lines.push(err(fmt(T.noFile, { file: a })));
        else if (n.kind === 'dir') lines.push(err(`${c}: ${a}: Is a directory`));
        else if (n.text === undefined) lines.push([[`${c}: ${a}: binary file (${n.kind})`, 'dim']]);
        else lines.push(...n.text.split('\n'));
      }
      return say(...lines);
    }
    case 'head': case 'tail': {
      const nIdx = rest.indexOf('-n');
      const count = nIdx >= 0 ? Number(rest[nIdx + 1]) || 10 : Number((flags.match(/\d+/) ?? [10])[0]);
      const file = args.filter((a) => a !== rest[nIdx + 1])[0];
      const n = needFile(c, file);
      if (!n) return;
      const ls = textOf(n).split('\n');
      return say(...(c === 'head' ? ls.slice(0, count) : ls.slice(-count)));
    }
    case 'wc': {
      const n = needFile('wc', args[0]);
      if (!n) return;
      const s = textOf(n);
      // 跟真的 wc 一樣：-l 算的是換行字元數
      const l = (s.match(/\n/g) ?? []).length, w = s.split(/\s+/).filter(Boolean).length, b = new TextEncoder().encode(s).length;
      if (flags.includes('l')) return say(`${l} ${args[0]}`);
      if (flags.includes('w')) return say(`${w} ${args[0]}`);
      if (flags.includes('c')) return say(`${b} ${args[0]}`);
      return say(`${String(l).padStart(6)} ${String(w).padStart(6)} ${String(b).padStart(6)} ${args[0]}`);
    }
    case 'grep': {
      const [pat, ...files] = args;
      if (!pat || !files.length) return say('usage: grep [-i] [-n] [-r] <pattern> <file...>');
      let re: RegExp;
      try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch { return say(err(`grep: invalid pattern: ${pat}`)); }
      const hits: Line[] = [];
      const scan = (n: VNode, p: string, label: boolean) => {
        if (n.kind === 'dir') {
          if (flags.includes('r')) n.children?.forEach((ch) => scan(ch, `${p}/${ch.name}`, true));
          else hits.push(err(`grep: ${p}: Is a directory`));
          return;
        }
        if (n.text === undefined) return;
        n.text.split('\n').forEach((l, i) => {
          if (!re.test(l)) return;
          const segs: Seg[] = [];
          if (label) segs.push([pretty(p) + ':', 'acc2']);
          if (flags.includes('n')) segs.push([`${i + 1}:`, 'dim']);
          const mm = re.exec(l)!;
          segs.push([l.slice(0, mm.index)], [mm[0], 'acc'], [l.slice(mm.index + mm[0].length)]);
          hits.push(segs);
        });
      };
      for (const f of files) {
        const n = lookup(path(f));
        if (!n) { hits.push(err(`grep: ${f}: No such file or directory`)); continue; }
        scan(n, path(f), files.length > 1 || n.kind === 'dir');
      }
      return say(...hits);
    }
    case 'find': {
      const nameIdx = rest.indexOf('-name');
      const pattern = nameIdx >= 0 ? rest[nameIdx + 1] : undefined;
      const start = args.find((a) => a !== pattern) ?? '.';
      const root = lookup(path(start));
      if (!root) return say(err(`find: '${start}': No such file or directory`));
      const re = pattern ? globToRe(unquote(pattern)) : null;
      const found: string[] = [];
      walk(root, path(start), (n, p) => { if (!re || re.test(n.name)) found.push(start === '.' ? '.' + p.slice(cwd.length) || '.' : p); });
      return say(...found.slice(0, 200));
    }
    case 'tree': {
      const root = lookup(path(args[0] ?? '.'));
      if (!root || root.kind !== 'dir') return say(err(`tree: ${args[0] ?? '.'}: No such directory`));
      const lines = treeLines(root, '', flags.includes('a'));
      let d = 0, f = 0;
      walk(root, '/', (n) => (n.kind === 'dir' ? d++ : f++));
      return say(pretty(path(args[0] ?? '.')), ...lines, '', `${d - 1} directories, ${f} files`);
    }
    case 'file': case 'stat': {
      const n = needFile(c, args[0], true);
      if (!n) return;
      const kinds: Record<string, string> = { dir: 'directory', txt: 'ASCII text', md: 'Markdown document, UTF-8 text', pdf: 'PDF document', app: `${B.os} application bundle`, enc: 'data (base64 encoded)', link: 'symbolic link to project', note: 'Markdown document', trash: 'deleted file' };
      if (c === 'file') return say(`${args[0]}: ${kinds[n.kind] ?? n.kind}`);
      return say(
        `  File: ${args[0]}`, `  Size: ${n.size ?? '-'}\tType: ${kinds[n.kind] ?? n.kind}`,
        `Access: (${n.kind === 'dir' ? '0755/drwxr-xr-x' : n.user ? '0644/-rw-r--r--' : '0444/-r--r--r--'})  Uid: ${n.user ? `1000/${B.user}` : '0/root'}`,
        `Modify: ${new Date(n.mtime ?? bootTime).toLocaleString(t.dateLocale, { hour12: false })}`,
      );
    }
    case 'mkdir': {
      if (!args.length) return say(err('mkdir: missing operand'));
      const errs = args.map((a) => mkdir(path(a), flags.includes('p'))).filter(Boolean) as string[];
      return say(...errs.map(err));
    }
    case 'touch': {
      if (!args.length) return say(err('touch: missing file operand'));
      const errs = args.map((a) => (lookup(path(a)) ? null : writeFile(path(a), ''))).filter(Boolean) as string[];
      return say(...errs.map((e) => err(`touch: cannot touch ${e}`)));
    }
    case 'rm': {
      if (flags.includes('r') && flags.includes('f') && args.some((r) => r === '/' || r === '/*' || r === '~' || r === HOME)) { say(err('rm: removing everything…')); return run('panic'); }
      if (!args.length) return say(err('rm: missing operand'));
      const errs = args.map((a) => remove(path(a), flags.includes('r'))).filter(Boolean) as string[];
      if (errs.some((e) => e.includes('Permission denied'))) beep('error');
      return say(...errs.map(err), ...(errs.some((e) => e.includes('Permission denied')) ? [[[T.rm, 'dim']] as Seg[]] : []));
    }
    case 'rmdir': {
      if (!args.length) return say(err('rmdir: missing operand'));
      const errs = args.map((a) => {
        const n = lookup(path(a));
        if (n?.kind === 'dir' && n.children?.length) return `rmdir: failed to remove '${a}': Directory not empty`;
        return remove(path(a), true)?.replace(/^rm:/, 'rmdir:') ?? null;
      }).filter(Boolean) as string[];
      return say(...errs.map(err));
    }
    case 'mv': case 'cp': {
      if (args.length < 2) return say(err(`${c}: missing destination file operand`));
      const dst = path(args[args.length - 1]);
      const srcs = args.slice(0, -1);
      if (srcs.length > 1 && lookup(dst)?.kind !== 'dir') return say(err(`${c}: target '${args[args.length - 1]}' is not a directory`));
      const errs = srcs.map((s) => (c === 'mv' ? move(path(s), dst) : copy(path(s), dst, flags.includes('r')))).filter(Boolean) as string[];
      return say(...errs.map(err));
    }
    case 'nano': case 'vi': case 'pico': {
      if (!arg) { run('nano:'); return say(); }
      const p = path(arg);
      const n = lookup(p);
      if (n?.kind === 'dir') return say(err(`${c}: ${arg}: Is a directory`));
      run(`nano:${p}`);
      return say();
    }
    case 'echo': return say(args.map(unquote).join(' ').replace(/\$(\w+)/g, (_, k) => ENV[k] ?? ''));
    case 'env': case 'printenv': return say(...Object.entries(ENV).map(([k, v]) => `${k}=${v}`));
    case 'export': { const [k, v] = (args[0] ?? '').split('='); if (k && v !== undefined) ENV[k] = unquote(v); return say(); }
    case 'which': case 'type':
      return say(...args.map((a) => (COMMANDS.includes(a) ? `/usr/bin/${a}` : `${a} not found`)));
    case 'df': return say(
      'Filesystem      Size  Used Avail Use% Mounted on',
      'rpool/ROOT      1.0T  420G  604G  41% /',
      'ceph-fs         40T   27T   13T   68% /mnt/ceph',
      `coffee          1.0L  130ml 870ml 13% /dev/${B.user}`,
      'localStorage    5.0M  ' + fmtMem(new Blob([localStorage.getItem(`${B.storageKey}-fs`) ?? '']).size / 1048576).padEnd(5) + '      -   - ' + HOME,
    );
    case 'free': {
      const h = (performance as any).memory as { usedJSHeapSize: number; jsHeapSizeLimit: number } | undefined;
      const used = h ? h.usedJSHeapSize / 1048576 : 42, total = h ? h.jsHeapSizeLimit / 1048576 : 4096;
      return say('              total        used        free', `Mem:      ${fmtMem(total).padStart(9)}   ${fmtMem(used).padStart(9)}   ${fmtMem(total - used).padStart(9)}`, 'Swap:         0 B         0 B         0 B   (coffee instead)');
    }
    case 'open': {
      if (arg && APPS.includes(arg)) { openWin(arg); return say(opening(arg)); }
      const p = path(arg);
      const node = arg ? lookup(p) : null;
      if (!node) return say(T.openUsage);
      say(opening(node.name));
      return openNode(node, p);
    }
    case 'finder': case 'calc': {
      const id = { finder: 'finder', calc: 'calculator' }[c]!;
      openWin(id); return say(opening(id));
    }
    case 'cal': {
      if (arg) { openWin('calendar'); return say(opening('calendar')); }
      const d = new Date(), y = d.getFullYear(), mo = d.getMonth();
      const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
      const head = `${d.toLocaleDateString(t.dateLocale, { month: 'long', year: 'numeric' })}`;
      const rows: Line[] = [[[head.padStart(Math.floor((20 + head.length) / 2)), 'acc']], [['Su Mo Tu We Th Fr Sa', 'dim']]];
      let row: Seg[] = [['   '.repeat(first)]];
      for (let i = 1; i <= days; i++) {
        row.push([String(i).padStart(2), i === d.getDate() ? 'acc2' : undefined], [' ']);
        if ((first + i) % 7 === 0 || i === days) { rows.push(row); row = []; }
      }
      return say(...rows);
    }
    case 'certs': openWin('certs'); return say(...D.certs, '', opening('certs'));
    case 'projects': case 'skills': case 'contact': case 'resume': case 'status':
      openWin(c); return say(opening(c));
    case 'top': case 'htop': case 'taskmgr': openWin('taskmgr'); return say(T.quips.top);
    case 'ps': {
      const list = procs().sort((a, b) => a.pid - b.pid);
      return say(
        [['  PID USER    %CPU       MEM S COMMAND', 'dim']],
        ...list.map((p) => `${String(p.pid).padStart(5)} ${p.user.padEnd(6)} ${p.cpu.toFixed(1).padStart(5)} ${fmtMem(p.mem).padStart(9)} ${p.state} ${p.cmd}`),
      );
    }
    case 'kill': {
      const n = Number(args[0]);
      if (!Number.isInteger(n)) return say(t.tm.kill.usage);
      const res = killProc(n);
      return say(res.ok ? res.msg : err(res.msg));
    }
    case 'music': openWin('music'); return say(opening('music'));
    case 'snake': case 'dino': openWin(c); return say(opening(c));
    case 'mines': case 'minesweeper': openWin('mines'); return say(opening('mines'));
    case '2048': openWin('g2048'); return say(opening('2048'));
    case 'play': run(`music:play${arg ? ':' + args.join(' ') : ''}`); return say();
    case 'pause': case 'stop': run('music:pause'); return say();
    case 'next': run('music:next'); return say();
    case 'prev': run('music:prev'); return say();
    case 'weather': return say(...(await weatherSummary()));
    case 'project': {
      const p = D.projects.find((x) => x.slug === arg);
      if (!p) return say(fmt(T.projectUsage, { slugs: D.projects.map((x) => x.slug).join(' ') }));
      run(`project:${p.slug}`);
      return say(opening(p.title));
    }
    case 'notes':
      return say(T.notes, ...(D.notes.length ? D.notes.map((n) => `  ${n.slug}  —  ${n.title}`) : [T.notesNone]));
    case 'awards': return say(...D.awards);
    case 'oss': return say(...D.oss);
    case 'talks': return say(...D.talks);
    case 'neofetch': case 'fastfetch': return say(...neofetch());
    case 'uptime': return say(fmt(T.uptime, { t: fmtDuration(Date.now() - bootTime) }));
    case 'ping': return ping(arg);
    case 'accent':
      if (arg && setAccent(arg)) return say(fmt(T.accentOk, { color: arg }));
      return say(fmt(T.accentUsage, { list: D.accents.join(' ') }));
    case 'theme': case 'palette':
      if (arg === 'light' || arg === 'dark' || arg === 'auto') { setMode(arg); return say(fmt(T.themeOk, { name: arg })); }
      if (arg && setPalette(arg)) return say(fmt(T.themeOk, { name: t.appearance.palettes[arg] }));
      if (arg && /^#?[0-9a-f]{6}$/i.test(arg) && setAccent(arg)) return say(fmt(T.accentOk, { color: arg }));
      return say(T.themeUsage, ...PALETTES.map((p) => [[p === getPalette() ? '* ' : '  ', 'acc'], [p.padEnd(12)], [t.appearance.palettes[p], 'dim']] as Seg[]));
    case 'wallpaper':
      if (arg && setWallpaper(arg)) return say(fmt(T.wallpaperOk, { name: wallpaperName(arg) }));
      return say(T.wallpaperUsage, '  ' + WALLPAPERS.join(' · '));
    case 'matrix': setWallpaper('matrix'); return say(fmt(T.wallpaperOk, { name: 'matrix' }));
    case 'lang':
      if (arg && arg.toLowerCase() !== D.locale.toLowerCase() && D.locales.some((l) => l.code === arg.toLowerCase())) { say(T.langSwitch); run(`lang:${arg.toLowerCase()}`); return; }
      return say(fmt(T.langUsage, { list: D.locales.map((l) => l.code).join(' ') }), ...D.locales.map((l) => [[l.code === D.locale.toLowerCase() ? '* ' : '  ', 'acc'], [l.code.padEnd(8)], [l.name, 'dim']] as Seg[]));
    case 'history': return say(...(history.length > 1 ? history.slice(0, -1).map((h, i) => `${String(i + 1).padStart(4)}  ${h}`) : [T.historyEmpty]));
    case 'date': return say(new Date().toLocaleString(t.dateLocale, { hour12: false }));
    case 'sudo':
      if (rest.join(' ').startsWith('rm -rf')) { say(T.sudo); return run('panic'); }
      return say(T.sudo);
    case 'reset-fs': resetFs(); return say('ok');
    case 'exit': case 'logout': return say(T.exit);
    case 'ssh': { say(...fmt(T.ssh, { host: arg?.split('@').pop() || B.os.toLowerCase() })); return void setTimeout(() => openWin('contact'), 500); }
    case 'sleep': say(); return run('sleep');
    case 'lock': say(); return run('lock');
    case 'reboot': case 'restart': say(); return run('restart');
    case 'shutdown': case 'poweroff': case 'halt': say(); return run('shutdown');
    case 'fortune': return say(T.fortunes[Math.floor(Math.random() * T.fortunes.length)]);
    case 'cowsay': return say(...cowsay(args.map(unquote).join(' ') || T.fortunes[Math.floor(Math.random() * T.fortunes.length)]));
    case 'sl': say(); return run('sl');
    case 'party': case 'confetti': say('🎉'); return run('party');
    case 'base64': {
      const s = args.filter((r) => r !== '-d' && r !== '--decode').join('');
      if (!rest.includes('-d') && !rest.includes('--decode')) {
        return say(s ? btoa(String.fromCharCode(...new TextEncoder().encode(args.join(' ')))) : T.base64Usage);
      }
      try { return say(new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)))); }
      catch { return say(err(T.base64Bad)); }
    }
    case 'unlock': {
      if (!arg) return say(T.unlockUsage);
      const flag = tryUnlock(rest.join(' '));
      if (!flag) { beep('error'); return say(err(T.unlockBad)); }
      const [a, b, c2] = fmt(T.unlockOk, { flag, mail: D.email });
      say([[a, 'acc']], [[b, 'acc2']], c2);
      return run('party');
    }
    case 'hint':
      if (ctfSolved()) return say(t.toast.flag);
      say(T.hints[Math.min(hintIdx, T.hints.length - 1)]);
      hintIdx++;
      return;
  }
  if (c in T.quips) return say(T.quips[c]);
  beep('error');
  say(err(fmt(T.notFound, { cmd: c })));
}

/* ── Tab 自動補完 ── */
function complete() {
  const v = input.value;
  const parts = v.split(/\s+/);
  let cands: string[];
  const last = parts[parts.length - 1];
  if (parts.length === 1) cands = COMMANDS.filter((c) => c.startsWith(last));
  else {
    const c = parts[0];
    const opts: Record<string, string[]> = {
      open: APPS, project: D.projects.map((p) => p.slug), wallpaper: [...WALLPAPERS], theme: ['light', 'dark', 'auto', ...PALETTES], palette: [...PALETTES],
      accent: D.accents, lang: D.locales.map((l) => l.code),
    };
    if (opts[c] && !last.includes('/')) cands = opts[c].filter((o) => o.startsWith(last));
    else {
      // 路徑補完
      const slash = last.lastIndexOf('/');
      const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
      const base = slash >= 0 ? last.slice(slash + 1) : last;
      const node = lookup(resolve(cwd, dirPart || '.'));
      cands = (node?.children ?? [])
        .filter((ch) => ch.name.startsWith(base) && (base.startsWith('.') || !isHidden(ch)))
        .map((ch) => dirPart + ch.name + (ch.kind === 'dir' ? '/' : ''));
    }
  }
  if (cands.length === 1) {
    parts[parts.length - 1] = cands[0];
    input.value = parts.join(' ') + (cands[0].endsWith('/') ? '' : ' ');
  } else if (cands.length > 1) {
    // 補到共同前綴，並列出候選
    let pre = cands[0];
    for (const x of cands) while (!x.startsWith(pre)) pre = pre.slice(0, -1);
    parts[parts.length - 1] = pre;
    input.value = parts.join(' ');
    print(v, [cands.join('  ')]);
  }
}

export function initTerminal() {
  ps.textContent = promptText();
  term.addEventListener('click', () => { if (!getSelection()?.toString()) input.focus({ preventScroll: true }); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; runCmd(v); }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      hIdx = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
      input.value = history[hIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx < 0) return;
      hIdx = Math.min(history.length, hIdx + 1);
      input.value = history[hIdx] ?? '';
      if (hIdx === history.length) hIdx = -1;
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); runCmd('clear'); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); print(input.value + '^C', []); input.value = ''; }
  });
}

/** 終端機視窗打開時自動聚焦（桌機） */
export function focusTerminal() {
  if (isOpen('about') && mq.fine.matches && !mq.mobile.matches) { focusWin('about'); input.focus({ preventScroll: true }); }
}
