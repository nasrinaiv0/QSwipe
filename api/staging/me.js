import { stagingConfiguration, getBearer, requireGet, verifiedUser, activeMemberships, readRows, respond, fail } from '../../lib/staging/security.js';
export default async function handler(req, res) {
  try {
    requireGet(req);
    const config = stagingConfiguration();
    const jwt = getBearer(req);
    const user = await verifiedUser(config, jwt);
    const memberships = await activeMemberships(config, jwt, user.id);
    const ids = memberships.map(m => m.id);
    const grants = ids.length ? await readRows(config, jwt, 'qs_stg_role_assignments', {
      select: 'membership_id,scope_unit_id,role,starts_at,ends_at',
      membership_id: `in.(${ids.join(',')})`, limit: '300'
    }) : [];
    const now = Date.now();
    respond(res, 200, {
      userId: user.id,
      memberships: memberships.map(m => ({ id: m.id, workspaceId: m.workspace_id })),
      // Informational only. Every data read is re-authorized by database RLS.
      grants: grants.filter(g => ids.includes(g.membership_id) &&
        (!g.starts_at || Date.parse(g.starts_at) <= now) && (!g.ends_at || Date.parse(g.ends_at) > now))
        .map(g => ({ membershipId: g.membership_id, unitId: g.scope_unit_id, role: g.role }))
    });
  } catch (error) { fail(res, error); }
}
