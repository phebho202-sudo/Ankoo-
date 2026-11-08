#!/usr/bin/env bash
# TEST ONLY: rebuilds a throwaway practice database and runs the security tests.
# Usage: tests/run.sh "<psql connection options>"   e.g. tests/run.sh "-h /tmp -p 5432 -U postgres"
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql $1 -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists mojere_test" -c "create database mojere_test" >/dev/null
$P -d mojere_test -f tests/00_supabase_stub.sql -o /dev/null 2>&1 | grep -v -E "wal_level|HINT" || true
$P -d mojere_test -f migrations/20261108000100_mojere_market_core.sql -o /dev/null
$P -d mojere_test -f migrations/20261108000200_mojere_market_storage.sql -o /dev/null
$P -d mojere_test -f tests/01_security_tests.sql -o /dev/null 2>&1 | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //'
echo "Done."
