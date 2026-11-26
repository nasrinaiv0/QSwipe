/** Material 3 touch ripple: a flat circle that grows from the touch point (only when the Android style is active). */
const SEL = '.btn, .chip, .seg button, .tab, .nav-item, .picker-item, .icon-btn, .search-btn, .me-btn, .choice, .ws-switch, .me-card, .settings-nav a, .theme-card, .preset, .option, .cell-btn, a.kpi, .rush-swatch, .look-opt, .quick-link, .type-key';

export function installRipple() {
  document.addEventListener('pointerdown', e => {
    if (document.documentElement.dataset.ui !== 'material' || e.button !== 0 || document.documentElement.dataset.motion === 'reduce') return;
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(SEL);
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
    const r = el.getBoundingClientRect(), size = Math.hypot(r.width, r.height) * 2;
    const box = document.createElement('span'), dot = document.createElement('span');
    box.className = 'ripple-box';
    dot.className = 'ripple';
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - r.left - size / 2}px`;
    dot.style.top = `${e.clientY - r.top - size / 2}px`;
    box.appendChild(dot);
    el.appendChild(box);
    dot.addEventListener('animationend', () => box.remove(), { once: true });
  }, { passive: true, capture: true });
}
