import numpy as np, subprocess, sys, json, re, wave
# Segment a straight-through read into speech chunks, then align chunks to the 25 script lines
# using the founder's earlier per-line durations as a guide (dynamic programming).
SRC=sys.argv[1]; REF=sys.argv[2]; OUTD=sys.argv[3]; TAG=sys.argv[4]
SR=48000
log=subprocess.run(["ffmpeg","-hide_banner","-i",SRC,"-af","silencedetect=n=-42dB:d=0.35","-f","null","-"],capture_output=True,text=True).stderr
st=[float(x) for x in re.findall(r"silence_start: ([0-9.]+)",log)]; en=[float(x) for x in re.findall(r"silence_end: ([0-9.]+)",log)]
dur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",SRC],capture_output=True,text=True).stdout)
sil=list(zip(st,en+[dur]*(len(st)-len(en))))
chunks=[]; prev=0.0
for a,b in sil:
    if a-prev>0.12: chunks.append((prev,a))
    prev=b
if dur-prev>0.12: chunks.append((prev,dur))
ref=json.load(open(REF)); ref={int(k):v for k,v in ref.items()}
lines=list(range(1,25))  # 24 includes 25 (one take)
rd=np.array([ref[k][1]-ref[k][0] for k in lines]); total_speech=sum(b-a for a,b in chunks)
rd=rd/rd.sum()*total_speech
n=len(chunks); m=len(lines); INF=1e18
cost=np.full((m+1,n+1),INF); back=np.zeros((m+1,n+1),int); cost[0,0]=0
for i in range(1,m+1):
    for j in range(i,n+1):
        for k in range(i-1,j):
            if cost[i-1,k]>=INF: continue
            g=chunks[j-1][1]-chunks[k][0]  # span incl. inner pauses
            sp=sum(b-a for a,b in chunks[k:j])
            gap_after=(chunks[j][0]-chunks[j-1][1]) if j<n else 1.5
            c=cost[i-1,k]+((sp-rd[i-1])/max(rd[i-1],0.5))**2 - 0.15*min(gap_after,2.0)
            if c<cost[i,j]: cost[i,j]=c; back[i,j]=k
j=n; seg={}
for i in range(m,0,-1):
    k=back[i,j]; seg[lines[i-1]]=(chunks[k][0],chunks[j-1][1]); j=k
# rebuild audio with designed pauses between lines, inner pauses capped at 0.6 s
raw=subprocess.run(["ffmpeg","-v","error","-i",SRC,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
A=np.frombuffer(raw,np.float32)
GAPS={1:1.4,2:0.7,3:0.6,4:1.0,5:0.6,6:1.1,7:0.45,8:0.9,9:0.6,10:2.0,11:0.9,12:0.9,13:1.2,14:0.8,15:0.8,16:0.45,17:1.0,18:2.2,19:0.7,20:0.7,21:0.45,22:1.0,23:2.0,24:0.0}
fade=int(0.012*SR); out=[np.zeros(int(0.8*SR),np.float32)]; t=0.8; tl={}
for ln in lines:
    a,b=seg[ln]; inner=[c for c in chunks if c[0]>=a-1e-6 and c[1]<=b+1e-6]
    tl[ln]=[t,0]
    for ci,(x0,x1) in enumerate(inner):
        x=A[int(max(0,x0-0.06)*SR):int(min(dur,x1+0.12)*SR)].copy(); r=np.linspace(0,1,fade,dtype=np.float32); x[:fade]*=r; x[-fade:]*=r[::-1]
        out.append(x); t+=len(x)/SR
        if ci<len(inner)-1:
            g=min(0.6,inner[ci+1][0]-x1); out.append(np.zeros(int(max(0.12,g)*SR),np.float32)); t+=max(0.12,g)
    tl[ln][1]=t; g=GAPS[ln]; out.append(np.zeros(int(g*SR),np.float32)); t+=g
out.append(np.zeros(int(0.5*SR),np.float32)); y=np.concatenate(out)
w=wave.open(f"{OUTD}/EP04_VO_edit_{TAG}.wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(y,-1,1)*32767).astype("<i2").tobytes()); w.close()
json.dump(tl,open(f"{OUTD}/EP04_VO_edit_{TAG}_lines.json","w"))
print(f"chunks {n}, out {len(y)/SR:.2f}s")
for ln in lines: print(ln, "src %.2f-%.2f"%seg[ln], "-> out %.2f-%.2f"%tuple(tl[ln]), "ref %.2f"%rd[ln-1])
