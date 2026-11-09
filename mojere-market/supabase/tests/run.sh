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
$P -d mojere_test -f migrations/20261109000100_mojere_market_marketplace.sql -o /dev/null
$P -d mojere_test -f migrations/20261110000100_mojere_market_selling.sql -o /dev/null
$P -d mojere_test -f migrations/20261111000100_mojere_market_messaging.sql -o /dev/null
$P -d mojere_test -f migrations/20261112000100_mojere_market_business.sql -o /dev/null
$P -d mojere_test -f migrations/20261113000100_mojere_market_fix_listing_dates.sql -o /dev/null
$P -d mojere_test -f migrations/20261114000100_mojere_market_admin.sql -o /dev/null
for t in tests/01_security_tests.sql tests/02_marketplace_tests.sql tests/03_selling_tests.sql tests/04_messaging_tests.sql tests/05_business_tests.sql tests/06_admin_tests.sql; do
  $P -d mojere_test -f "$t" -o /dev/null 2>&1 | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //'
done
echo "Done."
