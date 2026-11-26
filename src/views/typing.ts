/**
 * Typing race: 1, 3, 5 or 10-minute tests. Solo races your personal-best ghost and an optional pacer; multiplayer is
 * same-device turns where everyone who already typed races live alongside you, then a replay shows the whole race.
 * Letters flip in as you type, a smooth caret glides between them, lines scroll softly, and racers run on small legs.
 */
import { bus } from '../bus';
import * as T from '../core/typing';
import * as S from '../state/store';
import { CRITTERS, CRITTER_META, critterSvg, type Critter } from '../ui/critters';
import { $, $$, confetti, esc, firstName, haptic, hideTooltip, icon, reducedMotion, showTooltip, sound } from '../ui/kit';
import { mascot, type Mood } from '../ui/mascot';

export interface TypingHooks { entries(): string[]; onFinish(text: string): void }
type Phase = 'setup' | 'ready' | 'run' | 'results';
type Kind = 'you' | 'player' | 'ghost' | 'pacer';
interface Racer { name: string; critter: Critter; kind: Kind; samples: number[]; wpm: number; acc: number; played: boolean }

const MINUTES: [T.Duration, string][] = [[60, '1 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']];
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const letters = (w: string) => [...w].map(c => `<span class="tl">${esc(c)}</span>`).join('');

