-- Review candidate only; apply in disposable CI after PR14.
begin;
create table qs_stg_private.workforce_gate(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into qs_stg_private.workforce_gate(singleton) values(true);
create table qs_stg_private.shift_retirements(session_id uuid primary key references qs_stg_private.managed_shifts(session_id),recorded_at timestamptz not null);
create table qs_stg_private.shift_versions(session_id uuid primary key references qs_stg_private.managed_shifts(session_id),root_id uuid not null references qs_stg_private.managed_shifts(session_id),version integer not null check(version>=1),unique(root_id,version));
create table qs_stg_private.roster_transfers(old_roster_id uuid primary key references public.qs_stg_roster_assignments(id),new_roster_id uuid unique not null references public.qs_stg_roster_assignments(id),effective_at timestamptz not null);
create table qs_stg_private.shift_leave(session_id uuid not null references qs_stg_private.managed_shifts(session_id),roster_id uuid not null references public.qs_stg_roster_assignments(id),active boolean not null,category text not null check(category in ('approved_leave','authorized_excuse')),version integer not null check(version>=1),primary key(session_id,roster_id));
create table qs_stg_private.holiday_versions(workspace_id uuid not null,unit_id uuid not null,local_date date not null,version integer not null check(version>=1),classification text not null check(classification in ('regular','special','other','none')),recorded_at timestamptz not null,primary key(workspace_id,unit_id,local_date,version),foreign key(unit_id,workspace_id) references public.qs_stg_units(id,workspace_id));
create table qs_stg_private.workforce_events(actor_id uuid not null references auth.users(id),request_id uuid not null,workspace_id uuid not null,unit_id uuid not null,operation text not null,command_hash bytea not null check(octet_length(command_hash)=32),receipt jsonb not null,recorded_at timestamptz not null,primary key(actor_id,request_id),foreign key(unit_id,workspace_id) references public.qs_stg_units(id,workspace_id));
alter table qs_stg_private.workforce_gate enable row level security;
revoke all on qs_stg_private.workforce_gate from public,anon,authenticated;
alter table qs_stg_private.shift_retirements enable row level security;
revoke all on qs_stg_private.shift_retirements from public,anon,authenticated;
alter table qs_stg_private.shift_versions enable row level security;
revoke all on qs_stg_private.shift_versions from public,anon,authenticated;
alter table qs_stg_private.roster_transfers enable row level security;
revoke all on qs_stg_private.roster_transfers from public,anon,authenticated;
alter table qs_stg_private.shift_leave enable row level security;
revoke all on qs_stg_private.shift_leave from public,anon,authenticated;
alter table qs_stg_private.holiday_versions enable row level security;
revoke all on qs_stg_private.holiday_versions from public,anon,authenticated;
alter table qs_stg_private.workforce_events enable row level security;
revoke all on qs_stg_private.workforce_events from public,anon,authenticated;
create trigger shift_retirements_immutable before update or delete or truncate on qs_stg_private.shift_retirements for each statement execute function qs_stg_private.p3_event_immutable();
create trigger shift_versions_immutable before update or delete or truncate on qs_stg_private.shift_versions for each statement execute function qs_stg_private.p3_event_immutable();
create trigger roster_transfers_immutable before update or delete or truncate on qs_stg_private.roster_transfers for each statement execute function qs_stg_private.p3_event_immutable();
create trigger holiday_versions_immutable before update or delete or truncate on qs_stg_private.holiday_versions for each statement execute function qs_stg_private.p3_event_immutable();
create trigger workforce_events_immutable before update or delete or truncate on qs_stg_private.workforce_events for each statement execute function qs_stg_private.p3_event_immutable();
create or replace function qs_stg_private.onboarding_command(p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $onboard$
declare
 actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); sid uuid; session_end timestamptz;
 op text; request uuid; ws uuid; unit uuid; target uuid; invite_id uuid; token text; name_text text; position_text text;
 allowed text[]; n timestamptz; enabled boolean; zone text; start_at timestamptz; end_at timestamptz; start_offset integer; end_offset integer;
 inv qs_stg_private.employee_invites%rowtype; prior qs_stg_private.onboarding_events%rowtype;
 member public.qs_stg_memberships%rowtype; roster public.qs_stg_roster_assignments%rowtype;
 result jsonb; fingerprint bytea; new_id uuid; roster_id uuid; eligible_count integer;
begin
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>2048 then raise exception 'QS_INVALID'; end if;
 op:=p_body->>'action';
 allowed:=case op
 when 'list' then array['action','workspaceId','unitId']
 when 'invite' then array['action','workspaceId','unitId','requestId','targetUserId','code','displayName','position']
 when 'accept' then array['action','requestId','inviteId','code']
 when 'cancel_invite' then array['action','workspaceId','unitId','requestId','inviteId']
 when 'suspend' then array['action','workspaceId','unitId','requestId','rosterId']
 when 'resume' then array['action','workspaceId','unitId','requestId','rosterId']
 when 'revoke' then array['action','workspaceId','unitId','requestId','rosterId']
 when 'schedule' then array['action','workspaceId','unitId','requestId','localStart','localEnd','startOffset','endOffset']
 else null end;
 if allowed is null or exists(select 1 from jsonb_object_keys(p_body) k where not(k=any(allowed))) or not(p_body ?& allowed) or exists(select 1 from jsonb_each(p_body) e where e.value='null'::jsonb) then raise exception 'QS_INVALID'; end if;
 begin
  request:=(p_body->>'requestId')::uuid;ws:=(p_body->>'workspaceId')::uuid;unit:=(p_body->>'unitId')::uuid;
  target:=(p_body->>'targetUserId')::uuid;invite_id:=(p_body->>'inviteId')::uuid;roster_id:=(p_body->>'rosterId')::uuid;
  start_offset:=(p_body->>'startOffset')::integer;end_offset:=(p_body->>'endOffset')::integer;
  sid:=(claims->>'session_id')::uuid;
 exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'QS_INVALID'; end;
 select g.enabled into enabled from qs_stg_private.onboarding_gate g where singleton for share;
 if enabled is distinct from true then raise exception 'QS_DISABLED'; end if;
 select g.enabled into enabled from qs_stg_private.p3_gate g where singleton for share;
 if enabled is distinct from true then raise exception 'QS_DISABLED'; end if;
 if actor is null or claims->>'role' is distinct from 'authenticated' or claims->>'is_anonymous' is distinct from 'false' then raise exception 'QS_FORBIDDEN'; end if;
 select s.not_after into session_end from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=actor and u.email_confirmed_at is not null for share of s,u;
 if not found then raise exception 'QS_FORBIDDEN'; end if;
 token:=p_body->>'code';
 if op in ('invite','accept') and (token is null or token !~ '^[a-f0-9]{64}$') then raise exception 'QS_INVALID'; end if;
 if op='accept' then
  select * into inv from qs_stg_private.employee_invites i where i.id=invite_id and i.target_user_id=actor and i.code_hash=sha256(convert_to(token,'UTF8'));
  if not found then raise exception 'QS_FORBIDDEN'; end if;
  ws:=inv.workspace_id;unit:=inv.unit_id;
 end if;
 if ws is null or unit is null then raise exception 'QS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('qs-onboarding-workspace:'||ws::text,0));
 n:=clock_timestamp();
 if session_end is not null and session_end<=n then raise exception 'QS_FORBIDDEN'; end if;
 select w.timezone into zone from public.qs_stg_workspaces w join public.qs_stg_units u on u.workspace_id=w.id where w.id=ws and u.id=unit and w.status='active' and u.status='active' for share of w,u;
 if not found then raise exception 'QS_FORBIDDEN'; end if;
 if op<>'accept' then
  if claims->>'aal' is distinct from 'aal2' then raise exception 'QS_FORBIDDEN'; end if;
  perform 1 from public.qs_stg_memberships m join public.qs_stg_role_assignments g on g.membership_id=m.id and g.workspace_id=m.workspace_id
  where m.workspace_id=ws and m.user_id=actor and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n)
  and g.scope_unit_id=unit and g.role in ('level_3','org_admin') and g.starts_at<=n and (g.ends_at is null or g.ends_at>n) order by g.id limit 1 for share of m,g;
  if not found then raise exception 'QS_FORBIDDEN'; end if;
 end if;
 if op='list' then
  return jsonb_build_object('workspaceId',ws,'unitId',unit,'timezone',zone,
   'employees',coalesce((select jsonb_agg(x.item order by x.id) from (select r.id,jsonb_build_object('rosterId',r.id,'name',r.display_name_snapshot,'status',m.status) item from public.qs_stg_roster_assignments r join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id where r.workspace_id=ws and r.unit_id=unit and m.user_id<>actor and not exists(select 1 from public.qs_stg_role_assignments g where g.membership_id=m.id) and not exists(select 1 from qs_stg_private.roster_transfers t where t.old_roster_id=r.id) order by r.id limit 100)x),'[]'::jsonb),
   'invitations',coalesce((select jsonb_agg(x.item order by x.at desc,x.id) from (select i.id,i.issued_at at,jsonb_build_object('inviteId',i.id,'name',i.display_name,'status',case when i.state='pending' and i.expires_at<=n then 'expired' else i.state end,'expiresAt',i.expires_at) item from qs_stg_private.employee_invites i where i.workspace_id=ws and i.unit_id=unit order by i.issued_at desc,i.id limit 30)x),'[]'::jsonb),
   'shifts',coalesce((select jsonb_agg(x.item order by x.at desc,x.id) from (select s.id,s.opens_at at,jsonb_build_object('sessionId',s.id,'opensAt',s.opens_at,'closesAt',s.closes_at,'timezone',h.timezone,'localStart',to_char(h.local_start,'YYYY-MM-DD"T"HH24:MI'),'localEnd',to_char(h.local_end,'YYYY-MM-DD"T"HH24:MI'),'startOffset',h.start_offset,'endOffset',h.end_offset,'eligibleCount',(select count(*) from qs_stg_private.shift_eligibility e where e.session_id=s.id)) item from qs_stg_private.managed_shifts h join qs_stg_private.attendance_sessions s on s.id=h.session_id where s.workspace_id=ws and s.unit_id=unit order by s.opens_at desc,s.id limit 30)x),'[]'::jsonb));
 end if;
 if request is null then raise exception 'QS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('qs-onboarding-request:'||actor::text||':'||request::text,0));
 fingerprint:=sha256(convert_to(p_body::text,'UTF8'));
 select * into prior from qs_stg_private.onboarding_events e where e.actor_id=actor and e.request_id=request;
 if found then
  if prior.command_hash<>fingerprint or prior.workspace_id<>ws or prior.unit_id<>unit then raise exception 'QS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.receipt||jsonb_build_object('replayed',true);
 end if;
 n:=clock_timestamp();
 if session_end is not null and session_end<=n then raise exception 'QS_FORBIDDEN'; end if;
 if op<>'accept' and not exists(select 1 from public.qs_stg_memberships m join public.qs_stg_role_assignments g on g.membership_id=m.id and g.workspace_id=m.workspace_id where m.workspace_id=ws and m.user_id=actor and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n) and g.scope_unit_id=unit and g.role in ('level_3','org_admin') and g.starts_at<=n and (g.ends_at is null or g.ends_at>n)) then raise exception 'QS_FORBIDDEN'; end if;
 if op='invite' then
  name_text:=btrim(p_body->>'displayName');position_text:=btrim(p_body->>'position');
  if target is null or target=actor or char_length(name_text) not between 2 and 60 or char_length(position_text) not between 2 and 80 or not exists(select 1 from auth.users u where u.id=target and u.email_confirmed_at is not null) or exists(select 1 from public.qs_stg_memberships m where m.workspace_id=ws and m.user_id=target and m.status<>'revoked') then raise exception 'QS_FORBIDDEN'; end if;
  if exists(select 1 from qs_stg_private.employee_invites i where i.workspace_id=ws and i.target_user_id=target and i.state='pending' and i.expires_at>n) then raise exception 'QS_CONFLICT'; end if;
  insert into qs_stg_private.employee_invites(workspace_id,unit_id,target_user_id,code_hash,display_name,position,issued_at,expires_at,state)
  values(ws,unit,target,sha256(convert_to(token,'UTF8')),name_text,position_text,n,n+interval '24 hours','pending') returning id into new_id;
  result:=jsonb_build_object('inviteId',new_id,'expiresAt',n+interval '24 hours');
 elsif op in ('accept','cancel_invite') then
  select * into inv from qs_stg_private.employee_invites i where i.id=invite_id and i.workspace_id=ws and i.unit_id=unit for update;
  if not found or inv.state<>'pending' or inv.expires_at<=n then raise exception 'QS_FORBIDDEN'; end if;
  if op='accept' then
   if inv.target_user_id<>actor or inv.code_hash<>sha256(convert_to(token,'UTF8')) or exists(select 1 from public.qs_stg_memberships m where m.workspace_id=ws and m.user_id=actor and m.status<>'revoked') then raise exception 'QS_FORBIDDEN'; end if;
   insert into public.qs_stg_memberships(workspace_id,user_id,status,starts_at) values(ws,actor,'active',n) returning id into new_id;
   insert into public.qs_stg_roster_assignments(membership_id,workspace_id,unit_id,display_name_snapshot,position_snapshot) values(new_id,ws,unit,inv.display_name,inv.position) returning id into roster_id;
   update qs_stg_private.employee_invites set state='accepted',closed_at=n where id=invite_id;
   result:=jsonb_build_object('inviteId',invite_id,'membershipId',new_id,'rosterId',roster_id);
  else
   update qs_stg_private.employee_invites set state='revoked',closed_at=n where id=invite_id;
   result:=jsonb_build_object('inviteId',invite_id,'status','revoked');
  end if;
  new_id:=invite_id;
 elsif op in ('suspend','resume','revoke') then
  select * into roster from public.qs_stg_roster_assignments r where r.id=roster_id and r.workspace_id=ws and r.unit_id=unit for update;
  if not found or exists(select 1 from qs_stg_private.roster_transfers t where t.old_roster_id=roster.id) then raise exception 'QS_FORBIDDEN'; end if;
  select * into member from public.qs_stg_memberships m where m.id=roster.membership_id and m.workspace_id=ws for update;
  if not found or member.user_id=actor or member.status='revoked' or member.starts_at>n or (member.ends_at is not null and member.ends_at<=n) or exists(select 1 from public.qs_stg_role_assignments g where g.membership_id=member.id) or (select count(*) from public.qs_stg_roster_assignments r where r.membership_id=member.id and r.status='active')>1 then raise exception 'QS_FORBIDDEN'; end if;
  if (op='suspend' and member.status<>'active') or (op='resume' and member.status<>'suspended') or (op='revoke' and member.status not in ('active','suspended')) then raise exception 'QS_CONFLICT'; end if;
  update public.qs_stg_memberships set status=case op when 'suspend' then 'suspended' when 'resume' then 'active' else 'revoked' end,ends_at=case when op='revoke' then greatest(n,starts_at+interval '1 microsecond') else ends_at end where id=member.id;
  update public.qs_stg_roster_assignments set status=case when op='resume' then 'active' else 'inactive' end where id=roster.id;
  new_id:=roster.id;result:=jsonb_build_object('rosterId',new_id,'status',case op when 'suspend' then 'suspended' when 'resume' then 'active' else 'revoked' end);
 else
  if jsonb_typeof(p_body->'startOffset')<>'number' or jsonb_typeof(p_body->'endOffset')<>'number' then raise exception 'QS_INVALID'; end if;
  start_at:=qs_stg_private.shift_instant(p_body->>'localStart',start_offset,zone);end_at:=qs_stg_private.shift_instant(p_body->>'localEnd',end_offset,zone);
  if start_at<=n or start_at>n+interval '90 days' or end_at<=start_at or end_at>start_at+interval '24 hours' then raise exception 'QS_INVALID'; end if;
  if exists(select 1 from qs_stg_private.attendance_sessions s where s.workspace_id=ws and s.unit_id=unit and s.opens_at<end_at and s.closes_at>start_at and not exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=s.id)) then raise exception 'QS_CONFLICT'; end if;
  insert into qs_stg_private.attendance_sessions(workspace_id,unit_id,opens_at,closes_at) values(ws,unit,start_at,end_at) returning id into new_id;
  insert into qs_stg_private.managed_shifts(session_id,timezone,local_start,local_end,start_offset,end_offset,created_at) values(new_id,zone,(p_body->>'localStart')::timestamp,(p_body->>'localEnd')::timestamp,start_offset,end_offset,n);
  insert into qs_stg_private.shift_eligibility(session_id,roster_id,membership_id)
  select new_id,r.id,m.id from public.qs_stg_roster_assignments r join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id
   where r.workspace_id=ws and r.unit_id=unit and r.status='active' and m.status='active' and m.starts_at<=start_at and (m.ends_at is null or m.ends_at>=end_at);
  get diagnostics eligible_count=row_count;
  if eligible_count=0 then raise exception 'QS_CONFLICT'; end if;
  result:=jsonb_build_object('sessionId',new_id,'opensAt',start_at,'closesAt',end_at,'eligibleCount',eligible_count);
 end if;
 result:=result||jsonb_build_object('workspaceId',ws,'unitId',unit,'action',op,'replayed',false);
 insert into qs_stg_private.onboarding_events(actor_id,request_id,workspace_id,unit_id,operation,target_id,command_hash,receipt,recorded_at) values(actor,request,ws,unit,op,new_id,fingerprint,result,n);
 return result;
