-- P3 REVIEW CANDIDATE: disposable PostgreSQL only; no remote apply.
begin;
create table qs_stg_private.p3_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into qs_stg_private.p3_gate(singleton) values(true);
create table qs_stg_private.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  unit_id uuid not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  check (closes_at > opens_at and closes_at <= opens_at + interval '24 hours'),
  foreign key(unit_id,workspace_id) references public.qs_stg_units(id,workspace_id)
);
create table qs_stg_private.attendance_current (
  session_id uuid not null references qs_stg_private.attendance_sessions(id),
  roster_id uuid not null references public.qs_stg_roster_assignments(id),
  status text not null check(status in ('present','absent')),
  version integer not null check(version=1),
  recorded_at timestamptz not null,
  primary key(session_id,roster_id)
);
create table qs_stg_private.attendance_passes (
  session_id uuid not null references qs_stg_private.attendance_sessions(id),
  roster_id uuid not null references public.qs_stg_roster_assignments(id),
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  primary key(session_id,roster_id)
);
create table qs_stg_private.attendance_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  session_id uuid not null,
  roster_id uuid not null,
  status text not null check(status in ('present','absent')),
  source text not null check(source in ('qr','manual')),
  reason text,
  command_hash bytea not null check(octet_length(command_hash)=32),
  version integer not null check(version=1),
  recorded_at timestamptz not null,
  unique(actor_id,request_id),
  unique(session_id,roster_id),
  foreign key(session_id,roster_id) references qs_stg_private.attendance_current(session_id,roster_id)
);
alter table qs_stg_private.p3_gate enable row level security;
alter table qs_stg_private.attendance_sessions enable row level security;
alter table qs_stg_private.attendance_current enable row level security;
alter table qs_stg_private.attendance_passes enable row level security;
alter table qs_stg_private.attendance_events enable row level security;
revoke all on qs_stg_private.p3_gate, qs_stg_private.attendance_sessions, qs_stg_private.attendance_current,
  qs_stg_private.attendance_passes, qs_stg_private.attendance_events from public, anon, authenticated;

create function qs_stg_private.p3_event_immutable() returns trigger
language plpgsql security invoker set search_path = '' as $p3audit$
begin
  raise exception 'QS_EVENT_IMMUTABLE';
end;
$p3audit$;
create trigger p3_event_immutable before update or delete or truncate on qs_stg_private.attendance_events
for each statement execute function qs_stg_private.p3_event_immutable();
revoke all on function qs_stg_private.p3_event_immutable() from public, anon, authenticated;

-- All permission-sensitive commands share one entry point. Neither client nor API owns the tables.
create function qs_stg_private.p3_command(p_action text,p_session uuid,p_roster uuid,p_request uuid,
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
revoke all on function qs_stg_private.p3_command(text,uuid,uuid,uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function qs_stg_private.p3_command(text,uuid,uuid,uuid,integer,text,text,text) to authenticated;
create function public.qs_stg_p3_command(p_action text,p_session uuid,p_roster uuid,p_request uuid,
  p_expected integer,p_status text,p_qr text,p_reason text) returns jsonb
language sql security invoker set search_path = '' as $p3rpc$
  select qs_stg_private.p3_command(p_action,p_session,p_roster,p_request,p_expected,p_status,p_qr,p_reason)
$p3rpc$;
revoke all on function public.qs_stg_p3_command(text,uuid,uuid,uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.qs_stg_p3_command(text,uuid,uuid,uuid,integer,text,text,text) to authenticated;
commit;
