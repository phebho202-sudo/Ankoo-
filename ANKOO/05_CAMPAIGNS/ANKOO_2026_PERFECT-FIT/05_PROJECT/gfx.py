import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; LOGO=sys.argv[2]; B=f"{S}/build"
IV=(242,235,221,255)
def spaced(d,y,text,font,track,fill=IV):
    w=sum(d.textlength(c,font=font) for c in text)+track*(len(text)-1); x=(1080-w)/2
    for c in text: d.text((x,y),c,font=font,fill=fill); x+=d.textlength(c,font=font)+track
def card(name,lines):
    im=Image.new("RGBA",(1080,1920),(0,0,0,0)); d=ImageDraw.Draw(im)
    for y,text,size,track,fn in lines:
        spaced(d,y,text,ImageFont.truetype(f"{B}/{fn}",size),track)
    im.save(f"{B}/{name}.png")
f6="serif600.woff"; f5="serif.woff"
card("cap1",[(1330,"ANKOO",64,18,f6),(1425,"A DIFFERENT STANDARD.",34,9,f5)])
im=Image.open(f"{B}/cap1.png"); d=ImageDraw.Draw(im); d.line((500,1410,580,1410),fill=(242,235,221,200),width=1); im.save(f"{B}/cap1.png")
card("cap2",[(1380,"CRAFTED WITH INTENTION.",40,8,f5)])
card("cap3",[(1350,"MADE FOR YOU.",40,8,f5),(1410,"NEVER ORDINARY.",40,8,f5)])
# bottom gradient for legibility
g=Image.new("RGBA",(1080,1920),(0,0,0,0)); px=g.load()
for y in range(1100,1920):
    a=int(110*min(1,(y-1100)/500)**1.4)
    for x in range(1080): px[x,y]=(8,8,6,a)
g.save(f"{B}/grad.png")
# end card layers
lg=Image.open(LOGO).convert("RGBA"); w=500; lg=lg.resize((w,int(lg.height*w/lg.width)),Image.LANCZOS)
L=Image.new("RGBA",(1080,1920),(0,0,0,0)); L.paste(lg,((1080-w)//2,880-lg.height//2),lg); L.save(f"{B}/end_logo.png")
T=Image.new("RGBA",(1080,1920),(0,0,0,0)); d=ImageDraw.Draw(T)
fi=ImageFont.truetype(f"{B}/serif_it.woff",46)
tw=d.textlength("The Art of African Luxury.",font=fi); d.text(((1080-tw)/2,1000),"The Art of African Luxury.",font=fi,fill=IV); T.save(f"{B}/end_tag.png")
# preview composite
P=Image.new("RGBA",(1080,1920),(14,14,12,255)); P.alpha_composite(L); P.alpha_composite(T); P.convert("RGB").resize((540,960)).save(f"{S}/end_preview.jpg")
P=Image.new("RGBA",(1080,1920),(120,100,60,255)); P.alpha_composite(g); P.alpha_composite(Image.open(f"{B}/cap1.png")); P.convert("RGB").resize((540,960)).save(f"{S}/cap_preview.jpg")
print("ok")
