-- QSwipe P0–P2 staging schema. REVIEW ONLY: DO NOT APPLY TO MOVO, NASRINAI OR PRODUCTION.
-- Apply manually only to a newly created, isolated QSwipe STAGING Supabase project after approval.
-- Production deploy never depends on this migration.
-- Revised 2026-11-24: only for a fresh, isolated staging DB; do not replace an applied migration.
begin;

create table public.qs_stg_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  industry text not null check (industry in ('bpo','school','government','custom')),
  created_at timestamptz not null default now()
);

create table public.qs_stg_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.qs_stg_organizations(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  unique (id, organization_id)
);

create table public.qs_stg_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'Asia/Manila',
  status text not null default 'active' check (status in ('active','suspended')),
  foreign key (site_id, organization_id) references public.qs_stg_sites(id, organization_id),
  unique (id, organization_id)
);

create table public.qs_stg_units (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.qs_stg_workspaces(id) on delete restrict,
  parent_unit_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active','suspended')),
  check (parent_unit_id is distinct from id),
  unique (id, workspace_id),
  foreign key (parent_unit_id, workspace_id) references public.qs_stg_units(id, workspace_id)
);

create table public.qs_stg_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  position text not null check (char_length(position) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 240),
  updated_at timestamptz not null default now()
);

create table public.qs_stg_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.qs_stg_workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  check (ends_at is null or ends_at > starts_at),
  unique (id,workspace_id)
);

-- Rejoining after revocation uses a NEW membership ID so old scoped grants
-- cannot silently reactivate. Only one non-revoked membership is allowed.
create unique index qs_stg_one_current_membership
  on public.qs_stg_memberships(workspace_id,user_id) where status <> 'revoked';

create function public.qs_stg_no_revoked_reactivation() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'revoked membership cannot be reactivated; create a new invitation';
  end if;
  return new;
end;
$$;
create trigger qs_stg_membership_reactivation_guard
  before update on public.qs_stg_memberships
  for each row execute function public.qs_stg_no_revoked_reactivation();
revoke all on function public.qs_stg_no_revoked_reactivation() from public, anon, authenticated;

-- Each role row grants access to ONE explicitly listed unit. Subtree-wide grants must
-- be provisioned as reviewed per-unit rows; no implicit inherited manager access.
create table public.qs_stg_role_assignments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  workspace_id uuid not null,
  scope_unit_id uuid not null,
  role text not null check (role in ('level_1','level_2','level_3','org_admin')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references auth.users(id),
  check (ends_at is null or ends_at > starts_at),
  foreign key (membership_id,workspace_id) references public.qs_stg_memberships(id,workspace_id),
  foreign key (scope_unit_id,workspace_id) references public.qs_stg_units(id,workspace_id),
  unique (membership_id,scope_unit_id,role)
);

-- Minimal manager-visible roster projection. No email, bio, private profile photo,
-- verified legal name, school identifier or other sensitive fields.
create table public.qs_stg_roster_assignments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  workspace_id uuid not null,
  unit_id uuid not null,
  display_name_snapshot text not null check (char_length(display_name_snapshot) between 2 and 60),
  position_snapshot text not null check (char_length(position_snapshot) between 2 and 80),
  status text not null default 'active' check (status in ('active','inactive')),
  foreign key (membership_id,workspace_id) references public.qs_stg_memberships(id,workspace_id),
  foreign key (unit_id,workspace_id) references public.qs_stg_units(id,workspace_id),
  unique (membership_id,unit_id)
);

create index qs_stg_memberships_user_idx on public.qs_stg_memberships(user_id,workspace_id,status);
create index qs_stg_roles_member_idx on public.qs_stg_role_assignments(membership_id,scope_unit_id);
create index qs_stg_roster_unit_idx on public.qs_stg_roster_assignments(workspace_id,unit_id,status);

-- Explicit grants are necessary on modern Supabase projects; RLS is necessary on
-- every exposed table. No security-definer routines or RLS-bypassing views.
alter table public.qs_stg_organizations enable row level security;
alter table public.qs_stg_sites enable row level security;
alter table public.qs_stg_workspaces enable row level security;
alter table public.qs_stg_units enable row level security;
alter table public.qs_stg_profiles enable row level security;
alter table public.qs_stg_memberships enable row level security;
alter table public.qs_stg_role_assignments enable row level security;
alter table public.qs_stg_roster_assignments enable row level security;

revoke all on public.qs_stg_organizations from public, anon, authenticated;
revoke all on public.qs_stg_sites from public, anon, authenticated;
revoke all on public.qs_stg_workspaces from public, anon, authenticated;
revoke all on public.qs_stg_units from public, anon, authenticated;
revoke all on public.qs_stg_profiles from public, anon, authenticated;
revoke all on public.qs_stg_memberships from public, anon, authenticated;
revoke all on public.qs_stg_role_assignments from public, anon, authenticated;
revoke all on public.qs_stg_roster_assignments from public, anon, authenticated;

