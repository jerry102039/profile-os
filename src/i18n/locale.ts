// 語言代碼的小工具（build 時與瀏覽器端都能用，不碰 node API）
import type { Locale } from '../profile/schema';

/** 選單上顯示的原生語言名稱 */
export const LOCALE_NAMES: Record<Locale, string> = {
  'zh-Hant': '繁體中文', en: 'English', 'zh-Hans': '简体中文', ja: '日本語', ko: '한국어',
  es: 'Español', 'pt-BR': 'Português (Brasil)', de: 'Deutsch', fr: 'Français', ru: 'Русский',
};

/** URL 用的語言代碼：pt-BR → pt-br */
export const localePath = (l: Locale) => l.toLowerCase();

/** 某語言的站內網址：預設語言在根目錄，其他語言加前綴（/en/、/pt-br/…） */
export const localeUrl = (l: Locale, path: string, def: Locale) => (l === def ? path : `/${localePath(l)}${path}`);

/** 內容實際要用哪個語言：自己 → en → 預設語言 → 第一個有的 */
export function contentLocale(available: Locale[], l: Locale, def: Locale): Locale {
  for (const c of [l, 'en', def] as Locale[]) if (available.includes(c)) return c;
  return available[0] ?? def;
}

/** 瀏覽器偏好語言（navigator.languages）對到啟用中的語言 */
export function matchLocale(prefs: readonly string[], enabled: Locale[]): Locale | null {
  for (const p of prefs) {
    const [base, ...rest] = p.toLowerCase().split('-');
    const region = rest.join('-');
    let l: Locale | undefined;
    if (base === 'zh') l = /^(tw|hk|mo|hant)/.test(region) ? 'zh-Hant' : 'zh-Hans';
    else if (base === 'pt') l = 'pt-BR';
    else l = enabled.find((e) => e.toLowerCase() === base);
    if (l && enabled.includes(l)) return l;
  }
  return null;
}
