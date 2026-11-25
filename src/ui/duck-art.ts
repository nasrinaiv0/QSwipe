/** Original SVG duck (side view, facing right) with colour palettes and costume layers. */
import type { DuckColor, DuckEyes, DuckHat, DuckLook, DuckNeck } from '../core/ducks';

interface Palette { label: string; body: string; wing: string; head?: string; beak: string; dark?: boolean; ring?: boolean }
export const COLOR_META: Record<DuckColor, Palette> = {
  classic: { label: 'Classic', body: '#ffd43b', wing: '#f2b705', beak: '#ff8a1f' },
  snow: { label: 'Snow', body: '#f8f8f4', wing: '#dcd8cc', beak: '#ffa62b' },
  mallard: { label: 'Mallard', body: '#b9a78d', wing: '#7a6650', head: '#1e8a5a', beak: '#e9c46a', ring: true },
  bubblegum: { label: 'Bubblegum', body: '#ffa6c9', wing: '#f472a8', beak: '#ff8a1f' },
  sky: { label: 'Sky', body: '#8ecbff', wing: '#5aa9f0', beak: '#ffb02e' },
  mint: { label: 'Mint', body: '#8ee6bd', wing: '#4fc792', beak: '#ff9f1c' },
  tangerine: { label: 'Tangerine', body: '#ffa94d', wing: '#f08c2b', beak: '#d9480f' },
  grape: { label: 'Grape', body: '#b197fc', wing: '#8b6cf2', beak: '#ffb02e' },
  midnight: { label: 'Midnight', body: '#3d4250', wing: '#272b34', beak: '#ffb347', dark: true },
  gold: { label: 'Gold', body: '#f7c948', wing: '#d4a017', beak: '#e8590c' },
};

export const HAT_LABELS: Record<DuckHat, string> = { none: 'None', tophat: 'Top hat', crown: 'Crown', party: 'Party', cap: 'Cap', pirate: 'Pirate', chef: 'Chef', viking: 'Viking', wizard: 'Wizard', grad: 'Graduate', flower: 'Flower', headphones: 'Headphones' };
export const EYES_LABELS: Record<DuckEyes, string> = { none: 'None', shades: 'Shades', nerd: 'Glasses', hearts: 'Hearts', monocle: 'Monocle', patch: 'Eye patch', stars: 'Stars' };
export const NECK_LABELS: Record<DuckNeck, string> = { none: 'None', bowtie: 'Bow tie', scarf: 'Scarf', medal: 'Medal', bandana: 'Bandana', lei: 'Flower lei' };

const BODY = 'M7 33C7 25 15 21 26 22C31 22.5 35 24 39 25C46 25.5 51 29.5 51 35C51 43 43 48 30 48C17 48 7 43 7 33Z';
const TAIL = 'M11 34C6 31 3 26 2 20C6 22.5 9.5 25 12.5 27Z';

