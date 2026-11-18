#!/bin/bash
# Usage: assemble_ep4.sh <aof dir> <vo wav> <score wav> <out mp4>
set -e
S="$1"; VO="$2"; SC="$3"; OUT="$4"; B="$S/build_ep4"; T=124
cd "$S/segs_ep4"; ls seg*.mp4 | sort | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt -c copy "$B/base.mp4"
BD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$B/base.mp4"); echo "base $BD"
FO=$(python3 -c "print(round($BD-0.9,2))"); PAD=$(python3 -c "print(round($T-$BD,3))")
img(){ echo "-loop 1 -framerate 30 -t $T -i $1"; }
ffmpeg -hide_banner -loglevel error -y -i "$B/base.mp4" $(img $S/build/grad.png) $(img $B/title.png) $(img $B/endcard.png) -i "$VO" -i "$SC" \
 -filter_complex "
[0:v]fade=in:st=0:d=1.0,fade=out:st=$FO:d=0.9,tpad=stop_mode=add:stop_duration=$PAD:color=0x0E0E0C,format=yuv420p[v0];
[1:v]format=rgba,fade=out:st=$FO:d=0.9:alpha=1[g];
[2:v]format=rgba,fade=in:st=0.6:d=1.0:alpha=1,fade=out:st=5.6:d=0.9:alpha=1[ti];
[3:v]format=rgba,fade=in:st=118.4:d=1.2:alpha=1,fade=out:st=123.0:d=0.9:alpha=1[ec];
[v0][g]overlay=0:0:enable='lt(t,$BD)'[a1];[a1][ti]overlay=0:0:enable='lt(t,7)'[a2];[a2][ec]overlay=0:0:enable='gte(t,118)'[a3];
[a3]ass=$B/subs.ass,trim=duration=$T,format=yuv420p[vout];
[4:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=$T,asplit=2[vo][sc];
[5:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=-13dB[mu];
[mu][sc]sidechaincompress=threshold=0.03:ratio=3:attack=80:release=700[duck];
[duck][vo]amix=inputs=2:normalize=0:duration=longest,atrim=duration=$T,loudnorm=I=-14:TP=-1.5:LRA=8[aout]" \
 -map "[vout]" -map "[aout]" -r 30 -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
 -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t $T "$OUT"
echo done
