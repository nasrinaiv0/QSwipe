import { stagingConfiguration, getBearer, requireGet, verifiedUser, activeMemberships, readRows, respond, fail, validUuid, SecurityError } from '../../lib/staging/security.js';
export default async function handler(req, res) {
  try {
    requireGet(req);
    const config = stagingConfiguration();
    const jwt = getBearer(req);
    const user = await verifiedUser(config, jwt);
    const url = new URL(req.url, 'https://qswipe.invalid');
    const workspaceId = validUuid(url.searchParams.get('workspace_id'));
    const memberships = await activeMemberships(config, jwt, user.id);
    if (!memberships.some(m => m.workspace_id === workspaceId)) throw new SecurityError(403, 'WORKSPACE_NOT_AUTHORIZED');
    const rows = await readRows(config, jwt, 'qs_stg_roster_assignments', {
      select: 'id,workspace_id,unit_id,display_name_snapshot,position_snapshot',
      workspace_id: `eq.${workspaceId}`, limit: '100'
    });
    respond(res, 200, { workspaceId, rows: rows.filter(r => r.workspace_id === workspaceId).slice(0, 100) });
  } catch (error) { fail(res, error); }
}