const HATS: Record<DuckHat, string> = {
  none: '',
  tophat: '<g transform="rotate(-8 44 7)"><rect x="36" y="-9" width="16" height="18" rx="1.6" fill="#1f1f24"/><rect x="36" y="2.5" width="16" height="3.2" fill="#c0392b"/><rect x="32.5" y="7.8" width="23" height="3.2" rx="1.6" fill="#1f1f24"/><rect x="38" y="-7.5" width="2.2" height="9" rx="1" fill="#fff" opacity=".18"/></g>',
  crown: '<path d="M35 9.5V-1l4.5 5L44-4.5 48.5 4 53-1v10.5Z" fill="#f7c948" stroke="#c99a1d" stroke-width="1" stroke-linejoin="round"/><circle cx="44" cy="4.5" r="1.7" fill="#e63946"/><circle cx="39.3" cy="6.6" r="1.2" fill="#3a86ff"/><circle cx="48.7" cy="6.6" r="1.2" fill="#2a9d8f"/>',
  party: '<g transform="rotate(14 45 4)"><path d="M37 9 46-11.5 53.5 8Z" fill="#7c5cff"/><path d="M39.2 4 49.5 2.6 50.8 5.6 38 7.4ZM42.2-2.6 47.6-3.3 48.6-.6 41.2.4Z" fill="#ffd43b"/><circle cx="46" cy="-11.5" r="2.8" fill="#ff6b9a"/></g>',
  cap: '<path d="M34 10.5C34 1.5 54 1.5 54 10.5Z" fill="#e63946"/><path d="M50 9.3C56 8.6 61.5 9.4 63.5 11.2 58.5 12.4 53.5 12 50 11.3Z" fill="#b8202d"/><circle cx="44" cy="2.6" r="1.1" fill="#b8202d"/><path d="M38 9.5C38 6 40 3.6 43 3" stroke="#fff" stroke-width="1" opacity=".35" fill="none"/>',
  pirate: '<path d="M30.5 9.5C34 2 40-2 44-2S54 2 57.5 9.5C51 7 37 7 30.5 9.5Z" fill="#20242a"/><path d="M33 8.2C38 6.6 50 6.6 55 8.2" stroke="#d4a017" stroke-width="1" fill="none"/><circle cx="44" cy="2.6" r="1.9" fill="#f8f8f4"/><path d="M41 6l6-2.6M41 3.4l6 2.6" stroke="#f8f8f4" stroke-width=".9"/>',
  chef: '<path d="M36.5 10V3.5C33 2.5 32.3-3 35.8-5 36.8-9.2 41.6-10.2 44-7.2 46.4-10.2 51.2-9.2 52.2-5 55.7-3 55 2.5 51.5 3.5V10Z" fill="#fff" stroke="#d4d4d4" stroke-width=".9"/><path d="M36.5 6.5h15" stroke="#d4d4d4" stroke-width=".9"/>',
  viking: '<path d="M35.5 6C31 4.2 29 -1 30.2-6.5 32-2.4 34.2-.2 37.6 1.8ZM52.5 6C57 4.2 59-1 57.8-6.5 56-2.4 53.8-.2 50.4 1.8Z" fill="#f4ecd8" stroke="#cbbd99" stroke-width=".9"/><path d="M34.5 10.5C34.5 0 53.5 0 53.5 10.5Z" fill="#9aa3ad"/><rect x="34" y="8" width="20" height="3.2" rx="1.2" fill="#7b5a3c"/><circle cx="38" cy="9.6" r=".7" fill="#e9c46a"/><circle cx="44" cy="9.6" r=".7" fill="#e9c46a"/><circle cx="50" cy="9.6" r=".7" fill="#e9c46a"/>',
  wizard: '<path d="M35.5 9.5 47-14 54.5 9.5Z" fill="#2e3a87"/><ellipse cx="44.8" cy="9.6" rx="12.5" ry="2.6" fill="#232d6e"/><path d="m44.5-2 .8 1.7 1.8.2-1.4 1.2.4 1.8-1.6-.9-1.6.9.4-1.8L42 .0l1.8-.3ZM48.5 4.5l.5 1 1.1.2-.8.7.2 1.1-1-.6-1 .6.2-1.1-.8-.7 1.1-.2Z" fill="#ffd43b"/>',
  grad: '<path d="M38 4.5V9.5C41 11 47 11 50 9.5V4.5Z" fill="#2b2b31"/><path d="M31.5 3.5 44-2 56.5 3.5 44 8.8Z" fill="#1f1f24"/><path d="M44 3.3 54.5 4.8V11" stroke="#f7c948" stroke-width="1" fill="none"/><rect x="53.4" y="10.4" width="2.2" height="3.4" rx=".8" fill="#f7c948"/>',
  flower: '<g transform="translate(38 7.5)"><circle cy="-3" r="2.6" fill="#ff7eb6"/><circle cx="2.9" cy="-.9" r="2.6" fill="#ff7eb6"/><circle cx="1.8" cy="2.5" r="2.6" fill="#ff7eb6"/><circle cx="-1.8" cy="2.5" r="2.6" fill="#ff7eb6"/><circle cx="-2.9" cy="-.9" r="2.6" fill="#ff7eb6"/><circle r="1.9" fill="#ffd43b"/><path d="M4 2.5C7 2 9 3.5 9.5 5.5 7 5.8 5 4.6 4 2.5Z" fill="#40c057"/></g>',
  headphones: '<path d="M38.5 15C37.5 4.5 51 3 53 10.5" stroke="#2d2d33" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="39.6" cy="17.5" rx="3.6" ry="4.9" fill="#ef476f"/><ellipse cx="39.6" cy="17.5" rx="1.8" ry="3" fill="#c9184a"/>',
};

