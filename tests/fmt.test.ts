import { describe, expect, it } from 'vitest';
import { fmt, plural } from '../src/i18n/fmt';

describe('fmt', () => {
  it('fills placeholders', () => expect(fmt('{n} 個項目', { n: 3 })).toBe('3 個項目'));
  it('fills several placeholders', () => expect(fmt('Wrote {n} lines to {file}', { n: 2, file: 'a.txt' })).toBe('Wrote 2 lines to a.txt'));
  it('leaves unknown placeholders as they are', () => expect(fmt('{a}{b}', { a: 1 })).toBe('1{b}'));
  it('maps over string arrays', () => expect(fmt(['ssh: {host}', 'bye'], { host: 'x' })).toEqual(['ssh: x', 'bye']));
});

describe('plural', () => {
  it('picks one in English', () => expect(plural({ one: '{n} item', other: '{n} items' }, 1, 'en')).toBe('1 item'));
  it('picks other in English', () => expect(plural({ one: '{n} item', other: '{n} items' }, 2, 'en')).toBe('2 items'));
  it('picks many in Russian', () => {
    const p = { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' };
    expect(plural(p, 5, 'ru')).toBe('5 файлов');
    expect(plural(p, 3, 'ru')).toBe('3 файла');
    expect(plural(p, 21, 'ru')).toBe('21 файл');
  });
  it('falls back to other when the category is missing', () => expect(plural({ other: '{n} 個項目' }, 1, 'zh-TW')).toBe('1 個項目'));
});