grant select on public.qs_stg_organizations, public.qs_stg_sites,
  public.qs_stg_workspaces, public.qs_stg_units, public.qs_stg_profiles,
  public.qs_stg_memberships, public.qs_stg_role_assignments,
  public.qs_stg_roster_assignments to authenticated;
-- An employee may change only their own presentation fields, never roles or units.
grant insert (id,display_name,position,bio) on public.qs_stg_profiles to authenticated;
grant update (display_name,position,bio) on public.qs_stg_profiles to authenticated;

-- Membership SELECT must be simple. Other policies consult it without recursion.
create policy qs_stg_own_active_membership on public.qs_stg_memberships
  for select to authenticated using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
    and status = 'active'
    and starts_at <= now() and (ends_at is null or ends_at > now())
  );

create policy qs_stg_own_active_role_grants on public.qs_stg_role_assignments
  for select to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2'
    and starts_at <= now() and (ends_at is null or ends_at > now())
    and exists (select 1 from public.qs_stg_units u
      where u.id = qs_stg_role_assignments.scope_unit_id
        and u.workspace_id = qs_stg_role_assignments.workspace_id and u.status = 'active')
    and exists (
      select 1 from public.qs_stg_memberships m
      where m.id = qs_stg_role_assignments.membership_id
        and m.workspace_id = qs_stg_role_assignments.workspace_id
        and m.user_id = (select auth.uid())
    )
  );

create policy qs_stg_my_workspace on public.qs_stg_workspaces
  for select to authenticated using (
    status = 'active' and exists (
      select 1 from public.qs_stg_memberships m
      where m.workspace_id = qs_stg_workspaces.id and m.user_id = (select auth.uid())
    )
  );

create policy qs_stg_my_organization on public.qs_stg_organizations
  for select to authenticated using (
    exists (select 1 from public.qs_stg_workspaces w
      where w.organization_id = qs_stg_organizations.id)
  );

create policy qs_stg_my_site on public.qs_stg_sites
  for select to authenticated using (
    exists (select 1 from public.qs_stg_workspaces w
      where w.site_id = qs_stg_sites.id and w.organization_id = qs_stg_sites.organization_id)
  );

create policy qs_stg_my_units on public.qs_stg_units
  for select to authenticated using (
    exists (select 1 from public.qs_stg_workspaces w
      where w.id = qs_stg_units.workspace_id and w.status = 'active')
  );

create policy qs_stg_own_profile on public.qs_stg_profiles
  for select to authenticated using (id = (select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true');
create policy qs_stg_create_own_profile on public.qs_stg_profiles
  for insert to authenticated with check (id = (select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true');
create policy qs_stg_update_own_profile on public.qs_stg_profiles
  for update to authenticated
  using (id = (select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true')
  with check (id = (select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true');

create policy qs_stg_scoped_roster on public.qs_stg_roster_assignments
  for select to authenticated using (
    status = 'active' and exists (select 1 from public.qs_stg_units u
      where u.id = qs_stg_roster_assignments.unit_id
        and u.workspace_id = qs_stg_roster_assignments.workspace_id and u.status = 'active')
    and exists (
      select 1 from public.qs_stg_workspaces active_workspace
      where active_workspace.id = qs_stg_roster_assignments.workspace_id
        and active_workspace.status = 'active'
    ) and (
      exists (select 1 from public.qs_stg_memberships own
        where own.id = qs_stg_roster_assignments.membership_id
          and own.workspace_id = qs_stg_roster_assignments.workspace_id
          and own.user_id = (select auth.uid()))
      or ((select auth.jwt()->>'aal') = 'aal2' and exists (
        select 1 from public.qs_stg_role_assignments grant_row
        join public.qs_stg_memberships manager on manager.id = grant_row.membership_id
            and manager.workspace_id = grant_row.workspace_id
        where manager.user_id = (select auth.uid())
          and grant_row.workspace_id = qs_stg_roster_assignments.workspace_id
          and grant_row.scope_unit_id = qs_stg_roster_assignments.unit_id
          and grant_row.role in ('level_1','level_2','level_3','org_admin')
      ))
    )
  );

comment on table public.qs_stg_role_assignments is
  'Staging-only explicit unit grants. Administration through trusted, audited backend only; no client write grants.';
comment on table public.qs_stg_roster_assignments is
  'Read-only staging roster projection. Attendance mutation is intentionally not implemented in P0-P2.';
commit;
