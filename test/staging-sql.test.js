import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file=new URL('../supabase/migrations/20261123000000_qswipe_staging_identity_rbac.sql',import.meta.url);
const sql=readFileSync(file,'utf8');
const tables=['organizations','sites','workspaces','units','profiles','memberships','role_assignments','roster_assignments'];

test('migration is self-contained staging-only and all exposed tables have RLS',()=>{
  for (const t of tables){
    assert.match(sql,new RegExp(`create table public\\.qs_stg_${t}\\b`,'i'));
    assert.match(sql,new RegExp(`alter table public\\.qs_stg_${t} enable row level security`,'i'));
    assert.match(sql,new RegExp(`revoke all on public\\.qs_stg_${t} from public, anon, authenticated`,'i'));
  }
  assert.match(sql,/^begin;/m);assert.match(sql,/^commit;/m);
  assert.doesNotMatch(sql,/security\s+definer|grant\s+all\s+on|using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i);
});

test('roles cannot be mutated by authenticated clients, and memberships cannot be self-granted',()=>{
  assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete)[^;]*qs_stg_(?:role_assignments|memberships|roster_assignments)/i);
  assert.match(sql,/grant update \(display_name,position,bio\) on public\.qs_stg_profiles to authenticated/i);
  assert.match(sql,/for update to authenticated\s+using \(id = \(select auth\.uid\(\)\)/i);
  assert.match(sql,/with check \(id = \(select auth\.uid\(\)\)/i);
  assert.match(sql,/grant_row\.scope_unit_id = qs_stg_roster_assignments\.unit_id/i);
  assert.match(sql,/manager\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql,/own\.workspace_id = qs_stg_roster_assignments\.workspace_id/i);
  assert.match(sql,/qs_stg_no_revoked_reactivation/i);
  assert.match(sql,/is_anonymous/i);
});

test('no writes are introduced for real attendance without the later audited P3 transaction',()=>{
  assert.doesNotMatch(sql,/create table .*attendance_(?:current|events)/i);
  assert.doesNotMatch(sql,/create policy .*for (insert|update|delete) to authenticated using/i);
});


test('correlated RLS policies qualify OUTER row columns to prevent inner id capture',()=>{
  // PostgreSQL resolves ambiguous column names to the innermost query first.
  for(const [policy,outer] of [
    ['qs_stg_my_workspace','qs_stg_workspaces.id'],
    ['qs_stg_my_organization','qs_stg_organizations.id'],
    ['qs_stg_my_site','qs_stg_sites.id'],
    ['qs_stg_my_units','qs_stg_units.workspace_id']
  ]){
    const match=sql.match(new RegExp(`create policy ${policy}\\b[\\s\\S]*?;`,'i'));
    assert.ok(match,`Missing policy ${policy}`);
    assert.ok(match[0].includes(outer),`${policy} needs qualified outer ${outer}`);
  }
  assert.match(sql,/w\.site_id = qs_stg_sites\.id and w\.organization_id = qs_stg_sites\.organization_id/i);
  assert.doesNotMatch(sql,/m\.workspace_id = id\b|w\.organization_id = id\b|w\.site_id = id\b|w\.organization_id = organization_id\b|w\.id = workspace_id\b/i);
});
