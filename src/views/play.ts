/** Team games: wheel, duck race, pick-a-card and trivia (team question bank + generated math). */
import { bus } from '../bus';
import { buildRound, parseEntries, raceFinishTimes, raceProgress, rollIndex, shuffled, sliceAtPointer, triviaCategories, wheelTarget, type RoundQuestion } from '../core/games';
import * as S from '../state/store';
import { $, $$, confetti, dialogShell, emptyState, esc, haptic, icon, openDialog, reducedMotion, ring, sound, toast } from '../ui/kit';
import { pageHead, type View } from './common';

const GAMES: [string, string, string][] = [['wheel', 'Wheel', 'wheel'], ['race', 'Duck race', 'flag'], ['cards', 'Pick a card', 'cards'], ['trivia', 'Trivia', 'bulb']];
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#0e7470', '#c0504d'];

interface Trivia { questions: RoundQuestion[]; index: number; picked: (number | null)[]; score: number; streak: number; best: number; done: boolean; deadline: number }
const g = {
  running: false, rotation: 0, winner: null as string | null, raf: 0,
  order: [] as string[], revealed: -1, revealAll: false, race: null as null | { winner: number; finish: number[] },
  trivia: null as Trivia | null, cat: 'Mixed', len: 10,
  history: [] as { game: string; text: string; at: number }[],
};

const game = () => (GAMES.some(x => x[0] === S.session.route.sub) ? S.session.route.sub : 'wheel');
const entries = () => parseEntries(S.ws().gameEntries);
function stop() { cancelAnimationFrame(g.raf); g.running = false; }
function record(text: string) { g.history.unshift({ game: game(), text, at: Date.now() }); g.history.length = Math.min(g.history.length, 8); }
function resetResult() { stop(); g.winner = null; g.revealed = -1; g.revealAll = false; g.race = null; }

/* ------------------------------------------------------------------ */
/* Participants panel                                                  */
/* ------------------------------------------------------------------ */

function participants(): string {
  const names = entries();
  return `<aside class="stack loose"><section class="card entries-box"><div class="card-head"><h2>${icon('users')}Participants</h2><span class="pill">${names.length} / 24</span></div>
    <div class="field"><label for="entries">One name or option per line</label><textarea class="input" id="entries" maxlength="2000" data-input="entries" ${g.running ? 'disabled' : ''}>${esc(S.ws().gameEntries)}</textarea></div>
    <div class="cluster" style="margin-top:8px"><button class="btn sm" type="button" data-action="use-team" ${g.running ? 'disabled' : ''}>${icon('users')}Use my team</button><button class="btn sm ghost" type="button" data-action="entries-shuffle" ${names.length < 2 || g.running ? 'disabled' : ''}>${icon('shuffle')}Shuffle</button><button class="btn sm ghost" type="button" data-action="entries-clear" ${!names.length || g.running ? 'disabled' : ''}>Clear</button></div>
    <div class="entry-chips" id="entry-chips" style="margin-top:10px">${names.map(n => `<span class="pill">${esc(n)}</span>`).join('')}</div></section>
    ${g.history.length ? `<section class="card"><div class="card-head"><h2>${icon('history')}Recent results</h2></div><div class="history">${g.history.map(h => `<div class="h-row"><span class="h-game">${icon(GAMES.find(x => x[0] === h.game)?.[2] ?? 'play')}</span><span class="grow truncate"><b>${esc(h.text)}</b></span><small class="muted">${new Date(h.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>`).join('')}</div></section>` : ''}</aside>`;
}

const needMore = (title: string, body: string) => emptyState({ icon: 'users', title, body, actions: `<button class="btn" type="button" data-action="use-team">${icon('users')}Use my team</button>` });

const resultActions = () => `<div class="cluster" style="justify-content:center"><button class="btn sm good" type="button" data-action="keep-entry">Keep for next round</button><button class="btn sm bad" type="button" data-action="remove-entry">Remove ${esc(g.winner ?? '')}</button></div>`;

