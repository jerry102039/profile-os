// robots.txt：全部開放收錄，並告訴爬蟲 sitemap 在哪
import type { APIRoute } from 'astro';
import { siteOf, abs } from '../lib/seo';

export const GET: APIRoute = ({ site }) =>
  new Response(['User-agent: *', 'Allow: /', '', `Sitemap: ${abs(siteOf(site), '/sitemap.xml')}`, ''].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
