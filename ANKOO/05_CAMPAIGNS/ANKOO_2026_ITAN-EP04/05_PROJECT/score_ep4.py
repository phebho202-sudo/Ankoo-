import numpy as np, wave, sys
# Original ambient score for ITAN ANKOO Ep4. Sections follow the narration timing.
SR=48000; T=float(sys.argv[2]); N=int(SR*T); t=np.arange(N)/SR
rng=np.random.default_rng(11)
def hz(n): return 440*2**((n-69)/12)
def env(st,du,att,rel):
    e=np.zeros(N); a=int(st*SR); b=min(N,int((st+du)*SR)); n=b-a
    if n<=0: return e
    x=np.arange(n)/SR; e[a:b]=np.minimum(1,x/att)*np.minimum(1,np.maximum(0,(du-x)/rel)); return e
def tone(f,h=5,p=1.6,det=0.0):
    s=np.zeros(N)
    for k in range(1,h+1): s+=np.sin(2*np.pi*f*k*(1+det)*t+rng.uniform(0,6.28))/k**p
    return s
L=np.zeros(N); R=np.zeros(N)
prog=[[38,50,53,57,60,64],[34,46,50,53,57],[31,43,46,50,53,57],[33,45,50,52,57]]  # Dm9 Bbmaj7 Gm9 Asus
TEASE=float(sys.argv[3]); ch=0; st=0.0; step=9.0
while st<TEASE-0.5:
    du=min(step+1.5,TEASE-st+1.0); e=env(st,du,2.5,2.0)
    for n in prog[ch%4]:
        a=0.045 if n<45 else 0.03
        L+=e*a*tone(hz(n),det=-0.0015); R+=e*a*tone(hz(n),det=0.0015)
    st+=step; ch+=1
# soft pulse in the middle sections
beat=60/62
for k in range(int((TEASE-26)/beat)):
    s0=26+k*beat; idx=int(s0//step)%4; root=prog[idx][0]
    a=int(s0*SR); n=int(0.9*SR); x=np.arange(min(n,N-a))/SR
    th=(np.sin(2*np.pi*hz(root-12)*x)+0.3*np.sin(2*np.pi*hz(root)*x))*np.exp(-x/0.35)*np.minimum(1,x/0.01)
    g=0.07*min(1,(s0-26)/8)*min(1,max(0,(TEASE-1.5-s0)/4)); L[a:a+len(x)]+=g*th; R[a:a+len(x)]+=g*th
# sparse felt-piano notes
for s0 in np.arange(1.0,TEASE-2,3.4):
    n=int(rng.choice([69,72,74,76,77,81])); a=int(s0*SR); x=np.arange(min(int(4*SR),N-a))/SR
    s=sum(np.sin(2*np.pi*hz(n)*k*x)*np.exp(-x*(1.1+0.9*k))/k**2 for k in range(1,5))*np.minimum(1,x/0.006)*0.07
    p=rng.uniform(0.35,0.65); L[a:a+len(x)]+=s*(1-p); R[a:a+len(x)]+=s*p
# strings for "the vision" section
V0=float(sys.argv[4]); se=env(V0,TEASE-V0,8,1.2)*np.clip((t-V0)/(TEASE-V0),0,1)**1.2
for n in [62,65,69,72]:
    vib=1+0.003*np.sin(2*np.pi*5.2*t+n); s=np.zeros(N)
    for k in range(1,7): s+=np.sin(2*np.pi*hz(n)*k*np.cumsum(vib)/SR)/k**1.2
    L+=se*0.024*s; R+=se*0.024*np.roll(s,240)
# teaser: near-silence, then single low sustained note to the end
ce=env(TEASE+0.3,T-TEASE-0.3,1.5,3.0)
for n,a in [(26,0.15),(38,0.09),(45,0.05)]:
    s=tone(hz(n),h=4,p=1.8); L+=ce*a*s; R+=ce*a*s
ir_n=int(2.8*SR); xi=np.arange(ir_n)/SR
def ir(seed):
    r=np.random.default_rng(seed).standard_normal(ir_n)*np.exp(-xi/0.75); r[0]=0; return r/np.sqrt((r**2).sum())
def conv(a,h):
    n=1<<int(np.ceil(np.log2(len(a)+len(h)))); return np.fft.irfft(np.fft.rfft(a,n)*np.fft.rfft(h,n),n)[:len(a)]
L=0.62*L+0.55*conv(L,ir(1)); R=0.62*R+0.55*conv(R,ir(2))
f=np.clip(t/2.0,0,1)*np.clip((T-t)/2.0,0,1); L*=f; R*=f
pk=max(abs(L).max(),abs(R).max()); L*=0.7/pk; R*=0.7/pk
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([L,R],1)*32767).astype('<i2').tobytes()); w.close(); print('ok')
