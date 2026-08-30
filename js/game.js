/*
 * Elemental Swap V5 — game.js
 * ============================================================================
 * 原生 Canvas 2D 可玩原型：
 * - 方向鍵 + X/Y 的多分支 Command 系統
 * - 十元素射擊／標記／同鍵換位／真實特殊效果
 * - 浮空、KD 倒地保護、Ground Bounce、玩家受身
 * - 明亮的植生廢墟光影像素風
 * - 三階段 Boss + BREAK
 * - 可選 PeerJS 兩人同步
 *
 * 閱讀順序：Input → buildWorld → updatePlayer → Command → Elements → Enemy/Boss → Render
 */
(function(){
'use strict';
const C=window.ES4;
if(!C)throw new Error('ES4 config missing');
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const sign=v=>v<0?-1:1;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const cx=o=>o.x+o.w/2, cy=o=>o.y+o.h/2;
const distance=(a,b)=>Math.hypot(cx(a)-cx(b),cy(a)-cy(b));
const hexA=(hex,a)=>{if(!hex||hex[0]!=='#')return hex;const h=hex.slice(1),n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
const friendly=code=>({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'SPACE',ShiftLeft:'SHIFT',ShiftRight:'SHIFT'}[code]||code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'NUM '));
const zoneAt=x=>C.ZONES.findIndex(z=>x>=z.a&&x<z.b);

// ============================================================================
// 1. INPUT
// ============================================================================
class Input{
  constructor(game){this.game=game;this.held=new Set();this.pressed=new Set();this.capture=null;
    addEventListener('keydown',e=>{
      if(this.capture){e.preventDefault();const fn=this.capture;this.capture=null;fn(e.code);return;}
      const used=Object.values(game.keys).includes(e.code)||Object.values(C.INPUT_ALIASES).flat().includes(e.code);
      if(used||['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
      if(!this.held.has(e.code))this.pressed.add(e.code);this.held.add(e.code);
    },{passive:false});
    addEventListener('keyup',e=>this.held.delete(e.code));
    addEventListener('blur',()=>this.held.clear());
  }
  codes(action){return[this.game.keys[action],...(C.INPUT_ALIASES[action]||[])].filter(Boolean);}
  down(action){return this.codes(action).some(k=>this.held.has(k));}
  tap(action){return this.codes(action).some(k=>this.pressed.has(k));}
  clear(){this.pressed.clear();}
}

// ============================================================================
// 2. ASSETS / AUDIO
// ============================================================================
class Assets{
  constructor(){this.images={};this.load();}
  img(key,src){const im=new Image();im.src=(window.ES4_EMBEDDED_ASSETS&&window.ES4_EMBEDDED_ASSETS[src])||src;im.decoding='async';this.images[key]=im;}
  load(){
    for(const id of Object.keys(C.CLASSES))this.img('player_'+id,`assets/sprites/player_${id}.png`);
    for(const id of ['slime','archer','shield','bat','turret','mage','golem'])this.img('enemy_'+id,`assets/sprites/enemy_${id}.png`);
    this.img('boss','assets/sprites/boss_helios.png');
    for(const e of C.ELEMENTS)this.img('element_'+e.id,`assets/vfx/element_${e.id}.png`);
    for(const k of ['hit','slash_cyan','slash_gold','launcher','explosion','shockwave'])this.img(k,`assets/vfx/${k}.png`);
    for(const theme of ['zone1','zone2','zone3','zone4','zone5','zone6','zone7','zone8'])for(const layer of ['far','mid','near'])this.img(`${theme}_${layer}`,`assets/backgrounds/${theme}_${layer}.png`);
  }
}
class SFX{
  constructor(){this.ctx=null;this.master=null;}
  ensure(){if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.14;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume();return this.ctx;}
  tone(freq=220,dur=.08,type='square',vol=.10,end=null){const c=this.ensure();if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.03);}
  slash(p=1){this.tone(760,.065,'sawtooth',.08*p,140);this.tone(150,.05,'square',.04*p,70);}
  hit(p=1){this.tone(92,.045,'square',.14*p,42);this.tone(850,.035,'triangle',.035*p,260);}
  launch(){this.tone(135,.16,'sawtooth',.11,580);}
  swap(i=0){this.tone(290+i*24,.16,'sine',.09,900);}
  skill(){this.tone(120,.27,'sawtooth',.08,55);this.tone(440,.20,'triangle',.06,880);}
  element(id){const m={fire:180,ice:610,lightning:900,wind:440,earth:88,water:310,light:760,shadow:130,nature:390,gravity:65};this.tone(m[id]||300,.12,['shadow','gravity'].includes(id)?'sine':'triangle',.065,(m[id]||300)*1.65);}
}

// ============================================================================
// 3. COMMAND DATA — X/Y + directions + sequence branches
// ============================================================================
const A={
 X1:{name:'X・疾斬 I',anim:'light1',duration:.22,cancel:.125,events:[{at:.075}],damage:8,w:82,h:68,ox:20,oy:5,kx:80,ky:-15,kd:7,br:6,stop:.036,shake:3,vfx:'slash_cyan'},
 X2:{name:'XX・疾斬 II',anim:'light2',duration:.23,cancel:.13,events:[{at:.082}],damage:9,w:90,h:72,ox:22,oy:2,kx:105,ky:-35,kd:8,br:7,stop:.04,shake:4,vfx:'slash_cyan'},
 X3:{name:'XXX・裂步斬',anim:'light3',duration:.27,cancel:.155,events:[{at:.10}],damage:11,w:106,h:76,ox:24,oy:0,kx:135,ky:-70,kd:10,br:9,stop:.046,shake:5,vfx:'slash_cyan',move:90},
 X4:{name:'XXXX・終結斬',anim:'light4',duration:.37,cancel:.26,events:[{at:.145}],damage:18,w:132,h:84,ox:26,oy:-2,kx:430,ky:-150,kd:35,br:21,stop:.075,shake:9,vfx:'slash_gold',big:true},
 Y1:{name:'Y・重斷',anim:'heavy1',duration:.39,cancel:.27,events:[{at:.18}],damage:21,w:108,h:88,ox:22,oy:-5,kx:275,ky:-90,kd:25,br:25,stop:.068,shake:8,vfx:'slash_gold',big:true,armorBreak:2.5},
 Y2:{name:'YY・裂地終結',anim:'heavy2',duration:.52,cancel:.39,events:[{at:.235}],damage:31,w:142,h:96,ox:25,oy:-5,kx:570,ky:-230,kd:58,br:42,stop:.10,shake:13,vfx:'shockwave',big:true,armorBreak:4},
 XXY:{name:'XXY・逆界挑空',anim:'launcher',duration:.41,cancel:.25,events:[{at:.155}],damage:18,w:115,h:126,ox:18,oy:-42,kx:70,ky:-720,kd:4,br:22,stop:.075,shake:9,vfx:'launcher',launch:true},
 XY:{name:'XY・交錯斬',anim:'heavy1',duration:.31,cancel:.19,events:[{at:.10},{at:.19,damage:.75,kx:180,ky:-90}],damage:10,w:112,h:82,ox:24,oy:-4,kx:95,ky:-30,kd:10,br:11,stop:.045,shake:5,vfx:'slash_gold'},
 XYY:{name:'XYY・旋環破',anim:'heavy2',duration:.48,cancel:.34,events:[{at:.16},{at:.28,damage:1.25,kx:420,ky:-190}],damage:14,w:148,h:110,ox:16,oy:-15,kx:90,ky:-90,kd:38,br:34,stop:.07,shake:10,vfx:'shockwave',big:true},
 XYX:{name:'XYX・回身連斬',anim:'light4',duration:.42,cancel:.29,events:[{at:.12},{at:.22},{at:.31,damage:1.2,kx:350,ky:-120}],damage:8,w:126,h:92,ox:16,oy:-8,kx:70,ky:-40,kd:22,br:18,stop:.04,shake:6,vfx:'slash_cyan'},
 YX:{name:'YX・盾裂',anim:'thrust',duration:.37,cancel:.24,events:[{at:.145}],damage:23,w:138,h:72,ox:28,oy:7,kx:380,ky:-40,kd:28,br:40,stop:.075,shake:9,vfx:'slash_gold',guardBreak:true,move:170},
 YXX:{name:'YXX・逆掃收刃',anim:'sweep',duration:.46,cancel:.32,events:[{at:.14},{at:.29,damage:1.35,kx:450,ky:110}],damage:12,w:145,h:64,ox:22,oy:28,kx:120,ky:80,kd:44,br:30,stop:.065,shake:9,vfx:'shockwave',knockdown:true},
 XXXY:{name:'XXXY・蒼穹裂',anim:'launcher',duration:.54,cancel:.36,events:[{at:.16},{at:.29,damage:1.4,kx:85,ky:-850}],damage:13,w:145,h:155,ox:18,oy:-55,kx:65,ky:-380,kd:5,br:45,stop:.085,shake:13,vfx:'launcher',launch:true,big:true},
 FX:{name:'→X・踏步斬',anim:'thrust',duration:.27,cancel:.16,events:[{at:.095}],damage:12,w:125,h:70,ox:30,oy:5,kx:230,ky:-45,kd:11,br:10,stop:.045,shake:5,vfx:'slash_cyan',move:260},
 FY:{name:'→Y・貫穿重突',anim:'thrust',duration:.43,cancel:.30,events:[{at:.18}],damage:26,w:168,h:76,ox:36,oy:3,kx:520,ky:-80,kd:34,br:42,stop:.085,shake:11,vfx:'slash_gold',move:330,guardBreak:true,big:true},
 BX:{name:'←X・退身月斬',anim:'light2',duration:.30,cancel:.18,events:[{at:.105}],damage:12,w:105,h:82,ox:14,oy:-4,kx:190,ky:-80,kd:10,br:12,stop:.048,shake:5,vfx:'slash_cyan',backstep:240},
 BY:{name:'←Y・反擊架勢',anim:'heavy1',duration:.48,cancel:.35,events:[{at:.25}],damage:24,w:118,h:92,ox:15,oy:-8,kx:410,ky:-130,kd:30,br:34,stop:.09,shake:10,vfx:'shockwave',counter:true,big:true},
 UX:{name:'↑X・昇刃',anim:'launcher',duration:.36,cancel:.22,events:[{at:.13}],damage:15,w:100,h:132,ox:10,oy:-55,kx:55,ky:-650,kd:3,br:18,stop:.065,shake:8,vfx:'launcher',launch:true},
 UY:{name:'↑Y・天穹破',anim:'launcher',duration:.49,cancel:.33,events:[{at:.20}],damage:27,w:132,h:162,ox:15,oy:-75,kx:65,ky:-900,kd:2,br:44,stop:.095,shake:13,vfx:'launcher',launch:true,big:true},
 DX:{name:'↓X・低空掃',anim:'sweep',duration:.31,cancel:.19,events:[{at:.11}],damage:13,w:132,h:54,ox:22,oy:34,kx:250,ky:90,kd:30,br:15,stop:.05,shake:6,vfx:'slash_cyan',knockdown:true},
 DY:{name:'↓Y・地脈崩擊',anim:'heavy2',duration:.56,cancel:.39,events:[{at:.25}],damage:32,w:160,h:112,ox:14,oy:12,kx:460,ky:250,kd:70,br:50,stop:.11,shake:15,vfx:'shockwave',knockdown:true,big:true},
 DASHX:{name:'Dash X・瞬步穿斬',anim:'dash',duration:.29,cancel:.18,events:[{at:.095}],damage:16,w:150,h:72,ox:35,oy:5,kx:350,ky:-80,kd:18,br:17,stop:.06,shake:7,vfx:'slash_cyan',move:620,invuln:.10},
 DASHY:{name:'Dash Y・破陣衝鋒',anim:'thrust',duration:.40,cancel:.27,events:[{at:.16}],damage:25,w:165,h:90,ox:38,oy:-3,kx:560,ky:-170,kd:42,br:48,stop:.09,shake:12,vfx:'shockwave',move:700,guardBreak:true,big:true,invuln:.08},
 AIRX:{name:'Air X・空中追斬',anim:'air',duration:.25,cancel:.15,events:[{at:.09}],damage:11,w:100,h:88,ox:22,oy:-5,kx:95,ky:-145,kd:5,br:9,stop:.045,shake:5,vfx:'slash_cyan'},
 AIRXX:{name:'Air XX・雙月追擊',anim:'air',duration:.31,cancel:.20,events:[{at:.08},{at:.19,damage:1.25,kx:180,ky:-120}],damage:9,w:118,h:98,ox:22,oy:-8,kx:70,ky:-90,kd:9,br:13,stop:.045,shake:6,vfx:'slash_cyan'},
 AIRY:{name:'Air Y・隕落斬',anim:'dive',duration:.45,cancel:.36,events:[{at:.20}],damage:25,w:96,h:118,ox:5,oy:20,kx:90,ky:520,kd:48,br:34,stop:.09,shake:12,vfx:'shockwave',slam:true,big:true},
 AIRUX:{name:'Air ↑X・鷹返',anim:'air',duration:.34,cancel:.22,events:[{at:.12}],damage:16,w:110,h:125,ox:16,oy:-50,kx:75,ky:-590,kd:3,br:18,stop:.06,shake:7,vfx:'launcher',launch:true},
 AIRDY:{name:'Air ↓Y・墜星',anim:'dive',duration:.52,cancel:.43,events:[{at:.23}],damage:32,w:120,h:150,ox:8,oy:22,kx:120,ky:650,kd:72,br:50,stop:.11,shake:15,vfx:'explosion',slam:true,big:true},
};

// ============================================================================
// 4. GAME STATE / WORLD BUILD
// ============================================================================
class Game{
 constructor(){
  this.canvas=$('#game');this.ctx=this.canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
  this.keys=this.loadKeys();this.input=new Input(this);this.assets=new Assets();this.sfx=new SFX();this.net=new ES4Network();
  this.time=0;this.last=performance.now();this.paused=false;this.modal=false;this.hitStop=0;this.shake=0;this.flash=0;this.damageFlash=0;
  this.camera={x:0,y:70};this.zone=0;this.message={text:'',t:0,color:'#fff'};this.objectiveStep=0;this.combatUnlocked=false;
  this.combo={hits:0,damage:0,t:0,best:0,command:''};this.score=0;this.kills=0;this.deaths=0;
  this.solids=[];this.moving=[];this.tempSolids=[];this.hazards=[];this.water=[];this.puzzles=[];this.crates=[];this.checkpoints=[];
  this.enemies=[];this.projectiles=[];this.enemyShots=[];this.attacks=[];this.effects=[];this.fields=[];this.skillShots=[];this.turrets=[];
  this.nextId=1;this.anchors={};for(const e of C.ELEMENTS)this.anchors[e.id]=null;
  this.player=this.makePlayer();this.remote=null;this.familiar=null;this.lightReveal=0;this.overdrive=0;this.worldComplete=false;
  this.buildWorld();this.bindUI();this.bindNetwork();this.resize();addEventListener('resize',()=>this.resize());requestAnimationFrame(t=>this.loop(t));
 }
 loadKeys(){try{return{...C.DEFAULT_KEYS,...JSON.parse(localStorage.getItem('es4_keys')||'{}')}}catch{return{...C.DEFAULT_KEYS}}}
 saveKeys(){try{localStorage.setItem('es4_keys',JSON.stringify(this.keys))}catch{}}
 makePlayer(){const cl=C.CLASSES.rift;return{x:180,y:C.GROUND_Y-C.PLAYER.h,w:C.PLAYER.w,h:C.PLAYER.h,vx:0,vy:0,dir:1,onGround:false,jumps:0,coyote:0,
   hp:cl.maxHp,maxHp:cl.maxHp,mp:cl.maxMp,maxMp:cl.maxMp,classId:'rift',inv:0,shield:0,armor:0,phase:0,lowG:0,dashT:0,dashCD:0,
   attack:null,buffer:null,history:'',historyT:0,downT:0,recoverT:0,hurtT:0,castT:0,skillCD:[0,0,0],qCD:0,rift:0,beastForm:'wolf',beastKing:0,summonFrenzy:0,checkpointX:180,checkpointY:C.GROUND_Y-C.PLAYER.h};}
 resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.max(800,Math.floor(r.width*d));this.canvas.height=Math.max(450,Math.floor(r.height*d));this.ctx.setTransform(d,0,0,d,0,0);this.viewW=r.width;this.viewH=r.height;}
 id(){return this.nextId++;}
 addSolid(x,y,w,h,type='ground',o={}){const s={id:this.id(),x,y,w,h,type,oneWay:!!o.oneWay,active:o.active!==false,conveyor:o.conveyor||0,...o};this.solids.push(s);return s;}
 addMoving(x,y,w,h,axis,amp,speed,phase=0){const p={id:this.id(),x,y,baseX:x,baseY:y,w,h,type:'moving',oneWay:true,active:true,axis,amp,speed,phase,vx:0,vy:0};this.moving.push(p);return p;}
 spawn(type,x,y,o={}){const t=C.ENEMIES[type],w=o.w||(type==='boss'?118:type==='golem'?78:56),h=o.h||(type==='boss'?132:type==='golem'?92:60);const e={id:this.id(),type,ai:t.ai,name:t.name,x,y:y-h,w,h,vx:0,vy:0,dir:-1,hp:o.hp||t.hp,maxHp:o.hp||t.hp,damage:t.damage,speed:t.speed,home:x,range:o.range||520,onGround:false,dead:false,
   aggro:false,alert:0,aiT:rand(.3,1.2),shotT:rand(.5,1.5),hitT:0,stun:0,freeze:0,root:0,wet:0,burn:0,burnTick:0,curse:0,armorBreak:0,mark:null,markUntil:0,airborne:false,kd:0,downT:0,bounced:false,
   bossPhase:1,bossAction:null,bossPhaseT:0,breakMax:type==='boss'?430:0,break:type==='boss'?430:0,breakStun:0};this.enemies.push(e);return e;}
 buildWorld(){
  // Ground is intentionally open; no decorative foreground columns block the play space.
  const grounds=[[0,2550],[2700,4300],[4480,5900],[6120,7600],[7780,9100],[9280,10900],[11100,12550],[12750,14250],[14480,16000],[16220,17750],[18020,19400],[19600,20900],[21150,24000]];
  for(const[a,b]of grounds)this.addSolid(a,C.GROUND_Y,b-a,180,'ground');
  const P=(x,y,w=180)=>this.addSolid(x,y,w,24,'platform',{oneWay:true});
  [[460,585,220],[840,500,190],[1210,425,180],[1750,570,210],[2150,470,180],
   [3050,580,210],[3400,480,200],[3800,385,190],[4680,575,230],[5100,465,200],[5480,365,180],
   [6300,575,230],[6680,465,210],[7100,360,200],[7920,570,220],[8300,455,220],[8700,340,200],
   [9500,575,220],[9880,450,200],[10280,335,190],[11250,575,230],[11680,455,210],[12100,350,200],
   [13000,570,230],[13420,450,210],[13820,335,190],[14700,570,230],[15100,450,210],[15500,340,190],
   [16450,570,230],[16850,450,210],[17250,335,190],[18200,570,220],[18600,455,210],[19000,350,200],
   [19800,575,230],[20200,455,210],[20620,340,190],[21400,570,250],[21850,450,220],[22300,335,220],[22800,570,240],[23300,450,210]].forEach(a=>P(...a));
  this.addMoving(2520,520,150,22,'y',145,1.25);this.addMoving(5900,470,165,22,'x',220,.9,1.1);this.addMoving(10900,430,170,22,'y',180,1.1,2);this.addMoving(15950,500,160,22,'x',260,1.0,.7);this.addMoving(20900,430,180,22,'y',170,1.2,.4);
  // Hazards / water
  this.hazards.push({id:this.id(),type:'spikes',x:2520,y:683,w:160,h:37},{id:this.id(),type:'spikes',x:5920,y:683,w:180,h:37},{id:this.id(),type:'spikes',x:10930,y:683,w:150,h:37},{id:this.id(),type:'spikes',x:15990,y:683,w:190,h:37});
  this.water.push({id:this.id(),x:3050,y:650,w:620,h:100,frozenUntil:0},{id:this.id(),x:13050,y:650,w:560,h:100,frozenUntil:0},{id:this.id(),x:16600,y:650,w:620,h:100,frozenUntil:0});
  this.hazards.push({id:this.id(),type:'fireWall',x:3850,y:485,w:52,h:235,active:true},{id:this.id(),type:'laser',x:15700,y:380,w:18,h:340,phase:0},{id:this.id(),type:'laser',x:17300,y:315,w:18,h:405,phase:1.2});
  // Puzzle objects
  this.puzzles.push(
   {id:this.id(),type:'torch',x:1180,y:365,w:40,h:62,lit:false},
   {id:this.id(),type:'gate',x:2320,y:380,w:50,h:340,condition:'torch',open:false},
   {id:this.id(),type:'node',x:4100,y:610,w:55,h:80,active:false},
   {id:this.id(),type:'gate',x:4300,y:380,w:50,h:340,condition:'node',open:false},
   {id:this.id(),type:'crate',x:6400,y:660,w:60,h:60,vx:0,vy:0},
   {id:this.id(),type:'plate',x:6900,y:696,w:105,h:20,pressed:false},
   {id:this.id(),type:'gate',x:7440,y:390,w:48,h:330,condition:'plate',open:false},
   {id:this.id(),type:'lightBridge',x:9650,y:535,w:500,h:24,revealedUntil:0},
   {id:this.id(),type:'shadowWall',x:10440,y:390,w:55,h:330},
   {id:this.id(),type:'seed',x:12180,y:650,w:44,h:54,grown:false},
   {id:this.id(),type:'core',x:13550,y:600,w:54,h:54,vx:0,vy:0,inserted:false,socketX:14020},
   {id:this.id(),type:'socket',x:13990,y:625,w:90,h:90,charged:false},
   {id:this.id(),type:'brittleWall',x:19350,y:390,w:80,h:330,broken:false,cracked:false},
   {id:this.id(),type:'exit',x:23780,y:520,w:90,h:200,active:false}
  );
  // Checkpoints
  for(const z of C.ZONES)this.checkpoints.push({x:z.a+150,y:C.GROUND_Y-85,w:28,h:85,active:z.a===0,zone:z.name});
  // Enemies — safe area only has dummy.
  this.spawn('dummy',850,C.GROUND_Y);[
   [1600,'slime'],[2050,'archer'],[3250,'slime'],[3600,'bat'],[4050,'archer'],[4850,'shield'],[5400,'golem'],
   [6500,'slime'],[7050,'shield'],[8200,'bat'],[8650,'archer'],[9700,'mage'],[10350,'shield'],[11400,'mage'],[12000,'golem'],
   [13200,'turret'],[13850,'shield'],[14900,'turret'],[15400,'mage'],[16650,'bat'],[17100,'golem'],[18300,'archer'],[18800,'mage'],[20000,'golem'],[20500,'shield']
  ].forEach(([x,t])=>this.spawn(t,x,t==='bat'?390:C.GROUND_Y));
  this.spawn('boss',22900,C.GROUND_Y,{range:1000});
  // NPCs
  this.npcs=[
   {id:'mentor',name:'回路導師・璃安',x:540,y:C.GROUND_Y-66,w:44,h:66,text:'方向鍵移動。X 與 Y 不只有連打，搭配 ↑↓←→、Dash、空中狀態會變成不同招式。'},
   {id:'smith',name:'機巧匠・鉚釘',x:6250,y:C.GROUND_Y-66,w:44,h:66,text:'補滿 HP／MP。風可以推箱，引力可以直接把核心和敵人拉過來。'},
   {id:'archivist',name:'舊都檔案員・M3',x:15150,y:C.GROUND_Y-66,w:44,h:66,text:'這座城市沒有死去，只是把鋼筋交還給藤蔓，把地下鐵交還給水。'}
  ];
 }
// ============================================================================
// 5. LOOP / GLOBAL UPDATE
// ============================================================================
 loop(ts){let dt=Math.min(.033,(ts-this.last)/1000||0);this.last=ts;if(this.hitStop>0){this.hitStop-=dt;dt*=.07;}if(!this.paused&&!this.modal)this.update(dt,ts);this.render();this.input.clear();requestAnimationFrame(t=>this.loop(t));}
 update(dt,ts){
  this.time+=dt;this.flash=Math.max(0,this.flash-dt*2.6);this.damageFlash=Math.max(0,this.damageFlash-dt*3.4);this.shake*=Math.pow(.01,dt);this.lightReveal=Math.max(0,this.lightReveal-dt);this.overdrive=Math.max(0,this.overdrive-dt);
  this.handleSystemInput();this.updateTutorial();this.updateMoving(dt);this.updatePlayer(dt);this.updateAttacks(dt);this.updateProjectiles(dt);this.updateSkillShots(dt);this.updateFields(dt);this.updateEnemies(dt);this.updateEnemyShots(dt);this.updatePuzzles(dt);this.updateEffects(dt);this.updateNetwork(ts);
  if(this.combo.t>0){this.combo.t-=dt;if(this.combo.t<=0){this.combo.hits=0;this.combo.damage=0;}}
  if(this.message.t>0)this.message.t-=dt;
  const zi=Math.max(0,zoneAt(cx(this.player)));if(zi!==this.zone){this.zone=zi;this.say(C.ZONES[zi].name+'｜'+C.ZONES[zi].objective,3,'#dffcff');}
  const target=clamp(this.player.x-this.viewW*.41,0,C.WORLD_W-this.viewW);this.camera.x=lerp(this.camera.x,target,1-Math.pow(.0007,dt));
  this.updateHUD();
 }
 handleSystemInput(){
  if(this.input.tap('pause')){this.paused=!this.paused;$('#pauseOverlay').hidden=!this.paused;}
  if(this.input.tap('help')){this.modal=true;$('#helpPanel').hidden=false;}
  if(this.input.tap('settings')){this.openSettings();}
  if(this.input.tap('reset'))this.respawn('手動重置');
  if(this.input.tap('clearAnchors')){for(const e of C.ELEMENTS)this.anchors[e.id]=null;this.projectiles=[];this.say('已清除十元素錨點',1.4,'#d3e0ec');}
 }
 updateTutorial(){const p=this.player;this.combatUnlocked=p.x>C.SAFE_ZONE_END;
  if(this.objectiveStep===0&&Math.abs(p.x-180)>80){this.objectiveStep=1;this.say('STEP 2｜按 1 發射火元素',3,'#ff9b70');}
  if(this.objectiveStep===1&&this.projectiles.length){this.objectiveStep=2;this.say('STEP 3｜再按 1，和火元素交換位置',3,'#ff9b70');}
  if(this.objectiveStep===2&&this.statsSwaps>0){this.objectiveStep=3;this.say('STEP 4｜對藍色傀儡輸入 X X Y 挑空',4,'#7ae8ff');}
  if(this.objectiveStep===3&&this.combo.best>=3){this.objectiveStep=4;this.say('STEP 5｜跨過黃色安全線，正式進入戰鬥',4,'#ffe47a');}
  if(this.objectiveStep===4&&this.combatUnlocked){this.objectiveStep=5;this.say('戰鬥區啟動｜紅色 !、邊緣箭頭與預警區代表威脅',4,'#ff8295');}
 }
 objective(){
  if(this.objectiveStep===0)return['STEP 1｜方向鍵移動','預設方向鍵是數字鍵盤旁的 ← → ↑ ↓；A/D 仍可作為副鍵。'];
  if(this.objectiveStep===1)return['STEP 2｜發射火元素','按 1。火彈命中會燃燒，不再只是換位子彈。'];
  if(this.objectiveStep===2)return['STEP 3｜同鍵換位','再按 1。你會與火彈／火標記敵人交換，並在兩端留下火區。'];
  if(this.objectiveStep===3)return['STEP 4｜X/Y Command','對訓練傀儡按 X X Y 挑空；也可試 ↑X、↓Y、→X。'];
  if(this.objectiveStep===4)return['STEP 5｜離開安全區','越過黃色線後怪物才會主動攻擊。'];
  return[C.ZONES[this.zone]?.name||'探索',C.ZONES[this.zone]?.objective||''];
 }
 say(text,t=2.2,color='#fff'){this.message={text,t,color};}

// ============================================================================
// 6. COLLISION / MOVEMENT
// ============================================================================
 activeSolids(body=this.player){
  const arr=[...this.solids,...this.moving,...this.tempSolids.filter(s=>s.life>0)];
  for(const p of this.puzzles){
   if(p.type==='lightBridge'&&p.revealedUntil>this.time)arr.push({...p,type:'lightBridge',oneWay:true,active:true});
   if(p.type==='shadowWall'&&!(body===this.player&&this.player.phase>0))arr.push({...p,type:'shadowWall',oneWay:false,active:true});
   if(p.type==='brittleWall'&&!p.broken)arr.push({...p,oneWay:false,active:true});
   if(p.type==='gate'&&!p.open)arr.push({...p,oneWay:false,active:true});
   if(p.type==='crate')arr.push({...p,oneWay:false,active:true});
  }
  for(const w of this.water)if(w.frozenUntil>this.time)arr.push({x:w.x,y:w.y-14,w:w.w,h:18,type:'iceWater',oneWay:true,active:true});
  return arr.filter(s=>s.active!==false);
 }
 moveBody(b,dt,enemy=false){const oldX=b.x,oldY=b.y;
  b.x+=b.vx*dt;for(const s of this.activeSolids(b)){if(s.oneWay||!overlap(b,s))continue;if(b.vx>0)b.x=s.x-b.w;else if(b.vx<0)b.x=s.x+s.w;b.vx=0;}
  b.onGround=false;b.y+=b.vy*dt;for(const s of this.activeSolids(b)){if(!overlap(b,s))continue;const prevBottom=oldY+b.h;if(b.vy>=0){if(s.oneWay&&prevBottom>s.y+13)continue;b.y=s.y-b.h;b.vy=0;b.onGround=true;if(!enemy&&s.conveyor)b.x+=s.conveyor*dt;if(!enemy&&s.type==='moving'){b.x+=s.vx*dt;b.y+=s.vy*dt;}}else if(!s.oneWay&&oldY>=s.y+s.h-12){b.y=s.y+s.h;b.vy=0;}}
  b.x=clamp(b.x,0,C.WORLD_W-b.w);if(b.y>C.WORLD_H+180){if(enemy)b.dead=true;else this.respawn('墜落');}
  return{oldX,oldY};
 }
 updateMoving(dt){for(const p of this.moving){const ox=p.x,oy=p.y,w=Math.sin(this.time*p.speed+p.phase);if(p.axis==='x')p.x=p.baseX+w*p.amp;else p.y=p.baseY+w*p.amp;p.vx=(p.x-ox)/Math.max(dt,.001);p.vy=(p.y-oy)/Math.max(dt,.001);}}
 directionIntent(){const p=this.player,up=this.input.down('up'),down=this.input.down('down'),left=this.input.down('left'),right=this.input.down('right');let rel='N';if(up&&!down)rel='U';else if(down&&!up)rel='D';else if((right&&p.dir>0)||(left&&p.dir<0))rel='F';else if((right&&p.dir<0)||(left&&p.dir>0))rel='B';return rel;}
 updatePlayer(dt){const p=this.player,cl=C.CLASSES[p.classId];
  p.inv=Math.max(0,p.inv-dt);p.phase=Math.max(0,p.phase-dt);p.lowG=Math.max(0,p.lowG-dt);p.armor=Math.max(0,p.armor-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.hurtT=Math.max(0,p.hurtT-dt);p.castT=Math.max(0,p.castT-dt);p.recoverT=Math.max(0,p.recoverT-dt);p.qCD=Math.max(0,p.qCD-dt);p.beastKing=Math.max(0,p.beastKing-dt);p.summonFrenzy=Math.max(0,p.summonFrenzy-dt);p.skillCD=p.skillCD.map(x=>Math.max(0,x-dt));p.mp=Math.min(p.maxMp,p.mp+(p.classId==='summoner'?5.3:4.0)*dt);
  if(p.historyT>0){p.historyT-=dt;if(p.historyT<=0)p.history='';}
  // Down / tech window
  if(p.downT>0){p.downT-=dt;const elapsed=1.18-p.downT;if(elapsed>.28&&elapsed<.84&&this.input.tap('jump')){p.downT=0;p.recoverT=.34;p.inv=.48;p.vy=-200;p.vx=-p.dir*90;this.say('TECH / 受身成功',.9,'#dffcff');this.addFx('shockwave',cx(p),cy(p),.32,1.0,'#7ee8ff');this.sfx.swap(6);}p.vy=Math.min(C.PLAYER.maxFall,p.vy+C.GRAVITY*dt);this.moveBody(p,dt);p.vx*=Math.pow(.03,dt);return;}
  if(this.input.tap('light'))this.startCommand('X');if(this.input.tap('heavy'))this.startCommand('Y');
  if(this.input.tap('skill1'))this.useSkill(0);if(this.input.tap('skill2'))this.useSkill(1);if(this.input.tap('skill3'))this.useSkill(2);if(this.input.tap('classSkill'))this.useClassSkill();
  for(let i=0;i<10;i++)if(this.input.tap(`e${i+1}`)){this.elementPress(i);break;}
  if(this.input.tap('interact'))this.interact();
  let axis=(this.input.down('right')?1:0)-(this.input.down('left')?1:0);if(axis)p.dir=axis;
  let speed=C.PLAYER.speed*cl.speed;if(p.classId==='beast'&&(p.beastForm==='wolf'||p.beastKing>0))speed*=1.18;if(p.classId==='beast'&&p.beastForm==='bear')speed*=.86;
  if(this.input.tap('dash')&&p.dashCD<=0&&!p.attack){p.dashT=C.PLAYER.dashTime;p.dashCD=C.PLAYER.dashCooldown;p.inv=Math.max(p.inv,.10);p.vx=p.dir*C.PLAYER.dashSpeed;this.addFx('shockwave',cx(p),p.y+p.h*.75,.22,.65,C.CLASSES[p.classId].color);this.sfx.slash(.7);}
  if(p.dashT>0){p.dashT-=dt;p.vx=p.dir*C.PLAYER.dashSpeed*(p.classId==='beast'&&p.beastForm==='wolf'?1.17:1);}
  else if(!p.attack||p.attack.elapsed>=p.attack.def.cancel){const target=axis*speed,acc=p.onGround?C.PLAYER.accel:C.PLAYER.airAccel;p.vx+=(target-p.vx)*Math.min(1,acc*dt/Math.max(1,speed));if(!axis)p.vx*=Math.pow(p.onGround?.0008:.18,dt);}
  if(p.onGround){p.jumps=0;p.coyote=C.PLAYER.coyote;}else p.coyote=Math.max(0,p.coyote-dt);
  if(this.input.tap('jump')){const max=p.classId==='beast'&&(p.beastForm==='eagle'||p.beastKing>0)?3:2;if(p.onGround||p.coyote>0||p.jumps<max){const second=!p.onGround&&p.coyote<=0;if(second)p.jumps++;else p.jumps=1;p.vy=-C.PLAYER.jump*(p.classId==='beast'&&p.beastForm==='eagle'?1.08:1);p.onGround=false;p.coyote=0;this.addFx('shockwave',cx(p),p.y+p.h,.20,.55,second?'#dffcff':cl.color);this.sfx.tone(second?440:320,.07,'square',.045,second?720:520);}}
  const grav=p.lowG>0?.35:1;p.vy=Math.min(C.PLAYER.maxFall,p.vy+C.GRAVITY*grav*dt);this.moveBody(p,dt);
  // Water buoyancy
  for(const w of this.water)if(w.frozenUntil<=this.time&&overlap(p,w)){p.vx*=Math.pow(.12,dt);p.vy-=C.GRAVITY*.82*dt;p.vy=Math.max(p.vy,-300);if(this.input.tap('jump'))p.vy=-500;}
  this.checkPlayerHazards();
  for(const cp of this.checkpoints)if(Math.abs(cx(p)-cp.x)<60&&!cp.active){this.checkpoints.forEach(c=>c.active=false);cp.active=true;p.checkpointX=cp.x;p.checkpointY=C.GROUND_Y-p.h-5;this.say('CHECKPOINT｜'+cp.zone,1.7,'#85f0d0');}
  this.updateFamiliar(dt);this.updateTurrets(dt);
 }
 checkPlayerHazards(){const p=this.player;for(const h of this.hazards){if(h.type==='laser')h.active=Math.sin(this.time*2.4+h.phase)>-.2;if(h.type==='spikes'&&overlap(p,h))this.hurtPlayer(20,h.x,'尖刺');if(h.type==='fireWall'&&h.active&&overlap(p,h))this.hurtPlayer(18,h.x,'火牆');if(h.type==='laser'&&h.active&&overlap(p,h))this.hurtPlayer(14,h.x,'雷射');}}
 respawn(reason){const p=this.player;this.deaths++;p.x=p.checkpointX;p.y=p.checkpointY;p.vx=p.vy=0;p.hp=p.maxHp;p.mp=Math.max(p.mp,p.maxMp*.55);p.inv=1.3;p.downT=0;p.attack=null;p.history='';this.say('回路重構｜'+reason,2,'#ff9aaa');}
// ============================================================================
// 7. X / Y COMMAND SYSTEM
// ============================================================================
 resolveCommand(sym){const p=this.player,dir=this.directionIntent(),air=!p.onGround,dash=p.dashT>0;
  if(air){if(sym==='X'&&dir==='U')return'AIRUX';if(sym==='Y'&&dir==='D')return'AIRDY';if(sym==='Y')return'AIRY';return p.history.endsWith('X')?'AIRXX':'AIRX';}
  if(dash)return sym==='X'?'DASHX':'DASHY';
  if(dir==='U')return sym==='X'?'UX':'UY';if(dir==='D')return sym==='X'?'DX':'DY';if(dir==='F')return sym==='X'?'FX':'FY';if(dir==='B')return sym==='X'?'BX':'BY';
  const h=p.history;
  if(sym==='X'){
   if(h.endsWith('YY'))return'YXX';if(h.endsWith('XY'))return'XYX';
   const n=(h.match(/X/g)||[]).length;return['X1','X2','X3','X4'][Math.min(n,3)];
  }
  if(h.endsWith('XXX'))return'XXXY';if(h.endsWith('XY'))return'XYY';if(h.endsWith('XX'))return'XXY';if(h.endsWith('X'))return'XY';if(h==='Y')return'Y2';return'Y1';
 }
 startCommand(sym){const p=this.player;if(p.downT>0||p.recoverT>0||p.castT>0)return;if(p.attack&&p.attack.elapsed<p.attack.def.cancel){p.buffer=sym;return;}
  const key=this.resolveCommand(sym),def={...A[key],key,events:A[key].events.map(e=>({...e,done:false,hitIds:new Set()}))};
  // class modifiers
  if(p.classId==='rift')def.damage*=1.08;if(p.classId==='beast'&&(p.beastForm==='wolf'||p.beastKing>0))def.duration*=.84;if(p.classId==='beast'&&(p.beastForm==='bear'||p.beastKing>0)){def.damage*=1.25;def.br*=1.25;p.armor=Math.max(p.armor,.4);}if(p.classId==='beast'&&(p.beastForm==='eagle'||p.beastKing>0)&&!p.onGround)def.damage*=1.2;
  p.attack={def,elapsed:0};if(def.invuln)p.inv=Math.max(p.inv,def.invuln);if(def.move)p.vx=p.dir*def.move;if(def.backstep)p.vx=-p.dir*def.backstep;if(def.slam)p.vy=560;
  const sequenceCommand=['X1','X2','X3','X4','Y1','Y2','XXY','XY','XYY','XYX','YX','YXX','XXXY','AIRX'].includes(key);
  if(sequenceCommand){p.history=(p.history+sym).slice(-4);p.historyT=C.PLAYER.comboTimeout;}else{p.history='';p.historyT=0;}if(key==='AIRXX')p.history='';
  if(['X4','XYY','XYX','YXX','XXXY'].includes(key))p.history='';
  this.combo.command=def.name;this.sfx.slash(def.big?1.25:.85);
 }
 updateAttacks(dt){const p=this.player;if(!p.attack)return;const at=p.attack,d=at.def;at.elapsed+=dt;
  for(const ev of d.events){if(ev.done||at.elapsed<ev.at)continue;ev.done=true;const dmg=d.damage*(ev.damage??1),kx=(ev.kx??d.kx)*p.dir,ky=ev.ky??d.ky;const box={x:p.dir>0?p.x+p.w/2+d.ox:p.x+p.w/2-d.ox-d.w,y:p.y+d.oy,w:d.w,h:d.h};
   let count=0;for(const e of this.enemies){if(e.dead||ev.hitIds.has(e.id)||!overlap(box,e))continue;ev.hitIds.add(e.id);this.hitEnemy(e,dmg,{dir:p.dir,kx,ky,kd:d.kd,br:d.br,big:d.big,guardBreak:d.guardBreak,armorBreak:d.armorBreak,knockdown:d.knockdown,slam:d.slam,color:C.CLASSES[p.classId].color,label:d.name});count++;}
   this.addFx(d.vfx,cx(box),cy(box),d.big?.34:.23,d.big?1.7:1.15,C.CLASSES[p.classId].color,p.dir);if(count){p.mp=Math.min(p.maxMp,p.mp+count*(d.big?6:3));this.hitStop=Math.max(this.hitStop,d.stop);this.shake=Math.max(this.shake,d.shake);this.sfx.hit(d.big?1.2:.85);if(d.launch)this.sfx.launch();}
  }
  if(at.elapsed>=d.duration){p.attack=null;if(p.buffer){const b=p.buffer;p.buffer=null;this.startCommand(b);}}
  else if(p.buffer&&at.elapsed>=d.cancel){const b=p.buffer;p.buffer=null;p.attack=null;this.startCommand(b);}
 }
 hitEnemy(e,amount,o={}){if(e.dead)return;let dmg=amount;
  // shield front block
  if(e.ai==='shield'&&e.armorBreak<=0&&!o.guardBreak){const front=(cx(this.player)<cx(e)&&e.dir<0)||(cx(this.player)>cx(e)&&e.dir>0);if(front){dmg*=.25;this.floatText('BLOCK',cx(e),e.y-15,'#d8edf7',13);}}
  if(e.armorBreak>0)dmg*=1.25;if(e.curse>0)dmg*=1.18;if(e.type==='boss'&&e.breakStun>0)dmg*=1.5;
  e.hp-=dmg;e.hitT=.15;e.stun=Math.max(e.stun,o.big?.20:.10);if(o.armorBreak)e.armorBreak=Math.max(e.armorBreak,o.armorBreak);if(o.guardBreak)e.armorBreak=Math.max(e.armorBreak,4.5);
  const armored=(e.ai==='heavy'||e.ai==='boss')&&e.armorBreak<=0&&e.breakStun<=0;if(!armored||o.big){e.vx+=o.kx||0;e.vy+=o.ky||0;}if((o.ky||0)<-120){e.airborne=true;e.downT=0;}
  e.kd+=(o.kd||0);if(o.knockdown&&e.onGround){e.downT=.75;e.stun=.75;e.kd=0;e.vy=-160;}if(o.slam&&e.downT>0&&!e.bounced){e.bounced=true;e.downT=0;e.airborne=true;e.vy=-470;this.say('GROUND BOUNCE',.7,'#fff0a0');}
  if(e.type==='boss'){e.break-=o.br||5;if(e.break<=0&&e.breakStun<=0){e.break=e.breakMax;e.breakStun=2.6;e.stun=2.6;e.vx=0;this.say('BREAK！Boss 失衡｜傷害 ×1.5',2.4,'#7beaff');this.addFx('shockwave',cx(e),cy(e),.7,2.4,'#7beaff');this.shake=24;}}
  this.combo.hits++;this.combo.damage+=dmg;this.combo.t=1.8;this.combo.best=Math.max(this.combo.best,this.combo.hits);this.score+=Math.round(dmg*10);this.floatText(Math.round(dmg),cx(e),e.y-8,o.color||'#fff',o.big?21:16);this.addFx('hit',cx(e),cy(e),.22,o.big?1.2:.8,o.color||'#fff');
  if(this.player.classId==='rift')this.player.rift=Math.min(100,this.player.rift+(o.big?7:3));if(e.hp<=0)this.killEnemy(e,o.color);
 }
 killEnemy(e,color='#fff'){if(e.dead)return;e.dead=true;e.hp=0;this.kills++;this.score+=e.type==='boss'?10000:500;this.addFx('explosion',cx(e),cy(e),e.type==='boss'?1.0:.48,e.type==='boss'?2.7:1.2,color);if(e.type==='boss'){this.worldComplete=true;const exit=this.puzzles.find(p=>p.type==='exit');if(exit)exit.active=true;this.say('十相哨兵擊破｜最終出口已開啟',5,'#fff0b0');this.shake=28;}}
 hurtPlayer(amount,sourceX,label){const p=this.player;if(p.inv>0||p.phase>0)return;let dmg=amount;if(p.shield>0){const take=Math.min(p.shield,dmg);p.shield-=take;dmg-=take;}if(p.armor>0)dmg*=.58;if(p.classId==='beast'&&(p.beastForm==='bear'||p.beastKing>0))dmg*=.78;if(dmg<=0)return;p.hp-=dmg;p.inv=C.PLAYER.invulnAfterHit;p.hurtT=.28;p.vx=(cx(p)<sourceX?-1:1)*420;p.vy=-340;this.damageFlash=.3;this.shake=12;this.combo.hits=0;this.addFx('hit',cx(p),cy(p),.28,1.1,'#ff5d78');this.say(`受擊｜${label} -${Math.round(dmg)}`,1.4,'#ff8fa0');this.sfx.hit(1.1);if(dmg>=16||label.includes('哨兵')||label.includes('巨像')){p.downT=1.18;p.attack=null;p.history='';this.say('擊倒！0.28–0.84 秒內按 SPACE 受身',1.8,'#ffbf8a');}if(p.hp<=0)this.respawn('生命歸零');}
 floatText(text,x,y,color='#fff',size=16){this.effects.push({id:this.id(),type:'text',text,x,y,vy:-52,color,size,life:.9,max:.9});}
 addFx(type,x,y,life=.3,scale=1,color='#fff',dir=1){this.effects.push({id:this.id(),type,x,y,life,max:life,scale,color,dir});}
// ============================================================================
// 8. CLASS SKILLS
// ============================================================================
 skillCost(i){return[24,40,78][i];}
 useSkill(i){const p=this.player;if(p.downT>0||p.recoverT>0||p.castT>0||p.skillCD[i]>0)return;const cost=this.skillCost(i);if(p.mp<cost){this.say('MP 不足',1,'#7abfff');return;}p.mp-=cost;p.skillCD[i]=[3.0,6.2,13][i];p.castT=i===2?.55:.28;this.sfx.skill();this.flash=i===2?.32:.12;this.shake=Math.max(this.shake,[9,14,22][i]);
  if(p.classId==='rift')this.riftSkill(i);else if(p.classId==='summoner')this.summonerSkill(i);else if(p.classId==='beast')this.beastSkill(i);else this.artificerSkill(i);
 }
 riftSkill(i){const p=this.player,c=C.CLASSES.rift.color;
  if(i===0){this.say('裂空三閃',1.2,c);for(let n=0;n<3;n++){this.attacks.push({id:this.id(),owner:'skill',delay:.05+n*.11,life:.10,x:()=>p.dir>0?p.x+p.w/2+30+n*45:p.x+p.w/2-150-n*45,y:()=>p.y-6,w:150,h:90,damage:15+n*2,kx:(n===2?460:140)*p.dir,ky:-100,kd:n===2?28:7,br:n===2?36:12,color:c,big:n===2,label:'裂空三閃'});this.effects.push({id:this.id(),type:'delayedFx',delay:n*.11,fx:'slash_cyan',x:cx(p)+p.dir*(80+n*55),y:cy(p)-10,life:.34,max:.34,scale:1.5+n*.15,color:c,dir:p.dir});}p.vx=p.dir*480;}
  else if(i===1){this.say('逆界天升',1.3,c);this.attacks.push({id:this.id(),owner:'skill',delay:.11,life:.14,x:()=>p.dir>0?p.x+p.w/2:p.x-80,y:()=>p.y-65,w:150,h:165,damage:38,kx:75*p.dir,ky:-900,kd:2,br:52,color:c,big:true,label:'逆界天升'});this.addFx('launcher',cx(p)+p.dir*25,cy(p)-45,.58,2.25,c,p.dir);p.vy=-520;}
  else{this.say('十相終刃',2,c);this.addFx('shockwave',cx(p),cy(p),1.0,2.6,c);for(let n=0;n<7;n++){this.attacks.push({id:this.id(),owner:'skill',delay:.16+n*.10,life:.10,x:()=>cx(p)+p.dir*(70+n*75)-95,y:()=>p.y-70+(n%2)*70,w:190,h:140,damage:n===6?28:13,kx:(n===6?620:80)*p.dir,ky:n===6?-280:-80,kd:n===6?55:5,br:n===6?60:14,color:n%2?'#ff78a0':'#72ebff',big:n===6,label:'十相終刃'});this.effects.push({id:this.id(),type:'delayedFx',delay:.12+n*.10,fx:n===6?'explosion':'slash_gold',x:cx(p)+p.dir*(100+n*70),y:cy(p)+(n%2?35:-35),life:n===6?.7:.34,max:n===6?.7:.34,scale:n===6?2.3:1.8,color:n%2?'#ff78a0':'#72ebff',dir:p.dir});}}
 }
 summonerSkill(i){const p=this.player,c=C.CLASSES.summoner.color;if(i===0){this.say('靈矢列陣',1.3,c);for(let n=-2;n<=2;n++){this.skillShots.push({id:this.id(),type:'spirit',x:cx(p)+p.dir*35,y:cy(p)+n*20,w:18,h:18,vx:p.dir*(430+Math.abs(n)*25),vy:n*25,life:3,damage:9,target:null,color:'#ffe583'});this.effects.push({id:this.id(),type:'delayedFx',delay:(n+2)*.04,fx:'element_light',x:cx(p)+p.dir*70,y:cy(p)+n*35,life:.42,max:.42,scale:1.25,color:'#ffe583',dir:p.dir});}}
  else if(i===1){p.shield=Math.max(p.shield,70);p.hp=Math.min(p.maxHp,p.hp+28);p.summonFrenzy=8;this.say('契約護環｜護盾＋狐靈狂熱',1.5,c);this.addFx('shockwave',cx(p),cy(p),.72,1.7,'#ffe583');}
  else{p.summonFrenzy=12;this.say('星獸降臨',2,c);this.fields.push({id:this.id(),type:'starBeast',x:cx(p),y:cy(p),r:380,life:10,tick:0,color:'#ffe583'});this.addFx('shockwave',cx(p),cy(p),1.1,2.8,'#ffe583');for(let n=0;n<8;n++)this.attacks.push({id:this.id(),owner:'skill',delay:.25+n*.14,life:.12,x:()=>cx(p)+p.dir*(80+n*85)-90,y:()=>300+(n%3)*90,w:180,h:380,damage:14,kx:150*p.dir,ky:-180,kd:8,br:18,color:'#ffe583',big:n===7,label:'星獸降臨'});}
 }
 beastSkill(i){const p=this.player,c=C.CLASSES.beast.color;if(i===0){this.say('狼牙奔襲',1.2,c);p.vx=p.dir*920;for(let n=0;n<4;n++){this.attacks.push({id:this.id(),owner:'skill',delay:.03+n*.09,life:.10,x:()=>p.dir>0?p.x+p.w/2+20:p.x-140,y:()=>p.y+2,w:150,h:82,damage:11+n*2,kx:(n===3?520:160)*p.dir,ky:-100,kd:n===3?35:6,br:n===3?35:10,color:c,big:n===3,label:'狼牙奔襲'});this.effects.push({id:this.id(),type:'delayedFx',delay:n*.09,fx:'slash_cyan',x:cx(p)+p.dir*(55+n*45),y:cy(p)-25+n*15,life:.30,max:.30,scale:1.45,color:c,dir:p.dir});}}
  else if(i===1){this.say('蒼鷹墜擊',1.3,c);p.vy=-620;p.lowG=1.0;this.attacks.push({id:this.id(),owner:'skill',delay:.32,life:.18,x:()=>p.x-70,y:()=>p.y+20,w:190,h:150,damage:42,kx:240*p.dir,ky:540,kd:62,br:48,color:c,big:true,label:'蒼鷹墜擊'});this.effects.push({id:this.id(),type:'delayedFx',delay:.26,fx:'shockwave',x:cx(p),y:C.GROUND_Y-40,life:.65,max:.65,scale:2.1,color:c,dir:p.dir});}
  else{p.beastKing=12;p.armor=12;p.lowG=12;this.say('百獸王化｜狼速＋鷹空戰＋熊霸體',2,c);this.addFx('shockwave',cx(p),cy(p),1.1,2.8,c);for(const[k,dx,dy]of[['element_wind',-70,-20],['element_earth',0,30],['element_nature',70,-30]])this.addFx(k,cx(p)+dx,cy(p)+dy,.8,1.8,c);}
 }
 artificerSkill(i){const p=this.player,c=C.CLASSES.artificer.color;if(i===0){this.say('磁軌衝擊',1.3,c);this.effects.push({id:this.id(),type:'beam',x:cx(p)+p.dir*20,y:cy(p),x2:cx(p)+p.dir*760,y2:cy(p),life:.40,max:.40,color:'#6ee9ff',width:42});const box={x:p.dir>0?cx(p):cx(p)-760,y:cy(p)-28,w:760,h:56};for(const e of this.enemies)if(!e.dead&&overlap(box,e))this.hitEnemy(e,45,{dir:p.dir,kx:550*p.dir,ky:-100,kd:38,br:58,big:true,guardBreak:true,color:c,label:'磁軌衝擊'});}
  else if(i===1){this.say('彈射平台',1.2,c);this.tempSolids.push({id:this.id(),x:p.x-25,y:p.y+p.h+4,w:110,h:18,type:'spring',oneWay:true,life:12});p.vy=-840;this.addFx('launcher',cx(p),p.y+p.h,.55,1.7,'#75eaff');}
  else{this.overdrive=10;p.shield=Math.max(p.shield,45);this.say('超載回路｜炮台射速＋換位冷卻強化',2,c);this.addFx('shockwave',cx(p),cy(p),1.0,2.5,'#75eaff');for(const t of this.turrets)this.addFx('element_lightning',t.x,t.y,.7,1.5,'#75eaff');}
 }
 useClassSkill(){const p=this.player;if(p.downT>0||p.qCD>0)return;if(p.classId==='rift'){if(p.rift<35){this.say('裂隙值不足 35',1,'#6feaff');return;}p.rift-=35;p.qCD=2.4;this.radialDamage(cx(p),cy(p),220,38,'#6feaff','裂隙爆發');p.inv=.4;}
  else if(p.classId==='summoner'){p.qCD=2.5;p.summonFrenzy=Math.max(p.summonFrenzy,5);this.say('靈獸指令｜狐靈鎖定最近敵人',1.3,'#d590ff');const e=this.nearestEnemy(cx(p),cy(p),750);if(e)this.radialDamage(cx(e),cy(e),125,22,'#ffe583','靈獸指令');}
  else if(p.classId==='beast'){p.qCD=.32;const f=['wolf','eagle','bear'];p.beastForm=f[(f.indexOf(p.beastForm)+1)%3];this.say('獸魂切換｜'+{wolf:'狼：速度／Dash',eagle:'鷹：空戰／三段跳',bear:'熊：霸體／破甲'}[p.beastForm],1.4,'#8cf478');this.addFx(p.beastForm==='wolf'?'element_wind':p.beastForm==='eagle'?'element_lightning':'element_earth',cx(p),cy(p),.45,1.6,'#8cf478');}
  else{p.qCD=1.2;if(this.turrets.length>=3)this.turrets.shift();this.turrets.push({id:this.id(),x:p.x-p.dir*35,y:p.y+p.h-42,w:42,h:42,life:22,shotT:0});this.say('部署符文炮台｜'+this.turrets.length+'/3',1.2,'#ffad5d');this.addFx('element_lightning',p.x,p.y,.45,1.4,'#75eaff');}
 }
 updateFamiliar(dt){const p=this.player;if(p.classId!=='summoner'){this.familiar=null;return;}if(!this.familiar)this.familiar={x:p.x-60,y:p.y-40,shotT:0};const f=this.familiar;f.x=lerp(f.x,p.x-p.dir*72,1-Math.pow(.002,dt));f.y=lerp(f.y,p.y-50+Math.sin(this.time*4)*12,1-Math.pow(.002,dt));f.shotT-=dt;const e=this.nearestEnemy(f.x,f.y,620);if(e&&f.shotT<=0){f.shotT=p.summonFrenzy>0?.28:.75;this.skillShots.push({id:this.id(),type:'spirit',x:f.x,y:f.y,w:14,h:14,vx:0,vy:0,life:2.5,damage:p.summonFrenzy>0?12:7,target:e.id,color:'#ffe583'});}}
 updateTurrets(dt){for(const t of this.turrets){t.life-=dt;t.shotT-=dt;const e=this.nearestEnemy(t.x,t.y,650);if(e&&t.shotT<=0){t.shotT=this.overdrive>0?.25:.62;const dx=cx(e)-t.x,dy=cy(e)-t.y,d=Math.hypot(dx,dy)||1;this.skillShots.push({id:this.id(),type:'turret',x:t.x,y:t.y,w:12,h:12,vx:dx/d*650,vy:dy/d*650,life:1.6,damage:this.overdrive>0?11:7,target:null,color:'#75eaff'});}}this.turrets=this.turrets.filter(t=>t.life>0);}
 updateSkillShots(dt){for(const s of this.skillShots){s.life-=dt;if(s.target){const e=this.enemies.find(e=>e.id===s.target&&!e.dead);if(e){const dx=cx(e)-s.x,dy=cy(e)-s.y,d=Math.hypot(dx,dy)||1;s.vx=lerp(s.vx,dx/d*560,1-Math.pow(.02,dt));s.vy=lerp(s.vy,dy/d*560,1-Math.pow(.02,dt));}}s.x+=s.vx*dt;s.y+=s.vy*dt;for(const e of this.enemies){if(e.dead||!overlap(s,e))continue;this.hitEnemy(e,s.damage,{dir:sign(s.vx||this.player.dir),kx:100*sign(s.vx||1),ky:-60,kd:4,br:7,color:s.color,label:s.type==='turret'?'符文炮台':'狐靈追擊'});s.life=0;break;}}this.skillShots=this.skillShots.filter(s=>s.life>0);}
 radialDamage(x,y,r,dmg,color,label){for(const e of this.enemies){if(e.dead)continue;const dd=Math.hypot(cx(e)-x,cy(e)-y);if(dd<r)this.hitEnemy(e,dmg*(1-dd/r*.25),{dir:sign(cx(e)-x),kx:380*sign(cx(e)-x),ky:-180,kd:28,br:30,big:true,color,label});}this.addFx('explosion',x,y,.5,r/90,color);this.shake=Math.max(this.shake,12);}
// ============================================================================
// 9. ELEMENTS — real hit, swap, puzzle, field effects
// ============================================================================
 elementPress(i){const el=C.ELEMENTS[i],a=this.validAnchor(el.id);if(a)this.swapWith(el,a);else this.fireElement(el);}
 fireElement(el){const p=this.player,up=this.input.down('up'),down=this.input.down('down');let dx=p.dir,dy=up&&!down?-.68:down&&!up?.65:0;const m=Math.hypot(dx,dy);dx/=m;dy/=m;const b={id:this.id(),element:el.id,x:cx(p)-el.size/2+dx*32,y:cy(p)-el.size/2+dy*25,w:el.size,h:el.size,vx:dx*el.speed+p.vx*.12,vy:dy*el.speed,life:8,anchored:false,bounce:el.id==='water'?1:0,pierce:el.id==='light'?1:0,trail:[],dead:false};this.projectiles.push(b);p.lastElement=el.id;this.anchors[el.id]={type:'projectile',id:b.id};this.sfx.element(el.id);this.addFx('element_'+el.id,cx(b),cy(b),.25,.8,el.color);this.say(`${el.glyph} ${el.name}發射｜同鍵再按＝換位`,1.5,el.color);}
 validAnchor(id){const a=this.anchors[id];if(!a)return null;if(a.type==='projectile'){const p=this.projectiles.find(x=>x.id===a.id&&!x.dead&&x.life>0);if(p)return{type:'projectile',obj:p};}
  if(a.type==='enemy'){const e=this.enemies.find(x=>x.id===a.id&&!x.dead&&x.mark===id&&x.markUntil>this.time);if(e)return{type:'enemy',obj:e};}
  this.anchors[id]=null;return null;
 }
 updateProjectiles(dt){for(const b of this.projectiles){if(b.dead)continue;const el=C.ELEMENTS.find(e=>e.id===b.element);b.life-=dt;if(b.life<=0){b.dead=true;continue;}b.trail.unshift({x:cx(b),y:cy(b)});if(b.trail.length>16)b.trail.pop();
   if(b.element==='gravity')this.pullAt(cx(b),cy(b),300,b.anchored?720:460,dt);
   if(b.anchored)continue;b.vy+=el.gravity*dt;const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/10));for(let s=0;s<steps&&!b.dead&&!b.anchored;s++){const sd=dt/steps,ox=b.x,oy=b.y;b.x+=b.vx*sd;b.y+=b.vy*sd;
    // enemies
    const enemy=this.enemies.find(e=>!e.dead&&overlap(b,e));if(enemy){this.elementHit(enemy,el,b);if(b.pierce>0){b.pierce--;b.x+=sign(b.vx)*35;}else b.dead=true;break;}
    if(this.elementPuzzleHit(b,el)){b.dead=true;break;}
    // water pools
    for(const w of this.water)if(overlap(b,w)&&el.id==='ice'){w.frozenUntil=this.time+12;b.dead=true;this.say('冰封水面｜12 秒可站立',1.7,el.color);this.addFx('element_ice',cx(b),w.y,.45,2.2,el.color);}
    if(b.dead)break;
    // world collisions
    const hit=this.activeSolids().find(o=>overlap(b,o));if(hit){if(hit.type==='shadowWall'&&el.id==='shadow')continue;if(el.id==='water'&&b.bounce>0){b.bounce--;b.x=ox;b.y=oy;if(Math.abs(b.vx)>Math.abs(b.vy))b.vx*=-.75;else b.vy*=-.75;}else{b.x=ox;b.y=oy;b.vx=b.vy=0;b.anchored=true;b.life=Math.max(b.life,7);this.addFx('element_'+el.id,cx(b),cy(b),.22,.75,el.color);}break;}
   }
   if(b.x<-100||b.x>C.WORLD_W+100||b.y<-250||b.y>C.WORLD_H+200)b.dead=true;
  }
  this.projectiles=this.projectiles.filter(b=>!b.dead&&b.life>0);for(const e of C.ELEMENTS){const a=this.anchors[e.id];if(a?.type==='projectile'&&!this.projectiles.some(p=>p.id===a.id))this.anchors[e.id]=null;}
 }
 elementHit(e,el,b){let dmg=el.damage,status='標記';e.mark=el.id;e.markUntil=this.time+el.mark;this.anchors[el.id]={type:'enemy',id:e.id};
  if(el.id==='fire'){e.burn=Math.max(e.burn,5);e.burnTick=.15;status='燃燒';if(e.freeze>0){dmg*=2.1;e.freeze=0;this.radialDamage(cx(e),cy(e),140,16,'#ffac75','熱震命中');}}
  else if(el.id==='ice'){e.freeze=Math.max(e.freeze,e.wet>0?3.2:1.9);if(e.wet>0)dmg*=1.35;status=e.wet>0?'凍結':'冰緩';}
  else if(el.id==='lightning'){e.stun=Math.max(e.stun,e.wet>0?1.8:.75);if(e.wet>0){dmg*=2;this.chainLightning(e,3,280);}status=e.wet>0?'導電暴擊':'暈眩';}
  else if(el.id==='wind'){e.vx+=sign(b.vx||this.player.dir)*620;e.vy-=150;status='強制擊飛';}
  else if(el.id==='earth'){e.armorBreak=Math.max(e.armorBreak,6);e.stun=Math.max(e.stun,.35);status='破甲';}
  else if(el.id==='water'){e.wet=Math.max(e.wet,8);e.burn=0;status='濕潤';}
  else if(el.id==='light'){e.curse=0;if(e.ai==='mage')dmg*=1.7;status='顯形／淨化';this.lightReveal=Math.max(this.lightReveal,5);}
  else if(el.id==='shadow'){e.curse=Math.max(e.curse,8);status='詛咒';}
  else if(el.id==='nature'){e.root=Math.max(e.root,2.8);status='纏根';}
  else if(el.id==='gravity'){e.vx+=(cx(b)-cx(e))*1.3;e.vy-=180;status='引力拉扯';}
  this.hitEnemy(e,dmg,{dir:sign(b.vx||this.player.dir),kx:el.id==='wind'?420:130*sign(b.vx||1),ky:-90,kd:el.id==='earth'?25:7,br:el.id==='earth'?32:10,big:el.id==='earth',armorBreak:el.id==='earth'?6:0,color:el.color,label:`${el.name}命中`});this.floatText(`${el.glyph} ${status}`,cx(e),e.y-30,el.color,14);this.addFx('element_'+el.id,cx(e),cy(e),.35,1.25,el.color);
 }
 elementPuzzleHit(b,el){for(const p of this.puzzles){if(!overlap(b,p))continue;
   if(p.type==='torch'&&el.id==='fire'&&!p.lit){p.lit=true;this.say('火盆點燃｜第一道門開啟',1.5,el.color);return true;}
   if(p.type==='node'&&el.id==='lightning'&&!p.active){p.active=true;this.say('雷電節點通電',1.5,el.color);return true;}
   if(p.type==='seed'&&el.id==='nature'&&!p.grown){p.grown=true;this.tempSolids.push({id:this.id(),x:p.x+8,y:p.y-280,w:35,h:330,type:'vine',oneWay:false,climbable:true,life:999});this.say('種子長成永久藤柱',1.7,el.color);return true;}
   if(p.type==='lightBridge'&&el.id==='light'){p.revealedUntil=this.time+18;this.lightReveal=Math.max(this.lightReveal,18);this.say('光橋顯現｜18 秒',1.5,el.color);return true;}
   if(p.type==='brittleWall'&&el.id==='earth'){p.cracked=true;this.say('脆牆已龜裂｜需要冰→火熱震',1.7,el.color);return true;}
  }
  for(const h of this.hazards)if(overlap(b,h)&&h.type==='fireWall'&&h.active&&el.id==='water'){h.active=false;this.say('水元素熄滅火牆',1.6,el.color);return true;}
  // push crate directly with wind / earth / gravity
  for(const p of this.puzzles)if(p.type==='crate'&&overlap(b,p)){if(el.id==='wind'){p.vx+=sign(b.vx||1)*650;p.vy=-100;}else if(el.id==='earth'){p.vx+=sign(b.vx||1)*300;}else if(el.id==='gravity'){p.vx+=(cx(b)-cx(p))*2.5;p.vy-=200;}else return false;this.addFx('element_'+el.id,cx(p),cy(p),.3,1.1,el.color);return true;}
  return false;
 }
 swapWith(el,a){const p=this.player,old={x:p.x,y:p.y,cx:cx(p),cy:cy(p)};let tx=a.type==='enemy'?a.obj.x+a.obj.w/2-p.w/2:a.obj.x+a.obj.w/2-p.w/2,ty=a.type==='enemy'?a.obj.y+a.obj.h-p.h:a.obj.y+a.obj.h/2-p.h/2;
  if(a.type==='enemy'){const e=a.obj,ex=e.x,ey=e.y;e.x=old.cx-e.w/2;e.y=old.y+p.h-e.h;e.vx=-p.vx*.35;e.vy=Math.min(-120,p.vy*.2);e.stun=Math.max(e.stun,.4);p.x=ex+e.w/2-p.w/2;p.y=ey+e.h-p.h;}
  else{const b=a.obj;p.x=tx;p.y=ty;b.x=old.cx-b.w/2;b.y=old.cy-b.h/2;b.vx=b.vy=0;b.anchored=true;b.life=Math.max(b.life,8);}
  p.x=clamp(p.x,0,C.WORLD_W-p.w);p.vx*=.25;p.vy*=.2;p.inv=Math.max(p.inv,.34);this.statsSwaps=(this.statsSwaps||0)+1;this.elementSwapEffect(el,old,{x:p.x,y:p.y,cx:cx(p),cy:cy(p)});this.checkElementCombo(el.id);p.lastSwap=el.id;p.lastSwapAt=this.time;this.shake=Math.max(this.shake,10);this.flash=.12;this.sfx.swap(C.ELEMENTS.indexOf(el));this.addFx('element_'+el.id,old.cx,old.cy,.38,1.55,el.color);this.addFx('element_'+el.id,cx(p),cy(p),.38,1.55,el.color);this.say(`${el.glyph} ${el.name}換位｜${a.type==='enemy'?'與標記敵人互換':'錨點移到原位置'}`,1.5,el.color);
 }
 elementSwapEffect(el,old,now){const p=this.player;
  if(el.id==='fire'){this.fields.push({id:this.id(),type:'flame',x:old.cx,y:old.cy,r:145,life:4,tick:0,color:el.color},{id:this.id(),type:'flame',x:now.cx,y:now.cy,r:145,life:4,tick:0,color:el.color});}
  else if(el.id==='ice'){this.tempSolids.push({id:this.id(),x:old.cx-70,y:old.y+p.h-8,w:140,h:20,type:'ice',oneWay:true,life:10});for(const e of this.enemies)if(!e.dead&&Math.hypot(cx(e)-now.cx,cy(e)-now.cy)<160)e.freeze=Math.max(e.freeze,2);}
  else if(el.id==='lightning'){this.chainFromPoint(old.cx,old.cy,3,280);this.chainFromPoint(now.cx,now.cy,3,280);}
  else if(el.id==='wind'){p.vx=p.dir*980;p.vy=Math.min(p.vy,-180);p.lowG=Math.max(p.lowG,1.2);this.radialPush(old.cx,old.cy,260,760);}
  else if(el.id==='earth'){this.tempSolids.push({id:this.id(),x:old.cx-48,y:old.cy-95,w:96,h:145,type:'earth',oneWay:false,life:12});p.armor=Math.max(p.armor,3);this.radialDamage(now.cx,now.cy,150,18,el.color,'岩柱震擊');}
  else if(el.id==='water'){p.hp=Math.min(p.maxHp,p.hp+20);this.fields.push({id:this.id(),type:'geyser',x:old.cx,y:old.cy+30,r:80,life:7,color:el.color});}
  else if(el.id==='light'){p.hp=Math.min(p.maxHp,p.hp+16);p.shield=Math.max(p.shield,38);this.lightReveal=Math.max(this.lightReveal,10);for(const q of this.puzzles)if(q.type==='lightBridge')q.revealedUntil=Math.max(q.revealedUntil,this.time+10);}
  else if(el.id==='shadow'){p.phase=Math.max(p.phase,2.2);this.fields.push({id:this.id(),type:'decoy',x:old.cx,y:old.cy,r:260,life:5,color:el.color});}
  else if(el.id==='nature'){this.tempSolids.push({id:this.id(),x:old.cx-24,y:old.cy-220,w:48,h:270,type:'vine',oneWay:false,climbable:true,life:13});p.hp=Math.min(p.maxHp,p.hp+6);}
  else if(el.id==='gravity'){this.fields.push({id:this.id(),type:'gravity',x:old.cx,y:old.cy,r:330,life:7,color:el.color});p.lowG=Math.max(p.lowG,6);this.pullAt(now.cx,now.cy,300,1200,.18);}
 }
 checkElementCombo(current){const p=this.player,prev=p.lastSwap;if(!prev||this.time-(p.lastSwapAt||-99)>4||prev===current)return;const key=prev+'>'+current;
  if(key==='ice>fire'){this.say('熱震 / THERMAL SHOCK',2.4,'#ffbd8c');this.radialDamage(cx(p),cy(p),380,52,'#ff9a6d','熱震');for(const q of this.puzzles)if(q.type==='brittleWall'&&!q.broken&&Math.abs(cx(p)-cx(q))<620){q.broken=true;this.addFx('explosion',cx(q),cy(q),.8,2.8,'#ffbd8c');}}
  else if(key==='water>lightning'){this.say('導電暴潮 / SURGE',2.2,'#edff7a');for(const e of this.enemies)if(!e.dead&&e.wet>0){e.stun=Math.max(e.stun,2.3);this.hitEnemy(e,28,{dir:p.dir,kx:140*p.dir,ky:-80,kd:12,br:22,color:'#edff7a',label:'導電暴潮'});}}
  else if(key==='fire>wind'){this.say('烈風火環 / FIRESTORM',2.2,'#ffb267');this.radialDamage(cx(p),cy(p),430,36,'#ffad62','烈風火環');this.radialPush(cx(p),cy(p),430,900);}
  else if(key==='earth>nature'){this.say('岩根隆起 / ROOT WALL',2,'#9ee27f');this.tempSolids.push({id:this.id(),x:oldOr(p.x)-80,y:p.y-210,w:180,h:260,type:'root',oneWay:false,life:16});}
  else if((prev==='light'&&current==='shadow')||(prev==='shadow'&&current==='light')){this.say('明暗蝕相 / ECLIPSE',2.1,'#eadcff');p.phase=Math.max(p.phase,4);p.shield=Math.max(p.shield,45);p.hp=Math.min(p.maxHp,p.hp+24);this.radialDamage(cx(p),cy(p),300,22,'#eadcff','明暗蝕相');}
  else if(key==='gravity>wind'){this.say('引力彈弓 / SLINGSHOT',2,'#c6cbff');p.vx=p.dir*1180;p.vy=-520;p.lowG=Math.max(p.lowG,5);}
  function oldOr(v){return v;}
 }
 chainLightning(source,jumps,range){let cur=source;const used=new Set([source.id]);for(let i=0;i<jumps;i++){const n=this.enemies.filter(e=>!e.dead&&!used.has(e.id)).sort((a,b)=>distance(cur,a)-distance(cur,b))[0];if(!n||distance(cur,n)>range)break;used.add(n.id);n.stun=Math.max(n.stun,.8);this.hitEnemy(n,8,{dir:sign(cx(n)-cx(cur)),kx:80,ky:-50,kd:5,br:8,color:'#ffe65a',label:'鏈雷'});this.effects.push({id:this.id(),type:'lightningLine',x:cx(cur),y:cy(cur),x2:cx(n),y2:cy(n),life:.18,max:.18,color:'#ffe65a'});cur=n;}}
 chainFromPoint(x,y,jumps,range){const e=this.nearestEnemy(x,y,range);if(!e)return;this.hitEnemy(e,14,{dir:sign(cx(e)-x),kx:100,ky:-70,kd:7,br:14,color:'#ffe65a',label:'雷換位'});this.effects.push({id:this.id(),type:'lightningLine',x,y,x2:cx(e),y2:cy(e),life:.18,max:.18,color:'#ffe65a'});this.chainLightning(e,jumps-1,range);}
 radialPush(x,y,r,power){for(const e of this.enemies){if(e.dead)continue;const dx=cx(e)-x,dy=cy(e)-y,d=Math.hypot(dx,dy)||1;if(d<r){e.vx+=dx/d*power;e.vy+=dy/d*power*.35-120;}}for(const q of this.puzzles)if(q.type==='crate'){const dx=cx(q)-x,dy=cy(q)-y,d=Math.hypot(dx,dy)||1;if(d<r)q.vx+=dx/d*power*.75;}}
 pullAt(x,y,r,power,dt){for(const e of this.enemies){if(e.dead)continue;const dx=x-cx(e),dy=y-cy(e),d=Math.hypot(dx,dy)||1;if(d<r){const f=(1-d/r)*power*dt;e.vx+=dx/d*f;e.vy+=dy/d*f*.55;}}for(const q of this.puzzles)if(q.type==='crate'||q.type==='core'){const dx=x-cx(q),dy=y-cy(q),d=Math.hypot(dx,dy)||1;if(d<r){const f=(1-d/r)*power*dt;q.vx=(q.vx||0)+dx/d*f;q.vy=(q.vy||0)+dy/d*f*.55;}}}
// ============================================================================
// 10. FIELDS / DELAYED ATTACKS / EFFECTS
// ============================================================================
 updateFields(dt){for(const f of this.fields){f.life-=dt;f.tick=(f.tick||0)-dt;if(f.type==='flame'&&f.tick<=0){f.tick=.55;for(const e of this.enemies)if(!e.dead&&Math.hypot(cx(e)-f.x,cy(e)-f.y)<f.r){e.burn=Math.max(e.burn,2);this.hitEnemy(e,5,{dir:sign(cx(e)-f.x),kx:60,ky:-20,kd:2,br:4,color:f.color,label:'火焰區'});}}
   else if(f.type==='geyser'){const col={x:f.x-55,y:f.y-230,w:110,h:270};if(overlap(this.player,col))this.player.vy-=2100*dt;for(const e of this.enemies)if(!e.dead&&overlap(e,col)){e.vy-=1550*dt;e.airborne=true;}}
   else if(f.type==='gravity')this.pullAt(f.x,f.y,f.r,1050,dt);
   else if(f.type==='decoy'){for(const e of this.enemies)if(!e.dead&&Math.hypot(cx(e)-f.x,cy(e)-f.y)<f.r){const dx=f.x-cx(e),d=Math.abs(dx)||1;e.vx+=dx/d*520*dt;}}
   else if(f.type==='starBeast'&&f.tick<=0){f.tick=.75;for(const e of this.enemies)if(!e.dead&&Math.hypot(cx(e)-f.x,cy(e)-f.y)<f.r)this.hitEnemy(e,10,{dir:sign(cx(e)-f.x),kx:120,ky:-90,kd:4,br:8,color:f.color,label:'星獸領域'});}
  }this.fields=this.fields.filter(f=>f.life>0);
  for(const s of this.tempSolids)s.life-=dt;this.tempSolids=this.tempSolids.filter(s=>s.life>0);
 }
 updateEffects(dt){for(const e of this.effects){if(e.delay){e.delay-=dt;continue;}e.life-=dt;if(e.type==='text'){e.y+=e.vy*dt;e.vy*=Math.pow(.2,dt);}if(e.type==='delayedFx'&&e.delay<=0&&!e.spawned){e.spawned=true;this.effects.push({id:this.id(),type:e.fx,x:e.x,y:e.y,life:e.life,max:e.max,scale:e.scale,color:e.color,dir:e.dir});e.life=0;}}
  this.effects=this.effects.filter(e=>e.life>0||e.delay>0);
  for(const a of this.attacks){a.delay-=dt;if(a.delay>0)continue;a.life-=dt;if(a.done)continue;const box={x:typeof a.x==='function'?a.x():a.x,y:typeof a.y==='function'?a.y():a.y,w:a.w,h:a.h};for(const e of this.enemies){if(e.dead||a.hitIds?.has(e.id)||!overlap(box,e))continue;(a.hitIds||(a.hitIds=new Set())).add(e.id);this.hitEnemy(e,a.damage,{dir:sign(a.kx||this.player.dir),kx:a.kx,ky:a.ky,kd:a.kd,br:a.br,big:a.big,color:a.color,label:a.label});}if(a.life<=0)a.done=true;}
  this.attacks=this.attacks.filter(a=>!a.done&&(a.delay>0||a.life>0));
 }

// ============================================================================
// 11. ENEMY AI / BOSS / ENEMY PROJECTILES
// ============================================================================
 nearestEnemy(x,y,range=Infinity){let best=null,bd=range;for(const e of this.enemies){if(e.dead)continue;const d=Math.hypot(cx(e)-x,cy(e)-y);if(d<bd){bd=d;best=e;}}return best;}
 updateEnemies(dt){const p=this.player;for(const e of this.enemies){if(e.dead)continue;e.hitT=Math.max(0,e.hitT-dt);e.stun=Math.max(0,e.stun-dt);e.freeze=Math.max(0,e.freeze-dt);e.root=Math.max(0,e.root-dt);e.wet=Math.max(0,e.wet-dt);e.curse=Math.max(0,e.curse-dt);e.armorBreak=Math.max(0,e.armorBreak-dt);if(e.mark&&e.markUntil<=this.time)e.mark=null;e.breakStun=Math.max(0,e.breakStun-dt);e.aiT-=dt;e.shotT-=dt;
   if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){e.burnTick=.55;e.hp-=4;this.floatText('BURN 4',cx(e),e.y-15,'#ff704c',12);if(e.hp<=0)this.killEnemy(e,'#ff704c');}}
   if(e.dead)continue;if(e.downT>0){e.downT-=dt;e.stun=Math.max(e.stun,e.downT);e.vx*=Math.pow(.03,dt);}
   const dx=cx(p)-cx(e),ad=Math.abs(dx),dy=cy(p)-cy(e),inView=e.x>this.camera.x-300&&e.x<this.camera.x+this.viewW+300,aware=e.type==='boss'?ad<1500:this.combatUnlocked&&ad<850&&inView;e.alert=Math.max(0,e.alert-dt);if(aware&&!e.aggro)e.alert=.8;e.aggro=aware;e.dir=dx<0?-1:1;
   if(e.ai==='boss'){if(aware)this.updateBoss(e,dt,ad);this.enemyPhysics(e,dt);continue;}
   if(e.ai==='passive'){this.enemyPhysics(e,dt);continue;}
   if(aware&&e.stun<=0&&e.freeze<=0&&e.downT<=0){const slow=e.freeze>0?.25:1;
    if(e.ai==='melee'){if(ad>70)e.vx+=e.dir*e.speed*4*dt*slow;if(ad<95&&e.aiT<=0){e.aiT=1.0;this.enemyMelee(e,1);}}
    else if(e.ai==='ranged'){if(ad<260)e.vx-=e.dir*e.speed*3*dt;else if(ad>540)e.vx+=e.dir*e.speed*2*dt;if(ad<760&&e.shotT<=0){e.shotT=1.65;this.enemyShoot(e,'arrow',370,1.0,.48);}}
    else if(e.ai==='shield'){if(ad>95)e.vx+=e.dir*e.speed*3.5*dt;if(ad<120&&e.aiT<=0){e.aiT=1.25;this.enemyMelee(e,1.35);}}
    else if(e.ai==='flying'){e.vx+=e.dir*e.speed*2.3*dt;e.vy+=(p.y-110-e.y)*2.2*dt;if(ad<190&&Math.abs(dy)<160&&e.aiT<=0){e.aiT=1.4;e.vx=e.dir*380;e.vy=280;}}
    else if(e.ai==='turret'){e.vx=0;if(ad<850&&e.shotT<=0){e.shotT=1.75;this.enemyShoot(e,'cannon',300,1.35,.60);}}
    else if(e.ai==='mage'){if(ad<760&&e.shotT<=0){e.shotT=1.8;this.enemyShoot(e,'orb',235,1.2,.52,true);}if(e.aiT<=0&&ad<520){e.aiT=2.7;e.x=clamp(p.x-e.dir*rand(320,470),e.home-e.range,e.home+e.range);this.addFx('element_shadow',cx(e),cy(e),.35,1.1,'#a078ff');}}
    else if(e.ai==='heavy'){if(ad>110)e.vx+=e.dir*e.speed*3*dt;if(ad<170&&e.aiT<=0){e.aiT=2.2;this.effects.push({id:this.id(),type:'warningBox',x:e.x-100,y:C.GROUND_Y-95,w:280,h:95,life:.60,max:.60,color:'#ff9a6b',owner:e.id,damage:23});}}
   }else e.vx*=Math.pow(.08,dt);
   if(e.root>0)e.vx=0;e.vx=clamp(e.vx,-Math.max(100,e.speed*2.1),Math.max(100,e.speed*2.1));this.enemyPhysics(e,dt);if(aware&&overlap(p,e)&&e.aiT<=0){e.aiT=.9;this.hurtPlayer(e.damage,cx(e),e.name);}
  }
 }
 enemyPhysics(e,dt){if(e.ai==='flying'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=Math.pow(.15,dt);e.vy*=Math.pow(.18,dt);e.y=clamp(e.y,170,C.GROUND_Y-e.h-20);return;}if(e.ai==='turret'){e.vx=e.vy=0;return;}e.vy=Math.min(980,e.vy+C.GRAVITY*dt);this.moveBody(e,dt,true);e.vx*=Math.pow(.18,dt);if(e.airborne&&e.onGround){e.airborne=false;e.downT=.55;e.stun=.55;e.bounced=false;}if(e.kd>=100&&e.onGround&&e.type!=='boss'){e.kd=0;e.downT=.7;e.stun=.7;e.vy=-170;}}
 enemyMelee(e,mul){const box={x:e.dir>0?e.x+e.w:e.x-90,y:e.y+5,w:90,h:e.h-10};this.effects.push({id:this.id(),type:'warningBox',x:box.x,y:box.y,w:box.w,h:box.h,life:.28,max:.28,color:'#ff6c7d',owner:e.id,damage:e.damage*mul,melee:true});}
 enemyShoot(e,type,speed,mul,warmup,homing=false){this.enemyShots.push({id:this.id(),type,x:cx(e)-10,y:cy(e)-10,w:type==='cannon'?24:18,h:type==='cannon'?24:18,vx:0,vy:0,speed,dir:e.dir,damage:e.damage*mul,warmup,life:4.5,owner:e.name,color:type==='orb'?'#bd8cff':type==='cannon'?'#ff8262':'#ffd175',homing});}
 updateEnemyShots(dt){for(const s of this.enemyShots){s.life-=dt;if(s.warmup>0){s.warmup-=dt;if(s.warmup<=0){const dx=cx(this.player)-cx(s),dy=cy(this.player)-cy(s),d=Math.hypot(dx,dy)||1;s.vx=dx/d*s.speed;s.vy=dy/d*s.speed;}continue;}if(s.homing){const dx=cx(this.player)-cx(s),dy=cy(this.player)-cy(s),d=Math.hypot(dx,dy)||1;s.vx=lerp(s.vx,dx/d*s.speed,1-Math.pow(.08,dt));s.vy=lerp(s.vy,dy/d*s.speed,1-Math.pow(.08,dt));}s.x+=s.vx*dt;s.y+=s.vy*dt;if(overlap(s,this.player)){this.hurtPlayer(s.damage,s.x,s.owner);s.life=0;}}this.enemyShots=this.enemyShots.filter(s=>s.life>0);}
 updateBoss(e,dt,ad){const p=this.player;if(e.breakStun>0){e.vx=0;return;}const phase=e.hp/e.maxHp<.34?3:e.hp/e.maxHp<.67?2:1;if(phase!==e.bossPhase){e.bossPhase=phase;e.bossAction=null;e.bossPhaseT=1.0;this.say(`BOSS PHASE ${phase}｜${phase===2?'十相彈幕':'回路崩壞'}`,2.5,'#ff7895');this.addFx('shockwave',cx(e),cy(e),1.0,2.5,'#ff7895');this.shake=24;}if(e.bossPhaseT>0){e.bossPhaseT-=dt;e.vx=0;return;}if(!e.bossAction){const pool=phase===1?['dash','cross']:phase===2?['dash','cross','orbs']:['dash','cross','orbs','collapse','gravity'];e.bossAction={type:pool[Math.floor(Math.random()*pool.length)],stage:0,t:0};}
  const a=e.bossAction;a.t+=dt;e.dir=cx(p)<cx(e)?-1:1;
  if(a.type==='dash'){if(a.stage===0){a.stage=1;a.t=0;this.effects.push({id:this.id(),type:'warningBox',x:e.dir>0?e.x+e.w:e.x-720,y:e.y+25,w:720,h:100,life:.58,max:.58,color:'#ff5578',boss:true});}else if(a.stage===1&&a.t>.58){a.stage=2;a.t=0;e.vx=e.dir*(920+phase*120);this.sfx.slash(1.4);}else if(a.stage===2){e.vx=e.dir*(920+phase*120);if(ad<135&&Math.abs(cy(p)-cy(e))<110)this.hurtPlayer(18+phase*4,cx(e),e.name+'・裂界突進');if(a.t>.30)e.bossAction=null;}}
  else if(a.type==='cross'){if(a.stage===0){a.stage=1;a.t=0;a.tx=cx(p);a.ty=cy(p);this.effects.push({id:this.id(),type:'warningBox',x:a.tx-330,y:a.ty-13,w:660,h:26,life:.78,max:.78,color:'#ff6588',boss:true},{id:this.id(),type:'warningBox',x:a.tx-13,y:a.ty-280,w:26,h:560,life:.78,max:.78,color:'#6fe7ff',boss:true});}else if(a.stage===1&&a.t>.76){a.stage=2;a.t=0;this.addFx('slash_gold',a.tx,a.ty,.38,2.3,'#ff7a9b');this.shake=17;if(Math.abs(cx(p)-a.tx)<36||Math.abs(cy(p)-a.ty)<45)this.hurtPlayer(19+phase*3,cx(e),e.name+'・交叉斬');}else if(a.stage===2&&a.t>.55)e.bossAction=null;}
  else if(a.type==='orbs'){if(a.stage===0){a.stage=1;a.t=0;this.addFx('shockwave',cx(e),cy(e),.65,1.7,'#ff7a9b');}else if(a.stage===1&&a.t>.48){a.stage=2;a.t=0;for(let n=-3;n<=3;n++){const ang=n*.15+(e.dir<0?Math.PI:0);this.enemyShots.push({id:this.id(),type:'bossOrb',x:cx(e),y:cy(e),w:22,h:22,vx:Math.cos(ang)*(280+Math.abs(n)*20),vy:Math.sin(ang)*360,damage:12+phase*2,warmup:.12,life:5,owner:e.name+'・十相彈',color:n%2?'#ff6c93':'#70e8ff',homing:false,speed:300});}}else if(a.stage===2&&a.t>.9)e.bossAction=null;}
  else if(a.type==='collapse'){if(a.stage===0){a.stage=1;a.t=0;for(const dx of[-300,0,300])this.effects.push({id:this.id(),type:'warningBox',x:p.x+dx-80,y:C.GROUND_Y-240,w:160,h:240,life:.90,max:.90,color:'#ff4f72',boss:true,explode:true,damage:24});this.say('十相崩壞｜離開紅色區域！',1,'#ff7895');}else if(a.t>1.25)e.bossAction=null;}
  else if(a.type==='gravity'){if(a.stage===0){a.stage=1;a.t=0;this.fields.push({id:this.id(),type:'bossGravity',x:cx(p),y:cy(p),r:380,life:2.2,color:'#e978ff'});this.say('引力鎖定｜持續 Dash 或換位脫離',1.2,'#e978ff');}else if(a.t>2.35)e.bossAction=null;}
 }
