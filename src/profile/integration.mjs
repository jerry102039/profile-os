// profile 的 public/ 資料夾：跟 Astro 的 public/ 一樣原樣放到網站根目錄（同名時 profile 的優先）。
// dev 時由 Vite middleware 提供，build 完複製進 dist/。
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.mp3': 'audio/mpeg',
};

/** @param {string} profileDir @returns {import('astro').AstroIntegration} */
export default function profilePublic(profileDir) {
  const dir = join(profileDir, 'public');
  return {
    name: 'profile-public',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (!existsSync(dir) || !req.url) return next();
          const path = normalize(decodeURIComponent(req.url.split('?')[0]));
          const file = join(dir, path);
          if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
          createReadStream(file).pipe(res);
        });
      },
      'astro:build:done': ({ dir: out }) => {
        if (existsSync(dir)) cpSync(dir, fileURLToPath(out), { recursive: true, filter: (src) => !src.endsWith('.gitkeep') });
      },
    },
  };
}
