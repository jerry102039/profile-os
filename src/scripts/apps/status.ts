// Homelab 監視器：讀取 status JSON（預設 /status.json 示範資料，部署 Worker 後換成真的）
import { $, D, t, fmt } from '../core';
import { isOpen } from '../wm';

type Status = {
  demo?: boolean;
  updated?: string;
  cluster?: string;
  ceph?: string;
  nodes?: { name: string; online: boolean; cpu: number; mem: number; uptime: number }[];
  vms?: { running: number; total: number };
  cts?: { running: number; total: number };
};

const root = $('#status-root');
const S = t.status;

const pct = (v: unknown) => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100);
const int = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

function ago(iso?: string) {
  const ms = iso ? Date.now() - Date.parse(iso) : NaN;
  if (!isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const [v, u] = s < 60 ? [s, S.units.s] : s < 3600 ? [Math.floor(s / 60), S.units.m] : s < 86400 ? [Math.floor(s / 3600), S.units.h] : [Math.floor(s / 86400), S.units.d];
  return fmt(S.ago, { t: `${v} ${u}`.replace(/ (?=[a-z]$)/, '') });
}

const upt = (sec: number) => {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h`;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render(st: Status | null) {
  root.replaceChildren();
  const head = el('div', 'st-head');
  head.append(el('h3', '', st?.cluster ? `${S.title} · ${st.cluster}` : S.title));
  head.append(el('span', `badge ${!st ? 'off' : st.demo ? 'demo' : 'live'}`, !st ? S.offline : st.demo ? S.demo : S.live));
  if (st && !st.demo) head.append(el('span', 'st-updated', `${S.updated} ${ago(st.updated)}`));
  root.append(head);
  if (!st) { root.append(el('p', 'dim', S.error)); return; }

  const nodes = (st.nodes ?? []).slice(0, 16);
  const online = nodes.filter((n) => n.online).length;
  const tiles = el('div', 'st-tiles');
  const tile = (label: string, value: string, cls = '') => { const d = el('div', `st-tile ${cls}`); d.append(el('b', '', value), el('span', '', label)); tiles.append(d); };
  tile(S.nodes, `${online}/${nodes.length}`, online === nodes.length ? 'ok' : 'warn');
  tile(S.vms, `${int(st.vms?.running)}/${int(st.vms?.total)}`);
  tile(S.cts, `${int(st.cts?.running)}/${int(st.cts?.total)}`);
  const ceph = String(st.ceph ?? '—').slice(0, 16);
  tile(S.ceph, ceph.replace('HEALTH_', ''), ceph === 'HEALTH_OK' ? 'ok' : 'warn');
  root.append(tiles);

  for (const n of nodes) {
    const row = el('div', 'st-node');
    row.append(el('span', `led${n.online ? '' : ' down'}`), el('span', 'nm', String(n.name).slice(0, 24)));
    for (const [label, v] of [[S.cpu, n.cpu], [S.mem, n.mem]] as const) {
      const m = el('div', 'mini');
      const bar = el('i');
      bar.style.setProperty('--v', `${pct(v)}%`);
      m.append(el('span', '', label), bar);
      m.title = `${label} ${pct(v)}%`;
      row.append(m);
    }
    row.append(el('span', 'dim upt', n.online ? `${S.up} ${upt(int(n.uptime))}` : '—'));
    root.append(row);
  }
  if (st.demo) root.append(el('p', 'st-note', S.demoNote));
}

export async function fetchStatus(): Promise<Status | null> {
  try {
    const r = await fetch(D.statusUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const st = (await r.json()) as Status;
    (window as any).__homelab = st; // neofetch 會讀
    return st;
  } catch {
    return null;
  }
}

async function refresh() {
  render(await fetchStatus());
}

export function initStatus() {
  refresh();
  // 視窗開著才每 30 秒更新
  setInterval(() => { if (isOpen('status') && !document.hidden) refresh(); }, 30_000);
}
