\set ON_ERROR_STOP on
begin;
do $$ begin if current_database()<>'qswipe_test' then raise exception 'Disposable DB only'; end if; end $$;
create function qs_p3_test.admin(op text,request integer,extra jsonb default '{}'::jsonb,workspace integer default 1,unit integer default 1) returns jsonb language sql security invoker as $$
 select public.qs_stg_onboarding_command(jsonb_build_object('action',op)||case when op='accept' then '{}'::jsonb else jsonb_build_object('workspaceId',qs_p3_test.id('workspace',workspace),'unitId',qs_p3_test.id('unit',unit)) end||case when op='list' then '{}'::jsonb else jsonb_build_object('requestId',qs_p3_test.id('onboard',request)) end||extra)
$$;
create function qs_p3_test.admin_error(want text,op text,request integer,extra jsonb default '{}'::jsonb,workspace integer default 1,unit integer default 1) returns void language plpgsql security invoker as $$
begin begin perform qs_p3_test.admin(op,request,extra,workspace,unit);raise exception 'Expected denial';exception when raise_exception then if sqlerrm<>want then raise;end if;end;end $$;
create function qs_p3_test.invite_payload(n integer,c text) returns jsonb language sql as $$ select jsonb_build_object('targetUserId',qs_p3_test.id('user',n),'code',repeat(c,64),'displayName','Fictional employee '||n,'position','Test role') $$;
create function qs_p3_test.shift_payload() returns jsonb language sql as $$ select jsonb_build_object('localStart',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+2,'YYYY-MM-DD')||'T22:00','localEnd',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+3,'YYYY-MM-DD')||'T06:00','startOffset',480,'endOffset',480) $$;
insert into auth.users(id,email_confirmed_at) select qs_p3_test.id('user',i),now() from generate_series(6,8)i;
insert into auth.sessions(id,user_id) select qs_p3_test.id('auth',i),qs_p3_test.id('user',i) from generate_series(6,8)i;
insert into public.qs_stg_role_assignments(membership_id,workspace_id,scope_unit_id,role) values(qs_p3_test.id('member',1),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',1),'level_3');
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.admin_error('QS_DISABLED','list',0);
reset role;
update qs_stg_private.onboarding_gate set enabled=true;
do $$ begin
 if qs_stg_private.shift_instant('2026-11-01T01:30',-240,'America/New_York')<>timestamptz '2026-11-01 05:30Z' or qs_stg_private.shift_instant('2026-11-01T01:30',-300,'America/New_York')<>timestamptz '2026-11-01 06:30Z' then raise exception 'DST fold wrong';end if;
 begin perform qs_stg_private.shift_instant('2026-03-08T02:30',-300,'America/New_York');raise exception 'Gap accepted';exception when raise_exception then if sqlerrm<>'QS_INVALID' then raise;end if;end;
 begin perform qs_stg_private.shift_instant('2026-11-24T22:00',0,'Asia/Manila');raise exception 'Wrong offset accepted';exception when raise_exception then if sqlerrm<>'QS_INVALID' then raise;end if;end;
end $$;
set local role authenticated;
select qs_p3_test.claims(1,'aal1');
select qs_p3_test.admin_error('QS_FORBIDDEN','invite',1,qs_p3_test.invite_payload(6,'a'));
select qs_p3_test.claims(5,'aal2');
select qs_p3_test.admin_error('QS_FORBIDDEN','list',0);
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.admin_error('QS_FORBIDDEN','list',0,'{}',1,2);
select qs_p3_test.admin_error('QS_FORBIDDEN','list',0,'{}',2,3);
select qs_p3_test.admin('schedule',100,qs_p3_test.shift_payload())->>'sessionId' as shift_id \gset
select set_config('qs.test.shift',:'shift_id',true);
select qs_p3_test.admin_error('QS_CONFLICT','schedule',101,qs_p3_test.shift_payload());
select qs_p3_test.admin('invite',1,qs_p3_test.invite_payload(6,'a'))->>'inviteId' as invite_id \gset
select set_config('qs.test.invite',:'invite_id',true);
do $$ begin if (qs_p3_test.admin('invite',1,qs_p3_test.invite_payload(6,'a'))->>'replayed')::boolean is distinct from true then raise exception 'Invite replay failed';end if;end $$;
select qs_p3_test.admin_error('QS_IDEMPOTENCY_CONFLICT','invite',1,qs_p3_test.invite_payload(6,'b'));
select qs_p3_test.admin_error('QS_CONFLICT','invite',2,qs_p3_test.invite_payload(6,'b'));
select qs_p3_test.admin('invite',3,qs_p3_test.invite_payload(7,'c'))->>'inviteId' as revoked_invite \gset
select qs_p3_test.admin('cancel_invite',4,jsonb_build_object('inviteId',:'revoked_invite'));
select qs_p3_test.admin('invite',5,qs_p3_test.invite_payload(8,'d'))->>'inviteId' as expired_invite \gset
reset role;
update qs_stg_private.employee_invites set issued_at=clock_timestamp()-interval '25 hours',expires_at=clock_timestamp()-interval '1 hour' where id=:'expired_invite';
set local role authenticated;
select qs_p3_test.claims(8,'aal1');
select qs_p3_test.admin_error('QS_FORBIDDEN','accept',6,jsonb_build_object('inviteId',:'expired_invite','code',repeat('d',64)));
select qs_p3_test.claims(7,'aal1');
select qs_p3_test.admin_error('QS_FORBIDDEN','accept',7,jsonb_build_object('inviteId',:'revoked_invite','code',repeat('c',64)));
select qs_p3_test.admin_error('QS_FORBIDDEN','accept',7,jsonb_build_object('inviteId',:'invite_id','code',repeat('a',64)));
select qs_p3_test.claims(6,'aal1');
select qs_p3_test.admin_error('QS_FORBIDDEN','accept',8,jsonb_build_object('inviteId',:'invite_id','code',repeat('b',64)));
select qs_p3_test.admin('accept',8,jsonb_build_object('inviteId',:'invite_id','code',repeat('a',64)))->>'rosterId' as new_roster \gset
select set_config('qs.test.roster',:'new_roster',true);
do $$ begin
 if (qs_p3_test.admin('accept',8,jsonb_build_object('inviteId',current_setting('qs.test.invite'),'code',repeat('a',64)))->>'replayed')::boolean is distinct from true then raise exception 'Accept replay failed';end if;
 begin perform public.qs_stg_p3_command('read',current_setting('qs.test.shift')::uuid,current_setting('qs.test.roster')::uuid,null,null,null,null,null);raise exception 'Late hire eligible';exception when raise_exception then if sqlerrm<>'QS_FORBIDDEN' then raise;end if;end;
end $$;
select qs_p3_test.admin_error('QS_FORBIDDEN','accept',9,jsonb_build_object('inviteId',:'invite_id','code',repeat('a',64)));
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.admin_error('QS_FORBIDDEN','suspend',10,jsonb_build_object('rosterId',qs_p3_test.id('roster',5)));
select qs_p3_test.admin('suspend',11,jsonb_build_object('rosterId',qs_p3_test.id('roster',2)));
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.expect_error('QS_FORBIDDEN','read',1,2);
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.admin('resume',12,jsonb_build_object('rosterId',qs_p3_test.id('roster',2)));
select qs_p3_test.admin('revoke',13,jsonb_build_object('rosterId',qs_p3_test.id('roster',2)));
select qs_p3_test.admin_error('QS_FORBIDDEN','resume',14,jsonb_build_object('rosterId',qs_p3_test.id('roster',2)));
reset role;
do $$ begin
 if (select count(*) from qs_stg_private.shift_eligibility where session_id=current_setting('qs.test.shift')::uuid)<>3 then raise exception 'Snapshot changed';end if;
 if (select closes_at-opens_at from qs_stg_private.attendance_sessions where id=current_setting('qs.test.shift')::uuid)<>interval '8 hours' then raise exception 'Overnight shift wrong';end if;
 if exists(select 1 from qs_stg_private.onboarding_events where receipt::text like '%'||repeat('a',64)||'%') then raise exception 'Raw code in ledger';end if;
 if has_function_privilege('anon','public.qs_stg_onboarding_command(jsonb)','EXECUTE') or has_table_privilege('authenticated','qs_stg_private.employee_invites','SELECT') then raise exception 'Client grant leaked';end if;
 begin delete from qs_stg_private.shift_eligibility;raise exception 'Snapshot mutated';exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise;end if;end;
 begin update qs_stg_private.onboarding_events set receipt='{}';raise exception 'Audit mutated';exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise;end if;end;
end $$;
rollback;
\echo 'Onboarding invitation, lifecycle, DST and immutable eligibility assertions passed'
