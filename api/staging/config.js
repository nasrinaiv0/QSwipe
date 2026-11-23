import { stagingConfiguration, requireGet, respond, fail } from '../../lib/staging/security.js';
export default async function handler(req, res) {
  try {
    requireGet(req);
    const { origin, key } = stagingConfiguration();
    respond(res, 200, { staging: true, supabaseUrl: origin, publishableKey: key });
  } catch (error) { fail(res, error); }
}
