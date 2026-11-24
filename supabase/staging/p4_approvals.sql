-- P4 REVIEW CANDIDATE: disposable PostgreSQL only, no remote apply.
begin;
alter table qs_stg_private.attendance_current drop constraint attendance_current_version_check;
alter table qs_stg_private.attendance_current add constraint attendance_current_version_check check(version>=1);

create table qs_stg_private.p4_gate (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into qs_stg_private.p4_gate(singleton) values(true);
create table qs_stg_private.correction_requests (
 id uuid primary key,
 session_id uuid not null,
 roster_id uuid not null,
 maker_id uuid not null references auth.users(id),
 maker_membership_id uuid not null references public.qs_stg_memberships(id),
 base_version integer not null check(base_version>=1),
 original_status text not null check(original_status in ('present','absent')),
 proposed_status text not null check(proposed_status in ('present','absent') and proposed_status<>original_status),
 reason text not null check(reason in ('incorrect_mark','verified_attendance','verified_absence')),
 created_at timestamptz not null,
 foreign key(session_id,roster_id) references qs_stg_private.attendance_current(session_id,roster_id),
 unique(id,session_id,roster_id,base_version,maker_id)
);
create index p4_requests_pair_idx on qs_stg_private.correction_requests(session_id,roster_id,created_at desc,id desc);
create table qs_stg_private.correction_decisions (
 request_id uuid primary key,
 session_id uuid not null,
 roster_id uuid not null,
 base_version integer not null,
 maker_id uuid not null,
 checker_id uuid not null references auth.users(id) check(checker_id<>maker_id),
 outcome text not null check(outcome in ('approved','rejected')),
 reason text not null check((outcome='approved' and reason='verified') or (outcome='rejected' and reason in ('insufficient_evidence','incorrect_request'))),
 resulting_version integer not null,
 decided_at timestamptz not null,
 check((outcome='approved' and resulting_version=base_version+1) or (outcome='rejected' and resulting_version=base_version)),
 foreign key(request_id,session_id,roster_id,base_version,maker_id)
 references qs_stg_private.correction_requests(id,session_id,roster_id,base_version,maker_id)
);
create unique index p4_one_approved_version on qs_stg_private.correction_decisions(session_id,roster_id,base_version) where outcome='approved';
alter table qs_stg_private.p4_gate enable row level security;
alter table qs_stg_private.correction_requests enable row level security;
alter table qs_stg_private.correction_decisions enable row level security;
revoke all on qs_stg_private.p4_gate,qs_stg_private.correction_requests,qs_stg_private.correction_decisions from public,anon,authenticated;
create trigger p4_request_immutable before update or delete or truncate on qs_stg_private.correction_requests
 for each statement execute function qs_stg_private.p3_event_immutable();
create trigger p4_decision_immutable before update or delete or truncate on qs_stg_private.correction_decisions
 for each statement execute function qs_stg_private.p3_event_immutable();

create function qs_stg_private.p4_command(p_action text,p_session uuid,p_roster uuid,p_request uuid,
 p_expected integer,p_status text,p_outcome text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $p4$
declare
 actor uuid:=auth.uid();
 snapshot jsonb;
 enabled boolean;
 slot qs_stg_private.attendance_sessions%rowtype;
 subject uuid;
 req qs_stg_private.correction_requests%rowtype;
 decision qs_stg_private.correction_decisions%rowtype;
 current_version integer;
 current_status text;
 now_at timestamptz;
 maker_membership uuid;
 maker_start timestamptz;
 maker_end timestamptz;
 grant_start timestamptz;
 grant_end timestamptz;
 response jsonb;
 replayed boolean:=false;
begin
 if p_action is null or p_action not in ('list','submit','decide') or p_session is null or p_roster is null then raise exception 'QS_INVALID'; end if;
 if p_action='list' and (p_request is not null or p_expected is not null or p_status is not null or p_outcome is not null or p_reason is not null) then raise exception 'QS_INVALID'; end if;
 if p_action='submit' and (p_request is null or p_expected is null or p_expected<1 or p_status is null or p_status not in ('present','absent') or p_outcome is not null or p_reason is null or p_reason not in ('incorrect_mark','verified_attendance','verified_absence') or (p_reason='verified_attendance' and p_status<>'present') or (p_reason='verified_absence' and p_status<>'absent')) then raise exception 'QS_INVALID'; end if;
 if p_action='decide' and (p_request is null or p_expected is not null or p_status is not null or p_outcome is null or p_outcome not in ('approved','rejected') or p_reason is null or (p_outcome='approved' and p_reason<>'verified') or (p_outcome='rejected' and p_reason not in ('insufficient_evidence','incorrect_request'))) then raise exception 'QS_INVALID'; end if;
 select g.enabled into enabled from qs_stg_private.p4_gate g where g.singleton for share;
 if enabled is distinct from true then raise exception 'QS_DISABLED'; end if;
 -- P3 read acquires pair lock and checks live session, subject and caller access.
 snapshot:=qs_stg_private.p3_command('read',p_session,p_roster,null,null,null,null,null);
 current_version:=(snapshot->>'version')::integer;
 current_status:=snapshot->>'status';
 select * into strict slot from qs_stg_private.attendance_sessions s where s.id=p_session;
 select m.user_id into strict subject from public.qs_stg_roster_assignments r join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id where r.id=p_roster;
 now_at:=clock_timestamp();
 if p_action='list' then
   select coalesce(jsonb_agg(q.item order by q.created_at desc,q.id desc),'[]'::jsonb) into response from (
     select r.id,r.created_at,jsonb_build_object('requestId',r.id,'baseVersion',r.base_version,'originalStatus',r.original_status,'proposedStatus',r.proposed_status,'reason',r.reason,'createdAt',r.created_at,'madeByMe',r.maker_id=actor,'outcome',coalesce(d.outcome,'pending'),'decisionReason',d.reason,'resultingVersion',d.resulting_version,'decidedAt',d.decided_at) item
     from qs_stg_private.correction_requests r left join qs_stg_private.correction_decisions d on d.request_id=r.id
     where r.session_id=p_session and r.roster_id=p_roster order by r.created_at desc,r.id desc limit 50
   ) q;
   return jsonb_build_object('sessionId',p_session,'rosterId',p_roster,'requests',response,'currentVersion',current_version,'currentStatus',current_status);
 end if;
 if p_action='decide' and (actor=subject or auth.jwt()->>'aal' is distinct from 'aal2') then raise exception 'QS_FORBIDDEN'; end if;
 select * into req from qs_stg_private.correction_requests r where r.id=p_request and r.session_id=p_session and r.roster_id=p_roster;
 if p_action='submit' then
   if found then
     if not exists(select 1 from public.qs_stg_memberships m where m.id=req.maker_membership_id and m.user_id=actor and m.workspace_id=slot.workspace_id and m.status='active' and m.starts_at<=now_at and (m.ends_at is null or m.ends_at>now_at)) then raise exception 'QS_FORBIDDEN'; end if;
     if req.maker_id<>actor or req.base_version<>p_expected or req.proposed_status<>p_status or req.reason<>p_reason then raise exception 'QS_IDEMPOTENCY_CONFLICT'; end if;
     replayed:=true;
   else
     if current_version<1 or p_expected<>current_version then raise exception 'QS_VERSION_CONFLICT'; end if;
     if p_status=current_status then raise exception 'QS_INVALID'; end if;
     if now_at>slot.closes_at+interval '30 days' then raise exception 'QS_CORRECTION_WINDOW'; end if;
     select m.id into maker_membership from public.qs_stg_memberships m where m.user_id=actor and m.workspace_id=slot.workspace_id and m.status='active' and m.starts_at<=now_at and (m.ends_at is null or m.ends_at>now_at) for share;
     if not found then raise exception 'QS_FORBIDDEN'; end if;
     insert into qs_stg_private.correction_requests(id,session_id,roster_id,maker_id,maker_membership_id,base_version,original_status,proposed_status,reason,created_at)
       values(p_request,p_session,p_roster,actor,maker_membership,current_version,current_status,p_status,p_reason,now_at)
       on conflict(id) do nothing returning * into req;
     if not found then raise exception 'QS_IDEMPOTENCY_CONFLICT'; end if;
   end if;
 else
   if not found then raise exception 'QS_FORBIDDEN'; end if;
   if req.maker_id=actor then raise exception 'QS_FORBIDDEN'; end if;
   -- Recheck the maker's current membership, and scoped grant when the maker was a manager.
   select m.starts_at,m.ends_at into maker_start,maker_end from public.qs_stg_memberships m
     where m.id=req.maker_membership_id and m.user_id=req.maker_id and m.workspace_id=slot.workspace_id and m.status='active'
       and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp()) for share;
   if not found then raise exception 'QS_FORBIDDEN'; end if;
   if req.maker_id<>subject then
     select g.starts_at,g.ends_at into grant_start,grant_end from public.qs_stg_role_assignments g
       join public.qs_stg_memberships m on m.id=g.membership_id and m.workspace_id=g.workspace_id
       where m.id=req.maker_membership_id and m.user_id=req.maker_id and m.workspace_id=slot.workspace_id and m.status='active'
         and g.scope_unit_id=slot.unit_id and g.role in ('level_1','level_2','level_3','org_admin')
         and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())
       order by g.id limit 1 for share of g,m;
     if not found then raise exception 'QS_FORBIDDEN'; end if;
   end if;
   -- Recheck checker and subject after any wait on maker's rows, with the same pair lock.
   snapshot:=qs_stg_private.p3_command('read',p_session,p_roster,null,null,null,null,null);
   now_at:=clock_timestamp();
   if maker_start>now_at or (maker_end is not null and maker_end<=now_at)
     or (req.maker_id<>subject and (grant_start>now_at or (grant_end is not null and grant_end<=now_at))) then raise exception 'QS_FORBIDDEN'; end if;
   select * into decision from qs_stg_private.correction_decisions d where d.request_id=req.id;
   if found then
     if decision.checker_id<>actor or decision.outcome<>p_outcome or decision.reason<>p_reason then raise exception 'QS_IDEMPOTENCY_CONFLICT'; end if;
     replayed:=true;
   else
     if now_at>slot.closes_at+interval '30 days' then raise exception 'QS_CORRECTION_WINDOW'; end if;
     if p_outcome='approved' then
       if current_version<>req.base_version or current_status<>req.original_status then raise exception 'QS_VERSION_CONFLICT'; end if;
       update qs_stg_private.attendance_current c set status=req.proposed_status,version=c.version+1,recorded_at=now_at
         where c.session_id=p_session and c.roster_id=p_roster and c.version=req.base_version and c.status=req.original_status;
       if not found then raise exception 'QS_VERSION_CONFLICT'; end if;
     end if;
     insert into qs_stg_private.correction_decisions(request_id,session_id,roster_id,base_version,maker_id,checker_id,outcome,reason,resulting_version,decided_at)
       values(req.id,p_session,p_roster,req.base_version,req.maker_id,actor,p_outcome,p_reason,req.base_version+case when p_outcome='approved' then 1 else 0 end,now_at)
       returning * into decision;
   end if;
 end if;
 -- Historical receipt, not a current snapshot. Re-read via P3 for authoritative state.
 if p_action='submit' then select * into decision from qs_stg_private.correction_decisions d where d.request_id=req.id; end if;
 return jsonb_build_object('sessionId',p_session,'rosterId',p_roster,'requestId',req.id,'baseVersion',req.base_version,
   'originalStatus',req.original_status,'proposedStatus',req.proposed_status,'reason',req.reason,'createdAt',req.created_at,
   'madeByMe',req.maker_id=actor,'outcome',coalesce(decision.outcome,'pending'),'decisionReason',decision.reason,
   'resultingVersion',decision.resulting_version,'decidedAt',decision.decided_at,'replayed',replayed);
end;
$p4$;
revoke all on function qs_stg_private.p4_command(text,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function qs_stg_private.p4_command(text,uuid,uuid,uuid,integer,text,text,text) to authenticated;
create function public.qs_stg_p4_command(p_action text,p_session uuid,p_roster uuid,p_request uuid,
 p_expected integer,p_status text,p_outcome text,p_reason text) returns jsonb
language sql security invoker set search_path='' as $p4rpc$
 select qs_stg_private.p4_command(p_action,p_session,p_roster,p_request,p_expected,p_status,p_outcome,p_reason)
$p4rpc$;
revoke all on function public.qs_stg_p4_command(text,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.qs_stg_p4_command(text,uuid,uuid,uuid,integer,text,text,text) to authenticated;
commit;
