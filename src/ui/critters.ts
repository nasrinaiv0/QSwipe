/** Racers for the typing race: original, round little animals with small legs, drawn side-on facing right.
 *  Flat colours only; legs, body bob, ears and blinks are animated in CSS (see .critter). */

export const CRITTERS = ['chick', 'bunny', 'kitty', 'frog', 'bear', 'penguin', 'piggy'] as const;
export type Critter = (typeof CRITTERS)[number];

interface Look { label: string; body: string; belly: string; leg: string; cheek: string }
export const CRITTER_META: Record<Critter, Look> = {
  chick: { label: 'Chick', body: '#ffd84d', belly: '#fff3bf', leg: '#ff9f40', cheek: '#ff9eb1' },
  bunny: { label: 'Bunny', body: '#f3eee8', belly: '#ffffff', leg: '#e2d9cf', cheek: '#ffb3c4' },
  kitty: { label: 'Kitty', body: '#ffb066', belly: '#ffe3c4', leg: '#f09447', cheek: '#ff8f8f' },
  frog: { label: 'Frog', body: '#72d06f', belly: '#dbf5cc', leg: '#58b955', cheek: '#ff9eb1' },
  bear: { label: 'Bear', body: '#b98257', belly: '#ecd0b0', leg: '#9c6a44', cheek: '#ff9e9e' },
  penguin: { label: 'Penguin', body: '#34405f', belly: '#ffffff', leg: '#ff9f40', cheek: '#ff9eb1' },
  piggy: { label: 'Piggy', body: '#ffb3c6', belly: '#ffd6e1', leg: '#f394ad', cheek: '#ff7f9f' },
};

const INK = '#26262c';
const eye = (x: number, y: number) => `<g class="cr-eye"><ellipse cx="${x}" cy="${y}" rx="2.5" ry="2.9" fill="${INK}"/><circle cx="${x + .9}" cy="${y - 1}" r=".95" fill="#fff"/><circle cx="${x - .7}" cy="${y + 1.2}" r=".45" fill="#fff" opacity=".85"/></g>`;

const FEATURES: Record<Critter, (m: Look) => { back: string; front: string }> = {
  chick: m => ({ back: `<path d="M21 9c-1-4 2-6.5 4.5-5.5-1.8 1.3-1.8 3.3-.6 5Z" fill="${m.leg}"/>`, front: `<path d="M36.5 21.5q5 .5 6.5 2.5-1.5 2-6.5 2.5Z" fill="#ff9f40"/>` }),
  bunny: m => ({ back: `<g class="cr-ear"><ellipse cx="20" cy="6" rx="3.2" ry="8" transform="rotate(-14 20 6)" fill="${m.body}"/><ellipse cx="20" cy="7" rx="1.5" ry="5.5" transform="rotate(-14 20 7)" fill="#ffc2d1"/><ellipse cx="27" cy="5.5" rx="3.2" ry="8" transform="rotate(8 27 5.5)" fill="${m.body}"/><ellipse cx="27" cy="6.5" rx="1.5" ry="5.5" transform="rotate(8 27 6.5)" fill="#ffc2d1"/></g>`, front: `<ellipse cx="37.5" cy="24" rx="1.6" ry="1.2" fill="#ff8fa8"/>` }),
  kitty: m => ({ back: `<path d="M15 14 17 4l7 7ZM26 10l6-6 2 10Z" fill="${m.body}"/><path d="M17 11l1-4.5 3.4 3.4ZM28.5 9.5l3-3 1 4.6Z" fill="#ff9c8a"/>`, front: `<path d="M36 24.5h.01" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M38 26.5l5 1M38 25l5-1" stroke="${INK}" stroke-width=".7" stroke-linecap="round" opacity=".55"/>` }),
  frog: m => ({ back: `<circle cx="21" cy="11.5" r="5.4" fill="${m.body}"/><circle cx="31" cy="11.5" r="5.4" fill="${m.body}"/>`, front: `<path d="M30 27q4 3 8.5-.5" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` }),
  bear: m => ({ back: `<circle cx="16" cy="11.5" r="4.6" fill="${m.body}"/><circle cx="16" cy="11.5" r="2.3" fill="${m.belly}"/><circle cx="30" cy="10" r="4.6" fill="${m.body}"/><circle cx="30" cy="10" r="2.3" fill="${m.belly}"/>`, front: `<ellipse cx="36" cy="25.5" rx="4.4" ry="3.4" fill="${m.belly}"/><ellipse cx="38.6" cy="24.4" rx="1.5" ry="1.1" fill="${INK}"/>` }),
  penguin: () => ({ back: '', front: `<path d="M36.5 22q5 .8 6.5 2.6-1.5 1.8-6.5 2.4Z" fill="#ff9f40"/>` }),
  piggy: m => ({ back: `<path d="M17 12.5 18 6l5 5ZM27 10.5l5-4 .5 6.5Z" fill="${m.leg}"/>`, front: `<ellipse cx="38" cy="25" rx="3.6" ry="3" fill="#ff9ab4"/><ellipse cx="37" cy="25" rx=".7" ry="1" fill="#d9577a"/><ellipse cx="39.1" cy="25" rx=".7" ry="1" fill="#d9577a"/>` }),
};

export function critterSvg(kind: Critter, o: { label?: string } = {}): string {
  const m = CRITTER_META[kind], f = FEATURES[kind](m);
  const eyes = kind === 'frog' ? eye(23, 11.5) + eye(32.5, 11.5) : eye(31, 21);
  return `<svg class="critter-svg" viewBox="0 0 48 48" ${o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"'} focusable="false">
    <g class="cr-legs">
      <g class="cr-leg a"><rect x="17.5" y="32" width="4.6" height="9" rx="2.3" fill="${m.leg}"/><ellipse cx="21" cy="41.2" rx="3.4" ry="1.9" fill="${m.leg}"/></g>
      <g class="cr-leg b"><rect x="25.5" y="32" width="4.6" height="9" rx="2.3" fill="${m.leg}"/><ellipse cx="29" cy="41.2" rx="3.4" ry="1.9" fill="${m.leg}"/></g>
    </g>
    <g class="cr-body">
      ${f.back}
      <circle cx="24" cy="23" r="14.5" fill="${m.body}"/>
      <ellipse cx="25.5" cy="28" rx="9" ry="7.5" fill="${m.belly}"/>
      <ellipse class="cr-arm" cx="17" cy="27" rx="3" ry="5" transform="rotate(20 17 27)" fill="${m.leg}"/>
      <ellipse cx="33" cy="26.6" rx="2.4" ry="1.6" fill="${m.cheek}" opacity=".6"/>
      ${eyes}${f.front}
    </g>
    <g class="cr-speed" stroke="var(--muted)" stroke-width="1.4" stroke-linecap="round"><path d="M2 18h6M0 24h7M3 30h5"/></g>
  </svg>`;
}
