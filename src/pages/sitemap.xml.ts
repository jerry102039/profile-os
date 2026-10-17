// sitemap.xml：列出所有原文頁面，並用 xhtml:link 標出各語言對應版本（Google 建議的多語做法）。
// fallback 頁（例如日文介面配英文內容的專案頁）canonical 指回原文，所以不列進來。
import type { APIRoute } from 'astro';
import { profile, defaultLocale, enabledLocales, contentLocales, type Locale } from '../profile';
import { href, uiFor } from '../i18n/server';
import { getNotes, noteLocales } from '../lib/notes';
import { siteOf, abs } from '../lib/seo';

type Entry = { path: string; locales: Locale[]; lastmod?: Date; priority: number };

export const GET: APIRoute = async ({ site }) => {
  const s = siteOf(site);
  const { features } = profile;
  const entries: Entry[] = [{ path: '/', locales: enabledLocales, priority: 1 }];
  if (features.projects) {
    entries.push({ path: '/projects/', locales: contentLocales(profile.pages.projects), priority: 0.8 });
    for (const p of profile.projects) entries.push({ path: `/projects/${p.slug}`, locales: contentLocales(p.desc), priority: 0.8 });
  }
  if (features.notes) {
    entries.push({ path: '/notes/', locales: contentLocales(profile.pages.notes), priority: 0.6 });
    for (const n of await getNotes(defaultLocale)) entries.push({ path: `/notes/${n.slug}`, locales: await noteLocales(n.slug), lastmod: n.data.date, priority: 0.6 });
  }

  const urls = entries.flatMap((e) => e.locales.map((locale) => {
    const xDefault = e.locales.includes(defaultLocale) ? defaultLocale : e.locales[0];
    const alts = e.locales.length > 1
      ? [
          ...e.locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${uiFor(l).htmlLang}" href="${abs(s, href(l, e.path))}"/>`),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(s, href(xDefault, e.path))}"/>`,
        ]
      : [];
    return [
      '  <url>',
      `    <loc>${abs(s, href(locale, e.path))}</loc>`,
      ...(e.lastmod ? [`    <lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>`] : []),
      `    <priority>${e.priority.toFixed(1)}</priority>`,
      ...alts,
      '  </url>',
    ].join('\n');
  }));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
