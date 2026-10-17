// build 時用的字典與網址：品牌占位符已經用 profile 填好
import { createHash } from 'node:crypto';
import { dicts, type UI } from './dict';
import { fillBrand } from './brand';
import { localeUrl, localePath, contentLocale } from './locale';
import { brandFor, defaultLocale, enabledLocales, type Locale } from '../profile';

const cache = new Map<Locale, UI>();
export const uiFor = (locale: Locale): UI => {
  if (!cache.has(locale)) cache.set(locale, fillBrand(dicts[locale] ?? dicts.en!, brandFor(locale)));
  return cache.get(locale)!;
};

/**
 * 給瀏覽器的字典檔：/i18n/<代碼>.<內容 hash>.json（src/pages/i18n/[file].json.ts 輸出）。
 * 不內嵌在 HTML 裡，首次繪製少下載約 10 KB；檔名帶 hash，可以永久快取。
 */
const assets = new Map<Locale, { url: string; json: string }>();
export const dictAsset = (locale: Locale) => {
  if (!assets.has(locale)) {
    const json = JSON.stringify(uiFor(locale));
    const hash = createHash('sha256').update(json).digest('hex').slice(0, 10);
    assets.set(locale, { url: `/i18n/${localePath(locale)}.${hash}.json`, json });
  }
  return assets.get(locale)!;
};

/** 站內網址：預設語言在根目錄，其他語言在 /<代碼>/ 底下 */
export const href = (locale: Locale, path = '/') => localeUrl(locale, path, defaultLocale);

/** [...locale] 動態路由的 getStaticPaths：預設語言的參數是 undefined（掛在根目錄） */
export const localeStaticPaths = () =>
  enabledLocales.map((locale) => ({ params: { locale: locale === defaultLocale ? undefined : localePath(locale) }, props: { locale } }));

/** fallback 頁要沿用哪個語言的內容（與分享預覽圖） */
export const sourceLocale = (alternates: Locale[], locale: Locale) => contentLocale(alternates, locale, defaultLocale);
