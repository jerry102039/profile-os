// 介面字典：每個語言一個檔案（locales/<code>.ts），全部用 en.ts 的形狀檢查。
// 只在 build 時用；瀏覽器只會拿到目前語言、已經填好品牌的那一份（放在 #os-data）。
// 新增一種語言：複製 en.ts、翻譯、在這裡登記，再把代碼加進 src/profile/schema.ts 的 LOCALES。
import type { Locale } from '../profile/schema';
import en, { type Dict } from './locales/en';
import zhHant from './locales/zh-Hant';
import zhHans from './locales/zh-Hans';
import ja from './locales/ja';
import ko from './locales/ko';
import es from './locales/es';
import ptBR from './locales/pt-BR';
import de from './locales/de';
import fr from './locales/fr';
import ru from './locales/ru';

export type { Dict };
export type UI = Dict;

export const dicts: Record<Locale, Dict> = { 'zh-Hant': zhHant, en, 'zh-Hans': zhHans, ja, ko, es, 'pt-BR': ptBR, de, fr, ru };
