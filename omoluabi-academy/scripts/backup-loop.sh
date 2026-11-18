#!/bin/sh
# Runs inside the "backup" container: one backup at start-up, then every day at 02:30 (TZ).
set -eu
/bin/sh /scripts/backup.sh || echo "backup FAILED" >&2
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) 02:30" +%s 2>/dev/null || echo 0)
  if [ "$next" -le "$now" ]; then next=$((next + 86400)); fi
  if [ "$next" -le 86400 ]; then next=$((now + 86400)); fi  # date -d unsupported: once a day
  sleep $((next - now))
  /bin/sh /scripts/backup.sh || echo "backup FAILED" >&2
done
