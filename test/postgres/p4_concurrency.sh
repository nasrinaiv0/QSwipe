#!/usr/bin/env bash
set -euo pipefail
: "${PG_CONTAINER:?Missing disposable service}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
sql(){ docker exec -i "$PG_CONTAINER" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d qswipe_test; }
sql <<'SQL'
begin;
set local role authenticated;
select qs_p3_test.claims(2,'aal1');
select qs_p3_test.correction('submit',5,2,50,1,'absent',null,'incorrect_mark');
select qs_p3_test.correction('submit',6,2,60,1,'absent',null,'incorrect_mark');
select qs_p3_test.correction('submit',6,2,61,1,'absent',null,'verified_absence');
commit;
SQL
race(){
 local slot="$1" first="$2" second="$3" checker="$4" expected="$5"
 (
 sql <<SQL
begin;
set local role authenticated;
select qs_p3_test.claims(5,'aal2');
select qs_p3_test.correction('decide',$slot,2,$first,null,null,'approved','verified')->>'replayed';
\echo LOCK_HELD
select pg_sleep(3);
commit;
SQL
 ) >"$tmp/first" 2>&1 &
 local pid=$!
 for i in $(seq 1 100); do
  if grep -q '^LOCK_HELD$' "$tmp/first"; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$tmp/first"; return 1; fi
  sleep .05
 done
 grep -q '^LOCK_HELD$' "$tmp/first"
 local result=0
 sql >"$tmp/second" 2>&1 <<SQL || result=$?
begin;
set local role authenticated;
select qs_p3_test.claims($checker,'aal2');
select qs_p3_test.correction('decide',$slot,2,$second,null,null,'approved','verified')->>'replayed';
commit;
SQL
 wait "$pid"
 grep -q '^false$' "$tmp/first"
 if [[ "$expected" == replay ]]; then
  test "$result" -eq 0; grep -q '^true$' "$tmp/second"
 else
  test "$result" -ne 0; grep -q 'QS_VERSION_CONFLICT' "$tmp/second"
 fi
 echo "P4 concurrent $expected passed"
}
race 5 50 50 5 replay
race 6 60 61 1 conflict
sql <<'SQL'
do $$ begin
 if (select count(*) from qs_stg_private.correction_decisions)<>2 or (select count(*) from qs_stg_private.attendance_current where version=2)<>2 or (select count(*) from qs_stg_private.attendance_events)<>6 then raise exception 'Concurrent decision corrupted ledger'; end if;
end $$;
SQL
echo 'P4 independent-connection approval concurrency assertions passed'
