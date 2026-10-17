import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { resolveProfileDir } from '../src/profile/load.mjs';
import { loc } from '../src/profile/localize';
import { ProfileSchema, formatIssues } from '../src/profile/schema';

const minimal = () => parse(readFileSync(new URL('./fixtures/minimal/profile.yaml', import.meta.url), 'utf8'));

describe('resolveProfileDir', () => {
  it('uses PROFILE_DIR relative to the project root', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    expect(resolveProfileDir({ PROFILE_DIR: 'x' }, root)).toBe(resolve(root, 'x'));
  });
  it('prefers profile/ when it exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    mkdirSync(join(root, 'profile'));
    mkdirSync(join(root, 'profile.example'));
    expect(resolveProfileDir({}, root)).toBe(join(root, 'profile'));
  });
  it('falls back to profile.example/', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    expect(resolveProfileDir({}, root)).toBe(join(root, 'profile.example'));
  });
});

describe('loc', () => {
  it('returns plain values as-is', () => expect(loc('a', 'ja', 'zh-Hant')).toBe('a'));
  it('falls back to en', () => expect(loc({ 'zh-Hant': '甲', en: 'A' }, 'ja', 'zh-Hant')).toBe('A'));
  it('then to the default locale', () => expect(loc({ 'zh-Hant': '甲' }, 'ja', 'zh-Hant')).toBe('甲'));
  it('then to the first value', () => expect(loc({ ko: '가' }, 'ja', 'en')).toBe('가'));
  it('keeps arrays intact', () => expect(loc({ en: ['a', 'b'] }, 'en', 'en')).toEqual(['a', 'b']));
});

describe('ProfileSchema', () => {
  it('accepts the minimal fixture and fills defaults', () => {
    const r = ProfileSchema.safeParse(minimal());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.projects).toEqual([]);
      expect(r.data.startup).toEqual(['about']);
      expect(r.data.features.games.snake).toBe(true);
    }
  });
  it('rejects an unsupported locale with its field path', () => {
    const p = minimal();
    p.site.locales = ['en', 'xx'];
    const r = ProfileSchema.safeParse(p);
    expect(r.success).toBe(false);
    if (!r.success) expect(formatIssues(r.error)).toContain('site.locales.1');
  });
  it('rejects a default locale that is not enabled', () => {
    const p = minimal();
    p.site.defaultLocale = 'ja';
    const r = ProfileSchema.safeParse(p);
    expect(r.success).toBe(false);
    if (!r.success) expect(formatIssues(r.error)).toContain('site.defaultLocale');
  });
});
