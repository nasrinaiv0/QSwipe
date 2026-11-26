/**
 * Typing race engine: word generation, keystroke processing, WPM/accuracy, combos and per-second progress timelines
 * (used for live racing, ghosts of earlier players and replays). Pure logic with no DOM access.
 *
 * Scoring follows the common convention: WPM counts characters of correctly typed words plus the space after each,
 * divided by five per minute; raw WPM counts every typed character; accuracy is correct keystrokes ÷ all keystrokes.
 */
import { rollIndex } from './games';

/** Common English words (a standard high-frequency list) used to build practice text. */
export const WORDS = (
  'the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will ' +
  'there say who make when can more if no man out other so what time up go about than into could state only new year some take ' +
  'come these know see use get like then first any work now may such give over think most even find day also after way many must ' +
  'look before great back through long where much should well people down own just because good each those feel seem how high too ' +
  'place little world very still nation hand old life tell write become here show house both between need mean call develop under ' +
  'last right move thing general school never same another begin while number part turn real leave might want point form off child ' +
  'few small since against ask late home interest large person end open public follow during present without again hold around ' +
  'possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase ' +
  'early course change help line team light water story near city learn green river music quick bright smile happy garden window'
).split(' ');

export const DURATIONS = [60, 180, 300, 600] as const;
export type Duration = (typeof DURATIONS)[number];

export function makeWords(count: number, rand: (n: number) => number = rollIndex, o: { punctuation?: boolean } = {}): string[] {
  const out: string[] = [];
  let capital = true;
  for (let i = 0; i < count; i++) {
    let w = WORDS[rand(WORDS.length)]!;
    if (out.length && w === out[out.length - 1]) w = WORDS[(WORDS.indexOf(w) + 1) % WORDS.length]!;
    if (o.punctuation) {
      if (capital) { w = w[0]!.toUpperCase() + w.slice(1); capital = false; }
      const r = rand(100);
      if (i > 2 && r < 9) { w += '.'; capital = true; } else if (i > 1 && r < 17) w += ','; else if (r < 19) { w += '?'; capital = true; }
    }
    out.push(w);
  }
  return out;
}

export interface TypingTest {
  words: string[];
  /** Committed words; null marks a word skipped with the one-time dash. */
  typed: (string | null)[];
  current: string;
  durationMs: number;
  keystrokes: number;
  correctKeys: number;
  combo: number;
  bestCombo: number;
  dashUsed: boolean;
  dashChars: number;
  /** Race progress (correct characters, spaces and dashed words) sampled at every whole second; samples[0] is 0. */
  samples: number[];
  punctuation: boolean;
}

export type TypeEvent =
  | { type: 'char'; index: number; ok: boolean; extra: boolean }
  | { type: 'back'; index: number }
  | { type: 'word'; ok: boolean; combo: number }
  | { type: 'dash'; chars: number }
  | { type: 'reset' };

export function createTest(durationMs: number, rand: (n: number) => number = rollIndex, o: { punctuation?: boolean } = {}): TypingTest {
  return {
    words: makeWords(160, rand, o), typed: [], current: '', durationMs, keystrokes: 0, correctKeys: 0, combo: 0, bestCombo: 0,
    dashUsed: false, dashChars: 0, samples: [0], punctuation: !!o.punctuation,
  };
}

export const target = (t: TypingTest) => t.words[t.typed.length] ?? '';

/** Keeps enough words ahead of the typist; returns the number appended. */
export function ensureWords(t: TypingTest, rand: (n: number) => number = rollIndex): number {
  if (t.words.length - t.typed.length > 60) return 0;
  const more = makeWords(120, rand, { punctuation: t.punctuation });
  t.words.push(...more);
  return more.length;
}

function commit(t: TypingTest): TypeEvent {
  const word = target(t), ok = t.current === word;
  t.typed.push(t.current);
  t.current = '';
  t.combo = ok ? t.combo + 1 : 0;
  t.bestCombo = Math.max(t.bestCombo, t.combo);
  return { type: 'word', ok, combo: t.combo };
}

/**
 * Applies the new value of the input field for the current word. Typed characters are scored as keystrokes;
 * a space commits the word (a leading space is ignored); a shorter value is a backspace.
 */
export function input(t: TypingTest, value: string): TypeEvent[] {
  const events: TypeEvent[] = [];
  if (value === t.current) return events;
  if (value.startsWith(t.current)) {
    for (const ch of value.slice(t.current.length)) {
      if (ch === ' ' || ch === '\n') {
        if (t.current) events.push(commit(t));
        continue;
      }
      const word = target(t), i = t.current.length, ok = word[i] === ch;
      t.keystrokes++;
      if (ok) t.correctKeys++;
      t.current += ch;
      events.push({ type: 'char', index: i, ok, extra: i >= word.length });
    }
    return events;
  }
  if (t.current.startsWith(value)) {
    for (let i = t.current.length - 1; i >= value.length; i--) events.push({ type: 'back', index: i });
    t.current = value;
    return events;
  }
  // Anything else (autocorrect, paste) replaces the word without counting keystrokes.
  t.current = value.replace(/\s+/g, '');
  events.push({ type: 'reset' });
  return events;
}