// ============================================================================
// 12. PUZZLES / OBJECTS / NPC
// ============================================================================
 updatePuzzles(dt){
  // gates
  const torch=this.puzzles.find(p=>p.type==='torch'),node=this.puzzles.find(p=>p.type==='node'),plate=this.puzzles.find(p=>p.type==='plate'),crate=this.puzzles.find(p=>p.type==='crate'),core=this.puzzles.find(p=>p.type==='core'),socket=this.puzzles.find(p=>p.type==='socket');
  if(plate&&crate)plate.pressed=overlap(plate,{x:crate.x,y:crate.y,w:crate.w,h:crate.h})||overlap(plate,this.player);
  for(const p of this.puzzles)if(p.type==='gate'){if(p.condition==='torch')p.open=!!torch?.lit;if(p.condition==='node')p.open=!!node?.active;if(p.condition==='plate')p.open=!!plate?.pressed;}
  // crate physics
  if(crate){crate.vy=(crate.vy||0)+C.GRAVITY*dt;crate.x+=(crate.vx||0)*dt;crate.y+=crate.vy*dt;crate.vx*=Math.pow(.04,dt);if(crate.y+crate.h>C.GROUND_Y){crate.y=C.GROUND_Y-crate.h;crate.vy=0;}if(overlap(this.player,crate)&&Math.abs(this.player.vx)>40)crate.vx+=sign(this.player.vx)*520*dt;}
  // core physics / socket
  if(core&&!core.inserted){core.vy=(core.vy||0)+C.GRAVITY*.55*dt;core.x+=(core.vx||0)*dt;core.y+=core.vy*dt;core.vx*=Math.pow(.12,dt);if(core.y+core.h>C.GROUND_Y){core.y=C.GROUND_Y-core.h;core.vy=0;}if(socket&&Math.abs(cx(core)-cx(socket))<65&&Math.abs(cy(core)-cy(socket))<70){core.inserted=true;core.x=socket.x+18;core.y=socket.y+18;core.vx=core.vy=0;socket.charged=true;this.say('引力核心歸位｜道路解鎖',1.8,'#e978ff');this.addFx('element_gravity',cx(core),cy(core),.6,1.8,'#e978ff');}}
  // spring platforms
  for(const s of this.tempSolids)if(s.type==='spring'&&overlap(this.player,{x:s.x,y:s.y-20,w:s.w,h:35})&&this.player.vy>=0){this.player.y=s.y-this.player.h;this.player.vy=-980;this.addFx('launcher',cx(s),s.y,.45,1.4,'#75eaff');}
  // climb vines
  const vine=this.tempSolids.find(s=>s.climbable&&overlap(this.player,{x:s.x-12,y:s.y,w:s.w+24,h:s.h}));if(vine&&(this.input.down('up')||this.input.down('down'))){this.player.vy=(this.input.down('down')?1:-1)*240;this.player.x=lerp(this.player.x,vine.x+vine.w/2-this.player.w/2,.12);}
  // exit
  const exit=this.puzzles.find(p=>p.type==='exit');if(exit?.active&&overlap(this.player,exit)){this.worldComplete=true;this.say(`回路復原｜BEST ${this.combo.best} HIT｜擊破 ${this.kills}`,99,'#fff4af');$('#completeOverlay').hidden=false;}
 }
 interact(){const p=this.player,n=this.npcs.find(n=>Math.hypot(cx(n)-cx(p),cy(n)-cy(p))<105);if(!n)return;if(n.id==='smith'){p.hp=p.maxHp;p.mp=p.maxMp;this.say(`${n.name}：${n.text}（HP／MP 已補滿）`,5,'#ffcf8a');}else this.say(`${n.name}：${n.text}`,6,'#dffcff');}

