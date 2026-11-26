import { describe, expect, it } from 'vitest';
import {
  correctChars, createTest, dash, ensureWords, goalChars, input, makeWords, pacerSamples, progress, progressAt, sample, sanitizeTypingBests,
  stats, target, wpmSeries, WORDS,
} from '../src/core/typing';

const seeded = (seed: number) => {
  let x = seed >>> 0 || 1;
  return (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
};
/** Types `text` one character at a time, the way an input field grows. */
const typeAll = (t: ReturnType<typeof createTest>, text: string) => { let v = t.current; for (const ch of text) { v += ch; input(t, v); if (ch === ' ') v = ''; } };

describe('typing words', () => {
  it('builds text from the word list, never the same word twice in a row', () => {
    const w = makeWords(300, seeded(4));
    expect(w).toHaveLength(300);
    expect(w.every(x => WORDS.includes(x))).toBe(true);
    expect(w.some((x, i) => i > 0 && x === w[i - 1])).toBe(false);
  });
  it('adds capitals and punctuation when asked', () => {
    const w = makeWords(200, seeded(9), { punctuation: true });
    expect(w[0]![0]).toBe(w[0]![0]!.toUpperCase());
    expect(w.some(x => /[.,?]$/.test(x))).toBe(true);
  });
});

describe('typing engine', () => {
  it('scores characters, words, combo and accuracy', () => {
    const t = createTest(60000, seeded(1));
    const [a, b, c] = t.words;
    typeAll(t, `${a} ${b} `);
    expect(t.typed).toEqual([a, b]);
    expect(t.combo).toBe(2);
    expect(correctChars(t)).toBe(a!.length + b!.length + 2);
    typeAll(t, `x${c!.slice(1)} `);
    expect(t.combo).toBe(0);
    expect(t.bestCombo).toBe(2);
    const s = stats(t, 60000);
    expect(s.correctWords).toBe(2);
    expect(s.wrongWords).toBe(1);
    expect(s.errors).toBe(c![0] === 'x' ? 0 : 1);
    expect(s.wpm).toBe(Math.round((a!.length + b!.length + 2) / 5));
    expect(s.accuracy).toBeLessThan(100);
  });
  it('handles backspace, extra letters and a leading space', () => {
    const t = createTest(60000, seeded(2));
    const w = target(t);
    expect(input(t, ' ')).toEqual([]);
    input(t, `${w}zz`);
    expect(t.current).toBe(`${w}zz`);
    const back = input(t, w);
    expect(back.map(e => e.type)).toEqual(['back', 'back']);
    expect(input(t, `${w} `).at(-1)).toMatchObject({ type: 'word', ok: true });
  });
  it('race progress counts correctly placed letters even in a word with a typo', () => {
    const t = createTest(60000, seeded(3));
    const w = target(t);
    typeAll(t, `${w.slice(0, -1)}# `);
    expect(progress(t)).toBe(w.length - 1);
    expect(correctChars(t)).toBe(0);
  });
  it('dash skips one word per test and only moves the racer', () => {
    const t = createTest(60000, seeded(5));
    const len = target(t).length;
    expect(dash(t)).toMatchObject({ type: 'dash', chars: len + 1 });
    expect(dash(t)).toBeNull();
    expect(progress(t)).toBe(len + 1);
    expect(stats(t, 60000).wpm).toBe(0);
  });
  it('keeps words coming and samples progress every second', () => {
    const t = createTest(60000, seeded(6));
    t.typed = t.words.slice(0, 110);
    expect(ensureWords(t, seeded(6))).toBe(120);
    const u = createTest(60000, seeded(7));
    typeAll(u, `${u.words[0]} `);
    sample(u, 3200);
    expect(u.samples).toHaveLength(4);
    expect(u.samples[3]).toBe(progress(u));
  });
});

describe('timelines and records', () => {
  it('interpolates, computes WPM windows and builds pacers', () => {
    expect(progressAt([0, 10, 30], 1500)).toBe(20);
    expect(progressAt([0, 10, 30], 9000)).toBe(30);
    expect(wpmSeries([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], 5)).toEqual([60, 60]);
    const p = pacerSamples(60, 60, seeded(8));
    expect(p).toHaveLength(61);
    expect(p.every((x, i) => i === 0 || x >= p[i - 1]!)).toBe(true);
    expect(p[60]! / 5).toBeGreaterThan(40);
    expect(p[60]! / 5).toBeLessThan(70);
    expect(goalChars(60000)).toBe(500);
  });
  it('accepts only valid personal bests', () => {
    const ok = { wpm: 72, accuracy: 96, samples: [0, 5, 11], at: 1 };
    expect(sanitizeTypingBests({ 60: ok })).toEqual({ 60: ok });
    expect(sanitizeTypingBests({ 60: { ...ok, wpm: 999 } })).toEqual({});
    expect(sanitizeTypingBests({ 60: { ...ok, samples: [0, 9, 3] } })).toEqual({});
    expect(sanitizeTypingBests({ 45: ok })).toEqual({});
    expect(sanitizeTypingBests('nope')).toEqual({});
  });
});