/** Nitro-style dash: once per test, skip the current word. It moves your racer but never counts toward WPM. */
export function dash(t: TypingTest): TypeEvent | null {
  if (t.dashUsed) return null;
  const chars = target(t).length + 1;
  t.dashUsed = true;
  t.dashChars += chars;
  t.typed.push(null);
  t.current = '';
  return { type: 'dash', chars };
}

const matching = (a: string, b: string) => { let n = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++; return n; };

/** Correct characters for scoring: fully correct words plus their space, and the correct prefix of the current word. */
export function correctChars(t: TypingTest): number {
  let n = 0;
  t.typed.forEach((w, i) => { if (w !== null && w === t.words[i]) n += w.length + 1; });
  const word = target(t);
  if (word.startsWith(t.current)) n += t.current.length;
  return n;
}

/** Race progress: every correctly placed character (even in a word with a typo), spaces after correct words, and dashes. */
export function progress(t: TypingTest): number {
  let n = t.dashChars;
  t.typed.forEach((w, i) => { if (w !== null) n += matching(w, t.words[i]!) + (w === t.words[i] ? 1 : 0); });
  return n + matching(t.current, target(t));
}

export interface TypingStats { wpm: number; raw: number; accuracy: number; correctWords: number; wrongWords: number; errors: number; chars: number; bestCombo: number }

export function stats(t: TypingTest, elapsedMs: number): TypingStats {
  const minutes = Math.max(elapsedMs, 1000) / 60000;
  const typedChars = t.typed.reduce((n, w) => n + (w === null ? 0 : w.length + 1), 0) + t.current.length;
  const done = t.typed.map((w, i) => (w === null ? null : w === t.words[i]));
  return {
    wpm: Math.round(correctChars(t) / 5 / minutes),
    raw: Math.round(typedChars / 5 / minutes),
    accuracy: t.keystrokes ? Math.round((100 * t.correctKeys) / t.keystrokes) : 100,
    correctWords: done.filter(x => x === true).length,
    wrongWords: done.filter(x => x === false).length,
    errors: t.keystrokes - t.correctKeys,
    chars: correctChars(t),
    bestCombo: t.bestCombo,
  };
}

/** Records progress at each whole second elapsed (called from the animation loop). */
export function sample(t: TypingTest, elapsedMs: number) {
  const sec = Math.min(Math.floor(elapsedMs / 1000), Math.round(t.durationMs / 1000));
  while (t.samples.length <= sec) t.samples.push(progress(t));
}

/** Progress at a given time from a per-second timeline, interpolated between samples. */
export function progressAt(samples: readonly number[], ms: number): number {
  if (!samples.length) return 0;
  const s = Math.max(0, ms / 1000), i = Math.floor(s);
  if (i >= samples.length - 1) return samples[samples.length - 1]!;
  return samples[i]! + (samples[i + 1]! - samples[i]!) * (s - i);
}

/** WPM over consecutive windows of `step` seconds, from a progress timeline (for the results chart). */
export function wpmSeries(samples: readonly number[], step = 5): number[] {
  const out: number[] = [];
  for (let s = step; s < samples.length; s += step) out.push(Math.round(((samples[s]! - samples[s - step]!) / 5) * (60 / step)));
  return out;
}

/** A computer pacer: steady speed around `wpm` with natural variation and the odd short pause. */
export function pacerSamples(wpm: number, seconds: number, rand: (n: number) => number = rollIndex): number[] {
  const perSec = (wpm * 5) / 60, out = [0];
  for (let s = 1; s <= seconds; s++) {
    const pause = rand(100) < 6 ? 0.25 : 1;
    out.push(out[s - 1]! + perSec * pause * (0.8 + rand(41) / 100));
  }
  return out.map(x => Math.round(x));
}

/** Track length: the distance a 100 WPM typist covers in the test, so most races end somewhere on the track. */
export const goalChars = (durationMs: number) => Math.round((100 * 5 * durationMs) / 60000);

/* ------------------------------------------------------------------ */
/* Personal bests (stored per duration)                                */
/* ------------------------------------------------------------------ */

export interface TypingRecord { wpm: number; accuracy: number; samples: number[]; at: number }
export type TypingBests = Partial<Record<`${Duration}`, TypingRecord>>;

export function sanitizeTypingBests(input: unknown): TypingBests {
  const out: TypingBests = {};
  if (!input || typeof input !== 'object') return out;
  for (const d of DURATIONS) {
    const r = (input as Record<string, unknown>)[String(d)] as Partial<TypingRecord> | undefined;
    if (!r || typeof r !== 'object') continue;
    const { wpm, accuracy, samples, at } = r;
    if (!Number.isInteger(wpm) || wpm! < 0 || wpm! > 400 || !Number.isInteger(accuracy) || accuracy! < 0 || accuracy! > 100) continue;
    if (!Array.isArray(samples) || samples.length > d + 1 || samples.some((x, i) => !Number.isInteger(x) || x < 0 || x > 100000 || (i > 0 && x < samples[i - 1]))) continue;
    out[`${d}`] = { wpm: wpm!, accuracy: accuracy!, samples: [...samples] as number[], at: typeof at === 'number' && Number.isFinite(at) ? at : 0 };
  }
  return out;
}