// Patch warning effects after their telegraph expires.
 triggerWarning(e){if(e.triggered)return;e.triggered=true;if(e.type!=='warningBox')return;if(e.explode){this.radialDamage(e.x+e.w/2,e.y+e.h/2,Math.max(e.w,e.h)*.65,e.damage||24,e.color||'#ff5570','Boss 崩壞');}
  else if(e.melee){const owner=this.enemies.find(x=>x.id===e.owner&&!x.dead);if(owner&&overlap(this.player,e))this.hurtPlayer(e.damage||owner.damage,cx(owner),owner.name);}
  else if(e.boss&&overlap(this.player,e)){const boss=this.enemies.find(x=>x.type==='boss'&&!x.dead);if(boss)this.hurtPlayer(e.damage||boss.damage,cx(boss),boss.name);}
  else if(e.owner){const owner=this.enemies.find(x=>x.id===e.owner&&!x.dead);if(owner&&owner.ai==='heavy'){this.radialDamage(e.x+e.w/2,e.y+e.h/2,150,0,'#ff9a6b','');if(overlap(this.player,e))this.hurtPlayer(e.damage||23,cx(owner),owner.name+'・震地');}}
 }

// Override effect update to include warning triggers.
 updateEffects(dt){for(const e of this.effects){if(e.delay&&e.delay>0){e.delay-=dt;continue;}if(e.type==='delayedFx'&&!e.spawned){e.spawned=true;this.effects.push({id:this.id(),type:e.fx,x:e.x,y:e.y,life:e.life,max:e.max,scale:e.scale,color:e.color,dir:e.dir});e.life=0;continue;}e.life-=dt;if(e.type==='text'){e.y+=e.vy*dt;e.vy*=Math.pow(.2,dt);}if(e.type==='warningBox'&&e.life<=0)this.triggerWarning(e);}
  this.effects=this.effects.filter(e=>e.life>0||e.delay>0);
  for(const a of this.attacks){a.delay-=dt;if(a.delay>0)continue;a.life-=dt;if(a.done)continue;const box={x:typeof a.x==='function'?a.x():a.x,y:typeof a.y==='function'?a.y():a.y,w:a.w,h:a.h};for(const e of this.enemies){if(e.dead||a.hitIds?.has(e.id)||!overlap(box,e))continue;(a.hitIds||(a.hitIds=new Set())).add(e.id);this.hitEnemy(e,a.damage,{dir:sign(a.kx||this.player.dir),kx:a.kx,ky:a.ky,kd:a.kd,br:a.br,big:a.big,color:a.color,label:a.label});}if(a.life<=0)a.done=true;}
  this.attacks=this.attacks.filter(a=>!a.done&&(a.delay>0||a.life>0));
 }

