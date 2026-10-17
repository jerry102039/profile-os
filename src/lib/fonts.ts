// 各語言的字型：每頁只載入一套完整的 Noto（中日韓字型很大），都用 display=swap（先用系統字，載好立刻換上）。
// 非中日韓語言的頁面上如果有中日韓字（例如 logo「林」、中文名字），另外用 text= 只下載那幾個字。
import type { Locale } from '../profile';
import { defaultLocale } from '../profile';

const FAMILY: Record<Locale, string> = {
  'zh-Hant': 'Noto Sans TC', 'zh-Hans': 'Noto Sans SC', ja: 'Noto Sans JP', ko: 'Noto Sans KR',
  en: 'Noto Sans', es: 'Noto Sans', 'pt-BR': 'Noto Sans', de: 'Noto Sans', fr: 'Noto Sans', ru: 'Noto Sans',
};
const CJK = /[⺀-鿿가-힯豈-﫿＀-￯]/gu;
const css = (family: string, extra = '') => `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700${extra}&display=swap`;

export const MONO_FONT = css('JetBrains Mono');
export const familyOf = (locale: Locale) => FAMILY[locale];
/** 非中日韓頁面補中日韓字用的字型 */
export const cjkFallback = () => (FAMILY[defaultLocale] === 'Noto Sans' ? 'Noto Sans TC' : FAMILY[defaultLocale]);

/** 某語言頁面要載入的字型 CSS，以及 CSS 變數 --sans-font 的值 */
export function fontsFor(locale: Locale, pageText: string) {
  const family = FAMILY[locale];
  const urls = [MONO_FONT, css(family)];
  let stack = `'${family}'`;
  const cjk = [...new Set(pageText.match(CJK) ?? [])].join('');
  if (family === 'Noto Sans' && cjk) {
    // 用預設語言的中日韓字型（預設語言不是中日韓就用繁中）補那幾個字
    const sub = cjkFallback();
    urls.push(css(sub, `&text=${encodeURIComponent(cjk)}`));
    stack += `, '${sub}'`;
  }
  return { urls, family: stack };
}
