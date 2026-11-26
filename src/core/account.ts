/**
 * Local sign-in: one account per device, protected by a password hashed with PBKDF2-SHA256 (WebCrypto).
 * It keeps other people on a shared device out of the app; it is not a server account and does not encrypt data.
 */

export interface LocalAccount { name: string; salt: string; hash: string; iterations: number; createdAt: number }

export const ITERATIONS = 210_000;
export const MIN_PASSWORD = 6;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return b64(new Uint8Array(bits));
}

export async function createAccount(name: string, password: string, iterations = ITERATIONS): Promise<LocalAccount> {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (clean.length < 2) throw new Error('Enter your name.');
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { name: clean, salt: b64(salt), hash: await derive(password, salt, iterations), iterations, createdAt: Date.now() };
}

/** Constant-time comparison of the derived key. */
export async function verifyPassword(account: LocalAccount, password: string): Promise<boolean> {
  const got = await derive(password, unb64(account.salt), account.iterations);
  if (got.length !== account.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ account.hash.charCodeAt(i);
  return diff === 0;
}

export function sanitizeAccount(input: unknown): LocalAccount | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const ok = typeof o.name === 'string' && o.name.trim().length >= 2 && o.name.length <= 60
    && typeof o.salt === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(o.salt)
    && typeof o.hash === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(o.hash)
    && Number.isInteger(o.iterations) && (o.iterations as number) >= 100_000 && (o.iterations as number) <= 2_000_000;
  return ok ? { name: o.name as string, salt: o.salt as string, hash: o.hash as string, iterations: o.iterations as number, createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0 } : undefined;
}
