/*
 * Elemental Swap V5 — class identity, safe swap and puzzle expansion
 * =============================================================================
 * This file patches the stable V4 core after it creates window.ElementalSwap.game.
 * Keeping the patch separate makes every V5 change easy to inspect or remove.
 */
(function(){
'use strict';
const C=window.ES4;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const sign=v=>v<0?-1:1;
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const cx=o=>o.x+o.w/2,cy=o=>o.y+o.h/2;
const d2=(a,b)=>Math.hypot(cx(a)-cx(b),cy(a)-cy(b));
const alive=e=>e&&!e.dead;

function patch(game){
 if(!game||game.v5Patched)return;game.v5Patched=true;
 game.v5Summons=[];game.v5MirrorNext=1;game.v5PuzzleVersion=1;game.v5GuidePulse=0;

 // Additional assets used by transformations and real summons.
 for(const [key,path] of Object.entries({
  player_beast_wolf:'assets/sprites/player_beast_wolf.png',player_beast_eagle:'assets/sprites/player_beast_eagle.png',
  player_beast_bear:'assets/sprites/player_beast_bear.png',player_beast_king:'assets/sprites/player_beast_king.png',
  summon_fox:'assets/sprites/summon_fox.png',summon_owl:'assets/sprites/summon_owl.png',
  summon_guardian:'assets/sprites/summon_guardian.png',summon_starbeast:'assets/sprites/summon_starbeast.png',
  turret_v5:'assets/sprites/turret_v5.png'
 }))game.assets.img(key,path);

 installPuzzles(game);
 installSafeSwap(game);
 installClasses(game);
 installPuzzleLogic(game);
 installRendering(game);
 installHUD(game);
 game.say('V5 已載入｜換位會搜尋安全落點；召喚與獸形現在是實體角色。',5,'#17483e');
}

function installPuzzles(g){
 const add=(type,x,y,w=52,h=72,o={})=>{const p={id:g.id(),type,x,y,w,h,...o};g.puzzles.push(p);return p;};
 // Zone 1 — three fire altars.
 add('fireAltar',620,640,46,70,{order:1,lit:false,label:'火壇 1'});
 add('fireAltar',1110,455,46,70,{order:2,lit:false,label:'火壇 2'});
 add('fireAltar',1850,640,46,70,{order:3,lit:false,label:'火壇 3'});
 // Zone 2 — water first, lightning second; plus a wheel requiring repeated water/wind hits.
 add('conductor',3235,606,48,92,{wetUntil:0,active:false,label:'導體 A'});
 add('waterWheel',3570,548,92,112,{charge:0,active:false,label:'水輪'});
 add('conductor',4070,606,48,92,{wetUntil:0,active:false,label:'導體 B'});
 // Zone 3 — three different physical mechanics.
 add('windTurbine',6600,525,92,120,{charge:0,active:false,label:'風輪'});
 add('gravityLock',7210,570,72,110,{active:false,label:'引力鎖'});
 // Zone 4 — ordered light mirror sequence.
 add('lightMirror',9470,472,50,92,{order:1,active:false,label:'光鏡 I'});
 add('lightMirror',10000,360,50,92,{order:2,active:false,label:'光鏡 II'});
 add('lightMirror',10700,480,50,92,{order:3,active:false,label:'光鏡 III'});
 // Zone 5 — three seeds and an actual bridge that appears after seeds + core.
 add('seedCluster',11450,653,46,56,{grown:false,label:'古種 A'});
 add('seedCluster',12120,425,46,56,{grown:false,label:'古種 B'});
 add('seedCluster',12720,650,46,56,{grown:false,label:'古種 C'});
 add('v5Bridge',14242,576,250,24,{active:false,label:'藤橋'});
 // Zone 6 — cooling and conductive maintenance shut down the laser grid.
 add('coolantValve',15160,610,62,86,{active:false,label:'冷卻閥'});
 add('powerCoil',16900,565,64,112,{wetUntil:0,active:false,label:'動力線圈'});
 add('v5Gate',17670,390,54,330,{open:false,label:'水電閘門'});
 // Zone 7 — three separate thermal-shock seals.
 add('thermalSeal',18380,590,62,110,{cracked:false,broken:false,label:'熱震封印 A'});
 add('thermalSeal',19120,410,62,110,{cracked:false,broken:false,label:'熱震封印 B'});
 add('thermalSeal',20030,580,62,110,{cracked:false,broken:false,label:'熱震封印 C'});
 add('v5Gate',20850,390,54,330,{open:false,label:'崩落閘門'});
 // Zone 8 — Q/class ability tutorial before boss.
 add('classShrine',21460,600,52,112,{active:false,label:'共鳴碑 I'});
 add('classShrine',21830,475,52,112,{active:false,label:'共鳴碑 II'});
 add('classShrine',22200,590,52,112,{active:false,label:'共鳴碑 III'});
 add('v5Gate',22480,370,58,350,{open:false,label:'核心門'});

 // More explicit guide NPCs.
 g.npcs.push(
  {id:'guide_water',name:'水路維修員・澄',x:3140,y:C.GROUND_Y-66,w:44,h:66,text:'先用 6 水讓兩座導體濕潤，再用 3 雷通電；水輪需要水或風連續推動。'},
  {id:'guide_crane',name:'高架工程師・梁',x:6320,y:C.GROUND_Y-66,w:44,h:66,text:'4 風推箱、0 引力啟動懸吊鎖；重量板、風輪、引力鎖三者都完成才開門。'},
  {id:'guide_light',name:'光學員・映',x:9340,y:C.GROUND_Y-66,w:44,h:66,text:'用 7 光依 I→II→III 點亮鏡子。8 影換位可穿過紫色影牆。'},
  {id:'guide_seed',name:'植生師・芽',x:11330,y:C.GROUND_Y-66,w:44,h:66,text:'9 藤喚醒三枚古種；0 引力把核心送入插槽，藤橋才會長出。'},
  {id:'guide_power',name:'水電技師・汐',x:15020,y:C.GROUND_Y-66,w:44,h:66,text:'2 冰先鎖定冷卻閥；6 水濕潤線圈後再用 3 雷。完成後雷射停機。'},
  {id:'guide_thermal',name:'熱震研究員・熾',x:18180,y:C.GROUND_Y-66,w:44,h:66,text:'每個封印先用 5 岩打出裂縫，再在附近完成「冰換位→火換位」熱震。'},
  {id:'guide_class',name:'職業試煉官・環',x:21320,y:C.GROUND_Y-66,w:44,h:66,text:'靠近三座共鳴碑各按一次 Q。召喚師會叫出靈獸，百獸使會真正改變形態。'}
 );
}

function installSafeSwap(g){
 g.v5RectFree=function(rect,ignore=null){
  if(rect.x<1||rect.x+rect.w>C.WORLD_W-1||rect.y<0||rect.y+rect.h>C.WORLD_H)return false;
  const solids=this.activeSolids(rect);
  for(const s of solids){if(ignore&&s.id===ignore.id)continue;if(hit(rect,s))return false;}
  for(const h of this.hazards){if(h.type==='fireWall'&&!h.active)continue;if(h.type==='laser'&&!h.active)continue;if(hit(rect,h))return false;}
  return true;
 };
 g.v5SafeLanding=function(rawX,rawY,w,h,fallback,ignore=null){
  const base={x:clamp(rawX,1,C.WORLD_W-w-1),y:clamp(rawY,0,C.WORLD_H-h)};
  const candidates=[];
  const push=(x,y,score)=>candidates.push({x:clamp(x,1,C.WORLD_W-w-1),y:clamp(y,0,C.WORLD_H-h),score});
  push(base.x,base.y,0);
  // If the projectile is embedded in a platform, the top surface is always preferred.
  const center=base.x+w/2;
  for(const s of this.activeSolids({x:base.x,y:base.y,w,h})){
   if(ignore&&s.id===ignore.id)continue;
   const horizontal=center>=s.x-40&&center<=s.x+s.w+40;
   if(horizontal){const sy=s.y-h-2;push(base.x,sy,Math.abs(sy-base.y)*.35-80);push(clamp(center-w/2,s.x-w+12,s.x+s.w-12),sy,Math.abs(sy-base.y)*.4-65);}
  }
  // Nearby platform tops.
  for(const s of this.activeSolids({x:base.x,y:base.y,w,h})){
   if(ignore&&s.id===ignore.id)continue;
   if(center>=s.x-80&&center<=s.x+s.w+80&&Math.abs((s.y-h)-base.y)<260)push(center-w/2,s.y-h-2,Math.abs((s.y-h)-base.y)*.55);
  }
  // Upward-first grid search. Never search below a platform before searching above it.
  for(const oy of [0,-12,-24,-40,-60,-84,-112,-148,-190])for(const ox of [0,-18,18,-36,36,-60,60])push(base.x+ox,base.y+oy,Math.abs(ox)*.8+Math.abs(oy));
  candidates.sort((a,b)=>a.score-b.score);
  for(const c of candidates)if(this.v5RectFree({x:c.x,y:c.y,w,h},ignore))return{x:c.x,y:c.y,fallback:false};
  return{x:fallback.x,y:fallback.y,fallback:true};
 };

 g.swapWith=function(el,a){
  const p=this.player,old={x:p.x,y:p.y,cx:cx(p),cy:cy(p)};
  const target=a.obj;
  const rawX=cx(target)-p.w/2;
  const rawY=a.type==='enemy'?target.y+target.h-p.h:cy(target)-p.h/2;
  const safe=this.v5SafeLanding(rawX,rawY,p.w,p.h,{x:old.x,y:old.y},a.type==='projectile'?target:null);
  if(a.type==='enemy'){
   const e=target,enemySafe=this.v5SafeLanding(old.cx-e.w/2,old.y+p.h-e.h,e.w,e.h,{x:e.x,y:e.y},e);
   e.x=enemySafe.x;e.y=enemySafe.y;e.vx=-p.vx*.22;e.vy=-80;e.stun=Math.max(e.stun,.48);
  }else{
   const b=target;b.x=old.cx-b.w/2;b.y=old.cy-b.h/2;b.vx=b.vy=0;b.anchored=true;b.life=Math.max(b.life,8);
  }
  p.x=safe.x;p.y=safe.y;p.vx*=.18;p.vy=0;p.inv=Math.max(p.inv,.72);p.onGround=false;
  this.statsSwaps=(this.statsSwaps||0)+1;
  const now={x:p.x,y:p.y,cx:cx(p),cy:cy(p)};
  this.elementSwapEffect(el,old,now);this.checkElementCombo(el.id);p.lastSwap=el.id;p.lastSwapAt=this.time;
  this.shake=Math.max(this.shake,10);this.flash=.14;this.sfx.swap(C.ELEMENTS.indexOf(el));
  this.addFx('element_'+el.id,old.cx,old.cy,.38,1.55,el.color);this.addFx('element_'+el.id,now.cx,now.cy,.38,1.55,el.color);
  this.say(safe.fallback?`${el.glyph} 換位目標不安全｜已保留原位置`:`${el.glyph} 安全換位完成｜落點已校正`,1.7,safe.fallback?'#ff9b78':el.color);
 };
}

function installClasses(g){
 const baseClass=g.useClassSkill.bind(g),baseRift=g.riftSkill.bind(g),baseArt=g.artificerSkill.bind(g);
 g.summonerSkill=function(i){
  const p=this.player,c=C.CLASSES.summoner.color;
  if(i===0){for(let n=0;n<3;n++)this.v5Summons.push({id:this.id(),kind:'fox',x:p.x-40-n*26,y:p.y-35,life:9,shotT:.1+n*.14,orbit:n});this.say('三狐契陣｜三隻靈狐已實體召喚',1.8,c);this.addFx('shockwave',cx(p),cy(p),.72,1.9,'#ffe583');}
  else if(i===1){p.shield=Math.max(p.shield,82);p.hp=Math.min(p.maxHp,p.hp+30);this.v5Summons.push({id:this.id(),kind:'guardian',x:p.x-60,y:p.y-80,life:11,shotT:.3,orbit:0});this.say('守護靈現界｜護盾、治療與擊退波',1.8,c);this.addFx('element_light',cx(p),cy(p),.7,2.0,'#d9ffff');}
  else{this.v5Summons.push({id:this.id(),kind:'starbeast',x:p.x-p.dir*120,y:p.y-80,life:13,shotT:.15,orbit:0});p.summonFrenzy=13;this.say('星獸降臨｜大型召喚物將持續踐踏敵群',2.2,c);this.addFx('shockwave',cx(p),cy(p),1.15,3.0,'#ffe583');}
 };
 g.beastSkill=function(i){
  const p=this.player,form=p.beastKing>0?'king':p.beastForm,c=C.CLASSES.beast.color;
  if(i===2){p.beastKing=12;p.armor=12;p.lowG=12;this.say('百獸王化｜外觀、移動與攻擊同步變身',2.1,c);this.addFx('shockwave',cx(p),cy(p),1.1,2.8,c);return;}
  if(form==='wolf'||form==='king'){
   if(i===0){p.vx=p.dir*980;for(let n=0;n<4;n++)this.attacks.push({id:this.id(),owner:'skill',delay:.03+n*.08,life:.10,x:()=>p.dir>0?p.x+p.w/2+15:p.x-155,y:()=>p.y,w:165,h:86,damage:12+n*2,kx:(n===3?560:170)*p.dir,ky:-100,kd:n===3?35:6,br:n===3?38:10,color:c,big:n===3,label:'狼牙奔襲'});this.say('狼形・獵殺奔襲',1.3,c);}
   else{this.fields.push({id:this.id(),type:'beastHowl',x:cx(p),y:cy(p),r:330,life:7,tick:0,color:'#9cff86'});this.say('狼形・群獵嚎叫｜範圍加速與持續震懾',1.6,c);}
  }else if(form==='eagle'){
   if(i===0){for(let n=-3;n<=3;n++)this.skillShots.push({id:this.id(),type:'feather',x:cx(p),y:cy(p)-20,w:18,h:10,vx:p.dir*(480+Math.abs(n)*25),vy:n*70,life:2.7,damage:10,color:'#dfffd2'});this.say('鷹形・七羽裂空',1.3,c);}
   else{p.vy=-760;p.lowG=1.6;this.attacks.push({id:this.id(),owner:'skill',delay:.26,life:.28,x:()=>p.x-75,y:()=>p.y+25,w:200,h:180,damage:35,kx:230*p.dir,ky:450,kd:55,br:45,color:c,big:true,label:'蒼鷹墜擊'});this.say('鷹形・蒼穹俯衝',1.5,c);}
  }else{
   if(i===0){p.armor=Math.max(p.armor,1.2);this.radialDamage(cx(p)+p.dir*75,cy(p)+25,190,38,'#d7b57d','熊掌震地');this.say('熊形・岩掌震地｜高 BREAK',1.4,c);}
   else{p.armor=Math.max(p.armor,8);p.shield=Math.max(p.shield,65);this.fields.push({id:this.id(),type:'bearWard',x:cx(p),y:cy(p),r:230,life:8,tick:0,color:'#d7b57d'});this.say('熊形・山王守勢｜霸體護盾與嘲諷',1.6,c);}
  }
 };
 g.riftSkill=baseRift;g.artificerSkill=baseArt;

 g.useClassSkill=function(){
  const p=this.player;if(p.downT>0||p.qCD>0)return;const before=p.qCD;
  if(p.classId==='summoner'){
   p.qCD=2.2;const e=this.nearestEnemy(cx(p),cy(p),850);
   if(!this.v5Summons.some(s=>s.kind==='owl'))this.v5Summons.push({id:this.id(),kind:'owl',x:p.x-30,y:p.y-100,life:9999,shotT:.1,orbit:0});
   for(const s of this.v5Summons){s.commandTarget=e?.id||null;s.shotT=0;}
   this.say(e?'靈獸指令｜全召喚物集中攻擊 '+e.name:'靈獸指令｜巡守模式',1.6,'#d590ff');this.addFx('element_light',cx(p),cy(p),.5,1.7,'#ffe583');
  }else if(p.classId==='beast'){
   p.qCD=.32;const forms=['wolf','eagle','bear'];p.beastForm=forms[(forms.indexOf(p.beastForm)+1)%3];
   const names={wolf:'狼形：高速 Dash 與連爪',eagle:'鷹形：三段跳與羽刃',bear:'熊形：霸體、護盾與 BREAK'};
   this.say('獸魂變身｜'+names[p.beastForm],1.8,'#8cf478');this.addFx(p.beastForm==='wolf'?'element_wind':p.beastForm==='eagle'?'element_lightning':'element_earth',cx(p),cy(p),.58,2.0,'#8cf478');this.flash=.18;this.shake=10;
  }else baseClass();
  const triggered=p.qCD!==before||p.classId==='summoner'||p.classId==='beast';
  if(triggered){const shrine=this.puzzles.find(q=>q.type==='classShrine'&&!q.active&&Math.hypot(cx(q)-cx(p),cy(q)-cy(p))<190);if(shrine){shrine.active=true;shrine.classId=p.classId;p.hp=Math.min(p.maxHp,p.hp+20);p.mp=Math.min(p.maxMp,p.mp+30);this.say(`${shrine.label} 共鳴完成｜${C.CLASSES[p.classId].name}`,1.8,C.CLASSES[p.classId].color);}}
 };

 g.updateFamiliar=function(dt){
  const p=this.player;
  if(p.classId==='summoner'&&!this.v5Summons.some(s=>s.kind==='fox'&&s.life>9000))this.v5Summons.push({id:this.id(),kind:'fox',x:p.x-55,y:p.y-35,life:9999,shotT:.4,orbit:0,permanent:true});
  if(p.classId!=='summoner')this.v5Summons=this.v5Summons.filter(s=>!s.permanent&&s.kind!=='owl');
  for(const s of this.v5Summons){
   if(!s.permanent&&s.life<9000)s.life-=dt;s.shotT-=dt;
   const index=this.v5Summons.filter(q=>q.kind===s.kind).indexOf(s),targetX=p.x-p.dir*(70+index*36),targetY=p.y-45-index*18;
   if(s.kind==='fox'){s.x=lerp(s.x,targetX,1-Math.pow(.002,dt));s.y=lerp(s.y,targetY+Math.sin(this.time*5+index)*10,1-Math.pow(.002,dt));}
   else if(s.kind==='owl'){s.x=lerp(s.x,p.x-p.dir*40+Math.cos(this.time*2.2)*85,.08);s.y=lerp(s.y,p.y-120+Math.sin(this.time*3)*25,.08);}
   else if(s.kind==='guardian'){s.x=lerp(s.x,p.x-p.dir*95,.06);s.y=lerp(s.y,p.y-75,.06);if(s.shotT<=0){s.shotT=1.2;p.shield=Math.max(p.shield,18);this.radialDamage(s.x,s.y,160,8,'#bffaff','守護靈脈衝');}}
   else if(s.kind==='starbeast'){s.x=lerp(s.x,p.x-p.dir*150,.04);s.y=lerp(s.y,p.y-85,.04);if(s.shotT<=0){s.shotT=.72;const e=this.nearestEnemy(s.x,s.y,520);if(e){this.radialDamage(cx(e),cy(e),135,16,'#ffe583','星獸踐踏');this.addFx('shockwave',cx(e),cy(e),.36,1.5,'#ffe583');}}}
   const forced=s.commandTarget&&this.enemies.find(e=>e.id===s.commandTarget&&!e.dead),e=forced||this.nearestEnemy(s.x,s.y,s.kind==='owl'?780:640);
   if(e&&s.shotT<=0&&(s.kind==='fox'||s.kind==='owl')){s.shotT=p.summonFrenzy>0?.25:(s.kind==='owl'?.58:.72);const dx=cx(e)-s.x,dy=cy(e)-s.y,m=Math.hypot(dx,dy)||1;this.skillShots.push({id:this.id(),type:s.kind==='owl'?'feather':'spirit',x:s.x,y:s.y,w:16,h:16,vx:dx/m*620,vy:dy/m*620,life:2.2,damage:s.kind==='owl'?10:8,target:null,color:s.kind==='owl'?'#d7b9ff':'#ffe583'});}
  }
  this.v5Summons=this.v5Summons.filter(s=>s.life>0);
  this.familiar=null;
 };
}

function installPuzzleLogic(g){
 const baseElementPuzzle=g.elementPuzzleHit.bind(g),baseUpdate=g.updatePuzzles.bind(g),baseCombo=g.checkElementCombo.bind(g),baseActive=g.activeSolids.bind(g);
 g.activeSolids=function(body=this.player){const arr=baseActive(body);for(const p of this.puzzles){if(p.type==='v5Gate'&&!p.open)arr.push({...p,oneWay:false,active:true});if(p.type==='v5Bridge'&&p.active)arr.push({...p,oneWay:true,active:true});}return arr;};
 g.elementPuzzleHit=function(b,el){
  for(const p of this.puzzles){if(!hit(b,p))continue;
   if(p.type==='fireAltar'&&el.id==='fire'&&!p.lit){p.lit=true;this.say(`${p.label} 點燃`,1.3,el.color);this.addFx('element_fire',cx(p),cy(p),.35,1.3,el.color);return true;}
   if(p.type==='conductor'){
    if(el.id==='water'){p.wetUntil=this.time+12;this.say(`${p.label} 已濕潤｜12 秒內用雷`,1.4,'#529cff');return true;}
    if(el.id==='lightning'){if(p.wetUntil>this.time){p.active=true;this.say(`${p.label} 導電完成`,1.4,'#ffe55d');}else this.say(`${p.label} 太乾燥｜先用水`,1.4,'#529cff');return true;}
   }
   if(p.type==='waterWheel'&&['water','wind'].includes(el.id)){p.charge=Math.min(3,p.charge+1);p.active=p.charge>=3;this.say(`${p.label} ${p.charge}/3`,1.2,el.color);return true;}
   if(p.type==='windTurbine'&&el.id==='wind'){p.charge=Math.min(3,p.charge+1);p.active=p.charge>=3;this.say(`${p.label} ${p.charge}/3`,1.2,el.color);return true;}
   if(p.type==='gravityLock'&&el.id==='gravity'){p.active=true;this.say('引力鎖已吸合',1.4,el.color);return true;}
   if(p.type==='lightMirror'&&el.id==='light'){
    if(p.order===this.v5MirrorNext){p.active=true;this.v5MirrorNext++;this.say(`${p.label} 正確｜下一面 ${this.v5MirrorNext<=3?'II'.repeat(0)+this.v5MirrorNext:'完成'}`,1.4,el.color);}else{for(const m of this.puzzles)if(m.type==='lightMirror')m.active=false;this.v5MirrorNext=1;this.say('光鏡順序錯誤｜請從 I 重新開始',1.6,'#ff956e');}return true;
   }
   if(p.type==='seedCluster'&&el.id==='nature'&&!p.grown){p.grown=true;this.tempSolids.push({id:this.id(),x:p.x+8,y:p.y-245,w:34,h:295,type:'vine',oneWay:false,climbable:true,life:99999});this.say(`${p.label} 發芽｜藤柱永久生成`,1.4,el.color);return true;}
   if(p.type==='coolantValve'&&el.id==='ice'){p.active=true;this.say('冷卻閥凍結鎖定',1.4,el.color);return true;}
   if(p.type==='powerCoil'){
    if(el.id==='water'){p.wetUntil=this.time+12;this.say('動力線圈濕潤｜現在使用雷',1.4,'#529cff');return true;}
    if(el.id==='lightning'){if(p.wetUntil>this.time){p.active=true;this.say('水電線圈啟動',1.4,el.color);}else this.say('線圈需要先濕潤',1.3,'#529cff');return true;}
   }
   if(p.type==='thermalSeal'&&el.id==='earth'&&!p.cracked){p.cracked=true;this.say(`${p.label} 龜裂｜在附近做冰→火換位`,1.6,el.color);return true;}
  }
  return baseElementPuzzle(b,el);
 };
 g.checkElementCombo=function(current){const prev=this.player.lastSwap;baseCombo(current);if(prev==='ice'&&current==='fire'){const p=this.player;for(const s of this.puzzles){if(s.type==='thermalSeal'&&s.cracked&&!s.broken&&Math.hypot(cx(s)-cx(p),cy(s)-cy(p))<720){s.broken=true;this.say(`${s.label} 熱震解除`,1.8,'#ffb482');this.addFx('explosion',cx(s),cy(s),.75,2.3,'#ffb482');break;}}}};
 g.updatePuzzles=function(dt){baseUpdate(dt);
  const all=t=>this.puzzles.filter(p=>p.type===t),gateAt=x=>this.puzzles.find(p=>p.type==='gate'&&Math.abs(p.x-x)<120);
  const altars=all('fireAltar'),conductors=all('conductor'),wheel=all('waterWheel')[0],turbine=all('windTurbine')[0],lock=all('gravityLock')[0];
  const g1=gateAt(2320);if(g1)g1.open=altars.every(p=>p.lit);
  const g2=gateAt(4300);if(g2)g2.open=conductors.every(p=>p.active)&&!!wheel?.active;
  const plate=this.puzzles.find(p=>p.type==='plate'),g3=gateAt(7440);if(g3)g3.open=!!plate?.pressed&&!!turbine?.active&&!!lock?.active;
  const mirrors=all('lightMirror'),bridge=this.puzzles.find(p=>p.type==='lightBridge');if(bridge&&mirrors.every(p=>p.active))bridge.revealedUntil=Infinity;
  const seeds=all('seedCluster'),core=this.puzzles.find(p=>p.type==='core'),vbridge=all('v5Bridge')[0];if(vbridge)vbridge.active=seeds.every(p=>p.grown)&&!!core?.inserted;
  const coolant=all('coolantValve')[0],coil=all('powerCoil')[0],powerGate=all('v5Gate').find(p=>p.x<18000);if(powerGate)powerGate.open=!!coolant?.active&&!!coil?.active;if(powerGate?.open)for(const h of this.hazards)if(h.type==='laser'&&h.x>14500&&h.x<18000)h.active=false;
  const seals=all('thermalSeal'),thermalGate=all('v5Gate').find(p=>p.x>18000&&p.x<21200);if(thermalGate)thermalGate.open=seals.every(p=>p.broken);
  const shrines=all('classShrine'),coreGate=all('v5Gate').find(p=>p.x>21200);if(coreGate)coreGate.open=shrines.every(p=>p.active);
 };
}

function installRendering(g){
 const basePlayer=g.drawPlayer.bind(g),basePuzzles=g.drawPuzzles.bind(g),baseTurrets=g.drawTurrets.bind(g),baseFields=g.drawFields.bind(g),baseIndicators=g.drawScreenIndicators.bind(g);
 g.drawPlayer=function(ctx,p,remote=false){
  let original=null;if(p.classId==='beast'){original=this.assets.images.player_beast;const form=p.beastKing>0?'king':p.beastForm;this.assets.images.player_beast=this.assets.images['player_beast_'+form]||original;}
  basePlayer(ctx,p,remote);if(original)this.assets.images.player_beast=original;
  if(!remote&&p.classId==='beast'){ctx.save();ctx.fillStyle=p.beastKing>0?'#fff1a0':p.beastForm==='wolf'?'#9cff92':p.beastForm==='eagle'?'#c8f7ff':'#ddb983';ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText(p.beastKing>0?'百獸王':p.beastForm==='wolf'?'狼形':p.beastForm==='eagle'?'鷹形':'熊形',cx(p),p.y-52);ctx.restore();}
 };
 g.drawTurrets=function(ctx){
  const im=this.assets.images.turret_v5;for(const t of this.turrets){if(im?.complete){const fr=Math.floor(this.time*(this.overdrive>0?16:8))%8;ctx.drawImage(im,fr*56,0,56,48,t.x-34,t.y-34,84,72);}else{ctx.fillStyle='#75eaff';ctx.fillRect(t.x-20,t.y-18,40,36);}}
  const map={fox:['summon_fox',48,40,76,64],owl:['summon_owl',48,40,72,60],guardian:['summon_guardian',64,64,104,104],starbeast:['summon_starbeast',96,72,150,112]};
  for(const s of this.v5Summons){const m=map[s.kind],img=m&&this.assets.images[m[0]];if(!img?.complete)continue;const fr=Math.floor(this.time*(s.kind==='starbeast'?7:10))%8;ctx.save();ctx.globalAlpha=s.life<1?Math.max(0,s.life):1;ctx.drawImage(img,fr*m[1],0,m[1],m[2],s.x-m[3]/2,s.y-m[4]/2,m[3],m[4]);ctx.restore();}
 };
 g.drawFields=function(ctx){baseFields(ctx);for(const f of this.fields){if(f.type==='beastHowl'||f.type==='bearWard'){ctx.save();ctx.globalAlpha=clamp(f.life/2,.2,.75);ctx.strokeStyle=f.color;ctx.lineWidth=f.type==='bearWard'?8:4;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.75+.08*Math.sin(this.time*5)),0,Math.PI*2);ctx.stroke();ctx.restore();}}};
 g.drawPuzzles=function(ctx){basePuzzles(ctx);for(const p of this.puzzles){ctx.save();const near=Math.abs(cx(this.player)-cx(p))<650;let color='#5c746d',glyph='?';
   if(p.type==='fireAltar'){color=p.lit?'#ff6a42':'#7b695a';glyph='1 火';ctx.fillStyle='#625247';ctx.fillRect(p.x+8,p.y+22,30,48);ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx(p),p.y+17,p.lit?14:9,0,Math.PI*2);ctx.fill();}
   else if(p.type==='conductor'){color=p.active?'#ffe95d':p.wetUntil>this.time?'#5aa8ff':'#708080';glyph=p.active?'完成':'6 水 → 3 雷';ctx.fillStyle='#40545a';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(p.x+8,p.y+8,p.w-16,p.h-16);}
   else if(p.type==='waterWheel'||p.type==='windTurbine'){color=p.active?'#78efa7':p.type==='waterWheel'?'#5aa8ff':'#82f2bd';glyph=`${p.type==='waterWheel'?'6/4':'4 風'} ${p.charge||0}/3`;ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx(p),cy(p),35,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=this.time*(p.active?2:.5)+i*Math.PI/3;ctx.beginPath();ctx.moveTo(cx(p),cy(p));ctx.lineTo(cx(p)+Math.cos(a)*34,cy(p)+Math.sin(a)*34);ctx.stroke();}}
   else if(p.type==='gravityLock'){color=p.active?'#f1a4ff':'#8b6b91';glyph='0 引力';ctx.strokeStyle=color;ctx.lineWidth=5;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx(p),cy(p),15+i*10+Math.sin(this.time*4+i)*2,0,Math.PI*2);ctx.stroke();}}
   else if(p.type==='lightMirror'){color=p.active?'#fff0a2':'#829396';glyph=`7 光 ${['I','II','III'][p.order-1]}`;ctx.fillStyle='#3f5356';ctx.fillRect(p.x+18,p.y+20,14,70);ctx.save();ctx.translate(cx(p),p.y+18);ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.fillRect(-14,-14,28,28);ctx.restore();}
   else if(p.type==='seedCluster'){color=p.grown?'#70db75':'#8ba75c';glyph='9 藤';ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx(p),cy(p),p.grown?18:12,0,Math.PI*2);ctx.fill();}
   else if(p.type==='coolantValve'){color=p.active?'#83e9ff':'#6d7e7d';glyph='2 冰';ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx(p),cy(p),24,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(cx(p),cy(p));ctx.lineTo(cx(p)+Math.cos(a)*32,cy(p)+Math.sin(a)*32);ctx.stroke();}}
   else if(p.type==='powerCoil'){color=p.active?'#ffe45d':p.wetUntil>this.time?'#529cff':'#718081';glyph=p.active?'完成':'6 水 → 3 雷';ctx.strokeStyle=color;ctx.lineWidth=5;for(let y=p.y+12;y<p.y+p.h-10;y+=18){ctx.beginPath();ctx.arc(cx(p),y,22,0,Math.PI);ctx.stroke();}}
   else if(p.type==='thermalSeal'){color=p.broken?'#78eaaa':p.cracked?'#ffba7c':'#8b7468';glyph=p.broken?'解除':p.cracked?'2↔ → 1↔':'5 岩';ctx.fillStyle='#6f625c';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(p.x+6,p.y+6,p.w-12,p.h-12);ctx.beginPath();ctx.moveTo(p.x+12,p.y+16);ctx.lineTo(p.x+p.w-13,p.y+p.h-16);ctx.stroke();}
   else if(p.type==='classShrine'){color=p.active?C.CLASSES[p.classId]?.color||'#fff0a0':'#78908b';glyph=p.active?'共鳴完成':'Q 職業';ctx.fillStyle='#40545a';ctx.fillRect(p.x+10,p.y+18,32,94);ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx(p),p.y+18,18,0,Math.PI*2);ctx.fill();}
   else if(p.type==='v5Gate'){ctx.save();ctx.globalAlpha=p.open?.18:1;ctx.fillStyle=p.open?'#78e9b7':'#526a67';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='#dffcf3';ctx.setLineDash([8,8]);ctx.strokeRect(p.x+5,p.y+5,p.w-10,p.h-10);ctx.restore();glyph=p.open?'OPEN':'解謎門';}
   else if(p.type==='v5Bridge'){ctx.save();ctx.globalAlpha=p.active?.92:.12;ctx.fillStyle='#65c873';ctx.fillRect(p.x,p.y,p.w,p.h);for(let x=p.x;x<p.x+p.w;x+=20){ctx.fillStyle='#b7e695';ctx.fillRect(x,p.y+3,13,4);}ctx.restore();glyph=p.active?'藤橋':'三古種＋核心';}
   else{ctx.restore();continue;}
   if(near){ctx.fillStyle='rgba(244,250,233,.92)';ctx.strokeStyle='rgba(31,70,65,.55)';ctx.lineWidth=1;const w=Math.max(58,ctx.measureText(glyph).width+14);ctx.fillRect(cx(p)-w/2,p.y-27,w,19);ctx.strokeRect(cx(p)-w/2,p.y-27,w,19);ctx.fillStyle='#153d38';ctx.font='900 10px monospace';ctx.textAlign='center';ctx.fillText(glyph,cx(p),p.y-14);}
   ctx.restore();}
 };
 g.drawScreenIndicators=function(ctx,W,H){baseIndicators(ctx,W,H);const t=this.v5CurrentTarget?.();if(!t)return;const sx=cx(t)-this.camera.x,sy=t.y-this.camera.y;if(sx>70&&sx<W-70&&sy>100&&sy<H-150){ctx.save();ctx.fillStyle='#143d38';ctx.font='900 12px monospace';ctx.textAlign='center';ctx.fillText('▼ NEXT',sx,sy-42);ctx.restore();}}
}