// ============================================================================
// 13. NETWORK
// ============================================================================
 bindNetwork(){const status=$('#netStatus');this.net.on('room',id=>{$('#roomCode').value=id;});this.net.on('status',s=>{status.textContent=s;});this.net.on('error',s=>{status.textContent='錯誤';this.say('連線錯誤｜'+s,5,'#ff8599');});this.net.on('playerState',d=>{const s=d.payload;if(s)this.remote={...this.remote,...s};});this.net.on('action',d=>{const s=d.payload;if(this.remote&&s){this.remote.action=s.action;this.remote.actionT=.3;}});}
 updateNetwork(ts){const p=this.player;this.net.sendState({x:p.x,y:p.y,vx:p.vx,vy:p.vy,dir:p.dir,classId:p.classId,hp:p.hp,maxHp:p.maxHp,anim:this.playerAnim(p).name,element:p.lastSwap||'fire'},ts);if(this.remote?.actionT>0)this.remote.actionT-=.016;}

// ============================================================================
// 14. UI / SETTINGS
// ============================================================================
 bindUI(){
  const select=$('#classSelect');select.innerHTML=Object.values(C.CLASSES).map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');select.value=this.player.classId;select.onchange=e=>this.changeClass(e.target.value);
  $('#hostBtn').onclick=()=>{try{this.net.host()}catch(e){this.say(e.message,4,'#ff8599')}};$('#joinBtn').onclick=()=>{try{this.net.join($('#roomCode').value)}catch(e){this.say(e.message,4,'#ff8599')}};$('#disconnectBtn').onclick=()=>this.net.disconnect();
  $('#closeHelp').onclick=()=>{this.modal=false;$('#helpPanel').hidden=true;this.canvas.focus();};$('#closeSettings').onclick=()=>{this.modal=false;$('#settingsPanel').hidden=true;this.canvas.focus();};$('#resetKeys').onclick=()=>{this.keys={...C.DEFAULT_KEYS};this.saveKeys();this.renderKeyList();};
  this.renderElementBar();this.renderSkills();this.say('安全區｜方向鍵移動，X／Y 多分支連段，1–0 元素換位',5,'#dffcff');
 }
 changeClass(id){const p=this.player,c=C.CLASSES[id];if(!c)return;p.classId=id;p.maxHp=c.maxHp;p.maxMp=c.maxMp;p.hp=Math.min(p.hp,p.maxHp);p.mp=Math.min(p.mp,p.maxMp);p.history='';p.attack=null;p.skillCD=[0,0,0];this.renderSkills();this.say(`切換職業｜${c.name}：${c.summary}`,2.5,c.color);}
 openSettings(){this.modal=true;$('#settingsPanel').hidden=false;this.renderKeyList();}
 renderKeyList(){const box=$('#keyList');box.innerHTML='';for(const[action,label]of Object.entries(C.ACTION_LABELS)){const b=document.createElement('button');b.className='key-row';b.innerHTML=`<span>${label}</span><kbd>${friendly(this.keys[action])}</kbd>`;b.onclick=()=>{b.querySelector('kbd').textContent='按新鍵…';this.input.capture=code=>{const other=Object.keys(this.keys).find(a=>a!==action&&this.keys[a]===code),old=this.keys[action];this.keys[action]=code;if(other)this.keys[other]=old;this.saveKeys();this.renderKeyList();};};box.appendChild(b);}}
 renderElementBar(){const box=$('#elements');box.innerHTML=C.ELEMENTS.map((e,i)=>`<div class="element-chip" data-element="${e.id}" style="--ec:${e.color}"><kbd>${i===9?0:i+1}</kbd><b>${e.glyph}</b><span>${e.name}</span></div>`).join('');}
 renderSkills(){const p=this.player,c=C.CLASSES[p.classId],names=[['X','快攻','方向／連打分支'],['Y','重攻','方向／連打分支'],['C',c.skills[0],'MP 24'],['V',c.skills[1],'MP 40'],['B',c.skills[2],'MP 78'],['Q',p.classId==='beast'?'切換獸形':p.classId==='summoner'?'靈獸指令':p.classId==='artificer'?'部署炮台':'裂隙爆發','職業能力']];$('#skills').innerHTML=names.map((n,i)=>`<div class="skill-chip" data-i="${i}"><kbd>${n[0]}</kbd><b>${n[1]}</b><small>${n[2]}</small></div>`).join('');}
 updateHUD(){const p=this.player,c=C.CLASSES[p.classId];$('#hpFill').style.width=`${clamp(p.hp/p.maxHp*100,0,100)}%`;$('#hpText').textContent=`HP ${Math.ceil(p.hp)} / ${p.maxHp}`;$('#mpFill').style.width=`${clamp(p.mp/p.maxMp*100,0,100)}%`;$('#mpText').textContent=`MP ${Math.floor(p.mp)} / ${p.maxMp}`;$('#className').textContent=`${c.icon} ${c.name}`;
  let res=p.classId==='rift'?`裂隙 ${Math.floor(p.rift)}/100`:p.classId==='beast'?`獸形 ${p.beastForm.toUpperCase()}${p.beastKing>0?' / KING':''}`:p.classId==='summoner'?(p.summonFrenzy>0?'狐靈狂熱':'狐靈待命'):`炮台 ${this.turrets.length}/3${this.overdrive>0?' / 超載':''}`;$('#classResource').textContent=res;$('#zoneName').textContent=C.ZONES[this.zone]?.name||'';$('#combo').textContent=this.combo.hits>1?`${this.combo.hits} HIT · ${Math.round(this.combo.damage)} DMG`:'';$('#commandName').textContent=this.combo.command||'X / Y COMMAND';
  const[ot,od]=this.objective();$('#objectiveTitle').textContent=ot;$('#objectiveText').textContent=od;$('#toast').textContent=this.message.t>0?this.message.text:'';$('#toast').style.color=this.message.color;$('#damageVignette').classList.toggle('hit',this.damageFlash>0);$('#startCoach').classList.toggle('hidden',this.objectiveStep>0);
  const threats=this.enemies.filter(e=>!e.dead&&e.aggro).sort((a,b)=>distance(p,a)-distance(p,b)),tp=$('#threatPanel');if(!this.combatUnlocked){tp.className='threat-panel safe';tp.textContent='SAFE｜安全訓練區';}else if(threats.length){const e=threats[0];tp.className='threat-panel danger';tp.textContent=`⚠ ${e.name}｜${Math.round(Math.abs(cx(e)-cx(p)))}px｜${cx(e)<cx(p)?'←':'→'}`;}else{tp.className='threat-panel safe';tp.textContent='CLEAR｜附近沒有威脅';}
  for(const chip of document.querySelectorAll('.element-chip')){const id=chip.dataset.element;chip.classList.toggle('active',this.projectiles.some(b=>b.element===id)||this.anchors[id]);chip.classList.toggle('anchor',!!this.validAnchor(id));chip.classList.toggle('marked',this.enemies.some(e=>!e.dead&&e.mark===id&&e.markUntil>this.time));}
  const last=this.player.lastElement||this.projectiles.at(-1)?.element||null,el=last&&C.ELEMENTS.find(e=>e.id===last);if(el){const a=this.validAnchor(el.id),i=C.ELEMENTS.indexOf(el),key=i===9?0:i+1;$('#elementInfo').innerHTML=`<strong style="color:${el.color}">${el.glyph} ${el.name}</strong><span>${a?`已有換位目標｜再按 ${key} 立即交換`:`命中：${el.hit}　換位：${el.swap}`}</span>`;}
  const skillEls=document.querySelectorAll('.skill-chip');for(let i=0;i<3;i++){const s=skillEls[i+2];if(s){s.classList.toggle('cooling',p.skillCD[i]>0);s.querySelector('small').textContent=p.skillCD[i]>0?`CD ${p.skillCD[i].toFixed(1)}s`:`MP ${[24,40,78][i]}`;}}if(skillEls[5]){skillEls[5].classList.toggle('cooling',p.qCD>0);skillEls[5].querySelector('small').textContent=p.qCD>0?`CD ${p.qCD.toFixed(1)}s`:'職業能力';}
  const boss=this.enemies.find(e=>e.type==='boss'&&!e.dead),bh=$('#bossHUD');const active=boss&&(Math.abs(cx(boss)-cx(p))<1550||boss.hp<boss.maxHp);bh.classList.toggle('show',!!active);if(active){$('#bossHpFill').style.width=`${boss.hp/boss.maxHp*100}%`;$('#bossBreakFill').style.width=`${boss.break/boss.breakMax*100}%`;$('#bossPhase').textContent=`PHASE ${boss.bossPhase}`;}
 }
