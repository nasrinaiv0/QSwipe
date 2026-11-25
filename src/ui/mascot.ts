/** "Q", the QSwipe duck: an original front-facing mascot with moods, used in empty states, onboarding and results. */

export type Mood = 'hi' | 'happy' | 'think' | 'sleep' | 'cheer' | 'oops';

const Y = '#ffd43b', Y2 = '#f2b705', BEAK = '#ff8a1f', BEAK2 = '#d9480f', INK = '#1d1d1f';

const EYES: Record<Mood, string> = {
  hi: `<circle cx="50" cy="40" r="4.6" fill="${INK}"/><circle cx="70" cy="40" r="4.6" fill="${INK}"/><circle cx="51.6" cy="38.4" r="1.5" fill="#fff"/><circle cx="71.6" cy="38.4" r="1.5" fill="#fff"/>`,
  happy: `<path d="M45 42q5-7 10 0M65 42q5-7 10 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  think: `<circle cx="50" cy="40" r="4.6" fill="${INK}"/><circle cx="70" cy="40" r="4.6" fill="${INK}"/><circle cx="48.6" cy="38" r="1.5" fill="#fff"/><circle cx="68.6" cy="38" r="1.5" fill="#fff"/><path d="M64 31q6-3 11 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  sleep: `<path d="M45 41q5 4 10 0M65 41q5 4 10 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  cheer: `<path d="M45 42q5-8 10 0M65 42q5-8 10 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  oops: `<path d="M46 36l7 4-7 4M74 36l-7 4 7 4" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

const OPEN_BEAK = `<path d="M50 49q10-6 20 0q-10 4.5-20 0Z" fill="${BEAK}"/><path d="M52.5 51.5q7.5 11 15 0Z" fill="${BEAK2}"/><path d="M56 55q4 3 8 0" stroke="#ff8fa3" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const BEAKS: Record<Mood, string> = {
  hi: OPEN_BEAK,
  cheer: OPEN_BEAK,
  happy: `<path d="M50 49q10-6 20 0q-10 8-20 0Z" fill="${BEAK}"/><path d="M53 51.5q7 3 14 0" stroke="${BEAK2}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  think: `<path d="M52 50q9-5 17 1q-9 5-17-1Z" fill="${BEAK}"/>`,
  sleep: `<path d="M51 50q9-5 18 0q-9 6-18 0Z" fill="${BEAK}"/>`,
  oops: `<path d="M51 50q9-5 18 0q-9 6-18 0Z" fill="${BEAK}"/><path d="M53 55q3.5-2 7 0t7 0" stroke="${BEAK2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
};

const WING_DOWN_L = `<path d="M29 72c-9 3-12 13-8 21 7-2 12-9 13-17Z" fill="${Y2}"/>`;
const WING_DOWN_R = `<path d="M91 72c9 3 12 13 8 21-7-2-12-9-13-17Z" fill="${Y2}"/>`;
const WING_UP_L = `<path d="M30 70c-10-3-17-13-15-23 8 1 15 9 18 17Z" fill="${Y2}"/>`;
const WING_UP_R = `<path d="M90 70c10-3 17-13 15-23-8 1-15 9-18 17Z" fill="${Y2}"/>`;

const EXTRAS: Partial<Record<Mood, string>> = {
  think: '<g class="m-extra"><circle cx="94" cy="30" r="2.4" fill="var(--fill)"/><circle cx="100" cy="21" r="3.6" fill="var(--fill)"/><circle cx="106" cy="8" r="7.5" fill="var(--fill)"/><text x="106" y="11.5" font-size="10" font-weight="800" text-anchor="middle" fill="var(--ink-2)">?</text></g>',
  sleep: '<g class="m-extra m-zz" fill="var(--muted)" font-weight="800"><text x="88" y="24" font-size="11">z</text><text x="97" y="14" font-size="14">z</text></g>',
  cheer: '<g class="m-extra m-spark"><path d="M14 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#ffd43b"/><path d="M104 26l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" fill="var(--accent)"/><circle cx="22" cy="12" r="2.4" fill="#ff8fa3"/><circle cx="98" cy="8" r="2" fill="#4dabf7"/></g>',
  oops: '<path class="m-extra" d="M84 26q4 6 0 9q-4-3 0-9Z" fill="#74c0fc"/>',
};

export function mascot(mood: Mood = 'hi', o: { size?: number; label?: string } = {}): string {
  const up = mood === 'cheer', waveR = mood === 'hi';
  return `<svg class="mascot mood-${mood}" viewBox="0 0 120 120" width="${o.size ?? 96}" height="${o.size ?? 96}" ${o.label ? `role="img" aria-label="${o.label}"` : 'aria-hidden="true"'} focusable="false">
    <ellipse class="m-shadow" cx="60" cy="112" rx="28" ry="4.5" fill="#000" opacity=".1"/>
    <g class="m-body">
      <path d="M41 104c-6 0-10 3-10 6h20c0-3-4-6-10-6ZM79 104c-6 0-10 3-10 6h20c0-3-4-6-10-6Z" fill="${BEAK}"/>
      <ellipse cx="60" cy="80" rx="33" ry="28" fill="${Y}"/>
      <ellipse cx="60" cy="88" rx="21" ry="15" fill="#fff6c9" opacity=".75"/>
      <g class="m-wing-l">${up ? WING_UP_L : WING_DOWN_L}</g>
      <g class="m-wing-r">${up || waveR ? WING_UP_R : WING_DOWN_R}</g>
      <path d="M37 61c15 8 31 8 46 0l2.4 7.5c-16 9.5-34.8 9.5-50.8 0Z" fill="var(--accent)"/>
      <path d="M56 70l-3 12 7-4 7 4-3-12Z" fill="var(--accent)"/>
      <circle cx="60" cy="42" r="26" fill="${Y}"/>
      <path d="M58 17c-3-6 1-11 6-11-3 3-2 7 0 10Z" fill="${Y2}"/>
      <ellipse cx="40.5" cy="50" rx="5.2" ry="3.3" fill="#ff8fa3" opacity=".55"/><ellipse cx="79.5" cy="50" rx="5.2" ry="3.3" fill="#ff8fa3" opacity=".55"/>
      <g class="m-eyes">${EYES[mood]}</g>
      ${BEAKS[mood]}
    </g>
    ${EXTRAS[mood] ?? ''}
  </svg>`;
}

/** Picks a mood that suits an empty state's icon. */
export const moodFor = (iconName: string): Mood =>
  iconName === 'lock' ? 'oops' : iconName === 'clock' ? 'sleep' : iconName === 'users' || iconName === 'userPlus' ? 'hi' : 'think';
