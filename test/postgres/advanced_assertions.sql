\set ON_ERROR_STOP on
begin;
create function qs_p3_test.adv(op text,i integer,extra jsonb default '{}'::jsonb,unit integer default 1,workspace integer default 1) returns jsonb language sql as $$select public.qs_stg_advanced_command(jsonb_build_object('action',op,'workspaceId',qs_p3_test.id('workspace',workspace))||case when op='mine' then '{}'::jsonb else jsonb_build_object('unitId',qs_p3_test.id('unit',unit)) end||case when op in ('mine','inbox') then '{}'::jsonb else jsonb_build_object('requestId',qs_p3_test.id('advanced',i)) end||extra)$$;
create function qs_p3_test.adv_error(want text,op text,i integer,extra jsonb default '{}'::jsonb,unit integer default 1,workspace integer default 1) returns void language plpgsql as $$begin begin perform qs_p3_test.adv(op,i,extra,unit,workspace);raise exception 'Expected denial';exception when raise_exception then if sqlerrm<>want then raise;end if;end;end$$;
insert into public.qs_stg_role_assignments(membership_id,workspace_id,scope_unit_id,role) values(qs_p3_test.id('member',1),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',1),'level_3'),(qs_p3_test.id('member',1),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',2),'level_3');
update qs_stg_private.onboarding_gate set enabled=true;
update qs_stg_private.workforce_gate set enabled=true;
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.adv_error('QS_DISABLED','inbox',0);
reset role;
update qs_stg_private.advanced_gate set enabled=true;
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.adv_error('QS_FORBIDDEN','inbox',0,'{}',3,2);
select public.qs_stg_onboarding_command(jsonb_build_object('action','schedule','workspaceId',qs_p3_test.id('workspace',1),'unitId',qs_p3_test.id('unit',1),'requestId',qs_p3_test.id('advanced',100),'localStart',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+2,'YYYY-MM-DD')||'T22:00','localEnd',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+3,'YYYY-MM-DD')||'T06:00','startOffset',480,'endOffset',480))->>'sessionId' as shift_id \gset
select set_config('qs.test.adv_shift',:'shift_id',true);
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.adv_error('QS_FORBIDDEN','inbox',0);
select qs_p3_test.adv_error('QS_FORBIDDEN','mine',0,jsonb_build_object('rosterId',qs_p3_test.id('roster',5)));
do $$begin if jsonb_array_length(qs_p3_test.adv('mine',0,jsonb_build_object('rosterId',qs_p3_test.id('roster',2)))->'eligible')<>1 then raise exception 'Eligible shift missing';end if;end$$;
select qs_p3_test.adv('request_leave',1,jsonb_build_object('sessionId',:'shift_id','rosterId',qs_p3_test.id('roster',2),'category','approved_leave'))->>'id' as leave_id \gset
select qs_p3_test.adv_error('QS_CONFLICT','request_leave',2,jsonb_build_object('sessionId',:'shift_id','rosterId',qs_p3_test.id('roster',2),'category','approved_leave'));
select qs_p3_test.adv_error('QS_FORBIDDEN','decide_leave',3,jsonb_build_object('targetId',:'leave_id','outcome','approved'));
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.adv('decide_leave',4,jsonb_build_object('targetId',:'leave_id','outcome','approved'));
select set_config('qs.test.leave',:'leave_id',true);
do $$begin if (qs_p3_test.adv('decide_leave',4,jsonb_build_object('targetId',current_setting('qs.test.leave'),'outcome','approved'))->>'replayed')::boolean is distinct from true then raise exception 'Replay missing';end if;end$$;
select qs_p3_test.adv_error('QS_CONFLICT','decide_leave',5,jsonb_build_object('targetId',:'leave_id','outcome','rejected'));
select qs_p3_test.adv('regional_holiday',6,jsonb_build_object('localDate',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+2,'YYYY-MM-DD'),'expectedVersion',0,'category','special','region','Fictional region','sourceRef','TEST reference 001'));
select qs_p3_test.adv('plan_transfer',7,jsonb_build_object('rosterId',qs_p3_test.id('roster',2),'destinationUnitId',qs_p3_test.id('unit',2),'effectiveAt',to_char(clock_timestamp() at time zone 'UTC'+interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"')))->>'id' as plan_id \gset
select qs_p3_test.adv_error('QS_CONFLICT','activate_transfer',8,jsonb_build_object('targetId',:'plan_id'));
select qs_p3_test.adv('cancel_transfer',9,jsonb_build_object('targetId',:'plan_id'));
reset role;
do $$begin
 if (select count(*) from qs_stg_private.leave_decisions where outcome='approved')<>1 or (select count(*) from qs_stg_private.shift_leave where active)<>1 then raise exception 'Leave not atomic';end if;
 if (select count(*) from qs_stg_private.regional_calendar)<>1 or (select count(*) from qs_stg_private.transfer_plan_decisions where outcome='cancelled')<>1 then raise exception 'History missing';end if;
 if exists(select 1 from qs_stg_private.roster_transfers) then raise exception 'Premature transfer';end if;
 if has_function_privilege('anon','public.qs_stg_advanced_command(jsonb)','EXECUTE') or has_table_privilege('authenticated','qs_stg_private.leave_decisions','INSERT') then raise exception 'Unexpected privileges';end if;
 begin delete from qs_stg_private.leave_decisions;raise exception 'Mutable ledger';exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise;end if;end;
end$$;
rollback;
\echo 'Advanced leave approval, transfer timing, calendar and audit assertions passed'
