import numpy as np, wave, sys, json
# Original Yoruba-rhythm score: agogo 12/8 bell, shekere, low drum, gangan (talking drum) phrases, soft pads.
SR=48000; T=float(sys.argv[2]); N=int(SR*T); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(5)
LINES=json.load(open(sys.argv[3])) if len(sys.argv)>3 else {}
speech=np.zeros(N,bool)
for k,(a,b) in LINES.items(): speech[int(a*SR):int(min(T,b+0.2)*SR)]=True
def add(x,st,g=1.0,pan=0.5):
    a=int(st*SR); n=min(len(x),N-a)
    if n<=0 or a<0: return
    L[a:a+n]+=x[:n]*g*(1-pan)*2*0.5; R[a:a+n]+=x[:n]*g*pan*2*0.5
def agogo(high):
    d=int(0.35*SR); x=np.arange(d)/SR; f=930 if high else 660
    s=(np.sin(2*np.pi*f*x)+0.6*np.sin(2*np.pi*f*2.76*x)+0.3*np.sin(2*np.pi*f*5.4*x))*np.exp(-x/0.07)
    return s*np.minimum(1,x/0.001)
def shekere(acc):
    d=int(0.12*SR); x=np.arange(d)/SR; n=rng.standard_normal(d)
    n=np.convolve(n,np.array([1,-1.6,0.7]),'same')  # crude high-pass/band emphasis
    return n*np.exp(-x/(0.035 if acc else 0.02))*np.minimum(1,x/0.004)*(1.0 if acc else 0.55)
def lowdrum():
    d=int(0.6*SR); x=np.arange(d)/SR; f=78*np.exp(-x/0.4)+52
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x/0.22)*np.minimum(1,x/0.003)
def gangan(p0,p1,dur=0.22):
    d=int((dur+0.25)*SR); x=np.arange(d)/SR
    f=np.where(x<dur,p0+(p1-p0)*np.clip(x/dur,0,1),p1); ph=2*np.pi*np.cumsum(f)/SR
    s=(np.sin(ph)+0.35*np.sin(2.3*ph)+0.15*np.sin(3.6*ph))*np.exp(-x/0.18)
    s+=rng.standard_normal(d)*np.exp(-x/0.008)*0.25
    return s*np.minimum(1,x/0.002)
TONE={'L':170,'M':215,'H':275}
def phrase(st,tones,step=0.2,g=0.5,pan=0.4):
    for i,tn in enumerate(tones):
        a=TONE[tn[0]]; b=TONE[tn[-1]]
        add(gangan(a,b,0.16 if len(tn)==1 else 0.26),st+i*step,g,pan)
# tempo: 12/8, eighth = 0.27 s, bar = 12 eighths
E8=0.27; BAR=12*E8
BELL=[0,2,4,5,7,9,11]; HIGH={0,5,7}
TEASE=float(sys.argv[4]); V0=float(sys.argv[5])
def level(tt):
    # groove level per section: intro soft, build through vision, out at teaser
    if tt<14: return 0.35
    if tt<V0: return 0.6
    if tt<TEASE: return 0.8
    return 0.0
nb=int(TEASE/BAR)+1
for b in range(nb):
    b0=b*BAR
    for i in range(12):
        tt=b0+i*E8
        if tt>=TEASE-0.3: break
        lv=level(tt)
        if tt>6 and i in BELL: add(agogo(i in HIGH),tt,0.10*lv,0.62)
        add(shekere(i%3==0),tt,0.11*lv,0.38)
        if tt>14 and i in (0,6): add(lowdrum(),tt,0.30*lv,0.5)
# gangan phrases in the gaps between narration lines (speech-like tone patterns)
pats=[['L','M','H','H'],['H','M','L'],['M','M','H','LH'],['H','L','M','L'],['L','H','L'],['M','H','HL','L']]
k=0; tt=0.2
while tt<TEASE-1.5:
    a=int(tt*SR); b=int((tt+1.0)*SR)
    if not speech[a:b].any():
        phrase(tt,pats[k%len(pats)],0.19,0.42 if tt>14 else 0.5); k+=1; tt+=3.2
    else: tt+=0.25
# soft pad bed (Dm9 / Bbmaj7 / Gm9 / Asus)
def hz(n): return 440*2**((n-69)/12)
prog=[[38,50,53,57,64],[34,46,50,53,57],[31,43,46,50,57],[33,45,50,52,57]]
st=0.0; ci=0
while st<TEASE:
    du=min(9.5,TEASE+1-st); x=t[int(st*SR):int(min(T,st+du)*SR)]-st
    e=np.minimum(1,x/2.5)*np.minimum(1,np.maximum(0,(du-x)/2.0))
    s=sum(np.sin(2*np.pi*hz(n)*x)+0.3*np.sin(4*np.pi*hz(n)*x) for n in prog[ci%4])*e*0.022
    a=int(st*SR); L[a:a+len(s)]+=s; R[a:a+len(s)]+=s; st+=9.0; ci+=1
# teaser: silence, then a single low drum + gangan saying À-NKÓ-Ò at the logo
add(lowdrum(),TEASE+0.2,0.35)
LOGO=float(sys.argv[6])
phrase(LOGO,['L','H','L'],0.32,0.75,0.5)
add(lowdrum(),LOGO+1.4,0.25)
# reverb
ir_n=int(1.6*SR); xi=np.arange(ir_n)/SR
def ir(seed):
    r=np.random.default_rng(seed).standard_normal(ir_n)*np.exp(-xi/0.45); r[0]=0; return r/np.sqrt((r**2).sum())
def conv(a,h):
    n=1<<int(np.ceil(np.log2(len(a)+len(h)))); return np.fft.irfft(np.fft.rfft(a,n)*np.fft.rfft(h,n),n)[:len(a)]
L=0.75*L+0.35*conv(L,ir(1)); R=0.75*R+0.35*conv(R,ir(2))
f=np.clip(t/1.5,0,1)*np.clip((T-t)/1.5,0,1); L*=f; R*=f
pk=max(abs(L).max(),abs(R).max()); L*=0.75/pk; R*=0.75/pk
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([L,R],1)*32767).astype('<i2').tobytes()); w.close(); print('ok')
