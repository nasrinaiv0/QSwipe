/**
 * Typing race: 1, 3, 5 or 10-minute tests. Solo races your personal-best ghost and an optional pacer; multiplayer is
 * same-device races or head-to-head fights with recorded turns and a replay.
 * Letters flip in as you type, a smooth caret glides between them, lines scroll softly, and racers run on small legs.
 */
import { bus } from '../bus';
import * as T from '../core/typing';
import { FIGHT_GAMES, boxingRound, boxingRounds, fightScore, fightWinner, fightWordRandom, recordStrike, type FightGame, type Strike } from '../core/typing-fight';
import * as S from '../state/store';
import { CRITTERS, CRITTER_META, critterSvg, type Critter } from '../ui/critters';
import { $, $$, confetti, esc, firstName, haptic, hideTooltip, icon, reducedMotion, showTooltip, sound } from '../ui/kit';
import { mascot, type Mood } from '../ui/mascot';

export interface TypingHooks { entries(): string[]; scope(): string; onFinish(text: string): void }
type Phase = 'setup' | 'ready' | 'run' | 'results';
type Kind = 'you' | 'player' | 'ghost' | 'pacer';
interface Player { name: string; critter: Critter }
interface Racer extends Player { kind: Kind; samples: number[]; wpm: number; acc: number; played: boolean }
const MULTIPLAYER_GAMES = [['race', 'Race'], ...Object.entries(FIGHT_GAMES).map(([game, info]) => [game, info.label])] as [string, string][];

const MINUTES: [T.Duration, string][] = [[60, '1 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']];
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const letters = (w: string) => [...w].map(c => `<span class="tl">${esc(c)}</span>`).join('');