export function createTyping(h: TypingHooks) {
  const st = {
    phase: 'setup' as Phase, mode: 'solo' as 'solo' | 'multi', secs: 60 as T.Duration, punct: false, pacer: 0, ghost: true,
    me: 'chick' as Critter, players: [] as { name: string; critter: Critter }[],
    racers: [] as Racer[], turn: 0, test: null as T.TypingTest | null,
    start: 0, raf: 0, timers: [] as number[], counting: false, last: 0, lastSec: -1, lastStat: 0, scroll: 0,
    prog: [] as number[], moved: [] as number[], final: null as T.TypingStats | null, pb: false, replaying: false,
  };
  const els = { root: null as HTMLElement | null, words: null as HTMLElement | null, caret: null as HTMLElement | null, input: null as HTMLInputElement | null, roads: [] as HTMLElement[], critters: [] as HTMLElement[] };
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

  function defaultPlayers() {
    const mine = S.me().name.toLowerCase(), names = [firstName(S.me().name), ...h.entries().filter(n => n.toLowerCase() !== mine).map(firstName)];
    st.players = [...new Set(names)].slice(0, 4).map((name, i) => ({ name, critter: CRITTERS[i % CRITTERS.length]! }));
  }

  /* ---------------------------------------------------------------- */
  /* Markup                                                            */
  /* ---------------------------------------------------------------- */

  const critterBtn = (c: Critter, i: number, name: string) =>
    `<button class="tr-pick" type="button" data-action="tr-critter" data-i="${i}" aria-label="${esc(name)}: ${CRITTER_META[c].label}. Change character"><span class="critter idle">${critterSvg(c)}</span><span class="truncate">${esc(name)}</span></button>`;

  function setup(): string {
    if (!st.players.length) defaultPlayers();
    const b = best();
    const seg = (action: string, items: [string | number, string][], cur: string | number) =>
      `<div class="seg" role="group">${items.map(([v, l]) => `<button type="button" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    const lineup = st.mode === 'solo'
      ? `${critterBtn(st.me, -1, 'You')}${b && st.ghost ? `<span class="tr-ghost-chip"><span class="critter idle ghosty">${critterSvg(st.me)}</span><span>Best ${b.wpm}</span></span>` : ''}${st.pacer ? `<span class="tr-ghost-chip"><span class="critter idle">${critterSvg('penguin')}</span><span>Pacer ${st.pacer}</span></span>` : ''}`
      : st.players.map((p, i) => `<span class="tr-player">${critterBtn(p.critter, i, p.name)}${st.players.length > 2 ? `<button class="icon-btn plain" type="button" data-action="tr-remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button>` : ''}</span>`).join('');
    return `<div class="tr-setup">
      <div class="tr-hero">${mascot('hi', { size: 64 })}<div><h2>Typing race</h2><p class="muted">Type fast, stay accurate, race your crew.</p></div></div>
      ${seg('tr-mode', [['solo', 'Solo'], ['multi', 'Multiplayer']], st.mode)}
      ${seg('tr-time', MINUTES, st.secs)}
      ${st.mode === 'solo'
        ? `<div class="tr-row"><span class="label">Pacer</span>${seg('tr-pacer', [[0, 'Off'], [40, '40'], [60, '60'], [80, '80']], st.pacer)}</div>`
        : `<form class="tr-add" data-submit="tr-add"><input class="input" id="tr-name" maxlength="20" placeholder="Add a player" aria-label="Player name" ${st.players.length >= 4 ? 'disabled' : ''}><button class="btn" type="submit" ${st.players.length >= 4 ? 'disabled' : ''}>${icon('plus')}Add</button></form>`}
      <div class="tr-lineup">${lineup}</div>
      <div class="tr-chips">
        <button class="chip" type="button" data-action="tr-punct" aria-pressed="${st.punct}">Punctuation</button>
        ${st.mode === 'solo' && b ? `<button class="chip" type="button" data-action="tr-ghost" aria-pressed="${st.ghost}">Race my best</button>` : ''}
        <button class="chip" type="button" data-action="tr-sound" aria-pressed="${S.settings().sound}">${icon('volume')}Sound</button>
      </div>
      <button class="btn primary lg" type="button" data-action="tr-start" ${st.mode === 'multi' && st.players.length < 2 ? 'disabled' : ''}>${icon('keyboard')}${st.mode === 'multi' ? 'Start the race' : 'Start'}</button>
      <p class="hint">${st.mode === 'multi' ? 'Same device · take turns · 2–4 players' : b ? `Best for ${st.secs / 60} min: ${b.wpm} wpm` : 'Tip: Enter dashes past one word per race'}</p>
    </div>`;
  }

  function ready(): string {
    const r = st.racers[st.turn]!, prev = st.turn > 0 ? st.racers[st.turn - 1]! : null;
    return `<div class="tr-ready">
      ${prev ? `<p class="tr-prev"><b>${esc(prev.name)}</b> ${prev.wpm} wpm · ${prev.acc}%</p>` : ''}
      <span class="critter idle big">${critterSvg(r.critter)}</span>
      <h2>Pass to ${esc(r.name)}</h2>
      <p class="muted">${st.secs / 60} min · player ${st.turn + 1} of ${st.racers.length}</p>
      <button class="btn primary lg" type="button" data-action="tr-go">${icon('keyboard')}Start</button>
    </div>`;
  }

  function track(): string {
    return `<div class="tr-track" id="tr-track">${st.racers.map((r, i) => `<div class="tr-lane ${r.kind} ${st.mode === 'multi' && i > st.turn && !r.played ? 'waiting' : ''}">
      <span class="tr-name truncate">${esc(r.name)}</span>
      <span class="tr-road"><span class="critter ${r.kind === 'ghost' ? 'ghosty' : ''}" id="tr-cr-${i}">${critterSvg(r.critter)}</span><span class="tr-flag" aria-hidden="true"></span></span></div>`).join('')}</div>`;
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
    const t = st.test!, typist = st.racers[typistIndex()]!;
    return `${track()}
      <div class="tr-stats">
        <span class="tr-stat"><b class="num" id="tr-time">${fmt(st.secs * 1000)}</b><small>left</small></span>
        <span class="tr-stat"><b class="num" id="tr-wpm">0</b><small>wpm</small></span>
        <span class="tr-stat"><b class="num" id="tr-acc">100</b><small>% acc</small></span>
        <span class="tr-stat tr-combo" id="tr-combo-box"><b class="num" id="tr-combo">0</b><small>combo</small></span>
      </div>
      <div class="tr-text" id="tr-text" data-action="tr-focus">
        <div class="tr-count" id="tr-count" aria-hidden="true"></div>
        <div class="tr-words" id="tr-words">${wordsHtml(t)}<span class="tr-caret" id="tr-caret"></span></div>
        <input class="tr-input" id="tr-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="${esc(typist.name)}, type the words shown. Enter dashes past one word.">
      </div>
      <div class="tr-tools">
        <button class="btn sm" type="button" data-action="tr-dash" id="tr-dash" ${t.dashUsed ? 'disabled' : ''}>${icon('wind')}Dash</button>
        <button class="btn sm ghost" type="button" data-action="tr-sound" aria-pressed="${S.settings().sound}">${icon('volume')}${S.settings().sound ? 'Sound on' : 'Sound off'}</button>
        <button class="btn sm ghost" type="button" data-action="tr-restart">${icon('refresh')}Restart</button>
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
    const ranked = [...st.racers].sort((a, b) => b.wpm - a.wpm || b.acc - a.acc);
    return `<div class="tr-results">
      <div class="podium tr-podium">${ranked.slice(0, 3).map((r, k) => `<div class="step p${k + 1}"><span class="critter ${k === 0 ? 'cheer' : 'idle'}">${critterSvg(r.critter)}</span><strong>${esc(r.name)}</strong><div class="block">${k + 1}</div></div>`).join('')}</div>
      <div class="tr-table">${ranked.map((r, k) => `<div class="tr-trow"><span class="tr-place">${k + 1}</span><span class="critter idle sm">${critterSvg(r.critter)}</span><span class="grow truncate">${esc(r.name)}</span><b class="num">${r.wpm}</b><small>wpm</small><span class="muted num">${r.acc}%</span></div>`).join('')}</div>
      ${track()}
      <div class="tr-actions"><button class="btn primary" type="button" data-action="tr-replay">${icon('play')}Replay race</button><button class="btn" type="button" data-action="tr-again">${icon('refresh')}Again</button><button class="btn" type="button" data-action="tr-setup">Players</button></div></div>`;
  }

  function render(): string {
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
      st.racers = st.players.map(p => ({ name: p.name, critter: p.critter, kind: 'player', samples: [], wpm: 0, acc: 100, played: false }));
    }
  }

  function begin() {
    stopLoop();
    st.test = T.createTest(st.secs * 1000, undefined, { punctuation: st.punct });
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
      const w = [...st.racers].sort((a, b) => b.wpm - a.wpm)[0]!;
      h.onFinish(`⌨️ ${w.name} won the typing race (${w.wpm} wpm)`);
      sound.win(); confetti();
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
    const added = T.ensureWords(t);
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
    if (!t || st.counting || !st.start) return;
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
    moveRacers(elapsed, typistIndex());
    if (elapsed >= t.durationMs) return finish();
    st.raf = requestAnimationFrame(loop);
  }

  function replay() {
    stopLoop();
    const dur = reducedMotion() ? 1 : 7000, total = st.secs * 1000, t0 = performance.now();
    st.prog = st.racers.map(() => 0); st.moved = st.racers.map(() => 0);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      moveRacers(k * total, null);
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
    els.critters = $$<HTMLElement>('.tr-road .critter', root as HTMLElement);
    if (st.phase === 'run' && st.test) {
      document.body.classList.add('typing-focus');
      els.input?.addEventListener('input', onInput);
      els.input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useDash(); } });
      if (st.start) { $('#tr-count')?.classList.add('gone'); $('#tr-text')?.classList.add('live'); els.input!.value = st.test.current; }
      requestAnimationFrame(() => { placeCaret(); if (st.start && !st.raf) loop(performance.now()); });
    } else if (st.phase === 'results' && st.mode === 'multi') {
      moveRacers(st.secs * 1000, null);
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
    'tr-critter': el => {
      const i = Number(el.dataset.i), next = (c: Critter) => CRITTERS[(CRITTERS.indexOf(c) + 1) % CRITTERS.length]!;
      if (i < 0) st.me = next(st.me); else if (st.players[i]) st.players[i]!.critter = next(st.players[i]!.critter);
      bus.refresh();
    },
    'tr-remove': el => { st.players.splice(Number(el.dataset.i), 1); bus.refresh(); },
    'tr-add': form => {
      const inp = form.querySelector<HTMLInputElement>('#tr-name')!, name = inp.value.trim().slice(0, 20);
      if (!name || st.players.length >= 4) return;
      const used = new Set(st.players.map(p => p.critter));
      st.players.push({ name, critter: CRITTERS.find(c => !used.has(c)) ?? 'chick' });
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
