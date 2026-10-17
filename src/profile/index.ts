// build 時用的 profile：讀一次、驗證一次，整個網站共用。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProfileDir, readProfile } from './load.mjs';
import { parseProfile, type Locale, type L } from './schema';
import { loc, localesOf } from './localize';

export { loc, publicUrl } from './localize';
export { LOCALES, type Locale, type L, type Profile, type Project } from './schema';

export const profileDir: string = resolveProfileDir();

export const profile = parseProfile(readProfile(profileDir), join(profileDir, 'profile.yaml'));

export const defaultLocale: Locale = profile.site.defaultLocale;
export const enabledLocales: Locale[] = profile.site.locales;

/** 取多語欄位在某語言的值 */
export const t$ = <T>(v: L<T>, locale: Locale): T => loc(v, locale, defaultLocale);

/** profile 的 public/ 底下的檔案（build 時讀檔用） */
export const publicPath = (p: string) => join(profileDir, 'public', p);
export const hasPublic = (p: string) => existsSync(publicPath(p));
/** PNG 的寬高（讀 IHDR），給 <img> 標 width/height */
export const pngSize = (p: string) => {
  const b = readFileSync(publicPath(p));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

/** 名字：預設語言的名字 + 英文名（不同時才加），例如「王小明 Ming Wang」 */
export const fullName = (() => {
  const a = t$(profile.owner.name, defaultLocale);
  const b = t$(profile.owner.name, 'en');
  return a === b ? a : `${a} ${b}`;
})();

/** 頁面標題用的名字：預設語言顯示完整名字，其他語言顯示該語言的名字 */
export const displayName = (locale: Locale) => (locale === defaultLocale ? fullName : t$(profile.owner.name, locale));

/** 字典品牌占位符的值（見 src/i18n/brand.ts） */
export const brandFor = (locale: Locale) => ({
  os: profile.site.name,
  user: profile.owner.username,
  owner: t$(profile.owner.name, locale),
  github: profile.owner.github ? `github.com/${profile.owner.github}` : 'github.com',
  email: profile.owner.email,
  city: t$(profile.owner.location.name, locale),
  cityEn: t$(profile.owner.location.name, 'en'),
});

/** 給瀏覽器端腳本的品牌與個人化設定 */
export const clientBrand = (locale: Locale) => ({
  ...brandFor(locale),
  logo: profile.site.logo,
  version: profile.site.version,
  storageKey: profile.site.storageKey,
  lat: profile.owner.location.lat,
  lon: profile.owner.location.lon,
});
export const clientPersona = (locale: Locale) => ({
  lockPassword: profile.persona.lockPassword.map((p) => p.toLowerCase()),
  calendar: profile.persona.calendar.map((e) => ({ date: e.date, title: t$(e.title, locale) })),
  matrixGlyphs: profile.persona.matrixGlyphs,
  neofetchArt: profile.persona.neofetchArt,
});

/**
 * 一個多語欄位「真的有寫」的啟用語言。字串（所有語言共用）算預設語言的內容；
 * 用來決定哪些頁面是原文、哪些是 fallback（fallback 頁 canonical 指回原文、不進 sitemap）。
 */
export const contentLocales = (v: L<unknown> | undefined): Locale[] => {
  const own = v === undefined ? null : localesOf(v);
  const list = own ?? [defaultLocale];
  const ok = enabledLocales.filter((l) => list.includes(l));
  return ok.length ? ok : [defaultLocale];
};

/** homelab 狀態 JSON 的來源；部署 Worker 後在 .env 設 PUBLIC_STATUS_URL */
export const statusUrl: string = import.meta.env.PUBLIC_STATUS_URL || '/status.json';
