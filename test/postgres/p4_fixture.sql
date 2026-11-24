\set ON_ERROR_STOP on
begin;
create function qs_p3_test.correction(action text,slot integer,roster integer,request integer default null,expected integer default null,mark text default null,outcome text default null,reason text default null)
returns jsonb language sql security invoker as $$
 select public.qs_stg_p4_command(action,qs_p3_test.id('slot',slot),qs_p3_test.id('roster',roster),qs_p3_test.id('correction',request),expected,mark,outcome,reason)
$$;
create function qs_p3_test.correction_error(want text,action text,slot integer,roster integer,request integer default null,expected integer default null,mark text default null,outcome text default null,reason text default null)
returns void language plpgsql security invoker as $$
begin
 begin
  perform qs_p3_test.correction(action,slot,roster,request,expected,mark,outcome,reason);
  raise exception 'Expected correction denial';
 exception when raise_exception then if sqlerrm<>want then raise; end if;
 end;
end $$;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.correction_error('QS_DISABLED','list',5,2);
reset role;
update qs_stg_private.p4_gate set enabled=true;
-- P3 concurrency fixture already committed initial marks in slots 5 and 6.
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.cmd('mark',1,2,101,0,'present',null,'roll_call');
select qs_p3_test.cmd('mark',2,2,102,0,'present',null,'roll_call');
select qs_p3_test.cmd('mark',3,2,103,0,'present',null,'roll_call');
select qs_p3_test.cmd('mark',4,2,104,0,'present',null,'roll_call');
commit;
