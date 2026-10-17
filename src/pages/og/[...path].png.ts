// 分享預覽圖：build 時用 satori 把版面畫成 SVG，再用 resvg 轉 PNG（1200×630）
import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { profile, t$, fullName, defaultLocale, enabledLocales, contentLocales, type Locale } from '../../profile';
import { getNotes } from '../../lib/notes';
import { uiFor } from '../../i18n/server';
import { localePath } from '../../i18n/locale';
import { familyOf, cjkFallback } from '../../lib/fonts';

// 首頁每個啟用語言一張；專案、筆記只為「內容原文」的語言產生（fallback 頁沿用原文的圖）
type Card = { path: string; locale: Locale; kicker: string; title: string; sub: string };
const { site, features } = profile;

async function cards(): Promise<Card[]> {
  const out: Card[] = [];
  const add = (locale: Locale, path: string, c: Omit<Card, 'path' | 'locale'>) => out.push({ locale, path: `${localePath(locale)}/${path}`, ...c });
  for (const l of enabledLocales) {
    add(l, 'home', { kicker: site.name, title: fullName, sub: t$(profile.owner.title, l) });
    if (features.notes) for (const n of await getNotes(l)) if (n.locale === l) add(l, `notes/${n.slug}`, { kicker: `~/notes/${n.slug}`, title: n.data.title, sub: n.data.description });
  }
  if (features.notes) for (const l of contentLocales(profile.pages.notes)) add(l, 'notes', { kicker: '~/notes', title: uiFor(l).doc.notesTitle, sub: fullName });
  if (features.projects) {
    for (const l of contentLocales(profile.pages.projects)) add(l, 'projects', { kicker: '~/projects', title: uiFor(l).doc.projectsTitle, sub: fullName });
    for (const p of profile.projects) for (const l of contentLocales(p.desc)) add(l, `projects/${p.slug}`, { kicker: `~/projects/${p.slug}`, title: t$(p.title, l), sub: p.tags.join(' · ') });
  }
  return out;
}

export const getStaticPaths: GetStaticPaths = async () =>
  (await cards()).map((c) => ({ params: { path: c.path }, props: { card: c } }));

/** 只下載用得到的字：Google Fonts 的 text= 子集，回傳 TTF */
async function fetchFont(family: string, weight: number, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { 'User-Agent': 'node' } })).text();
  const src = css.match(/src: url\((.+?)\)/)?.[1];
  if (!src) throw new Error(`font not found: ${family}`);
  return (await fetch(src)).arrayBuffer();
}
type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 900 };
const fontCache = new Map<string, Promise<Font[]>>();
/** 每種字型各下載一次（只含所有卡片用到的字）；satori 缺字時會往後找，所以中日韓補字型與等寬字型放後面 */
function fonts(locale: Locale): Promise<Font[]> {
  const families = [...new Set([familyOf(locale), cjkFallback()])];
  return Promise.all([...families.map(load), load('JetBrains Mono')]).then((x) => x.flat());
}
function load(family: string): Promise<Font[]> {
  if (!fontCache.has(family)) fontCache.set(family, (async () => {
    const all = await cards();
    const text = [...new Set([...all.map((c) => c.title + c.sub + c.kicker).join(''), ...`${site.logo}${site.name}${fullName}◈ ·~/0123456789`])].join('');
    if (family === 'JetBrains Mono') return [{ name: family, data: await fetchFont(family, 400, text.replace(/[^\x20-\x7e]/g, '')), weight: 400 as const }];
    const [bold, black] = await Promise.all([fetchFont(family, 700, text), fetchFont(family, 900, text)]);
    return [{ name: family, data: bold, weight: 700 as const }, { name: family, data: black, weight: 900 as const }];
  })());
  return fontCache.get(family)!;
}

// satori 吃的是類 React 物件，這裡用一個小 helper 組
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: Card };
  const acc = site.theme.accents[0];
  // 背景格點
  const dots = [];
  for (let y = 0; y < 630; y += 42) for (let x = 0; x < 1200; x += 42) {
    dots.push(h('div', { position: 'absolute', left: x + 20, top: y + 20, width: 2, height: 2, background: 'rgba(200,230,215,.12)' }));
  }
  // 估算標題寬度（中日韓字約 1em、英數約 0.58em），盡量一行放得下
  const units = [...card.title].reduce((n, ch) => n + (/[⺀-￯]/.test(ch) ? 1 : 0.58), 0);
  const titleSize = Math.max(48, Math.min(80, Math.floor(1000 / units)));
  const tree = h('div', { width: 1200, height: 630, position: 'relative', background: 'linear-gradient(180deg,#0a0f14,#06090d)', color: '#e8f6ee', fontFamily: familyOf(card.locale) },
    ...dots,
    h('div', { position: 'absolute', right: -30, bottom: -90, fontSize: 300, fontWeight: 900, color: 'rgba(255,255,255,.035)' }, t$(profile.owner.name, defaultLocale)),
    h('div', { position: 'absolute', inset: 0, padding: '64px 72px', flexDirection: 'column', justifyContent: 'space-between' },
      h('div', { alignItems: 'center', gap: 18 },
        h('div', { width: 64, height: 64, border: `3px solid ${acc}`, borderRadius: 16, alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: acc }, site.logo),
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 26, color: acc, letterSpacing: 2 }, site.name),
      ),
      h('div', { flexDirection: 'column', gap: 18 },
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 24, color: 'rgba(232,246,238,.5)' }, card.kicker),
        h('div', { fontSize: titleSize, fontWeight: 900, lineHeight: 1.2, color: '#ffffff' }, card.title),
        h('div', { fontSize: 28, fontWeight: 700, color: 'rgba(232,246,238,.65)', lineHeight: 1.4 }, card.sub.length > 70 ? card.sub.slice(0, 68) + '…' : card.sub),
      ),
      h('div', { height: 6, width: 160, background: acc, borderRadius: 3 }, ''),
    ),
  );
  const svg = await satori(tree as any, { width: 1200, height: 630, fonts: await fonts(card.locale) });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
