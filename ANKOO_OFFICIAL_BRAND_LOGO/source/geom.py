import math, numpy as np, pathops, cairocffi as cairo
K=0.5522847498

def P(): return pathops.Path()

def poly(pts):
    p=P(); p.moveTo(*pts[0])
    for q in pts[1:]: p.lineTo(*q)
    p.close(); return p

def circle(cx,cy,r):
    p=P(); k=K*r
    p.moveTo(cx+r,cy)
    p.cubicTo(cx+r,cy+k,cx+k,cy+r,cx,cy+r)
    p.cubicTo(cx-k,cy+r,cx-r,cy+k,cx-r,cy)
    p.cubicTo(cx-r,cy-k,cx-k,cy-r,cx,cy-r)
    p.cubicTo(cx+k,cy-r,cx+r,cy-k,cx+r,cy)
    p.close(); return p

def rrect(x0,y0,x1,y1,tl=(0,0),tr=(0,0),br=(0,0),bl=(0,0),k=K):
    """rounded rect, each corner (rx,ry); k = handle ratio (0.552 circle, >0.552 squarer)."""
    p=P()
    p.moveTo(x0+tl[0],y0)
    p.lineTo(x1-tr[0],y0)
    if tr[0]>0: p.cubicTo(x1-tr[0]+k*tr[0],y0,x1,y1-y1+y0+tr[1]-k*tr[1],x1,y0+tr[1])
    p.lineTo(x1,y1-br[1])
    if br[0]>0: p.cubicTo(x1,y1-br[1]+k*br[1],x1-br[0]+k*br[0],y1,x1-br[0],y1)
    p.lineTo(x0+bl[0],y1)
    if bl[0]>0: p.cubicTo(x0+bl[0]-k*bl[0],y1,x0,y1-bl[1]+k*bl[1],x0,y1-bl[1])
    p.lineTo(x0,y0+tl[1])
    if tl[0]>0: p.cubicTo(x0,y0+tl[1]-k*tl[1],x0+tl[0]-k*tl[0],y0,x0+tl[0],y0)
    p.close(); return p

def op(a,b,kind):
    return pathops.op(a,b,kind)
U=pathops.PathOp.UNION; D=pathops.PathOp.DIFFERENCE; I=pathops.PathOp.INTERSECTION

# ---------------- letters ----------------
def letter_a(cx,cy,R,r,sw,stop,cut,gap,base):
    ring=op(circle(cx,cy,R),circle(cx,cy,r),D)
    # stem: below the centre line it is a plain bar; above it, it follows the ring's outer curve
    stem=op(rrect(cx+r,stop,cx+r+sw,base),op(circle(cx,cy,R),rrect(cx-2*R,cy,cx+2*R,base+50),U),I)
    s=op(ring,stem,U)
    # 45deg band:  cut-gap/2 < x+y < cut+gap/2
    c0=cut-gap/2; c1=cut+gap/2; L=400
    band=poly([(c0-cy+L,cy-L),(c1-cy+L,cy-L),(c1-cy-L,cy+L),(c0-cy-L,cy+L)])
    return op(s,band,D)

