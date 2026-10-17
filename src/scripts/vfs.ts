// 虛擬檔案系統：檔案總管和終端機共用同一棵樹。
// 內建的檔案是唯讀的（屬於 root）；訪客用 mkdir / touch / nano 等建立的檔案會疊在上面，存在 localStorage。
import { D, B, t, emit, fmt, isOn, feat } from './core';

export type Kind = 'dir' | 'app' | 'txt' | 'pdf' | 'md' | 'enc' | 'link' | 'note' | 'trash';
export type VNode = {
  name: string;
  kind: Kind;
  children?: VNode[];
  /** 文字內容（cat / 預覽用） */
  text?: string;
  /** 打開時要做的動作（run() 的字串，例如 'open:skills'、'project:hos-web'、'href:/notes/x'、'cd:/home/<user>/Projects'） */
  action?: string;
  size?: string;
  icon?: string;
  /** 訪客建立的（可以改、可以刪） */
  user?: boolean;
  mtime?: number;
};

export const HOME = `/home/${B.user}`;

const bytes = (s: string) => {
  const n = new TextEncoder().encode(s).length;
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
};
const txt = (name: string, text: string): VNode => ({ name, kind: 'txt', text, size: bytes(text) });
const app = (name: string, action: string, icon: string): VNode => ({ name, kind: 'app', action, icon, size: '—' });
/** profile.yaml 關掉的 app 不出現在檔案系統裡（打開它的捷徑、它的資料夾都拿掉） */
const visible = (n: VNode) => {
  const a = n.action ?? '';
  if (a.startsWith('open:')) return isOn(a.slice(5));
  if (a === 'download-resume') return !!D.resume;
  if (a === `cd:${HOME}/Projects`) return isOn('projects');
  if (a === `cd:${HOME}/Notes`) return isOn('notes');
  if (n.kind === 'enc') return feat('ctf');
  return true;
};
const dir = (name: string, children: VNode[]): VNode => ({ name, kind: 'dir', children: children.filter(visible) });
const anyGame = ['snake', 'dino', 'mines', 'g2048'].some(isOn);

const aboutTxt = D.about.join('\n');
const bashHistory = t.vfs.history.join('\n');
const zshrc = t.vfs.zshrc.join('\n');
const readme = t.vfs.readme.join('\n');

/* ── 內建的樹 ── */
function buildBase(): VNode {
  return dir('/', [
    dir('home', [
      dir(B.user, [
        dir('Desktop', [
          { name: 'about.txt', kind: 'txt', text: aboutTxt, action: 'open:about', size: bytes(aboutTxt) },
          { name: 'projects', kind: 'dir', action: `cd:${HOME}/Projects`, children: [] },
          { name: 'skills.sys', kind: 'app', action: 'open:skills', icon: '%', size: '—' },
          { name: 'notes', kind: 'dir', action: `cd:${HOME}/Notes`, children: [] },
          app('monitor.app', 'open:status', '◉'),
          app('contact.app', 'open:contact', '@'),
          { name: 'resume.pdf', kind: 'pdf', action: 'open:resume', size: '—' },
        ]),
        dir('Documents', [
          txt('about.txt', aboutTxt),
          txt('certs.txt', D.certs.join('\n')),
          txt('awards.txt', D.awards.join('\n')),
          txt('open-source.txt', D.oss.join('\n')),
          txt('talks.txt', D.talks.join('\n')),
          txt('more-projects.txt', D.more.join('\n')),
          { name: 'resume.pdf', kind: 'pdf', action: 'open:resume', size: '—' },
          ...(isOn('certs') ? [dir('Certs', D.certItems.filter((c) => c.available).map((c) => ({ name: c.file, kind: 'pdf' as Kind, action: `cert:${c.id}`, size: 'PDF' })))] : []),
        ]),
        dir('Downloads', [
          { name: D.resumeName, kind: 'pdf', action: 'download-resume', size: '—' },
        ]),
        ...(isOn('projects') ? [dir('Projects', D.projects.map((p) => ({ name: `${p.slug}.md`, kind: 'link' as Kind, text: `# ${p.title}\n\n${p.desc}`, action: `project:${p.slug}`, size: bytes(p.desc) })))] : []),
        ...(isOn('notes') ? [dir('Notes', D.notes.map((n) => ({ name: `${n.slug}.md`, kind: 'note' as Kind, text: `# ${n.title}\n\n${n.desc}`, action: `href:${n.href}`, size: bytes(n.desc) })))] : []),
        dir('Applications', [
          app(`${t.appNames.finder}.app`, 'open:finder', '◫'),
          app(`${t.appNames.about}.app`, 'open:about', '>_'),
          app(`${t.appNames.calculator}.app`, 'open:calculator', '±'),
          app(`${t.appNames.calendar}.app`, 'open:calendar', '▦'),
          app(`${t.appNames.skills}.app`, 'open:skills', '%'),
          app(`${t.appNames.status}.app`, 'open:status', '◉'),
          app(`${t.appNames.taskmgr}.app`, 'open:taskmgr', '◔'),
          app(`${t.appNames.music}.app`, 'open:music', '♫'),
          app(`${t.appNames.certs}.app`, 'open:certs', '⎙'),
          app(`${t.appNames.appearance}.app`, 'open:appearance', '◑'),
          app(`${t.appNames.notes}.app`, 'open:notes', '✎'),
          app(`${t.appNames.contact}.app`, 'open:contact', '@'),
          app(`${t.appNames.resume}.app`, 'open:resume', '↓'),
        ]),
        ...(anyGame ? [dir('Games', [
          app(`${t.appNames.snake}.app`, 'open:snake', '🐍'),
          app(`${t.appNames.dino}.app`, 'open:dino', '🦖'),
          app(`${t.appNames.mines}.app`, 'open:mines', '✸'),
          app('2048.app', 'open:g2048', '⊞'),
        ])] : []),
        { name: 'README.md', kind: 'md', text: readme, size: bytes(readme) },
        { name: '.secret.enc', kind: 'enc', text: D.ctf.secret, size: bytes(D.ctf.secret) },
        txt('.bash_history', bashHistory),
        txt('.zshrc', zshrc),
      ]),
    ]),
    dir('etc', [txt('hostname', B.os), txt('motd', fmt(t.vfs.motd, { release: `${B.os} ${B.version}`.trim() }).join('\n'))]),
    dir('tmp', []),
    dir('Trash', t.trash.items.map(([name, size]) => ({ name, kind: 'trash' as Kind, size }))),
  ]);
}

