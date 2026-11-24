-- P6 review candidate. Disposable CI only. Do not apply remotely without approval.
begin;
create table qs_stg_private.p6_gate(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into qs_stg_private.p6_gate(singleton) values(true);
alter table qs_stg_private.p6_gate enable row level security;
revoke all on qs_stg_private.p6_gate from public,anon,authenticated;
create index p6_requests_page_idx on qs_stg_private.correction_requests(created_at desc,id desc);
create index p6_sessions_workspace_idx on qs_stg_private.attendance_sessions(workspace_id,unit_id,id);
create function qs_stg_private.p6_inbox(p_workspace uuid,p_before_at timestamptz,p_before_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $p6$
declare
 actor uuid:=auth.uid(); sid uuid; active boolean; result jsonb; n timestamptz:=clock_timestamp();
begin
 if p_workspace is null or (p_before_at is null)<>(p_before_id is null) then raise exception 'QS_INVALID'; end if;
 select enabled into active from qs_stg_private.p6_gate where singleton for share;
 if active is distinct from true then raise exception 'QS_DISABLED'; end if;
 select enabled into active from qs_stg_private.p5_gate where singleton for share;
 if active is distinct from true then raise exception 'QS_DISABLED'; end if;
 select enabled into active from qs_stg_private.p4_gate where singleton for share;
 if active is distinct from true then raise exception 'QS_DISABLED'; end if;
 select enabled into active from qs_stg_private.p3_gate where singleton for share;
 if active is distinct from true then raise exception 'QS_DISABLED'; end if;
 if actor is null or auth.jwt()->>'role' is distinct from 'authenticated' or auth.jwt()->>'is_anonymous' is distinct from 'false' or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'QS_FORBIDDEN'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'QS_FORBIDDEN'; end;
 perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=actor and u.email_confirmed_at is not null and (s.not_after is null or s.not_after>n) for share of s,u;
 if not found then raise exception 'QS_FORBIDDEN'; end if;
 if not exists(select 1 from public.qs_stg_memberships m join public.qs_stg_workspaces w on w.id=m.workspace_id join public.qs_stg_role_assignments g on g.membership_id=m.id and g.workspace_id=m.workspace_id join public.qs_stg_units unit on unit.id=g.scope_unit_id and unit.workspace_id=m.workspace_id where m.workspace_id=p_workspace and m.user_id=actor and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n) and w.status='active' and unit.status='active' and g.role in ('level_1','level_2','level_3','org_admin') and g.starts_at<=n and (g.ends_at is null or g.ends_at>n)) then raise exception 'QS_FORBIDDEN'; end if;
 -- Statement snapshot is advisory only. P4 rechecks authorization and version on every decision.
 with eligible as (
  select q.id,q.created_at,jsonb_build_object('requestId',q.id,'sessionId',s.id,'rosterId',r.id,'employee',left(r.display_name_snapshot,60),'baseVersion',q.base_version,'currentVersion',c.version,'originalStatus',q.original_status,'proposedStatus',q.proposed_status,'reason',q.reason,'createdAt',q.created_at) as item
  from qs_stg_private.correction_requests q
  join qs_stg_private.attendance_sessions s on s.id=q.session_id and s.workspace_id=p_workspace
  join public.qs_stg_roster_assignments r on r.id=q.roster_id and r.workspace_id=s.workspace_id and r.unit_id=s.unit_id
  join public.qs_stg_memberships subject on subject.id=r.membership_id and subject.workspace_id=s.workspace_id
  join public.qs_stg_memberships maker on maker.id=q.maker_membership_id and maker.user_id=q.maker_id and maker.workspace_id=s.workspace_id
  join public.qs_stg_workspaces w on w.id=s.workspace_id
  join public.qs_stg_units unit on unit.id=s.unit_id and unit.workspace_id=s.workspace_id
  join qs_stg_private.attendance_current c on c.session_id=s.id and c.roster_id=r.id
  where r.status='active' and subject.status='active' and maker.status='active' and w.status='active' and unit.status='active'
   and subject.user_id<>actor and q.maker_id<>actor
   and subject.starts_at<=n and (subject.ends_at is null or subject.ends_at>n)
   and maker.starts_at<=n and (maker.ends_at is null or maker.ends_at>n)
   and s.closes_at+interval '30 days'>=n
   and not exists(select 1 from qs_stg_private.correction_decisions d where d.request_id=q.id)
   and (p_before_at is null or (q.created_at,q.id)<(p_before_at,p_before_id))
   and exists(select 1 from public.qs_stg_memberships m join public.qs_stg_role_assignments g on g.membership_id=m.id and g.workspace_id=m.workspace_id where m.user_id=actor and m.workspace_id=s.workspace_id and m.status='active' and m.starts_at<=n and (m.ends_at is null or m.ends_at>n) and g.scope_unit_id=s.unit_id and g.role in ('level_1','level_2','level_3','org_admin') and g.starts_at<=n and (g.ends_at is null or g.ends_at>n))
   and (maker.user_id=subject.user_id or exists(select 1 from public.qs_stg_role_assignments g where g.membership_id=maker.id and g.workspace_id=s.workspace_id and g.scope_unit_id=s.unit_id and g.role in ('level_1','level_2','level_3','org_admin') and g.starts_at<=n and (g.ends_at is null or g.ends_at>n)))
  order by q.created_at desc,q.id desc limit 21
 ), page as (select * from eligible order by created_at desc,id desc limit 20)
 select jsonb_build_object('workspaceId',p_workspace,'rows',coalesce((select jsonb_agg(item order by created_at desc,id desc) from page),'[]'::jsonb),'nextCursor',case when (select count(*) from eligible)>20 then (select jsonb_build_object('at',created_at,'id',id) from page order by created_at,id limit 1) else null end) into result;
 return result;
end;
$p6$;
revoke all on function qs_stg_private.p6_inbox(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function qs_stg_private.p6_inbox(uuid,timestamptz,uuid) to authenticated;
create function public.qs_stg_p6_inbox(p_workspace uuid,p_before_at timestamptz,p_before_id uuid) returns jsonb
language sql security invoker set search_path='' as $p6rpc$
 select qs_stg_private.p6_inbox(p_workspace,p_before_at,p_before_id)
$p6rpc$;
revoke all on function public.qs_stg_p6_inbox(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.qs_stg_p6_inbox(uuid,timestamptz,uuid) to authenticated;
commit;
