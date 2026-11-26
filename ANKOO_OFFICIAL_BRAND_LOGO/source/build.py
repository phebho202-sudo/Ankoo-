import os, numpy as np, cairocffi as cairo, geom
from PIL import Image
OUT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREEN='#034915'; WHITE='#FFFFFF'; BLACK='#000000'
TOP, BASE = 531.0, 611.0            # x-height & baseline (reference px)
STEM = 23.0                          # unified vertical stem weight
# ---- master geometry (fitted to reference, then regularised) ----
cx,cy,R,r = 355.0,562.4,51.4,31.7
a = geom.letter_a(cx,cy,R,r,R-r,TOP,944.5,9.5,BASE)      # stem right edge = ring edge, stem inner edge tangent to counter
acc = geom.accent(320.9,488.4,21.8,12.3,45)                    # grave accent, perpendicular to the 45deg cut
n = geom.letter_n(412.6,STEM,523.2,STEM,TOP,BASE,61.5,63.3,31.4,32.8,0.55,549.6,46.2,21.1,22.5,21.8,0.55)
k = geom.letter_k(534.2,STEM,TOP,BASE,565.4,605.7,-1.59,604.9,637.1,1.10)
def O(x0):  # both O's share one drawing; outer & counter concentric
    W,H,oy=163.6,84.9,570.75; t=30.15; ih=36.9
    return geom.letter_o(x0,oy-H/2,x0+W,oy+H/2,52.7,37.6,0.59, x0+t,oy-ih/2,x0+W-t,oy+ih/2,25.0,17.6,0.58)
o1,o2 = O(651.7),O(823.7)
first = geom.op(a,acc,geom.U)
LOGO = [('a',first),('n',n),('k',k),('o1',o1),('o2',o2)]
SYMBOL = [('a',first)]

def bbox(parts):
    import pathops
    xs=[];ys=[]
    for _,p in parts:
        b=p.bounds; xs+= [b[0],b[2]]; ys+=[b[1],b[3]]
    return min(xs),min(ys),max(xs),max(ys)

def layout(parts,W,H,frac_w=None,frac_h=None):
    """scale+offset placing artwork centred on a W x H canvas."""
    x0,y0,x1,y1=bbox(parts); bw,bh=x1-x0,y1-y0
    s=min(W*frac_w/bw if frac_w else 1e9, H*frac_h/bh if frac_h else 1e9)
    return s, W/2-s*(x0+bw/2), H/2-s*(y0+bh/2)

def svg(path,parts,W,H,s,dx,dy,fg,bg=None,title='ANKOO'):
    L=['<?xml version="1.0" encoding="UTF-8"?>',
       f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:g} {H:g}" width="{W:g}" height="{H:g}">',
       f'  <title>{title}</title>']
    if bg: L.append(f'  <rect id="background" width="{W:g}" height="{H:g}" fill="{bg}"/>')
    L.append(f'  <g id="ankoo-logo" fill="{fg}">')
    for name,p in parts:
        d=geom.svgd(p,s=1,prec=3) if False else None
        # transform points: (x*s+dx, y*s+dy)
        pp=[(v,[(x*s+dx,y*s+dy) for x,y in pts]) for v,pts in p]
        L.append(f'    <path id="{name}" d="{svgd_pts(pp)}"/>')
    L+=['  </g>','</svg>','']
    open(path,'w').write('\n'.join(L))

def fmt(v): s='%.2f'%v; return s.rstrip('0').rstrip('.') if '.' in s else s
def svgd_pts(pp):
    o=[]
    for v,pts in pp:
        v=int(v); T=' '.join(fmt(x)+' '+fmt(y) for x,y in pts)
        o.append({0:'M',1:'L',2:'Q',4:'C',5:'Z'}[v]+T)
    return ''.join(o)

def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def paint(ctx,parts,s,dx,dy,fg,bg,W,H):
    if bg: ctx.set_source_rgb(*hexrgb(bg)); ctx.rectangle(0,0,W,H); ctx.fill()
    ctx.save(); ctx.translate(dx,dy); ctx.scale(s,s)
    ctx.set_fill_rule(cairo.FILL_RULE_WINDING)
    for _,p in parts: geom.draw(ctx,p)
    ctx.set_source_rgb(*hexrgb(fg)); ctx.fill(); ctx.restore()