function installHUD(g){
 const baseObjective=g.objective.bind(g),baseHUD=g.updateHUD.bind(g),baseUpdateFields=g.updateFields.bind(g);
 g.v5ZoneTasks=function(zone=this.zone){
  const all=t=>this.puzzles.filter(p=>p.type===t),done=(n,ok)=>({text:n,done:!!ok});
  if(zone===0)return[done('用 1 火點燃三座火壇',all('fireAltar').every(p=>p.lit)),done('用 2 冰換位製造冰平台',this.statsSwaps>0&&this.player.lastSwap==='ice'),done('通過第一道門',this.puzzles.find(p=>p.type==='gate'&&Math.abs(p.x-2320)<100)?.open)];
  if(zone===1)return[done('6 水濕潤兩座導體',all('conductor').every(p=>p.wetUntil>this.time||p.active)),done('3 雷啟動兩座導體',all('conductor').every(p=>p.active)),done('水／風推動水輪 3 次',all('waterWheel')[0]?.active)];
  if(zone===2)return[done('4 風啟動風輪 3 次',all('windTurbine')[0]?.active),done('0 引力啟動懸吊鎖',all('gravityLock')[0]?.active),done('把箱子推上重量板',this.puzzles.find(p=>p.type==='plate')?.pressed)];
  if(zone===3)return[done('依 I→II→III 用 7 光照鏡',all('lightMirror').every(p=>p.active)),done('讓永久光橋顯現',this.puzzles.find(p=>p.type==='lightBridge')?.revealedUntil===Infinity),done('以 8 影換位穿越影牆',this.player.phase>0||cx(this.player)>10500)];
  if(zone===4)return[done('用 9 藤喚醒三枚古種',all('seedCluster').every(p=>p.grown)),done('用 0 引力移動核心入槽',this.puzzles.find(p=>p.type==='core')?.inserted),done('讓藤橋長成',all('v5Bridge')[0]?.active)];
  if(zone===5)return[done('用 2 冰鎖定冷卻閥',all('coolantValve')[0]?.active),done('6 水後 3 雷啟動線圈',all('powerCoil')[0]?.active),done('關閉雷射並開啟水電閘門',all('v5Gate').find(p=>p.x<18000)?.open)];
  if(zone===6)return[done('以 5 岩打裂三道封印',all('thermalSeal').every(p=>p.cracked)),done('各處完成冰換位→火換位',all('thermalSeal').every(p=>p.broken)),done('開啟崩落閘門',all('v5Gate').find(p=>p.x>18000&&p.x<21200)?.open)];
  return[done('靠近三座共鳴碑各按 Q',all('classShrine').every(p=>p.active)),done('擊破 Boss BREAK 條',this.enemies.find(e=>e.type==='boss')?.breakStun>0),done('擊敗十相哨兵',this.enemies.find(e=>e.type==='boss')?.dead)];
 };
 g.v5CurrentTarget=function(){const tasks=this.v5ZoneTasks();const idx=tasks.findIndex(t=>!t.done);const types=[['fireAltar','gate'],['conductor','waterWheel'],['windTurbine','gravityLock','plate'],['lightMirror','shadowWall'],['seedCluster','core'],['coolantValve','powerCoil'],['thermalSeal'],['classShrine','boss']][this.zone]||[];for(const type of types){const p=type==='boss'?this.enemies.find(e=>e.type==='boss'&&!e.dead):this.puzzles.find(p=>p.type===type&&!isPuzzleDone(p,this));if(p)return p;}return null;};
 g.objective=function(){if(this.objectiveStep<5)return baseObjective();const tasks=this.v5ZoneTasks(),n=tasks.find(t=>!t.done);return[n?`解謎｜${n.text}`:C.ZONES[this.zone].name,n?'右上清單會逐項更新；場景中的 NEXT 指標指向下一個機關。':'此區解謎完成，前往下一個檢查點。'];};
 g.updateHUD=function(){baseHUD();const box=document.getElementById('puzzleTracker');if(box){box.innerHTML=this.v5ZoneTasks().map(t=>`<div class="puzzle-task ${t.done?'done':''}"><b>${t.done?'✓':'◇'}</b><span>${t.text}</span></div>`).join('');}
  const p=this.player;if(p.classId==='summoner')document.getElementById('classResource').textContent=`召喚 ${this.v5Summons.length}｜${this.v5Summons.map(s=>({fox:'狐',owl:'鴞',guardian:'守護靈',starbeast:'星獸'}[s.kind])).join('・')||'待命'}`;
  if(p.classId==='beast')document.getElementById('classResource').textContent=p.beastKing>0?'百獸王化中':`真實獸形：${{wolf:'狼',eagle:'鷹',bear:'熊'}[p.beastForm]}`;
 };
 g.updateFields=function(dt){baseUpdateFields(dt);for(const f of this.fields){if(f.type==='beastHowl'&&f.tick<=0){f.tick=.65;this.player.vx*=1.04;for(const e of this.enemies)if(alive(e)&&Math.hypot(cx(e)-f.x,cy(e)-f.y)<f.r)e.stun=Math.max(e.stun,.22);}if(f.type==='bearWard'){for(const e of this.enemies)if(alive(e)&&Math.hypot(cx(e)-f.x,cy(e)-f.y)<f.r)e.aggro=true;}}
 };
 function isPuzzleDone(p,game){if(p.type==='fireAltar')return p.lit;if(['conductor','waterWheel','windTurbine','gravityLock','coolantValve','powerCoil','classShrine'].includes(p.type))return p.active;if(p.type==='lightMirror')return p.active;if(p.type==='seedCluster')return p.grown;if(p.type==='thermalSeal')return p.broken;if(p.type==='gate'||p.type==='v5Gate')return p.open;if(p.type==='core')return p.inserted;return false;}
}

window.addEventListener('DOMContentLoaded',()=>patch(window.ElementalSwap?.game));
})();