/* ------------------------------------------------------------------ */
/* Wheel                                                               */
/* ------------------------------------------------------------------ */

function slicePath(i: number, n: number) {
  const r = 240, rad = (a: number) => ((a - 90) * Math.PI) / 180, a0 = (i * 360) / n, a1 = ((i + 1) * 360) / n;
  const p = (a: number) => `${(250 + r * Math.cos(rad(a))).toFixed(2)} ${(250 + r * Math.sin(rad(a))).toFixed(2)}`;
  return `M250 250L${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}Z`;
}

function wheel(): string {
  const names = entries(), n = names.length;
  if (n < 2) return needMore('Add at least two names', 'Type participants or options in the panel, or use your team roster.');
  const winIndex = g.winner ? names.indexOf(g.winner) : -1;
  const fs = n > 16 ? 11 : n > 10 ? 13 : 15;
  return `<div class="wheel-wrap"><svg class="wheel-pointer" id="pointer" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 44 2 8a15 15 0 1 1 30 0Z" fill="var(--ink)"/><circle cx="17" cy="14" r="5" fill="var(--surface)"/></svg>
    <svg class="wheel-svg ${winIndex >= 0 ? 'has-winner' : ''}" viewBox="0 0 500 500" role="img" aria-label="Wheel with ${n} entries"><g class="wheel-rotor" id="rotor" style="transform:rotate(${g.rotation}deg)">
      ${names.map((name, i) => {
        const mid = ((i + 0.5) * 360) / n;
        return `<g class="wheel-slice ${i === winIndex ? 'win' : ''}"><path d="${slicePath(i, n)}" fill="${COLORS[i % COLORS.length]}" stroke="#fff" stroke-width="2"/>
          <text class="wheel-slice-label" x="250" y="250" transform="rotate(${mid - 90} 250 250) translate(${n > 12 ? 150 : 140} 0)${mid > 180 ? ' rotate(180 250 250)' : ''}" fill="${i % COLORS.length === 3 ? '#1b1b1b' : '#fff'}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${esc(name.length > 16 ? `${name.slice(0, 15)}…` : name)}</text></g>`;
      }).join('')}</g></svg>
    <button class="wheel-hub" type="button" data-action="spin" aria-label="Spin the wheel" ${g.running ? 'disabled' : ''}><img src="./brand.svg" alt=""></button></div>
    <div class="stage-result" role="status">${g.winner ? `<span class="eyebrow">Selected</span><span class="winner">${esc(g.winner)}</span>${resultActions()}` : `<button class="btn primary lg" type="button" data-action="spin" ${g.running ? 'disabled' : ''}>${icon('wheel')}${g.running ? 'Spinning…' : 'Spin'}</button><span class="hint">or press Space</span>`}</div>`;
}

function spin() {
  const names = entries();
  if (names.length < 2 || g.running) return;
  const selected = rollIndex(names.length), n = names.length;
  const from = g.rotation, to = wheelTarget(from, selected, n, { offset: (rollIndex(61) - 30) / 100 });
  g.winner = null; g.running = true;
  bus.refresh();
  const rotor = $('#rotor'), pointer = $('#pointer');
  const dur = reducedMotion() ? 1 : 4800, start = performance.now();
  let lastSlice = sliceAtPointer(from, n);
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / dur), e = 1 - (1 - t) ** 4;
    g.rotation = from + (to - from) * e;
    if (rotor) rotor.style.transform = `rotate(${g.rotation}deg)`;
    const s = sliceAtPointer(g.rotation, n);
    if (s !== lastSlice) { lastSlice = s; sound.tick(); pointer?.classList.remove('tick'); void pointer?.getBoundingClientRect(); pointer?.classList.add('tick'); }
    if (t < 1) { g.raf = requestAnimationFrame(frame); return; }
    g.rotation = to % 360; g.running = false; g.winner = names[selected]!;
    record(g.winner);
    haptic([20, 40, 20]); sound.win(); confetti();
    bus.refresh();
  };
  g.raf = requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* Duck race                                                           */
/* ------------------------------------------------------------------ */

function race(): string {
  const names = entries();
  if (names.length < 2) return needMore('Add at least two racers', 'Each line becomes a lane.');
  const finished = g.race && !g.running;
  const order = g.race ? names.map((_, i) => i).sort((a, b) => g.race!.finish[a]! - g.race!.finish[b]!) : [];
  return `<div class="race ${g.running ? 'running' : ''}" id="race"><div class="race-head"><span>${names.length} lanes</span><span>Finish ▸</span></div>
    ${names.map((n, i) => `<div class="lane ${finished && order[0] === i ? 'winner' : ''}"><span class="pos" id="pos-${i}">${finished ? order.indexOf(i) + 1 : ''}</span><span class="lane-name" title="${esc(n)}">${esc(n)}</span><div class="track"><span class="wake" id="wake-${i}"></span><span class="finish"></span><span class="duck" id="duck-${i}" ${finished ? 'style="left:calc(100% - 48px)"' : ''}><span class="bob">🦆</span></span></div></div>`).join('')}</div>
    <div class="stage-result" role="status">${finished ? `<div class="podium">${order.slice(0, 3).map((i, k) => `<div class="step p${k + 1}"><strong>${esc(names[i]!)}</strong><div class="block">${k + 1}</div></div>`).join('')}</div>${resultActions()}`
      : `<button class="btn primary lg" type="button" data-action="race-start" ${g.running ? 'disabled' : ''}>${icon('flag')}${g.running ? 'Racing…' : 'Start race'}</button>`}</div>`;
}

function startRace() {
  const names = entries();
  if (names.length < 2 || g.running) return;
  const winner = rollIndex(names.length);
  g.race = { winner, finish: raceFinishTimes(names.length, winner) };
  const shapes = names.map(() => 0.75 + Math.random() * 0.6), wobble = names.map(() => (Math.random() - 0.5) * 0.25);
  g.running = true; g.winner = null;
  bus.refresh();
  const tracks = names.map((_, i) => $(`#duck-${i}`)!.parentElement!);
  const lens = tracks.map(t => t.clientWidth - 52);
  const total = reducedMotion() ? 1 : Math.max(...g.race.finish) + 200, start = performance.now();
  let lastRank = 0;
  const frame = (now: number) => {
    const t = now - start;
    const prog = names.map((_, i) => (reducedMotion() ? 1 : raceProgress(t, g.race!.finish[i]!, shapes[i], wobble[i])));
    prog.forEach((p, i) => {
      $(`#duck-${i}`)!.style.transform = `translateX(${p * lens[i]!}px)`;
      $(`#wake-${i}`)!.style.width = `${p * lens[i]!}px`;
    });
    if (now - lastRank > 150) {
      lastRank = now;
      const ranks = prog.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
      ranks.forEach(([, i], k) => { $(`#pos-${i}`)!.textContent = String(k + 1); });
    }
    if (t < total) { g.raf = requestAnimationFrame(frame); return; }
    g.running = false; g.winner = names[winner]!;
    record(`🏆 ${g.winner}`);
    haptic([20, 40, 20]); sound.win(); confetti();
    bus.refresh();
  };
  g.raf = requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* Pick a card                                                         */