end;
$onboard$;

create or replace function qs_stg_private.p3_command(p_action text,p_session uuid,p_roster uuid,p_request uuid,
  p_expected integer,p_status text,p_qr text,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $p3$
declare
  actor uuid := auth.uid();
  claims jsonb := auth.jwt();
  auth_session uuid;
  enabled boolean;
  slot qs_stg_private.attendance_sessions%rowtype;
  subject_user uuid;
  subject_id uuid;
  subject_start timestamptz;
  subject_end timestamptz;
  actor_start timestamptz;
  actor_end timestamptz;
  grant_start timestamptz;
  grant_end timestamptz;
  session_end timestamptz;
  current_row qs_stg_private.attendance_current%rowtype;
  prior qs_stg_private.attendance_events%rowtype;
  now_at timestamptz;
  pass_token text;
  pass_expiry timestamptz;
  fingerprint bytea;
  input_hash bytea;
  event_source text;
  event_id uuid;
begin
  if p_action is null or p_action not in ('read','issue','mark') or p_session is null or p_roster is null then
    raise exception 'QS_INVALID';
  end if;
  if p_action <> 'mark' and (p_request is not null or p_expected is not null or p_status is not null or p_qr is not null or p_reason is not null) then
    raise exception 'QS_INVALID';
  end if;
  select g.enabled into enabled from qs_stg_private.p3_gate g where g.singleton for share;
  if enabled is distinct from true then raise exception 'QS_DISABLED'; end if;
  if actor is null or claims->>'role' is distinct from 'authenticated'
      or claims->>'is_anonymous' is distinct from 'false'
      or coalesce(claims->>'session_id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'QS_FORBIDDEN'; end if;
  begin auth_session := (claims->>'session_id')::uuid;
  exception when invalid_text_representation then raise exception 'QS_FORBIDDEN'; end;
  select s.not_after into session_end from auth.sessions s join auth.users a on a.id=s.user_id
    where s.id=auth_session and s.user_id=actor and a.email_confirmed_at is not null
    for share of s,a;
  if not found then raise exception 'QS_FORBIDDEN'; end if;

  select * into slot from qs_stg_private.attendance_sessions s where s.id=p_session for share;
  if not found then raise exception 'QS_FORBIDDEN'; end if;
  select m.user_id,m.id,m.starts_at,m.ends_at into subject_user,subject_id,subject_start,subject_end
    from public.qs_stg_roster_assignments r
    join public.qs_stg_memberships m on m.id=r.membership_id and m.workspace_id=r.workspace_id
    join public.qs_stg_units u on u.id=r.unit_id and u.workspace_id=r.workspace_id
    join public.qs_stg_workspaces w on w.id=r.workspace_id
    where r.id=p_roster and r.workspace_id=slot.workspace_id and r.unit_id=slot.unit_id
      and r.status='active' and m.status='active' and u.status='active' and w.status='active'
    for share of r,m,u,w;
  if not found then raise exception 'QS_FORBIDDEN'; end if;
  -- Managed shifts must use the immutable eligibility snapshot, not today's roster.
  if exists(select 1 from qs_stg_private.managed_shifts where session_id=p_session)
    and (not exists(select 1 from qs_stg_private.onboarding_gate gate where gate.singleton and gate.enabled)
      or not exists(select 1 from qs_stg_private.shift_eligibility where session_id=p_session and roster_id=p_roster)) then
    raise exception 'QS_FORBIDDEN';
  end if;

  if exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=p_session) then raise exception 'QS_FORBIDDEN'; end if;
  if p_action<>'read' and exists(select 1 from qs_stg_private.shift_leave l where l.session_id=p_session and l.roster_id=p_roster and l.active) then raise exception 'QS_FORBIDDEN'; end if;
  if p_action='issue' and actor<>subject_user then raise exception 'QS_FORBIDDEN'; end if;
  if p_action='mark' and actor=subject_user then raise exception 'QS_FORBIDDEN'; end if;
  if actor<>subject_user then
    if claims->>'aal' is distinct from 'aal2' then raise exception 'QS_FORBIDDEN'; end if;
    select m.starts_at,m.ends_at,g.starts_at,g.ends_at into actor_start,actor_end,grant_start,grant_end
      from public.qs_stg_memberships m join public.qs_stg_role_assignments g
        on g.membership_id=m.id and g.workspace_id=m.workspace_id
      where m.user_id=actor and m.workspace_id=slot.workspace_id and m.status='active'
        and g.scope_unit_id=slot.unit_id and g.role in ('level_1','level_2','level_3','org_admin')
        and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp())
        and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())
      order by g.id limit 1 for share of m,g;
    if not found then raise exception 'QS_FORBIDDEN'; end if;
  end if;

  if p_action='mark' then
    if p_request is null or p_expected is null or p_expected<0 or p_expected>1
        or p_status is null or p_status not in ('present','absent') then raise exception 'QS_INVALID'; end if;
    if p_qr is not null then
      if p_qr !~ '^[0-9a-f]{64}$' or p_status<>'present' or p_reason is not null then raise exception 'QS_INVALID'; end if;
      input_hash:=sha256(convert_to(p_qr,'UTF8')); event_source:='qr';
    else
      if p_reason is null or (p_status='present' and p_reason not in ('in_person','roll_call'))
        or (p_status='absent' and p_reason<>'verified_absence') then raise exception 'QS_INVALID'; end if;
      event_source:='manual';
    end if;
    fingerprint:=sha256(convert_to(jsonb_build_array(p_session,p_roster,p_expected,p_status,event_source,p_reason,encode(input_hash,'hex'))::text,'UTF8'));
    perform pg_advisory_xact_lock(hashtextextended('qs-p3-request:'||actor::text||':'||p_request::text,0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('qs-p3-pair:'||p_session::text||':'||p_roster::text,0));
  now_at:=clock_timestamp();
  if (session_end is not null and session_end<=now_at) or subject_start>now_at
    or (subject_end is not null and subject_end<=now_at)
    or (actor<>subject_user and (actor_start>now_at or grant_start>now_at
       or (actor_end is not null and actor_end<=now_at) or (grant_end is not null and grant_end<=now_at))) then
    raise exception 'QS_FORBIDDEN';
  end if;

  select * into current_row from qs_stg_private.attendance_current c where c.session_id=p_session and c.roster_id=p_roster;
  if p_action='read' then
    return jsonb_build_object('sessionId',p_session,'rosterId',p_roster,'status',coalesce(current_row.status,'unmarked'),
      'version',coalesce(current_row.version,0),'recordedAt',current_row.recorded_at);
  end if;
  if p_action='mark' then
    select * into prior from qs_stg_private.attendance_events e where e.actor_id=actor and e.request_id=p_request;
    if found then
      if prior.command_hash<>fingerprint then raise exception 'QS_IDEMPOTENCY_CONFLICT'; end if;
      return jsonb_build_object('sessionId',prior.session_id,'rosterId',prior.roster_id,'status',prior.status,
        'version',prior.version,'recordedAt',prior.recorded_at,'eventId',prior.id,'replayed',true);
    end if;
  end if;
  if now_at<slot.opens_at or now_at>=slot.closes_at then raise exception 'QS_SESSION_CLOSED'; end if;
  if current_row.version is not null or (p_action='mark' and p_expected<>0) then raise exception 'QS_VERSION_CONFLICT'; end if;
  if p_action='issue' then
    pass_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    pass_expiry:=least(now_at+interval '60 seconds',slot.closes_at);
    insert into qs_stg_private.attendance_passes(session_id,roster_id,token_hash,expires_at)
      values(p_session,p_roster,sha256(convert_to(pass_token,'UTF8')),pass_expiry)
      on conflict(session_id,roster_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,consumed_at=null;
    return jsonb_build_object('sessionId',p_session,'rosterId',p_roster,'token',pass_token,'expiresAt',pass_expiry);
  end if;
  if event_source='qr' then
    update qs_stg_private.attendance_passes q set consumed_at=now_at
      where q.session_id=p_session and q.roster_id=p_roster and q.token_hash=input_hash
        and q.consumed_at is null and q.expires_at>now_at;
    if not found then raise exception 'QS_INVALID_PASS'; end if;
  end if;
  insert into qs_stg_private.attendance_current(session_id,roster_id,status,version,recorded_at)
    values(p_session,p_roster,p_status,1,now_at);
  insert into qs_stg_private.attendance_events(actor_id,request_id,session_id,roster_id,status,source,reason,command_hash,version,recorded_at)
    values(actor,p_request,p_session,p_roster,p_status,event_source,p_reason,fingerprint,1,now_at) returning id into event_id;
  return jsonb_build_object('sessionId',p_session,'rosterId',p_roster,'status',p_status,'version',1,
    'recordedAt',now_at,'eventId',event_id,'replayed',false);
end;
$p3$;


create or replace function qs_stg_private.p5_sessions(p_roster uuid) returns jsonb
language plpgsql security definer set search_path='' as $p5$
declare
  item record;
  result jsonb:='[]'::jsonb;
  snapshot jsonb;
  sid uuid;
  active boolean;
begin
  select enabled into active from qs_stg_private.p5_gate where singleton for share;
  if active is distinct from true then raise exception 'QS_DISABLED'; end if;
  select enabled into active from qs_stg_private.p4_gate where singleton for share;
  if active is distinct from true then raise exception 'QS_DISABLED'; end if;
  select enabled into active from qs_stg_private.p3_gate where singleton for share;
  if active is distinct from true then raise exception 'QS_DISABLED'; end if;
  if p_roster is null or auth.uid() is null or not qs_stg_private.roster_visible(p_roster) then raise exception 'QS_FORBIDDEN'; end if;
  if auth.jwt()->>'role' is distinct from 'authenticated' or auth.jwt()->>'is_anonymous' is distinct from 'false' then raise exception 'QS_FORBIDDEN'; end if;
  begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'QS_FORBIDDEN'; end;
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=auth.uid() and u.email_confirmed_at is not null and (s.not_after is null or s.not_after>clock_timestamp()) for share of s,u;
  if not found then raise exception 'QS_FORBIDDEN'; end if;
  -- The candidate query is bounded and never returned without P3 authorization.
  -- P3 locks and validates session, current actor, target and unit for each pair.
  for item in
    select s.id,s.opens_at,s.closes_at
    from qs_stg_private.attendance_sessions s
    join public.qs_stg_roster_assignments r on r.unit_id=s.unit_id and r.workspace_id=s.workspace_id
    where r.id=p_roster and s.opens_at<=clock_timestamp()
      and s.closes_at>=clock_timestamp()-interval '30 days' and not exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=s.id)
      and (not exists(select 1 from qs_stg_private.managed_shifts h where h.session_id=s.id) or (exists(select 1 from qs_stg_private.onboarding_gate gate where gate.singleton and gate.enabled) and exists(select 1 from qs_stg_private.shift_eligibility e where e.session_id=s.id and e.roster_id=p_roster)))
    order by s.opens_at desc,s.id limit 30
  loop
    snapshot:=qs_stg_private.p3_command('read',item.id,p_roster,null,null,null,null,null);
    result:=result||jsonb_build_array(jsonb_build_object('sessionId',item.id,'opensAt',item.opens_at,'closesAt',item.closes_at,'status',snapshot->>'status','version',(snapshot->>'version')::integer));
  end loop;
  return jsonb_build_object('rosterId',p_roster,'sessions',result);
end;
$p5$;


create function qs_stg_private.workforce_command(p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $wf$
declare
 actor uuid:=auth.uid(); op text; ws uuid; unit uuid; req uuid; target uuid; dest uuid; roster_id uuid; session_id uuid;
 n timestamptz; enabled boolean; prior qs_stg_private.workforce_events%rowtype; fingerprint bytea; result jsonb; base jsonb;
 allowed text[]; expected integer; v integer; root uuid; h qs_stg_private.managed_shifts%rowtype; s qs_stg_private.attendance_sessions%rowtype;
 r public.qs_stg_roster_assignments%rowtype; m public.qs_stg_memberships%rowtype; new_roster uuid; new_session uuid;
 start_local timestamp; end_local timestamp; count_weeks integer; i integer; items jsonb:='[]'; day date; first_day date; last_day date; category text; old_leave qs_stg_private.shift_leave%rowtype;
begin
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>2048 then raise exception 'QS_INVALID'; end if;
 op:=p_body->>'action';
 allowed:=case op
 when 'report' then array['action','workspaceId','unitId','fromDate','toDate']
 when 'repeat' then array['action','workspaceId','unitId','requestId','localStart','localEnd','startOffset','endOffset','weeks']
 when 'edit' then array['action','workspaceId','unitId','requestId','sessionId','expectedVersion','localStart','localEnd','startOffset','endOffset']
 when 'cancel' then array['action','workspaceId','unitId','requestId','sessionId','expectedVersion']
 when 'transfer' then array['action','workspaceId','unitId','requestId','rosterId','destinationUnitId']
 when 'leave' then array['action','workspaceId','unitId','requestId','sessionId','rosterId','expectedVersion','category']
 when 'cancel_leave' then array['action','workspaceId','unitId','requestId','sessionId','rosterId','expectedVersion']
 when 'holiday' then array['action','workspaceId','unitId','requestId','localDate','expectedVersion','category']
 else null end;
 if allowed is null or not(p_body ?& allowed) or exists(select 1 from jsonb_object_keys(p_body) k where not(k=any(allowed))) or exists(select 1 from jsonb_each(p_body) e where e.value='null'::jsonb) then raise exception 'QS_INVALID';end if;
 begin ws:=(p_body->>'workspaceId')::uuid;unit:=(p_body->>'unitId')::uuid;req:=(p_body->>'requestId')::uuid;session_id:=(p_body->>'sessionId')::uuid;roster_id:=(p_body->>'rosterId')::uuid;dest:=(p_body->>'destinationUnitId')::uuid;expected:=(p_body->>'expectedVersion')::integer;count_weeks:=(p_body->>'weeks')::integer;exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'QS_INVALID';end;
 select g.enabled into enabled from qs_stg_private.workforce_gate g where singleton for share;
 if enabled is distinct from true then raise exception 'QS_DISABLED';end if;
 -- Existing list performs live session, AAL2, exact unit and workspace locking.
 base:=qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',unit));
 n:=clock_timestamp();
 if op='report' then
  if p_body->>'fromDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or p_body->>'toDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'QS_INVALID';end if;
  first_day:=(p_body->>'fromDate')::date;last_day:=(p_body->>'toDate')::date;
  if last_day<first_day or last_day-first_day>30 then raise exception 'QS_INVALID';end if;
  if (select count(*) from qs_stg_private.managed_shifts h join qs_stg_private.attendance_sessions s on s.id=h.session_id where s.workspace_id=ws and s.unit_id=unit and h.local_start::date between first_day and last_day)>100 then raise exception 'QS_CONFLICT';end if;
  with rows as (
   select a.id,a.opens_at,a.closes_at,h.timezone,h.local_start,h.local_end,coalesce(v.version,1) version,case when t.session_id is not null then 'retired' when a.opens_at>n then 'upcoming' when a.closes_at>n then 'open' else 'completed' end state,
    coalesce((select hv.classification from qs_stg_private.holiday_versions hv where hv.workspace_id=ws and hv.unit_id=unit and hv.local_date=h.local_start::date order by hv.version desc limit 1),'none') holiday,
    (select count(*) from qs_stg_private.shift_eligibility e where e.session_id=a.id) planned,
    (select count(*) from qs_stg_private.shift_eligibility e join qs_stg_private.attendance_current c on c.session_id=e.session_id and c.roster_id=e.roster_id where e.session_id=a.id and c.status='present') present,
    (select count(*) from qs_stg_private.shift_eligibility e join qs_stg_private.attendance_current c on c.session_id=e.session_id and c.roster_id=e.roster_id where e.session_id=a.id and c.status='absent') absent,
    (select count(*) from qs_stg_private.shift_eligibility e join qs_stg_private.shift_leave l on l.session_id=e.session_id and l.roster_id=e.roster_id and l.active where e.session_id=a.id and not exists(select 1 from qs_stg_private.attendance_current c where c.session_id=e.session_id and c.roster_id=e.roster_id)) excused,
    (select count(*) from qs_stg_private.attendance_current c left join qs_stg_private.attendance_events ev on ev.session_id=c.session_id and ev.roster_id=c.roster_id left join qs_stg_private.shift_eligibility e on e.session_id=c.session_id and e.roster_id=c.roster_id left join lateral (select d.resulting_version ver,q.proposed_status status,d.decided_at at from qs_stg_private.correction_decisions d join qs_stg_private.correction_requests q on q.id=d.request_id where d.session_id=c.session_id and d.roster_id=c.roster_id and d.outcome='approved' order by d.resulting_version desc limit 1) last on true where c.session_id=a.id and (ev.id is null or e.roster_id is null or (c.version,c.status,c.recorded_at) is distinct from (coalesce(last.ver,ev.version),coalesce(last.status,ev.status),coalesce(last.at,ev.recorded_at)) or exists(select 1 from qs_stg_private.shift_leave l where l.session_id=c.session_id and l.roster_id=c.roster_id and l.active))) mismatches
   from qs_stg_private.managed_shifts h join qs_stg_private.attendance_sessions a on a.id=h.session_id left join qs_stg_private.shift_versions v on v.session_id=a.id left join qs_stg_private.shift_retirements t on t.session_id=a.id where a.workspace_id=ws and a.unit_id=unit and h.local_start::date between first_day and last_day
  ) select coalesce(jsonb_agg(jsonb_build_object('sessionId',id,'version',version,'state',state,'localStart',to_char(local_start,'YYYY-MM-DD"T"HH24:MI'),'localEnd',to_char(local_end,'YYYY-MM-DD"T"HH24:MI'),'timezone',timezone,'holiday',holiday,'planned',planned,'present',present,'absent',absent,'excused',excused,'unmarked',planned-present-absent-excused,'mismatches',mismatches) order by opens_at,id),'[]'::jsonb) into items from rows;
  return jsonb_build_object('workspaceId',ws,'unitId',unit,'rows',items,'action',op);
 end if;
 if req is null then raise exception 'QS_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('qs-workforce-request:'||actor::text||':'||req::text,0));
 fingerprint:=sha256(convert_to(p_body::text,'UTF8'));
 select * into prior from qs_stg_private.workforce_events e where e.actor_id=actor and e.request_id=req;
 if found then if prior.command_hash<>fingerprint then raise exception 'QS_IDEMPOTENCY_CONFLICT';end if;return prior.receipt||jsonb_build_object('replayed',true);end if;
 n:=clock_timestamp();
 -- Recheck after idempotency lock.
 perform qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',unit));
 if op in ('edit','cancel','leave','cancel_leave') then
  select a.* into s from qs_stg_private.attendance_sessions a join qs_stg_private.managed_shifts h on h.session_id=a.id where a.id=session_id and a.workspace_id=ws and a.unit_id=unit for update of a;
  if not found or s.opens_at<=clock_timestamp() or exists(select 1 from qs_stg_private.shift_retirements t where t.session_id=s.id) or exists(select 1 from qs_stg_private.attendance_current c where c.session_id=s.id) or exists(select 1 from qs_stg_private.attendance_passes q where q.session_id=s.id) then raise exception 'QS_CONFLICT';end if;
 end if;
 if op in ('repeat','edit') then
  if p_body->>'localStart' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' or p_body->>'localEnd' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' then raise exception 'QS_INVALID';end if;
  start_local:=(p_body->>'localStart')::timestamp;end_local:=(p_body->>'localEnd')::timestamp;
  if op='repeat' and (count_weeks is null or count_weeks not between 2 and 8) then raise exception 'QS_INVALID';end if;
  if op='edit' then count_weeks:=1;end if;
 end if;
 if op in ('edit','cancel') then
  select vrow.root_id,vrow.version into root,v from qs_stg_private.shift_versions vrow where vrow.session_id=s.id;
  root:=coalesce(root,s.id);v:=coalesce(v,1);
  if expected is distinct from v or exists(select 1 from qs_stg_private.shift_leave l where l.session_id=s.id and l.active) then raise exception 'QS_CONFLICT';end if;
  insert into qs_stg_private.shift_retirements(session_id,recorded_at) values(s.id,n);
  if op='cancel' then result:=jsonb_build_object('sessionId',s.id,'version',v,'status','cancelled');end if;
 end if;
 if op in ('repeat','edit') then
  for i in 0..count_weeks-1 loop
   base:=qs_stg_private.onboarding_command(jsonb_build_object('action','schedule','workspaceId',ws,'unitId',unit,'requestId',gen_random_uuid(),'localStart',to_char(start_local+make_interval(days=>7*i),'YYYY-MM-DD"T"HH24:MI'),'localEnd',to_char(end_local+make_interval(days=>7*i),'YYYY-MM-DD"T"HH24:MI'),'startOffset',p_body->'startOffset','endOffset',p_body->'endOffset'));
   new_session:=(base->>'sessionId')::uuid;
   insert into qs_stg_private.shift_versions(session_id,root_id,version) values(new_session,case when op='edit' then root else new_session end,case when op='edit' then v+1 else 1 end);
   items:=items||jsonb_build_array(base);
  end loop;
  result:=jsonb_build_object('shifts',items,'version',case when op='edit' then v+1 else 1 end);
 elsif op='transfer' then
  if dest is null or dest=unit then raise exception 'QS_INVALID';end if;
  perform qs_stg_private.onboarding_command(jsonb_build_object('action','list','workspaceId',ws,'unitId',dest));
  select * into r from public.qs_stg_roster_assignments a where a.id=roster_id and a.workspace_id=ws and a.unit_id=unit and a.status='active' for update;
  if not found then raise exception 'QS_FORBIDDEN';end if;
  select * into m from public.qs_stg_memberships a where a.id=r.membership_id and a.status='active' and a.starts_at<=clock_timestamp() and (a.ends_at is null or a.ends_at>clock_timestamp()) for update;
  if not found or m.user_id=actor or exists(select 1 from public.qs_stg_role_assignments g where g.membership_id=m.id) or (select count(*) from public.qs_stg_roster_assignments a where a.membership_id=m.id and a.status='active')<>1 or exists(select 1 from public.qs_stg_roster_assignments a where a.membership_id=m.id and a.unit_id=dest) then raise exception 'QS_FORBIDDEN';end if;
  update public.qs_stg_roster_assignments set status='inactive' where id=r.id;
  insert into public.qs_stg_roster_assignments(membership_id,workspace_id,unit_id,display_name_snapshot,position_snapshot) values(m.id,ws,dest,r.display_name_snapshot,r.position_snapshot) returning id into new_roster;
  insert into qs_stg_private.roster_transfers values(r.id,new_roster,clock_timestamp());
  result:=jsonb_build_object('oldRosterId',r.id,'newRosterId',new_roster,'destinationUnitId',dest);
 elsif op in ('leave','cancel_leave') then
  if not exists(select 1 from qs_stg_private.shift_eligibility e where e.session_id=s.id and e.roster_id=roster_id) then raise exception 'QS_FORBIDDEN';end if;
  select * into old_leave from qs_stg_private.shift_leave l where l.session_id=s.id and l.roster_id=roster_id;
  if expected is distinct from coalesce(old_leave.version,0) or (op='cancel_leave' and old_leave.active is distinct from true) or (op='leave' and old_leave.active is true) then raise exception 'QS_CONFLICT';end if;
  category:=case when op='leave' then p_body->>'category' else old_leave.category end;
  if category not in ('approved_leave','authorized_excuse') then raise exception 'QS_INVALID';end if;
  insert into qs_stg_private.shift_leave values(s.id,roster_id,op='leave',category,coalesce(old_leave.version,0)+1) on conflict on constraint shift_leave_pkey do update set active=excluded.active,category=excluded.category,version=excluded.version;
  result:=jsonb_build_object('sessionId',s.id,'rosterId',roster_id,'version',coalesce(old_leave.version,0)+1,'active',op='leave','category',category);
 elsif op='holiday' then
  if p_body->>'localDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'QS_INVALID';end if;
  day:=(p_body->>'localDate')::date;category:=p_body->>'category';
  if category not in ('regular','special','other','none') then raise exception 'QS_INVALID';end if;
  select coalesce(max(hv.version),0) into v from qs_stg_private.holiday_versions hv where hv.workspace_id=ws and hv.unit_id=unit and hv.local_date=day;
  if expected is distinct from v then raise exception 'QS_CONFLICT';end if;
  insert into qs_stg_private.holiday_versions values(ws,unit,day,v+1,category,n);
  result:=jsonb_build_object('localDate',day,'version',v+1,'category',category);
 end if;
 result:=result||jsonb_build_object('workspaceId',ws,'unitId',unit,'action',op,'replayed',false);
 insert into qs_stg_private.workforce_events values(actor,req,ws,unit,op,fingerprint,result,n);
 return result;
end;
$wf$;
revoke all on function qs_stg_private.workforce_command(jsonb) from public,anon,authenticated;
grant execute on function qs_stg_private.workforce_command(jsonb) to authenticated;
create function public.qs_stg_workforce_command(p_body jsonb) returns jsonb language sql security invoker set search_path='' as $rpc$ select qs_stg_private.workforce_command(p_body) $rpc$;
revoke all on function public.qs_stg_workforce_command(jsonb) from public,anon,authenticated;
grant execute on function public.qs_stg_workforce_command(jsonb) to authenticated;
commit;
