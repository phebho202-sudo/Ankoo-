#!/usr/bin/env bash
# Step 3 of the video pipeline: finish the sound and join it to the picture.
# Usage:  bash mix.sh <out_dir> <final-name.mp4>
# Needs narration.wav, timeline.json and picture.mp4 in <out_dir> (made by narrate.py and render.js).
set -euo pipefail
OUT="$1"; FINAL="$2"; cd "$OUT"
D=$(python3 -c "import json;print(json.load(open('timeline.json'))['duration'])")
FADE=$(python3 -c "print($D-5)")

# Voice: remove rumble, add a little warmth and clarity, even out the volume, set YouTube-friendly loudness.
ffmpeg -y -loglevel error -i narration.wav -ac 2 -af "highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=1.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=160:makeup=3,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000" voice.wav

# Ambient bed: a very quiet low drone made from pure tones, so there is no music licence to worry about.
ffmpeg -y -loglevel error -f lavfi -i "sine=f=55:d=$D" -f lavfi -i "sine=f=82.41:d=$D" -f lavfi -i "sine=f=110:d=$D" -f lavfi -i "sine=f=164.81:d=$D" -f lavfi -i "sine=f=220.3:d=$D" \
  -filter_complex "[0]volume=0.9[a];[1]volume=0.6,tremolo=f=0.11:d=0.5[b];[2]volume=0.45,tremolo=f=0.13:d=0.6[c];[3]volume=0.22,tremolo=f=0.1:d=0.7[d];[4]volume=0.1,tremolo=f=0.17:d=0.8[e];[a][b][c][d][e]amix=inputs=5:normalize=0,lowpass=f=320,aecho=0.8:0.7:900|1300:0.4|0.3,afade=t=in:d=4,afade=t=out:st=$FADE:d=5,volume=-14dB,aresample=48000" -ac 2 pad.wav

ffmpeg -y -loglevel error -i voice.wav -i pad.wav -filter_complex "[0][1]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89:level=disabled" -ar 48000 audio.wav

if [ -f picture.mp4 ]; then
  ffmpeg -y -loglevel error -i picture.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$FINAL"
  echo "Finished: $OUT/$FINAL"
fi
