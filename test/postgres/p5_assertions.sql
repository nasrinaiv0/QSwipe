\set ON_ERROR_STOP on
begin;
create function qs_p3_test.sessions_error(want text,roster integer) returns void language plpgsql security invoker as $$
begin
 begin
  perform public.qs_stg_p5_sessions(qs_p3_test.id('roster',roster));
  raise exception 'Expected denial';
 exception when raise_exception then if sqlerrm<>want then raise; end if;
 end;
end $$;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.sessions_error('QS_DISABLED',2);
reset role;
update qs_stg_private.p5_gate set enabled=true;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
do $$ begin
 if jsonb_array_length(public.qs_stg_p5_sessions(qs_p3_test.id('roster',2))->'sessions')<>7 then raise exception 'Unexpected own sessions'; end if;
 if not exists(select 1 from jsonb_array_elements(public.qs_stg_p5_sessions(qs_p3_test.id('roster',2))->'sessions') e where e->>'sessionId'=qs_p3_test.id('slot',5)::text and e->>'version'='2') then raise exception 'Corrected projection missing'; end if;
end $$;
select qs_p3_test.sessions_error('QS_FORBIDDEN',3);
select qs_p3_test.claims(1,'aal1');
select qs_p3_test.sessions_error('QS_FORBIDDEN',2);
select qs_p3_test.claims(1,'aal2');
do $$ begin if jsonb_array_length(public.qs_stg_p5_sessions(qs_p3_test.id('roster',2))->'sessions')<>7 then raise exception 'Scoped manager sessions missing'; end if; end $$;
select qs_p3_test.sessions_error('QS_FORBIDDEN',3);
select qs_p3_test.sessions_error('QS_FORBIDDEN',4);
reset role;
delete from auth.sessions where id=qs_p3_test.id('auth',1);
set local role authenticated;
select qs_p3_test.sessions_error('QS_FORBIDDEN',2);
reset role;
do $$ begin
 if has_function_privilege('anon','public.qs_stg_p5_sessions(uuid)','EXECUTE') or has_table_privilege('authenticated','qs_stg_private.p5_gate','UPDATE') then raise exception 'Unexpected discovery privileges'; end if;
end $$;
rollback;
\echo 'P5 scoped session discovery authorization assertions passed'
