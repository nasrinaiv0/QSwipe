\set ON_ERROR_STOP on
begin;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
do $$ begin if qs_p3_test.cmd('read',1,2)->>'status'<>'unmarked' then raise exception 'Initial state wrong'; end if; end $$;
select qs_p3_test.expect_error('QS_FORBIDDEN','issue',1,1);
select qs_p3_test.expect_error('QS_FORBIDDEN','mark',1,2,1,0,'present',null,'in_person');
select qs_p3_test.expect_error('QS_SESSION_CLOSED','issue',7,2);
select qs_p3_test.cmd('issue',1,2)->>'token' as old_token \gset
select qs_p3_test.cmd('issue',1,2)->>'token' as new_token \gset
select qs_p3_test.cmd('issue',3,2)->>'token' as exp_token \gset
reset role;
update qs_stg_private.attendance_passes set expires_at=clock_timestamp()-interval '1 second' where session_id=qs_p3_test.id('slot',3);
set local role authenticated;
select qs_p3_test.claims(1,'aal1');
select qs_p3_test.expect_error('QS_FORBIDDEN','mark',1,2,1,0,'present',:'new_token');
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.expect_error('QS_FORBIDDEN','mark',1,1,1,0,'present',null,'in_person');
select qs_p3_test.expect_error('QS_FORBIDDEN','read',8,3);
select qs_p3_test.expect_error('QS_FORBIDDEN','read',9,4);
select qs_p3_test.expect_error('QS_INVALID_PASS','mark',1,2,1,0,'present',:'old_token');
select qs_p3_test.expect_error('QS_INVALID_PASS','mark',3,2,1,0,'present',:'exp_token');
select qs_p3_test.expect_error('QS_INVALID_PASS','mark',2,2,1,0,'present',:'new_token');
select qs_p3_test.expect_error('QS_INVALID','mark',2,2,1,0,'absent',null,'in_person');
select qs_p3_test.cmd('mark',1,2,1,0,'present',:'new_token')->>'eventId' as event_id \gset
select qs_p3_test.cmd('mark',1,2,1,0,'present',:'new_token')->>'eventId' = :'event_id' as replay_same \gset
\if :replay_same
\else
 \quit 1
\endif
select qs_p3_test.expect_error('QS_IDEMPOTENCY_CONFLICT','mark',2,2,1,0,'present',null,'in_person');
select qs_p3_test.expect_error('QS_VERSION_CONFLICT','mark',1,2,2,0,'present',:'new_token');
select qs_p3_test.expect_error('QS_VERSION_CONFLICT','mark',2,2,3,1,'absent',null,'verified_absence');
select qs_p3_test.cmd('mark',2,2,3,0,'absent',null,'verified_absence');
do $$ begin
 if qs_p3_test.cmd('read',2,2)->>'status'<>'absent' then raise exception 'Sync state wrong'; end if;
 if has_table_privilege(current_user,'qs_stg_private.attendance_current','INSERT') or has_table_privilege(current_user,'qs_stg_private.attendance_events','SELECT') or has_table_privilege(current_user,'qs_stg_private.attendance_passes','SELECT') then raise exception 'Private data grants leaked'; end if;
end $$;
select qs_p3_test.claims(1,'aal2',true);
select qs_p3_test.expect_error('QS_FORBIDDEN','read',1,2);
select qs_p3_test.claims(1,'aal2');
reset role;
delete from auth.sessions where id=qs_p3_test.id('auth',1);
set local role authenticated;
select qs_p3_test.expect_error('QS_FORBIDDEN','read',1,2);
reset role;
insert into auth.sessions(id,user_id) values(qs_p3_test.id('auth',1),qs_p3_test.id('user',1));
update public.qs_stg_memberships set status='revoked' where id=qs_p3_test.id('member',2);
set local role authenticated;
select qs_p3_test.expect_error('QS_FORBIDDEN','read',1,2);
select qs_p3_test.expect_error('QS_FORBIDDEN','mark',1,2,1,0,'present',:'new_token');
reset role;
update public.qs_stg_memberships set status='revoked' where id=qs_p3_test.id('member',1);
set local role authenticated;
select qs_p3_test.expect_error('QS_FORBIDDEN','read',4,5);
reset role;
do $$ begin
 if (select count(*) from qs_stg_private.attendance_current)<>2 or (select count(*) from qs_stg_private.attendance_events)<>2 then raise exception 'Atomic state/event count mismatch'; end if;
 if (select count(*) from qs_stg_private.attendance_passes where consumed_at is not null)<>1 then raise exception 'QR consumption mismatch'; end if;
 begin update qs_stg_private.attendance_events set status='absent'; raise exception 'Audit mutation succeeded'; exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise; end if; end;
 begin delete from qs_stg_private.attendance_events; raise exception 'Audit deletion succeeded'; exception when raise_exception then if sqlerrm<>'QS_EVENT_IMMUTABLE' then raise; end if; end;
 if has_function_privilege('anon','public.qs_stg_p3_command(text,uuid,uuid,uuid,integer,text,text,text)','EXECUTE') then raise exception 'Anonymous RPC grant'; end if;
end $$;
-- Roll back assertion fixtures so concurrency tests start with an empty ledger.
rollback;
\echo 'P3 isolated authorization, QR, atomic audit and synchronization assertions passed'
