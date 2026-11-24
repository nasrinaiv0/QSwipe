import { describe, expect, it } from 'vitest';
import {
  botChoice, call, canCall, canPlay, catchable, catchPlayer, createDeck, drawTurn, newRush, pass, play, playable, takeCards, top,
  type RushCard, type RushState,
} from '../src/core/rush';

/** Deterministic PRNG so games are reproducible. */
const seeded = (seed: number) => {
  let x = seed >>> 0 || 1;
  return (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
};
const total = (s: RushState) => s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
const card = (over: Partial<RushCard>): RushCard => ({ id: 999, kind: 'num', color: 'coral', value: 5, ...over });
/** Puts a specific card in a player's hand so a rule can be exercised directly. */
const give = (s: RushState, p: number, c: RushCard) => { s.players[p]!.hand.push(c); return c; };

describe('color rush deck and deal', () => {
  it('has 108 unique cards with the right mix', () => {
    const d = createDeck();
    expect(d).toHaveLength(108);
    expect(new Set(d.map(c => c.id)).size).toBe(108);
    expect(d.filter(c => c.kind === 'num')).toHaveLength(76);
    expect(d.filter(c => c.kind === 'wild')).toHaveLength(4);
    expect(d.filter(c => c.kind === 'wild4')).toHaveLength(4);
    expect(d.filter(c => c.kind === 'skip' && c.color === 'lagoon')).toHaveLength(2);
  });
  it('deals seven each, opens on a number card and conserves cards', () => {
    const s = newRush(['You', 'Ava', 'Ben'], seeded(7));
    expect(s.players.map(p => p.hand.length)).toEqual([7, 7, 7]);
    expect(top(s).kind).toBe('num');
    expect(s.color).toBe(top(s).color);
    expect(s.players.map(p => p.bot)).toEqual([false, true, true]);
    expect(total(s)).toBe(108);
  });
  it('rejects too few or too many players', () => {
    expect(() => newRush(['Solo'])).toThrow();
    expect(() => newRush(['a', 'b', 'c', 'd', 'e'])).toThrow();
  });
});

describe('color rush rules', () => {
  const base = () => {
    const s = newRush(['You', 'Ava', 'Ben'], seeded(3));
    s.discard.push(card({ id: 500, color: 'sun', value: 4 }));
    s.color = 'sun';
    return s;
  };
  it('matches colour, number or symbol; wilds always play', () => {
    const s = base();
    expect(canPlay(s, card({ color: 'sun', value: 9 }))).toBe(true);
    expect(canPlay(s, card({ color: 'violet', value: 4 }))).toBe(true);
    expect(canPlay(s, card({ color: 'violet', value: 5 }))).toBe(false);
    expect(canPlay(s, card({ kind: 'wild', color: null, value: -1 }))).toBe(true);
    s.discard.push(card({ id: 501, kind: 'skip', color: 'lagoon', value: -1 })); s.color = 'lagoon';
    expect(canPlay(s, card({ kind: 'skip', color: 'coral', value: -1 }))).toBe(true);
  });
  it('blocks out-of-turn and illegal plays', () => {
    const s = base();
    const bad = give(s, 0, card({ id: 600, color: 'violet', value: 1 }));
    expect(play(s, 0, bad.id).ok).toBe(false);
    const ok = give(s, 1, card({ id: 601, color: 'sun', value: 1 }));
    expect(play(s, 1, ok.id).ok).toBe(false);
  });
  it('skip jumps a player; draw two makes the next player draw and lose their turn', () => {
    const s = base();
    const skip = give(s, 0, card({ id: 610, kind: 'skip', color: 'sun', value: -1 }));
    expect(play(s, 0, skip.id).ok).toBe(true);
    expect(s.turn).toBe(2);
    const d2 = give(s, 2, card({ id: 611, kind: 'draw2', color: 'sun', value: -1 }));
    const before = s.players[0]!.hand.length;
    expect(play(s, 2, d2.id).ok).toBe(true);
    expect(s.players[0]!.hand.length).toBe(before + 2);
    expect(s.turn).toBe(1);
    expect(total(s)).toBe(108 + 3); // three test cards were added
  });
  it('flip reverses direction, and acts as a skip with two players', () => {
    const s = base();
    const f = give(s, 0, card({ id: 620, kind: 'flip', color: 'sun', value: -1 }));
    play(s, 0, f.id);
    expect(s.dir).toBe(-1);
    expect(s.turn).toBe(2);
    const two = newRush(['You', 'Ava'], seeded(9));
    two.discard.push(card({ id: 630, color: 'coral', value: 2 })); two.color = 'coral';
    const f2 = give(two, 0, card({ id: 631, kind: 'flip', color: 'coral', value: -1 }));
    play(two, 0, f2.id);
    expect(two.turn).toBe(0);
  });
  it('wilds need a colour and set it; wild draw four hits the next player', () => {
    const s = base();
    const w = give(s, 0, card({ id: 640, kind: 'wild4', color: null, value: -1 }));
    expect(play(s, 0, w.id).ok).toBe(false);
    const before = s.players[1]!.hand.length;
    expect(play(s, 0, w.id, 'violet').ok).toBe(true);
    expect(s.color).toBe('violet');
    expect(s.players[1]!.hand.length).toBe(before + 4);
    expect(s.turn).toBe(2);
  });
  it('after drawing, only the drawn card may be played, or the player passes', () => {
    const s = base();
    s.players[0]!.hand = [card({ id: 650, color: 'violet', value: 1 })];
    s.deck.push(card({ id: 651, color: 'sun', value: 8 }));
    const r = drawTurn(s, 0);
    expect(r.ok && r.canPlayIt).toBe(true);
    expect(playable(s, 0).map(c => c.id)).toEqual([651]);
    expect(pass(s, 0).ok).toBe(true);
    expect(s.turn).toBe(1);
    s.deck.push(card({ id: 652, color: 'violet', value: 2 }));
    const r2 = drawTurn(s, 1);
    expect(r2.ok && r2.canPlayIt).toBe(false);
    expect(s.turn).toBe(2);
  });
  it('reshuffles the discard pile when the draw pile runs out', () => {
    const s = base();
    s.discard.unshift(...s.deck.splice(0));
    const t = top(s);
    expect(takeCards(s, 0, 3)).toHaveLength(3);
    expect(top(s)).toBe(t);
    expect(s.discard).toHaveLength(1);
  });
  it('last card: calling protects you; forgetting lets others catch you for two cards', () => {
    const s = base();
    s.players[0]!.hand = [card({ id: 660, color: 'sun', value: 1 }), card({ id: 661, color: 'sun', value: 2 })];
    expect(canCall(s, 0)).toBe(true);
    play(s, 0, 660);
    expect(catchable(s)).toEqual([0]);
    expect(catchPlayer(s, 1, 0).ok).toBe(true);
    expect(s.players[0]!.hand).toHaveLength(3);
    s.players[1]!.hand = [card({ id: 662, color: 'sun', value: 3 })];
    expect(call(s, 1).ok).toBe(true);
    expect(catchable(s)).toEqual([]);
  });
  it('playing the last card wins the round', () => {
    const s = base();
    s.players[0]!.hand = [card({ id: 670, color: 'sun', value: 6 })];
    const r = play(s, 0, 670);
    expect(r.ok && s.winner).toBe(0);
    expect(playable(s, 1)).toEqual([]);
  });
});

describe('computer players', () => {
  it('only choose legal cards and pick a colour for wilds', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = newRush(['You', 'Ava', 'Ben', 'Cara'], seeded(seed));
      s.turn = 1;
      const choice = botChoice(s, 1, seeded(seed));
      const legal = playable(s, 1).map(c => c.id);
      if (!choice) expect(legal).toEqual([]);
      else {
        expect(legal).toContain(choice.cardId);
        expect(play(s, 1, choice.cardId, choice.color).ok).toBe(true);
      }
    }
  });
  it('all-computer games always finish and never lose a card', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = seeded(seed);
      const s = newRush(['A', 'B', 'C', 'D'].slice(0, 2 + (seed % 3)), rand);
      let steps = 0;
      while (s.winner === null && steps++ < 3000) {
        const p = s.turn, choice = botChoice(s, p, rand);
        if (choice) { if (s.players[p]!.hand.length === 2) call(s, p); expect(play(s, p, choice.cardId, choice.color, rand).ok).toBe(true); }
        else if (s.drawn !== null) pass(s, p);
        else drawTurn(s, p, rand);
        expect(total(s)).toBe(108);
      }
      expect(s.winner).not.toBeNull();
    }
  });
});
