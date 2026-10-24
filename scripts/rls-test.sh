#!/usr/bin/env bash
# Proves the RLS/trigger hardening in supabase/schema.sql against a REAL
# throwaway PostgreSQL (needs postgresql-16 binaries; run as root or a user that
# can start postgres). Supabase's auth schema is stubbed in scripts/rls/stubs.sql.
#   - "old" = schema.sql WITHOUT the hardening block  -> the attack must SUCCEED (proves the test is real)
#   - "new" = full schema.sql                         -> the attack must FAIL, legit flows must work
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d); chmod 755 "$D"; PORT=${PGPORT:-5433}
SU=""; [ "$(id -u)" = 0 ] && { chown postgres "$D"; SU="su postgres -c"; }
run() { if [ -n "$SU" ]; then $SU "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $D/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $D/data -m immediate stop >/dev/null" || true; rm -rf "$D"' EXIT
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$HERE")
sed '/^-- SECURITY HARDENING (NextGen 1)/,$d' "$ROOT/supabase/schema.sql" | head -n -1 > "$D/old.sql"; cp "$ROOT/supabase/schema.sql" "$D/new.sql"
cp "$HERE"/rls/*.sql "$D/"; chmod 644 "$D"/*.sql
P="psql -q -h $D -p $PORT"
for DB in old new; do
  run "$P -d postgres -c 'create database $DB'"
  run "$P -d $DB -f $D/stubs.sql" 2>&1 | grep -v 'already exists\|NOTICE' || true
  run "$P -v ON_ERROR_STOP=1 -d $DB -f $D/$DB.sql" 2>&1 | grep -v NOTICE || true
  run "$P -d $DB -c 'grant all on all tables in schema public to authenticated, service_role' -c 'grant usage on schema public to anon, authenticated, service_role' -c 'grant all on all sequences in schema public to authenticated, service_role'"
done
out_old=$(run "$P -t -A -F'|' -d old -f $D/attack.sql" 2>&1 | grep -v NOTICE || true)
out_new=$(run "$P -t -A -F'|' -d new -f $D/attack.sql" 2>&1 | grep -v NOTICE || true)
echo "$out_old" | grep -q 'C reinsert *|owner|t|f' || { echo "FAIL: test is not real — the attack did not work on the OLD schema"; echo "$out_old"; exit 1; }
echo "$out_new" | grep -q 'C reinsert *|user|f|t'  || { echo "FAIL: escalation still possible on NEW schema"; echo "$out_new"; exit 1; }
echo "$out_new" | grep -q 'D feedback *|victim|pending' || { echo "FAIL: feedback spoofing still possible"; echo "$out_new"; exit 1; }
legit_out=$(run "$P -t -A -d new -f $D/legit.sql" 2>&1 || true)
echo "$legit_out" | grep -q "upsert ok *|Nama Baru|user|t|f" || { echo "FAIL: legitimate profile upsert broke"; echo "$legit_out"; exit 1; }
echo "$legit_out" | grep -q "svc vip *|f" || { echo "FAIL: service_role (owner VVIP path) can no longer change is_vip"; echo "$legit_out"; exit 1; }
run "$P -v ON_ERROR_STOP=1 -d new -f $D/new.sql" >/dev/null 2>&1 || { echo "FAIL: schema.sql is not re-runnable"; exit 1; }
echo "OK: old schema exploitable (proof), new schema blocks escalation/unban/feedback spoofing, legit flows work, schema re-runnable"
