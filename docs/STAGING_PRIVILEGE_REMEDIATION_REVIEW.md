# Staging-only privilege review — DO NOT EXECUTE WITHOUT APPROVAL

Supabase advisors flagged anonymous and authenticated EXECUTE grants for public.rls_auto_enable(). The observed production-candidate project has an event_trigger return type; direct RPC exploitability is not demonstrated. Do not run this against that project. Verify the corresponding function in a new, approved isolated staging project before using any SQL. No remote migration, SQL write, or configuration change has been performed by this PR.

## Read-only preflight on approved staging

```sql
select p.oid::regprocedure, p.proowner::regrole, p.prosecdef, p.proacl,
       pg_get_function_result(p.oid), p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='rls_auto_enable';
select evtname, evtenabled, evtfoid::regprocedure
from pg_event_trigger where evtfoid=to_regprocedure('public.rls_auto_enable()');
````

## Proposed transactional remediation (manual review only)

Confirm exact owner, zero arguments, return type, event-trigger dependencies, and vendor support before proceeding. Capture original ACL privately. Preserve the existing event trigger, owner and function body. No grant to PUBLIC should remain; check inherited privileges too. If the function is absent or managed permissions prevent revocation, stop and escalate rather than replacing it.

```sql
begin;
do $$
begin
  if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.rls_auto_enable()') and p.prorettype='event_trigger'::regtype and p.prosecdef)
    or not exists (select 1 from pg_event_trigger where evtfoid=to_regprocedure('public.rls_auto_enable()')) then
    raise exception 'Unexpected staging event trigger; stop and review';
  end if;
end $$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
do $$
begin
  if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Inherited EXECUTE remains; rollback and review';
  end if;
end $$;
-- Intentionally rollback in the review example. Commit only in a separately approved migration.
rollback;
````

Review the planned migration with the DB owner. In an isolated disposable database, test automatic RLS behavior on a fictional table and remove it; confirm advisors clear and application policies remain intact. Restore only captured original ACL if rollback is necessary; never blindly grant PUBLIC execution. Record exact migration hash, actor, target ref, backup/restore evidence and approval. No changes to the existing QSwipe project are authorized.

## Release protection (manual owner actions, not applied here)

- Protect main using required checks and independent review; disallow force pushes, branch deletion and bypass where available. Ensure stale approvals are dismissed and status checks bind to the tested head.
- Vercel preview environment must contain only approved staging references and publishable key; protect preview access. Production variables and domains remain untouched. Require approval before production deployment.
- Run secret scanning and dependency review, review OTP abuse limits, disable public signups and anonymous accounts in the isolated stage, require manager/admin MFA, and verify recovery/revocation. Use fictional tenants only.
