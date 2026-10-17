import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveProfileDir } from './profile/load.mjs';

// 筆記放在 profile 資料夾的 notes/<語言>/*.md，例如 notes/zh-Hant/hello.md、notes/en/hello.md
// 檔名就是網址：zh-Hant/hello.md → /notes/hello（預設語言）、en/hello.md → /en/notes/hello
const notes = defineCollection({
  // 底線開頭的檔案（例如 _template.md）不會被收錄
  loader: glob({ pattern: '**/[^_]*.md', base: pathToFileURL(join(resolveProfileDir(), 'notes') + '/') }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    /** true 時只在 npm run dev 看得到，不會被 build 出去 */
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes };
