/**
 * Color Rush: an original shedding card game. Match the active colour or the symbol on the discard pile, use action
 * cards (skip, flip direction, draw two) and wilds, and be first to empty your hand. Pure logic with no DOM access, so
 * every rule is unit-tested.
 */
import { rollIndex, shuffled } from './games';

export const RUSH_COLORS = ['coral', 'sun', 'lagoon', 'violet'] as const;
export type RushColor = (typeof RUSH_COLORS)[number];
export type RushKind = 'num' | 'skip' | 'flip' | 'draw2' | 'wild' | 'wild4';
export interface RushCard { id: number; kind: RushKind; color: RushColor | null; value: number }
export interface RushPlayer { name: string; bot: boolean; hand: RushCard[]; called: boolean }

export type RushEvent =
  | { type: 'play'; player: number; card: RushCard; color: RushColor }
  | { type: 'draw'; player: number; cards: RushCard[]; forced: boolean }
  | { type: 'skip'; player: number }
  | { type: 'flip'; dir: 1 | -1 }
  | { type: 'pass'; player: number }
  | { type: 'call'; player: number }
  | { type: 'caught'; player: number; by: number }
  | { type: 'win'; player: number };

export interface RushState {
  players: RushPlayer[];
  /** Draw pile; the top card is the last element. */
  deck: RushCard[];
  /** Discard pile; the top card is the last element. */
  discard: RushCard[];
  /** Active colour (after a wild it differs from the top card's own colour). */
  color: RushColor;
  turn: number;
  dir: 1 | -1;
  /** Id of the card the current player just drew and may still play; any other play is blocked until they pass. */
  drawn: number | null;
  winner: number | null;
  /** Events produced by the most recent action, for messages and animations. */
  events: RushEvent[];
  /** Increments on every successful action. */
  seq: number;
}

export const HAND_SIZE = 7;
export const MAX_PLAYERS = 4;

/** 108 cards: per colour one 0, two each of 1–9, two each of skip, flip and draw two; plus four wilds and four wild draw fours. */
export function createDeck(): RushCard[] {
  const cards: RushCard[] = [];
  let id = 0;
  const add = (kind: RushKind, color: RushColor | null, value = -1) => cards.push({ id: id++, kind, color, value });
  for (const color of RUSH_COLORS) {
    add('num', color, 0);
    for (let v = 1; v <= 9; v++) { add('num', color, v); add('num', color, v); }
    for (const kind of ['skip', 'flip', 'draw2'] as const) { add(kind, color); add(kind, color); }
  }
  for (let i = 0; i < 4; i++) { add('wild', null); add('wild4', null); }
  return cards;
}

export const top = (s: RushState): RushCard => s.discard[s.discard.length - 1]!;
export const isWild = (c: RushCard) => c.kind === 'wild' || c.kind === 'wild4';
export const nextIndex = (s: RushState, from = s.turn, steps = 1) => {
  const n = s.players.length;
  return (((from + s.dir * steps) % n) + n) % n;
};

export function canPlay(s: RushState, c: RushCard): boolean {
  if (isWild(c)) return true;
  const t = top(s);
  if (c.color === s.color) return true;
  return c.kind === 'num' ? t.kind === 'num' && t.value === c.value : c.kind === t.kind;
}

/** Cards the player may play right now (only the just-drawn card after a draw). */
export function playable(s: RushState, p: number): RushCard[] {
  if (s.winner !== null || p !== s.turn) return [];
  const hand = s.players[p]!.hand;
  if (s.drawn !== null) return hand.filter(c => c.id === s.drawn && canPlay(s, c));
  return hand.filter(c => canPlay(s, c));
}

export function newRush(names: string[], rand: (n: number) => number = rollIndex, handSize = HAND_SIZE): RushState {
  if (names.length < 2 || names.length > MAX_PLAYERS) throw new Error('Color Rush needs 2 to 4 players');
  const deck = shuffled(createDeck(), rand);
  const players: RushPlayer[] = names.map((name, i) => ({ name, bot: i > 0, hand: [], called: false }));
  for (let k = 0; k < handSize; k++) for (const p of players) p.hand.push(deck.pop()!);
  // The first discard is always a number card so the opening is never an action.
  const first = deck.map(c => c.kind).lastIndexOf('num');
  const [start] = deck.splice(first, 1);
  return { players, deck, discard: [start!], color: start!.color!, turn: 0, dir: 1, drawn: null, winner: null, events: [], seq: 0 };
}

/** Takes up to n cards from the draw pile, reshuffling the discard pile (except its top card) when it runs out. */
export function takeCards(s: RushState, p: number, n: number, rand: (n: number) => number = rollIndex): RushCard[] {
  const got: RushCard[] = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length && s.discard.length > 1) s.deck = shuffled(s.discard.splice(0, s.discard.length - 1), rand);
    const c = s.deck.pop();
    if (!c) break;
    got.push(c);
  }
  const player = s.players[p]!;
  player.hand.push(...got);
  if (player.hand.length > 1) player.called = false;
  return got;
}

const fail = (error: string) => ({ ok: false as const, error });
type Result = { ok: true; events: RushEvent[] } | { ok: false; error: string };
const done = (s: RushState, events: RushEvent[]): Result => { s.events = events; s.seq++; return { ok: true, events }; };

export function play(s: RushState, p: number, cardId: number, chosen?: RushColor, rand: (n: number) => number = rollIndex): Result {
  if (s.winner !== null) return fail('The round is over.');
  if (p !== s.turn) return fail('Not your turn.');
  const hand = s.players[p]!.hand, i = hand.findIndex(c => c.id === cardId);
  if (i < 0) return fail('That card is not in your hand.');
  const card = hand[i]!;
  if (s.drawn !== null && card.id !== s.drawn) return fail('Play the card you drew or pass.');
  if (!canPlay(s, card)) return fail('That card does not match.');
  if (isWild(card) && !chosen) return fail('Choose a colour.');
  hand.splice(i, 1);
  s.discard.push(card);
  s.color = card.color ?? chosen!;
  s.drawn = null;
  const events: RushEvent[] = [{ type: 'play', player: p, card, color: s.color }];
  if (!hand.length) {
    s.winner = p;
    events.push({ type: 'win', player: p });
    return done(s, events);
  }
  if (hand.length > 1) s.players[p]!.called = false;
  const two = s.players.length === 2;
  if (card.kind === 'skip' || (card.kind === 'flip' && two)) {
    const skipped = nextIndex(s, p);
    events.push({ type: 'skip', player: skipped });
    s.turn = nextIndex(s, p, 2);
  } else if (card.kind === 'flip') {
    s.dir = s.dir === 1 ? -1 : 1;
    events.push({ type: 'flip', dir: s.dir });
    s.turn = nextIndex(s, p);
  } else if (card.kind === 'draw2' || card.kind === 'wild4') {
    const victim = nextIndex(s, p);
    events.push({ type: 'draw', player: victim, cards: takeCards(s, victim, card.kind === 'draw2' ? 2 : 4, rand), forced: true }, { type: 'skip', player: victim });
    s.turn = nextIndex(s, p, 2);
  } else {
    s.turn = nextIndex(s, p);
  }
  return done(s, events);
}

/** The current player draws one card. If it can be played they may play it (or pass); otherwise the turn moves on. */
export function drawTurn(s: RushState, p: number, rand: (n: number) => number = rollIndex): Result & { card?: RushCard; canPlayIt?: boolean } {
  if (s.winner !== null) return fail('The round is over.');
  if (p !== s.turn) return fail('Not your turn.');
  if (s.drawn !== null) return fail('You already drew a card.');
  const [card] = takeCards(s, p, 1, rand);
  const events: RushEvent[] = [{ type: 'draw', player: p, cards: card ? [card] : [], forced: false }];
  if (card && canPlay(s, card)) {
    s.drawn = card.id;
    return { ...done(s, events), card, canPlayIt: true };
  }
  events.push({ type: 'pass', player: p });
  s.turn = nextIndex(s, p);
  return { ...done(s, events), card, canPlayIt: false };
}

/** Keep the card just drawn and end the turn. */
export function pass(s: RushState, p: number): Result {
  if (s.winner !== null || p !== s.turn || s.drawn === null) return fail('Nothing to pass.');
  s.drawn = null;
  s.turn = nextIndex(s, p);
  return done(s, [{ type: 'pass', player: p }]);
}

/** "Last card!" A player may call when holding two cards on their turn, or one card at any time. */
export function canCall(s: RushState, p: number): boolean {
  const pl = s.players[p]!;
  return s.winner === null && !pl.called && (pl.hand.length === 1 || (pl.hand.length === 2 && s.turn === p && playable(s, p).length > 0));
}
export function call(s: RushState, p: number): Result {
  if (!canCall(s, p)) return fail('Nothing to call.');
  s.players[p]!.called = true;
  return done(s, [{ type: 'call', player: p }]);
}

/** Players holding one card who forgot to call; anyone else may catch them for a two-card penalty. */
export const catchable = (s: RushState): number[] => (s.winner !== null ? [] : s.players.flatMap((pl, i) => (pl.hand.length === 1 && !pl.called ? [i] : [])));
export function catchPlayer(s: RushState, by: number, target: number, rand: (n: number) => number = rollIndex): Result {
  if (by === target || !catchable(s).includes(target)) return fail('Nobody to catch.');
  const cards = takeCards(s, target, 2, rand);
  return done(s, [{ type: 'caught', player: target, by }, { type: 'draw', player: target, cards, forced: true }]);
}

/* ------------------------------------------------------------------ */
/* Computer players                                                    */
/* ------------------------------------------------------------------ */

export function bestColor(hand: RushCard[], rand: (n: number) => number = rollIndex): RushColor {
  const counts = RUSH_COLORS.map(c => hand.filter(x => x.color === c).length);
  const max = Math.max(...counts);
  const best = RUSH_COLORS.filter((_, i) => counts[i] === max);
  return best[rand(best.length)]!;
}

/**
 * A simple, fair strategy: attack when the next player is close to winning, otherwise shed cards of the colour the bot
 * holds most of, keeping wilds (and especially wild draw fours) for when nothing else fits.
 */
export function botChoice(s: RushState, p: number, rand: (n: number) => number = rollIndex): { cardId: number; color?: RushColor } | null {
  const options = playable(s, p);
  if (!options.length) return null;
  const hand = s.players[p]!.hand, threat = s.players[nextIndex(s, p)]!.hand.length <= 2;
  const held = (c: RushColor | null) => (c ? hand.filter(x => x.color === c).length : 0);
  const score = (c: RushCard) => {
    if (c.kind === 'wild4') return threat ? 90 : -20;
    if (c.kind === 'wild') return threat ? 20 : -10;
    const attack = c.kind === 'draw2' ? 3 : c.kind === 'skip' ? 2 : c.kind === 'flip' ? 1 : 0;
    return (threat ? attack * 25 : attack * 3) + held(c.color) * 4 + (c.kind === 'num' ? c.value / 3 : 0);
  };
  const best = options.reduce((a, b) => (score(b) > score(a) ? b : a));
  return isWild(best) ? { cardId: best.id, color: bestColor(hand.filter(c => c.id !== best.id), rand) } : { cardId: best.id };
}

export const cardLabel = (c: RushCard) => {
  const color = c.color ? `${c.color[0]!.toUpperCase()}${c.color.slice(1)} ` : '';
  const what = c.kind === 'num' ? String(c.value) : { skip: 'Skip', flip: 'Flip', draw2: 'Draw two', wild: 'Wild', wild4: 'Wild draw four' }[c.kind];
  return `${color}${what}`;
};
