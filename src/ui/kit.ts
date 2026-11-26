/** UI primitives: escaping, avatars, pills, toasts, dialogs, tooltips, motion and feedback. */
import { hueOf, initialsOf } from '../core/model';
import type { Commitment, Person, Status, Titles } from '../core/types';
import { settings } from '../state/store';
import { icon } from './icons';
import { mascot, moodFor, type Mood } from './mascot';

export const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce';
export const firstName = (name: string) => name.split(' ')[0] ?? name;
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export { icon };

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export function avatar(p: Person | undefined, size = '', opts: { status?: Status | null; round?: boolean; label?: boolean } = {}): string {
  if (!p) return '';
  const cls = `avatar ${size} ${opts.round ? 'round' : ''} h${hueOf(p.id)}`;
  const inner = p.photo
    ? `<span class="${cls}"><img src="${esc(p.photo)}" alt="${opts.label ? `Photo of ${esc(p.name)}` : ''}" decoding="async" draggable="false"></span>`
    : `<span class="${cls}" ${opts.label ? `role="img" aria-label="${esc(p.name)}"` : 'aria-hidden="true"'}>${esc(initialsOf(p.name))}</span>`;
  if (opts.status === undefined) return inner;
  return `<span class="avatar-wrap">${inner}<span class="status-dot ${opts.status ?? ''}" aria-hidden="true"></span></span>`;
}

export function statusPill(status: Status | undefined | null, compact = false): string {
  if (status === 'present') return `<span class="pill good status" title="Present">${icon('check')}${compact ? '' : 'Present'}</span>`;
  if (status === 'absent') return `<span class="pill bad status" title="Absent">${icon('x')}${compact ? '' : 'Absent'}</span>`;
  return `<span class="pill status" title="Unmarked">${icon('clock')}${compact ? '' : 'Unmarked'}</span>`;
}

export const COMMIT_META: Record<Commitment, { label: string; cls: string; icon: string; blurb: string }> = {
  confirmed: { label: 'Confirmed', cls: 'good', icon: 'check', blurb: 'I will be there' },
  risk: { label: 'At risk', cls: 'warn', icon: 'alert', blurb: 'Might not make it' },
  unavailable: { label: 'Unavailable', cls: 'bad', icon: 'x', blurb: 'I cannot attend' },
};
export function commitPill(c: Commitment | undefined): string {
  const m = c && COMMIT_META[c];
  return m ? `<span class="pill ${m.cls} status" title="${m.label}">${icon(m.icon)}${m.label}</span>` : `<span class="pill status" title="No reply">${icon('clock')}No reply</span>`;
}

export const levelChip = (p: Person, titles?: Titles) =>
  `<span class="level-chip l${p.level}" title="Level ${p.level}">${p.level === 3 ? icon('crown') : ''}L${p.level}${titles ? ` · ${esc(titles[p.level])}` : ''}</span>`;

export const fmtTime = (ts: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat(undefined, opts).format(new Date(`${iso}T12:00:00`));

/* ------------------------------------------------------------------ */
/* Meters                                                              */
/* ------------------------------------------------------------------ */

export function ring(pct: number | null, o: { size?: number; value?: string; sub?: string; color?: string } = {}): string {
  const { size = 110, value = pct === null ? '—' : `${pct}%`, sub = '', color = 'var(--accent)' } = o;
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct ?? 0));
  return `<div class="ring" style="--ring:${size}px" role="img" aria-label="${esc(sub || 'Progress')}: ${esc(value)}">
    <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="bar" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-ring-offset="${(c * (1 - p / 100)).toFixed(1)}" style="stroke:${color}"/></svg>
    <div class="center"><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
}

const nextFrame = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));
export function animateMeters(root: ParentNode) {
  const rings = $$<SVGCircleElement>('[data-ring-offset]', root), bars = $$('[data-width]', root);
  if (!rings.length && !bars.length) return;
  nextFrame(() => {
    rings.forEach(b => { b.style.strokeDashoffset = b.dataset.ringOffset!; });
    bars.forEach(b => { b.style.width = b.dataset.width!; });
  });
}

const lastCounts = new Map<string, number>();
export function countUp(root: ParentNode, fromZero = false) {
  for (const el of $$('[data-count]', root)) {
    const to = Number(el.dataset.count), key = el.dataset.countKey ?? '', suffix = el.dataset.suffix ?? '';
    const from = fromZero ? 0 : lastCounts.get(key) ?? to;
    if (key) lastCounts.set(key, to);
    if (!Number.isFinite(to) || from === to || reducedMotion()) { el.textContent = `${to}${suffix}`; continue; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      el.textContent = `${Math.round(from + (to - from) * (1 - (1 - t) ** 3))}${suffix}`;
      if (t < 1 && el.isConnected) requestAnimationFrame(step);
    };
    el.textContent = `${from}${suffix}`;
    requestAnimationFrame(step);
  }
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export function toast(message: string, o: { action?: { label: string; fn: () => void }; duration?: number; icon?: string; key?: string } = {}): () => void {
  const host = $('#toasts')!;
  const duration = o.duration ?? 3200;
  const el = document.createElement('div');
  el.className = 'toast';
  if (o.key) { host.querySelector(`[data-key="${o.key}"]`)?.remove(); el.dataset.key = o.key; }
  el.innerHTML = `${o.icon ? icon(o.icon) : ''}<span class="msg">${esc(message)}</span>${o.action ? `<button class="toast-action" type="button">${esc(o.action.label)}</button>` : ''}<button class="toast-close" type="button" aria-label="Dismiss">${icon('x')}</button>${o.action ? `<span class="toast-timer" style="animation-duration:${duration}ms"></span>` : ''}`;
  while (host.children.length >= 3) host.firstElementChild!.remove();
  host.append(el);
  let timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), reducedMotion() ? 0 : 220);
  }
  el.querySelector('.toast-close')!.addEventListener('click', dismiss);
  if (o.action) el.querySelector('.toast-action')!.addEventListener('click', () => { dismiss(); o.action!.fn(); });
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => { timer = setTimeout(dismiss, 1600); });
  return dismiss;
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

let cleanup: (() => void) | null = null;
let trigger: Element | null = null;

export function openDialog(o: { html: string; className?: string; label?: string; onOpen?: (d: HTMLDialogElement) => void; onClose?: () => void }): HTMLDialogElement {
  const dlg = $<HTMLDialogElement>('#dialog')!;
  if (dlg.open) closeDialog(true);
  trigger = document.activeElement;
  dlg.className = `dialog ${o.className ?? ''}`;
  dlg.setAttribute('aria-label', o.label ?? 'Dialog');
  dlg.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>${o.html}`;
  dlg.showModal();
  document.body.classList.add('no-scroll');
  const onCancel = (e: Event) => { e.preventDefault(); closeDialog(); };
  const onClick = (e: MouseEvent) => { if (e.target === dlg) closeDialog(); };
  dlg.addEventListener('cancel', onCancel);
  dlg.addEventListener('click', onClick);
  const undrag = sheetDrag(dlg);
  cleanup = () => { dlg.removeEventListener('cancel', onCancel); dlg.removeEventListener('click', onClick); undrag(); o.onClose?.(); };
  o.onOpen?.(dlg);
  return dlg;
}

