/** Color Rush board: computer opponents, draw and discard piles, your hand, colour picker, "last card" calls and catches. */
import { bus } from '../bus';
import { rollIndex } from '../core/games';
import {
  botChoice, call, canCall, cardLabel, catchable, catchPlayer, drawTurn, MAX_PLAYERS, newRush, pass, play, playable, RUSH_COLORS, top,
  type RushCard, type RushColor, type RushEvent, type RushState,
} from '../core/rush';
import type { Person } from '../core/types';
import * as S from '../state/store';
import { $, avatar, confetti, esc, firstName, haptic, icon, reducedMotion, sound } from '../ui/kit';
import { mascot } from '../ui/mascot';

export interface RushHooks { entries(): string[]; active(): boolean; onFinish(text: string): void }
type Phase = 'setup' | 'play' | 'over';
interface Fx { sel: string; from: DOMRect }

const COLOR_NAME: Record<RushColor, string> = { coral: 'Coral', sun: 'Sun', lagoon: 'Lagoon', violet: 'Violet' };
const GLYPH = {
  skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M6.6 17.4 17.4 6.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h12.5M14 5l4 4-4 4M19 15H6.5M10 11l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wild: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="var(--rush-coral)"/><circle cx="16" cy="8" r="4" fill="var(--rush-sun)"/><circle cx="8" cy="16" r="4" fill="var(--rush-lagoon)"/><circle cx="16" cy="16" r="4" fill="var(--rush-violet)"/></svg>',
};
const face = (c: RushCard) => (c.kind === 'num' ? String(c.value) : c.kind === 'draw2' ? '+2' : c.kind === 'wild4' ? '+4' : c.kind === 'wild' ? GLYPH.wild : GLYPH[c.kind]);
const corner = (c: RushCard) => (c.kind === 'num' ? String(c.value) : c.kind === 'draw2' ? '+2' : c.kind === 'wild4' ? '+4' : '');

function cardHtml(c: RushCard, o: { btn?: boolean; can?: boolean; i?: number; big?: boolean; deal?: boolean; picked?: boolean } = {}): string {
  const cls = `rc c-${c.color ?? 'wild'} k-${c.kind} ${o.big ? 'big' : ''} ${o.can ? 'can' : ''} ${o.deal ? 'deal' : ''} ${o.picked ? 'picked' : ''}`;
  const inner = `<span class="rc-tl">${corner(c)}</span><span class="rc-mid">${face(c)}</span><span class="rc-suit"></span>`;
  return o.btn
    ? `<button class="${cls}" type="button" id="rc-${c.id}" data-action="rush-play" data-id="${c.id}" style="--i:${o.i ?? 0}" ${o.can ? '' : 'aria-disabled="true"'} aria-label="${esc(cardLabel(c))}${o.can ? '' : ', cannot play now'}">${inner}</button>`
    : `<span class="${cls}" role="img" aria-label="${esc(cardLabel(c))}">${inner}</span>`;
}

