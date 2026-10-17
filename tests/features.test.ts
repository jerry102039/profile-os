import { describe, expect, it } from 'vitest';
import { FeaturesSchema } from '../src/profile/schema';
import { flatFeatures, enabledApps, resolveStartup, commandOn } from '../src/apps/registry';

const features = (patch: Record<string, unknown> = {}) => FeaturesSchema.parse(patch);

describe('enabledApps', () => {
  it('turns everything on by default', () => {
    const on = enabledApps(flatFeatures(features()));
    for (const id of ['finder', 'projects', 'project', 'certs', 'pdf', 'snake', 'g2048', 'resume', 'contact']) expect(on.has(id)).toBe(true);
  });
  it('drops every game when all games are off', () => {
    const on = enabledApps(flatFeatures(features({ games: { snake: false, dino: false, mines: false, g2048: false } })));
    for (const id of ['snake', 'dino', 'mines', 'g2048']) expect(on.has(id)).toBe(false);
  });
  it('drops the project detail window together with projects', () => {
    const on = enabledApps(flatFeatures(features({ projects: false })));
    expect(on.has('projects')).toBe(false);
    expect(on.has('project')).toBe(false);
  });
  it('keeps the core windows even if everything is off', () => {
    const all = Object.fromEntries(['finder', 'projects', 'notes', 'skills', 'status', 'taskmgr', 'music', 'calculator', 'calendar', 'contact', 'resume', 'certs', 'editor', 'appearance'].map((k) => [k, false]));
    const on = enabledApps(flatFeatures(features(all)));
    for (const id of ['about', 'sysinfo', 'viewer']) expect(on.has(id)).toBe(true);
  });
});

describe('resolveStartup', () => {
  const on = new Set(['about', 'resume', 'projects']);
  it('keeps enabled windows in order', () => expect(resolveStartup(['about', 'resume'], on)).toEqual(['about', 'resume']));
  it('drops disabled windows', () => expect(resolveStartup(['resume', 'music', 'about'], on)).toEqual(['resume', 'about']));
  it('falls back to the terminal when nothing is left', () => expect(resolveStartup(['music'], new Set(['about']))).toEqual(['about']));
});

describe('commandOn', () => {
  const f = flatFeatures(features({ contact: false, ctf: false, easterEggs: false, games: { snake: false } }));
  const on = enabledApps(f);
  it('hides ssh when contact is off', () => expect(commandOn('ssh', f, on)).toBe(false));
  it('hides the CTF commands', () => { expect(commandOn('unlock', f, on)).toBe(false); expect(commandOn('hint', f, on)).toBe(false); });
  it('hides easter eggs', () => { expect(commandOn('sl', f, on)).toBe(false); expect(commandOn('cowsay', f, on)).toBe(false); });
  it('hides a disabled game but keeps the others', () => { expect(commandOn('snake', f, on)).toBe(false); expect(commandOn('dino', f, on)).toBe(true); });
  it('keeps plain commands', () => { expect(commandOn('ls', f, on)).toBe(true); expect(commandOn('neofetch', f, on)).toBe(true); });
});
