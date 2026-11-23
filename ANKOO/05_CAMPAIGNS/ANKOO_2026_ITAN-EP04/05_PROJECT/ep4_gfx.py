import sys, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=sys.argv[1]; VOJ=sys.argv[2]; LOGO=sys.argv[3]; B=sys.argv[4] if len(sys.argv)>4 else f"{S}/build_ep4"
import os; os.makedirs(B,exist_ok=True)
IV=(242,235,221,255)
INTER="/usr/share/fonts/opentype/inter/Inter-Light.otf"; INTERM="/usr/share/fonts/opentype/inter/Inter-Medium.otf"
import unicodedata
def clusters(s):
    s=unicodedata.normalize("NFC",s); out=[]
    for ch in s:
        if out and unicodedata.combining(ch): out[-1]+=ch
        else: out.append(ch)
    return out
def spaced(d,y,text,font,track):
    cl=clusters(text); w=sum(d.textlength(c,font=font) for c in cl)+track*(len(cl)-1); x=(1080-w)/2
    for c in cl: d.text((x,y),c,font=font,fill=IV); x+=d.textlength(c,font=font)+track
def halo(im):
    a=im.split()[3]; h=a.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(14)).point(lambda v:int(v*0.55))
    sh=Image.new("RGBA",im.size,(6,6,5,0)); sh.putalpha(h); return Image.alpha_composite(sh,im)
# title card (top third)
T=Image.new("RGBA",(1080,1920),(0,0,0,0)); d=ImageDraw.Draw(T)
spaced(d,300,"ÌTÀN ÀNKÓÒ",ImageFont.truetype(INTERM,46),14)
spaced(d,368,"ÌPÍN KẸRIN",ImageFont.truetype(INTER,30),10)
d.line((500,422,580,422),fill=(242,235,221,200),width=1)
spaced(d,440,"Ìran Náà àti Ìbẹ̀rẹ̀ ÀNKÓÒ",ImageFont.truetype(INTER,34),2)
spaced(d,490,"The Vision and the Beginning of ANKOO",ImageFont.truetype(INTER,24),3)
halo(T).save(f"{B}/title.png")
# end card
E=Image.new("RGBA",(1080,1920),(0,0,0,0)); lg=Image.open(LOGO).convert("RGBA"); w=500; lg=lg.resize((w,int(lg.height*w/lg.width)),Image.LANCZOS)
E.paste(lg,((1080-w)//2,840-lg.height//2),lg); d=ImageDraw.Draw(E)
spaced(d,960,"THE MOMENT THAT DEFINES A MAN.",ImageFont.truetype(INTER,26),6)
spaced(d,1250,"Ìpín Karùn-ún ń bọ̀",ImageFont.truetype(INTER,34),2)
spaced(d,1300,"Episode 5 coming soon",ImageFont.truetype(INTER,24),3)
E.save(f"{B}/endcard.png")
# subtitles (ASS)
L=json.load(open(VOJ)); L={int(k):v for k,v in L.items()}
EN={1:"What exactly did I see?",2:"In the last episode, I told you I saw an opportunity.",3:"Today, let me tell you what I saw.",
4:"You know that we Nigerians love to dress well.",5:"At weddings, at introductions, at birthdays… every occasion that matters to us.",
6:"And wearing matching outfits together is part of our culture.",7:"But I saw that we could still do it much better.",
8:["How it is designed, how it is made,","how it is presented, and how people see it."],9:"I wanted to be part of changing that.",
10:["I wanted to build a fashion house that would give our traditional fashion","greater sophistication, proper structure, creativity…","and a refined luxury experience."],
11:"For the name, I wanted something with real meaning in our culture.",12:"We all know this saying: “E ja se Ankoo.”",
13:"It means coming together and wearing matching outfits.",14:"It is unity.",15:"It is togetherness.",16:"It shows who we are.",
17:"And it shows that we belong to one another.",18:"That is why I named it ANKOO.",19:"But my vision went beyond simply making traditional clothes.",
20:"I wanted to elevate Nigerian traditional fashion.",21:"I wanted us to celebrate who we are, with pride.",
22:"And to present it the way it deserves, with sophistication and respect.",
23:["I want ANKOO to become a recognised","contemporary African luxury menswear and lifestyle house."]}
def ts(x):
    h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h}:{m:02d}:{s:05.2f}"
ev=[]
for k,txt in EN.items():
    a,b=L[k]; parts=txt if isinstance(txt,list) else [txt]
    n=len(parts); seg=(b-a)/n
    for i,p in enumerate(parts): ev.append((a+i*seg-0.1,a+(i+1)*seg+0.25,p))
a,b=L[24]; m=a+0.47*(b-a); ev.append((a-0.1,m,"But seeing a vision is one thing.")); ev.append((m+0.3,b+0.3,"Building it… that is another story."))
ev.sort()
ev=[(a,min(b,ev[i+1][0]-0.02) if i+1<len(ev) else b,t) for i,(a,b,t) in enumerate(ev)]
hdr="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter Medium,44,&H00DDEBF2,&H00DDEBF2,&H70060606,&H00000000,0,0,0,0,100,100,0.5,0,1,3,0,2,110,110,450,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines=[f"Dialogue: 0,{ts(max(0,a))},{ts(b)},Sub,,0,0,0,,{{\\blur6\\fad(180,180)}}{t}" for a,b,t in ev]
open(f"{B}/subs.ass","w").write(hdr+"\n".join(lines)+"\n")
print(len(ev),"subtitle events")
