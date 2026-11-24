-- Review only. Disposable CI after workforce_history.sql.
begin;
create table qs_stg_private.advanced_gate(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into qs_stg_private.advanced_gate(singleton) values(true);
create table qs_stg_private.leave_requests(id uuid primary key,session_id uuid not null,roster_id uuid not null,maker_id uuid not null references auth.users(id),category text not null check(category in ('approved_leave','authorized_excuse')),base_version integer not null check(base_version>=0),created_at timestamptz not null,foreign key(session_id,roster_id) references qs_stg_private.shift_eligibility(session_id,roster_id));
create table qs_stg_private.leave_decisions(request_id uuid primary key references qs_stg_private.leave_requests(id),actor_id uuid not null references auth.users(id),outcome text not null check(outcome in ('approved','rejected','withdrawn')),recorded_at timestamptz not null);
create table qs_stg_private.transfer_plans(id uuid primary key,workspace_id uuid not null,unit_id uuid not null,destination_unit_id uuid not null,roster_id uuid not null references public.qs_stg_roster_assignments(id),effective_at timestamptz not null,created_at timestamptz not null,maker_id uuid not null references auth.users(id),foreign key(unit_id,workspace_id) references public.qs_stg_units(id,workspace_id),foreign key(destination_unit_id,workspace_id) references public.qs_stg_units(id,workspace_id),check(unit_id<>destination_unit_id));
create table qs_stg_private.transfer_plan_decisions(plan_id uuid primary key references qs_stg_private.transfer_plans(id),actor_id uuid not null references auth.users(id),outcome text not null check(outcome in ('activated','cancelled')),recorded_at timestamptz not null);
create table qs_stg_private.regional_calendar(workspace_id uuid not null,unit_id uuid not null,local_date date not null,version integer not null,region text not null,source_ref text not null,classification text not null,recorded_at timestamptz not null,primary key(workspace_id,unit_id,local_date,version),foreign key(unit_id,workspace_id) references public.qs_stg_units(id,workspace_id) );


create table qs_stg_private.advanced_events(actor_id uuid not null references auth.users(id),request_id uuid not null,workspace_id uuid not null,unit_id uuid not null,command_hash bytea not null,receipt jsonb not null,recorded_at timestamptz not null,primary key(actor_id,request_id));
alter table qs_stg_private.advanced_gate enable row level security; revoke all on qs_stg_private.advanced_gate from public,anon,authenticated;
alter table qs_stg_private.leave_requests enable row level security; revoke all on qs_stg_private.leave_requests from public,anon,authenticated;
alter table qs_stg_private.leave_decisions enable row level security; revoke all on qs_stg_private.leave_decisions from public,anon,authenticated;
alter table qs_stg_private.transfer_plans enable row level security; revoke all on qs_stg_private.transfer_plans from public,anon,authenticated;
alter table qs_stg_private.transfer_plan_decisions enable row level security; revoke all on qs_stg_private.transfer_plan_decisions from public,anon,authenticated;
alter table qs_stg_private.regional_calendar enable row level security; revoke all on qs_stg_private.regional_calendar from public,anon,authenticated;
alter table qs_stg_private.advanced_events enable row level security; revoke all on qs_stg_private.advanced_events from public,anon,authenticated;
create trigger leave_requests_immutable before update or delete or truncate on qs_stg_private.leave_requests for each statement execute function qs_stg_private.p3_event_immutable();
create trigger leave_decisions_immutable before update or delete or truncate on qs_stg_private.leave_decisions for each statement execute function qs_stg_private.p3_event_immutable();
create trigger transfer_plans_immutable before update or delete or truncate on qs_stg_private.transfer_plans for each statement execute function qs_stg_private.p3_event_immutable();
create trigger transfer_plan_decisions_immutable before update or delete or truncate on qs_stg_private.transfer_plan_decisions for each statement execute function qs_stg_private.p3_event_immutable();
create trigger regional_calendar_immutable before update or delete or truncate on qs_stg_private.regional_calendar for each statement execute function qs_stg_private.p3_event_immutable();
create trigger advanced_events_immutable before update or delete or truncate on qs_stg_private.advanced_events for each statement execute function qs_stg_private.p3_event_immutable();
create function qs_stg_private.advanced_command(p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $adv$
declare
 actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); sid uuid; session_end timestamptz; op text; ws uuid; un uuid; req uuid; target uuid; rs uuid; ss uuid; dst uuid; exp integer; n timestamptz; gate_on boolean; fields text[]; fingerprint bytea; result jsonb; prior qs_stg_private.advanced_events%rowtype;
 lr qs_stg_private.leave_requests%rowtype; tp qs_stg_private.transfer_plans%rowtype; ar public.qs_stg_roster_assignments%rowtype; am public.qs_stg_memberships%rowtype; ats qs_stg_private.attendance_sessions%rowtype; cat text; choice text; effective timestamptz; dt date; reg text; src text;
begin
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>2048 then raise exception 'QS_INVALID';end if;
 op:=p_body->>'action';
 fields:=case op
 when 'mine' then array['action','workspaceId','rosterId']
 when 'inbox' then array['action','workspaceId','unitId']
 when 'request_leave' then array['action','workspaceId','unitId','requestId','sessionId','rosterId','category']
 when 'withdraw_leave' then array['action','workspaceId','unitId','requestId','targetId','rosterId']
 when 'decide_leave' then array['action','workspaceId','unitId','requestId','targetId','outcome']
 when 'plan_transfer' then array['action','workspaceId','unitId','requestId','rosterId','destinationUnitId','effectiveAt']
 when 'activate_transfer' then array['action','workspaceId','unitId','requestId','targetId']
 when 'cancel_transfer' then array['action','workspaceId','unitId','requestId','targetId']
 when 'regional_holiday' then array['action','workspaceId','unitId','requestId','localDate','expectedVersion','category','region','sourceRef']
 else null end;
 if fields is null or not(p_body ?& fields) or exists(select 1 from jsonb_object_keys(p_body) k where not(k=any(fields))) or exists(select 1 from jsonb_each(p_body) x where x.value='null'::jsonb) then raise exception 'QS_INVALID';end if;
 begin ws:=(p_body->>'workspaceId')::uuid;un:=(p_body->>'unitId')::uuid;req:=(p_body->>'requestId')::uuid;target:=(p_body->>'targetId')::uuid;rs:=(p_body->>'rosterId')::uuid;ss:=(p_body->>'sessionId')::uuid;dst:=(p_body->>'destinationUnitId')::uuid;exp:=(p_body->>'expectedVersion')::integer;sid:=(claims->>'session_id')::uuid;exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'QS_INVALID';end;
 select g.enabled into gate_on from qs_stg_private.advanced_gate g where singleton for share;
 if gate_on is distinct from true then raise exception 'QS_DISABLED';end if;
 select g.enabled into gate_on from qs_stg_private.workforce_gate g where singleton for share;
 if gate_on is distinct from true then raise exception 'QS_DISABLED';end if;
 select g.enabled into gate_on from qs_stg_private.onboarding_gate g where singleton for share;
 if gate_on is distinct from true then raise exception 'QS_DISABLED';end if;
 select g.enabled into gate_on from qs_stg_private.p3_gate g where singleton for share;
 if gate_on is distinct from true then raise exception 'QS_DISABLED';end if;
 if actor is null or ws is null or claims->>'role' is distinct from 'authenticated' or claims->>'is_anonymous' is distinct from 'false' then raise exception 'QS_FORBIDDEN';end if;
 select a.not_after into session_end from auth.sessions a join auth.users u on u.id=a.user_id where a.id=sid and a.user_id=actor and u.email_confirmed_at is not null for share of a,u;
 if not found then raise exception 'QS_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('qs-onboarding-workspace:'||ws::text,0));
 n:=clock_timestamp();
 if session_end is not null and session_end<=n then raise exception 'QS_FORBIDDEN';end if;
 if op in ('mine','request_leave','withdraw_leave') then
  select r.* into ar from public.qs_stg_roster_assignments r join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id join public.qs_stg_workspaces w on w.id=r.workspace_id join public.qs_stg_units u on u.id=r.unit_id and u.workspace_id=r.workspace_id where r.id=rs and r.workspace_id=ws and r.status='active' and m.user_id=actor and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n) and w.status='active' and u.status='active' for share of r,m,w,u;
  if not found or (op<>'mine' and un is distinct from ar.unit_id) then raise exception 'QS_FORBIDDEN';end if;
  un:=ar.unit_id;
 else
  perform qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',un));
 end if;
 if op in ('mine','inbox') then
  return jsonb_build_object('action',op,'workspaceId',ws,'unitId',un,
   'requests',coalesce((select jsonb_agg(q.item order by q.at desc,q.id) from (select l.id,l.created_at at,jsonb_build_object('id',l.id,'sessionId',l.session_id,'rosterId',l.roster_id,'category',l.category,'status',coalesce(d.outcome,'pending'),'localStart',to_char(h.local_start,'YYYY-MM-DD"T"HH24:MI'),'madeByMe',l.maker_id=actor) item from qs_stg_private.leave_requests l join qs_stg_private.attendance_sessions s on s.id=l.session_id join qs_stg_private.managed_shifts h on h.session_id=s.id left join qs_stg_private.leave_decisions d on d.request_id=l.id where s.workspace_id=ws and s.unit_id=un and (op='inbox' or (l.roster_id=rs and l.maker_id=actor)) order by l.created_at desc,l.id limit 50)q),'[]'::jsonb),
   'eligible',case when op='mine' then coalesce((select jsonb_agg(q.item order by q.at,q.id) from (select s.id,s.opens_at at,jsonb_build_object('sessionId',s.id,'localStart',to_char(h.local_start,'YYYY-MM-DD"T"HH24:MI'),'localEnd',to_char(h.local_end,'YYYY-MM-DD"T"HH24:MI')) item from qs_stg_private.shift_eligibility e join qs_stg_private.attendance_sessions s on s.id=e.session_id join qs_stg_private.managed_shifts h on h.session_id=s.id where e.roster_id=rs and s.workspace_id=ws and s.unit_id=un and s.opens_at>n and not exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=s.id) order by s.opens_at,s.id limit 30)q),'[]'::jsonb) else '[]'::jsonb end,
   'transfers',case when op='inbox' then coalesce((select jsonb_agg(q.item order by q.at desc,q.id) from (select p.id,p.created_at at,jsonb_build_object('id',p.id,'rosterId',p.roster_id,'destinationUnitId',p.destination_unit_id,'effectiveAt',p.effective_at,'status',coalesce(d.outcome,'pending')) item from qs_stg_private.transfer_plans p left join qs_stg_private.transfer_plan_decisions d on d.plan_id=p.id where p.workspace_id=ws and p.unit_id=un order by p.created_at desc,p.id limit 50)q),'[]'::jsonb) else '[]'::jsonb end,
   'holidays',case when op='inbox' then coalesce((select jsonb_agg(q.item order by q.calendar_date desc) from (select distinct on(c.local_date) c.local_date as calendar_date,jsonb_build_object('localDate',c.local_date,'version',c.version,'region',c.region,'sourceRef',c.source_ref,'classification',c.classification) item from qs_stg_private.regional_calendar c where c.workspace_id=ws and c.unit_id=un order by c.local_date desc,c.version desc limit 50)q),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 if req is null then raise exception 'QS_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('qs-advanced-request:'||actor::text||':'||req::text,0));
 fingerprint:=sha256(convert_to(p_body::text,'UTF8'));
 select * into prior from qs_stg_private.advanced_events e where e.actor_id=actor and e.request_id=req;
 if found then if prior.command_hash<>fingerprint then raise exception 'QS_IDEMPOTENCY_CONFLICT';end if;return prior.receipt||jsonb_build_object('replayed',true);end if;
 n:=clock_timestamp();
 if session_end is not null and session_end<=n then raise exception 'QS_FORBIDDEN';end if;
 if op='request_leave' then
  cat:=p_body->>'category';if cat not in ('approved_leave','authorized_excuse') then raise exception 'QS_INVALID';end if;
  select s.* into ats from qs_stg_private.attendance_sessions s join qs_stg_private.shift_eligibility e on e.session_id=s.id and e.roster_id=rs where s.id=ss and s.workspace_id=ws and s.unit_id=un for update of s;
  if not found or ats.opens_at<=n or exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=ss) or exists(select 1 from qs_stg_private.shift_leave l where l.session_id=ss and l.roster_id=rs and l.active) or exists(select 1 from qs_stg_private.leave_requests l where l.session_id=ss and l.roster_id=rs and not exists(select 1 from qs_stg_private.leave_decisions d where d.request_id=l.id)) then raise exception 'QS_CONFLICT';end if;
  select coalesce(max(l.version),0) into exp from qs_stg_private.shift_leave l where l.session_id=ss and l.roster_id=rs;
  insert into qs_stg_private.leave_requests values(req,ss,rs,actor,cat,exp,n);
  result:=jsonb_build_object('id',req,'status','pending');
 elsif op in ('withdraw_leave','decide_leave') then
  select l.* into lr from qs_stg_private.leave_requests l join qs_stg_private.attendance_sessions s on s.id=l.session_id where l.id=target and s.workspace_id=ws and s.unit_id=un;
  if not found or exists(select 1 from qs_stg_private.leave_decisions d where d.request_id=target) then raise exception 'QS_CONFLICT';end if;
  if op='withdraw_leave' then
   if lr.maker_id<>actor or lr.roster_id<>rs then raise exception 'QS_FORBIDDEN';end if;choice:='withdrawn';
  else
   if lr.maker_id=actor then raise exception 'QS_FORBIDDEN';end if;
   choice:=p_body->>'outcome';if choice not in ('approved','rejected') then raise exception 'QS_INVALID';end if;
   if choice='approved' then
    perform 1 from public.qs_stg_roster_assignments r join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id where r.id=lr.roster_id and r.workspace_id=ws and r.unit_id=un and r.status='active' and m.user_id=lr.maker_id and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n) for share of r,m;
    if not found then raise exception 'QS_FORBIDDEN';end if;
    perform qs_stg_private.workforce_command(jsonb_build_object('action','leave','workspaceId',ws,'unitId',un,'requestId',gen_random_uuid(),'sessionId',lr.session_id,'rosterId',lr.roster_id,'expectedVersion',lr.base_version,'category',lr.category));
   end if;
  end if;
  insert into qs_stg_private.leave_decisions values(target,actor,choice,n);result:=jsonb_build_object('id',target,'status',choice);
 elsif op='plan_transfer' then
  if dst is null or dst=un or p_body->>'effectiveAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' then raise exception 'QS_INVALID';end if;
  effective:=(p_body->>'effectiveAt')::timestamptz;if effective<=n or effective>n+interval '90 days' then raise exception 'QS_INVALID';end if;
  perform qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',dst));
  select r.* into ar from public.qs_stg_roster_assignments r where r.id=rs and r.workspace_id=ws and r.unit_id=un and r.status='active' for share;
  if not found then raise exception 'QS_FORBIDDEN';end if;
  select m.* into am from public.qs_stg_memberships m where m.id=ar.membership_id and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>effective) for share;
  if not found or am.user_id=actor or exists(select 1 from public.qs_stg_role_assignments g where g.membership_id=am.id) or exists(select 1 from public.qs_stg_roster_assignments r where r.membership_id=am.id and r.unit_id=dst) or exists(select 1 from qs_stg_private.transfer_plans p where p.roster_id=rs and not exists(select 1 from qs_stg_private.transfer_plan_decisions d where d.plan_id=p.id)) then raise exception 'QS_CONFLICT';end if;
  insert into qs_stg_private.transfer_plans values(req,ws,un,dst,rs,effective,n,actor);result:=jsonb_build_object('id',req,'status','pending');
 elsif op in ('activate_transfer','cancel_transfer') then
  select * into tp from qs_stg_private.transfer_plans p where p.id=target and p.workspace_id=ws and p.unit_id=un;
  if not found or exists(select 1 from qs_stg_private.transfer_plan_decisions d where d.plan_id=target) then raise exception 'QS_CONFLICT';end if;
  perform qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',tp.destination_unit_id));
  if op='activate_transfer' then
   if tp.effective_at>n then raise exception 'QS_CONFLICT';end if;
   perform qs_stg_private.workforce_command(jsonb_build_object('action','transfer','workspaceId',ws,'unitId',un,'requestId',gen_random_uuid(),'rosterId',tp.roster_id,'destinationUnitId',tp.destination_unit_id));choice:='activated';
  else choice:='cancelled';end if;
  insert into qs_stg_private.transfer_plan_decisions values(target,actor,choice,n);result:=jsonb_build_object('id',target,'status',choice);
 else
  if p_body->>'localDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'QS_INVALID';end if;
  dt:=(p_body->>'localDate')::date;cat:=p_body->>'category';reg:=p_body->>'region';src:=p_body->>'sourceRef';
  if reg !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{1,79}$' or src !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{2,159}$' then raise exception 'QS_INVALID';end if;
  perform qs_stg_private.workforce_command(jsonb_build_object('action','holiday','workspaceId',ws,'unitId',un,'requestId',gen_random_uuid(),'localDate',dt,'expectedVersion',exp,'category',cat));
  insert into qs_stg_private.regional_calendar values(ws,un,dt,exp+1,reg,src,cat,n);result:=jsonb_build_object('version',exp+1,'status','recorded');
 end if;
 result:=result||jsonb_build_object('action',op,'workspaceId',ws,'unitId',un,'replayed',false);
 insert into qs_stg_private.advanced_events values(actor,req,ws,un,fingerprint,result,n);return result;
end;
$adv$;
revoke all on function qs_stg_private.advanced_command(jsonb) from public,anon,authenticated;
grant execute on function qs_stg_private.advanced_command(jsonb) to authenticated;
create function public.qs_stg_advanced_command(p_body jsonb) returns jsonb language sql security invoker set search_path='' as $rpc$ select qs_stg_private.advanced_command(p_body) $rpc$;
revoke all on function public.qs_stg_advanced_command(jsonb) from public,anon,authenticated;
grant execute on function public.qs_stg_advanced_command(jsonb) to authenticated;
commit;
