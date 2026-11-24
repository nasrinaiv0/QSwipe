\set ON_ERROR_STOP on
-- Disposable fixture only. Never execute on a hosted or live database.
begin;
do $$ begin if current_database()<>'qswipe_test' then raise exception 'Disposable database required'; end if; end $$;
create function qs_p3_test.reconcile_ledger() returns void language plpgsql security invoker as $audit$
begin
 if exists(
  select 1 from qs_stg_private.attendance_current c
  full join qs_stg_private.attendance_events e using(session_id,roster_id)
  where c.session_id is null or e.session_id is null
 ) then raise exception 'P7_MISSING_INITIAL_EVENT'; end if;
 if exists(
  with chain as (
   select session_id,roster_id,1 as version,status,recorded_at as at,null::text as prior_status,null::integer as base_version
   from qs_stg_private.attendance_events
   union all
   select d.session_id,d.roster_id,d.resulting_version,r.proposed_status,d.decided_at,r.original_status,r.base_version
   from qs_stg_private.correction_decisions d join qs_stg_private.correction_requests r on r.id=d.request_id
   where d.outcome='approved'
  ), ordered as (
   select *,lag(version) over w as prev_version,lag(status) over w as prev_status,lag(at) over w as prev_at
   from chain window w as (partition by session_id,roster_id order by version)
  )
  select 1 from ordered where version>1 and
    (prev_version is distinct from version-1 or base_version is distinct from prev_version or prior_status is distinct from prev_status or at<prev_at)
 ) then raise exception 'P7_VERSION_CHAIN'; end if;
 if exists(
  with chain as (
   select session_id,roster_id,version,status,recorded_at as at from qs_stg_private.attendance_events
   union all
   select d.session_id,d.roster_id,d.resulting_version,r.proposed_status,d.decided_at
   from qs_stg_private.correction_decisions d join qs_stg_private.correction_requests r on r.id=d.request_id where d.outcome='approved'
  ), latest as (
   select distinct on(session_id,roster_id) * from chain order by session_id,roster_id,version desc
  )
  select 1 from qs_stg_private.attendance_current c join latest l using(session_id,roster_id)
  where (c.version,c.status,c.recorded_at) is distinct from (l.version,l.status,l.at)
 ) then raise exception 'P7_PROJECTION_MISMATCH'; end if;
 if exists(
  select 1 from qs_stg_private.attendance_events e
  left join qs_stg_private.attendance_passes p using(session_id,roster_id)
  where e.source='qr' and (p.consumed_at is distinct from e.recorded_at or p.consumed_at>=p.expires_at or e.status<>'present')
 ) or exists(
  select 1 from qs_stg_private.attendance_passes p left join qs_stg_private.attendance_events e using(session_id,roster_id)
  where p.consumed_at is not null and (e.source is distinct from 'qr' or e.recorded_at is distinct from p.consumed_at)
 ) then raise exception 'P7_QR_LEDGER_MISMATCH'; end if;
 if exists(
  select 1 from qs_stg_private.attendance_current c join qs_stg_private.attendance_sessions s on s.id=c.session_id
  join public.qs_stg_roster_assignments r on r.id=c.roster_id
  where s.workspace_id<>r.workspace_id or s.unit_id<>r.unit_id
 ) or exists(
  select 1 from qs_stg_private.correction_decisions d
  join qs_stg_private.correction_requests q on q.id=d.request_id
  join public.qs_stg_roster_assignments r on r.id=q.roster_id
  join public.qs_stg_memberships m on m.id=r.membership_id
  where d.checker_id=q.maker_id or d.checker_id=m.user_id or d.decided_at<q.created_at
 ) then raise exception 'P7_SCOPE_OR_CHECKER_MISMATCH'; end if;
end;
$audit$;
-- Existing concurrency fixtures contain six initial events and two approved decisions.
select qs_p3_test.reconcile_ledger();
-- Exercise positive QR consumption and multiple approved transitions; pending/rejected never count.
set local role authenticated;
select qs_p3_test.claims(5,'aal1');
select qs_p3_test.cmd('issue',1,5)->>'token' as qr_token \gset
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.cmd('mark',1,5,7000,0,'present',:'qr_token');
select qs_p3_test.claims(5,'aal1');
select qs_p3_test.correction('submit',1,5,7001,1,'absent',null,'incorrect_mark');
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.correction('decide',1,5,7001,null,null,'approved','verified');
select qs_p3_test.claims(5,'aal1');
select qs_p3_test.correction('submit',1,5,7002,2,'present',null,'incorrect_mark');
select qs_p3_test.correction('submit',1,5,7003,2,'present',null,'verified_attendance');
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.correction('decide',1,5,7002,null,null,'rejected','incorrect_request');
select qs_p3_test.correction('decide',1,5,7003,null,null,'approved','verified');
reset role;
select qs_p3_test.reconcile_ledger();
do $$ begin
 if (select version from qs_stg_private.attendance_current where session_id=qs_p3_test.id('slot',1) and roster_id=qs_p3_test.id('roster',5))<>3 then raise exception 'Expected v3'; end if;
 -- Prove the detector fails on a deliberately corrupted projection, then undo via subtransaction.
 begin
  update qs_stg_private.attendance_current set version=version+1 where session_id=qs_p3_test.id('slot',1) and roster_id=qs_p3_test.id('roster',5);
  perform qs_p3_test.reconcile_ledger();
  raise exception 'Negative control was not detected';
 exception when raise_exception then if sqlerrm<>'P7_PROJECTION_MISMATCH' then raise; end if;
 end;
 begin
  update qs_stg_private.attendance_passes set consumed_at=null where session_id=qs_p3_test.id('slot',1) and roster_id=qs_p3_test.id('roster',5);
  perform qs_p3_test.reconcile_ledger();
  raise exception 'Negative QR control was not detected';
 exception when raise_exception then if sqlerrm<>'P7_QR_LEDGER_MISMATCH' then raise; end if;
 end;
end $$;
select qs_p3_test.reconcile_ledger();
rollback;
\echo 'P7 ledger reconciliation and negative corruption controls passed'
