import numpy as np, wave, sys
SR=48000; T=50.5; N=int(SR*T); t=np.arange(N)/SR
rng=np.random.default_rng(7)
def hz(n): return 440*2**((n-69)/12)
def env(start,dur,att,rel):
    e=np.zeros(N); a=int(start*SR); b=min(N,int((start+dur)*SR)); n=b-a
    if n<=0: return e
    x=np.arange(n)/SR; v=np.minimum(1,x/att)*np.minimum(1,np.maximum(0,(dur-x)/rel)); e[a:b]=v; return e
def tone(f,h=6,p=1.4,det=0.0):
    s=np.zeros(N)
    for k in range(1,h+1): s+=np.sin(2*np.pi*f*k*(1+det)*t+rng.uniform(0,6.28))/k**p
    return s
L=np.zeros(N); R=np.zeros(N)
D3,F3,A3,C4,E4=50,53,57,60,64
chords=[(0,11.5,[38,50,53,57,60,64]),(11,8.5,[34,46,50,53,57]),(19,8.5,[31,43,46,50,53,57]),(27,8.5,[38,50,53,57,60,64]),(35,5.5,[34,46,50,53,57,62]),(40,3.2,[33,45,50,52,57])]
for st,du,notes in chords:
    e=env(st,du,2.5,2.0)
    for n in notes:
        lo=n<45; a=(0.05 if lo else 0.035)
        L+=e*a*tone(hz(n),h=5,p=1.6,det=-0.0015); R+=e*a*tone(hz(n),h=5,p=1.6,det=0.0015)
# bass pulse 14-42
beat=60/66
for k in range(int((42-14)/beat)):
    st=14+k*beat; root=38 if st<19 or 27<=st<35 else (34 if st<27 and st<19+0 or 35<=st else 31)
    root=38 if (st<19 or 27<=st<35) else (34 if (11<=st<19 or 35<=st<40) else 31)
    a=int(st*SR); n=int(0.9*SR); x=np.arange(min(n,N-a))/SR
    th=(np.sin(2*np.pi*hz(root-12)*x)+0.3*np.sin(2*np.pi*hz(root)*x))*np.exp(-x/0.35)*np.minimum(1,x/0.01)
    g=0.10*min(1,(st-14)/6)
    L[a:a+len(x)]+=g*th; R[a:a+len(x)]+=g*th
# felt-piano notes
pn=[(0.8,69),(3.6,72),(6.9,76),(9.8,74),(12.7,69),(16.0,65),(19.4,70),(22.8,74),(26.1,72),(29.5,76),(33.0,74),(36.4,69),(39.0,74),(41.6,81)]
for st,n in pn:
    a=int(st*SR); x=np.arange(min(int(4*SR),N-a))/SR
    s=sum(np.sin(2*np.pi*hz(n)*k*x)*np.exp(-x*(1.1+0.9*k))/k**2 for k in range(1,5))*np.minimum(1,x/0.006)*0.09
    pan=rng.uniform(0.35,0.65); L[a:a+len(x)]+=s*(1-pan); R[a:a+len(x)]+=s*pan
# strings 25-43 swell
se=env(25,18,6,0.4)*np.clip((t-25)/18,0,1)**1.3
for n in [62,65,69,72]:
    vib=1+0.003*np.sin(2*np.pi*5.2*t+n)
    s=np.zeros(N)
    for k in range(1,7): s+=np.sin(2*np.pi*hz(n)*k*np.cumsum(vib)/SR)/k**1.2
    L+=se*0.028*s; R+=se*0.028*np.roll(s,240)
# closing sound signature 44.0-50.5: low D + A sustained
ce=env(44.0,6.5,1.2,3.0)
for n,a in [(26,0.16),(38,0.10),(45,0.06),(50,0.035)]:
    s=tone(hz(n),h=4,p=1.8); L+=ce*a*s; R+=ce*a*s
# global shape: near-silence 43-44
g=np.ones(N); m=(t>42.6)&(t<44.0); g[m]=np.clip(1-(t[m]-42.6)/0.4,0.04,1); L*=g; R*=g
# reverb
ir_n=int(2.8*SR); x=np.arange(ir_n)/SR
def ir(seed):
    r=np.random.default_rng(seed).standard_normal(ir_n)*np.exp(-x/0.75); r[0]=0; return r/np.sqrt((r**2).sum())
def conv(a,h):
    n=1<<int(np.ceil(np.log2(len(a)+len(h)))); return np.fft.irfft(np.fft.rfft(a,n)*np.fft.rfft(h,n),n)[:len(a)]
Lw=conv(L,ir(1)); Rw=conv(R,ir(2))
L=0.62*L+0.55*Lw; R=0.62*R+0.55*Rw
# fade in/out
fade=np.clip(t/1.5,0,1)*np.clip((T-t)/1.2,0,1); L*=fade; R*=fade
pk=max(abs(L).max(),abs(R).max()); L*=0.7/pk; R*=0.7/pk
st=(np.stack([L,R],1)*32767).astype('<i2')
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
print('ok',T)
