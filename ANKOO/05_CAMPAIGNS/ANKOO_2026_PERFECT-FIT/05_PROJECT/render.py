import subprocess, sys, json, os, time
from concurrent.futures import ThreadPoolExecutor
S=sys.argv[1]; SEG=json.load(open(sys.argv[2])); SD=sys.argv[3] if len(sys.argv)>3 else f"{S}/segs"; os.makedirs(SD,exist_ok=True)
TM="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=400,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:param=0.5:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
GR="huesaturation=saturation=-0.28:colors=y:strength=1,eq=contrast=1.07:brightness=-0.03:saturation=0.92:gamma=0.96,colorbalance=rs=0.015:bs=-0.025:rh=0.025:bh=-0.02,vignette=PI/6"
def r(i):
    c,s,od,sp=SEG[i][:4]; cr=SEG[i][4] if len(SEG[i])>4 else None; o=f"{SD}/seg{i:02d}.mp4"; t0=time.time()
    pre=(f"crop=iw*{cr[0]}:ih*{cr[1]}:iw*{cr[2]}:ih*{cr[3]}," if cr else ""); vf=pre+f"scale=1080:1920:flags=lanczos,{TM},{GR},setpts=(PTS-STARTPTS)/{sp},fps=30,trim=duration={od},setpts=PTS-STARTPTS"
    p=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(s),"-t",str(od*sp+0.3),"-i",f"{S}/src/{c}.MOV","-an","-vf",vf,"-c:v","libx264","-preset","medium","-crf","14","-pix_fmt","yuv420p","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709",o],capture_output=True,text=True)
    print(i,c,"ok" if p.returncode==0 else "ERR "+p.stderr[-300:],f"{time.time()-t0:.0f}s",flush=True)
with ThreadPoolExecutor(2) as ex: list(ex.map(r,range(len(SEG))))
print("ALLDONE")