/* ------------------------------------------------------------------ */

function cards(): string {
  const names = entries();
  if (names.length < 2) return needMore('Add at least two names', 'Each name becomes a face-down card.');
  const deck = g.order.length === names.length && g.order.every(n => names.includes(n)) ? g.order : names;
  return `<div class="card-table">${deck.slice(0, 24).map((n, i) => {
    const shown = g.revealed === i || g.revealAll;
    return `<button class="flip ${shown ? 'revealed' : ''} ${g.revealed >= 0 && !shown ? 'faded' : ''}" type="button" style="--i:${i}" data-action="flip" data-i="${i}" ${g.revealed >= 0 ? 'disabled' : ''} aria-label="${shown ? esc(n) : `Card ${i + 1}, face down`}">
      <span class="flip-inner"><span class="flip-face back"><img src="./brand.svg" alt=""><small>QSWIPE</small></span><span class="flip-face front"><strong>${esc(n)}</strong></span></span></button>`;
  }).join('')}</div>
  <div class="stage-result" role="status">${g.winner ? `<span class="eyebrow">You drew</span><span class="winner">${esc(g.winner)}</span><div class="cluster" style="justify-content:center"><button class="btn sm" type="button" data-action="cards-shuffle">${icon('shuffle')}Shuffle again</button><button class="btn sm ghost" type="button" data-action="cards-reveal">Reveal all</button></div>` : `<button class="btn primary" type="button" data-action="cards-shuffle">${icon('shuffle')}Shuffle deck</button><span class="hint">Then tap any card</span>`}</div>`;
}

