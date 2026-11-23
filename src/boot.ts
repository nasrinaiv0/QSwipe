// Inlined into <head> at build time (see vite.config.ts) so the saved theme applies before first paint.
(() => {
  const root = document.documentElement;
  let s: Record<string, unknown> = {};
  try {
    s = (JSON.parse(localStorage.getItem('qswipe-v3') ?? '{}') as { settings?: Record<string, unknown> }).settings ?? {};
  } catch {
    s = {};
  }
  const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
  const dark = s.theme === 'dark' || (s.theme !== 'light' && mq('(prefers-color-scheme: dark)'));
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = typeof s.accent === 'string' && /^(green|teal|blue|violet|rose|amber)$/.test(s.accent) ? s.accent : 'green';
  if (s.density === 'comfortable') root.dataset.density = 'comfortable';
  if (s.textSize === 'large') root.dataset.text = 'large';
  if (s.glass === 'clear' || s.glass === 'tinted') root.dataset.glass = s.glass;
  if (s.motion === 'reduced' || (s.motion !== 'full' && mq('(prefers-reduced-motion: reduce)'))) root.dataset.motion = 'reduce';
})();