const EYES: Record<DuckEyes, string> = {
  none: '',
  shades: '<path d="M43.5 13 36.5 12" stroke="#111" stroke-width="1.3"/><rect x="43.4" y="11.2" width="8.8" height="5.6" rx="2.5" fill="#111"/><path d="M45 12.6h3" stroke="#fff" stroke-width=".9" opacity=".55" stroke-linecap="round"/>',
  nerd: '<path d="M44.2 13.4 36.5 12.4" stroke="#3d2b1f" stroke-width="1.2"/><circle cx="47.6" cy="14" r="3.5" fill="#fff" fill-opacity=".25" stroke="#3d2b1f" stroke-width="1.4"/>',
  hearts: '<path d="M44 13.2 36.5 12.2" stroke="#c9184a" stroke-width="1.1"/><path d="M47.6 18.2C45.8 16.8 43.6 15.2 43.6 13.2 43.6 11.5 45.6 10.7 47.6 12.4 49.6 10.7 51.6 11.5 51.6 13.2 51.6 15.2 49.4 16.8 47.6 18.2Z" fill="#ff4d7d" stroke="#c9184a" stroke-width=".8"/>',
  monocle: '<circle cx="47.6" cy="14" r="3.3" fill="#fff" fill-opacity=".2" stroke="#c9a227" stroke-width="1.2"/><path d="M47.6 17.3C46.6 23 43 26.5 39.5 26.5" stroke="#c9a227" stroke-width=".8" fill="none"/>',
  patch: '<path d="M44.5 12.4 37 9.6M50.5 12 54.5 9.6" stroke="#111" stroke-width="1"/><ellipse cx="47.6" cy="14" rx="3.2" ry="2.8" fill="#111"/>',
  stars: '<path d="M44 13.2 36.5 12.2" stroke="#7a5a00" stroke-width="1.1"/><path d="m47.6 9.8 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4Z" fill="#ffd43b" stroke="#7a5a00" stroke-width=".7" stroke-linejoin="round"/>',
};

