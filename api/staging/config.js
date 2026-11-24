import { stagingConfiguration, requireGet, respond, fail } from '../../lib/staging/security.js';
export default async function handler(req, res) {
  try {
    requireGet(req);
    const { origin, key } = stagingConfiguration();
    respond(res, 200, { staging: true, onboardingEnabled: ['P3','P4','P5','P6','ADAPTER','ONBOARDING'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true'), adapterEnabled: ['P3','P4','P5','P6','ADAPTER'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true'), supabaseUrl: origin, publishableKey: key, securityEnabled: ['P3','P4','P5','P6'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true'), workspaceEnabled: ['P3','P4','P5'].every(p=>process.env['QSWIPE_STAGING_'+p+'_ENABLED']==='true') });
  } catch (error) { fail(res, error); }
}