def accent(cx,cy,L,W,ang):
    a=math.radians(ang); ux,uy=math.cos(a),math.sin(a); vx,vy=-uy,ux
    pts=[(cx+sx*ux*L/2+sy*vx*W/2, cy+sx*uy*L/2+sy*vy*W/2) for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    return poly(pts)

def letter_n(x0,w1,xr,w2,top,base,otlx,otly,otrx,otry,ko,itop,itlx,itly,itrx,itry,ki):
    stem=rrect(x0,top,x0+w1,base)
    arch=rrect(x0,top,xr,base,tl=(otlx,otly),tr=(otrx,otry),k=ko)
    inner=rrect(x0+w1,itop,xr-w2,base+20,tl=(itlx,itly),tr=(itrx,itry),k=ki)
    return op(op(stem,arch,U),inner,D)

def letter_k(x0,w,top,base,a1,a2,s1,b1,b2,s2,ay=562,by=595):
    stem=rrect(x0,top,x0+w,base)
    xl=lambda y:a1+s1*(y-ay); xr=lambda y:a2+s1*(y-ay)
    arm=poly([(xl(top-50),top-50),(xr(top-50),top-50),(xr(by+40),by+40),(xl(by+40),by+40)])
    ll=lambda y:b1+s2*(y-by); lr=lambda y:b2+s2*(y-by)
    leg=poly([(ll(ay-40),ay-40),(lr(ay-40),ay-40),(lr(base+50),base+50),(ll(base+50),base+50)])
    # leg starts where its outer edge meets the arm's outer edge
    yi=(a2-s1*ay-b2+s2*by)/(s2-s1)
    leg=op(leg,rrect(0,yi,2000,base+100),I)
    slab=rrect(x0+w/2,top,2000,base)
    s=op(op(arm,leg,U),slab,I)
    return op(stem,s,U)

def letter_o(x0,y0,x1,y1,rx,ry,k,ix0,iy0,ix1,iy1,irx,iry,ik):
    o=rrect(x0,y0,x1,y1,(rx,ry),(rx,ry),(rx,ry),(rx,ry),k)
    i=rrect(ix0,iy0,ix1,iy1,(irx,iry),(irx,iry),(irx,iry),(irx,iry),ik)
    return op(o,i,D)

# ---------------- render / svg ----------------
def draw(ctx,path):
    for verb,pts in path:
        n={0:'MOVE',1:'LINE',2:'QUAD',4:'CUBIC',5:'CLOSE'}[int(verb)]
        if n.endswith('MOVE'): ctx.move_to(*pts[0])
        elif n.endswith('LINE'): ctx.line_to(*pts[0])
        elif n.endswith('CUBIC'): ctx.curve_to(*pts[0],*pts[1],*pts[2])
        elif n.endswith('QUAD'):
            (x1,y1),(x2,y2)=pts; x0,y0=ctx.get_current_point()
            ctx.curve_to(x0+2/3*(x1-x0),y0+2/3*(y1-y0),x2+2/3*(x1-x2),y2+2/3*(y1-y2),x2,y2)
        elif n.endswith('CLOSE'): ctx.close_path()

def render(paths,x0,y0,w,h,scale=1):
    surf=cairo.ImageSurface(cairo.FORMAT_A8,int(w*scale),int(h*scale))
    ctx=cairo.Context(surf); ctx.scale(scale,scale); ctx.translate(-x0,-y0)
    ctx.set_fill_rule(cairo.FILL_RULE_WINDING)
    for p in paths: draw(ctx,p)
    ctx.fill(); surf.flush()
    st=surf.get_stride(); buf=np.frombuffer(surf.get_data(),np.uint8).reshape(int(h*scale),st)[:, :int(w*scale)]
    return buf.astype(float)/255

def svgd(path,dx=0,dy=0,s=1,prec=2):
    f=lambda v:('%.*f'%(prec,v)).rstrip('0').rstrip('.') if '.' in '%.*f'%(prec,v) else '%.*f'%(prec,v)
    out=[]
    for verb,pts in path:
        n={0:'MOVE',1:'LINE',2:'QUAD',4:'CUBIC',5:'CLOSE'}[int(verb)]
        T=[(f((x+dx)*s),f((y+dy)*s)) for x,y in pts]
        if n.endswith('MOVE'): out.append('M%s %s'%T[0])
        elif n.endswith('LINE'): out.append('L%s %s'%T[0])
        elif n.endswith('CUBIC'): out.append('C'+' '.join('%s %s'%t for t in T))
        elif n.endswith('QUAD'): out.append('Q'+' '.join('%s %s'%t for t in T))
        elif n.endswith('CLOSE'): out.append('Z')
    return ''.join(out)