export function createRush(h: RushHooks) {
  const r = {
    phase: 'setup' as Phase, opp: 2, s: null as RushState | null, picking: null as number | null, pickFrom: null as DOMRect | null,
    timer: 0, msg: '', fx: [] as Fx[], deal: false, refocus: false, bump: -1, hit: -1, wins: new Map<string, number>(), seq: 0,
  };
  const delay = () => (reducedMotion() ? 250 : 950);
  const me = () => firstName(S.me().name);
  const busy = () => r.phase === 'play';
  const stop = () => { clearTimeout(r.timer); r.timer = 0; };
  const reset = () => { stop(); r.phase = 'setup'; r.opp = 2; r.s = null; r.picking = null; r.pickFrom = null; r.msg = ''; r.fx = []; r.deal = false; r.refocus = false; r.bump = -1; r.hit = -1; r.wins.clear(); r.seq = 0; };
  const name = (p: number) => (p === 0 ? 'You' : firstName(r.s!.players[p]!.name));
  const person = (n: string): Person => [S.me(), ...S.visiblePeople()].find(p => p.name.toLowerCase() === n.toLowerCase()) ?? ({ id: n, name: n } as Person);

  function opponents(): string[] {
    const mine = S.me().name.toLowerCase(), picked = h.entries().filter(n => n.toLowerCase() !== mine && n.toLowerCase() !== me().toLowerCase());
    return Array.from({ length: r.opp }, (_, i) => picked[i] ?? `Player ${i + 2}`);
  }

  /* ---------------------------------------------------------------- */
  /* Narration                                                         */
  /* ---------------------------------------------------------------- */

  function describe(events: RushEvent[]): string {
    const parts: string[] = [];
    for (const e of events) {
      if (e.type === 'play') parts.push(`${name(e.player)} played ${cardLabel(e.card)}${e.card.color ? '' : ` · ${COLOR_NAME[e.color]}`}`);
      else if (e.type === 'draw' && e.forced) parts.push(`${name(e.player)} ${e.player === 0 ? 'draw' : 'draws'} ${e.cards.length}`);
      else if (e.type === 'draw') parts.push(`${name(e.player)} drew`);
      else if (e.type === 'skip') parts.push(`${name(e.player)} ${e.player === 0 ? 'are' : 'is'} skipped`);
      else if (e.type === 'flip') parts.push('Direction flipped');
      else if (e.type === 'caught') parts.push(`${name(e.by)} caught ${e.player === 0 ? 'you' : name(e.player)}`);
    }
    return [...new Set(parts)].join(' · ');
  }

  /* ---------------------------------------------------------------- */
  /* Markup                                                            */
  /* ---------------------------------------------------------------- */

  function setup(): string {
    const opp = opponents();
    return `<div class="rush-setup">${mascot('hi', { size: 84 })}<h2>Color Rush</h2><p class="muted">Match the colour or symbol. Empty your hand first.</p>
      <div class="seg" role="group" aria-label="Opponents">${[1, 2, 3].map(n => `<button type="button" data-action="rush-opp" data-n="${n}" aria-pressed="${r.opp === n}">${n} ${n === 1 ? 'opponent' : 'opponents'}</button>`).join('')}</div>
      <div class="rush-lineup">${[S.me().name, ...opp].map((n, i) => `<span class="rush-player">${avatar(i === 0 ? S.me() : person(n), 'sm', { round: true })}<span class="truncate">${esc(i === 0 ? 'You' : firstName(n))}</span></span>`).join('')}</div>
      <button class="btn primary lg" type="button" data-action="rush-start">${icon('cards')}Deal</button>
      <details class="rush-rules"><summary>How to play</summary><ul>
        <li>Play a card that matches the colour or symbol on the pile, or a wild.</li>
        <li>No match? Draw one. Play it if it fits, or keep it.</li>
        <li><b>Skip</b>, <b>Flip</b> (reverse) and <b>+2</b> hit the next player. <b>+4</b> is a wild that adds four.</li>
        <li>Down to one card? Tap <b>Last card!</b> before someone catches you.</li>
      </ul></details>
      ${r.wins.size ? `<p class="rush-score">${[...r.wins].map(([n, w]) => `<span>${esc(n)} <b>${w}</b></span>`).join('')}</p>` : ''}</div>`;
  }

  function seat(p: number): string {
    const s = r.s!, pl = s.players[p]!, n = pl.hand.length;
    const fan = Array.from({ length: Math.min(n, 7) }, (_, i) => `<i style="--k:${i - (Math.min(n, 7) - 1) / 2}"></i>`).join('');
    return `<div class="seat ${s.turn === p && s.winner === null ? 'turn' : ''} ${r.hit === p ? 'hit' : ''}" id="seat-${p}">
      ${avatar(person(pl.name), 'sm', { round: true })}
      <span class="seat-name"><span class="truncate">${esc(firstName(pl.name))}</span>${s.turn === p && s.winner === null ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}</span>
      <span class="seat-fan" aria-hidden="true">${fan}</span>
      <span class="seat-count ${r.bump === p ? 'bump' : ''}" aria-label="${n} ${n === 1 ? 'card' : 'cards'}">${n}</span>
      ${n === 1 ? `<span class="pill ${pl.called ? 'warn' : 'bad'} seat-flag">${pl.called ? 'Last card' : '1 left'}</span>` : ''}</div>`;
  }

  function board(): string {
    const s = r.s!, mine = s.players[0]!.hand, myTurn = s.turn === 0 && s.winner === null;
    const can = new Set(playable(s, 0).map(c => c.id));
    const sorted = [...mine].sort((a, b) => RUSH_COLORS.indexOf(a.color ?? 'violet') - RUSH_COLORS.indexOf(b.color ?? 'violet') + (a.color ? 0 : 10) - (b.color ? 0 : 10) || a.kind.localeCompare(b.kind) || a.value - b.value);
    const catches = catchable(s).filter(p => p !== 0);
    const status = myTurn ? (s.drawn !== null ? 'You drew a match · play it or keep it' : can.size ? 'Your turn' : 'No match · draw a card') : `${esc(firstName(name(s.turn)))} is playing`;
    const actions = [
      canCall(s, 0) ? `<button class="btn sm warn call" type="button" data-action="rush-call">${icon('bell')}Last card!</button>` : '',
      ...catches.map(p => `<button class="btn sm bad" type="button" data-action="rush-catch" data-p="${p}">${icon('hand')}Catch ${esc(firstName(name(p)))}</button>`),
      myTurn && s.drawn !== null ? `<button class="btn sm" type="button" data-action="rush-keep">Keep it</button>` : '',
    ].join('');
    const hand = r.picking !== null
      ? `<div class="rush-pick"><span class="label">Choose a colour</span><div class="rush-swatches">${RUSH_COLORS.map(c => `<button class="rush-swatch c-${c}" type="button" data-action="rush-color" data-color="${c}"><span class="rc-suit"></span>${COLOR_NAME[c]}</button>`).join('')}</div><button class="btn sm ghost" type="button" data-action="rush-cancel">Cancel</button></div>`
      : `<div class="rush-hand" id="rush-hand">${sorted.map((c, i) => cardHtml(c, { btn: true, can: can.has(c.id), i, deal: r.deal })).join('')}</div>`;
    return `<div class="rush-seats">${s.players.map((_, p) => (p ? seat(p) : '')).join('')}</div>
      <div class="rush-table">
        <button class="rush-deck ${myTurn && !can.size && s.drawn === null && r.picking === null ? 'hint' : ''}" id="rush-deck" type="button" data-action="rush-draw" ${myTurn && s.drawn === null && r.picking === null ? '' : 'disabled'} aria-label="Draw a card (${s.deck.length} left)"><span class="rc back big"><img src="./brand.svg" alt=""></span><span class="rush-deck-n">${s.deck.length} left</span></button>
        <div class="rush-mid"><span class="rush-color c-${s.color}" title="${COLOR_NAME[s.color]}"><span class="rc-suit"></span></span><span class="rush-dir ${s.dir < 0 ? 'ccw' : ''}" title="${s.dir > 0 ? 'Clockwise' : 'Counter-clockwise'}">${icon('refresh')}</span></div>
        <div class="rush-discard" id="rush-discard">${cardHtml(top(s), { big: true })}</div>
      </div>
      <p class="rush-status ${myTurn ? 'mine' : ''}" role="status" aria-live="polite"><b>${status}</b>${r.msg ? `<span>${esc(r.msg)}</span>` : ''}</p>
      <div class="rush-actions">${actions}</div>
      <div class="rush-me ${myTurn ? 'turn' : ''}"><div class="rush-me-head"><span>${avatar(S.me(), 'xs', { round: true })}You</span><span class="seat-count ${r.bump === 0 ? 'bump' : ''}">${mine.length}</span></div>${hand}</div>`;
  }

  function over(): string {
    const s = r.s!, w = s.winner!, won = w === 0;
    return `<div class="rush-over">${mascot(won ? 'cheer' : 'oops', { size: 96 })}<h2>${won ? 'You win!' : `${esc(firstName(name(w)))} wins`}</h2>
      <div class="rush-left">${s.players.map((pl, p) => `<span class="${p === w ? 'win' : ''}">${esc(p === 0 ? 'You' : firstName(pl.name))} <b>${pl.hand.length}</b></span>`).join('')}</div>
      <div class="cluster" style="justify-content:center"><button class="btn primary" type="button" data-action="rush-start">${icon('refresh')}Play again</button><button class="btn" type="button" data-action="rush-setup">Players</button></div></div>`;
  }

  function render(): string {
    const body = r.phase === 'setup' || !r.s ? setup() : r.phase === 'over' ? over() : board();
    return `<div class="rush ${r.phase}">${body}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Flow                                                              */
  /* ---------------------------------------------------------------- */

  const rect = (sel: string) => $(sel)?.getBoundingClientRect() ?? null;

  function commit(events: RushEvent[], o: { from?: DOMRect | null; drawTo?: number } = {}) {
    const s = r.s!;
    r.msg = describe(events);
    r.bump = -1; r.hit = -1;
    for (const e of events) {
      if (e.type === 'play' && o.from) r.fx.push({ sel: '#rush-discard .rc', from: o.from });
      if (e.type === 'draw') {
        r.bump = e.player;
        const deck = rect('#rush-deck');
        if (e.player === 0 && deck) for (const c of e.cards) r.fx.push({ sel: `#rc-${c.id}`, from: deck });
      }
      if (e.type === 'skip') r.hit = e.player;
    }
    if (events.some(e => e.type === 'play')) { sound.pop(); haptic(8); }
    if (s.winner !== null) {
      stop();
      r.phase = 'over';
      const w = s.winner, n = w === 0 ? 'You' : firstName(name(w));
      r.wins.set(n, (r.wins.get(n) ?? 0) + 1);
      h.onFinish(w === 0 ? '🃏 You won Color Rush' : `🃏 ${n} won Color Rush`);
      if (w === 0) { sound.win(); confetti(); } else sound.wrong();
    }
    bus.refresh();
    schedule();
  }

  function schedule() {
    stop();
    if (!h.active()) return;
    const s = r.s;
    if (r.phase !== 'play' || !s || s.winner !== null) return;
    // Computer players take their turn; they also catch you if you forget to call your last card.
    if (s.turn !== 0 || catchable(s).includes(0)) r.timer = window.setTimeout(botStep, delay());
  }

  function botStep() {
    r.timer = 0;
    if (!h.active()) return;
    const s = r.s;
    if (!s || s.winner !== null || r.phase !== 'play') return;
    const p = s.turn;
    if (catchable(s).includes(0)) {
      const by = p === 0 ? 1 + rollIndex(s.players.length - 1) : p;
      if (rollIndex(100) < 85) return commit(catchPlayer(s, by, 0).ok ? s.events : []);
    }
    if (p === 0) return;
    const choice = botChoice(s, p);
    if (choice) {
      if (s.players[p]!.hand.length === 2 && rollIndex(100) < 75) call(s, p);
      const from = rect(`#seat-${p}`);
      const res = play(s, p, choice.cardId, choice.color);
      return commit(res.ok ? res.events : [], { from });
    }
    if (s.drawn !== null) { pass(s, p); return commit(s.events); }
    drawTurn(s, p);
    commit(s.events);
  }

  function start() {
    if (!h.active()) return;
    stop();
    r.s = newRush([S.me().name, ...opponents()].slice(0, MAX_PLAYERS));
    r.phase = 'play'; r.picking = null; r.msg = ''; r.deal = true; r.bump = -1; r.hit = -1;
    bus.refresh();
    schedule();
  }

  function playMine(id: number, color?: RushColor, from?: DOMRect | null) {
    const s = r.s;
    if (!s) return;
    const res = play(s, 0, id, color);
    if (!res.ok) { sound.wrong(); haptic([20, 30, 20]); const el = $(`#rc-${id}`); el?.classList.remove('nope'); void el?.getBoundingClientRect(); el?.classList.add('nope'); return; }
    r.picking = null;
    r.refocus = true;
    commit(res.events, { from });
  }

  function mount(root: ParentNode) {
    if (r.deal) r.deal = false;
    for (const f of r.fx) {
      const el = root.querySelector<HTMLElement>(f.sel);
      if (!el || reducedMotion()) continue;
      const to = el.getBoundingClientRect();
      el.style.setProperty('--fx', `${f.from.left + f.from.width / 2 - (to.left + to.width / 2)}px`);
      el.style.setProperty('--fy', `${f.from.top + f.from.height / 2 - (to.top + to.height / 2)}px`);
      el.style.setProperty('--fs', String(Math.max(0.3, Math.min(1.6, f.from.width / Math.max(1, to.width)))));
      el.classList.add('fly');
      el.addEventListener('animationend', () => el.classList.remove('fly'), { once: true });
    }
    r.fx = [];
    r.bump = -1; r.hit = -1;
    if (r.refocus) {
      r.refocus = false;
      root.querySelector<HTMLElement>('.rush-hand .rc.can, #rush-deck:not(:disabled), .rush-swatch, [data-action="rush-start"]')?.focus({ preventScroll: true });
    }
    if (r.phase === 'play' && !r.timer) schedule();
  }

  const actions: Record<string, (el: HTMLElement) => void> = {
    'rush-opp': el => { r.opp = Number(el.dataset.n); bus.refresh(); },
    'rush-start': start,
    'rush-setup': () => { stop(); r.phase = 'setup'; bus.refresh(); },
    'rush-play': el => {
      const s = r.s, id = Number(el.dataset.id);
      if (!s || s.turn !== 0) return;
      const c = s.players[0]!.hand.find(x => x.id === id);
      if (!c) return;
      if (!playable(s, 0).some(x => x.id === id)) { sound.wrong(); el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); return; }
      if (!c.color) { r.picking = id; r.pickFrom = el.getBoundingClientRect(); bus.refresh(); return; }
      playMine(id, undefined, el.getBoundingClientRect());
    },
    'rush-color': el => { if (r.picking !== null) playMine(r.picking, el.dataset.color as RushColor, r.pickFrom ?? el.getBoundingClientRect()); },
    'rush-cancel': () => { r.picking = null; bus.refresh(); },
    'rush-draw': () => {
      const s = r.s;
      if (!s || s.turn !== 0 || s.drawn !== null) return;
      const res = drawTurn(s, 0);
      if (res.ok) { sound.tick(); r.refocus = true; commit(res.events); }
    },
    'rush-keep': () => { const s = r.s; if (s && pass(s, 0).ok) commit(s.events); },
    'rush-call': () => { const s = r.s; if (s && call(s, 0).ok) { sound.pop(); haptic(12); r.msg = 'Last card!'; bus.refresh(); schedule(); } },
    'rush-catch': el => { const s = r.s; if (s && catchPlayer(s, 0, Number(el.dataset.p)).ok) commit(s.events); },
  };

  function onKey(e: KeyboardEvent): boolean {
    if (r.phase !== 'play') return false;
    if (e.key.toLowerCase() === 'd') { actions['rush-draw']!($('#rush-deck')!); return true; }
    if (e.key.toLowerCase() === 'l') { actions['rush-call']!(document.body); return true; }
    return false;
  }

  return { render, mount, stop, reset, busy, actions, onKey };
}
