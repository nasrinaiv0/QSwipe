\set ON_ERROR_STOP on
-- Fixture runs only inside the disposable CI database.
begin;
create schema qs_test;
create function qs_test.id(prefix text, n integer) returns uuid language sql immutable as $$ select md5(prefix||n)::uuid $$;
create function qs_test.claims(n integer, aal text, anonymous boolean default false) returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',qs_test.id('user',n),'aal',aal,'is_anonymous',anonymous)::text,true)
$$;
grant usage on schema qs_test to authenticated;
insert into auth.users select qs_test.id('user',i) from generate_series(1,7)i;
insert into public.qs_stg_organizations(id,legal_name,industry)
 select qs_test.id('org',i),'Fictional org '||i,'bpo' from generate_series(1,2)i;
insert into public.qs_stg_sites(id,organization_id,name)
 select qs_test.id('site',i),qs_test.id('org',i),'Site '||i from generate_series(1,2)i;
insert into public.qs_stg_workspaces(id,organization_id,site_id,name)
 select qs_test.id('workspace',i),qs_test.id('org',i),qs_test.id('site',i),'Workspace '||i from generate_series(1,2)i;
insert into public.qs_stg_units(id,workspace_id,name)
 select qs_test.id('unit',i),qs_test.id('workspace',case when i=3 then 2 else 1 end),'Unit '||i from generate_series(1,3)i;
-- 1 manager, 2 own team, 3 other team, 4 other tenant, 5 revoked, 6 expired, 7 future.
insert into public.qs_stg_memberships(id,workspace_id,user_id,status,starts_at,ends_at)
 select qs_test.id('member',i),qs_test.id('workspace',case when i=4 then 2 else 1 end),qs_test.id('user',i),
 case when i=5 then 'revoked' else 'active' end,
 case when i=7 then now()+interval '1 day' else now()-interval '2 days' end,
 case when i=6 then now()-interval '1 day' else null end from generate_series(1,7)i;
insert into public.qs_stg_roster_assignments(id,membership_id,workspace_id,unit_id,display_name_snapshot,position_snapshot)
 select qs_test.id('roster',i),qs_test.id('member',i),qs_test.id('workspace',case when i=4 then 2 else 1 end),
 qs_test.id('unit',case when i=4 then 3 when i=3 then 2 else 1 end),'Fictional '||i,'Test role'
 from generate_series(1,7)i;
insert into public.qs_stg_role_assignments(membership_id,workspace_id,scope_unit_id,role)
 values(qs_test.id('member',1),qs_test.id('workspace',1),qs_test.id('unit',1),'level_1');
create function qs_test.expect_roster(expected text[]) returns void language plpgsql security invoker as $$
declare actual text[];
begin
 select coalesce(array_agg(display_name_snapshot order by display_name_snapshot),'{}'::text[]) into actual from public.qs_stg_roster_assignments;
 if actual is distinct from expected then raise exception 'Roster expected %, got %',expected,actual; end if;
end $$;
set local role authenticated;
select qs_test.claims(1,'aal1');
select qs_test.expect_roster(array['Fictional 1']);
do $$ begin if (select count(*) from public.qs_stg_role_assignments) <> 0 then raise exception 'AAL1 grant leaked'; end if; end $$;
select qs_test.claims(1,'aal2');
select qs_test.expect_roster(array['Fictional 1','Fictional 2']);
do $$ begin
 if (select count(*) from public.qs_stg_role_assignments) <> 1 then raise exception 'AAL2 grant missing'; end if;
 if qs_stg_private.roster_visible(qs_test.id('roster',3)) or qs_stg_private.roster_visible(qs_test.id('roster',4)) or qs_stg_private.roster_visible(qs_test.id('roster',5)) then raise exception 'Private predicate returned unauthorized scope'; end if;
 if has_table_privilege(current_user,'public.qs_stg_memberships','UPDATE') or has_table_privilege(current_user,'public.qs_stg_role_assignments','INSERT') then raise exception 'Unexpected write grant'; end if;
end $$;
select qs_test.claims(2,'aal2');
select qs_test.expect_roster(array['Fictional 2']);
select qs_test.claims(4,'aal2');
select qs_test.expect_roster(array['Fictional 4']);
select qs_test.claims(1,'aal2',true);
select qs_test.expect_roster(array[]::text[]);
select qs_test.claims(1,'aal2');
reset role;
update public.qs_stg_memberships set status='revoked' where user_id=qs_test.id('user',2);
set local role authenticated;
select qs_test.expect_roster(array['Fictional 1']);
reset role;
update public.qs_stg_units set status='suspended' where id=qs_test.id('unit',1);
set local role authenticated;
select qs_test.expect_roster(array[]::text[]);
reset role;
update public.qs_stg_units set status='active' where id=qs_test.id('unit',1);
update public.qs_stg_workspaces set status='suspended' where id=qs_test.id('workspace',1);
set local role authenticated;
select qs_test.expect_roster(array[]::text[]);
reset role;
update public.qs_stg_workspaces set status='active' where id=qs_test.id('workspace',1);
update public.qs_stg_memberships set status='revoked' where user_id=qs_test.id('user',1);
set local role authenticated;
select qs_test.expect_roster(array[]::text[]);
do $$ begin if (select count(*) from public.qs_stg_role_assignments) <> 0 then raise exception 'Revoked actor grant leaked'; end if; end $$;
reset role;
do $$ begin
 begin
  update public.qs_stg_memberships set status='active' where user_id=qs_test.id('user',1);
  raise exception 'Reactivation unexpectedly succeeded';
 exception when raise_exception then
  if sqlerrm <> 'revoked membership cannot be reactivated; create a new invitation' then raise; end if;
 end;
 if has_function_privilege('anon','qs_stg_private.roster_visible(uuid)','EXECUTE') or has_schema_privilege('authenticated','qs_stg_private','CREATE') or has_table_privilege('anon','public.qs_stg_roster_assignments','SELECT') then raise exception 'Unexpected privilege'; end if;
end $$;
rollback;
\echo 'QSwipe PostgreSQL authorization assertions passed'
