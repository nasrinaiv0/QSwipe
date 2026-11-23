/** Duck race looks: catalog, deterministic defaults and validation. Rendering lives in src/ui/duck-art.ts. */
import { hashString } from './model';

export const DUCK_COLORS = ['classic', 'snow', 'mallard', 'bubblegum', 'sky', 'mint', 'tangerine', 'grape', 'midnight', 'gold'] as const;
export const DUCK_HATS = ['none', 'tophat', 'crown', 'party', 'cap', 'pirate', 'chef', 'viking', 'wizard', 'grad', 'flower', 'headphones'] as const;
export const DUCK_EYES = ['none', 'shades', 'nerd', 'hearts', 'monocle', 'patch', 'stars'] as const;
export const DUCK_NECKS = ['none', 'bowtie', 'scarf', 'medal', 'bandana', 'lei'] as const;

export type DuckColor = (typeof DUCK_COLORS)[number];
export type DuckHat = (typeof DUCK_HATS)[number];
export type DuckEyes = (typeof DUCK_EYES)[number];
export type DuckNeck = (typeof DUCK_NECKS)[number];
export interface DuckLook { color: DuckColor; hat: DuckHat; eyes: DuckEyes; neck: DuckNeck }

export const LOOK_SLOTS = { color: DUCK_COLORS, hat: DUCK_HATS, eyes: DUCK_EYES, neck: DUCK_NECKS } as const;
export const MAX_SAVED_LOOKS = 200;

/** Looks are saved by participant name, case-insensitively. */
export const duckKey = (name: string) => name.trim().toLocaleLowerCase().slice(0, 60);

export function defaultLook(name: string): DuckLook {
  return { color: DUCK_COLORS[hashString(duckKey(name)) % DUCK_COLORS.length]!, hat: 'none', eyes: 'none', neck: 'none' };
}

export function sanitizeLook(input: unknown): DuckLook | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | null => (list.includes(v as string) ? (v as T[number]) : null);
  const color = pick(DUCK_COLORS, o.color);
  if (!color) return null;
  return { color, hat: pick(DUCK_HATS, o.hat) ?? 'none', eyes: pick(DUCK_EYES, o.eyes) ?? 'none', neck: pick(DUCK_NECKS, o.neck) ?? 'none' };
}

export function sanitizeDucks(input: unknown): Record<string, DuckLook> {
  const out: Record<string, DuckLook> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input).slice(0, MAX_SAVED_LOOKS)) {
    const key = duckKey(k), look = sanitizeLook(v);
    if (key && look) out[key] = look;
  }
  return out;
}

/**
 * Looks for a line-up: saved looks are kept; everyone else gets their default colour,
 * shifted to the next unused colour when it clashes, so lanes stay distinguishable.
 */
export function raceLooks(names: string[], saved: Record<string, DuckLook>): DuckLook[] {
  const used = new Set<DuckColor>();
  for (const n of names) { const s = saved[duckKey(n)]; if (s) used.add(s.color); }
  return names.map(n => {
    const s = saved[duckKey(n)];
    if (s) return s;
    const look = defaultLook(n);
    if (used.size < DUCK_COLORS.length) {
      let i = DUCK_COLORS.indexOf(look.color);
      while (used.has(DUCK_COLORS[i]!)) i = (i + 1) % DUCK_COLORS.length;
      look.color = DUCK_COLORS[i]!;
    }
    used.add(look.color);
    return look;
  });
}

/** A random outfit: colour always, and each accessory slot filled about two-thirds of the time. */
export function randomLook(rand: (n: number) => number): DuckLook {
  const slot = <T extends readonly string[]>(list: T): T[number] => (rand(3) === 0 ? list[0]! : list[1 + rand(list.length - 1)]!);
  return { color: DUCK_COLORS[rand(DUCK_COLORS.length)]!, hat: slot(DUCK_HATS), eyes: slot(DUCK_EYES), neck: slot(DUCK_NECKS) };
}
