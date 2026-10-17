// 字典字串的占位符：fmt('{n} 個項目', { n: 3 })；複數用 plural({ one, other }, n, locale)

type Vars = Record<string, string | number>;

export function fmt(s: string, vars: Vars): string;
export function fmt(s: string[], vars: Vars): string[];
export function fmt(s: string | string[], vars: Vars): string | string[] {
  if (Array.isArray(s)) return s.map((x) => fmt(x, vars));
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** 依語言的複數規則選字串（CLDR 類別：zero / one / two / few / many / other） */
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };

const rules = new Map<string, Intl.PluralRules>();
export function plural(p: Plural, n: number, locale: string, vars: Vars = {}): string {
  let r = rules.get(locale);
  if (!r) rules.set(locale, (r = new Intl.PluralRules(locale)));
  return fmt(p[r.select(n) as keyof Plural] ?? p.other, { n, ...vars });
}
