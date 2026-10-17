// 字典裡的品牌占位符：{os} {user} {owner} {github} {email} {city} {cityEn}，用 profile 的值填好。
// 其他占位符（例如 {n}、{name}）留給執行時的 fmt() 處理，所以品牌占位符的名字不能跟它們重複。

export type Brand = { os: string; user: string; owner: string; github: string; email: string; city: string; cityEn: string };

const KEYS = /\{(os|user|owner|github|email|cityEn|city)\}/g;

export function fillBrand<T>(v: T, b: Brand): T {
  if (typeof v === 'string') return v.replace(KEYS, (_, k: keyof Brand) => b[k]) as T;
  if (Array.isArray(v)) return v.map((x) => fillBrand(x, b)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillBrand(x, b)])) as T;
  return v;
}
