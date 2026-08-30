#!/usr/bin/env node
/*
 * Headless runtime smoke test without a browser.
 * It provides a minimal DOM/Canvas mock, initializes the real game code,
 * and exercises commands, classes, all elements, gravity, safe zone, Boss and render.
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
class ClassList{constructor(){this.s=new Set()}toggle(c,on){if(on===undefined)on=!this.s.has(c);on?this.s.add(c):this.s.delete(c)}add(c){this.s.add(c)}remove(c){this.s.delete(c)}contains(c){return this.s.has(c)}}
function makeElement(id=''){
  const el={id,style:{},dataset:{},hidden:false,value:'',textContent:'',className:'',children:[],onclick:null,onchange:null,
    classList:new ClassList(),addEventListener(){},focus(){},appendChild(x){this.children.push(x)},getBoundingClientRect(){return{width:1600,height:900}},
    querySelector(sel){if(sel==='small')return this._small||(this._small=makeElement('small'));if(sel==='kbd')return this._kbd||(this._kbd=makeElement('kbd'));return makeElement(sel)}
  };
  Object.defineProperty(el,'innerHTML',{get(){return this._html||''},set(v){this._html=v}});
  return el;
}
const ids=`game classSelect hostBtn joinBtn disconnectBtn roomCode netStatus closeHelp closeSettings resetKeys helpPanel settingsPanel keyList elements skills hpFill hpText mpFill mpText className classResource zoneName combo commandName objectiveTitle objectiveText toast damageVignette startCoach threatPanel puzzleTracker elementInfo bossHUD bossHpFill bossBreakFill bossPhase pauseOverlay completeOverlay`.split(/\s+/);
const nodes=new Map(ids.map(id=>[id,makeElement(id)]));
const elementChips=Array.from({length:10},(_,i)=>{const e=makeElement('ec'+i);e.dataset.element=['fire','ice','lightning','wind','earth','water','light','shadow','nature','gravity'][i];return e});
const skillChips=Array.from({length:6},(_,i)=>{const e=makeElement('sc'+i);e.dataset.i=String(i);return e});
const grad={addColorStop(){}};
const ctx=new Proxy({
  imageSmoothingEnabled:false,setTransform(){},clearRect(){},fillRect(){},strokeRect(){},save(){},restore(){},translate(){},scale(){},rotate(){},
  beginPath(){},closePath(){},moveTo(){},lineTo(){},arc(){},ellipse(){},roundRect(){},fill(){},stroke(){},fillText(){},drawImage(){},setLineDash(){},
  createRadialGradient(){return grad},createLinearGradient(){return grad},measureText(t){return{width:String(t).length*8}}
},{get(o,k){return k in o?o[k]:0},set(o,k,v){o[k]=v;return true}});
nodes.get('game').getContext=()=>ctx;
const document={
  querySelector(s){return s.startsWith('#')?(nodes.get(s.slice(1))||makeElement(s)):makeElement(s)},
  querySelectorAll(s){if(s==='.element-chip')return elementChips;if(s==='.skill-chip')return skillChips;return[]},
  getElementById(id){return nodes.get(id)||makeElement(id)},createElement(){return makeElement('created')}
};
const listeners={};
global.window=global;global.document=document;global.devicePixelRatio=1;global.performance={now:()=>0};global.localStorage={getItem:()=>null,setItem(){}};
global.addEventListener=(t,f)=>{(listeners[t]??=[]).push(f)};window.addEventListener=global.addEventListener;window.document=document;window.devicePixelRatio=1;
global.requestAnimationFrame=()=>0;global.cancelAnimationFrame=()=>{};
global.Image=class{constructor(){this.complete=true;this.naturalWidth=1600;this.naturalHeight=900;this.width=1600;this.height=900}set src(v){this._src=v}get src(){return this._src}};
for(const f of ['config.js','network.js','game.js','v5_enhancements.js'])vm.runInThisContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'),{filename:f});
for(const fn of listeners.DOMContentLoaded||[])fn();
const g=window.ElementalSwap.game,C=window.ES4;
function assert(v,msg){if(!v)throw new Error(msg)}
// Safe start: 10 seconds should not lose HP.
const hp0=g.player.hp;for(let i=0;i<600;i++)g.update(1/60,i*16.67);assert(g.player.hp===hp0,`safe zone HP changed ${hp0} -> ${g.player.hp}`);
// Default arrows and X/Y.
assert(g.keys.left==='ArrowLeft'&&g.keys.right==='ArrowRight'&&g.keys.up==='ArrowUp'&&g.keys.down==='ArrowDown','arrow defaults missing');
assert(g.keys.light==='KeyX'&&g.keys.heavy==='KeyY','X/Y defaults missing');
// Command resolution paths.
g.player.onGround=true;g.player.history='XX';assert(g.resolveCommand('Y')==='XXY','XXY command failed');
g.player.history='XY';assert(g.resolveCommand('X')==='XYX'&&g.resolveCommand('Y')==='XYY','XY branches failed');
g.player.history='Y';assert(g.resolveCommand('Y')==='Y2','YY branch failed');
g.input.held.add('ArrowUp');assert(g.resolveCommand('Y')==='UY','up+Y failed');g.input.held.clear();
g.player.dashT=.1;assert(g.resolveCommand('X')==='DASHX','dash X failed');g.player.dashT=0;g.player.onGround=false;assert(g.resolveCommand('Y')==='AIRY','air Y failed');g.player.onGround=true;
// XXY should launch a nearby dummy.
const dummy=g.enemies.find(e=>e.type==='dummy');g.player.x=dummy.x-65;g.player.y=C.GROUND_Y-g.player.h;dummy.x=g.player.x+70;dummy.y=C.GROUND_Y-dummy.h;dummy.vx=dummy.vy=0;dummy.airborne=false;g.player.history='XX';g.startCommand('Y');for(let i=0;i<35;i++)g.updateAttacks(1/60);assert(dummy.airborne||dummy.vy<0,'XXY did not launch dummy');
// Four classes × three skills execute and spend MP.
const skillResults={};for(const id of Object.keys(C.CLASSES)){g.changeClass(id);skillResults[id]=[];for(let i=0;i<3;i++){g.player.mp=g.player.maxMp;g.player.skillCD=[0,0,0];g.player.castT=0;g.player.downT=0;const before=g.player.mp,e0=g.effects.length,a0=g.attacks.length,f0=g.fields.length,s0=g.skillShots.length;g.useSkill(i);assert(g.player.mp<before,`${id} skill ${i} did not spend MP`);skillResults[id].push({fx:g.effects.length-e0,attacks:g.attacks.length-a0,fields:g.fields.length-f0,shots:g.skillShots.length-s0});}}
// Ten elements: shoot then same-key swap. Check concrete effects.
g.changeClass('rift');g.player.castT=0;g.player.downT=0;g.player.x=500;g.player.y=C.GROUND_Y-g.player.h;const elementResults={};for(let i=0;i<C.ELEMENTS.length;i++){const el=C.ELEMENTS[i];g.projectiles=[];g.anchors[el.id]=null;const fields0=g.fields.length,temp0=g.tempSolids.length,hp=g.player.hp;g.elementPress(i);assert(g.projectiles.some(p=>p.element===el.id),`${el.id} did not shoot`);g.elementPress(i);assert((g.statsSwaps||0)>0,`${el.id} did not swap`);elementResults[el.id]={fields:g.fields.length-fields0,temp:g.tempSolids.length-temp0,hpDelta:g.player.hp-hp};}
assert(elementResults.fire.fields>=2,'fire swap did not create two flame fields');
assert(g.tempSolids.some(s=>s.type==='ice'),'ice swap did not create platform');
assert(g.fields.some(f=>f.type==='gravity'),'gravity swap did not create gravity well');
assert(g.fields.some(f=>f.type==='geyser'),'water swap did not create geyser');
assert(g.tempSolids.some(s=>s.type==='vine'),'nature swap did not create vine');
// Gravity actually changes enemy velocity toward pull point.
const target=g.enemies.find(e=>e.type==='slime'&&!e.dead);target.x=900;target.y=C.GROUND_Y-target.h;target.vx=0;const oldV=target.vx;g.pullAt(700,C.GROUND_Y-80,400,1000,.2);assert(target.vx<oldV,'gravity pull did not pull enemy toward left point');
// Fire hit produces burn; wet + lightning produces stun/extra state.
const fire=C.ELEMENTS.find(e=>e.id==='fire'),water=C.ELEMENTS.find(e=>e.id==='water'),lightning=C.ELEMENTS.find(e=>e.id==='lightning');
const fake={vx:200,x:target.x,y:target.y};g.elementHit(target,fire,fake);assert(target.burn>0,'fire did not burn');g.elementHit(target,water,fake);assert(target.wet>0,'water did not wet');g.elementHit(target,lightning,fake);assert(target.stun>0,'lightning did not stun wet enemy');
// Boss phase and break.
const boss=g.enemies.find(e=>e.type==='boss');for(const r of [.95,.60,.25]){boss.hp=boss.maxHp*r;boss.bossPhaseT=0;boss.bossAction=null;g.updateBoss(boss,.016,500);}assert(boss.bossPhase===3,'boss did not enter phase 3');boss.break=1;g.hitEnemy(boss,5,{br:10,big:true,kx:0,ky:0,color:'#fff',label:'test'});assert(boss.breakStun>0,'boss break did not trigger');

// V5 patch and expanded assets/puzzles.
assert(g.v5Patched===true,'V5 patch not installed');
assert(g.puzzles.filter(p=>p.type==='fireAltar').length===3,'V5 fire altars missing');
assert(g.puzzles.filter(p=>p.type==='thermalSeal').length===3,'V5 thermal seals missing');
assert(g.npcs.length>=10,'V5 guide NPCs missing');
// Safe-swap regression: force an anchor inside a one-way platform; player must land above, not below it.
g.tempSolids=[];g.fields=[];const platform=g.solids.find(s=>s.type==='platform');
g.player.x=platform.x-150;g.player.y=platform.y-g.player.h;g.player.vx=g.player.vy=0;
const testEl=C.ELEMENTS.find(e=>e.id==='ice');
const embedded={id:g.id(),element:'ice',x:platform.x+platform.w/2-20,y:platform.y+4,w:40,h:40,vx:0,vy:0,life:8,anchored:true,trail:[],dead:false};
g.projectiles.push(embedded);g.anchors.ice={type:'projectile',id:embedded.id};
g.elementPress(C.ELEMENTS.indexOf(testEl));
assert(g.player.y+g.player.h<=platform.y+1,'safe swap placed player under/inside platform');
assert(g.player.y<C.WORLD_H,'safe swap caused death/fall');
// Summoner really creates entities; beast Q changes actual form.
g.changeClass('summoner');g.player.mp=g.player.maxMp;g.player.skillCD=[0,0,0];g.summonerSkill(0);assert(g.v5Summons.filter(s=>s.kind==='fox').length>=3,'summoner foxes were not summoned');
g.player.skillCD=[0,0,0];g.summonerSkill(1);assert(g.v5Summons.some(s=>s.kind==='guardian'),'guardian was not summoned');
g.player.skillCD=[0,0,0];g.summonerSkill(2);assert(g.v5Summons.some(s=>s.kind==='starbeast'),'star beast was not summoned');
g.changeClass('beast');const form0=g.player.beastForm;g.player.qCD=0;g.useClassSkill();assert(g.player.beastForm!==form0,'beast Q did not transform');
// Puzzle state chains.
for(const a of g.puzzles.filter(p=>p.type==='fireAltar'))a.lit=true;g.updatePuzzles(1/60);assert(g.puzzles.find(p=>p.type==='gate'&&Math.abs(p.x-2320)<100).open,'three altars did not open first gate');
for(const c of g.puzzles.filter(p=>p.type==='conductor'))c.active=true;g.puzzles.find(p=>p.type==='waterWheel').active=true;g.updatePuzzles(1/60);assert(g.puzzles.find(p=>p.type==='gate'&&Math.abs(p.x-4300)<100).open,'zone2 puzzle did not open gate');

// Render paths and HUD should not throw.
g.render();g.updateHUD();
console.log(JSON.stringify({ok:true,version:C.VERSION,enemies:g.enemies.length,zones:C.ZONES.length,elements:C.ELEMENTS.length,puzzles:g.puzzles.length,npcs:g.npcs.length,summons:g.v5Summons.length,beastForm:g.player.beastForm,skillResults,elementResults,bossPhase:boss.bossPhase,bossBreakStun:boss.breakStun,safeHp:g.player.hp},null,2));
