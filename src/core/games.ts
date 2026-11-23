/** Game logic: fair draws, wheel geometry, race timing and trivia rounds. */
import { cleanText, uid } from './model';
import type { TriviaQuestion } from './types';

export function parseEntries(value: unknown, max = 24): string[] {
  if (typeof value !== 'string') return [];
  const seen = new Set<string>();
  return value.split(/\r?\n/).map(x => x.trim()).filter(x => {
    const key = x.toLocaleLowerCase();
    if (!x || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max).map(x => x.slice(0, 60));
}

/** Unbiased random index in [0, limit) via rejection sampling over crypto bytes. */
export function rollIndex(limit: number, bytes?: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid draw size');
  if (bytes === undefined) {
    const maximum = 0x100000000 - (0x100000000 % limit);
    const sample = new Uint32Array(1);
    do { crypto.getRandomValues(sample); bytes = sample[0]!; } while (bytes >= maximum);
  }
  return bytes % limit;
}

export function shuffled<T>(items: readonly T[], rand: (n: number) => number = rollIndex): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool;
}

/** Clockwise rotation (deg) that stops slice `selected` under the top pointer; `offset` ∈ [-0.4, 0.4] varies the stop point. */
export function wheelTarget(current: number, selected: number, n: number, { turns = 6, offset = 0 } = {}): number {
  const deg = 360 / n;
  const landing = (((360 - (selected + 0.5 + offset) * deg) % 360) + 360) % 360;
  return Math.ceil(current / 360) * 360 + 360 * turns + landing;
}

export function sliceAtPointer(rotation: number, n: number): number {
  const angle = (((-rotation) % 360) + 360) % 360;
  return Math.floor(angle / (360 / n)) % n;
}

/** Finish times (ms); the pre-drawn winner is always strictly fastest. */
export function raceFinishTimes(n: number, winner: number, rand: () => number = Math.random, base = 4600): number[] {
  return Array.from({ length: n }, (_, i) => (i === winner ? base : Math.round(base * (1.03 + rand() * 0.2))));
}

/** Progress 0–1 at time t. Different curve shapes make the lead change mid-race. */
export function raceProgress(t: number, finish: number, shape = 1, wobble = 0): number {
  const x = Math.max(0, Math.min(1, t / finish));
  return Math.max(0, Math.min(1, x ** shape + wobble * Math.sin(x * Math.PI * 3) * x * (1 - x)));
}

/* ------------------------------------------------------------------ */
/* Trivia                                                              */
/* ------------------------------------------------------------------ */

export interface RoundQuestion { category: string; question: string; options: string[]; answer: number }

/** Procedurally generated arithmetic: no stored content. */
export function mathQuestion(seed: number): RoundQuestion {
  const a = 1 + (seed % 1000), b = 1 + (Math.floor(seed / 1000) % 1000);
  const op = Math.floor(seed / 1_000_000) % 4;
  const [question, answer] = op === 0 ? [`What is ${a} + ${b}?`, a + b]
    : op === 1 ? [`What is ${a} − ${b}?`, a - b]
      : op === 2 ? [`What is ${a} × ${b}?`, a * b]
        : [`What is ${a * b} ÷ ${b}?`, a];
  const choices = [answer, answer + 1, answer - 2, answer + 3];
  const k = seed % 4;
  const shifted = [...choices.slice(k), ...choices.slice(0, k)];
  return { category: 'Math', question, options: shifted.map(n => n.toLocaleString('en-US')), answer: shifted.indexOf(answer) };
}

export function sanitizeQuestion(input: unknown): TriviaQuestion | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const question = cleanText(o.question, 200);
  const options = Array.isArray(o.options) ? o.options.map(x => cleanText(x, 80)) : [];
  const answer = Number(o.answer);
  if (question.length < 3 || options.length !== 4 || options.some(x => !x)) return null;
  if (new Set(options.map(x => x.toLowerCase())).size !== 4) return null;
  if (![0, 1, 2, 3].includes(answer)) return null;
  return {
    id: typeof o.id === 'string' && /^[\w-]{4,24}$/.test(o.id) ? o.id : uid(),
    category: cleanText(o.category, 30) || 'General',
    question, options: options as TriviaQuestion['options'], answer: answer as TriviaQuestion['answer'],
  };
}

export const triviaCategories = (bank: TriviaQuestion[]) => [...new Set(bank.map(q => q.category))].sort();

/**
 * Builds a round from the team's own question bank and/or generated math.
 * category: 'Mixed' (bank + math), 'Math', or a bank category.
 */
export function buildRound(bank: TriviaQuestion[], category: string, length: number, rand: (n: number) => number = rollIndex): RoundQuestion[] {
  const pool = category === 'Mixed' ? bank : bank.filter(q => q.category === category);
  const fromBank: RoundQuestion[] = category === 'Math' ? [] : shuffled(pool, rand).map(q => {
    // Shuffle options so repeated rounds don't keep the answer in one slot.
    const order = shuffled([0, 1, 2, 3], rand);
    return { category: q.category, question: q.question, options: order.map(i => q.options[i]!), answer: order.indexOf(q.answer) };
  });
  const wantMath = category === 'Math' ? length : category === 'Mixed' ? Math.max(0, length - Math.min(fromBank.length, Math.ceil(length * 0.7))) : 0;
  const maths: RoundQuestion[] = [];
  const seen = new Set<string>();
  for (let n = 0; maths.length < wantMath && n < 200; n++) {
    const q = mathQuestion(rand(4_000_000));
    if (!seen.has(q.question)) { seen.add(q.question); maths.push(q); }
  }
  const take = Math.min(fromBank.length, length - maths.length);
  return shuffled([...fromBank.slice(0, take), ...maths], rand);
}
