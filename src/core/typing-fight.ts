/** Same-device typing bouts compare both players at the same point on the clock. */
export const FIGHT_GAMES = {
  neon: {
    label: 'Neon Showdown',
    rules: 'Score one point per correct word and two bonus points every five in a row.',
  },
  street: {
    label: 'Street Clash',
    rules: 'Correct words score one point. Words with six or more letters score double.',
  },
  boxing: {
    label: 'Boxing',
    rules: 'Score one point per correct word. Win the most of three rounds to win the bout.',
  },
} as const;

export type FightGame = keyof typeof FIGHT_GAMES;
export interface Strike { at: number; total: number }
type Timelines = readonly [readonly Strike[], readonly Strike[]];

/** Give each player the same word stream, including words generated later in the test. */
export function fightWordRandom(seed: number) {
  let state = seed >>> 0;
  return (count: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * count);
  };
}

export function recordStrike(timeline: Strike[], game: FightGame, at: number, word: string, combo: number) {
  const bonus = game === 'neon' && combo % 5 === 0 ? 2
    : game === 'street' && word.replace(/[^a-z]/gi, '').length >= 6 ? 1 : 0;
  timeline.push({ at, total: (timeline.at(-1)?.total ?? 0) + 1 + bonus });
}

export function fightScore(timeline: readonly Strike[], at: number): number {
  return timeline.findLast(strike => strike.at <= at)?.total ?? 0;
}

export function boxingRound(at: number, duration: number): number {
  return Math.min(3, Math.floor((3 * at) / duration) + 1);
}

export function boxingRounds(timelines: Timelines, duration: number) {
  return [0, 1, 2].map(round => {
    const start = (duration * round) / 3;
    const end = (duration * (round + 1)) / 3;
    return timelines.map(timeline => {
      const before = timeline.findLast(strike => strike.at < start)?.total ?? 0;
      const through = timeline.findLast(strike => strike.at < end)?.total ?? 0;
      return through - before;
    });
  });
}

export function fightWinner(game: FightGame, timelines: Timelines, duration: number): 0 | 1 | null {
  const lead = game === 'boxing'
    ? boxingRounds(timelines, duration).reduce((wins, [a, b]) => wins + Math.sign(a! - b!), 0)
    : fightScore(timelines[0], duration) - fightScore(timelines[1], duration);
  return lead === 0 ? null : lead > 0 ? 0 : 1;
}
