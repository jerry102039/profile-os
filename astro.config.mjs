// @ts-check
import { defineConfig } from 'astro/config';
import { join } from 'node:path';
import { resolveProfileDir, readProfile, localePath, withDotEnv } from './src/profile/load.mjs';
import { parseProfile } from './src/profile/schema.ts';
import profilePublic from './src/profile/integration.mjs';

// 個人內容都在 profile 資料夾（PROFILE_DIR → profile/ → profile.example/）。
// PROFILE_DIR、SITE_URL 也可以寫在 .env（Astro 不會幫 config 讀 .env，所以 withDotEnv 自己讀）。
const env = withDotEnv();
if (env.PROFILE_DIR) process.env.PROFILE_DIR = env.PROFILE_DIR;
const profileDir = resolveProfileDir(env);
// 先驗證再用：YAML 寫錯時直接列出是哪個欄位，而不是在下面某行崩潰
const profile = parseProfile(readProfile(profileDir), join(profileDir, 'profile.yaml'));
console.log(`[profile] ${profileDir}`);

export default defineConfig({
  // 正式網域：canonical、hreflang、sitemap、分享預覽圖都靠它。
  // 預設讀 profile.yaml 的 site.url；在 Cloudflare 的環境變數（或 .env）設定 SITE_URL 可以蓋過。
  site: env.SITE_URL || profile.site.url,
  build: { inlineStylesheets: 'always' },
  compressHTML: true,
  // Astro 內建 i18n：語言清單與預設語言來自 profile.yaml。預設語言掛在根目錄（/），其他語言在 /<代碼>/。
  // 網址用小寫代碼（pt-BR → /pt-br/），codes 保留正式的 BCP 47 代碼。
  i18n: {
    locales: profile.site.locales.map((/** @type {string} */ l) => ({ path: localePath(l), codes: [l] })),
    defaultLocale: localePath(/** @type {string} */ (profile.site.defaultLocale)),
    routing: { prefixDefaultLocale: false },
  },
  integrations: [profilePublic(profileDir)],
});
