\set ON_ERROR_STOP on
begin;
create function qs_p3_test.wf(op text,n integer,extra jsonb default '{}'::jsonb,unit integer default 1,workspace integer default 1) returns jsonb language sql security invoker as $$
 select public.qs_stg_workforce_command(jsonb_build_object('action',op,'workspaceId',qs_p3_test.id('workspace',workspace),'unitId',qs_p3_test.id('unit',unit))||case when op='report' then '{}'::jsonb else jsonb_build_object('requestId',qs_p3_test.id('workforce',n)) end||extra)
$$;
create function qs_p3_test.wf_error(want text,op text,n integer,extra jsonb default '{}'::jsonb,unit integer default 1,workspace integer default 1) returns void language plpgsql as $$begin begin perform qs_p3_test.wf(op,n,extra,unit,workspace);raise exception 'Expected denial';exception when raise_exception then if sqlerrm<>want then raise;end if;end;end$$;
create function qs_p3_test.wf_dates() returns jsonb language sql as $$select jsonb_build_object('fromDate',to_char((clock_timestamp() at time zone 'Asia/Manila')::date,'YYYY-MM-DD'),'toDate',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+30,'YYYY-MM-DD'))$$;
create function qs_p3_test.wf_shift() returns jsonb language sql as $$select jsonb_build_object('localStart',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+2,'YYYY-MM-DD')||'T22:00','localEnd',to_char((clock_timestamp() at time zone 'Asia/Manila')::date+3,'YYYY-MM-DD')||'T06:00','startOffset',480,'endOffset',480)$$;
insert into public.qs_stg_role_assignments(membership_id,workspace_id,scope_unit_id,role) values(qs_p3_test.id('member',1),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',1),'level_3'),(qs_p3_test.id('member',1),qs_p3_test.id('workspace',1),qs_p3_test.id('unit',2),'level_3');
update qs_stg_private.onboarding_gate set enabled=true;
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.wf_error('QS_DISABLED','report',0,qs_p3_test.wf_dates());
reset role;
update qs_stg_private.workforce_gate set enabled=true;
set local role authenticated;
select qs_p3_test.claims(1,'aal1');
select qs_p3_test.wf_error('QS_FORBIDDEN','report',0,qs_p3_test.wf_dates());
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.wf_error('QS_FORBIDDEN','report',0,qs_p3_test.wf_dates(),3,2);
select qs_p3_test.wf('repeat',1,qs_p3_test.wf_shift()||'{"weeks":2}'::jsonb) as series \gset
select set_config('qs.test.series',:'series',true);
select (:'series'::jsonb->'shifts'->0->>'sessionId') as first,( :'series'::jsonb->'shifts'->1->>'sessionId') as second \gset
select set_config('qs.test.first',:'first',true),set_config('qs.test.second',:'second',true);
do $$begin if (qs_p3_test.wf('repeat',1,qs_p3_test.wf_shift()||'{"weeks":2}'::jsonb)->>'replayed')::boolean is distinct from true then raise exception 'Replay missing';end if;end$$;
select qs_p3_test.wf_error('QS_IDEMPOTENCY_CONFLICT','repeat',1,qs_p3_test.wf_shift()||'{"weeks":3}'::jsonb);
select qs_p3_test.wf_error('QS_CONFLICT','repeat',2,qs_p3_test.wf_shift()||'{"weeks":2}'::jsonb);
select qs_p3_test.wf('edit',3,qs_p3_test.wf_shift()||jsonb_build_object('sessionId',:'first','expectedVersion',1)) as replacement \gset
select (:'replacement'::jsonb->'shifts'->0->>'sessionId') as new_shift \gset
select set_config('qs.test.new_shift',:'new_shift',true);
select qs_p3_test.wf_error('QS_CONFLICT','cancel',4,jsonb_build_object('sessionId',:'new_shift','expectedVersion',1));
select qs_p3_test.wf('cancel',5,jsonb_build_object('sessionId',:'second','expectedVersion',1));
select qs_p3_test.wf('leave',6,jsonb_build_object('sessionId',:'new_shift','rosterId',qs_p3_test.id('roster',2),'expectedVersion',0,'category','approved_leave'));
select qs_p3_test.wf_error('QS_CONFLICT','cancel',7,jsonb_build_object('sessionId',:'new_shift','expectedVersion',2));
select qs_p3_test.wf('holiday',8,jsonb_build_object('localDate',left(qs_p3_test.wf_shift()->>'localStart',10),'expectedVersion',0,'category','special'));
select qs_p3_test.wf_error('QS_CONFLICT','holiday',9,jsonb_build_object('localDate',left(qs_p3_test.wf_shift()->>'localStart',10),'expectedVersion',0,'category','regular'));
do $$declare x jsonb;begin x:=qs_p3_test.wf('report',0,qs_p3_test.wf_dates());if jsonb_array_length(x->'rows')<>3 or not exists(select 1 from jsonb_array_elements(x->'rows') e where e->>'sessionId'=current_setting('qs.test.new_shift') and e->>'version'='2' and e->>'excused'='1' and e->>'planned'='3' and e->>'unmarked'='2' and e->>'holiday'='special' and e->>'mismatches'='0') then raise exception 'Report mismatch: %',x;end if;end$$;
select qs_p3_test.wf('cancel_leave',10,jsonb_build_object('sessionId',:'new_shift','rosterId',qs_p3_test.id('roster',2),'expectedVersion',1));
select qs_p3_test.wf('transfer',11,jsonb_build_object('rosterId',qs_p3_test.id('roster',2),'destinationUnitId',qs_p3_test.id('unit',2)));
select qs_p3_test.wf_error('QS_FORBIDDEN','transfer',12,jsonb_build_object('rosterId',qs_p3_test.id('roster',5),'destinationUnitId',qs_p3_test.id('unit',2)));
select qs_p3_test.claims(2,'aal1');
do $$begin begin perform public.qs_stg_p3_command('read',current_setting('qs.test.new_shift')::uuid,qs_p3_test.id('roster',2),null,null,null,null,null);raise exception 'Old roster permitted';exception when raise_exception then if sqlerrm<>'QS_FORBIDDEN' then raise;end if;end;end$$;
reset role;
do $$begin
 if (select count(*) from qs_stg_private.shift_eligibility where session_id=current_setting('qs.test.new_shift')::uuid)<>3 then raise exception 'Historical denominator changed';end if;
 if (select count(*) from qs_stg_private.roster_transfers)<>1 then raise exception 'Transfer missing';end if;
 if has_function_privilege('anon','public.qs_stg_workforce_command(jsonb)','EXECUTE') or has_table_privilege('authenticated','qs_stg_private.workforce_events','UPDATE') then raise exception 'Unexpected grants';end if;
 begin delete from qs_stg_private.workforce_events;raise exception 'Audit mutable';exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise;end if;end;
end$$;
rollback;
\echo 'Workforce recurring shifts, versioning, leave, holiday, transfer and historical reconciliation assertions passed'
