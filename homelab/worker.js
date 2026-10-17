// Cloudflare Worker：homelab 狀態的中繼站
//
//   PUT  /status  （帶 Authorization: Bearer <TOKEN>）→ 存進 KV，只有你的 homelab 能寫
//   GET  /status  → 任何人可讀（網站的 monitor.app 讀這個）
//
// 網站永遠不會直接連到你的內網；homelab 主動把「整理過的統計數字」推上來。

const MAX_BYTES = 16 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** 只保留網站會用到的欄位，其餘一律丟掉（避免不小心推上 IP、VM 名稱等） */
function sanitize(raw) {
  const num = (v, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const str = (v, n) => String(v ?? '').replace(/[^\w .:-]/g, '').slice(0, n);
  const pair = (o) => ({ running: Math.floor(num(o?.running)), total: Math.floor(num(o?.total)) });
  return {
    demo: false,
    updated: new Date().toISOString(),
    cluster: str(raw.cluster, 32),
    ceph: str(raw.ceph, 16),
    nodes: (Array.isArray(raw.nodes) ? raw.nodes : []).slice(0, 16).map((n) => ({
      name: str(n.name, 24),
      online: !!n.online,
      cpu: num(n.cpu, 0, 1),
      mem: num(n.mem, 0, 1),
      uptime: Math.floor(num(n.uptime)),
    })),
    vms: pair(raw.vms),
    cts: pair(raw.cts),
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/status') return new Response('not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (req.method === 'GET') {
      const body = (await env.STATUS.get('status')) ?? JSON.stringify({ demo: false, nodes: [], vms: {}, cts: {} });
      return new Response(body, {
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' },
      });
    }

    if (req.method === 'PUT') {
      const auth = req.headers.get('Authorization') ?? '';
      if (!env.TOKEN || auth !== `Bearer ${env.TOKEN}`) return new Response('unauthorized', { status: 401 });
      const text = await req.text();
      if (text.length > MAX_BYTES) return new Response('too large', { status: 413 });
      let data;
      try { data = JSON.parse(text); } catch { return new Response('bad json', { status: 400 }); }
      await env.STATUS.put('status', JSON.stringify(sanitize(data)));
      return new Response('ok');
    }

    return new Response('method not allowed', { status: 405 });
  },
};
