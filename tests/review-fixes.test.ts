// 最終審查找到的問題：每個都先有會失敗的測試
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveProfileDir, withDotEnv } from '../src/profile/load.mjs';
import { parseProfile, FeaturesSchema } from '../src/profile/schema';
import { flatFeatures, enabledApps, entryOn } from '../src/apps/registry';
import { publicUrl } from '../src/profile/localize';

const minimal = () => parse(readFileSync(new URL('./fixtures/minimal/profile.yaml', import.meta.url), 'utf8'));

describe('parseProfile (used by astro.config and the site)', () => {
  it('names the missing field instead of crashing', () => {
    const p = minimal();
    delete p.site.locales;
    expect(() => parseProfile(p, 'x/profile.yaml')).toThrow(/site\.locales/);
  });
  it('rejects an empty file with a readable message', () => expect(() => parseProfile(null, 'x/profile.yaml')).toThrow(/x\/profile\.yaml/));
  it('rejects unknown feature switches (typos)', () => {
    const p = minimal();
    p.features = { musik: false };
    expect(() => parseProfile(p, 'p.yaml')).toThrow(/features/);
  });
});

describe('.env support', () => {
  it('reads PROFILE_DIR from .env when the shell does not set it', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    writeFileSync(join(root, '.env'), '# comment\nPROFILE_DIR=../mine\nSITE_URL="https://a.b"\n');
    expect(resolveProfileDir(withDotEnv({}, root), root)).toBe(resolve(root, '../mine'));
    expect(withDotEnv({}, root).SITE_URL).toBe('https://a.b');
  });
  it('lets the real environment win over .env', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    writeFileSync(join(root, '.env'), 'PROFILE_DIR=from-file\n');
    expect(withDotEnv({ PROFILE_DIR: 'from-shell' }, root).PROFILE_DIR).toBe('from-shell');
  });
  it('works without a .env file', () => {
    const root = mkdtempSync(join(tmpdir(), 'pos-'));
    mkdirSync(join(root, 'profile'));
    expect(resolveProfileDir(withDotEnv({}, root), root)).toBe(join(root, 'profile'));
  });
});

describe('effective CTF switch', () => {
  it('is off when profile.yaml has no ctf section', () => expect(flatFeatures(FeaturesSchema.parse({}), false).ctf).toBe(false));
  it('stays on when the section exists', () => expect(flatFeatures(FeaturesSchema.parse({}), true).ctf).toBe(true));
});

describe('entry points that depend on other apps', () => {
  const noFinder = flatFeatures(FeaturesSchema.parse({ finder: false }), true);
  const onNoFinder = enabledApps(noFinder);
  it('hides the Trash, New Folder and Games entries without the file manager', () => {
    expect(entryOn('open-trash', noFinder, onNoFinder)).toBe(false);
    expect(entryOn('new-folder', noFinder, onNoFinder)).toBe(false);
    expect(entryOn('games-icon', noFinder, onNoFinder)).toBe(false);
  });
  it('keeps them with the file manager', () => {
    const f = flatFeatures(FeaturesSchema.parse({}), true);
    expect(entryOn('open-trash', f, enabledApps(f))).toBe(true);
    expect(entryOn('games-icon', f, enabledApps(f))).toBe(true);
  });
  it('hides the Games icon when every game is off', () => {
    const f = flatFeatures(FeaturesSchema.parse({ games: { snake: false, dino: false, mines: false, g2048: false } }), true);
    expect(entryOn('games-icon', f, enabledApps(f))).toBe(false);
  });
});

describe('publicUrl', () => {
  it('adds the leading slash', () => expect(publicUrl('resume.pdf')).toBe('/resume.pdf'));
  it('does not double it', () => expect(publicUrl('/resume.pdf')).toBe('/resume.pdf'));
});
