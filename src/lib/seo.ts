// SEO：schema.org 結構化資料（JSON-LD）。每一頁都指向同一個 Person，讓搜尋引擎知道整個網站在講誰。
import { profile, t$, fullName, enabledLocales, type Locale } from '../profile';
import { href, uiFor } from '../i18n/server';

export const siteOf = (site?: URL) => site ?? new URL('http://localhost:4321');
export const abs = (site: URL, path: string) => new URL(path, site).href;

type Node = Record<string, unknown>;
const personId = (site: URL) => abs(site, '/#person');
const websiteId = (site: URL) => abs(site, '/#website');
export const personRef = (site: URL) => ({ '@id': personId(site) });
export const inLanguage = (locale: Locale) => uiFor(locale).htmlLang;

export function person(site: URL, locale: Locale): Node {
  const o = profile.owner;
  const name = t$(o.name, locale);
  const alt = fullName.replace(name, '').trim();
  return {
    '@type': 'Person',
    '@id': personId(site),
    name,
    ...(alt ? { alternateName: alt } : {}),
    jobTitle: t$(o.title, locale),
    description: t$(o.description, locale),
    url: abs(site, href(locale, '/')),
    ...(o.avatar ? { image: abs(site, o.avatar) } : {}),
    sameAs: profile.contacts.flatMap((c) => (c.href?.startsWith('http') ? [c.href] : [])),
    ...(o.seo.affiliation ? { affiliation: { '@type': o.seo.affiliation.type, name: t$(o.seo.affiliation.name, locale) } } : {}),
    ...(o.seo.address ? { address: { '@type': 'PostalAddress', addressLocality: t$(o.seo.address.locality, locale), addressCountry: o.seo.address.country } } : {}),
    ...(o.seo.knowsAbout.length ? { knowsAbout: o.seo.knowsAbout } : {}),
  };
}

export const website = (site: URL): Node => ({
  '@type': 'WebSite',
  '@id': websiteId(site),
  name: profile.site.name,
  alternateName: fullName,
  url: abs(site, '/'),
  inLanguage: enabledLocales.map(inLanguage),
  publisher: personRef(site),
});

/** 麵包屑：[名稱, 路徑] */
export const breadcrumbs = (site: URL, items: [string, string][]): Node => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(site, path) })),
});

/** 把多個節點包成一份 JSON-LD */
export const graph = (...nodes: Node[]) => ({ '@context': 'https://schema.org', '@graph': nodes });

/** 給 <script type="application/ld+json"> 用：避免內容裡的 </script> 提早結束標籤 */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
