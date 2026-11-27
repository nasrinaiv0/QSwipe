import { expect, it } from 'vitest';
import { createTest, ensureWords } from '../src/core/typing';
import { boxingRound, boxingRounds, fightScore, fightWinner, fightWordRandom, recordStrike, type Strike } from '../src/core/typing-fight';

it('uses the same prompts for both fighters, including refills', () => {
  const first = fightWordRandom(42), second = fightWordRandom(42);
  const a = createTest(60_000, first, { punctuation: true });
  const b = createTest(60_000, second, { punctuation: true });
  a.typed = a.words.slice(0, 100);
  b.typed = b.words.slice(0, 130);
  expect(ensureWords(a, first)).toBe(120);
  expect(ensureWords(b, second)).toBe(120);
  expect(a.words).toEqual(b.words);
});

it('applies the game bonuses and reveals points at their replay timestamps', () => {
  const neon: Strike[] = [], street: Strike[] = [];
  recordStrike(neon, 'neon', 500, 'small', 4);
  recordStrike(neon, 'neon', 900, 'garden', 5);
  recordStrike(street, 'street', 700, 'small?', 1);
  recordStrike(street, 'street', 800, 'garden.', 2);
  expect([499, 500, 899, 900].map(at => fightScore(neon, at))).toEqual([0, 1, 1, 4]);
  expect(fightScore(street, 800)).toBe(3);
  expect(fightWinner('street', [street, []], 60_000)).toBe(0);
  expect(fightWinner('neon', [[], []], 60_000)).toBeNull();
});

it('awards a boxing bout by rounds and counts a boundary word in the new round', () => {
  const a: Strike[] = [], b: Strike[] = [];
  for (let at = 0; at < 5; at++) recordStrike(a, 'boxing', at, 'word', 1);
  recordStrike(b, 'boxing', 20_000, 'word', 1);
  recordStrike(b, 'boxing', 40_000, 'word', 1);
  expect(boxingRound(19_999, 60_000)).toBe(1);
  expect(boxingRound(20_000, 60_000)).toBe(2);
  expect(boxingRound(60_000, 60_000)).toBe(3);
  expect(boxingRounds([a, b], 60_000)).toEqual([[5, 0], [0, 1], [0, 1]]);
  expect(fightWinner('boxing', [a, b], 60_000)).toBe(1);
  expect(fightWinner('boxing', [a, b.slice(0, 1)], 60_000)).toBeNull();
});
