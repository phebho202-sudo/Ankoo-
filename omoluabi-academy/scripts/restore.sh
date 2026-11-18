#!/bin/sh
# Restore a backup made by backup.sh into a database.
#
#   scripts/restore.sh <file.dump> <target-database> [--yes]
#
# Safe by default: the target must be EMPTY (restore into a new database, check it, then
# switch the application to it). To overwrite a non-empty database you must pass --yes, and
# you should stop the api, worker and beat services first.
# Uses PGHOST, PGPORT, PGUSER, PGPASSWORD for the connection.
set -eu

FILE="${1:?usage: restore.sh <file.dump> <target-database> [--yes]}"
TARGET="${2:?usage: restore.sh <file.dump> <target-database> [--yes]}"
FORCE="${3:-}"

if [ -f "$FILE.sha256" ]; then
  ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" )
else
  echo "warning: no checksum file next to $FILE" >&2
fi
pg_restore --list "$FILE" > /dev/null

TABLES="$(psql -d "$TARGET" -Atc "select count(*) from information_schema.tables where table_schema='public'")"
if [ "$TABLES" != "0" ] && [ "$FORCE" != "--yes" ]; then
  echo "refusing: $TARGET already has $TABLES tables. Restore into an empty database, or pass --yes." >&2
  exit 2
fi

pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$TARGET" "$FILE"
echo "restore ok into $TARGET"
echo "next: run 'alembic upgrade head', then check System > audit trail (/api/v1/system/audit/verify)."
