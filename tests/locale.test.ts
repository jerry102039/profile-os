import { describe, expect, it } from 'vitest';
import { contentLocale, localePath, matchLocale, localeUrl } from '../src/i18n/locale';

describe('localePath', () => {
  it('lowercases the code', () => expect(localePath('pt-BR')).toBe('pt-br'));
  it('keeps simple codes', () => expect(localePath('ja')).toBe('ja'));
});

describe('localeUrl', () => {
  it('puts the default locale at the root', () => expect(localeUrl('zh-Hant', '/projects/x', 'zh-Hant')).toBe('/projects/x'));
  it('prefixes other locales', () => expect(localeUrl('pt-BR', '/projects/x', 'zh-Hant')).toBe('/pt-br/projects/x'));
  it('keeps the trailing slash of the home page', () => expect(localeUrl('en', '/', 'zh-Hant')).toBe('/en/'));
  it('keeps index trailing slashes', () => expect(localeUrl('ja', '/notes/', 'en')).toBe('/ja/notes/'));
});

describe('contentLocale', () => {
  it('uses the locale itself when content exists', () => expect(contentLocale(['zh-Hant', 'en'], 'zh-Hant', 'zh-Hant')).toBe('zh-Hant'));
  it('falls back to English', () => expect(contentLocale(['zh-Hant', 'en'], 'ja', 'zh-Hant')).toBe('en'));
  it('then to the default locale', () => expect(contentLocale(['zh-Hant'], 'ja', 'zh-Hant')).toBe('zh-Hant'));
  it('then to whatever exists', () => expect(contentLocale(['ko'], 'ja', 'en')).toBe('ko'));
});

describe('matchLocale', () => {
  const all = ['zh-Hant', 'en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR', 'de', 'fr', 'ru'] as const;
  it('maps Taiwan and Hong Kong Chinese to Traditional', () => {
    expect(matchLocale(['zh-TW'], [...all])).toBe('zh-Hant');
    expect(matchLocale(['zh-HK'], [...all])).toBe('zh-Hant');
  });
  it('maps mainland Chinese to Simplified', () => {
    expect(matchLocale(['zh-CN'], [...all])).toBe('zh-Hans');
    expect(matchLocale(['zh'], [...all])).toBe('zh-Hans');
  });
  it('maps any Portuguese to pt-BR', () => expect(matchLocale(['pt-PT'], [...all])).toBe('pt-BR'));
  it('matches on the base language', () => expect(matchLocale(['de-AT', 'en'], [...all])).toBe('de'));
  it('takes the first preference that is enabled', () => expect(matchLocale(['it', 'fr-CA'], [...all])).toBe('fr'));
  it('returns null when nothing matches', () => expect(matchLocale(['it', 'nl'], ['en', 'zh-Hant'])).toBeNull());
  it('respects which locales are enabled', () => expect(matchLocale(['zh-CN'], ['en', 'zh-Hant'])).toBeNull());
});
