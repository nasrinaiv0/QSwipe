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
  // data-os picks the font (SF Pro on Apple, Roboto on Android, bundled Inter elsewhere);
  // data-ui picks the design language: Material 3 on Android, iOS everywhere else, unless the user chose one.
  const ua = navigator.userAgent, os = /Android/i.test(ua) ? 'android' : /Mac|iPhone|iPad|iPod/.test(ua) ? 'apple' : 'other';
  root.dataset.os = os;
  root.dataset.ui = s.platform === 'android' || (s.platform !== 'ios' && os === 'android') ? 'material' : 'ios';
  root.dataset.accent = typeof s.accent === 'string' && /^(green|teal|blue|violet|rose|amber)$/.test(s.accent) ? s.accent : 'green';
  if (s.density === 'comfortable') root.dataset.density = 'comfortable';
  if (s.textSize === 'large') root.dataset.text = 'large';
  if (s.glass === 'clear' || s.glass === 'tinted') root.dataset.glass = s.glass;
  if (s.motion === 'reduced' || (s.motion !== 'full' && mq('(prefers-reduced-motion: reduce)'))) root.dataset.motion = 'reduce';
})();
