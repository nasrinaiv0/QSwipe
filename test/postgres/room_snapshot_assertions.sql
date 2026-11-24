\set ON_ERROR_STOP on
begin;
do $$begin if current_database()<>'qswipe_rooms_test' then raise exception 'Disposable DB only';end if;end$$;
set local role anon;
do $$begin begin perform public.qs_room_snapshot(repeat('a',64),'load',null,null);raise exception 'Disabled gate bypass';exception when raise_exception then if sqlerrm<>'ROOMS_DISABLED' then raise;end if;end;end$$;
reset role;
update qs_rooms_private.snapshot set enabled=true,secret_hash=sha256(convert_to(repeat('a',64),'UTF8'));
set local role anon;
do $$begin
 if public.qs_room_snapshot(repeat('a',64),'load',null,null)<>jsonb_build_object('version',0,'rooms','[]'::jsonb) then raise exception 'Initial snapshot wrong';end if;
 if public.qs_room_snapshot(repeat('a',64),'cas',0,'[{"fixture":true}]'::jsonb)<>'true'::jsonb then raise exception 'CAS failed';end if;
 if public.qs_room_snapshot(repeat('a',64),'cas',0,'[]'::jsonb)<>'false'::jsonb then raise exception 'Stale CAS accepted';end if;
 if public.qs_room_snapshot(repeat('a',64),'load',null,null)->>'version'<>'1' then raise exception 'Version mismatch';end if;
 begin perform public.qs_room_snapshot(repeat('b',64),'load',null,null);raise exception 'Invalid secret accepted';exception when raise_exception then if sqlerrm<>'ROOMS_DISABLED' then raise;end if;end;
 begin perform 1 from qs_rooms_private.snapshot;raise exception 'Direct access accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin
 if has_table_privilege('anon','qs_rooms_private.snapshot','SELECT') or has_function_privilege('authenticated','public.qs_room_snapshot(text,text,bigint,jsonb)','EXECUTE') then raise exception 'Unexpected grants';end if;
end$$;
rollback;
\echo 'Room snapshot default gate, secret and CAS assertions passed'
