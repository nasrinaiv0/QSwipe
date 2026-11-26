-- Review-only. Never apply to an existing project without explicit approval.
begin;
create schema qs_rooms_private;
revoke all on schema qs_rooms_private from public,anon,authenticated;
create table qs_rooms_private.snapshot(singleton boolean primary key default true check(singleton),enabled boolean not null default false,secret_hash bytea,version bigint not null default 0,rooms jsonb not null default '[]'::jsonb check(jsonb_typeof(rooms)='array' and octet_length(rooms::text)<=4194304 and jsonb_array_length(rooms)<=100));
alter table qs_rooms_private.snapshot enable row level security;
revoke all on qs_rooms_private.snapshot from public,anon,authenticated;
insert into qs_rooms_private.snapshot(singleton) values(true);
create function public.qs_room_snapshot(p_secret text,p_op text,p_version bigint,p_rooms jsonb) returns jsonb language plpgsql security definer set search_path='' as $room$
declare row_data qs_rooms_private.snapshot%rowtype;
begin
 if p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then raise exception 'ROOMS_DISABLED';end if;
 select * into row_data from qs_rooms_private.snapshot s where s.singleton for update;
 if row_data.enabled is distinct from true or row_data.secret_hash is null or row_data.secret_hash<>sha256(convert_to(p_secret,'UTF8')) then raise exception 'ROOMS_DISABLED';end if;
 if p_op='load' then return jsonb_build_object('version',row_data.version,'rooms',row_data.rooms);end if;
 if p_op is distinct from 'cas' or p_version is null or p_rooms is null or jsonb_typeof(p_rooms)<>'array' or octet_length(p_rooms::text)>4194304 then raise exception 'INVALID_SNAPSHOT';end if;
 if jsonb_array_length(p_rooms)>100 then raise exception 'INVALID_SNAPSHOT';end if;
 if p_version<>row_data.version then return 'false'::jsonb;end if;
 update qs_rooms_private.snapshot set version=version+1,rooms=p_rooms where singleton;
 return 'true'::jsonb;
end;$room$;
revoke all on function public.qs_room_snapshot(text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.qs_room_snapshot(text,text,bigint,jsonb) to anon;
commit;
