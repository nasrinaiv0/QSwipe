#!/usr/bin/env bash
# Run only inside the GitHub Actions disposable service. No external endpoints.
set -euo pipefail
: "${PG_CONTAINER:?Missing disposable container}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
sql() { docker exec -i "$PG_CONTAINER" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d qswipe_test; }
race() {
  local slot="$1" first="$2" second="$3" expected="$4"
  (
    sql <<SQL
begin;
set local role authenticated;
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.cmd('mark',$slot,2,$first,0,'present',null,'roll_call')->>'replayed';
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
select qs_p3_test.claims(1,'aal2');
select qs_p3_test.cmd('mark',$slot,2,$second,0,'present',null,'roll_call')->>'replayed';
commit;
SQL
  wait "$pid"
  grep -q '^false$' "$tmp/first"
  if [[ "$expected" == replay ]]; then
    test "$result" -eq 0
    grep -q '^true$' "$tmp/second"
  else
    test "$result" -ne 0
    grep -q 'QS_VERSION_CONFLICT' "$tmp/second"
  fi
  echo "Concurrent case $expected passed"
}
race 5 50 50 replay
race 6 60 61 conflict
sql <<'SQL'
do $$ begin
 if (select count(*) from qs_stg_private.attendance_current)<>2 or
    (select count(*) from qs_stg_private.attendance_events)<>2 then
    raise exception 'Concurrency produced duplicate state or audit events';
 end if;
end $$;
SQL
echo 'P3 independent-connection concurrency assertions passed'
