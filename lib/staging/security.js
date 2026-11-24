/** Staging-only Supabase transport. No service-role key, implicit cookies, or demo-role fallback. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9._~-]{40,8192}$/;

export class SecurityError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function stagingConfiguration(env = process.env) {
  // Production NEVER enables these endpoints, even if somebody copied staging secrets.
  const preview = env.VERCEL_ENV === 'preview';
  const localTest = !env.VERCEL_ENV && env.NODE_ENV === 'test' && env.QSWIPE_STAGING_LOCAL_TEST === '1';
  if (env.QSWIPE_STAGING_ENABLED !== 'true' || !(preview || localTest)) {
    throw new SecurityError(503, 'STAGING_DISABLED');
  }
  const origin = env.QSWIPE_STAGING_SUPABASE_URL;
  const key = env.QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY;
  const stageRef = env.QSWIPE_STAGING_PROJECT_REF;
  const productionRef = env.QSWIPE_PRODUCTION_PROJECT_REF;
  const projectRef = /^[a-z0-9]{20}$/;
  if (!projectRef.test(stageRef ?? '') || !projectRef.test(productionRef ?? '') || stageRef === productionRef) {
    throw new SecurityError(503, 'STAGING_NOT_CONFIGURED');
  }
  let u;
  try { u = new URL(origin); } catch { throw new SecurityError(503, 'STAGING_NOT_CONFIGURED'); }
  if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname) ||
      u.hostname !== `${stageRef}.supabase.co` || u.port ||
      u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !/^sb_publishable_[a-zA-Z0-9_-]{12,}$/.test(key ?? '')) {
    throw new SecurityError(503, 'STAGING_NOT_CONFIGURED');
  }
  return Object.freeze({ origin: u.origin, key });
}

export function requireGet(req) {
  if (req.method !== 'GET') throw new SecurityError(405, 'METHOD_NOT_ALLOWED');
}

export function getBearer(req) {
  const authorization = req.headers?.authorization;
  const match = typeof authorization === 'string' && /^Bearer (\S+)$/.exec(authorization);
  if (!match || !TOKEN.test(match[1])) throw new SecurityError(401, 'INVALID_SESSION');
  return match[1];
}

export function validUuid(input) {
  if (typeof input !== 'string' || !UUID.test(input)) throw new SecurityError(400, 'INVALID_IDENTIFIER');
  return input.toLowerCase();
}

async function jsonFetch(url, options, fetchImpl) {
  let response;
  try { response = await fetchImpl(url, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) }); }
  catch { throw new SecurityError(503, 'AUTH_PROVIDER_UNAVAILABLE'); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new SecurityError(401, 'INVALID_SESSION');
    throw new SecurityError(502, 'STAGING_UPSTREAM_ERROR');
  }
  try { return await response.json(); } catch { throw new SecurityError(502, 'INVALID_UPSTREAM_RESPONSE'); }
}

export async function verifiedUser(config, jwt, fetchImpl = fetch) {
  const user = await jsonFetch(`${config.origin}/auth/v1/user`, {
    method: 'GET', headers: { apikey: config.key, Authorization: `Bearer ${jwt}`, Accept: 'application/json' }
  }, fetchImpl);
  if (!user || typeof user.id !== 'string' || !UUID.test(user.id) ||
      !user.email_confirmed_at || user.is_anonymous === true ||
      user.role !== 'authenticated') {
    throw new SecurityError(403, 'VERIFIED_IDENTITY_REQUIRED');
  }
  return { id: user.id }; // Never trust user_metadata or role claims for manager permissions.
}

export async function readRows(config, jwt, table, params, fetchImpl = fetch) {
  if (!/^qs_stg_[a-z_]+$/.test(table)) throw new SecurityError(500, 'INVALID_TABLE');
  const url = new URL(`/rest/v1/${table}`, config.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const rows = await jsonFetch(url, {
    method: 'GET', headers: {
      apikey: config.key, Authorization: `Bearer ${jwt}`,
      Accept: 'application/json', 'Accept-Profile': 'public'
    }
  }, fetchImpl);
  if (!Array.isArray(rows)) throw new SecurityError(502, 'INVALID_UPSTREAM_RESPONSE');
  return rows;
}

export async function activeMemberships(config, jwt, userId, fetchImpl = fetch) {
  const all = await readRows(config, jwt, 'qs_stg_memberships', {
    select: 'id,workspace_id,status,starts_at,ends_at',
    user_id: `eq.${validUuid(userId)}`, status: 'eq.active', limit: '30'
  }, fetchImpl);
  // The DB RLS is authoritative. These extra checks reduce accidental leaks in a misconfigured staging setup.
  const now = Date.now();
  const active = all.filter(m => UUID.test(m.id) && UUID.test(m.workspace_id) && m.status === 'active' &&
      (!m.starts_at || Date.parse(m.starts_at) <= now) && (!m.ends_at || Date.parse(m.ends_at) > now));
  if (!active.length) return [];
  const ids = [...new Set(active.map(m => m.workspace_id))];
  const visible = await readRows(config, jwt, 'qs_stg_workspaces', {
    select: 'id,status', id: `in.(${ids.join(',')})`, status: 'eq.active', limit: '30'
  }, fetchImpl);
  const allowed = new Set(visible.filter(w => w.status === 'active' && ids.includes(w.id)).map(w => w.id));
  return active.filter(m => allowed.has(m.workspace_id));
}

export function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Authorization');
  // No Access-Control-Allow-Origin header: protected API is same-origin only.
  res.end(JSON.stringify(data));
}

export function fail(res, error) {
  const status = error instanceof SecurityError ? error.status : 500;
  const code = error instanceof SecurityError ? error.code : 'UNEXPECTED_ERROR';
  respond(res, status, { error: code });
}
