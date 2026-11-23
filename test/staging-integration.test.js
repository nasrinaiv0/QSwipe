/** Execute only with a dedicated, isolated QSwipe staging project and fictional accounts.
 * Uses read-only requests. CI deliberately SKIPS until staging fixtures are provisioned. */
import test from 'node:test';
import assert from 'node:assert/strict';
const required = ['QSWIPE_STAGING_TEST_URL','QSWIPE_STAGING_TEST_PUBLISHABLE_KEY',
  'QSWIPE_STAGING_TEST_TOKEN_MEMBER_A','QSWIPE_STAGING_TEST_TOKEN_MANAGER_A',
  'QSWIPE_STAGING_TEST_WORKSPACE_A','QSWIPE_STAGING_TEST_WORKSPACE_B'];
const enabled = process.env.QSWIPE_STAGING_INTEGRATION === '1' &&
  process.env.QSWIPE_STAGING_TEST_ISOLATED === 'YES' && required.every(k => Boolean(process.env[k]));
const URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;
async function query(table, params, jwt) {
  const url = new URL(`/rest/v1/${table}`, process.env.QSWIPE_STAGING_TEST_URL);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response = await fetch(url, {headers:{apikey:process.env.QSWIPE_STAGING_TEST_PUBLISHABLE_KEY,
    Authorization:`Bearer ${jwt}`,Accept:'application/json'}});
  assert.equal(response.status,200,`Staging query of ${table} failed with ${response.status}`);
  return response.json();
}

test('live stage membership and RLS deny a separate tenant, never reading real data', {skip:!enabled}, async()=>{
  assert.match(process.env.QSWIPE_STAGING_TEST_URL, URL_PATTERN);
  assert.notEqual(process.env.QSWIPE_STAGING_TEST_WORKSPACE_A,process.env.QSWIPE_STAGING_TEST_WORKSPACE_B);
  const opts = {workspace_id:`eq.${process.env.QSWIPE_STAGING_TEST_WORKSPACE_B}`,select:'id,workspace_id',limit:'20'};
  for(const token of [process.env.QSWIPE_STAGING_TEST_TOKEN_MEMBER_A,process.env.QSWIPE_STAGING_TEST_TOKEN_MANAGER_A]) {
    const memberships = await query('qs_stg_memberships',opts,token);
    assert.deepEqual(memberships,[],'Actor from org A saw org B membership');
    const roster = await query('qs_stg_roster_assignments',opts,token);
    assert.deepEqual(roster,[],'Actor from org A saw org B roster');
  }
});

test('live stage member cannot list other role assignments', {skip:!enabled}, async()=>{
  assert.match(process.env.QSWIPE_STAGING_TEST_URL, URL_PATTERN);
  const grants = await query('qs_stg_role_assignments',{select:'membership_id,role,scope_unit_id',limit:'100'},process.env.QSWIPE_STAGING_TEST_TOKEN_MEMBER_A);
  assert.deepEqual(grants,[], 'Member has an unexpected manager grant');
});
