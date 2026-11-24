\set ON_ERROR_STOP on
begin;
create schema qs_p3_test;
create function qs_p3_test.id(prefix text,n integer) returns uuid language sql immutable as $$ select md5(prefix||n)::uuid $$;
create function qs_p3_test.claims(n integer,aal text,anonymous boolean default false) returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',qs_p3_test.id('user',n),'session_id',qs_p3_test.id('auth',n),'role','authenticated','aal',aal,'is_anonymous',anonymous)::text,true)
$$;
create function qs_p3_test.cmd(action text,slot integer,roster integer,request integer default null,expected integer default null,mark text default null,token text default null,reason text default null)
returns jsonb language sql security invoker as $$
 select public.qs_stg_p3_command(action,qs_p3_test.id('slot',slot),qs_p3_test.id('roster',roster),qs_p3_test.id('request',request),expected,mark,token,reason)
$$;
create function qs_p3_test.expect_error(want text,action text,slot integer,roster integer,request integer default null,expected integer default null,mark text default null,token text default null,reason text default null)
returns void language plpgsql security invoker as $$
begin
 begin
  perform qs_p3_test.cmd(action,slot,roster,request,expected,mark,token,reason);
  raise exception 'Expected command denial';
 exception when raise_exception then if sqlerrm<>want then raise; end if;
 end;
end $$;
grant usage on schema qs_p3_test to authenticated;
insert into auth.users(id,email_confirmed_at) select qs_p3_test.id('user',i),now() from generate_series(1,5)i;
insert into auth.sessions(id,user_id) select qs_p3_test.id('auth',i),qs_p3_test.id('user',i) from generate_series(1,5)i;
insert into public.qs_stg_organizations(id,legal_name,industry) select qs_p3_test.id('org',i),'Fictional org '||i,'bpo' from generate_series(1,2)i;
insert into public.qs_stg_sites(id,organization_id,name) select qs_p3_test.id('site',i),qs_p3_test.id('org',i),'Site '||i from generate_series(1,2)i;
insert into public.qs_stg_workspaces(id,organization_id,site_id,name) select qs_p3_test.id('workspace',i),qs_p3_test.id('org',i),qs_p3_test.id('site',i),'Workspace '||i from generate_series(1,2)i;
insert into public.qs_stg_units(id,workspace_id,name) select qs_p3_test.id('unit',i),qs_p3_test.id('workspace',case when i=3 then 2 else 1 end),'Unit '||i from generate_series(1,3)i;
insert into public.qs_stg_memberships(id,workspace_id,user_id,status,starts_at) select qs_p3_test.id('member',i),qs_p3_test.id('workspace',case when i=4 then 2 else 1 end),qs_p3_test.id('user',i),'active',now()-interval '1 day' from generate_series(1,5)i;
insert into public.qs_stg_roster_assignments(id,membership_id,workspace_id,unit_id,display_name_snapshot,position_snapshot)
 select qs_p3_test.id('roster',i),qs_p3_test.id('member',i),qs_p3_test.id('workspace',case when i=4 then 2 else 1 end),qs_p3_test.id('unit',case when i=4 then 3 when i=3 then 2 else 1 end),'Fictional '||i,'Test role' from generate_series(1,5)i;
insert into public.qs_stg_role_assignments(membership_id,workspace_id,scope_unit_id,role)
 select qs_p3_test.id('member',i),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',1),'level_1' from (values(1),(5)) v(i);
insert into qs_stg_private.attendance_sessions(id,workspace_id,unit_id,opens_at,closes_at)
 select qs_p3_test.id('slot',i),qs_p3_test.id('workspace',case when i=9 then 2 else 1 end),qs_p3_test.id('unit',case when i=8 then 2 when i=9 then 3 else 1 end),
 now()-interval '2 hours',case when i=7 then now()-interval '1 hour' else now()+interval '2 hours' end from generate_series(1,9)i;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.expect_error('QS_DISABLED','read',1,2);
reset role;
update qs_stg_private.p3_gate set enabled=true;
commit;
