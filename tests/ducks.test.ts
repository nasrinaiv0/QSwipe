import { describe, expect, it } from 'vitest';
import { defaultLook, duckKey, DUCK_COLORS, DUCK_HATS, LOOK_SLOTS, MAX_SAVED_LOOKS, raceLooks, randomLook, sanitizeDucks, sanitizeLook } from '../src/core/ducks';
import { sanitizeAppData } from '../src/core/data';
import { rollIndex } from '../src/core/games';
import { createWorkspace } from '../src/core/model';

describe('duck looks', () => {
  it('defaults are deterministic, case-insensitive and costume-free', () => {
    expect(defaultLook('Ava Lim')).toEqual(defaultLook('  ava lim '));
    expect(defaultLook('Ava Lim')).toMatchObject({ hat: 'none', eyes: 'none', neck: 'none' });
    expect(DUCK_COLORS).toContain(defaultLook('Anyone').color);
    expect(duckKey('  MiXeD Case ')).toBe('mixed case');
  });

  it('gives every unsaved racer a different colour while colours last, and keeps saved looks', () => {
    const names = Array.from({ length: 10 }, (_, i) => `Racer ${i}`);
    const looks = raceLooks(names, {});
    expect(new Set(looks.map(l => l.color)).size).toBe(10);
    const saved = { 'racer 3': { color: 'gold', hat: 'crown', eyes: 'none', neck: 'medal' } as const };
    const withSaved = raceLooks(names, saved);
    expect(withSaved[3]).toEqual(saved['racer 3']);
    expect(withSaved.filter(l => l.color === 'gold')).toHaveLength(1);
    expect(raceLooks([...names, 'Extra 1', 'Extra 2'], {})).toHaveLength(12);
  });

  it('validates looks and saved maps', () => {
    expect(sanitizeLook({ color: 'neon' })).toBeNull();
    expect(sanitizeLook({ color: 'mint', hat: 'sombrero', eyes: 'shades' })).toEqual({ color: 'mint', hat: 'none', eyes: 'shades', neck: 'none' });
    const many = Object.fromEntries(Array.from({ length: MAX_SAVED_LOOKS + 50 }, (_, i) => [`P${i}`, { color: 'sky' }]));
    const clean = sanitizeDucks({ ...many, bad: { color: 'x' } });
    expect(Object.keys(clean)).toHaveLength(MAX_SAVED_LOOKS);
    expect(Object.keys(clean)[0]).toBe('p0');
    expect(sanitizeDucks(['nope'])).toEqual({});
  });

  it('random outfits always use valid parts', () => {
    for (let i = 0; i < 200; i++) {
      const l = randomLook(rollIndex);
      for (const [slot, values] of Object.entries(LOOK_SLOTS)) expect(values as readonly string[]).toContain(l[slot as keyof typeof l]);
    }
    const always = randomLook(n => n - 1);
    expect(always.hat).toBe(DUCK_HATS[DUCK_HATS.length - 1]);
  });

  it('looks persist through storage sanitising', () => {
    const ws = createWorkspace({ name: 'Pond Club', preset: 'custom', ownerName: 'Quinn Duck', ownerLevel: 3 });
    expect(ws.ducks).toEqual({});
    ws.ducks = { 'quinn duck': { color: 'grape', hat: 'wizard', eyes: 'stars', neck: 'lei' } };
    const data = sanitizeAppData({ workspaces: { [ws.id]: { ...ws, ducks: { ...ws.ducks, ghost: { color: '<b>' } } } } });
    expect(data.workspaces[ws.id]!.ducks).toEqual({ 'quinn duck': { color: 'grape', hat: 'wizard', eyes: 'stars', neck: 'lei' } });
  });
});