// ============================================================================
// 15. RENDER
// ============================================================================
 render(){const ctx=this.ctx,W=this.viewW,H=this.viewH;ctx.save();ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;this.drawBackground(ctx,W,H);
  const sx=this.shake>0?rand(-this.shake,this.shake):0,sy=this.shake>0?rand(-this.shake*.45,this.shake*.45):0;ctx.save();ctx.translate(-this.camera.x+sx,-this.camera.y+sy);this.drawWorld(ctx);this.drawPuzzles(ctx);this.drawFields(ctx);this.drawWarningEffects(ctx);this.drawNPCs(ctx);this.drawEnemies(ctx);this.drawProjectiles(ctx);this.drawSkillShots(ctx);this.drawTurrets(ctx);this.drawPlayer(ctx,this.player,false);if(this.remote)this.drawRemote(ctx);this.drawFrontEffects(ctx);ctx.restore();
  this.drawSunlight(ctx,W,H);this.drawElementGlows(ctx,W,H);this.drawForeground(ctx,W,H);this.drawScreenIndicators(ctx,W,H);if(this.flash>0){ctx.fillStyle=`rgba(255,255,255,${this.flash*.38})`;ctx.fillRect(0,0,W,H);}ctx.restore();
 }
 drawBackground(ctx,W,H){const theme=C.ZONES[this.zone]?.theme||'station';for(const[layer,factor,alpha]of[['far',.06,1],['mid',.18,1]]){const im=this.assets.images[`${theme}_${layer}`];if(!im?.complete)continue;const ox=-((this.camera.x*factor)%W);ctx.globalAlpha=alpha;ctx.drawImage(im,ox,0,W,H);ctx.drawImage(im,ox+W,0,W,H);ctx.globalAlpha=1;}
  // bright atmospheric haze, not a dark full-screen overlay
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(255,250,220,.10)');g.addColorStop(.6,'rgba(92,210,225,.04)');g.addColorStop(1,'rgba(30,86,79,.10)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 }
 drawSunlight(ctx,W,H){ctx.save();ctx.globalCompositeOperation='screen';const sunset=C.ZONES[this.zone]?.theme==='sunset';const x=sunset?80:W*.76;const g=ctx.createLinearGradient(x,0,x+220,H);g.addColorStop(0,sunset?'rgba(255,184,92,.20)':'rgba(255,250,191,.15)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-70,0);ctx.lineTo(x+70,0);ctx.lineTo(x+430,H);ctx.lineTo(x+180,H);ctx.closePath();ctx.fill();ctx.restore();}
 drawForeground(ctx,W,H){const theme=C.ZONES[this.zone]?.theme||'station',im=this.assets.images[`${theme}_near`];if(!im?.complete)return;const ox=-((this.camera.x*.40)%W);ctx.globalAlpha=.54;ctx.drawImage(im,ox,0,W,H);ctx.drawImage(im,ox+W,0,W,H);ctx.globalAlpha=1;}
 drawWorld(ctx){for(const s of[...this.solids,...this.moving,...this.tempSolids]){if(s.life!==undefined&&s.life<=0)continue;const col=s.type==='ice'?'#89e5f4':s.type==='earth'?'#8f6b4e':s.type==='vine'||s.type==='root'?'#4fa75f':s.type==='spring'?'#5bdcef':s.type==='moving'?'#596d6f':'#53625d';ctx.fillStyle='#1c2a2d';ctx.fillRect(s.x,s.y,s.w,s.h);ctx.fillStyle=col;ctx.fillRect(s.x,s.y,s.w,Math.min(7,s.h));if(s.type==='ground'||s.type==='platform'||s.type==='moving'){ctx.fillStyle='#71a55c';for(let x=s.x;x<s.x+s.w;x+=22){ctx.fillRect(x,s.y-3,14,3);if((x/22|0)%3===0)ctx.fillRect(x+4,s.y-7,2,5);}ctx.fillStyle='rgba(255,255,255,.10)';for(let x=s.x+9;x<s.x+s.w;x+=28)ctx.fillRect(x,s.y+12,12,3);}}
  // Safe line is thin and never blocks sight.
  ctx.save();ctx.strokeStyle='rgba(255,222,80,.78)';ctx.setLineDash([10,8]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(C.SAFE_ZONE_END,220);ctx.lineTo(C.SAFE_ZONE_END,C.GROUND_Y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffe46e';ctx.font='900 13px monospace';ctx.fillText('正式戰鬥區 →',C.SAFE_ZONE_END+12,245);ctx.restore();
  // water
  for(const w of this.water){ctx.fillStyle=w.frozenUntil>this.time?'rgba(169,240,255,.88)':'rgba(39,173,214,.72)';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.fillStyle=w.frozenUntil>this.time?'#edfdff':'#8be9f5';for(let x=w.x;x<w.x+w.w;x+=34)ctx.fillRect(x,w.y+Math.sin(this.time*4+x*.03)*3,20,3);}
  // hazards
  for(const h of this.hazards){if(h.type==='spikes'){ctx.fillStyle='#b9c2c5';for(let x=h.x;x<h.x+h.w;x+=22){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+11,h.y);ctx.lineTo(x+22,h.y+h.h);ctx.fill();}}else if(h.type==='fireWall'&&h.active){ctx.fillStyle='#ff623f';for(let y=h.y;y<h.y+h.h;y+=28)ctx.fillRect(h.x-5+Math.sin(this.time*8+y)*7,y,h.w+10,16);}else if(h.type==='laser'&&h.active){ctx.fillStyle='#ff416c';ctx.shadowColor='#ff416c';ctx.shadowBlur=16;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.shadowBlur=0;}}
  // checkpoints
  for(const cp of this.checkpoints){ctx.fillStyle=cp.active?'#7ff2c1':'#6d7f7e';ctx.fillRect(cp.x,cp.y,cp.w,cp.h);ctx.fillStyle=cp.active?'#eafff5':'#b9c7c2';ctx.beginPath();ctx.arc(cp.x+cp.w/2,cp.y,17,0,Math.PI*2);ctx.fill();}
 }
 drawPuzzles(ctx){for(const p of this.puzzles){if(p.type==='torch'){ctx.fillStyle='#67503a';ctx.fillRect(p.x+14,p.y+25,12,37);ctx.fillStyle=p.lit?'#ff673f':'#52605a';ctx.beginPath();ctx.arc(p.x+20,p.y+17,p.lit?16+Math.sin(this.time*8)*2:9,0,Math.PI*2);ctx.fill();}
   else if(p.type==='gate'){ctx.save();ctx.globalAlpha=p.open?.18:1;ctx.fillStyle=p.open?'#8cf2ce':'#697b75';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(255,255,255,.18)';for(let y=p.y+12;y<p.y+p.h;y+=28)ctx.fillRect(p.x+8,y,p.w-16,3);ctx.restore();}
   else if(p.type==='node'){ctx.fillStyle='#4a5d5d';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle=p.active?'#ffe65a':'#9ca9a3';ctx.lineWidth=4;ctx.strokeRect(p.x+8,p.y+8,p.w-16,p.h-16);if(p.active){ctx.fillStyle='#fff8a0';ctx.beginPath();ctx.arc(cx(p),cy(p),10+Math.sin(this.time*8)*3,0,Math.PI*2);ctx.fill();}}
   else if(p.type==='plate'){ctx.fillStyle=p.pressed?'#77e9a0':'#b5965c';ctx.fillRect(p.x,p.y+(p.pressed?5:0),p.w,p.h-(p.pressed?5:0));}
   else if(p.type==='crate'){ctx.fillStyle='#8b6545';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='#d5a876';ctx.lineWidth=3;ctx.strokeRect(p.x+6,p.y+6,p.w-12,p.h-12);ctx.beginPath();ctx.moveTo(p.x+8,p.y+8);ctx.lineTo(p.x+p.w-8,p.y+p.h-8);ctx.stroke();}
   else if(p.type==='lightBridge'){const show=p.revealedUntil>this.time;ctx.save();ctx.globalAlpha=show?.78:.10;ctx.fillStyle='#fff3ae';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#fff';for(let x=p.x+8;x<p.x+p.w;x+=28)ctx.fillRect(x,p.y+4,16,3);ctx.restore();}
   else if(p.type==='shadowWall'){ctx.fillStyle='rgba(72,45,105,.68)';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='#a078ff';ctx.setLineDash([8,7]);ctx.strokeRect(p.x+3,p.y+3,p.w-6,p.h-6);ctx.setLineDash([]);}
   else if(p.type==='seed'){ctx.fillStyle=p.grown?'#6edb73':'#8ca95d';ctx.beginPath();ctx.arc(cx(p),cy(p),p.grown?20:13,0,Math.PI*2);ctx.fill();}
   else if(p.type==='core'){ctx.fillStyle=p.inserted?'#fff0ae':'#e978ff';ctx.shadowColor='#e978ff';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(cx(p),cy(p),27,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
   else if(p.type==='socket'){ctx.strokeStyle=p.charged?'#fff0ae':'#8b7c99';ctx.lineWidth=5;ctx.strokeRect(p.x,p.y,p.w,p.h);}
   else if(p.type==='brittleWall'&&!p.broken){ctx.fillStyle='#76645b';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle=p.cracked?'#ffd2a3':'#524943';ctx.lineWidth=3;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(p.x+10+i*10,p.y+25+i*48);ctx.lineTo(p.x+58-i*4,p.y+78+i*42);ctx.stroke();}}
   else if(p.type==='exit'){ctx.strokeStyle=p.active?'#8ff3d4':'#6f7f7a';ctx.lineWidth=8;ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.fillStyle=p.active?'rgba(143,243,212,.20)':'rgba(80,90,90,.15)';ctx.fillRect(p.x,p.y,p.w,p.h);}
  }}
 drawFields(ctx){for(const f of this.fields){ctx.save();const a=clamp(f.life/2,0.18,.75);ctx.globalAlpha=a;if(f.type==='flame'){ctx.fillStyle=hexA(f.color,.30);ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();for(let k=0;k<10;k++){ctx.fillStyle=k%2?'#ffb35f':'#ff613e';ctx.beginPath();ctx.arc(f.x+Math.cos(k*.9+this.time*3)*f.r*.65,f.y+Math.sin(k*1.1)*f.r*.35,10+Math.sin(this.time*5+k)*4,0,Math.PI*2);ctx.fill();}}
   else if(f.type==='geyser'){ctx.fillStyle=hexA(f.color,.45);ctx.fillRect(f.x-45,f.y-230,90,260);ctx.fillStyle='#d7f7ff';for(let y=f.y-220;y<f.y;y+=35)ctx.fillRect(f.x-25+Math.sin(this.time*5+y)*18,y,50,6);}
   else if(f.type==='gravity'||f.type==='bossGravity'){ctx.strokeStyle=f.color;ctx.lineWidth=5;for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(f.x,f.y,35+k*55+Math.sin(this.time*5+k)*8,0,Math.PI*2);ctx.stroke();}}
   else if(f.type==='decoy'){ctx.fillStyle=hexA(f.color,.35);ctx.fillRect(f.x-24,f.y-58,48,78);ctx.strokeStyle=f.color;ctx.strokeRect(f.x-30,f.y-64,60,90);}
   else if(f.type==='starBeast'){ctx.strokeStyle=f.color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(f.x,f.y,f.r*.75+Math.sin(this.time*4)*12,0,Math.PI*2);ctx.stroke();}
   ctx.restore();}}
 drawWarningEffects(ctx){for(const e of this.effects){if(e.delay>0)continue;if(e.type==='warningBox'){ctx.save();ctx.globalAlpha=.26+.18*Math.sin(this.time*22);ctx.fillStyle=e.color;ctx.fillRect(e.x,e.y,e.w,e.h);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(e.x,e.y,e.w,e.h);ctx.restore();}else if(e.type==='beam'){const a=clamp(e.life/e.max,0,1);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,a*2.5);ctx.strokeStyle=e.color;ctx.lineWidth=e.width*(1+.18*Math.sin(this.time*55));ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=e.width*.20;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.restore();}}}
 playerAnim(p){let name='idle';if(p.downT>0)name='down';else if(p.recoverT>0)name='recover';else if(p.hurtT>0)name='hurt';else if(p.castT>0)name='cast';else if(p.attack)name=p.attack.def.anim;else if(p.dashT>0)name='dash';else if(!p.onGround)name=p.vy<0?'jump':'fall';else if(Math.abs(p.vx)>55)name='run';
  const rows={idle:0,run:1,jump:2,fall:3,dash:4,light1:5,light2:6,light3:7,light4:8,heavy1:9,heavy2:10,launcher:11,thrust:12,sweep:13,air:14,dive:15,hurt:16,down:17,recover:18,cast:19};let frame=0;
  if(p.attack)frame=Math.min(9,Math.floor(p.attack.elapsed/p.attack.def.duration*10));else if(name==='down')frame=Math.min(9,Math.floor((1.18-p.downT)*8));else frame=Math.floor(this.time*(name==='run'?13:name==='idle'?6:10))%10;return{name,row:rows[name]??0,frame};}
 drawPlayer(ctx,p,remote=false){const im=this.assets.images['player_'+(p.classId||'rift')];if(!im?.complete)return;const a=remote?{row:0,frame:Math.floor(this.time*6)%10}:this.playerAnim(p),sw=40,sh=56,dw=84,dh=118,x=cx(p),y=p.y+p.h+7,cl=C.CLASSES[p.classId]||C.CLASSES.rift;
  ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=cl.color;ctx.shadowColor=cl.color;ctx.shadowBlur=17;ctx.beginPath();ctx.ellipse(x,y-3,37,8,0,0,Math.PI*2);ctx.fill();ctx.restore();ctx.save();if(!remote&&p.inv>0&&Math.floor(this.time*22)%2===0)ctx.globalAlpha=.46;ctx.translate(x,y);ctx.scale(p.dir||1,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(im,a.frame*sw,a.row*sh,sw,sh,-dw/2,-dh,dw,dh);ctx.restore();if(!remote&&(this.objectiveStep<2||this.time<14)){ctx.fillStyle='#edffff';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.shadowColor='#63eaff';ctx.shadowBlur=10;ctx.fillText('▼ YOU / 玩家',x,p.y-35);ctx.shadowBlur=0;}if(p.shield>0&&!remote){ctx.strokeStyle='rgba(105,225,255,.85)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,cy(p),52+Math.sin(this.time*8)*3,0,Math.PI*2);ctx.stroke();}ctx.textAlign='left';}
 drawRemote(ctx){const r=this.remote;if(!r)return;this.drawPlayer(ctx,{...r,w:C.PLAYER.w,h:C.PLAYER.h,onGround:true,downT:0,recoverT:0,hurtT:0,castT:0,attack:null,dashT:0,inv:0,shield:0},true);ctx.fillStyle='#5bcfff';ctx.font='900 12px monospace';ctx.fillText('P2',r.x,r.y-15);}
 enemyAnim(e){let row=0;if(e.downT>0)row=5;else if(e.hitT>0)row=4;else if(e.aggro&&e.aiT>.62)row=e.ai==='mage'?3:2;else if(Math.abs(e.vx)>10)row=1;const frame=Math.floor(this.time*(row===1?11:7))%8;return{row,frame};}
 drawEnemies(ctx){for(const e of this.enemies){if(e.dead)continue;ctx.save();if(e.type==='boss'){const im=this.assets.images.boss;if(im?.complete){let row=0;if(e.breakStun>0)row=6;else if(e.hitT>0)row=7;else if(e.bossPhaseT>0)row=5;else if(e.bossAction?.type==='dash')row=3;else if(e.bossAction?.type==='orbs')row=4;else if(e.bossAction)row=2;else if(Math.abs(e.vx)>10)row=1;const fr=Math.floor(this.time*(row===1?10:7))%10,dw=165,dh=165;ctx.translate(cx(e),e.y+e.h+12);ctx.scale(e.dir||-1,1);if(e.hitT>0){ctx.shadowColor='#fff';ctx.shadowBlur=28;}ctx.drawImage(im,fr*112,row*112,112,112,-dw/2,-dh,dw,dh);}ctx.restore();continue;}
   const key=e.type==='dummy'?'enemy_shield':'enemy_'+e.type,im=this.assets.images[key];if(im?.complete){const a=this.enemyAnim(e),scale=e.type==='golem'?2.15:1.65,dw=48*scale,dh=48*scale;ctx.translate(cx(e),e.y+e.h+6);ctx.scale(e.dir||-1,1);if(e.hitT>0){ctx.shadowColor='#fff';ctx.shadowBlur=20;}ctx.drawImage(im,a.frame*48,a.row*48,48,48,-dw/2,-dh,dw,dh);}else{ctx.fillStyle=C.ENEMIES[e.type]?.color||'#aaa';ctx.fillRect(e.x,e.y,e.w,e.h);}ctx.restore();
   const near=Math.abs(cx(e)-cx(this.player))<900||e.aggro||e.type==='dummy';if(near){ctx.fillStyle='rgba(4,9,13,.84)';ctx.fillRect(e.x-6,e.y-30,e.w+12,20);ctx.fillStyle=e.type==='dummy'?'#9ff4ff':'#fff';ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText(e.type==='dummy'?'訓練傀儡｜不反擊':e.name,cx(e),e.y-16);ctx.fillStyle='#29141b';ctx.fillRect(e.x,e.y-8,e.w,6);ctx.fillStyle=e.type==='dummy'?'#6ce7ff':'#ff5f78';ctx.fillRect(e.x,e.y-8,e.w*clamp(e.hp/e.maxHp,0,1),6);}
   if(e.aggro){ctx.fillStyle='#ff5571';ctx.font='900 22px monospace';ctx.fillText('!',cx(e),e.y-43);}if(e.mark&&e.markUntil>this.time){const el=C.ELEMENTS.find(q=>q.id===e.mark),i=C.ELEMENTS.indexOf(el);ctx.strokeStyle=el.color;ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.strokeRect(e.x-6,e.y-6,e.w+12,e.h+12);ctx.setLineDash([]);ctx.fillStyle=el.color;ctx.font='900 11px monospace';ctx.fillText(`${el.glyph}｜再按 ${i===9?0:i+1} ↔`,cx(e),e.y-55);}
   const states=[];if(e.burn>0)states.push(['火','#ff704c']);if(e.freeze>0)states.push(['冰','#7ee8ff']);if(e.wet>0)states.push(['濕','#5a9fff']);if(e.stun>0)states.push(['暈','#ffe65a']);if(e.root>0)states.push(['根','#70df77']);if(e.armorBreak>0)states.push(['破','#ffbd78']);if(e.curse>0)states.push(['咒','#b48aff']);ctx.font='900 10px monospace';let sx=e.x;for(const[t,c]of states){ctx.fillStyle=c;ctx.fillText(t,sx,e.y-11);sx+=16;}if(e.airborne){ctx.fillStyle='#fff0a2';ctx.fillText('AIR',e.x,e.y-68);}ctx.textAlign='left';}
 }
 drawNPCs(ctx){const im=this.assets.images.player_summoner;for(const n of this.npcs){if(im?.complete){const fr=Math.floor(this.time*5)%10;ctx.drawImage(im,fr*40,0,40,56,n.x-18,n.y-45,80,112);}ctx.fillStyle='#dffcff';ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText(n.name,n.x+n.w/2,n.y-50);if(Math.hypot(cx(n)-cx(this.player),cy(n)-cy(this.player))<110){ctx.fillStyle='#ffe69a';ctx.fillText('[F] 互動',n.x+n.w/2,n.y-66);}}ctx.textAlign='left';}
 drawProjectiles(ctx){for(const b of this.projectiles){const el=C.ELEMENTS.find(e=>e.id===b.element),im=this.assets.images['element_'+b.element],x=cx(b),y=cy(b);ctx.save();for(let i=b.trail.length-1;i>=0;i--){const q=b.trail[i],a=(b.trail.length-i)/b.trail.length*.24,r=2+(b.trail.length-i)*.26;ctx.fillStyle=hexA(el.color,a);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();}if(im?.complete){const fr=Math.floor(this.time*13)%10,sz=Math.max(62,b.w*1.5);ctx.shadowColor=el.color;ctx.shadowBlur=22;ctx.drawImage(im,fr*96,0,96,96,x-sz/2,y-sz/2,sz,sz);ctx.shadowBlur=0;}else{ctx.fillStyle=el.color;ctx.beginPath();ctx.arc(x,y,b.w/2,0,Math.PI*2);ctx.fill();}if(b.anchored){const i=C.ELEMENTS.indexOf(el);ctx.strokeStyle=el.color;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(x,y,b.w*.7+8+Math.sin(this.time*7)*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(3,8,12,.88)';ctx.fillRect(x-37,y-b.h/2-31,74,18);ctx.fillStyle=el.color;ctx.font='900 10px monospace';ctx.textAlign='center';ctx.fillText(`${i===9?0:i+1} 再按 ↔`,x,y-b.h/2-18);}ctx.restore();}
  for(const s of this.enemyShots){ctx.save();const x=cx(s),y=cy(s);if(s.warmup>0){const q=1-s.warmup/.6;ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,10+q*25,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText('!',x,y+4);}else{ctx.strokeStyle=hexA(s.color,.55);ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x-s.vx*.08,y-s.vy*.08);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff';ctx.shadowColor=s.color;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}ctx.restore();}}
 drawSkillShots(ctx){for(const s of this.skillShots){ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=14;ctx.beginPath();ctx.arc(s.x,s.y,s.w/2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
 drawTurrets(ctx){for(const t of this.turrets){ctx.fillStyle='#273943';ctx.fillRect(t.x-20,t.y-18,40,36);ctx.fillStyle=this.overdrive>0?'#ffe66d':'#75eaff';ctx.fillRect(t.x-12,t.y-14,24,8);ctx.fillRect(t.x+8,t.y-11,24,5);}if(this.familiar){ctx.fillStyle='#ffe583';ctx.shadowColor='#ffe583';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(this.familiar.x,this.familiar.y,16,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='900 11px monospace';ctx.fillText('狐',this.familiar.x-7,this.familiar.y+4);}}
 drawFrontEffects(ctx){for(const e of this.effects){if(e.delay>0||['warningBox','beam'].includes(e.type))continue;if(e.type==='text'){ctx.save();ctx.globalAlpha=clamp(e.life/e.max,0,1);ctx.fillStyle=e.color;ctx.font=`900 ${e.size}px monospace`;ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(e.text,e.x,e.y);ctx.restore();continue;}if(e.type==='lightningLine'){ctx.save();ctx.globalAlpha=e.life/e.max;ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.x,e.y);const seg=12;for(let i=1;i<seg;i++){const t=i/seg;ctx.lineTo(lerp(e.x,e.x2,t)+rand(-8,8),lerp(e.y,e.y2,t)+rand(-8,8));}ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.restore();continue;}
   const map={hit:['hit',96,10],slash_cyan:['slash_cyan',128,10],slash_gold:['slash_gold',128,10],launcher:['launcher',128,10],explosion:['explosion',160,12],shockwave:['shockwave',160,12]};let key=e.type;if(e.type.startsWith('element_'))key=e.type;const im=this.assets.images[key];if(!im?.complete)continue;const info=map[e.type]||[key,96,10],sw=info[1],frames=info[2],progress=1-e.life/e.max,fr=Math.min(frames-1,Math.floor(progress*frames)),size=sw*(e.scale||1);ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(e.x,e.y);ctx.scale(e.dir||1,1);ctx.drawImage(im,fr*sw,0,sw,sw,-size/2,-size/2,size,size);ctx.restore();}
 }
 drawElementGlows(ctx,W,H){ctx.save();ctx.globalCompositeOperation='lighter';const toScreen=(x,y)=>({x:x-this.camera.x,y:y-this.camera.y});for(const b of this.projectiles){const el=C.ELEMENTS.find(e=>e.id===b.element);if(!el||el.id==='shadow')continue;const s=toScreen(cx(b),cy(b)),r=el.id==='light'?150:el.id==='fire'?105:el.id==='lightning'?120:78,g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,r);g.addColorStop(0,hexA(el.color,.24));g.addColorStop(1,hexA(el.color,0));ctx.fillStyle=g;ctx.fillRect(s.x-r,s.y-r,r*2,r*2);}for(const f of this.fields){if(f.type==='flame'||f.type==='geyser'||f.type==='gravity'){const s=toScreen(f.x,f.y),r=f.type==='gravity'?180:125,g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,r);g.addColorStop(0,hexA(f.color,.16));g.addColorStop(1,hexA(f.color,0));ctx.fillStyle=g;ctx.fillRect(s.x-r,s.y-r,r*2,r*2);}}ctx.restore();}
 drawScreenIndicators(ctx,W,H){const p=this.player;if(this.objectiveStep<2||this.time<14){const x=clamp(cx(p)-this.camera.x,80,W-80),y=clamp(p.y-this.camera.y-30,100,H-180);ctx.fillStyle='#eaffff';ctx.font='900 14px monospace';ctx.textAlign='center';ctx.shadowColor='#65eaff';ctx.shadowBlur=10;ctx.fillText('▼ YOU / 玩家',x,y);ctx.shadowBlur=0;}
  const off=this.enemies.filter(e=>!e.dead&&e.aggro&&(cx(e)-this.camera.x<60||cx(e)-this.camera.x>W-60)).sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,3);off.forEach((e,i)=>{const right=cx(e)>cx(p),x=right?W-28:28,y=210+i*60;ctx.fillStyle='#ff5571';ctx.beginPath();if(right){ctx.moveTo(x+13,y);ctx.lineTo(x-9,y-11);ctx.lineTo(x-9,y+11);}else{ctx.moveTo(x-13,y);ctx.lineTo(x+9,y-11);ctx.lineTo(x+9,y+11);}ctx.closePath();ctx.fill();ctx.fillStyle='rgba(3,8,12,.86)';ctx.fillRect(right?W-185:42,y-17,140,34);ctx.fillStyle='#fff';ctx.font='900 10px monospace';ctx.textAlign=right?'right':'left';ctx.fillText(e.name,right?W-50:48,y-2);ctx.fillStyle='#ff91a0';ctx.fillText(`${Math.round(Math.abs(cx(e)-cx(p)))}px`,right?W-50:48,y+12);});ctx.textAlign='left';}
}

// ============================================================================
// INIT / DEBUG
// ============================================================================
addEventListener('DOMContentLoaded',()=>{const game=new Game();window.ElementalSwap={game,debug:{teleport:(x,y=C.GROUND_Y-C.PLAYER.h)=>{game.player.x=clamp(Number(x)||0,0,C.WORLD_W-game.player.w);game.player.y=y;game.player.vx=game.player.vy=0;},heal:()=>{game.player.hp=game.player.maxHp;game.player.mp=game.player.maxMp;},class:id=>game.changeClass(id),boss:()=>{game.player.x=22400;game.player.y=C.GROUND_Y-game.player.h;game.player.checkpointX=22200;},element:id=>{const i=C.ELEMENTS.findIndex(e=>e.id===id);if(i>=0)game.elementPress(i);},spawn:(type,x=game.player.x+400)=>game.spawn(type,x,C.GROUND_Y),state:()=>game}};});
})();
