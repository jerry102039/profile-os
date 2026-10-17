// 找 profile 資料夾、讀 profile.yaml（純 Node，astro.config.mjs 也會用）。
// 順序：環境變數 PROFILE_DIR → profile/ → profile.example/
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

/**
 * 環境變數加上 .env 檔（astro.config 讀不到 .env，所以自己讀）；真的環境變數優先。
 * @param {Record<string, string | undefined>} env @param {string} cwd
 */
export function withDotEnv(env = process.env, cwd = process.cwd()) {
  const file = join(cwd, '.env');
  if (!existsSync(file)) return env;
  const out = { ...env };
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (out[m[1]] === undefined && value !== '') out[m[1]] = value;
  }
  return out;
}

/** @param {Record<string, string | undefined>} env @param {string} cwd */
export function resolveProfileDir(env = withDotEnv(), cwd = process.cwd()) {
  if (env.PROFILE_DIR) return resolve(cwd, env.PROFILE_DIR);
  const own = join(cwd, 'profile');
  return existsSync(own) ? own : join(cwd, 'profile.example');
}

/** 只解析 YAML，不驗證（驗證在 src/profile/index.ts） */
export function readProfile(dir = resolveProfileDir()) {
  const file = join(dir, 'profile.yaml');
  if (!existsSync(file)) throw new Error(`profile.yaml not found in ${dir} (set PROFILE_DIR or copy profile.example/ to profile/)`);
  return parse(readFileSync(file, 'utf8'));
}

/** URL 路徑用的語言代碼：pt-BR → pt-br */
export const localePath = (/** @type {string} */ l) => l.toLowerCase();
