import numpy as np, subprocess, sys, json, wave
S=sys.argv[1]; SR=48000
def load(p):
    raw=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32)
A=load(f"{S}/EP04_VO_founder_take1_ORIGINAL.m4a"); B=load(f"{S}/EP04_VO_founder_take2_ORIGINAL.m4a")
# (src, start, end, gap_after_seconds, line)
E=[("A",2.58,3.78,1.0,1),("A",4.92,8.66,0.6,2),("A",9.62,11.98,0.0,3),("A",14.12,17.30,0.7,4),
("A",18.46,19.52,0.25,5),("A",20.46,21.62,0.2,5),("A",22.10,23.04,0.25,5),("A",23.20,24.02,0.08,5),("A",26.86,27.82,0.8,5),
("A",29.70,30.28,0.12,6),("A",31.82,32.74,0.1,6),("A",33.84,34.76,0.25,6),("A",35.44,37.14,0.7,6),
("A",37.90,40.95,0.35,7),
("A",41.74,42.62,0.1,8),("A",43.54,44.42,0.3,8),("A",45.48,45.98,0.08,8),("A",47.10,50.26,0.1,8),("A",50.84,51.62,0.04,8),("A",53.14,53.22,0.6,8),
("A",59.14,61.82,0.6,9),
("A",62.86,64.72,0.3,10),("A",65.52,67.96,0.3,10),("A",69.28,70.54,0.2,10),("A",71.08,72.26,0.15,10),("A",72.94,74.92,0.15,10),("A",75.62,76.76,1.4,10),
("A",82.16,83.06,0.15,11),("A",83.58,86.46,0.6,11),
("A",87.02,89.56,0.5,12),("A",90.20,94.08,0.8,13),("A",95.16,95.98,0.7,14),("A",97.02,97.88,0.1,15),("A",98.52,98.88,0.7,15),
("A",102.74,103.90,0.3,16),("A",104.22,107.68,0.7,17),("A",108.16,108.74,0.06,18),("A",110.58,112.00,1.5,18),
("A",113.62,114.96,0.25,19),("A",116.58,118.72,0.5,19),("A",119.24,121.62,0.5,20),("A",122.18,126.30,0.4,21),("A",126.74,130.56,0.2,22),("A",131.40,131.94,0.8,22),
("A",133.02,138.30,0.3,23),("A",138.96,140.72,0.25,23),("A",143.00,145.18,1.6,23),
("B",16.20,22.05,0.0,24)]
import sys as _s
GAPS={1:1.5,2:0.7,4:1.1,5:0.6,6:1.2,7:0.45,8:0.9,9:0.6,10:2.2,11:0.9,12:0.9,13:1.3,14:0.85,15:0.85,16:0.45,17:1.1,18:2.4,19:0.7,20:0.75,21:0.45,22:1.0,23:2.2}
last={}
for i,e in enumerate(E): last[e[4]]=i
E=[(a,b,c,(GAPS[ln] if (i==last[ln] and ln in GAPS) else g),ln) for i,(a,b,c,g,ln) in enumerate(E)]
TAG=_s.argv[2] if len(_s.argv)>2 else "v01"
fade=int(0.015*SR); out=[]; t=0.0; lines={}
for src,a,b,g,ln in E:
    x=(A if src=="A" else B)[int(a*SR):int(b*SR)].copy()
    r=np.linspace(0,1,fade,dtype=np.float32); x[:fade]*=r; x[-fade:]*=r[::-1]
    lines.setdefault(ln,[t,0]); out.append(x); t+=len(x)/SR; lines[ln][1]=t
    out.append(np.zeros(int(g*SR),np.float32)); t+=g
y=np.concatenate([np.zeros(int(0.8*SR),np.float32)]+out+[np.zeros(int(0.5*SR),np.float32)]); lines={k:[v[0]+0.8,v[1]+0.8] for k,v in lines.items()}
w=wave.open(f"{S}/EP04_VO_edit_{TAG}.wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(y,-1,1)*32767).astype("<i2").tobytes()); w.close()
json.dump(lines,open(f"{S}/EP04_VO_edit_{TAG}_lines.json","w"))
print(f"duration {len(y)/SR:.2f}s"); print({k:[round(v[0],2),round(v[1],2)] for k,v in lines.items()})
