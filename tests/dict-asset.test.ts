import { describe, expect, it } from 'vitest';
import { dictAsset } from '../src/i18n/server';

describe('dictAsset', () => {
  it('names the file after the locale and a content hash', () => {
    expect(dictAsset('en').url).toMatch(/^\/i18n\/en\.[0-9a-f]{10}\.json$/);
    expect(dictAsset('pt-BR').url).toMatch(/^\/i18n\/pt-br\.[0-9a-f]{10}\.json$/);
  });
  it('is stable between calls', () => expect(dictAsset('ja').url).toBe(dictAsset('ja').url));
  it('differs between locales', () => expect(dictAsset('ja').url).not.toBe(dictAsset('ko').url));
  it('holds the brand-filled dictionary', () => {
    const d = JSON.parse(dictAsset('en').json);
    expect(d.htmlLang).toBe('en');
    expect(JSON.stringify(d)).not.toMatch(/\{(os|user|owner)\}/);
  });
});
