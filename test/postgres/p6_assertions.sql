\set ON_ERROR_STOP on
begin;
create function qs_p3_test.inbox_error(want text,workspace integer) returns void language plpgsql security invoker as $$
begin
 begin
  perform public.qs_stg_p6_inbox(qs_p3_test.id('workspace',workspace),null,null);
  raise exception 'Expected inbox denial';
 exception when raise_exception then if sqlerrm<>want then raise; end if;
 end;
end $$;
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.inbox_error('QS_DISABLED',1);
reset role;
update qs_stg_private.p5_gate set enabled=true;
update qs_stg_private.p6_gate set enabled=true;
-- Existing pending slot 6 request from P4; add 25 eligible and one self-made.
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.correction('submit',1,2,1000+i,1,'absent',null,'incorrect_mark') from generate_series(1,25)i;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.correction('submit',2,2,2000,1,'absent',null,'incorrect_mark');
do $$
declare first_page jsonb; second_page jsonb; cursor_at timestamptz; cursor_id uuid;
begin
 first_page:=public.qs_stg_p6_inbox(qs_p3_test.id('workspace',1),null,null);
 if jsonb_array_length(first_page->'rows')<>20 or first_page->'nextCursor'='null'::jsonb then raise exception 'First page invalid'; end if;
 cursor_at:=(first_page->'nextCursor'->>'at')::timestamptz;
 cursor_id:=(first_page->'nextCursor'->>'id')::uuid;
 second_page:=public.qs_stg_p6_inbox(qs_p3_test.id('workspace',1),cursor_at,cursor_id);
 if jsonb_array_length(second_page->'rows')<>6 or second_page->'nextCursor'<>'null'::jsonb then raise exception 'Second page invalid: %',second_page; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'rows') a join jsonb_array_elements(second_page->'rows') b on a->>'requestId'=b->>'requestId') then raise exception 'Duplicate page request'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'rows'||second_page->'rows') a where a->>'requestId'=qs_p3_test.id('correction',2000)::text or a->>'rosterId'<>qs_p3_test.id('roster',2)::text) then raise exception 'Inbox scope leaked'; end if;
end $$;
select qs_p3_test.inbox_error('QS_FORBIDDEN',2);
select qs_p3_test.claims(1,'aal1');
select qs_p3_test.inbox_error('QS_FORBIDDEN',1);
select qs_p3_test.claims(2,'aal2');
select qs_p3_test.inbox_error('QS_FORBIDDEN',1);
select qs_p3_test.claims(3,'aal2');
select qs_p3_test.inbox_error('QS_FORBIDDEN',1);
select qs_p3_test.claims(5,'aal2');
do $$ begin
 if not exists(select 1 from jsonb_array_elements(public.qs_stg_p6_inbox(qs_p3_test.id('workspace',1),null,null)->'rows') a where a->>'requestId'=qs_p3_test.id('correction',2000)::text) then raise exception 'Independent checker missing request'; end if;
end $$;
reset role;
update public.qs_stg_memberships set status='revoked' where id=qs_p3_test.id('member',1);
set local role authenticated;
select qs_p3_test.claims(5,'aal2');
do $$ begin
 if exists(select 1 from jsonb_array_elements(public.qs_stg_p6_inbox(qs_p3_test.id('workspace',1),null,null)->'rows') a where a->>'requestId'=qs_p3_test.id('correction',2000)::text) then raise exception 'Revoked maker leaked'; end if;
end $$;
reset role;
delete from auth.sessions where id=qs_p3_test.id('auth',5);
set local role authenticated;
select qs_p3_test.inbox_error('QS_FORBIDDEN',1);
reset role;
do $$ begin
 if has_function_privilege('anon','public.qs_stg_p6_inbox(uuid,timestamptz,uuid)','EXECUTE') or has_table_privilege('authenticated','qs_stg_private.p6_gate','UPDATE') then raise exception 'Unexpected grants'; end if;
end $$;
rollback;
\echo 'P6 scoped inbox pagination and revocation assertions passed'
