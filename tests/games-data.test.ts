import { describe, expect, it } from 'vitest';
import { buildRound, mathQuestion, parseEntries, raceFinishTimes, raceProgress, rollIndex, sanitizeQuestion, shuffled, sliceAtPointer, triviaCategories, wheelTarget } from '../src/core/games';
import { parseBackup, sanitizeAppData, sanitizeSettings, DEFAULT_SETTINGS, swipeThreshold } from '../src/core/data';
import { createWorkspace, newPerson } from '../src/core/model';
import type { TriviaQuestion } from '../src/core/types';

describe('games', () => {
  it('parses entries: trims, dedupes, caps', () => {
    expect(parseEntries(' Alex\nJamie \n alex \n\nPlan A')).toEqual(['Alex', 'Jamie', 'Plan A']);
    expect(parseEntries(Array.from({ length: 50 }, (_, i) => `e${i}`).join('\n'))).toHaveLength(24);
    expect(parseEntries(42)).toEqual([]);
  });
  it('draws are bounded and shuffles are permutations', () => {
    for (let n = 1; n < 25; n++) for (let i = 0; i < 40; i++) expect(rollIndex(n)).toBeLessThan(n);
    expect(() => rollIndex(0)).toThrow();
    expect(shuffled(['a', 'b', 'c', 'd']).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('the wheel always stops on the drawn slice', () => {
    for (let n = 2; n <= 24; n++) {
      let rot = 0;
      for (let s = 0; s < n; s++) for (const offset of [-0.38, 0, 0.38]) {
        rot = wheelTarget(rot, s, n, { offset });
        expect(sliceAtPointer(rot, n)).toBe(s);
      }
    }
  });
  it('the drawn duck always wins', () => {
    for (let w = 0; w < 6; w++) {
      const t = raceFinishTimes(6, w);
      expect(t.indexOf(Math.min(...t))).toBe(w);
    }
    expect(raceProgress(0, 1000, 1.2, 0.1)).toBe(0);
    expect(raceProgress(1000, 1000, 0.8, 0.1)).toBe(1);
  });
  it('math questions have four distinct options and a correct answer', () => {
    for (let s = 0; s < 300; s++) {
      const q = mathQuestion(s * 7919);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it('rounds use only the team bank and generated math', () => {
    const bank = [0, 1, 2].map(i => sanitizeQuestion({ category: i ? 'Ops' : 'Safety', question: `Question number ${i}?`, options: ['a', 'b', 'c', `d${i}`], answer: i }) as TriviaQuestion);
    expect(triviaCategories(bank)).toEqual(['Ops', 'Safety']);
    const ops = buildRound(bank, 'Ops', 10);
    expect(ops).toHaveLength(2);
    for (const q of ops) expect(q.options[q.answer]).toBe(bank.find(b => b.question === q.question)!.options[bank.find(b => b.question === q.question)!.answer]);
    expect(buildRound([], 'Math', 5).every(q => q.category === 'Math')).toBe(true);
    const mixed = buildRound(bank, 'Mixed', 6);
    expect(mixed).toHaveLength(6);
    expect(buildRound([], 'Mixed', 5)).toHaveLength(5);
  });
  it('rejects malformed questions', () => {
    expect(sanitizeQuestion({ question: 'Hi?', options: ['a', 'a', 'b', 'c'], answer: 0 })).toBeNull();
    expect(sanitizeQuestion({ question: 'Hi?', options: ['a', 'b', 'c'], answer: 0 })).toBeNull();
    expect(sanitizeQuestion({ question: 'Hi?', options: ['a', 'b', 'c', 'd'], answer: 4 })).toBeNull();
    expect(sanitizeQuestion({ question: 'Hi?', options: ['a', 'b', 'c', 'd'], answer: '2' })?.answer).toBe(2);
  });
});

describe('storage and backups', () => {
  it('settings accept only listed values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.density).toBe('compact');
    const s = sanitizeSettings({ theme: 'dark', accent: 'neon', undoSeconds: 30, sound: 'yes' });
    expect(s).toMatchObject({ theme: 'dark', accent: 'green', undoSeconds: 30, sound: false });
    expect(swipeThreshold('quick')).toBeLessThan(swipeThreshold('gentle'));
  });
  it('sanitises workspaces: drops unknown ids, repairs the tree, filters records', () => {
    const ws = createWorkspace({ name: 'Acme', preset: 'business', ownerName: 'Olive Owner', ownerLevel: 3 });
    const m = newPerson({ name: 'Mo Member', level: 0, parentId: ws.ownerId });
    const bad = { ...newPerson({ name: 'Upside Down', level: 2, parentId: m.id }) };
    const raw = {
      v: 3, activeId: 'nope', settings: { theme: 'dark' },
      workspaces: {
        [ws.id]: {
          ...ws, people: [...ws.people, m, bad, { id: 'x', name: 'bad id', level: 0 }, { ...m }],
          attendance: { '2026-11-23': { [m.id]: { s: 'present', at: 1 }, ghost123: 'present' }, 'not-a-date': {} },
          announcements: [{ id: 'a1', authorId: ws.ownerId, scopeId: 'ghost', text: ' Hello ', at: 1 }, { authorId: 'ghost', text: 'x' }],
          invites: [{ id: 'inv1234567', token: 't'.repeat(22), parentId: ws.ownerId, level: 0, createdAt: 1, expiresAt: 2, maxUses: 9999, uses: 0 }],
        },
        junk: { id: '!' },
      },
    };
    const data = sanitizeAppData(raw);
    const clean = data.workspaces[ws.id]!;
    expect(data.activeId).toBe(ws.id);
    expect(clean.people.map(p => p.name)).toEqual(['Olive Owner', 'Mo Member', 'Upside Down']);
    expect(clean.people.find(p => p.name === 'Upside Down')!.parentId).toBeNull();
    expect(Object.keys(clean.attendance)).toEqual(['2026-11-23']);
    expect(Object.keys(clean.attendance['2026-11-23']!)).toEqual([m.id]);
    expect(clean.announcements).toHaveLength(1);
    expect(clean.announcements[0]!.scopeId).toBe('all');
    expect(clean.invites[0]!.maxUses).toBe(500);
    expect(Object.keys(data.workspaces)).toHaveLength(1);
  });
  it('backup parsing checks the envelope', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a QSwipe backup/);
    expect(parseBackup('{"app":"qswipe","v":3,"workspaces":{}}').activeId).toBeNull();
  });
});
