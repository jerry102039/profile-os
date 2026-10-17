import { describe, expect, it } from 'vitest';
import { fillBrand, type Brand } from '../src/i18n/brand';

const brand: Brand = { os: 'profile-os', user: 'alex', owner: 'Alex Rivera', github: 'github.com/alex-rivera', email: 'a@b.c', city: 'Lisbon', cityEn: 'Lisbon' };

describe('fillBrand', () => {
  it('replaces brand placeholders everywhere in the dictionary', () => {
    expect(fillBrand({ a: '{user}@{os}', b: ['{github}'], c: { d: 'Made in {city}' } }, brand))
      .toEqual({ a: 'alex@profile-os', b: ['github.com/alex-rivera'], c: { d: 'Made in Lisbon' } });
  });
  it('fills the owner name', () => expect(fillBrand('Contact {owner}', brand)).toBe('Contact Alex Rivera'));
  it('leaves {name} for runtime values such as theme names', () => expect(fillBrand('theme: {name}', brand)).toBe('theme: {name}'));
  it('fills the English city name', () => expect(fillBrand('Made in {cityEn}', { ...brand, city: 'Lisboa' })).toBe('Made in Lisbon'));
  it('leaves runtime placeholders alone', () => {
    expect(fillBrand({ n: '{n} items', u: '{user} has {n}' }, brand)).toEqual({ n: '{n} items', u: 'alex has {n}' });
  });
  it('keeps nested arrays of tuples', () => {
    expect(fillBrand({ rows: [['Chip', 'Brain M1 ({city})']] }, brand)).toEqual({ rows: [['Chip', 'Brain M1 (Lisbon)']] });
  });
  it('keeps functions and numbers untouched', () => {
    const f = (n: number) => `${n}`;
    const out = fillBrand({ f, n: 3 }, brand);
    expect(out.f).toBe(f);
    expect(out.n).toBe(3);
  });
});
