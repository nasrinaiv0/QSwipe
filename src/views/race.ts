/** Duck race: canvas water, dressable SVG ducks, countdown, live ranks, podium and a "cheer for" pick. */
import { bus } from '../bus';
import { DUCK_COLORS, DUCK_EYES, DUCK_HATS, DUCK_NECKS, raceLooks, randomLook, type DuckLook } from '../core/ducks';
import { raceFinishTimes, raceProgress, rollIndex } from '../core/games';
import * as S from '../state/store';
import { COLOR_META, duckSvg, EYES_LABELS, HAT_LABELS, lookLabel, NECK_LABELS } from '../ui/duck-art';
import { $, $$, closeDialog, confetti, dialogShell, esc, haptic, icon, openDialog, reducedMotion, sound, toast } from '../ui/kit';
import { Pond, type PondDuck } from '../ui/pond';

type Phase = 'idle' | 'countdown' | 'racing' | 'done';
type Slot = keyof DuckLook;
export interface RaceHooks { entries(): string[]; active(): boolean; scope(): string; onFinish(winner: string): void; needMore(title: string, body: string): string; resultActions(): string }

/** Waterline (y = 41 in the duck's -14…56 viewBox) as a fraction of the duck's height. */
const WATERLINE = 55 / 70;
const COUNT_STEP = 600;
const SLOTS: [Slot, string, readonly string[], (v: string) => string][] = [
  ['color', 'Duck', DUCK_COLORS, v => COLOR_META[v as DuckLook['color']].label],
  ['hat', 'Hat', DUCK_HATS, v => HAT_LABELS[v as DuckLook['hat']]],
  ['eyes', 'Eyewear', DUCK_EYES, v => EYES_LABELS[v as DuckLook['eyes']]],
  ['neck', 'Neck', DUCK_NECKS, v => NECK_LABELS[v as DuckLook['neck']]],
];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
const laneHeight = (n: number) => (n <= 6 ? 58 : n <= 10 ? 50 : n <= 16 ? 42 : 36);

