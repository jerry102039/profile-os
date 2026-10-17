import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLocale, enabledLocales, type Locale } from '../profile';
import { contentLocale, localePath } from '../i18n/locale';
import { uiFor } from '../i18n/server';

/** 一篇筆記；locale 是它實際用哪個語言寫的 */
export type Note = CollectionEntry<'notes'> & { slug: string; locale: Locale };

let cache: Promise<Note[]> | null = null;
/** 所有啟用語言的筆記（notes/<語言>/*.md），新到舊；draft 只在 dev 顯示 */
function allNotes(): Promise<Note[]> {
  cache ??= getCollection('notes', (n) => import.meta.env.DEV || !n.data.draft).then((list) =>
    list
      .flatMap((n) => {
        const [dir, ...rest] = n.id.split('/');
        const locale = enabledLocales.find((l) => localePath(l) === dir.toLowerCase());
        return locale ? [{ ...n, slug: rest.join('/'), locale }] : [];
      })
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()),
  );
  return cache;
}

/** 這篇筆記有哪些語言的原文 */
export const noteLocales = async (slug: string) => (await allNotes()).filter((n) => n.slug === slug).map((n) => n.locale);

/** 某語言要顯示的筆記：每個 slug 取最適合的語言版本（自己 → en → 預設語言） */
export async function getNotes(locale: Locale): Promise<Note[]> {
  const all = await allNotes();
  const slugs = [...new Set(all.map((n) => n.slug))];
  return slugs
    .map((slug) => {
      const versions = all.filter((n) => n.slug === slug);
      const best = contentLocale(versions.map((n) => n.locale), locale, defaultLocale);
      return versions.find((n) => n.locale === best)!;
    })
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const fmtDate = (d: Date, locale: Locale) =>
  d.toLocaleDateString(uiFor(locale).dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
