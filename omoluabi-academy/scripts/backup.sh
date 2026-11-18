#!/bin/sh
# Database backup: a compressed, consistent pg_dump of the whole database (including the audit
# trail), checked by listing its contents, with a SHA-256 checksum next to it.
#
# Uses the standard PostgreSQL variables: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
#   BACKUP_DIR        where to write (default ./backups)
#   BACKUP_KEEP_DAYS  delete this script's own backups older than this (default 14; 0 = keep all)
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
DB="${PGDATABASE:?set PGDATABASE}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/omoluabi-$DB-$STAMP.dump"
TMP="$OUT.part"

pg_dump --format=custom --compress=6 --no-owner --file="$TMP" "$DB"
# A dump that cannot be listed is not a backup.
pg_restore --list "$TMP" > /dev/null
mv "$TMP" "$OUT"
( cd "$BACKUP_DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
echo "backup ok: $OUT ($(wc -c < "$OUT") bytes)"

if [ "$KEEP" -gt 0 ]; then
  # Only files named like this script's output are ever removed.
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'omoluabi-*.dump' -o -name 'omoluabi-*.dump.sha256' \) \
    -mtime +"$KEEP" -print -exec rm -f {} \;
fi
