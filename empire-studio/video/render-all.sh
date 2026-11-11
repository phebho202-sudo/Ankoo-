#!/usr/bin/env bash
# Renders a long video in separate segments so that an interruption only loses the segment in progress.
# Usage:  bash render-all.sh <out_dir> <final-name.mp4> [segment_seconds]
# Run it again after an interruption: finished segments are kept and skipped.
set -euo pipefail
OUT="$1"; FINAL="$2"; SEG="${3:-300}"
HERE="$(cd "$(dirname "$0")" && pwd)"
D=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['duration'])")
N=$(python3 -c "import math;print(math.ceil($D/$SEG))")
: > "$OUT/segments.txt"
for i in $(seq 0 $((N-1))); do
  DIR="$OUT/seg$i"
  if [ ! -f "$DIR/done" ]; then
    rm -rf "$DIR"
    FROM=$((i*SEG)); TO=$(python3 -c "print(min($D, ($i+1)*$SEG))")
    node "$HERE/render.js" "$OUT/timeline.json" "$DIR" --from "$FROM" --to "$TO" > "$DIR.log" 2>&1
    touch "$DIR/done"
  fi
  echo "file '$(cd "$DIR" && pwd)/picture.mp4'" >> "$OUT/segments.txt"
  echo "segment $((i+1)) of $N done"
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/segments.txt" -c copy "$OUT/picture.mp4"
bash "$HERE/mix.sh" "$OUT" "$FINAL"