const NECKS: Record<DuckNeck, string> = {
  none: '',
  bowtie: '<path d="M46 27.5 41 24.4v6.2ZM46 27.5l5-3.1v6.2Z" fill="#e63946"/><circle cx="46" cy="27.5" r="1.6" fill="#b8202d"/>',
  scarf: '<path d="M38.5 30C36.6 33.6 34 36.6 30.8 38.6L33.2 40C36.4 37.4 39 34.2 40.8 30.5Z" fill="#c62f3b"/><path d="M35.8 23.6C40 27.6 48 27.6 52.2 23.9L52.8 27.2C48.3 31.2 39.8 31.2 35.4 27.1Z" fill="#e63946"/><path d="M40 27.2v2.6M44 28v2.6M48 27.6v2.6" stroke="#fff" stroke-width="1" opacity=".55"/>',
  medal: '<path d="M41.5 24.2 44.5 31.5M50.5 24.2 47.5 31.5" stroke="#2a6fdb" stroke-width="2.2"/><circle cx="46" cy="33.6" r="3.2" fill="#f7c948" stroke="#c99a1d" stroke-width=".9"/><path d="m46 31.9.6 1.2 1.3.2-1 .9.3 1.3-1.2-.6-1.2.6.3-1.3-1-.9 1.3-.2Z" fill="#fff"/>',
  bandana: '<path d="M36.5 24C41 27 48 27 52.5 24L46.5 33Z" fill="#2a6fdb"/><circle cx="42" cy="26.4" r=".7" fill="#fff"/><circle cx="46" cy="27.4" r=".7" fill="#fff"/><circle cx="49.5" cy="26.2" r=".7" fill="#fff"/><circle cx="46" cy="30.2" r=".7" fill="#fff"/>',
  lei: [[37, 24.4], [39.4, 26.4], [42, 27.6], [44.8, 28], [47.6, 27.6], [50.2, 26.4], [52.4, 24.6]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${['#ff7eb6', '#ffd43b', '#4dabf7', '#ff922b'][i % 4]}"/>`).join(''),
};

/** Submerged belly (body below the waterline at y≈40.5), drawn without clip-path so moving ducks stay cheap to paint. */
const BELLY = 'M9.1 40.5H49.5C47.2 45 40.4 48 30 48S11.4 45 9.1 40.5Z';
const WAVE = 'M9.6 41.2Q12.6 40.1 15.6 41.2T21.6 41.2T27.6 41.2T33.6 41.2T39.6 41.2T45.6 41.2T49 41';

/** Renders a duck. `waterline` tints the submerged part of the body so it sits in the water. */
export function duckSvg(look: DuckLook, o: { waterline?: boolean; label?: string } = {}): string {
  const c = COLOR_META[look.color];
  const head = c.head ?? c.body;
  const eye = c.dark
    ? '<circle cx="47.6" cy="14" r="2.5" fill="#fff"/><circle cx="48" cy="14" r="1.5" fill="#111"/>'
    : '<circle cx="47.6" cy="14" r="2.1" fill="#1d1d1f"/><circle cx="48.3" cy="13.3" r=".7" fill="#fff"/>';
  const shine = look.color === 'gold' ? '<path d="M14 30C19 25 27 24 33 25" stroke="#fff6c4" stroke-width="2" fill="none" opacity=".9" stroke-linecap="round"/>' : '';
  return `<svg viewBox="0 -14 68 70" ${o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"'} focusable="false">
    <path d="${TAIL}" fill="${c.wing}"/>
    <path d="${BODY}" fill="${c.body}"/>
    <ellipse cx="29" cy="28.5" rx="12" ry="3.4" fill="#fff" opacity="${c.dark ? 0.12 : 0.28}"/>${shine}
    <ellipse cx="42.5" cy="24.5" rx="7.5" ry="6.5" fill="${head}"/>
    <circle cx="44" cy="17" r="10" fill="${head}"/>
    ${c.ring ? '<path d="M36.8 24.3C40 26.8 46 26.8 50.2 24.6" stroke="#fff" stroke-width="1.8" fill="none"/>' : ''}
    <path d="M17 33C22 27 32 27.5 38 31.5 35 37.5 27 40 20 38.5 18 37 17 35 17 33Z" fill="${c.wing}"/>
    <path d="M23.5 34.2C27 33 31 33 34.5 34.2" stroke="#000" stroke-opacity=".12" stroke-width="1" fill="none"/>
    <path d="M52.5 15.5C57 14.4 62 15.4 64 17.6 62.4 19.9 58 21.6 52.5 21Z" fill="${c.beak}"/>
    <path d="M53 18.7C57 18.9 60 18.7 63.6 17.9" stroke="#000" stroke-opacity=".22" stroke-width=".8" fill="none"/>
    <circle cx="45" cy="21" r="2" fill="#ff8fa3" opacity="${c.dark ? 0.25 : 0.35}"/>
    ${eye}${NECKS[look.neck]}${EYES[look.eyes]}${HATS[look.hat]}
    ${o.waterline ? `<path d="${BELLY}" fill="#1c86b0" opacity=".42"/><path d="${WAVE}" stroke="#fff" stroke-width="1.1" opacity=".75" fill="none" stroke-linecap="round"/>` : ''}
  </svg>`;
}

export const lookLabel = (l: DuckLook) => [COLOR_META[l.color].label, l.hat !== 'none' ? HAT_LABELS[l.hat] : '', l.eyes !== 'none' ? EYES_LABELS[l.eyes] : '', l.neck !== 'none' ? NECK_LABELS[l.neck] : ''].filter(Boolean).join(', ') + ' duck';