export function createTyping(h: TypingHooks) {
  const st = {
    phase: 'setup' as Phase, mode: 'solo' as 'solo' | 'multi', secs: 60 as T.Duration, punct: false, pacer: 0, ghost: true,
    me: 'chick' as Critter, players: [] as Player[], fighters: [] as Player[], game: 'race' as 'race' | FightGame,
    racers: [] as Racer[], turn: 0, test: null as T.TypingTest | null,
    strikes: [[], []] as [Strike[], Strike[]], seed: 0, wordsRandom: undefined as ReturnType<typeof fightWordRandom> | undefined,
    start: 0, raf: 0, timers: [] as number[], counting: false, last: 0, lastSec: -1, lastStat: 0, scroll: 0,
    prog: [] as number[], moved: [] as number[], final: null as T.TypingStats | null, pb: false, scope: '',
  };
  const els = { root: null as HTMLElement | null, words: null as HTMLElement | null, caret: null as HTMLElement | null, input: null as HTMLInputElement | null, roads: [] as HTMLElement[], critters: [] as HTMLElement[], points: [] as HTMLElement[], round: null as HTMLElement | null };
  const stopLoop = () => { cancelAnimationFrame(st.raf); st.raf = 0; st.timers.forEach(clearTimeout); st.timers = []; };
  const stop = () => {
    stopLoop();
    document.body.classList.remove('typing-focus');
    // Leaving mid-test abandons it; the next visit starts cleanly instead of resuming a clock that kept running.
    if (st.phase === 'run') st.phase = st.mode === 'multi' ? 'ready' : 'setup';
  };
  const busy = () => st.phase === 'run';
  const best = () => S.data.typing[`${st.secs}`];
  const goal = () => T.goalChars(st.secs * 1000);
  const typistIndex = () => (st.mode === 'solo' ? 0 : st.turn);
  const fight = () => st.mode === 'multi' && st.game !== 'race' ? st.game : null;
  const players = () => fight() ? st.fighters : st.players;
  const capacity = () => fight() ? 2 : 4;

  function defaultPlayers() {
    const mine = S.me().name.toLowerCase(), names = [firstName(S.me().name), ...h.entries().filter(n => n.toLowerCase() !== mine).map(firstName)];
    st.players = [...new Set(names)].slice(0, 4).map((name, i) => ({ name, critter: CRITTERS[i % CRITTERS.length]! }));
    st.fighters = st.players.slice(0, 2).map(p => ({ ...p }));
  }

  /* ---------------------------------------------------------------- */
  /* Markup                                                            */
  /* ---------------------------------------------------------------- */

  const critterBtn = (c: Critter) =>
    `<button class="tr-pick" type="button" data-action="tr-critter" aria-label="You: ${CRITTER_META[c].label}. Change character"><span class="critter idle">${critterSvg(c)}</span><span class="truncate">You</span></button>`;

  function playerPicker(p: Player, i: number, removable: boolean): string {
    return `<div class="tr-player tr-character">
      <span class="critter idle">${critterSvg(p.critter)}</span>
      <strong class="truncate">${esc(p.name)}</strong>
      <select class="input" data-tr-character="${i}" aria-label="Character for ${esc(p.name)}">
        ${CRITTERS.map(c => `<option value="${c}" ${c === p.critter ? 'selected' : ''}>${CRITTER_META[c].label}</option>`).join('')}
      </select>
      ${removable ? `<button class="icon-btn plain" type="button" data-action="tr-remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>` : ''}
    </div>`;
  }

  function setup(): string {
    if (!st.players.length) defaultPlayers();
    const b = best(), game = fight(), roster = players(), full = roster.length >= capacity();
    const seg = (action: string, items: [string | number, string][], cur: string | number, label: string) =>
      `<div class="seg" role="group" aria-label="${label}">${items.map(([v, l]) => `<button type="button" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    const lineup = st.mode === 'solo'
      ? `${critterBtn(st.me)}${b && st.ghost ? `<span class="tr-ghost-chip"><span class="critter idle ghosty">${critterSvg(st.me)}</span><span>Best ${b.wpm}</span></span>` : ''}${st.pacer ? `<span class="tr-ghost-chip"><span class="critter idle">${critterSvg('penguin')}</span><span>Pacer ${st.pacer}</span></span>` : ''}`
      : roster.map((p, i) => playerPicker(p, i, roster.length > (game ? 1 : 2))).join('');
    return `<div class="tr-setup">
      <div class="tr-hero">${mascot('hi', { size: 40 })}<h2>Typing test</h2></div>
      ${seg('tr-mode', [['solo', 'Solo'], ['multi', 'Multiplayer']], st.mode, 'Typing test mode')}
      ${st.mode === 'multi' ? `<div class="tr-game-picker" role="group" aria-label="Multiplayer typing game">${MULTIPLAYER_GAMES.map(([v, label]) => `<button class="chip" type="button" data-action="tr-game" data-v="${v}" aria-pressed="${st.game === v}">${label}</button>`).join('')}</div>
        <p class="muted tr-rules">${game ? FIGHT_GAMES[game].rules : 'Highest WPM wins.'}</p>` : ''}
      ${seg('tr-time', MINUTES, st.secs, 'Typing test duration')}
      ${st.mode === 'solo'
        ? `<div class="tr-row"><span class="label">Pacer</span>${seg('tr-pacer', [[0, 'Off'], [40, '40'], [60, '60'], [80, '80']], st.pacer, 'Pacer speed')}</div>`
        : `<form class="tr-add" data-submit="tr-add"><input class="input" id="tr-name" maxlength="20" placeholder="Add a player" aria-label="Player name" ${full ? 'disabled' : ''}><button class="btn" type="submit" ${full ? 'disabled' : ''}>${icon('plus')}Add</button></form>`}
      <div class="tr-lineup">${lineup}</div>
      <div class="tr-chips">
        <button class="chip" type="button" data-action="tr-punct" aria-pressed="${st.punct}">Punctuation</button>
        ${st.mode === 'solo' && b ? `<button class="chip" type="button" data-action="tr-ghost" aria-pressed="${st.ghost}">Race my best</button>` : ''}
        <button class="chip" type="button" data-action="tr-sound" aria-pressed="${S.settings().sound}">${icon('volume')}Sound</button>
      </div>
      <button class="btn primary lg" type="button" data-action="tr-start" ${st.mode === 'multi' && roster.length < 2 ? 'disabled' : ''}>${icon('keyboard')}${game ? 'Start the match' : st.mode === 'multi' ? 'Start the race' : 'Start'}</button>
      <p class="hint">${st.mode === 'multi' ? `Same device · ${game ? '2 players' : '2–4 players'}` : b ? `Best for ${st.secs / 60} min: ${b.wpm} wpm` : 'Enter skips one word'}</p>
    </div>`;
  }

  function ready(): string {
    const r = st.racers[st.turn]!, prev = st.turn > 0 ? st.racers[st.turn - 1]! : null, game = fight();
    return `<div class="tr-ready">
      ${prev ? `<p class="tr-prev"><b>${esc(prev.name)}</b> ${prev.wpm} wpm · ${prev.acc}%</p>` : ''}
      <span class="critter idle tr-ready-character">${critterSvg(r.critter)}</span>
      <h2>Pass to ${esc(r.name)}</h2>
      <p class="muted">${game ? `${FIGHT_GAMES[game].label} · ` : ''}${st.secs / 60} min · player ${st.turn + 1} of ${st.racers.length}</p>
      ${game ? '<p class="hint">Press Space after each word to score.</p>' : ''}
      <div class="tr-actions">
      <button class="btn primary lg" type="button" data-action="tr-go">${icon('keyboard')}Start</button>
      <button class="btn" type="button" data-action="tr-setup">Setup</button></div>
    </div>`;
  }

  function track(): string {
    return `<div class="tr-track" id="tr-track">${st.racers.map((r, i) => `<div class="tr-lane ${r.kind} ${st.mode === 'multi' && i > st.turn && !r.played ? 'waiting' : ''}">
      <span class="tr-name truncate">${esc(r.name)}</span>
      <span class="tr-road"><span class="critter ${r.kind === 'ghost' ? 'ghosty' : ''}" id="tr-cr-${i}">${critterSvg(r.critter)}</span><span class="tr-flag" aria-hidden="true"></span></span></div>`).join('')}</div>`;
  }

  function arena(game: FightGame): string {
    return `<section class="tr-arena" data-game-style="${game}" aria-label="${FIGHT_GAMES[game].label} scoreboard">
      <div class="tr-arena-title"><strong>${FIGHT_GAMES[game].label}</strong>${game === 'boxing' ? '<span id="tr-round">Round 1 of 3</span>' : ''}</div>
      <div class="tr-fighters">${st.racers.map((r, i) => `<div class="tr-fighter">
        <strong class="truncate">${esc(r.name)}</strong>
        <span class="critter idle" aria-hidden="true">${critterSvg(r.critter)}</span>
        <span class="tr-fighter-score"><b class="num" id="tr-points-${i}">0</b> pts</span>
        ${st.phase === 'run' ? `<small>${i === st.turn ? 'Typing now' : r.played ? 'Recorded turn' : 'Up next'}</small>` : ''}
      </div>`).join('')}<span class="tr-versus" aria-hidden="true">VS</span></div>
    </section>`;
  }

  function wordsHtml(t: T.TypingTest): string {
    return t.words.map((w, i) => {
      if (i < t.typed.length) {
        const typed = t.typed[i];
        if (typed === null) return `<span class="tw done dashed">${letters(w)}</span>`;
        const ls = [...w].map((c, j) => `<span class="tl ${typed[j] === undefined ? '' : typed[j] === c ? 'ok' : 'bad'}">${esc(c)}</span>`).join('');
        const extra = [...typed.slice(w.length)].map(c => `<span class="tl bad extra">${esc(c)}</span>`).join('');
        return `<span class="tw done ${typed === w ? 'good' : 'wrong'}">${ls}${extra}</span>`;
      }
      if (i === t.typed.length) {
        const ls = [...w].map((c, j) => `<span class="tl ${t.current[j] === undefined ? '' : t.current[j] === c ? 'ok' : 'bad'}">${esc(c)}</span>`).join('');
        return `<span class="tw cur">${ls}${[...t.current.slice(w.length)].map(c => `<span class="tl bad extra">${esc(c)}</span>`).join('')}</span>`;
      }
      return `<span class="tw">${letters(w)}</span>`;
    }).join(' ');
  }

  function run(): string {
    const t = st.test!, typist = st.racers[typistIndex()]!, game = fight();
    return `${game ? arena(game) : track()}
      <div class="tr-stats">
        <span class="tr-stat"><b class="num" id="tr-time">${fmt(st.secs * 1000)}</b><small>left</small></span>
        <span class="tr-stat"><b class="num" id="tr-wpm">0</b><small>wpm</small></span>
        <span class="tr-stat"><b class="num" id="tr-acc">100</b><small>% acc</small></span>
        <span class="tr-stat tr-combo" id="tr-combo-box"><b class="num" id="tr-combo">0</b><small>combo</small></span>
      </div>
      <div class="tr-text" id="tr-text" data-action="tr-focus">
        <div class="tr-count" id="tr-count" aria-hidden="true"></div>
        <div class="tr-words" id="tr-words">${wordsHtml(t)}<span class="tr-caret" id="tr-caret"></span></div>
        <input class="tr-input" id="tr-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="${esc(typist.name)}, type the words shown.${game ? '' : ' Enter dashes past one word.'}">
      </div>
      <div class="tr-tools">
        ${game ? '' : `<button class="btn sm" type="button" data-action="tr-dash" id="tr-dash" ${t.dashUsed ? 'disabled' : ''}>${icon('wind')}Dash</button>`}
        <button class="btn sm ghost" type="button" data-action="tr-sound" aria-pressed="${S.settings().sound}">${icon('volume')}${S.settings().sound ? 'Sound on' : 'Sound off'}</button>
        ${game ? '<button class="btn sm ghost" type="button" data-action="tr-setup">Leave match</button>' : `<button class="btn sm ghost" type="button" data-action="tr-restart">${icon('refresh')}Restart</button>`}
      </div>
      <p class="sr-only" aria-live="polite" id="tr-live"></p>`;
  }

  function chart(samples: number[]): string {
    const step = Math.max(5, Math.round(st.secs / 12)), series = T.wpmSeries(samples, step);
    if (!series.length) return '';
    const W = 300, H = 96, top = 18, gap = 2, bw = (W - gap * (series.length - 1)) / series.length, max = Math.max(10, ...series);
    const peak = series.indexOf(Math.max(...series));
    const bars = series.map((v, i) => {
      const hgt = Math.max(2, ((H - top) * v) / max), x = i * (bw + gap), y = H - hgt, r = Math.min(4, bw / 2, hgt);
      const label = `${fmt(i * step * 1000)}–${fmt((i + 1) * step * 1000)}: ${v} wpm`;
      return `<g class="tr-bar" data-tip="${esc(label)}"><rect x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"/><path d="M${x.toFixed(1)} ${H}V${(y + r).toFixed(1)}q0-${r} ${r}-${r}h${(bw - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${H}Z" fill="var(--accent)"><title>${esc(label)}</title></path></g>`;
    }).join('');
    const px = peak * (bw + gap) + bw / 2, py = H - Math.max(2, ((H - top) * series[peak]!) / max) - 5;
    return `<figure class="tr-chart"><figcaption>Speed over time</figcaption>
      <svg viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Words per minute in ${step}-second windows">${bars}
        <line x1="0" x2="${W}" y1="${H + .25}" y2="${H + .25}" stroke="var(--viz-axis)" stroke-width=".5"/>
        <text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" class="tr-peak">${series[peak]}</text>
        <text x="0" y="${H + 13}" class="tr-axis">0:00</text><text x="${W}" y="${H + 13}" text-anchor="end" class="tr-axis">${fmt(st.secs * 1000)}</text></svg>
      <ul class="sr-only">${series.map((v, i) => `<li>${fmt(i * step * 1000)} to ${fmt((i + 1) * step * 1000)}: ${v} words per minute</li>`).join('')}</ul></figure>`;
  }

  function results(): string {
    if (st.mode === 'solo') {
      const f = st.final!, you = st.racers[0]!, b = best();
      const mood: Mood = f.accuracy < 80 ? 'oops' : f.wpm >= 60 ? 'cheer' : f.wpm >= 30 ? 'happy' : 'think';
      const place = [...st.racers].sort((a, c) => (c.samples.at(-1) ?? 0) - (a.samples.at(-1) ?? 0)).indexOf(you) + 1;
      return `<div class="tr-results">${mascot(mood, { size: 84 })}
        <div class="tr-big"><b class="num">${f.wpm}</b><span>wpm</span></div>
        <div class="tr-badges">${st.pb ? '<span class="pill good">New personal best</span>' : b ? `<span class="pill">Best ${b.wpm} wpm</span>` : ''}${st.racers.length > 1 ? `<span class="pill ${place === 1 ? 'good' : ''}">${place === 1 ? 'You won the race' : `Finished #${place}`}</span>` : ''}</div>
        <dl class="tr-facts"><div><dt>Accuracy</dt><dd>${f.accuracy}%</dd></div><div><dt>Raw</dt><dd>${f.raw}</dd></div><div><dt>Words</dt><dd>${f.correctWords}</dd></div><div><dt>Errors</dt><dd>${f.errors}</dd></div><div><dt>Best combo</dt><dd>${f.bestCombo}</dd></div><div><dt>Characters</dt><dd>${f.chars}</dd></div></dl>
        ${chart(you.samples)}
        <div class="tr-actions"><button class="btn primary" type="button" data-action="tr-start">${icon('refresh')}Again</button><button class="btn" type="button" data-action="tr-setup">Change</button></div></div>`;
    }
    const game = fight();
    if (game) {
      const winner = fightWinner(game, st.strikes, st.secs * 1000);
      return `<div class="tr-results">
        <h2>${winner === null ? 'Draw' : `${esc(st.racers[winner]!.name)} wins`}</h2>
        ${arena(game)}
        ${game === 'boxing' ? `<div class="tr-round-results" aria-label="Boxing round scores">${boxingRounds(st.strikes, st.secs * 1000).map(([a, b], i) => `<div><small>Round ${i + 1}</small><b class="num">${a}–${b}</b></div>`).join('')}</div>` : ''}
        <div class="tr-table">${st.racers.map(r => `<div class="tr-trow"><span class="critter idle sm">${critterSvg(r.critter)}</span><span class="grow truncate">${esc(r.name)}</span><b class="num">${r.wpm}</b><small>wpm</small><span class="muted num">${r.acc}%</span></div>`).join('')}</div>
        <div class="tr-actions"><button class="btn primary" type="button" data-action="tr-replay">${icon('play')}Replay match</button><button class="btn" type="button" data-action="tr-again">${icon('refresh')}Rematch</button><button class="btn" type="button" data-action="tr-setup">Change setup</button></div></div>`;
    }
    const ranked = [...st.racers].sort((a, b) => b.wpm - a.wpm || b.acc - a.acc);
    return `<div class="tr-results">
      <div class="podium tr-podium">${ranked.slice(0, 3).map((r, k) => `<div class="step p${k + 1}"><span class="critter ${k === 0 ? 'cheer' : 'idle'}">${critterSvg(r.critter)}</span><strong>${esc(r.name)}</strong><div class="block">${k + 1}</div></div>`).join('')}</div>
      <div class="tr-table">${ranked.map((r, k) => `<div class="tr-trow"><span class="tr-place">${k + 1}</span><span class="critter idle sm">${critterSvg(r.critter)}</span><span class="grow truncate">${esc(r.name)}</span><b class="num">${r.wpm}</b><small>wpm</small><span class="muted num">${r.acc}%</span></div>`).join('')}</div>
      ${track()}
      <div class="tr-actions"><button class="btn primary" type="button" data-action="tr-replay">${icon('play')}Replay race</button><button class="btn" type="button" data-action="tr-again">${icon('refresh')}Again</button><button class="btn" type="button" data-action="tr-setup">Players</button></div></div>`;
  }

  function render(): string {
    const scope = h.scope();
    if (st.scope !== scope) {
      stop();
      st.scope = scope;
      st.phase = 'setup';
      st.players = [];
      st.fighters = [];
    }
    const body = st.phase === 'setup' ? setup() : st.phase === 'ready' ? ready() : st.phase === 'run' && st.test ? run() : st.phase === 'results' && (st.final || st.mode === 'multi') ? results() : setup();
    return `<div class="tr ${st.phase}">${body}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Race flow                                                         */
  /* ---------------------------------------------------------------- */

  function buildRacers() {
    if (st.mode === 'solo') {
      const b = best();
      st.racers = [{ name: 'You', critter: st.me, kind: 'you', samples: [], wpm: 0, acc: 100, played: false }];
      if (b && st.ghost) st.racers.push({ name: 'Best', critter: st.me, kind: 'ghost', samples: b.samples, wpm: b.wpm, acc: b.accuracy, played: true });
      if (st.pacer) st.racers.push({ name: 'Pacer', critter: 'penguin', kind: 'pacer', samples: T.pacerSamples(st.pacer, st.secs), wpm: st.pacer, acc: 100, played: true });
    } else {
      st.racers = players().map(p => ({ ...p, kind: 'player', samples: [], wpm: 0, acc: 100, played: false }));
      st.strikes = [[], []];
      if (fight()) st.seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    }
  }

  function begin() {
    stopLoop();
    const game = fight();
    st.wordsRandom = game ? fightWordRandom(st.seed) : undefined;
    if (game) st.strikes[st.turn as 0 | 1] = [];
    st.test = T.createTest(st.secs * 1000, st.wordsRandom, { punctuation: st.punct });
    st.phase = 'run'; st.start = 0; st.counting = true; st.scroll = 0; st.lastSec = -1; st.final = null; st.pb = false;
    st.prog = st.racers.map(() => 0); st.moved = st.racers.map(() => 0);
    document.body.classList.add('typing-focus');
    bus.refresh();
    els.input?.focus({ preventScroll: true });
    const count = $('#tr-count'), steps = ['3', '2', '1', 'Go'], gap = reducedMotion() ? 200 : 650;
    steps.forEach((n, i) => st.timers.push(window.setTimeout(() => {
      if (!count) return;
      count.textContent = n;
      count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop');
      if (n === 'Go') sound.go(); else sound.count();
    }, i * gap)));
    st.timers.push(window.setTimeout(() => {
      st.counting = false;
      count?.classList.add('gone');
      $('#tr-text')?.classList.add('live');
      st.start = performance.now();
      st.last = st.start;
      els.input?.focus({ preventScroll: true });
      loop(performance.now());
    }, steps.length * gap - (reducedMotion() ? 0 : 250)));
  }

  function finish() {
    const t = st.test!, i = typistIndex(), r = st.racers[i]!;
    stopLoop();
    T.sample(t, t.durationMs);
    const f = T.stats(t, t.durationMs);
    r.samples = t.samples; r.wpm = f.wpm; r.acc = f.accuracy; r.played = true;
    els.input?.blur();
    document.body.classList.remove('typing-focus');
    if (st.mode === 'solo') {
      st.final = f;
      st.pb = f.wpm > 0 && S.setTypingBest(st.secs, { wpm: f.wpm, accuracy: f.accuracy, samples: t.samples, at: Date.now() });
      h.onFinish(`⌨️ ${f.wpm} wpm · ${st.secs / 60} min`);
      st.phase = 'results';
      sound.win();
      if (st.pb) confetti();
    } else if (st.turn + 1 < st.racers.length) {
      st.turn++;
      st.phase = 'ready';
      sound.pop();
    } else {
      st.phase = 'results';
      const game = fight();
      if (game) {
        const winner = fightWinner(game, st.strikes, st.secs * 1000);
        h.onFinish(winner === null ? `⌨️ ${FIGHT_GAMES[game].label} ended in a draw` : `⌨️ ${st.racers[winner]!.name} won ${FIGHT_GAMES[game].label}`);
        if (winner !== null) { sound.win(); confetti(); }
      } else {
        const w = [...st.racers].sort((a, b) => b.wpm - a.wpm)[0]!;
        h.onFinish(`⌨️ ${w.name} won the typing race (${w.wpm} wpm)`);
        sound.win(); confetti();
      }
    }
    bus.refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Typing                                                            */
  /* ---------------------------------------------------------------- */

  const curWord = () => els.words?.querySelector<HTMLElement>('.tw.cur') ?? null;

  function placeCaret() {
    const t = st.test, cw = curWord(), caret = els.caret, words = els.words;
    if (!t || !cw || !caret || !words) return;
    const ls = cw.querySelectorAll<HTMLElement>('.tl'), i = t.current.length;
    const ref = ls[Math.min(i, ls.length - 1)];
    const x = ref ? (i < ls.length ? ref.offsetLeft : ref.offsetLeft + ref.offsetWidth) : cw.offsetLeft, y = cw.offsetTop;
    caret.style.transform = `translate(${x}px, ${y}px)`;
    caret.style.height = `${cw.offsetHeight}px`;
    const line = cw.offsetHeight;
    if (y - st.scroll >= line * 2 - 2 || y < st.scroll) {
      st.scroll = Math.max(0, y - line);
      words.style.transform = `translateY(${-st.scroll}px)`;
    }
  }

  function onInput() {
    const t = st.test, inp = els.input, words = els.words;
    if (!t || !inp || !words) return;
    if (st.counting || !st.start) { inp.value = ''; return; }
    const elapsed = performance.now() - st.start, game = fight();
    if (elapsed >= t.durationMs) return finish();
    let committed = t.typed.length;
    const events = T.input(t, inp.value);
    let cw = curWord();
    for (const e of events) {
      if (!cw) break;
      if (e.type === 'char') {
        if (e.extra) cw.insertAdjacentHTML('beforeend', `<span class="tl bad extra fx">${esc(t.current[e.index] ?? '')}</span>`);
        else { const l = cw.querySelectorAll('.tl')[e.index]; l?.classList.remove('ok', 'bad', 'fx'); void (l as HTMLElement | undefined)?.offsetWidth; l?.classList.add(e.ok ? 'ok' : 'bad', 'fx'); }
        if (e.ok) sound.key(); else { sound.miss(); haptic(15); }
      } else if (e.type === 'back') {
        const ls = cw.querySelectorAll('.tl'), l = ls[e.index];
        if (l?.classList.contains('extra')) l.remove(); else l?.classList.remove('ok', 'bad', 'fx');
      } else if (e.type === 'reset') {
        const w = T.target(t);
        cw.innerHTML = [...w].map((c, j) => `<span class="tl ${t.current[j] === undefined ? '' : t.current[j] === c ? 'ok' : 'bad'}">${esc(c)}</span>`).join('');
      } else if (e.type === 'word') {
        const word = t.typed[committed++];
        if (game && e.ok && word) recordStrike(st.strikes[st.turn as 0 | 1], game, elapsed, word, e.combo);
        cw.classList.remove('cur');
        cw.classList.add('done', e.ok ? 'good' : 'wrong');
        const next = cw.nextElementSibling as HTMLElement | null;
        next?.classList.add('cur');
        cw = next;
        sound.word();
        comboFx(e.ok ? e.combo : 0);
        const live = $('#tr-live');
        if (live) live.textContent = T.target(t);
      }
    }
    const added = T.ensureWords(t, st.wordsRandom);
    if (added) words.querySelector('.tr-caret')?.insertAdjacentHTML('beforebegin', ' ' + t.words.slice(-added).map(w => `<span class="tw">${letters(w)}</span>`).join(' '));
    if (inp.value !== t.current) inp.value = t.current;
    st.last = performance.now();
    els.caret?.classList.remove('idle');
    placeCaret();
  }

  function comboFx(combo: number) {
    const box = $('#tr-combo-box'), n = $('#tr-combo');
    if (n) n.textContent = String(combo);
    if (!box) return;
    box.classList.remove('hit', 'broke'); void box.offsetWidth;
    if (combo && combo % 10 === 0) {
      box.classList.add('hit');
      sound.combo();
      const me = els.critters[typistIndex()];
      me?.classList.remove('spark'); void me?.offsetWidth; me?.classList.add('spark');
    } else if (!combo) box.classList.add('broke');
  }

  function useDash() {
    const t = st.test;
    if (!t || st.counting || !st.start || fight()) return;
    const e = T.dash(t);
    if (!e) return;
    const cw = curWord();
    cw?.classList.remove('cur'); cw?.classList.add('done', 'dashed');
    (cw?.nextElementSibling as HTMLElement | null)?.classList.add('cur');
    if (els.input) els.input.value = '';
    $('#tr-dash')?.setAttribute('disabled', '');
    sound.dash(); haptic(20);
    const me = els.critters[typistIndex()];
    me?.classList.add('dash');
    st.timers.push(window.setTimeout(() => me?.classList.remove('dash'), 700));
    placeCaret();
    els.input?.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- */
  /* Animation loop: timer, live stats, racers                         */
  /* ---------------------------------------------------------------- */

  function moveRacers(elapsed: number, live: number | null) {
    const g = goal();
    st.racers.forEach((r, i) => {
      const cr = els.critters[i], road = els.roads[i];
      if (!cr || !road) return;
      const p = i === live ? T.progress(st.test!) : r.played || r.kind !== 'player' ? T.progressAt(r.samples, elapsed) : 0;
      const span = road.clientWidth - cr.offsetWidth - 18;
      cr.style.transform = `translateX(${Math.round(Math.min(1, p / g) * span)}px)`;
      if (p > st.prog[i]! + 0.01) st.moved[i] = performance.now();
      st.prog[i] = p;
      cr.classList.toggle('run', performance.now() - st.moved[i]! < 450);
    });
  }

  function updateStage(elapsed: number, live: number | null, animate = true) {
    if (!fight()) return moveRacers(elapsed, live);
    if (els.round) {
      const label = `Round ${boxingRound(elapsed, st.secs * 1000)} of 3`;
      if (els.round.textContent !== label) els.round.textContent = label;
    }
    els.points.forEach((el, i) => {
      const score = fightScore(st.strikes[i]!, elapsed), previous = Number(el.textContent);
      if (score === previous) return;
      el.textContent = String(score);
      const character = els.critters[i];
      if (!animate || reducedMotion() || score < previous || !character) return;
      character.classList.remove('spark');
      void character.offsetWidth;
      character.classList.add('spark');
    });
  }

  function loop(now: number) {
    const t = st.test;
    if (!t || st.phase !== 'run') return;
    const elapsed = now - st.start;
    T.sample(t, elapsed);
    const sec = Math.floor(elapsed / 1000);
    if (sec !== st.lastSec) {
      st.lastSec = sec;
      const time = $('#tr-time');
      if (time) time.textContent = fmt(t.durationMs - elapsed);
      if (t.durationMs - elapsed <= 10000) $('#tr-text')?.closest('.tr')?.classList.add('final');
    }
    if (now - st.lastStat > 250) {
      st.lastStat = now;
      const f = T.stats(t, elapsed);
      const w = $('#tr-wpm'), a = $('#tr-acc');
      if (w) w.textContent = String(f.wpm);
      if (a) a.textContent = String(f.accuracy);
    }
    if (now - st.last > 700) els.caret?.classList.add('idle');
    updateStage(elapsed, typistIndex());
    if (elapsed >= t.durationMs) return finish();
    st.raf = requestAnimationFrame(loop);
  }

  function replay() {
    stopLoop();
    const dur = reducedMotion() ? 1 : 7000, total = st.secs * 1000, t0 = performance.now();
    st.prog = st.racers.map(() => 0); st.moved = st.racers.map(() => 0);
    if (fight()) updateStage(0, null, false);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      updateStage(k * total, null, dur > 1);
      if (k < 1) st.raf = requestAnimationFrame(step);
      else { els.critters.forEach(c => c.classList.remove('run')); sound.win(); }
    };
    st.raf = requestAnimationFrame(step);
  }

  function mount(root: ParentNode) {
    els.root = root.querySelector<HTMLElement>('.tr');
    els.words = root.querySelector<HTMLElement>('#tr-words');
    els.caret = root.querySelector<HTMLElement>('#tr-caret');
    els.input = root.querySelector<HTMLInputElement>('#tr-input');
    els.roads = $$<HTMLElement>('.tr-road', root as HTMLElement);
    els.critters = $$<HTMLElement>('.tr-road .critter, .tr-fighter .critter', root as HTMLElement);
    els.points = $$<HTMLElement>('.tr-fighter-score b', root as HTMLElement);
    els.round = root.querySelector<HTMLElement>('#tr-round');
    $$<HTMLSelectElement>('[data-tr-character]', root as HTMLElement).forEach(select => {
      select.addEventListener('change', () => {
        const player = players()[Number(select.dataset.trCharacter)], critter = select.value as Critter;
        if (!player || !CRITTERS.includes(critter)) return;
        player.critter = critter;
        const avatar = select.closest('.tr-player')?.querySelector('.critter');
        if (avatar) avatar.innerHTML = critterSvg(critter);
      });
    });
    if (st.phase === 'run' && st.test) {
      document.body.classList.add('typing-focus');
      els.input?.addEventListener('input', onInput);
      els.input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useDash(); } });
      if (fight()) {
        els.input?.addEventListener('paste', e => e.preventDefault());
        els.input?.addEventListener('drop', e => e.preventDefault());
      }
      if (st.start) { $('#tr-count')?.classList.add('gone'); $('#tr-text')?.classList.add('live'); els.input!.value = st.test.current; }
      requestAnimationFrame(() => { placeCaret(); if (st.start && !st.raf) loop(performance.now()); });
    } else if (st.phase === 'results' && st.mode === 'multi') {
      updateStage(st.secs * 1000, null, false);
      els.critters.forEach(c => c.classList.remove('run'));
    }
    root.querySelector('.tr-chart svg')?.addEventListener('pointermove', e => {
      const g = (e.target as Element).closest<SVGGElement>('.tr-bar');
      if (g) showTooltip(`<strong>${esc(g.dataset.tip ?? '')}</strong>`, (e as PointerEvent).clientX, (e as PointerEvent).clientY); else hideTooltip();
    });
    root.querySelector('.tr-chart svg')?.addEventListener('pointerleave', hideTooltip);
  }

  const actions: Record<string, (el: HTMLElement) => void> = {
    'tr-mode': el => { st.mode = el.dataset.v as 'solo' | 'multi'; bus.refresh(); },
    'tr-game': el => {
      const game = el.dataset.v ?? '';
      if (game !== 'race' && !Object.hasOwn(FIGHT_GAMES, game)) return;
      st.game = game as typeof st.game;
      bus.refresh();
      $('[data-action="tr-game"][aria-pressed="true"]')?.focus();
    },
    'tr-time': el => { st.secs = Number(el.dataset.v) as T.Duration; bus.refresh(); },
    'tr-pacer': el => { st.pacer = Number(el.dataset.v); bus.refresh(); },
    'tr-punct': () => { st.punct = !st.punct; bus.refresh(); },
    'tr-ghost': () => { st.ghost = !st.ghost; bus.refresh(); },
    'tr-sound': el => {
      const on = !S.settings().sound;
      S.updateSettings({ sound: on });
      el.setAttribute('aria-pressed', String(on));
      const label = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent?.trim());
      if (label && st.phase === 'run') label.textContent = on ? 'Sound on' : 'Sound off';
      if (on) sound.pop();
      if (st.phase === 'run') els.input?.focus({ preventScroll: true });
    },
    'tr-critter': () => {
      st.me = CRITTERS[(CRITTERS.indexOf(st.me) + 1) % CRITTERS.length]!;
      bus.refresh();
    },
    'tr-remove': el => { players().splice(Number(el.dataset.i), 1); bus.refresh(); },
    'tr-add': form => {
      const inp = form.querySelector<HTMLInputElement>('#tr-name')!, name = inp.value.trim().slice(0, 20);
      const roster = players();
      if (!name || roster.length >= capacity()) return;
      const used = new Set(roster.map(p => p.critter));
      roster.push({ name, critter: CRITTERS.find(c => !used.has(c)) ?? 'chick' });
      bus.refresh();
      $<HTMLInputElement>('#tr-name')?.focus();
    },
    'tr-start': () => { buildRacers(); st.turn = 0; if (st.mode === 'multi') { st.phase = 'ready'; bus.refresh(); } else begin(); },
    'tr-again': () => { buildRacers(); st.turn = 0; st.phase = 'ready'; bus.refresh(); },
    'tr-go': () => begin(),
    'tr-setup': () => { stop(); st.phase = 'setup'; bus.refresh(); },
    'tr-restart': () => { if (st.mode === 'solo') { buildRacers(); begin(); } else begin(); },
    'tr-dash': () => useDash(),
    'tr-focus': () => els.input?.focus({ preventScroll: true }),
    'tr-replay': () => replay(),
  };

  return { render, mount, stop, busy, actions };
}