def png(path,parts,W,H,s,dx,dy,fg,bg,scale):
    sw,sh=round(W*scale),round(H*scale)
    surf=cairo.ImageSurface(cairo.FORMAT_ARGB32,sw,sh); ctx=cairo.Context(surf); ctx.scale(scale,scale)
    paint(ctx,parts,s,dx,dy,fg,bg,W,H); surf.write_to_png(path)
def pdf(path,parts,W,H,s,dx,dy,fg,bg):
    surf=cairo.PDFSurface(path,W,H); ctx=cairo.Context(surf); paint(ctx,parts,s,dx,dy,fg,bg,W,H); surf.finish()
def eps(path,parts,W,H,s,dx,dy,fg,bg):
    surf=cairo.PSSurface(path,W,H); surf.set_eps(True); ctx=cairo.Context(surf); paint(ctx,parts,s,dx,dy,fg,bg,W,H); surf.finish()

if __name__=='__main__':
    for d in ['SVG','PNG','PDF','EPS']: os.makedirs(f'{OUT}/{d}',exist_ok=True)
    # Composition canvases (pt / px units). Logo canvas keeps the reference proportions
    # (1290 x 1159, logo ~53% of width); transparent versions are cropped with even padding.
    x0,y0,x1,y1=bbox(LOGO); bw,bh=x1-x0,y1-y0
    CW,CH=1290,1159; cs,cdx,cdy=layout(LOGO,CW,CH,frac_w=bw/1286)   # same scale as reference
    pad=0.12*bh*1                                                      # clear space
    TW,TH=1200, 1200*(bh+2*pad*1.0)/(bw+2*pad*1.0)
    ts,tdx,tdy=layout(LOGO,TW,TH,frac_w=bw/(bw+2*pad))
    sx0,sy0,sx1,sy1=bbox(SYMBOL)
    SW=SH=1000; ss,sdx,sdy=layout(SYMBOL,SW,SH,frac_h=0.56)            # social avatar safe zone
    TS=1000; ts2,tsdx,tsdy=layout(SYMBOL,TS,TS,frac_h=0.86)
    V=[ # name, parts, canvas, fg, bg, png scale
     ('ankoo-logo-01-primary-white-on-green', LOGO,(CW,CH,cs,cdx,cdy),WHITE,GREEN,3),
     ('ankoo-logo-02-reverse-green-on-white', LOGO,(CW,CH,cs,cdx,cdy),GREEN,WHITE,3),
     ('ankoo-logo-03-white-transparent',      LOGO,(TW,TH,ts,tdx,tdy),WHITE,None,4),
     ('ankoo-logo-04-green-transparent',      LOGO,(TW,TH,ts,tdx,tdy),GREEN,None,4),
     ('ankoo-logo-05-black-transparent',      LOGO,(TW,TH,ts,tdx,tdy),BLACK,None,4),
     ('ankoo-symbol-06-white-on-green',       SYMBOL,(SW,SH,ss,sdx,sdy),WHITE,GREEN,2),
     ('ankoo-symbol-06-green-on-white',       SYMBOL,(SW,SH,ss,sdx,sdy),GREEN,WHITE,2),
     ('ankoo-symbol-06-white-transparent',    SYMBOL,(TS,TS,ts2,tsdx,tsdy),WHITE,None,2),
     ('ankoo-symbol-06-green-transparent',    SYMBOL,(TS,TS,ts2,tsdx,tsdy),GREEN,None,2),
     ('ankoo-symbol-06-black-transparent',    SYMBOL,(TS,TS,ts2,tsdx,tsdy),BLACK,None,2),
    ]
    for name,parts,(W,H,s,dx,dy),fg,bg,sc in V:
        svg(f'{OUT}/SVG/{name}.svg',parts,W,H,s,dx,dy,fg,bg)
        png(f'{OUT}/PNG/{name}.png',parts,W,H,s,dx,dy,fg,bg,sc)
        pdf(f'{OUT}/PDF/{name}.pdf',parts,W,H,s,dx,dy,fg,bg)
        eps(f'{OUT}/EPS/{name}.eps',parts,W,H,s,dx,dy,fg,bg)
    # master: tight artboard, artwork origin at 0,0, logo height-normalised to 100 units
    s=100/bh; svg(f'{OUT}/ankoo-logo-MASTER.svg',LOGO,round(bw*s,2),100,s,-x0*s,-y0*s,GREEN)
    print('scale ref->canvas',cs, 'logo bbox',x0,y0,x1,y1)
