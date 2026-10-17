// 多語欄位取值：目前語言 → en → 預設語言 → 第一個有的值
import type { L, Locale } from './schema';

const isMap = (v: unknown): v is Partial<Record<Locale, unknown>> => !!v && typeof v === 'object' && !Array.isArray(v);

export function loc<T>(v: L<T>, locale: Locale, def: Locale): T {
  if (!isMap(v)) return v as T;
  const m = v as Partial<Record<Locale, T>>;
  return (m[locale] ?? m.en ?? m[def] ?? Object.values(m)[0]) as T;
}

/** profile 的 public/ 檔案在網站上的網址：'resume.pdf' 與 '/resume.pdf' 都變成 '/resume.pdf' */
export const publicUrl = (file: string) => `/${file.replace(/^\/+/, '')}`;

/** 這個欄位實際有寫的語言 */
export const localesOf = (v: L<unknown>): Locale[] | null => (isMap(v) ? (Object.keys(v) as Locale[]) : null);
