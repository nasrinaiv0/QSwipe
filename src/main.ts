import './styles.css';
import { bus } from './bus';
import { isoDate } from './core/model';
import { handleCode } from './qr/flows';
import { actions as shellActions, applyAppearance, commandPalette, PAGES, renderShell, shortcutsDialog } from './shell';
import * as S from './state/store';
import { $, animateMeters, closeDialog, countUp, hideTooltip, toast, withTransition } from './ui/kit';
import { attendance } from './views/attendance';
import { commitments } from './views/commitments';
import { previewBanner, type Handler, type View } from './views/common';
import { play } from './views/play';
import { reports } from './views/reports';
import { settingsView } from './views/settings';
import { team } from './views/team';
import { today } from './views/today';
import { updates } from './views/updates';
import { welcome } from './views/welcome';

const VIEWS: Record<string, View> = { today, attendance, commitments, reports, team, updates, play, settings: settingsView, welcome };
const ACTIONS: Record<string, Handler> = { ...shellActions };
const INPUTS: Record<string, Handler> = {};
for (const v of Object.values(VIEWS)) { Object.assign(ACTIONS, v.actions); Object.assign(INPUTS, v.inputs); }

let current: View | null = null;
const main = $('#main')!, app = $('#app')!, onboard = $('#onboard')!;

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function parseHash(): { page: string; sub: string } {
  const [page = '', ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  return { page, sub: rest.join('/') };
}

function onRoute() {
  const { page, sub } = parseHash();
  if (page === 'qr' && sub) {
    // Opened from a phone camera: route the code, then land on a normal page.
    history.replaceState(null, '', S.hasWorkspace() ? '#/today' : '#/welcome');
    render(true);
    void handleCode(sub).then(out => { if (out.result === 'retry') toast(out.message, { icon: 'alert', duration: 5000 }); });
    return;
  }
  const known = page === 'welcome' || PAGES.some(p => p.id === page);
  S.session.route = { page: known ? page : 'today', sub: known ? sub : '' };
  render(true);
}

export function navigate(page: string, sub = '') {
  const hash = `#/${page}${sub ? `/${sub}` : ''}`;
  if (location.hash === hash) render(true); else location.hash = hash;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function paint(animate: boolean) {
  const onboarding = !S.hasWorkspace() || S.session.route.page === 'welcome';
  const view = onboarding ? welcome : VIEWS[S.session.route.page] ?? today;
  if (current !== view) current?.unmount?.();
  current = view;
  app.hidden = onboarding;
  onboard.hidden = !onboarding;
  hideTooltip();
  if (onboarding) {
    main.replaceChildren();
    onboard.innerHTML = welcome.render('');
    welcome.mount?.(onboard, { initial: true });
    document.title = 'Welcome · QSwipe';
    return;
  }
  onboard.replaceChildren();
  renderShell();
  main.classList.toggle('static', !animate);
  main.innerHTML = `${previewBanner()}<div class="${animate ? 'page-enter' : ''}">${view.render(S.session.route.sub)}</div>`;
  view.mount?.(main, { initial: animate });
  countUp(main, animate);
  animateMeters(main);
}

function render(animate: boolean) {
  closeDialog(true);
  if (animate && 'startViewTransition' in document && document.documentElement.dataset.motion !== 'reduce') withTransition(() => paint(false));
  else paint(animate);
  if (animate) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!S.hasWorkspace()) return;
    main.focus({ preventScroll: true });
  }
}

/** Re-render the current page in place, keeping scroll position and focus. */
function refresh(o: { shell?: boolean; animate?: boolean } = {}) {
  if (o.animate) return render(true);
  const active = document.activeElement as HTMLElement | null;
  const key = active?.id ? `#${CSS.escape(active.id)}` : active?.dataset.focus ? `[data-focus="${CSS.escape(active.dataset.focus)}"]` : null;
  const sel = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : null;
  const y = window.scrollY;
  paint(false);
  window.scrollTo({ top: y, behavior: 'instant' });
  if (key) {
    const el = document.querySelector<HTMLElement>(key);
    el?.focus({ preventScroll: true });
    if (sel && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* not a text field */ }
  }
}

bus.refresh = refresh;
bus.navigate = navigate;

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const fn = ACTIONS[el.dataset.action!];
  if (!fn) return;
  if (el.tagName === 'A' && !el.getAttribute('href')?.startsWith('#/')) e.preventDefault();
  fn(el, e);
});
document.addEventListener('submit', e => {
  const form = (e.target as HTMLElement).closest<HTMLElement>('[data-submit]');
  if (!form) return;
  e.preventDefault();
  ACTIONS[form.dataset.submit!]?.(form, e);
});
for (const type of ['input', 'change'] as const) {
  document.addEventListener(type, e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(`[data-${type}]`);
    if (el) INPUTS[el.dataset[type]!]?.(el, e);
  });
}

let chord = 0;
document.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (S.hasWorkspace()) commandPalette(); return; }
  if (typing || mod || e.altKey || $<HTMLDialogElement>('#dialog')!.open || !S.hasWorkspace() || S.session.route.page === 'welcome') return;
  if (Date.now() - chord < 1200) {
    chord = 0;
    const p = PAGES.find(x => x.key === e.key.toLowerCase());
    if (p) { e.preventDefault(); navigate(p.id); }
    return;
  }
  if (e.key === 'g') { chord = Date.now(); return; }
  if (e.key === '/') { e.preventDefault(); commandPalette(); return; }
  if (e.key === '?') { e.preventDefault(); shortcutsDialog(); return; }
  if (e.key === 'q') { e.preventDefault(); ACTIONS.scan?.(document.body, e); return; }
  if (current?.onKey?.(e)) e.preventDefault();
});

window.addEventListener('hashchange', onRoute);
window.addEventListener('scroll', () => $('#topbar')?.classList.toggle('scrolled', window.scrollY > 4), { passive: true });
window.addEventListener('storage', e => { if (e.key === 'qswipe-v3') { S.load(); applyAppearance(); refresh({ shell: true }); } });
window.addEventListener('pagehide', () => S.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') S.flush();
  else if (S.session.today !== isoDate()) location.reload();
});
document.addEventListener('qswipe:storage-error', () => toast('This browser could not save. Storage may be full or disabled.', { icon: 'alert', duration: 6000 }));

S.load();
applyAppearance();
onRoute();
