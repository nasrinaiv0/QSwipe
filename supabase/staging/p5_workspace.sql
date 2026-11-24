-- P5 REVIEW CANDIDATE: disposable CI only; no remote apply.
begin;
create table qs_stg_private.p5_gate(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into qs_stg_private.p5_gate(singleton) values(true);
alter table qs_stg_private.p5_gate enable row level security;
revoke all on qs_stg_private.p5_gate from public,anon,authenticated;
create function qs_stg_private.p5_sessions(p_roster uuid) returns jsonb
language plpgsql security definer set search_path='' as $p5$
declare
  item record;
  result jsonb:='[]'::jsonb;
  snapshot jsonb;
begin
  if not exists(select 1 from qs_stg_private.p5_gate where singleton and enabled) then raise exception 'QS_DISABLED'; end if;
  if p_roster is null or auth.uid() is null or not qs_stg_private.roster_visible(p_roster) then raise exception 'QS_FORBIDDEN'; end if;
  -- The candidate query is bounded and never returned without P3 authorization.
  -- P3 locks and validates session, current actor, target and unit for each pair.
  for item in
    select s.id,s.opens_at,s.closes_at
    from qs_stg_private.attendance_sessions s
    join public.qs_stg_roster_assignments r on r.unit_id=s.unit_id and r.workspace_id=s.workspace_id
    where r.id=p_roster and s.opens_at<=clock_timestamp()
      and s.closes_at>=clock_timestamp()-interval '30 days'
    order by s.opens_at desc,s.id limit 30
  loop
    snapshot:=qs_stg_private.p3_command('read',item.id,p_roster,null,null,null,null,null);
    result:=result||jsonb_build_array(jsonb_build_object('sessionId',item.id,'opensAt',item.opens_at,'closesAt',item.closes_at,'status',snapshot->>'status','version',(snapshot->>'version')::integer));
  end loop;
  return jsonb_build_object('rosterId',p_roster,'sessions',result);
end;
$p5$;
revoke all on function qs_stg_private.p5_sessions(uuid) from public,anon,authenticated;
grant execute on function qs_stg_private.p5_sessions(uuid) to authenticated;
create function public.qs_stg_p5_sessions(p_roster uuid) returns jsonb
language sql security invoker set search_path='' as $p5rpc$
 select qs_stg_private.p5_sessions(p_roster)
$p5rpc$;
revoke all on function public.qs_stg_p5_sessions(uuid) from public,anon,authenticated;
grant execute on function public.qs_stg_p5_sessions(uuid) to authenticated;
commit;
