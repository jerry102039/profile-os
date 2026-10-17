// profile.yaml 的格式：build 時用 zod 驗證，寫錯欄位會直接讓 build 失敗並指出是哪一欄。
// 可多語的欄位寫成字串（所有語言共用）或 { zh-Hant: …, en: … }，缺的語言依 localize.ts 的順序補上。
import { z } from 'astro/zod';

/** 引擎有字典的語言；profile 只能從這裡面挑 */
export const LOCALES = ['zh-Hant', 'en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR', 'de', 'fr', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
const LocaleEnum = z.enum(LOCALES);

/** 可多語的值 */
export type L<T> = T | Partial<Record<Locale, T>>;
const l = <T extends z.ZodTypeAny>(t: T) => z.union([t, z.record(LocaleEnum, t)]);
const str = z.string();
const lines = z.array(z.string());

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a colour like #5dffa6');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and dashes');

const Project = z.object({
  slug,
  title: l(str),
  desc: l(str),
  /** 沒有截圖時佔位框裡的字 */
  placeholder: l(str).optional(),
  context: l(str).optional(),
  role: l(str).optional(),
  highlights: l(lines).default([]),
  outcome: l(lines).default([]),
  tags: z.array(str).default([]),
  /** 截圖：放在 profile 的 public/ 底下，填 '/projects/xxx.jpg' */
  image: str.optional(),
  tone: z.enum(['acc', 'acc2']).optional(),
  /** 架構圖（純文字，等寬字型顯示） */
  arch: str.optional(),
  links: z.array(z.object({ label: l(str), href: str })).default([]),
  timeline: z.array(z.object({ year: z.coerce.string(), text: l(str) })).default([]),
});

const on = z.boolean().default(true);
export const FeaturesSchema = z.object({
  finder: on, projects: on, notes: on, skills: on, status: on, taskmgr: on, music: on,
  calculator: on, calendar: on, contact: on, resume: on, certs: on, editor: on, appearance: on,
  games: z.object({ snake: on, dino: on, mines: on, g2048: on }).strict().default({}),
  widgets: z.object({ weather: on, notes: on }).strict().default({}),
  ctf: on, bootAnimation: on, languageSwitcher: on, easterEggs: on,
}).strict().default({}); // strict：開關名稱打錯（例如 musik）要報錯，不能默默忽略

export const ProfileSchema = z.object({
  site: z.object({
    /** 作業系統的名字：選單列、標題、分享預覽圖 */
    name: str.min(1),
    url: z.string().url(),
    version: str.default(''),
    /** 開機畫面、系統資訊、頭像預設的大字（一兩個字） */
    logo: str.min(1).max(4),
    /** localStorage 的前綴；改了訪客存的偏好就會歸零 */
    storageKey: z.string().regex(/^[a-z0-9-]+$/),
    defaultLocale: LocaleEnum,
    locales: z.array(LocaleEnum).min(1),
    theme: z.object({
      accents: z.array(hex).min(1).default(['#5dffa6', '#7dd3fc', '#ffd166', '#ff7ab6', '#c792ea', '#ff8a65']),
    }).default({}),
  }),
  owner: z.object({
    name: l(str),
    /** 終端機與檔案系統裡的使用者名稱（/home/<username>） */
    username: z.string().regex(/^[a-z_][a-z0-9_-]*$/),
    email: z.string().email(),
    github: str.optional(),
    /** 頭像：放在 profile 的 public/ 底下，填 '/avatar.jpg' */
    avatar: str.optional(),
    title: l(str),
    whoami: l(str),
    about: l(lines),
    interests: l(lines).default([]),
    status: l(str),
    description: l(str),
    /** 天氣小工具的預設地點 */
    location: z.object({ name: l(str), lat: z.number(), lon: z.number() }),
    seo: z.object({
      affiliation: z.object({ type: str.default('Organization'), name: l(str) }).optional(),
      address: z.object({ locality: l(str), country: str }).optional(),
      knowsAbout: z.array(str).default([]),
    }).default({}),
  }),
  resume: z.object({ file: str.default('resume.pdf'), downloadName: l(str) }).optional(),
  /** 獨立頁面（/projects/、/notes/）的介紹文字；省略時用通用文字 */
  pages: z.object({ projects: l(str).optional(), notes: l(str).optional() }).default({}),
  projects: z.array(Project).default([]),
  moreProjects: z.array(z.object({ name: str, desc: l(str) })).default([]),
  skills: z.array(z.object({ name: str, label: l(str), pct: z.number().min(0).max(100), tone: z.enum(['acc', 'acc2']).optional() })).default([]),
  skillsFooter: l(str).optional(),
  contacts: z.array(z.object({ label: str, value: l(str), href: str.optional() })).default([]),
  /** 終端機 certs 指令與 Documents/certs.txt 的摘要 */
  certSummary: l(lines).default([]),
  /** 證照 PDF：放在 profile 的 public/certs/<file> */
  certificates: z.array(z.object({ id: slug, file: str, issuer: str, title: l(str) })).default([]),
  awards: l(lines).default([]),
  oss: l(lines).default([]),
  talks: l(lines).default([]),
  features: FeaturesSchema,
  /** 開機後自動打開的視窗（依序） */
  startup: z.array(str).default(['about']),
  persona: z.object({
    /** 鎖定畫面的密碼（任一個都可以） */
    lockPassword: z.array(str).min(1).default(['coffee']),
    /** 行事曆內建事件：日期 MM-DD */
    calendar: z.array(z.object({ date: z.string().regex(/^\d\d-\d\d$/), title: l(str) })).default([]),
    /** 駭客任務桌布雨裡額外混入的字 */
    matrixGlyphs: str.default(''),
    /** neofetch 左邊的 ASCII 圖（每行同寬，最多 6 行；只用 ASCII 才對得齊） */
    neofetchArt: z.array(str).max(6).default([
      '   _________    ',
      '  |  _____  |   ',
      '  | | >_  | |   ',
      '  | |_____| |   ',
      '  |_________|   ',
      '     _|_|_      ',
    ]),
  }).default({}),
  /** 終端機解謎彩蛋：只在 build 時使用，明文不會出現在輸出的檔案裡 */
  ctf: z.object({ flag: z.string().regex(/^FLAG\{[\x20-\x7e]+\}$/), key: str.min(4) }).optional(),
}).superRefine((p, ctx) => {
  if (!p.site.locales.includes(p.site.defaultLocale)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site', 'defaultLocale'], message: `must be one of site.locales (${p.site.locales.join(', ')})` });
  }
  if (new Set(p.site.locales).size !== p.site.locales.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site', 'locales'], message: 'duplicate locale' });
  }
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Project = z.infer<typeof Project>;
export type Features = z.infer<typeof FeaturesSchema>;

/** 把 zod 的錯誤整理成「欄位路徑: 原因」一行一個 */
export const formatIssues = (e: z.ZodError) => e.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');

/** 驗證 profile.yaml 的內容；錯了就丟出列出每個欄位的錯誤（astro.config 與網站共用） */
export function parseProfile(raw: unknown, file: string): Profile {
  const r = ProfileSchema.safeParse(raw ?? undefined);
  if (!r.success) throw new Error(`Invalid ${file}:\n${formatIssues(r.error)}`);
  return r.data;
}