/**
 * Phone sheets follow the finger when dragged by the grabber or header, and close when pulled down far or fast
 * enough; otherwise they spring back. Upward drags meet rubber-band resistance.
 */
function sheetDrag(dlg: HTMLDialogElement): () => void {
  const phone = matchMedia('(max-width: 760px)');
  let id = -1, y0 = 0, t0 = 0, dy = 0;
  const down = (e: PointerEvent) => {
    const t = e.target as Element;
    if (!phone.matches || e.button !== 0 || !t.closest('.sheet-grip, .dialog-head') || t.closest('button, a, input, select, textarea, label')) return;
    id = e.pointerId; y0 = e.clientY; t0 = e.timeStamp; dy = 0;
    t.setPointerCapture(id);
    dlg.classList.add('dragging');
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const d = e.clientY - y0;
    dy = d > 0 ? d : -Math.sqrt(-d) * 2;
    dlg.style.transform = `translateY(${dy}px)`;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    dlg.classList.remove('dragging');
    const speed = dy / Math.max(1, e.timeStamp - t0);
    if (e.type === 'pointerup' && (dy > dlg.offsetHeight * 0.28 || (dy > 24 && speed > 0.55))) closeDialog();
    else dlg.style.transform = '';
  };
  dlg.addEventListener('pointerdown', down);
  dlg.addEventListener('pointermove', move);
  dlg.addEventListener('pointerup', up);
  dlg.addEventListener('pointercancel', up);
  return () => {
    dlg.removeEventListener('pointerdown', down);
    dlg.removeEventListener('pointermove', move);
    dlg.removeEventListener('pointerup', up);
    dlg.removeEventListener('pointercancel', up);
    dlg.classList.remove('dragging');
  };
}