/* ── 訪客的修改（疊在內建樹上，存 localStorage） ── */
type Entry = { kind: 'dir' | 'txt'; text?: string; mtime: number };
type Overlay = { files: Record<string, Entry>; deleted: string[] };
const KEY = `${B.storageKey}-fs`;
let ov: Overlay = { files: {}, deleted: [] };
try { ov = { files: {}, deleted: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(ov)); } catch {} };

export let tree: VNode = buildBase();
function rebuild() {
  tree = buildBase();
  for (const p of ov.deleted) detach(p);
  Object.keys(ov.files).sort((a, b) => a.split('/').length - b.split('/').length).forEach((p) => {
    const e = ov.files[p];
    const parent = ensureParent(p);
    if (!parent) return;
    const name = p.split('/').pop()!;
    const existing = parent.children!.find((c) => c.name === name);
    const node: VNode = e.kind === 'dir'
      ? { name, kind: 'dir', children: existing?.children ?? [], user: true, mtime: e.mtime }
      : { name, kind: name.endsWith('.md') ? 'md' : 'txt', text: e.text ?? '', size: bytes(e.text ?? ''), user: true, mtime: e.mtime };
    if (existing) parent.children!.splice(parent.children!.indexOf(existing), 1, node);
    else parent.children!.push(node);
  });
  emit('vfs');
}
function detach(p: string) {
  const parts = p.split('/').filter(Boolean);
  const parent = lookup('/' + parts.slice(0, -1).join('/'));
  const i = parent?.children?.findIndex((c) => c.name === parts[parts.length - 1]) ?? -1;
  if (i >= 0) parent!.children!.splice(i, 1);
}
function ensureParent(p: string): VNode | null {
  const parts = p.split('/').filter(Boolean);
  let node = tree;
  for (const s of parts.slice(0, -1)) {
    let next = node.children?.find((c) => c.name === s);
    if (!next) { next = { name: s, kind: 'dir', children: [], user: true }; node.children!.push(next); }
    if (next.kind !== 'dir') return null;
    node = next;
  }
  return node;
}
rebuild();

export const isHidden = (n: VNode) => n.name.startsWith('.');