export function createRace(h: RaceHooks) {
  const r = {
    phase: 'idle' as Phase, names: [] as string[], winner: -1, finish: [] as number[], shapes: [] as number[], wobble: [] as number[],
    order: [] as number[], countStart: 0, start: 0, crossed: new Set<number>(), backed: null as string | null,
  };
  const scene = {
    pond: null as Pond | null, raf: 0, visible: true, ro: null as ResizeObserver | null, io: null as IntersectionObserver | null,
    ducks: [] as HTMLElement[], prevX: [] as number[], lastT: 0, lastRank: 0, count: '',
  };
  const busy = () => r.phase === 'countdown' || r.phase === 'racing';

  /* ---------------------------------------------------------------- */
  /* Markup                                                            */
  /* ---------------------------------------------------------------- */

  function podium(names: string[], looks: DuckLook[]): string {
    const backedIdx = r.backed ? names.indexOf(r.backed) : -1;
    const place = backedIdx >= 0 ? r.order.indexOf(backedIdx) + 1 : 0;
    const pick = place === 1 ? `<p class="pick-line win">${icon('star')}Your pick won!</p>` : place ? `<p class="pick-line">${icon('star')}Your pick ${esc(r.backed!)} finished ${ordinal(place)}.</p>` : '';
    return `<div class="podium">${r.order.slice(0, 3).map((i, k) => `<div class="step p${k + 1}"><span class="podium-duck">${duckSvg(looks[i]!)}</span><strong>${esc(names[i]!)}</strong><div class="block">${k + 1}</div></div>`).join('')}</div>${pick}${h.resultActions()}`;
  }

  function render(): string {
    const names = h.entries();
    if (names.length < 2) return h.needMore('Add at least two racers', 'Each line becomes a duck. Tap a duck to choose its colour and costume.');
    if (r.phase !== 'idle' && names.join('\n') !== r.names.join('\n')) reset();
    if (r.backed && !names.includes(r.backed)) r.backed = null;
    const looks = raceLooks(names, S.ws().ducks);
    const done = r.phase === 'done', run = busy();
    return `<div class="race-wrap">
      <div class="race-head"><span>Tap a duck to dress it up</span><button class="btn sm ghost" type="button" data-action="duck-surprise" ${run ? 'disabled' : ''}>${icon('dice')}Outfits</button></div>
      <div class="pond" style="--lane-h:${laneHeight(names.length)}px;--lanes:${names.length}">
        <div class="dock">${names.map((n, i) => `<div class="dock-lane ${done && r.order[0] === i ? 'winner' : ''} ${r.backed === n ? 'backed' : ''}">
          <span class="lane-pos" id="lane-pos-${i}">${done ? r.order.indexOf(i) + 1 : ''}</span>
          <button class="dock-duck" type="button" data-action="duck-look" data-i="${i}" ${run ? 'disabled' : ''} aria-label="Choose duck and costume for ${esc(n)}. Now: ${esc(lookLabel(looks[i]!))}">${duckSvg(looks[i]!)}</button>
          <button class="lane-name" type="button" data-action="duck-cheer" data-i="${i}" aria-pressed="${r.backed === n}" aria-label="Cheer for ${esc(n)}" title="${esc(n)}" ${run ? 'disabled' : ''}><span>${esc(n)}</span>${icon('star')}</button>
        </div>`).join('')}</div>
        <div class="pond-water" id="pond-water"><canvas id="pond-canvas" aria-hidden="true"></canvas>
          ${looks.map((l, i) => `<div class="pond-duck" id="pond-duck-${i}">${duckSvg(l, { waterline: true })}</div>`).join('')}
          <div class="pond-count" id="pond-count" aria-live="assertive"></div>
        </div>
      </div></div>
      <div class="stage-result" role="status">${done ? podium(names, looks)
        : `<button class="btn primary lg" type="button" data-action="race-start" ${run ? 'disabled' : ''}>${icon('flag')}${run ? 'Racing…' : 'Start race'}</button><span class="hint">${run ? (r.backed ? `Go, <b>${esc(r.backed)}</b>!` : 'And they’re off!') : r.backed ? `Cheering for <b>${esc(r.backed)}</b>` : 'Tap a name to cheer'}</span>`}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Race flow                                                         */
  /* ---------------------------------------------------------------- */

  function start() {
    const names = h.entries();
    if (!h.active() || names.length < 2 || busy()) return;
    const winner = rollIndex(names.length);
    const finish = raceFinishTimes(names.length, winner);
    Object.assign(r, {
      phase: reducedMotion() ? 'racing' : 'countdown', names, winner, finish,
      shapes: names.map(() => 0.75 + Math.random() * 0.6), wobble: names.map(() => (Math.random() - 0.5) * 0.25),
      order: names.map((_, i) => i).sort((a, b) => finish[a]! - finish[b]!), countStart: performance.now(), crossed: new Set<number>(),
    });
    if (reducedMotion()) return finishRace();
    bus.refresh();
  }

  function finishRace() {
    if (!h.active() || !busy()) { reset(); return; }
    r.phase = 'done';
    h.onFinish(r.names[r.winner]!);
    haptic([20, 40, 20]);
    sound.win();
    const water = $('#pond-water')?.getBoundingClientRect();
    confetti(water ? { x: water.right - 40, y: water.top + water.height / 2 } : {});
    bus.refresh();
  }

  function reset(clearScope = false) {
    stopLoop();
    if (clearScope) { r.backed = null; r.names = []; r.finish = []; r.shapes = []; r.wobble = []; }
    r.phase = 'idle';
    r.winner = -1;
    r.order = [];
    r.crossed.clear();
  }

  function showCount(label: string) {
    const el = $('#pond-count');
    if (!el) return;
    el.textContent = label;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /* ---------------------------------------------------------------- */
  /* Animation loop                                                    */
  /* ---------------------------------------------------------------- */

  function frame(t: number, once = false) {
    if (!h.active() || scene.ducks.some(d => !d.isConnected)) { stopLoop(); return; }
    if (!once) scene.raf = requestAnimationFrame(tt => frame(tt));
    const pond = scene.pond;
    if (!pond || !scene.visible || document.hidden) return;
    const dt = scene.lastT ? Math.max(1, Math.min(50, t - scene.lastT)) : 16;
    scene.lastT = t;

    let started = false;
    if (r.phase === 'countdown') {
      const e = t - r.countStart, step = Math.floor(e / COUNT_STEP);
      const label = step < 3 ? String(3 - step) : 'GO!';
      if (label !== scene.count) { scene.count = label; showCount(label); if (label === 'GO!') sound.pop(); else sound.tick(); }
      if (e >= COUNT_STEP * 3) { r.phase = 'racing'; r.start = t; started = true; haptic(15); }
    }

    const n = scene.ducks.length, lh = pond.laneH, duckH = lh * 1.18, duckW = (duckH * 68) / 70;
    const startX = pond.startX - duckW * 0.08, endX = pond.width - pond.finishW - duckW * 0.95;
    const racing = r.phase === 'racing', done = r.phase === 'done';
    const out: PondDuck[] = [];
    const progress: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = racing ? raceProgress(t - r.start, r.finish[i]!, r.shapes[i], r.wobble[i]) : done ? 1 : 0;
      progress.push(p);
      const x = startX + p * Math.max(0, endX - startX);
      const speed = Math.max(0, (x - (scene.prevX[i] ?? x)) / dt);
      scene.prevX[i] = x;
      const bob = Math.sin(t * 0.0042 + i * 1.9) * (1.1 + Math.min(1.8, speed * 18));
      const tilt = Math.sin(t * 0.0031 + i * 0.7) * 2.2 - Math.min(7, speed * 26);
      const waterY = pond.top + i * lh + lh * 0.76;
      scene.ducks[i]!.style.transform = `translate3d(${x.toFixed(1)}px,${(waterY - duckH * WATERLINE + bob).toFixed(1)}px,0) rotate(${tilt.toFixed(2)}deg)`;
      const d = { stern: x + duckW * 0.1, bow: x + duckW * 0.93, y: waterY + bob * 0.25, speed };
      out.push(d);
      if (started) pond.splash(d.bow - 6, d.y, 0.55);
      if (racing && p >= 1 && !r.crossed.has(i)) {
        r.crossed.add(i);
        pond.splash(d.bow, d.y, i === r.winner ? 2 : 0.7);
        if (i === r.winner) { sound.pop(); haptic(25); }
      }
    }
    pond.draw(t, out);

    if (racing && t - scene.lastRank > 150) {
      scene.lastRank = t;
      progress.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i], k) => {
        const el = $(`#lane-pos-${i}`);
        if (el) el.textContent = String(k + 1);
      });
    }
    if (racing && (r.crossed.size === n || t - r.start > Math.max(...r.finish) + 600)) finishRace();
  }

  function stopLoop() {
    cancelAnimationFrame(scene.raf);
    scene.ro?.disconnect();
    scene.io?.disconnect();
    scene.ro = scene.io = null;
    scene.pond = null;
    scene.lastT = 0;
  }

  function mount(root: ParentNode) {
    stopLoop();
    const water = $('#pond-water', root);
    if (!water) return;
    scene.visible = true;
    scene.ducks = $$('.pond-duck', water);
    scene.prevX = [];
    scene.count = '';
    const pond = new Pond($<HTMLCanvasElement>('#pond-canvas', water)!, scene.ducks.length);
    scene.pond = pond;
    scene.ro = new ResizeObserver(() => { pond.resize(); if (reducedMotion()) frame(performance.now(), true); });
    scene.ro.observe(water);
    scene.io = new IntersectionObserver(es => { scene.visible = es.some(e => e.isIntersecting); });
    scene.io.observe(water);
    if (reducedMotion()) return frame(performance.now(), true);
    scene.raf = requestAnimationFrame(t => frame(t));
  }

  /** Stops the loop and abandons a race in progress (leaving the page or the tab). */
  function stop() {
    stopLoop();
    if (busy()) reset();
  }

  /* ---------------------------------------------------------------- */
  /* Outfit picker                                                     */
  /* ---------------------------------------------------------------- */

  function lookDialog(index: number) {
    const names = h.entries(), name = names[index], scope = h.scope();
    if (!name || busy()) return;
    let look: DuckLook = { ...raceLooks(names, S.ws().ducks)[index]! };
    let slot: Slot = 'color';
    const panel = () => {
      const [, , values, label] = SLOTS.find(s => s[0] === slot)!;
      return `<div class="look-grid" role="radiogroup" aria-label="${esc(slot)}">${values.map(v => {
        const preview: DuckLook = slot === 'color' ? { ...look, color: v as DuckLook['color'] } : { ...look, [slot]: v };
        return `<button class="look-opt" type="button" role="radio" aria-checked="${look[slot] === v}" data-value="${v}">${duckSvg(preview)}<small>${esc(label(v))}</small></button>`;
      }).join('')}</div>`;
    };
    const preview = () => `${duckSvg(look, { waterline: true, label: esc(lookLabel(look)) })}<span class="look-caption">${esc(lookLabel(look))}</span>`;
    const next = index + 1 < names.length ? index + 1 : -1;
    openDialog({
      label: `Dress up ${name}`, className: 'wide',
      html: dialogShell({
        title: `Dress up ${name}`,
        body: `<div class="look-layout"><div class="look-preview" id="look-preview">${preview()}</div>
          <div class="stack"><div class="seg block" role="tablist" aria-label="Costume part">${SLOTS.map(([k, l]) => `<button type="button" role="tab" data-slot="${k}" aria-selected="${k === slot}">${l}</button>`).join('')}</div>
          <div id="look-panel">${panel()}</div></div></div>`,
        foot: `<button class="btn ghost icon-only" type="button" id="look-random" aria-label="Surprise me" title="Surprise me">${icon('dice')}</button><span class="grow"></span><button class="btn" type="button" id="look-save">Save</button>${next >= 0 ? `<button class="btn primary" type="button" id="look-next">Save &amp; next ${icon('arrowRight')}</button>` : ''}`,
      }),
      onOpen: d => {
        const redraw = (all = false) => {
          $('#look-preview', d)!.innerHTML = preview();
          if (all) $('#look-panel', d)!.innerHTML = panel();
          else $$('.look-opt', d).forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === look[slot])));
        };
        d.addEventListener('click', e => {
          const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
          if (tab) {
            slot = tab.dataset.slot as Slot;
            $$('[data-slot]', d).forEach(b => b.setAttribute('aria-selected', String(b === tab)));
            return redraw(true);
          }
          const opt = (e.target as HTMLElement).closest<HTMLElement>('.look-opt');
          if (opt) {
            look = { ...look, [slot]: opt.dataset.value } as DuckLook;
            sound.tick();
            redraw(slot === 'color');
          }
        });
        const save = () => { if (!h.active() || h.scope() !== scope || !h.entries().includes(name)) { closeDialog(true); return false; } S.setDuckLook(name, look); closeDialog(true); bus.refresh(); return true; };
        $('#look-random', d)!.addEventListener('click', () => { look = randomLook(rollIndex); redraw(true); });
        $('#look-save', d)!.addEventListener('click', () => { if (save()) toast(`${name} is ready to race`, { icon: 'check' }); });
        $('#look-next', d)?.addEventListener('click', () => { if (save()) lookDialog(next); });
        $<HTMLElement>('.look-opt[aria-checked="true"]', d)?.focus();
      },
    });
  }

  const actions: Record<string, (el: HTMLElement) => void> = {
    'race-start': start,
    'duck-look': el => lookDialog(Number(el.dataset.i)),
    'duck-cheer': el => {
      const n = h.entries()[Number(el.dataset.i)];
      if (!n || busy()) return;
      r.backed = r.backed === n ? null : n;
      haptic(8);
      bus.refresh();
    },
    'duck-surprise': () => {
      if (busy()) return;
      for (const n of h.entries()) S.setDuckLook(n, randomLook(rollIndex));
      reset();
      bus.refresh();
      toast('New outfits for everyone', { icon: 'dice' });
    },
  };

  return { render, mount, stop, start, reset, busy, actions };
}