export function closeDialog(immediate = false) {
  const dlg = $<HTMLDialogElement>('#dialog')!;
  if (!dlg.open) return;
  const finish = () => {
    dlg.classList.remove('closing');
    dlg.style.transform = '';
    dlg.close();
    dlg.innerHTML = '';
    document.body.classList.remove('no-scroll');
    const c = cleanup; cleanup = null; c?.();
    if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  if (immediate || reducedMotion()) return finish();
  dlg.classList.add('closing');
  setTimeout(finish, 190);
}

export const dialogShell = (o: { title: string; sub?: string; body?: string; foot?: string }) =>
  `<div class="dialog-head"><div><h2 id="dialog-title">${esc(o.title)}</h2>${o.sub ? `<p>${esc(o.sub)}</p>` : ''}</div><button class="icon-btn plain" type="button" data-action="dialog-close" aria-label="Close">${icon('x')}</button></div>
  <div class="dialog-body">${o.body ?? ''}</div>${o.foot ? `<div class="dialog-foot">${o.foot}</div>` : ''}`;

export function confirmDialog(o: { title: string; body: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    let result = false;
    openDialog({
      label: o.title,
      html: dialogShell({ title: o.title, body: `<p class="ink-2">${esc(o.body)}</p>`, foot: `<button class="btn ghost" type="button" data-confirm="no">Cancel</button><button class="btn ${o.danger ? 'bad' : 'primary'}" type="button" data-confirm="yes">${esc(o.confirmLabel ?? 'Confirm')}</button>` }),
      onOpen: d => {
        $('[data-confirm="yes"]', d)!.focus();
        $$('[data-confirm]', d).forEach(b => b.addEventListener('click', () => { result = b.dataset.confirm === 'yes'; closeDialog(); }));
      },
      onClose: () => resolve(result),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

export function showTooltip(html: string, x: number, y: number) {
  const tt = $('#tooltip')!;
  tt.innerHTML = html;
  tt.classList.add('show');
  const r = tt.getBoundingClientRect();
  tt.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  tt.style.top = `${y - r.height - 12 < 8 ? y + 16 : y - r.height - 12}px`;
}
export const hideTooltip = () => $('#tooltip')?.classList.remove('show');

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function haptic(pattern: number | number[] = 12) {
  if (settings().haptics && 'vibrate' in navigator) try { navigator.vibrate(pattern); } catch { /* unsupported */ }
}

let audio: AudioContext | null = null;
function tone(freq: number, duration = 0.08, o: { type?: OscillatorType; gain?: number; delay?: number; to?: number } = {}) {
  if (!settings().sound) return;
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime + (o.delay ?? 0), osc = audio.createOscillator(), g = audio.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + duration);
    g.gain.setValueAtTime(o.gain ?? 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch { /* audio unavailable */ }
}
export const sound = {
  tick: () => tone(1400, 0.03, { type: 'square', gain: 0.02 }),
  pop: () => tone(660, 0.09, { type: 'triangle', gain: 0.07 }),
  wrong: () => tone(220, 0.14, { type: 'sawtooth', gain: 0.03 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.06, delay: i * 0.09 })),
  /* Typing race */
  key: () => tone(1500 + Math.random() * 400, 0.018, { type: 'square', gain: 0.012 }),
  miss: () => tone(170, 0.09, { type: 'square', gain: 0.03 }),
  word: () => tone(1180, 0.035, { type: 'sine', gain: 0.025 }),
  combo: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.1, { type: 'triangle', gain: 0.05, delay: i * 0.06 })),
  count: () => tone(660, 0.12, { gain: 0.06 }),
  go: () => tone(990, 0.26, { gain: 0.07 }),
  dash: () => tone(260, 0.28, { type: 'triangle', gain: 0.05, to: 1300 }),
};

export function confetti(o: { x?: number; y?: number; count?: number } = {}) {
  if (reducedMotion()) return;
  const { x = innerWidth / 2, y = innerHeight / 3, count = 100 } = o;
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const colors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9, v = 6 + Math.random() * 9;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.35, w: 5 + Math.random() * 6, h: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)]! };
  });
  const start = performance.now();
  const frame = (now: number) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - (now - start) / 2400);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (now - start < 2500) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

export function download(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads an image file, crops it square and downsizes it so profiles stay small in local storage. */
export function photoFromFile(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('That image is larger than 12 MB.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
      canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
    img.src = url;
  });
}

export const lockedPanel = (o: { title: string; need: string; body?: string }) =>
  `<div class="empty">${mascot('oops', { size: 84 })}<strong>${esc(o.title)}</strong><p>${esc(o.body ?? `Available to ${o.need} and above under this workspace's access policy.`)}</p>
  <div class="cluster"><a class="btn" href="#/team">${icon('hierarchy')}Team</a></div></div>`;

export const emptyState = (o: { icon: string; title: string; body: string; actions?: string; mood?: Mood }) =>
  `<div class="empty">${mascot(o.mood ?? moodFor(o.icon), { size: 84 })}<strong>${esc(o.title)}</strong><p>${esc(o.body)}</p>${o.actions ? `<div class="cluster">${o.actions}</div>` : ''}</div>`;

/** Runs a DOM update inside a View Transition when supported and motion is allowed. Interrupted transitions are harmless. */
export function withTransition(update: () => void) {
  if (!document.startViewTransition || reducedMotion()) return update();
  const vt = document.startViewTransition(update);
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
}

/**
 * iOS-style sliding selection. Animates the selected element's ::before "thumb" from where the previous selection
 * sat (segmented controls, the tab bar lens). Only horizontal moves within the same row animate.
 */
export function slideFrom(prev: DOMRect | null | undefined, el: Element | null | undefined) {
  if (!prev || !(el instanceof HTMLElement) || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  if (!r.width || Math.abs(prev.top - r.top) > 4 || (Math.abs(prev.left - r.left) < 1 && Math.abs(prev.width - r.width) < 1)) return;
  el.style.setProperty('--thumb-dx', `${prev.left - r.left}px`);
  el.style.setProperty('--thumb-sx', String(prev.width / r.width));
  el.classList.remove('thumb-move');
  void el.offsetWidth;
  el.classList.add('thumb-move');
  el.addEventListener('animationend', () => el.classList.remove('thumb-move'), { once: true });
}
