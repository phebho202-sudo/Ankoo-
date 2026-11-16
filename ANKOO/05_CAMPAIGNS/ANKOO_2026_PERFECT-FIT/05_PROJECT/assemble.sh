#!/bin/bash
set -e
S="$1"; OUT="$2"; B="$S/build"; T=50.5
cd "${SEGDIR:-$S/segs}"; ls seg*.mp4 | sort | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt -c copy "$B/base.mp4"
BD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$B/base.mp4"); echo "base $BD"
FO=$(python3 -c "print(round($BD-0.8,2))"); PAD=$(python3 -c "print(round($T-$BD,3))")
img(){ echo "-loop 1 -framerate 30 -t $T -i $1"; }
ffmpeg -hide_banner -loglevel error -y -i "$B/base.mp4" $(img $B/grad.png) $(img $B/cap1.png) $(img $B/cap2.png) $(img $B/cap3.png) $(img $B/end_logo.png) $(img $B/end_tag.png) \
 -i "$B/score.wav" -i "$B/vo1.mp3" -i "$B/vo2.mp3" -i "$B/vo3.mp3" -i "$B/vo4.mp3" -i "$B/vo5.mp3" -i "$B/vo6.mp3" \
 -filter_complex "
[0:v]fade=in:st=0:d=0.8,fade=out:st=$FO:d=0.8,tpad=stop_mode=add:stop_duration=$PAD:color=0x0E0E0C,format=yuv420p[v0];
[1:v]format=rgba,fade=out:st=$FO:d=0.8:alpha=1[g];
[2:v]format=rgba,fade=in:st=1.2:d=0.7:alpha=1,fade=out:st=5.0:d=0.7:alpha=1[c1];
[3:v]format=rgba,fade=in:st=16.0:d=0.7:alpha=1,fade=out:st=21.3:d=0.7:alpha=1[c2];
[4:v]format=rgba,fade=in:st=36.0:d=0.7:alpha=1,fade=out:st=41.3:d=0.7:alpha=1[c3];
[5:v]format=rgba,fade=in:st=44.3:d=1.2:alpha=1,fade=out:st=49.7:d=0.8:alpha=1[l];
[6:v]format=rgba,fade=in:st=45.9:d=0.9:alpha=1,fade=out:st=49.7:d=0.8:alpha=1[tg];
[v0][g]overlay=0:0:enable='lt(t,$BD)'[a1];[a1][c1]overlay=0:0:enable='between(t,1,6)'[a2];[a2][c2]overlay=0:0:enable='between(t,15.8,22.2)'[a3];
[a3][c3]overlay=0:0:enable='between(t,35.8,42.2)'[a4];[a4][l]overlay=0:0:enable='gte(t,44)'[a5];[a5][tg]overlay=0:0:enable='gte(t,45.7)',trim=duration=$T,format=yuv420p[vout];
[8:a]adelay=600|600[d1];[9:a]adelay=6300|6300[d2];[10:a]adelay=14400|14400[d3];[11:a]adelay=25400|25400[d4];[12:a]adelay=35000|35000[d5];[13:a]adelay=43600|43600[d6];
[d1][d2][d3][d4][d5][d6]amix=inputs=6:normalize=0:duration=longest,highpass=f=80,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=$T,asplit=2[vo][sc];
[7:a]volume=-7dB,aformat=sample_rates=48000:channel_layouts=stereo[mu];
[mu][sc]sidechaincompress=threshold=0.03:ratio=4:attack=60:release=600:makeup=1[duck];
[duck][vo]amix=inputs=2:normalize=0:duration=first,atrim=duration=$T,loudnorm=I=-14:TP=-1.5:LRA=9[aout]" \
 -map "[vout]" -map "[aout]" -r 30 -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
 -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t $T "$OUT"
echo done
