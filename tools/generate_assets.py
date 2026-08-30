#!/usr/bin/env python3
"""Generate original pixel-art fallback assets for Elemental Swap V4.

The game is structured so these PNGs can be replaced with free itch.io packs.
The generated art uses original geometric pixel designs and does not copy the
user's reference images. The references inform only palette, lighting, and the
"overgrown abandoned city" theme.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math, random

ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / 'assets' / 'sprites'
VFX = ROOT / 'assets' / 'vfx'
BG = ROOT / 'assets' / 'backgrounds'
for d in (SPR, VFX, BG): d.mkdir(parents=True, exist_ok=True)

# ---------- Pixel helpers ----------
def px(d,x,y,w,h,c): d.rectangle((round(x),round(y),round(x+w-1),round(y+h-1)),fill=c)
def line(d,pts,c,w=1): d.line([(round(x),round(y)) for x,y in pts],fill=c,width=w)
def circ(d,x,y,r,c,outline=None,w=1): d.ellipse((round(x-r),round(y-r),round(x+r),round(y+r)),fill=c,outline=outline,width=w)
def poly(d,pts,c): d.polygon([(round(x),round(y)) for x,y in pts],fill=c)

def save_nn(im,path,scale=1):
    if scale!=1: im=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
    im.save(path)

# ---------- Player sprite sheets ----------
FW,FH,FRAMES = 40,56,10
ANIMS = [
    'idle','run','jump','fall','dash',
    'light1','light2','light3','light4','heavy1','heavy2','launcher',
    'thrust','sweep','air','dive','hurt','down','recover','cast'
]
PALETTES={
 'rift':dict(body='#e7f8ff',shade='#789caf',dark='#173244',accent='#63e7ff',weapon='#f8ffff',scarf='#ff725f'),
 'summoner':dict(body='#f6edff',shade='#a989bf',dark='#3a2851',accent='#d891ff',weapon='#ffe083',scarf='#86e7ff'),
 'beast':dict(body='#edf8dc',shade='#88a66b',dark='#28472e',accent='#8cff74',weapon='#f3d9a1',scarf='#d3ff85'),
 'artificer':dict(body='#edf2f7',shade='#8193a0',dark='#293846',accent='#ffad5f',weapon='#76e5ff',scarf='#ffe17a'),
}

def player_frame(cls,anim,f):
    p=PALETTES[cls]; im=Image.new('RGBA',(FW,FH),(0,0,0,0));d=ImageDraw.Draw(im)
    # normalized animation phase
    t=f/(FRAMES-1)
    bob=0; lean=0; bodyx=20; bodyy=28; legL=(16,40);legR=(22,40); armL=(14,30);armR=(27,30); ang=-.45; weapon_len=20
    if anim=='idle': bob=[0,0,-1,-1,0,0,1,1,0,0][f]
    elif anim=='run':
        cyc=math.sin(t*math.tau);bob=abs(round(cyc*2));lean=2
        legL=(16-round(cyc*5),39);legR=(22+round(cyc*5),39);armL=(14+round(cyc*3),30);armR=(27-round(cyc*3),30);ang=-.6+cyc*.25
    elif anim=='jump': bodyy-=3;legL=(15,39);legR=(23,37);armR=(28,27);ang=-1.05
    elif anim=='fall': bodyy+=1;legL=(15,42);legR=(23,42);armR=(28,31);ang=.35
    elif anim=='dash': lean=4;bodyy+=1;legL=(13,42);legR=(25,40);armR=(29,31);ang=-.08
    elif anim=='light1': lean=2;armR=(29,29);ang=-1.25+t*1.75
    elif anim=='light2': lean=2;armR=(29,28);ang=.95-t*2.0
    elif anim=='light3': lean=3;armR=(30,28);ang=-1.55+t*3.0
    elif anim=='light4': lean=4;armR=(31,27);ang=-1.4+t*3.25;weapon_len=24
    elif anim=='heavy1': lean=1;armR=(27,27);ang=-1.75+t*2.45;weapon_len=25
    elif anim=='heavy2': lean=3;armR=(31,29);ang=1.25-t*2.85;weapon_len=27
    elif anim=='launcher': bodyy-=round(math.sin(t*math.pi)*3);armR=(29,28);ang=.9-t*2.65;weapon_len=25
    elif anim=='thrust': lean=4;armR=(31,29);ang=-.03;weapon_len=28
    elif anim=='sweep': bodyy+=3;armR=(28,34);ang=.55-t*1.1;weapon_len=24
    elif anim=='air': bodyy-=2;legL=(15,39);legR=(24,38);armR=(30,27);ang=-1.25+t*2.7
    elif anim=='dive': bodyy+=1;legL=(16,39);legR=(23,38);armR=(29,31);ang=1.25;weapon_len=25
    elif anim=='hurt': lean=-3+f%2*2;bodyy+=1;armR=(28,34);ang=1.15
    elif anim=='down':
        q=min(1,t*1.5);bodyx=20+round(q*5);bodyy=28+round(q*16);lean=round(q*6);legL=(13,45);legR=(23,46);armR=(29,43);ang=.12
    elif anim=='recover':
        q=t;bodyy=44-round(q*16);lean=round((1-q)*5);legL=(14,45-round(q*5));legR=(24,45-round(q*5));ang=-.45*q
    elif anim=='cast':
        bodyy-=2;armL=(12,25);armR=(28,24);ang=-1.0
        for k in range(6):
            a=k*math.tau/6+f*.45; x=20+math.cos(a)*13;y=24+math.sin(a)*10;px(d,x,y,2,2,p['accent'])

    # ground shadow
    d.ellipse((8,50,33,54),fill=(7,15,20,65))
    # scarf/cape behind
    scarf_shift=-3-round(abs(math.sin(t*math.tau))*4) if anim in ('run','dash','thrust') else -2
    poly(d,[(15+scarf_shift,24+bob),(7+scarf_shift,27+bob),(12+scarf_shift,31+bob),(17,29+bob)],p['scarf'])
    # legs with dark outline
    for x,y in (legL,legR):
        px(d,x-1,y-1,6,12,'#101923');px(d,x,y,4,10,p['dark']);px(d,x-1,49,7,4,'#101923');px(d,x,49,5,2,p['shade'])
    # body outline and armor
    px(d,bodyx-8+lean,bodyy-7+bob,16,20,'#0e171f');px(d,bodyx-7+lean,bodyy-6+bob,14,18,p['body'])
    px(d,bodyx-7+lean,bodyy+2+bob,14,5,p['shade']);px(d,bodyx-3+lean,bodyy-1+bob,6,6,p['accent'])
    # head / helmet
    px(d,bodyx-7+lean,bodyy-19+bob,14,12,'#0c151d');px(d,bodyx-6+lean,bodyy-18+bob,12,10,p['body'])
    px(d,bodyx-5+lean,bodyy-14+bob,11,4,p['dark']);px(d,bodyx+2+lean,bodyy-13+bob,3,2,p['accent'])
    # arms
    line(d,[(bodyx-5+lean,bodyy-3+bob),(armL[0]+lean,armL[1]+bob)],'#0d161e',5);line(d,[(bodyx-4+lean,bodyy-3+bob),(armL[0]+lean,armL[1]+bob)],p['body'],2)
    line(d,[(bodyx+5+lean,bodyy-3+bob),(armR[0]+lean,armR[1]+bob)],'#0d161e',5);line(d,[(bodyx+4+lean,bodyy-3+bob),(armR[0]+lean,armR[1]+bob)],p['body'],2)
    # class weapon
    hx,hy=armR[0]+lean,armR[1]+bob
    if cls=='rift':
        ex=hx+math.cos(ang)*weapon_len;ey=hy+math.sin(ang)*weapon_len
        line(d,[(hx,hy),(ex,ey)],'#071019',6);line(d,[(hx,hy),(ex,ey)],p['weapon'],3);px(d,ex-1,ey-1,3,3,p['accent'])
    elif cls=='summoner':
        ex=hx+math.cos(ang)*18;ey=hy+math.sin(ang)*18
        line(d,[(hx,hy),(ex,ey)],'#261c35',4);line(d,[(hx,hy),(ex,ey)],p['weapon'],2);circ(d,ex,ey,4,p['accent']);px(d,ex-1,ey-1,2,2,'#fff')
    elif cls=='beast':
        for o in (-3,0,3): line(d,[(hx,hy+o),(hx+math.cos(ang)*17,hy+o+math.sin(ang)*17)],p['weapon'],2)
        px(d,bodyx-8+lean,bodyy-21+bob,4,5,p['accent']);px(d,bodyx+4+lean,bodyy-21+bob,4,5,p['accent'])
    else:
        px(d,hx-2,hy-4,16,9,'#101a23');px(d,hx,hy-3,13,7,p['accent']);px(d,hx+11,hy-1,8,3,p['weapon'])
        px(d,bodyx-10+lean,bodyy-2+bob,4,10,p['accent'])
    return im

for cls in PALETTES:
    sheet=Image.new('RGBA',(FW*FRAMES,FH*len(ANIMS)),(0,0,0,0))
    for row,anim in enumerate(ANIMS):
        for f in range(FRAMES): sheet.alpha_composite(player_frame(cls,anim,f),(f*FW,row*FH))
    sheet.save(SPR/f'player_{cls}.png')

# ---------- Enemies ----------
EW,EH,EFR=48,48,8
EROWS=['idle','move','attack','cast','hurt','down']
ENEMY_COLORS={
 'slime':('#63d781','#baffc7'),'archer':('#c38b52','#ffe0a6'),'shield':('#73899a','#d5e4ed'),
 'bat':('#ac78e6','#f3d7ff'),'turret':('#667882','#aef4ff'),'mage':('#6f57b0','#e1bdff'),'golem':('#88705a','#ffad62')
}

def enemy_frame(kind,row,f):
    im=Image.new('RGBA',(EW,EH),(0,0,0,0));d=ImageDraw.Draw(im);base,hi=ENEMY_COLORS[kind]
    bob=round(math.sin(f/EFR*math.tau)*2) if row not in ('down',) else min(9,f*2)
    if kind=='slime':
        w=28+(2 if row=='move' and f%2 else 0);h=19;x=24-w//2;y=25+bob
        d.ellipse((x,y,x+w,y+h),fill='#14231a');d.ellipse((x+2,y+2,x+w-2,y+h-1),fill=base);px(d,18,y+7,3,3,'#fff');px(d,27,y+7,3,3,'#fff')
        if row=='attack':poly(d,[(31,y+8),(44,y+12),(31,y+15)],hi)
    elif kind=='bat':
        y=24+bob;poly(d,[(21,y),(6,y-13),(11,y+1),(3,y+8),(20,y+7)],'#24142e');poly(d,[(27,y),(42,y-13),(37,y+1),(45,y+8),(28,y+7)],'#24142e');circ(d,24,y,8,base);px(d,20,y-3,3,3,'#fff');px(d,27,y-3,3,3,'#fff')
    elif kind=='turret':
        px(d,10,22+bob,28,20,'#17222a');px(d,12,24+bob,24,16,base);px(d,22,14+bob,9,10,hi);px(d,29,17+bob,17,6,'#13202a');px(d,32,18+bob,13,3,hi);px(d,7,39+bob,34,5,'#263640')
    elif kind=='golem':
        px(d,8,9+bob,32,14,'#1d1713');px(d,10,11+bob,28,11,base);px(d,6,22+bob,36,19,'#1d1713');px(d,9,23+bob,30,17,base);px(d,2,24+bob,9,16,base);px(d,37,24+bob,9,16,base);circ(d,24,31+bob,5,hi);px(d,22,29+bob,4,3,'#fff5d2')
    else:
        # humanoid family
        px(d,19,8+bob,11,10,'#151c22');px(d,20,9+bob,9,8,hi);px(d,17,18+bob,15,19,'#162027');px(d,19,19+bob,11,17,base);px(d,18,36+bob,4,10,'#172028');px(d,27,36+bob,4,10,'#172028')
        if kind=='archer':d.arc((29,15+bob,46,35+bob),-80,80,fill=hi,width=2);line(d,[(37,17+bob),(37,34+bob)],'#e9f6f8',1)
        elif kind=='shield':px(d,31,15+bob,13,27,'#142029');px(d,33,17+bob,9,23,hi);px(d,36,20+bob,3,13,'#fff')
        elif kind=='mage':poly(d,[(16,18+bob),(33,18+bob),(39,44+bob),(10,44+bob)],base);circ(d,39,20+bob,5,hi,outline='#fff',w=1)
    if row=='hurt':
        for x,y in [(6,8),(39,12),(4,31),(41,34)]:px(d,x,y,3,3,'#fff')
    return im

for kind in ENEMY_COLORS:
    sheet=Image.new('RGBA',(EW*EFR,EH*len(EROWS)),(0,0,0,0))
    for r,row in enumerate(EROWS):
        for f in range(EFR):sheet.alpha_composite(enemy_frame(kind,row,f),(f*EW,r*EH))
    sheet.save(SPR/f'enemy_{kind}.png')

# Boss
BW,BH,BFR=112,112,10
BROWS=['idle','walk','slash','dash','orbs','collapse','break','hurt','death']
def boss_frame(row,f):
    im=Image.new('RGBA',(BW,BH),(0,0,0,0));d=ImageDraw.Draw(im);t=f/(BFR-1);bob=round(math.sin(t*math.tau)*2) if row!='death' else min(20,f*2)
    # floating element shards
    cols=['#ff714f','#77e7ff','#ffe568','#79f1b5','#c28e59','#5797ff','#fff6b5','#a47cff','#70d875','#ed7cff']
    for k,c in enumerate(cols):
        a=k*math.tau/10+f*.1;r=43+math.sin(f*.4+k)*3;x=56+math.cos(a)*r;y=50+bob+math.sin(a)*28;px(d,x-2,y-2,4,4,c)
    px(d,29,20+bob,54,60,'#120f1a');px(d,33,23+bob,46,53,'#45445b');px(d,39,26+bob,34,15,'#9292a7')
    px(d,44,12+bob,24,17,'#15131f');px(d,46,15+bob,20,10,'#e9fbff');px(d,60,18+bob,5,3,'#6feaff')
    circ(d,56,55+bob,12,'#17131e');circ(d,56,55+bob,8,'#ff557d');px(d,53,51+bob,6,4,'#fff0c2')
    px(d,35,77+bob,16,28,'#272433');px(d,62,77+bob,16,28,'#272433')
    a1=-1.15;a2=.45
    if row=='slash':a1=-1.7+t*3.2
    if row=='dash':a1=-.1;a2=.1
    if row=='orbs':a1=-1.5;a2=1.5
    for a,hx,c in [(a1,34,'#80eaff'),(a2,79,'#ff6b93')]:
        hy=53+bob;ex=hx+math.cos(a)*38;ey=hy+math.sin(a)*38;line(d,[(hx,hy),(ex,ey)],'#090811',9);line(d,[(hx,hy),(ex,ey)],c,4)
    if row in ('collapse','break'):
        for k in range(18):
            a=k*.65+f*.35;r=25+k%3*12;x=56+math.cos(a)*r;y=55+bob+math.sin(a)*r*.7;px(d,x,y,3,3,'#fff' if row=='break' else cols[k%10])
    if row=='hurt':
        for k in range(14):
            a=k*.7;x=56+math.cos(a)*48;y=53+math.sin(a)*42;px(d,x,y,3,3,'#fff')
    return im
sheet=Image.new('RGBA',(BW*BFR,BH*len(BROWS)),(0,0,0,0))
for r,row in enumerate(BROWS):
    for f in range(BFR):sheet.alpha_composite(boss_frame(row,f),(f*BW,r*BH))
sheet.save(SPR/'boss_helios.png')

# ---------- VFX ----------
def sheet(path,w,h,frames,fn):
    out=Image.new('RGBA',(w*frames,h),(0,0,0,0))
    for f in range(frames):
        im=Image.new('RGBA',(w,h),(0,0,0,0));fn(ImageDraw.Draw(im),w,h,f,frames);out.alpha_composite(im,(f*w,0))
    out.save(path)

def hitfx(d,w,h,f,n):
    t=f/(n-1);x=w/2;y=h/2;r=8+t*38
    for k in range(14):
        a=k*math.tau/14+f*.12;rr=r*(1 if k%2==0 else .65);line(d,[(x,y),(x+math.cos(a)*rr,y+math.sin(a)*rr)],'#fff' if k%3==0 else '#ffe27f',max(1,5-f//2))
    circ(d,x,y,max(1,12-f),'#fff')
sheet(VFX/'hit.png',96,96,10,hitfx)

def slashfx(color1,color2,reverse=False):
    def fn(d,w,h,f,n):
        t=f/(n-1);start=(-160 if not reverse else 20)+t*105;end=start+(95+90*t)
        d.arc((9,9,w-9,h-9),start,end,fill=color1,width=max(2,12-f//2));d.arc((18,18,w-18,h-18),start+5,end-12,fill=color2,width=max(1,6-f//3))
    return fn
sheet(VFX/'slash_cyan.png',128,128,10,slashfx('#dfffff','#62dcff'))
sheet(VFX/'slash_gold.png',128,128,10,slashfx('#fff6c1','#ffad52',True))

def launcher(d,w,h,f,n):
    t=f/(n-1);cx=w/2
    for k in range(7):
        x=cx+(k-3)*9;y=h-8-t*(86+k*5);line(d,[(x,h-5),(x+math.sin(k+f)*12,y)],'#fff' if k%3==0 else '#73e9ff',max(1,8-f//2))
sheet(VFX/'launcher.png',128,128,10,launcher)

def explosion(d,w,h,f,n):
    t=f/(n-1);cx=w/2;cy=h/2
    for k in range(20):
        a=k*math.tau/20+f*.09;r=12+t*66;col='#fff' if k%4==0 else '#ffb85a' if k%2 else '#ff5a43';circ(d,cx+math.cos(a)*r,cy+math.sin(a)*r,4+int((1-t)*5),col)
    if f>2:d.arc((12,12,w-12,h-12),0,360,fill='#fff2ad',width=max(2,10-f))
sheet(VFX/'explosion.png',160,160,12,explosion)

def shockwave(d,w,h,f,n):
    t=f/(n-1);cx=w/2;cy=h/2
    for q,c in [(1,'#fff'),(.78,'#6ee8ff'),(.55,'#ff72a1')]:
        r=(12+t*70)*q;d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=c,width=max(1,7-f//2))
sheet(VFX/'shockwave.png',160,160,12,shockwave)

ELS=[('fire','#ff6343'),('ice','#78e7ff'),('lightning','#ffe65a'),('wind','#82f4c2'),('earth','#bb8c5d'),('water','#529dff'),('light','#fff4aa'),('shadow','#a17aff'),('nature','#68d86e'),('gravity','#eb78ff')]
def eldraw(kind,c):
    def fn(d,w,h,f,n):
        t=f/(n-1);cx=w/2;cy=h/2
        if kind=='fire':
            for q in range(4):
                r=24-q*5;y=cy+8-q*7+math.sin(f+q)*2;poly(d,[(cx-r*.55,y+r),(cx-r*.32,y),(cx,y-r),(cx+r*.52,y+r)],c if q%2==0 else '#ffd66c')
        elif kind=='ice':
            pts=[]
            for k in range(8):a=k*math.tau/8+f*.12;r=30 if k%2==0 else 12;pts.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
            poly(d,pts,c);line(d,pts+[pts[0]],'#efffff',2)
        elif kind=='lightning':
            pts=[(10,42),(31,25),(27,42),(52,29),(47,50),(82,36)];pts=[(x,y+math.sin(f+x)*3) for x,y in pts];line(d,pts,'#fff',8);line(d,pts,c,3)
        elif kind=='wind':
            for k in range(4):d.arc((10+k*8,20+k*6,w-10-k*5,h-20-k*5),-30+f*7,190+f*7,fill=c,width=4)
        elif kind=='earth':
            pts=[(14,62),(25,26),(49,14),(75,29),(84,62),(58,84),(27,80)];poly(d,pts,'#392b22');poly(d,[(21,58),(31,31),(49,21),(68,34),(75,58),(55,76),(30,72)],c);px(d,43,30,13,7,'#f0cd98')
        elif kind=='water':circ(d,cx,cy,31,c);circ(d,cx-10,cy-12,9,'#bfe8ff');px(d,cx-14,cy-16,8,4,'#fff')
        elif kind=='light':
            for k in range(10):a=k*math.tau/10+f*.08;r=37 if k%2==0 else 18;line(d,[(cx,cy),(cx+math.cos(a)*r,cy+math.sin(a)*r)],c,4)
            circ(d,cx,cy,13,'#fff')
        elif kind=='shadow':circ(d,cx,cy,28,'#150c22');d.arc((12,12,w-12,h-12),f*24,f*24+240,fill=c,width=7);d.arc((24,24,w-24,h-24),-f*31,-f*31+180,fill='#d9c2ff',width=3)
        elif kind=='nature':
            line(d,[(15,76),(34,55),(49,38),(70,18)],'#2d8b48',6)
            for x,y,a in [(31,56,-.35),(47,40,.35),(67,21,-.25)]:d.ellipse((x-13,y-7,x+13,y+7),fill=c)
        elif kind=='gravity':
            circ(d,cx,cy,14,'#07050b');
            for k in range(4):d.arc((12+k*7,12+k*7,w-12-k*7,h-12-k*7),f*27+k*70,f*27+k*70+215,fill=c,width=4)
    return fn
for k,c in ELS:sheet(VFX/f'element_{k}.png',96,96,10,eldraw(k,c))

# ---------- Bright overgrown city parallax themes ----------
# Render at 640x360; game draws with nearest-neighbor scaling.
W,H=640,360
THEMES={
 'sunset':dict(sky1='#5f8797',sky2='#f2ad72',sun='#ffcb63',far='#40565b',mid='#453d37',green='#4f8a43',water='#4dbbd0'),
 'station':dict(sky1='#53bde8',sky2='#dff5f1',sun='#fff3b0',far='#87a9a3',mid='#8e9687',green='#48bd5c',water='#36b7d9'),
 'canal':dict(sky1='#4aa9e4',sky2='#cceff7',sun='#fff5ba',far='#6d8e94',mid='#687a72',green='#3fac56',water='#2bb5dc'),
 'plaza':dict(sky1='#70b8dc',sky2='#e7f2d4',sun='#fff4b8',far='#5f7779',mid='#52635d',green='#53b44b',water='#60cae0')
}

def cloud(d,x,y,w,c):
    for dx,dy,r in [(0,5,12),(12,0,16),(28,5,12),(42,8,9)]:circ(d,x+dx*w/50,y+dy,w*r/50,c)

def background_theme(name,pal):
    far=Image.new('RGBA',(W,H),pal['sky1']);d=ImageDraw.Draw(far)
    # banded gradient
    for y in range(H):
        q=y/H
        def mix(a,b,t):
            aa=tuple(int(a[i:i+2],16) for i in (1,3,5));bb=tuple(int(b[i:i+2],16) for i in (1,3,5));return tuple(int(aa[i]*(1-t)+bb[i]*t) for i in range(3))
        d.line((0,y,W,y),fill=mix(pal['sky1'],pal['sky2'],q))
    # sun and clouds
    sx=95 if name=='sunset' else 490;sy=150 if name=='sunset' else 67;circ(d,sx,sy,30,pal['sun'])
    random.seed(hash(name)&0xffff)
    for i in range(11):cloud(d,random.randint(10,590),random.randint(18,145),random.randint(28,55),(255,255,242,180))
    # far city blocks
    for x in range(-10,W+40,50):
        bh=random.randint(65,150);bw=random.randint(35,62);y=265-bh;d.rectangle((x,y,x+bw,275),fill=pal['far'])
        for wy in range(y+10,260,13):
            for wx in range(x+7,x+bw-5,11):
                if random.random()>.28:px(d,wx,wy,4,5,(186,218,209,90))
    # distant vegetation roofs
    for x in range(0,W,20):circ(d,x,256-random.randint(0,20),random.randint(8,17),pal['green'])
    far.save(BG/f'{name}_far.png')

    mid=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(mid);random.seed((hash(name)+2)&0xffff)
    # main abandoned concrete/brick structures
    if name=='sunset':builds=[(110,125,150,200),(260,98,150,230),(430,140,130,190)]
    elif name=='station':builds=[(20,90,185,230),(205,120,180,200),(410,110,200,215)]
    elif name=='canal':builds=[(40,92,165,235),(245,72,155,255),(450,105,150,220)]
    else:builds=[(0,100,150,225),(190,125,150,200),(410,80,185,245)]
    for bx,by,bw,bh in builds:
        col=pal['mid'];d.rectangle((bx,by,bx+bw,by+bh),fill=col)
        # broken roof / holes
        for k in range(5):
            hx=bx+random.randint(14,bw-28);hy=by+random.randint(18,bh-40);hw=random.randint(12,30);hh=random.randint(10,28);d.rectangle((hx,hy,hx+hw,hy+hh),fill=(21,33,31,220))
        # window grids
        for wy in range(by+18,by+bh-20,27):
            for wx in range(bx+14,bx+bw-14,25):
                if random.random()>.22:d.rectangle((wx,wy,wx+12,wy+14),fill=(30,47,46,210));px(d,wx+2,wy+2,3,3,(115,181,173,130))
        # vines hanging / climbing
        for vx in range(bx+10,bx+bw,30):
            if random.random()>.35:
                line(d,[(vx,by),(vx+random.randint(-10,10),by+random.randint(65,bh))],pal['green'],4)
                for yy in range(by+12,by+bh-15,22):
                    if random.random()>.45:circ(d,vx+random.randint(-7,7),yy,5,pal['green'])
        # roof shrubs
        for x in range(bx,bx+bw,12):circ(d,x,by,random.randint(5,10),pal['green'])
    # transit signs and broken rails, original fictional text shapes
    d.rectangle((55,160,185,180),fill=(39,62,64,230));px(d,69,166,65,6,(142,213,209,190));px(d,141,166,27,6,(69,145,153,190))
    # water / flooded ground
    d.rectangle((0,292,W,H),fill=pal['water'])
    for y in range(299,H,12):
        for x in range((y*3)%24,W,32):px(d,x,y,18,2,(183,244,245,130))
    # elevated grass platforms in scenery
    for x in range(0,W,18):circ(d,x,290-random.randint(0,12),random.randint(6,11),pal['green'])
    mid.save(BG/f'{name}_mid.png')

    near=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(near);random.seed((hash(name)+4)&0xffff)
    # only low grass and top wires: never block the center view
    for x in range(0,W,8):
        hh=random.randint(5,19);poly(d,[(x,H),(x+3,H-hh),(x+6,H)],(20,68,39,190))
    # overhead cables, thin only
    for yy in (28,52):
        pts=[]
        for x in range(-20,W+40,40):pts.append((x,yy+int(math.sin(x*.015+yy)*9)))
        line(d,pts,(24,35,38,150),2)
    # light leaves on corners, not giant pillars
    for x in list(range(0,52,10))+list(range(W-52,W,10)):
        for y in range(160,H,24):
            if random.random()>.35:circ(d,x,y,random.randint(4,9),(35,108,51,165))
    near.save(BG/f'{name}_near.png')

for n,p in THEMES.items():background_theme(n,p)
print('generated',ROOT)
