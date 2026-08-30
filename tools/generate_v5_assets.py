#!/usr/bin/env python3
"""Generate original V5 human-like sprites, summons, transformations and 8 detailed pixel backgrounds.

The user's reference images inform only the broad art direction: bright sky, abandoned urban
architecture, water, heavy vegetation, warm sunlight and readable silhouettes. No source image
pixels are copied into the output.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw
import math, random

ROOT=Path(__file__).resolve().parents[1]
SPR=ROOT/'assets'/'sprites'; BG=ROOT/'assets'/'backgrounds'
SPR.mkdir(parents=True,exist_ok=True); BG.mkdir(parents=True,exist_ok=True)

def px(d,x,y,w,h,c): d.rectangle((round(x),round(y),round(x+w-1),round(y+h-1)),fill=c)
def line(d,pts,c,w=1): d.line([(round(x),round(y)) for x,y in pts],fill=c,width=w)
def circ(d,x,y,r,c,outline=None,w=1): d.ellipse((round(x-r),round(y-r),round(x+r),round(y+r)),fill=c,outline=outline,width=w)
def poly(d,pts,c): d.polygon([(round(x),round(y)) for x,y in pts],fill=c)

def mix(c1,c2,t):
    a=tuple(int(c1[i:i+2],16) for i in (1,3,5));b=tuple(int(c2[i:i+2],16) for i in (1,3,5))
    return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(3))

# -----------------------------------------------------------------------------
# HUMAN-LIKE PLAYER SPRITES
# -----------------------------------------------------------------------------
FW,FH,FR=40,56,10
ANIMS=['idle','run','jump','fall','dash','light1','light2','light3','light4','heavy1','heavy2','launcher','thrust','sweep','air','dive','hurt','down','recover','cast']
PAL={
 'rift':dict(skin='#e7b98e',hair='#27394d',coat='#d8eef2',shade='#6f9dae',dark='#173142',accent='#64e8ff',cloth='#ef6658',weapon='#efffff'),
 'summoner':dict(skin='#e7b98e',hair='#5d3c68',coat='#eadcf4',shade='#a17ab0',dark='#382447',accent='#d68cff',cloth='#72d7dc',weapon='#ffe58a'),
 'beast':dict(skin='#dcb184',hair='#47372c',coat='#dfedcc',shade='#7e9c68',dark='#294332',accent='#8cf27a',cloth='#d1ee75',weapon='#efd4a0'),
 'artificer':dict(skin='#d9ad83',hair='#634537',coat='#dce6eb',shade='#7b8f9a',dark='#293942',accent='#ffab5f',cloth='#69dbea',weapon='#ffe083'),
}

def player_frame(cls,anim,f,form=None):
    p=PAL[cls]; im=Image.new('RGBA',(FW,FH),(0,0,0,0));d=ImageDraw.Draw(im);t=f/(FR-1)
    bx,by=20,28; lean=0; bob=0; legA=(16,40);legB=(22,40);armA=(14,30);armB=(27,30);ang=-.45;weapon=20
    if anim=='idle':bob=[0,0,-1,-1,0,0,1,1,0,0][f]
    elif anim=='run':
        q=math.sin(t*math.tau);bob=abs(round(q*2));lean=2;legA=(16-round(q*5),39);legB=(22+round(q*5),39);armA=(14+round(q*3),30);armB=(27-round(q*3),30);ang=-.55+q*.25
    elif anim=='jump':by-=3;legA=(15,39);legB=(23,37);armB=(28,27);ang=-1.0
    elif anim=='fall':by+=1;legA=(15,42);legB=(23,42);armB=(28,31);ang=.3
    elif anim=='dash':lean=4;by+=1;legA=(13,42);legB=(25,40);armB=(30,30);ang=-.05
    elif anim=='light1':lean=2;armB=(29,29);ang=-1.25+t*1.8
    elif anim=='light2':lean=2;armB=(29,28);ang=.95-t*2.0
    elif anim=='light3':lean=3;armB=(30,28);ang=-1.55+t*3.0
    elif anim=='light4':lean=4;armB=(31,27);ang=-1.45+t*3.2;weapon=25
    elif anim=='heavy1':lean=1;armB=(28,27);ang=-1.8+t*2.5;weapon=25
    elif anim=='heavy2':lean=3;armB=(31,29);ang=1.25-t*2.9;weapon=28
    elif anim=='launcher':by-=round(math.sin(t*math.pi)*3);armB=(29,28);ang=.9-t*2.7;weapon=25
    elif anim=='thrust':lean=4;armB=(31,29);ang=-.02;weapon=29
    elif anim=='sweep':by+=3;armB=(28,34);ang=.55-t*1.1;weapon=24
    elif anim=='air':by-=2;legA=(15,39);legB=(24,38);armB=(30,27);ang=-1.25+t*2.7
    elif anim=='dive':by+=1;legA=(16,39);legB=(23,38);armB=(29,31);ang=1.25;weapon=25
    elif anim=='hurt':lean=-3+f%2*2;by+=1;armB=(28,34);ang=1.15
    elif anim=='down':
        q=min(1,t*1.5);bx=20+round(q*5);by=28+round(q*16);lean=round(q*6);legA=(13,45);legB=(23,46);armB=(29,43);ang=.12
    elif anim=='recover':
        q=t;by=44-round(q*16);lean=round((1-q)*5);legA=(14,45-round(q*5));legB=(24,45-round(q*5));ang=-.45*q
    elif anim=='cast':
        by-=2;armA=(12,25);armB=(28,24);ang=-1.0
        for k in range(6):
            a=k*math.tau/6+f*.45;px(d,20+math.cos(a)*13,24+math.sin(a)*10,2,2,p['accent'])

    # organic form modifiers
    if cls=='beast':
        if form=='wolf': lean+=2; weapon=15
        elif form=='eagle': by-=1
        elif form=='bear': by+=1; weapon=14
        elif form=='king': lean+=1; weapon=18

    # shadow
    d.ellipse((8,50,33,54),fill=(7,15,20,65))
    # cape/robe behind
    cape=p['cloth']; sway=-3-round(abs(math.sin(t*math.tau))*4) if anim in ('run','dash','thrust') else -2
    if cls in ('rift','summoner'):
        poly(d,[(15+sway,24+bob),(6+sway,27+bob),(11+sway,34+bob),(18,30+bob)],cape)
    if cls=='summoner':
        poly(d,[(12,26+bob),(9,45+bob),(20,48+bob),(30,44+bob),(28,26+bob)],p['coat'])
    # tail/wings before body
    if cls=='beast':
        if form in ('wolf','king',None):
            line(d,[(14+lean,34+bob),(6,37+bob),(3,32+bob)],p['accent'],4)
        if form in ('eagle','king'):
            poly(d,[(14,27+bob),(4,19+bob),(8,33+bob),(16,36+bob)],'#c6e4bb');poly(d,[(26,27+bob),(36,19+bob),(32,33+bob),(24,36+bob)],'#c6e4bb')

    # legs
    leg_width=5 if cls=='beast' and form=='bear' else 4
    for x,y in (legA,legB):
        px(d,x-1,y-1,leg_width+2,12,'#101923');px(d,x,y,leg_width,10,p['dark']);px(d,x-1,49,leg_width+3,4,'#101923');px(d,x,49,leg_width+1,2,p['shade'])
    # torso: coats are shaped, not rectangular armor
    torso_w=17 if cls=='beast' and form=='bear' else 14
    px(d,bx-torso_w//2-1+lean,by-7+bob,torso_w+2,20,'#0d171e')
    px(d,bx-torso_w//2+lean,by-6+bob,torso_w,18,p['coat'])
    # waist / fabric folds
    px(d,bx-torso_w//2+lean,by+2+bob,torso_w,4,p['shade']);px(d,bx-2+lean,by-1+bob,4,6,p['accent'])
    if cls=='summoner':
        poly(d,[(bx-7+lean,by+9+bob),(bx-10+lean,by+19+bob),(bx+10+lean,by+19+bob),(bx+7+lean,by+9+bob)],p['coat'])
        line(d,[(bx-6+lean,by+11+bob),(bx-8+lean,by+18+bob)],p['shade'],1);line(d,[(bx+5+lean,by+11+bob),(bx+7+lean,by+18+bob)],p['shade'],1)
    # visible face and hair
    skin=p['skin'];hair=p['hair']
    px(d,bx-6+lean,by-19+bob,12,11,'#151719')
    px(d,bx-5+lean,by-18+bob,10,9,skin)
    # hair silhouette differs by class
    if cls=='rift':
        poly(d,[(bx-6+lean,by-19+bob),(bx+5+lean,by-20+bob),(bx+7+lean,by-15+bob),(bx+2+lean,by-17+bob),(bx-1+lean,by-13+bob),(bx-6+lean,by-14+bob)],hair)
    elif cls=='summoner':
        poly(d,[(bx-7+lean,by-20+bob),(bx+6+lean,by-20+bob),(bx+7+lean,by-11+bob),(bx+3+lean,by-13+bob),(bx-4+lean,by-11+bob),(bx-7+lean,by-15+bob)],hair)
        px(d,bx-7+lean,by-13+bob,3,8,hair);px(d,bx+5+lean,by-13+bob,3,8,hair)
    elif cls=='beast':
        poly(d,[(bx-7+lean,by-19+bob),(bx+6+lean,by-19+bob),(bx+4+lean,by-12+bob),(bx-4+lean,by-12+bob)],hair)
        ear=p['accent'] if form!='bear' else '#8f745c'
        if form=='bear':circ(d,bx-5+lean,by-20+bob,3,ear);circ(d,bx+5+lean,by-20+bob,3,ear)
        else:poly(d,[(bx-6+lean,by-18+bob),(bx-4+lean,by-24+bob),(bx-1+lean,by-18+bob)],ear);poly(d,[(bx+2+lean,by-18+bob),(bx+5+lean,by-24+bob),(bx+6+lean,by-17+bob)],ear)
    else:
        poly(d,[(bx-6+lean,by-19+bob),(bx+6+lean,by-19+bob),(bx+5+lean,by-14+bob),(bx-1+lean,by-16+bob),(bx-6+lean,by-13+bob)],hair)
        # goggles above eyes, face remains visible
        px(d,bx-5+lean,by-17+bob,4,3,'#69dbea');px(d,bx+1+lean,by-17+bob,4,3,'#ffb15f');px(d,bx-1+lean,by-16+bob,2,1,'#2c3b43')
    # eyes/nose
    px(d,bx+1+lean,by-14+bob,2,2,'#21303a');px(d,bx+4+lean,by-13+bob,1,1,'#b66f60')

    # arms
    arm_thick=6 if cls=='beast' and form=='bear' else 5
    line(d,[(bx-5+lean,by-3+bob),(armA[0]+lean,armA[1]+bob)],'#0d161e',arm_thick);line(d,[(bx-4+lean,by-3+bob),(armA[0]+lean,armA[1]+bob)],p['coat'],2)
    line(d,[(bx+5+lean,by-3+bob),(armB[0]+lean,armB[1]+bob)],'#0d161e',arm_thick);line(d,[(bx+4+lean,by-3+bob),(armB[0]+lean,armB[1]+bob)],p['coat'],2)
    hx,hy=armB[0]+lean,armB[1]+bob
    if cls=='rift':
        ex=hx+math.cos(ang)*weapon;ey=hy+math.sin(ang)*weapon;line(d,[(hx,hy),(ex,ey)],'#061019',6);line(d,[(hx,hy),(ex,ey)],p['weapon'],3);px(d,ex-1,ey-1,3,3,p['accent'])
    elif cls=='summoner':
        ex=hx+math.cos(ang)*18;ey=hy+math.sin(ang)*18;line(d,[(hx,hy),(ex,ey)],'#2b1f36',4);line(d,[(hx,hy),(ex,ey)],p['weapon'],2);circ(d,ex,ey,4,p['accent']);px(d,ex-1,ey-1,2,2,'#fff')
    elif cls=='beast':
        if form=='eagle':
            for o in (-3,0,3):line(d,[(hx,hy+o),(hx+15,hy+o-7)],'#e9f5d7',2)
        elif form=='bear':
            circ(d,hx+7,hy,7,'#7f684f')
            for o in (-3,0,3): px(d,hx+11,hy+o,5,2,'#f3d9a1')
        else:
            for o in (-3,0,3):line(d,[(hx,hy+o),(hx+math.cos(ang)*18,hy+o+math.sin(ang)*18)],p['weapon'],2)
    else:
        px(d,hx-2,hy-4,16,9,'#101a23');px(d,hx,hy-3,13,7,p['accent']);px(d,hx+11,hy-1,8,3,p['weapon'])
    # king aura pixels
    if cls=='beast' and form=='king':
        for k in range(5):
            a=k*math.tau/5+f*.4;px(d,bx+math.cos(a)*15,by+math.sin(a)*18,2,2,['#8cf27a','#ffe47a','#8feaff'][k%3])
    return im

for cls in PAL:
    forms=[None]
    if cls=='beast': forms=[None,'wolf','eagle','bear','king']
    for form in forms:
        sheet=Image.new('RGBA',(FW*FR,FH*len(ANIMS)),(0,0,0,0))
        for row,a in enumerate(ANIMS):
            for f in range(FR):sheet.alpha_composite(player_frame(cls,a,f,form),(f*FW,row*FH))
        name=f'player_{cls}.png' if form is None else f'player_beast_{form}.png'
        sheet.save(SPR/name)

# -----------------------------------------------------------------------------
# SUMMON / TURRET SPRITES
# -----------------------------------------------------------------------------
def make_anim(name,fw,fh,frames,drawfn):
    out=Image.new('RGBA',(fw*frames,fh),(0,0,0,0))
    for f in range(frames):
        im=Image.new('RGBA',(fw,fh),(0,0,0,0));drawfn(ImageDraw.Draw(im),f,frames);out.alpha_composite(im,(f*fw,0))
    out.save(SPR/name)

def fox(d,f,n):
    y=22+round(math.sin(f/n*math.tau)*2);body='#f0b956';dark='#734f35';hi='#fff1bd'
    d.ellipse((10,y-8,34,y+8),fill=dark);d.ellipse((12,y-7,32,y+7),fill=body)
    poly(d,[(27,y-5),(36,y-15),(35,y-2)],body);poly(d,[(17,y-5),(13,y-15),(22,y-8)],body)
    px(d,29,y-3,2,2,'#1b2020');px(d,34,y,2,2,'#1b2020')
    # large animated tail
    q=math.sin(f/n*math.tau);poly(d,[(12,y),(3,y-3),(1+q*2,y-13),(9,y-8),(16,y+4)],dark);poly(d,[(10,y),(4,y-4),(4+q*2,y-10),(10,y-6),(15,y+3)],hi)
make_anim('summon_fox.png',48,40,8,fox)

def owl(d,f,n):
    y=20+round(math.sin(f/n*math.tau)*3);c='#b98ee5';hi='#f5e8ff';dark='#443252';q=math.sin(f/n*math.tau)
    poly(d,[(18,y),(5,y-9-q*4),(10,y+5),(19,y+7)],dark);poly(d,[(30,y),(43,y-9+q*4),(38,y+5),(29,y+7)],dark)
    circ(d,24,y,10,c);circ(d,20,y-2,4,hi);circ(d,28,y-2,4,hi);px(d,20,y-2,2,2,'#20202b');px(d,28,y-2,2,2,'#20202b');poly(d,[(23,y+2),(26,y+2),(24,y+6)],'#ffd772')
make_anim('summon_owl.png',48,40,8,owl)

def guardian(d,f,n):
    c='#81dff5';hi='#f1ffff';dark='#305d72';y=31+round(math.sin(f/n*math.tau)*2)
    poly(d,[(32,4),(19,13),(12,31),(18,55),(32,62),(46,55),(52,31),(45,13)],dark)
    poly(d,[(32,8),(23,16),(17,32),(22,51),(32,56),(42,51),(47,32),(41,16)],c)
    circ(d,32,31,10,hi);circ(d,32,31,5,'#6ee8ff')
    d.arc((9,8,55,58),f*20,f*20+220,fill='#d9ffff',width=3)
make_anim('summon_guardian.png',64,64,8,guardian)

def starbeast(d,f,n):
    c='#ffe079';dark='#745337';hi='#fff8ce';q=math.sin(f/n*math.tau)
    y=39+round(q*3);poly(d,[(15,y),(8,y-21),(25,y-13),(39,y-31),(67,y-25),(83,y-7),(76,y+17),(51,y+24),(28,y+18)],dark)
    poly(d,[(18,y-1),(13,y-17),(29,y-10),(42,y-26),(63,y-21),(77,y-6),(71,y+12),(50,y+18),(30,y+14)],c)
    poly(d,[(40,y-26),(49,y-39),(54,y-23)],hi);poly(d,[(59,y-21),(69,y-34),(70,y-16)],hi)
    px(d,67,y-8,4,3,'#172020')
    for k in range(6): circ(d,24+k*9,y+14+math.sin(k+f)*2,3,hi)
make_anim('summon_starbeast.png',96,72,8,starbeast)

def turret(d,f,n):
    c='#61dff3';orange='#ffad5f';dark='#243944';q=math.sin(f/n*math.tau)
    px(d,8,25,40,19,dark);px(d,11,28,34,13,'#617783');px(d,18,15,22,15,dark);px(d,20,17,18,11,c)
    px(d,37,19+q*2,17,6,dark);px(d,40,20+q*2,14,3,orange);circ(d,17,43,7,dark);circ(d,39,43,7,dark)
    px(d,15,41,26,5,'#17242b')
make_anim('turret_v5.png',56,48,8,turret)

# -----------------------------------------------------------------------------
# 8 UNIQUE DETAILED BACKGROUNDS - draw low-res and upscale x2 for pixel look
# -----------------------------------------------------------------------------
BASE_W,BASE_H=480,270; SCALE=2
ZONES=[
 dict(name='zone1',sky1='#6b91a0',sky2='#f4ae70',sun='#ffca65',far='#496169',mid='#4c413a',green='#4e8c45',water='#3eabc3',kind='alley'),
 dict(name='zone2',sky1='#4baee4',sky2='#dff7f4',sun='#fff3a8',far='#799ba0',mid='#858d80',green='#44b95b',water='#30afd3',kind='station'),
 dict(name='zone3',sky1='#45a5dd',sky2='#d5f0f6',sun='#fff4af',far='#6b8b91',mid='#61756f',green='#37a956',water='#25afd8',kind='canal'),
 dict(name='zone4',sky1='#76bddc',sky2='#eaf5dc',sun='#fff6bc',far='#657e80',mid='#52645f',green='#52b54b',water='#56c8df',kind='plaza'),
 dict(name='zone5',sky1='#59b7e1',sky2='#e4f7ee',sun='#fff5b3',far='#718f94',mid='#6a746b',green='#3eb45a',water='#49bfd5',kind='towers'),
 dict(name='zone6',sky1='#4ba9d5',sky2='#d8f0e8',sun='#ffefaa',far='#5d858d',mid='#526b69',green='#3fa750',water='#28aecd',kind='hydro'),
 dict(name='zone7',sky1='#748d9b',sky2='#f2aa6f',sun='#ffca62',far='#45585f',mid='#494139',green='#527f42',water='#398ea5',kind='crossroads'),
 dict(name='zone8',sky1='#5a9bc5',sky2='#dcefe8',sun='#fff3ae',far='#5a7680',mid='#4d5c5c',green='#4ba54d',water='#44bad3',kind='core'),
]

def cloud(d,x,y,w):
    col=(255,252,232,205)
    for dx,dy,r in [(0,5,8),(10,0,11),(23,4,9),(34,7,7)]:circ(d,x+dx*w/40,y+dy,w*r/40,col)

def vine(d,x,y0,y1,c,seed):
    r=random.Random(seed);pts=[]
    for y in range(y0,y1,6):pts.append((x+math.sin(y*.08+seed)*3,y))
    line(d,pts,c,2)
    for y in range(y0+8,y1,14):
        if r.random()>.28:circ(d,x+math.sin(y*.08+seed)*3+r.randint(-3,3),y,r.randint(2,4),c)

def save_layer(im,path): im.resize((BASE_W*SCALE,BASE_H*SCALE),Image.Resampling.NEAREST).save(path)

def gen_zone(z,idx):
    seed=1000+idx*97;random.seed(seed)
    # far
    far=Image.new('RGBA',(BASE_W,BASE_H),z['sky1']);d=ImageDraw.Draw(far)
    for y in range(BASE_H):d.line((0,y,BASE_W,y),fill=mix(z['sky1'],z['sky2'],y/BASE_H))
    sx=48 if z['kind'] in ('alley','crossroads') else 380;sy=118 if z['kind'] in ('alley','crossroads') else 45;circ(d,sx,sy,22,z['sun'])
    for i in range(10):cloud(d,random.randint(4,440),random.randint(10,95),random.randint(18,38))
    # distant skyline with antennas and rooftop plants
    x=-10
    while x<BASE_W:
        bw=random.randint(25,55);bh=random.randint(45,118);top=205-bh
        d.rectangle((x,top,x+bw,225),fill=z['far'])
        if random.random()>.45:line(d,[(x+bw*.6,top),(x+bw*.6,top-random.randint(12,35))],(55,72,76,180),1)
        for wy in range(top+8,215,10):
            for wx in range(x+5,x+bw-4,9):
                if random.random()>.35:px(d,wx,wy,3,4,(190,218,205,95))
        for rx in range(x+2,x+bw,8):
            if random.random()>.25:circ(d,rx,top,random.randint(3,7),z['green'])
        x+=bw+random.randint(3,10)
    save_layer(far,BG/f"{z['name']}_far.png")

    mid=Image.new('RGBA',(BASE_W,BASE_H),(0,0,0,0));d=ImageDraw.Draw(mid);random.seed(seed+1)
    kind=z['kind']
    # zone-specific architecture
    if kind=='alley': builds=[(20,92,96,145,'wood'),(125,68,128,170,'brick'),(265,86,105,152,'wood'),(380,58,92,180,'brick')]
    elif kind=='station': builds=[(8,61,150,165,'station'),(163,90,123,135,'station'),(305,70,165,155,'tower')]
    elif kind=='canal': builds=[(16,60,118,165,'concrete'),(154,45,110,180,'tower'),(286,75,85,150,'concrete'),(390,55,80,170,'tower')]
    elif kind=='plaza': builds=[(0,78,103,150,'glass'),(117,102,98,126,'glass'),(235,62,128,166,'mall'),(379,87,96,141,'glass')]
    elif kind=='towers': builds=[(5,83,102,145,'tower'),(118,40,110,188,'tower'),(245,65,92,163,'tower'),(352,35,122,193,'tower')]
    elif kind=='hydro': builds=[(0,88,92,140,'plant'),(106,58,128,170,'plant'),(250,92,95,136,'concrete'),(360,54,114,174,'plant')]
    elif kind=='crossroads': builds=[(0,74,112,154,'ruin'),(126,46,122,182,'brick'),(263,82,102,146,'ruin'),(382,57,92,171,'brick')]
    else: builds=[(0,86,105,142,'core'),(124,54,110,174,'core'),(254,76,94,152,'core'),(365,35,110,193,'core')]
    for bi,(bx,by,bw,bh,typ) in enumerate(builds):
        base_col=z['mid'];outline=(30,45,43,255)
        d.rectangle((bx,by,bx+bw,by+bh),fill=outline);d.rectangle((bx+2,by+2,bx+bw-2,by+bh),fill=base_col)
        # exposed beams / broken roof
        for k in range(2):
            hx=bx+random.randint(8,max(9,bw-25));hy=by+random.randint(12,max(13,bh-32));hw=random.randint(10,min(28,bw-8));hh=random.randint(9,min(24,bh-8));d.rectangle((hx,hy,hx+hw,hy+hh),fill=(20,32,31,235))
            if random.random()>.45:line(d,[(hx,hy),(hx+hw,hy+hh)],(82,74,63,210),1)
        # façade style
        if typ in ('glass','mall'):
            for wy in range(by+10,by+bh-12,18):
                for wx in range(bx+8,bx+bw-8,19):
                    col=(80,123,123,220) if random.random()>.18 else (18,32,32,230);d.rectangle((wx,wy,wx+12,wy+11),fill=col);px(d,wx+2,wy+2,4,2,(173,224,211,110))
        elif typ in ('wood','brick','ruin'):
            for wy in range(by+10,by+bh-8,9):line(d,[(bx+3,wy),(bx+bw-3,wy)],(96,69,55,115),1)
            for wx in range(bx+8,bx+bw-8,22):line(d,[(wx,by+2),(wx,by+bh)],(60,54,47,95),1)
            for wy in range(by+17,by+bh-20,22):
                for wx in range(bx+10,bx+bw-10,24):d.rectangle((wx,wy,wx+11,wy+13),fill=(25,35,32,225))
        else:
            for wy in range(by+14,by+bh-16,21):
                for wx in range(bx+10,bx+bw-8,21):d.rectangle((wx,wy,wx+11,wy+13),fill=(30,48,47,220))
            for wx in range(bx+5,bx+bw,18):line(d,[(wx,by),(wx,by+bh)],(95,111,102,90),1)
        # balconies / pipes / signs
        if bw>90:
            yy=by+random.randint(35,70)
            d.rectangle((bx-3,yy,bx+bw+4,yy+5),fill=(73,67,56,230))
            for xx in range(bx+4,bx+bw,10): line(d,[(xx,yy),(xx,yy-11)],(50,57,52,200),1)
        if bi%2==0:
            signx=bx+8;signy=by+random.randint(28,65);d.rectangle((signx,signy,signx+min(55,bw-15),signy+13),fill=(37,67,70,220));
            for q in range(4):px(d,signx+5+q*8,signy+4,5,3,(139,212,196,175))
        # vines and rooftop vegetation
        for vx in range(bx+6,bx+bw,17):
            if random.random()>.32:vine(d,vx,by,by+random.randint(50,bh),z['green'],seed+bi*17+vx)
        for rx in range(bx,bx+bw,7):
            if random.random()>.18:circ(d,rx,by,random.randint(3,7),z['green'])
    # cables / rails
    if kind in ('alley','crossroads'):
        for yy in (38,53,68):line(d,[(-10,yy),(130,yy+12),(270,yy-4),(490,yy+20)],(24,33,35,220),1)
    if kind=='station':
        d.rectangle((0,208,BASE_W,216),fill=(87,88,77,255));d.rectangle((0,219,BASE_W,224),fill=(54,57,54,255));
        for x in range(0,BASE_W,15):px(d,x,207,7,2,(177,170,137,130))
    if kind in ('plaza','hydro','core'):
        # waterfalls from upper structures
        for wx in ([85,285] if kind=='plaza' else [210,410]):
            d.rectangle((wx,122,wx+12,235),fill=(113,218,235,150))
            for yy in range(125,235,12): px(d,wx+2,yy,7,4,(212,255,255,120))
    # water / grass foreground in mid layer
    d.rectangle((0,228,BASE_W,BASE_H),fill=z['water'])
    for y in range(234,BASE_H,9):
        for x in range((y*5)%22,BASE_W,28):px(d,x,y,14,1,(194,248,244,150))
    for x in range(0,BASE_W,8):
        if random.random()>.08:circ(d,x,226-random.randint(0,9),random.randint(3,6),z['green'])
    # roads / broken platforms in the water
    for x0 in range(15,BASE_W,80):
        if random.random()>.2:
            d.rectangle((x0,222,x0+55,238),fill=(105,116,105,210))
            for xx in range(x0+5,x0+50,12): px(d,xx,225,7,3,(171,181,155,120))
            for g in range(3):circ(d,x0+random.randint(4,50),222,random.randint(2,5),z['green'])
    save_layer(mid,BG/f"{z['name']}_mid.png")

    near=Image.new('RGBA',(BASE_W,BASE_H),(0,0,0,0));d=ImageDraw.Draw(near);random.seed(seed+2)
    # low grass only; no sight-blocking pillars
    for x in range(0,BASE_W,4):
        h=random.randint(3,12);poly(d,[(x,BASE_H),(x+1,BASE_H-h),(x+3,BASE_H)],(22,85,43,195))
    # thin upper cables and leaves in corners
    for yy in (14,29):
        pts=[]
        for x in range(-10,BASE_W+20,22):pts.append((x,yy+int(math.sin(x*.02+idx)*6)))
        line(d,pts,(24,34,35,135),1)
    for x in list(range(0,26,5))+list(range(BASE_W-26,BASE_W,5)):
        for y in range(150,BASE_H,17):
            if random.random()>.40:circ(d,x,y,random.randint(2,5),(31,110,49,145))
    save_layer(near,BG/f"{z['name']}_near.png")

for i,z in enumerate(ZONES,1):gen_zone(z,i)
print('Generated V5 assets in',ROOT)