/** 把相對路徑解析成絕對路徑 */
export function resolve(cwd: string, p = ''): string {
  if (!p || p === '~') return HOME;
  let base = p.startsWith('/') ? '' : p.startsWith('~') ? HOME : cwd;
  if (p.startsWith('~')) p = p.slice(1);
  const parts = (base + '/' + p).split('/');
  const out: string[] = [];
  for (const s of parts) {
    if (!s || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return '/' + out.join('/');
}

export function lookup(path: string): VNode | null {
  let node: VNode = tree;
  for (const s of path.split('/').filter(Boolean)) {
    const next: VNode | undefined = node.children?.find((c) => c.name === s);
    if (!next) return null;
    node = next;
  }
  return node;
}

/* ── 寫入操作：成功回傳 null，失敗回傳錯誤訊息（跟真的 shell 一樣用英文） ── */
const parentOf = (p: string) => '/' + p.split('/').filter(Boolean).slice(0, -1).join('/');
const nameOf = (p: string) => p.split('/').filter(Boolean).pop() ?? '';
const q = (s: string) => `'${s}'`;
const isRoot = (p: string) => p === '/' || p === HOME;
function writable(parent: string): string | null {
  const d = lookup(parent);
  if (!d) return `No such file or directory`;
  if (d.kind !== 'dir') return `Not a directory`;
  if (d.action?.startsWith('cd:')) return `Not a directory`;
  return null;
}

export function mkdir(path: string, parents = false): string | null {
  if (lookup(path)) return parents ? null : `mkdir: cannot create directory ${q(path)}: File exists`;
  const parent = parentOf(path);
  if (!lookup(parent)) {
    if (!parents) return `mkdir: cannot create directory ${q(path)}: No such file or directory`;
    const err = mkdir(parent, true);
    if (err) return err;
  }
  const err = writable(parent);
  if (err) return `mkdir: cannot create directory ${q(path)}: ${err}`;
  ov.files[path] = { kind: 'dir', mtime: Date.now() };
  persist(); rebuild();
  return null;
}

export function writeFile(path: string, text: string, append = false): string | null {
  const cur = lookup(path);
  if (cur?.kind === 'dir') return `${q(path)}: Is a directory`;
  if (cur && !cur.user) return `${q(path)}: Permission denied`;
  const err = writable(parentOf(path));
  if (err) return `${q(path)}: ${err}`;
  const prev = append ? (cur?.text ?? '') : '';
  ov.files[path] = { kind: 'txt', text: prev + text, mtime: Date.now() };
  ov.deleted = ov.deleted.filter((d) => d !== path);
  persist(); rebuild();
  return null;
}

export function remove(path: string, recursive = false): string | null {
  const n = lookup(path);
  if (!n) return `rm: cannot remove ${q(path)}: No such file or directory`;
  if (isRoot(path) || !n.user) return `rm: cannot remove ${q(path)}: Permission denied`;
  if (n.kind === 'dir' && !recursive) return `rm: cannot remove ${q(path)}: Is a directory`;
  for (const k of Object.keys(ov.files)) if (k === path || k.startsWith(path + '/')) delete ov.files[k];
  persist(); rebuild();
  return null;
}

export function copy(src: string, dst: string, recursive = false): string | null {
  const s = lookup(src);
  if (!s) return `cp: cannot stat ${q(src)}: No such file or directory`;
  if (s.kind === 'dir' && !recursive) return `cp: -r not specified; omitting directory ${q(src)}`;
  const d = lookup(dst);
  const target = d?.kind === 'dir' ? `${dst}/${nameOf(src)}` : dst;
  if (target === src || target.startsWith(src + '/')) return `cp: cannot copy ${q(src)} into itself`;
  const put = (node: VNode, at: string): string | null => {
    if (node.kind === 'dir') {
      const e = mkdir(at, true);
      if (e) return e;
      for (const c of node.children ?? []) { const e2 = put(c, `${at}/${c.name}`); if (e2) return e2; }
      return null;
    }
    const text = node.text ?? `[${node.kind}] ${node.name}`;
    const err = writeFile(at, text);
    return err ? `cp: ${err}` : null;
  };
  return put(s, target);
}

export function move(src: string, dst: string): string | null {
  const s = lookup(src);
  if (!s) return `mv: cannot stat ${q(src)}: No such file or directory`;
  if (!s.user) return `mv: cannot move ${q(src)}: Permission denied`;
  const err = copy(src, dst, true);
  if (err) return err.replace(/^cp:/, 'mv:');
  return remove(src, true);
}

/** 檔案總管的「丟到垃圾桶」：移到 /Trash */
export function trash(path: string): string | null {
  const n = lookup(path);
  if (!n || !n.user) return t.finder.denied;
  return move(path, `/Trash/${n.name}`);
}

/** 清空垃圾桶：只清訪客丟進去的，內建的那幾個「回憶」留著 */
export function emptyTrash(): number {
  const keys = Object.keys(ov.files).filter((k) => k.startsWith('/Trash/'));
  keys.forEach((k) => delete ov.files[k]);
  if (keys.length) { persist(); rebuild(); }
  return keys.length;
}

export function resetFs() {
  ov = { files: {}, deleted: [] };
  persist(); rebuild();
}

/** 列出所有訪客建立的路徑（工作管理員的記憶體數字用） */
export const userPaths = () => Object.keys(ov.files);

/** 用來顯示的路徑：/home/<user> → ~ */
export const pretty = (p: string) => (p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p);
export const kindLabel = (n: VNode) => t.finder.kinds[n.kind] ?? n.kind;
export const iconFor = (n: VNode) =>
  n.icon ?? ({ dir: '▰', app: '◆', txt: '≡', pdf: '⎙', md: '#', enc: '⚿', link: '▤', note: '✎', trash: '⌫' } as Record<Kind, string>)[n.kind];