/* ------------------------------------------------------------------ */
/* Trivia                                                              */
/* ------------------------------------------------------------------ */

function triviaSetup(): string {
  const bank = S.ws().trivia, cats = ['Mixed', 'Math', ...triviaCategories(bank)];
  return `<div class="trivia-card"><span class="eyebrow">Set up a round</span>
    <div class="field"><span class="label">Category</span><div class="cat-chips">${cats.map(c => `<button class="chip" type="button" data-action="trivia-cat" data-cat="${esc(c)}" aria-pressed="${g.cat === c}">${esc(c)}${c !== 'Mixed' && c !== 'Math' ? ` <span class="count">${bank.filter(q => q.category === c).length}</span>` : ''}</button>`).join('')}</div></div>
    <div class="field"><span class="label">Questions</span><div class="seg">${[5, 10, 15].map(n => `<button type="button" data-action="trivia-len" data-n="${n}" aria-pressed="${g.len === n}">${n}</button>`).join('')}</div></div>
    <div class="field"><span class="label">Timer per question</span><div class="seg">${([0, 15, 30] as const).map(n => `<button type="button" data-action="trivia-timer" data-n="${n}" aria-pressed="${S.settings().triviaTimer === n}">${n ? `${n}s` : 'Off'}</button>`).join('')}</div></div>
    ${bank.length ? '' : `<div class="notice">${icon('info')}<span>Your team's question bank is empty, so rounds use generated math questions.${canEditBank() ? ' Add your own questions to make it yours.' : ''}</span></div>`}
    <div class="cluster"><button class="btn primary lg" type="button" data-action="trivia-start">${icon('bulb')}Start round</button>${canEditBank() ? `<button class="btn" type="button" data-action="bank-open">${icon('list')}Question bank (${bank.length})</button>` : ''}</div>
    ${S.data.triviaBest ? `<p class="hint">Best score on this device: ${S.data.triviaBest}%</p>` : ''}</div>`;
}

function triviaPlay(t: Trivia): string {
  const q = t.questions[t.index]!, picked = t.picked[t.index];
  const answered = picked !== null && picked !== undefined;
  return `<div class="trivia-card"><div class="trivia-meta"><span class="eyebrow">Question ${t.index + 1} of ${t.questions.length} · ${esc(q.category)}</span><span class="cluster">${t.streak > 1 ? `<span class="streak">${icon('flame')}${t.streak}</span>` : ''}<span class="pill good">${t.score} correct</span></span></div>
    <div class="progress-dots">${t.questions.map((x, i) => `<span class="${i === t.index ? 'current' : t.picked[i] === undefined || t.picked[i] === null ? '' : t.picked[i] === x.answer ? 'right' : 'wrong'}"></span>`).join('')}</div>
    ${S.settings().triviaTimer && !answered ? '<div class="timer" id="timer"><span></span></div>' : ''}
    <h2 class="trivia-q">${esc(q.question)}</h2>
    <div class="options">${q.options.map((o, i) => `<button class="option ${answered ? (i === q.answer ? 'correct' : i === picked ? 'wrong' : 'muted-opt') : ''}" type="button" style="--i:${i}" data-action="trivia-answer" data-i="${i}" ${answered ? 'disabled' : ''}><span class="key">${i + 1}</span>${esc(o)}</button>`).join('')}</div>
    ${answered ? `<div class="between"><span class="${picked === q.answer ? 'pill good' : 'pill bad'}">${picked === q.answer ? 'Correct!' : picked === -1 ? `Time's up · ${esc(q.options[q.answer]!)}` : `Answer: ${esc(q.options[q.answer]!)}`}</span><button class="btn primary" type="button" data-action="trivia-next">${t.index + 1 === t.questions.length ? 'See results' : 'Next'} ${icon('arrowRight')}</button></div>` : '<p class="hint">Press 1–4 to answer.</p>'}</div>`;
}

function triviaResults(t: Trivia): string {
  const pct = Math.round((100 * t.score) / t.questions.length);
  return `<div class="results">${ring(pct, { size: 140, sub: `${t.score} of ${t.questions.length}` })}<h2>${pct === 100 ? 'Perfect round!' : pct >= 70 ? 'Great job!' : pct >= 40 ? 'Nice effort' : 'Keep practicing'}</h2>
    <p class="muted small">Best streak ${t.best} · best on this device ${Math.max(S.data.triviaBest, pct)}%</p>
    <div class="review">${t.questions.map((q, i) => { const ok = t.picked[i] === q.answer; return `<div class="review-item ${ok ? 'ok' : 'miss'}">${icon(ok ? 'check' : 'x')}<span><b>${esc(q.question)}</b><br><span class="muted">${ok ? '' : `You: ${esc(t.picked[i] === -1 ? 'no answer' : q.options[t.picked[i] ?? 0])} · `}Answer: ${esc(q.options[q.answer]!)}</span></span></div>`; }).join('')}</div>
    <div class="cluster" style="justify-content:center"><button class="btn primary" type="button" data-action="trivia-start">${icon('refresh')}Play again</button><button class="btn" type="button" data-action="trivia-quit">Change settings</button></div></div>`;
}

function answer(i: number) {
  const t = g.trivia;
  if (!t || t.done || (t.picked[t.index] !== null && t.picked[t.index] !== undefined)) return;
  t.picked[t.index] = i;
  const ok = i === t.questions[t.index]!.answer;
  if (ok) { t.score++; t.streak++; t.best = Math.max(t.best, t.streak); sound.pop(); haptic(10); } else { t.streak = 0; sound.wrong(); haptic([30, 30, 30]); }
  cancelAnimationFrame(g.raf);
  bus.refresh();
}

function next() {
  const t = g.trivia;
  if (!t || t.picked[t.index] === null || t.picked[t.index] === undefined) return;
  if (t.index + 1 >= t.questions.length) {
    t.done = true;
    const pct = Math.round((100 * t.score) / t.questions.length);
    record(`Trivia ${t.score}/${t.questions.length}`);
    S.setTriviaBest(pct);
    if (pct >= 70) confetti();
  } else { t.index++; t.deadline = Date.now() + S.settings().triviaTimer * 1000; }
  bus.refresh();
}

function runTimer() {
  const t = g.trivia, bar = $('#timer > span'), secs = S.settings().triviaTimer;
  if (!t || !bar || !secs) return;
  const frame = () => {
    const left = Math.max(0, t.deadline - Date.now());
    bar.style.transform = `scaleX(${left / (secs * 1000)})`;
    bar.parentElement!.classList.toggle('low', left < 4000);
    if (left <= 0) return answer(-1);
    g.raf = requestAnimationFrame(frame);
  };
  g.raf = requestAnimationFrame(frame);
}

const canEditBank = () => S.can('updates.post');

function bankDialog(editId?: string) {
  const bank = S.ws().trivia, q = bank.find(x => x.id === editId);
  openDialog({
    label: 'Question bank', className: 'wide',
    html: dialogShell({
      title: 'Question bank', sub: `${bank.length} team questions · used in Mixed rounds and their own categories`,
      body: `<form class="stack" id="q-form"><div class="form-grid"><div class="field span-2"><label for="q-text">Question</label><input class="input" id="q-text" maxlength="200" value="${esc(q?.question ?? '')}" required></div>
        <div class="field"><label for="q-cat">Category</label><input class="input" id="q-cat" maxlength="30" list="q-cats" value="${esc(q?.category ?? '')}" placeholder="e.g. Safety"><datalist id="q-cats">${triviaCategories(bank).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
        <div class="field"><span class="label">Options · select the correct one</span><div class="option-inputs">${[0, 1, 2, 3].map(i => `<label class="option-input"><input type="radio" name="q-ans" value="${i}" ${(q?.answer ?? 0) === i ? 'checked' : ''} aria-label="Option ${i + 1} is correct"><input class="input" id="q-o${i}" maxlength="80" value="${esc(q?.options[i] ?? '')}" placeholder="Option ${i + 1}"></label>`).join('')}</div></div>
        <p class="form-error" id="q-error" role="alert"></p>
        <div class="cluster">${q ? `<input type="hidden" id="q-id" value="${q.id}">` : ''}<button class="btn primary" type="submit">${q ? 'Save question' : `${icon('plus')}Add question`}</button>${q ? '<button class="btn ghost" type="button" id="q-new">New question</button>' : ''}</div></form>
        <div class="divider"></div>
        <div>${bank.map(x => `<div class="qbank-item"><span><strong>${esc(x.question)}</strong><small>${esc(x.category)} · ${esc(x.options[x.answer])}</small></span><span class="cluster"><button class="btn sm ghost icon-only" type="button" data-q-edit="${x.id}" aria-label="Edit">${icon('edit')}</button><button class="btn sm ghost icon-only" type="button" data-q-del="${x.id}" aria-label="Delete">${icon('trash')}</button></span></div>`).join('') || '<p class="muted small">No questions yet.</p>'}</div>`,
    }),
    onOpen: d => {
      $<HTMLInputElement>('#q-text', d)!.focus();
      $('#q-new', d)?.addEventListener('click', () => bankDialog());
      $$('[data-q-edit]', d).forEach(b => b.addEventListener('click', () => bankDialog(b.dataset.qEdit)));
      $$('[data-q-del]', d).forEach(b => b.addEventListener('click', () => { S.deleteQuestion(b.dataset.qDel!); bankDialog(); }));
      $('#q-form', d)!.addEventListener('submit', e => {
        e.preventDefault();
        const res = S.saveQuestion({ id: $<HTMLInputElement>('#q-id', d)?.value, question: $<HTMLInputElement>('#q-text', d)!.value, category: $<HTMLInputElement>('#q-cat', d)!.value, options: [0, 1, 2, 3].map(i => $<HTMLInputElement>(`#q-o${i}`, d)!.value), answer: Number($<HTMLInputElement>('input[name="q-ans"]:checked', d)?.value ?? 0) });
        if (!res.ok) { $('#q-error', d)!.textContent = res.error; return; }
        toast('Question saved', { icon: 'check' });
        bankDialog();
      });
    },
    onClose: () => bus.refresh(),
  });
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export const play: View = {
  render() {
    const id = game();
    const tabs = `<div class="play-tabs"><div class="seg" role="tablist" aria-label="Games">${GAMES.map(([k, l, ic]) => `<button type="button" role="tab" data-action="game-tab" data-game="${k}" aria-selected="${k === id}">${icon(ic)}${l}</button>`).join('')}</div></div>`;
    const t = g.trivia;
    const stage = id === 'wheel' ? wheel() : id === 'race' ? race() : id === 'cards' ? cards() : !t ? triviaSetup() : t.done ? triviaResults(t) : triviaPlay(t);
    return `${pageHead({ title: 'Play', lede: 'Fair, crypto-random picks and quick games for huddles, classes and meetings.' })}${tabs}
      ${id === 'trivia' ? `<section class="card"><div class="stage">${stage}</div></section>` : `<div class="play-layout"><section class="card"><div class="stage">${stage}</div></section>${participants()}</div>`}`;
  },
  mount() { if (game() === 'trivia' && g.trivia && !g.trivia.done) runTimer(); },
  unmount() { stop(); },
  onKey(e) {
    const id = game();
    if (e.key === ' ' && !e.repeat) { if (id === 'wheel') spin(); else if (id === 'race') startRace(); else return false; return true; }
    if (id === 'trivia' && g.trivia && !g.trivia.done) {
      if (/^[1-4]$/.test(e.key)) { answer(Number(e.key) - 1); return true; }
      if (e.key === 'Enter') { next(); return true; }
    }
    return false;
  },
  actions: {
    'game-tab': el => { stop(); resetResult(); bus.navigate('play', el.dataset.game!); },
    spin, 'race-start': startRace,
    'use-team': () => {
      const people = [S.me(), ...S.visiblePeople()];
      if (people.length < 2) return void toast('Your team has fewer than two people. Type names instead.');
      S.setGameEntries(people.map(p => p.name).join('\n'));
      resetResult(); bus.refresh();
    },
    'entries-shuffle': () => { S.setGameEntries(shuffled(entries()).join('\n')); resetResult(); bus.refresh(); },
    'entries-clear': () => { S.setGameEntries(''); resetResult(); bus.refresh(); },
    'keep-entry': () => { resetResult(); bus.refresh(); },
    'remove-entry': () => { const w = g.winner; S.setGameEntries(entries().filter(n => n !== w).join('\n')); resetResult(); bus.refresh(); },
    'cards-shuffle': () => {
      g.order = shuffled(entries()); g.revealed = -1; g.revealAll = false; g.winner = null;
      bus.refresh();
      $('#main')?.classList.toggle('static', false); // let the deal animation replay
    },
    'cards-reveal': () => { g.revealAll = true; bus.refresh(); },
    flip: el => {
      const names = entries(), deck = g.order.length === names.length ? g.order : names, i = Number(el.dataset.i);
      if (g.revealed >= 0) return;
      g.revealed = i; g.winner = deck[i] ?? null;
      if (g.winner) record(g.winner);
      haptic(15); sound.pop();
      el.classList.add('revealed');
      setTimeout(() => { bus.refresh(); confetti({ count: 60 }); }, reducedMotion() ? 0 : 650);
    },
    'trivia-cat': el => { g.cat = el.dataset.cat!; bus.refresh(); },
    'trivia-len': el => { g.len = Number(el.dataset.n); bus.refresh(); },
    'trivia-timer': el => { S.updateSettings({ triviaTimer: Number(el.dataset.n) as 0 | 15 | 30 }); bus.refresh(); },
    'trivia-start': () => {
      const questions = buildRound(S.ws().trivia, g.cat, g.len);
      if (!questions.length) return void toast('No questions in that category yet.');
      g.trivia = { questions, index: 0, picked: questions.map(() => null), score: 0, streak: 0, best: 0, done: false, deadline: Date.now() + S.settings().triviaTimer * 1000 };
      bus.refresh();
    },
    'trivia-answer': el => answer(Number(el.dataset.i)),
    'trivia-next': next,
    'trivia-quit': () => { stop(); g.trivia = null; bus.refresh(); },
    'bank-open': () => bankDialog(),
  },
  inputs: {
    entries: el => {
      S.setGameEntries((el as HTMLTextAreaElement).value);
      resetResult();
      const chips = $('#entry-chips');
      if (chips) chips.innerHTML = entries().map(n => `<span class="pill">${esc(n)}</span>`).join('');
      clearTimeout((el as HTMLElement & { _t?: number })._t);
      (el as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
        const stage = $('.stage');
        if (stage && !g.running) stage.innerHTML = game() === 'wheel' ? wheel() : game() === 'race' ? race() : cards();
        const pill = $('.entries-box .pill');
        if (pill) pill.textContent = `${entries().length} / 24`;
      }, 160);
    },
  },
};
