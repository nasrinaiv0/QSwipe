/** "Q", the QSwipe duckling: an original front-facing mascot with moods, used in empty states, onboarding and results.
 *  Flat colours only (no gradients, outlines or drop shadows); motion lives in CSS so reduced motion can stop it. */

export type Mood = 'hi' | 'happy' | 'think' | 'sleep' | 'cheer' | 'oops';

const Y = '#ffd84d', Y2 = '#f7c22e', BELLY = '#fff3bf', BEAK = '#ff9f40', BEAK2 = '#ef7a1f', INK = '#2b2b33', BLUSH = '#ff9eb1';

/** Big glossy eyes: a dark oval with two highlights. */
const eye = (x: number, dx = 0, dy = 0) =>
  `<ellipse cx="${x + dx}" cy="${52 + dy}" rx="5.6" ry="6.6" fill="${INK}"/><circle cx="${x + dx + 1.9}" cy="${49.6 + dy}" r="2.2" fill="#fff"/><circle cx="${x + dx - 1.6}" cy="${54.6 + dy}" r="1" fill="#fff" opacity=".85"/>`;
const arc = (x: number, up = true) => `<path d="M${x - 5.5} 53q5.5 ${up ? -7 : 5} 11 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;

const EYES: Record<Mood, string> = {
  hi: eye(47) + eye(73),
  happy: arc(47) + arc(73),
  think: eye(47, -1.5, -2) + eye(73, -1.5, -2) + `<path d="M67 40q6-3.5 12 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  sleep: arc(47, false) + arc(73, false),
  cheer: arc(47) + arc(73),
  oops: `<path d="M42 48l8 4.5-8 4.5M78 48l-8 4.5 8 4.5" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

const SMILE = `<path d="M53.5 62q6.5-4.5 13 0q-6.5 3.5-13 0Z" fill="${BEAK}"/><path d="M55.5 64q4.5 7.5 9 0Z" fill="${BEAK2}"/>`;
const BEAKS: Record<Mood, string> = {
  hi: SMILE,
  cheer: SMILE,
  happy: `<path d="M54 62q6-4.5 12 0q-6 6.5-12 0Z" fill="${BEAK}"/>`,
  think: `<path d="M55 63q5.5-4 11 .5q-5.5 4.5-11-.5Z" fill="${BEAK}"/>`,
  sleep: `<path d="M54.5 62.5q5.5-4 11 0q-5.5 5-11 0Z" fill="${BEAK}"/>`,
  oops: `<path d="M54.5 62.5q5.5-4 11 0q-5.5 5-11 0Z" fill="${BEAK}"/><path d="M55.5 68q2.25-1.6 4.5 0t4.5 0" stroke="${BEAK2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
};

const WING_L = `<ellipse cx="31" cy="88" rx="7.5" ry="11.5" transform="rotate(24 31 88)" fill="${Y2}"/>`;
const WING_R = `<ellipse cx="89" cy="88" rx="7.5" ry="11.5" transform="rotate(-24 89 88)" fill="${Y2}"/>`;
const WING_L_UP = `<ellipse cx="28" cy="74" rx="7.5" ry="11.5" transform="rotate(-40 28 74)" fill="${Y2}"/>`;
const WING_R_UP = `<ellipse cx="92" cy="74" rx="7.5" ry="11.5" transform="rotate(40 92 74)" fill="${Y2}"/>`;

const EXTRAS: Partial<Record<Mood, string>> = {
  think: '<g class="m-extra"><circle cx="96" cy="30" r="2.4" fill="var(--fill)"/><circle cx="102" cy="21" r="3.6" fill="var(--fill)"/><circle cx="108" cy="9" r="7.5" fill="var(--fill)"/><text x="108" y="12.5" font-size="10" font-weight="800" text-anchor="middle" fill="var(--ink-2)">?</text></g>',
  sleep: '<g class="m-extra m-zz" fill="var(--muted)" font-weight="800"><text x="90" y="26" font-size="11">z</text><text x="99" y="15" font-size="14">z</text></g>',
  cheer: '<g class="m-extra m-spark"><path d="M14 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#ffd43b"/><path d="M106 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" fill="var(--accent)"/><circle cx="22" cy="16" r="2.4" fill="#ff9eb1"/><circle cx="100" cy="12" r="2" fill="#74c0fc"/></g>',
  oops: '<path class="m-extra" d="M86 32q4.5 6.5 0 9.5q-4.5-3-0-9.5Z" fill="#74c0fc"/>',
};

export function mascot(mood: Mood = 'hi', o: { size?: number; label?: string } = {}): string {
  const up = mood === 'cheer', waveR = mood === 'hi';
  return `<svg class="mascot mood-${mood}" viewBox="0 0 120 120" width="${o.size ?? 96}" height="${o.size ?? 96}" ${o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"'} focusable="false">
    <g class="m-body">
      <ellipse cx="47" cy="111" rx="7" ry="4" fill="${BEAK}"/><ellipse cx="73" cy="111" rx="7" ry="4" fill="${BEAK}"/>
      <g class="m-wing-l">${up ? WING_L_UP : WING_L}</g>
      <g class="m-wing-r">${up || waveR ? WING_R_UP : WING_R}</g>
      <ellipse cx="60" cy="88" rx="28" ry="23" fill="${Y}"/>
      <ellipse cx="60" cy="94" rx="17" ry="12.5" fill="${BELLY}"/>
      <g class="m-head">
        <path d="M56 21c-2-6 1.5-10.5 6-10-2.5 2.5-2 6 .5 8.5ZM61.5 20c1-5 5-7.5 8.5-6-2.5 1.5-4 4-4.5 7Z" fill="${Y2}"/>
        <circle cx="60" cy="52" r="31" fill="${Y}"/>
        <ellipse cx="39.5" cy="62" rx="5.6" ry="3.6" fill="${BLUSH}" opacity=".6"/><ellipse cx="80.5" cy="62" rx="5.6" ry="3.6" fill="${BLUSH}" opacity=".6"/>
        <g class="m-eyes">${EYES[mood]}</g>
        ${BEAKS[mood]}
      </g>
      <path d="M40 80.5q20 9 40 0l1.6 6q-21.6 10-43.2 0Z" fill="var(--accent)"/>
    </g>
    ${EXTRAS[mood] ?? ''}
  </svg>`;
}

/** Picks a mood that suits an empty state's icon. */
export const moodFor = (iconName: string): Mood =>
  iconName === 'lock' ? 'oops' : iconName === 'clock' ? 'sleep' : iconName === 'users' || iconName === 'userPlus' ? 'hi' : 'think';
