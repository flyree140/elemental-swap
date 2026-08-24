/*
 * Elemental Swap V2 - game.js
 * ============================================================================
 * 這份檔案是遊戲核心。為了讓初學者能改，我把每一大區塊都用中文標題分段。
 *
 * 建議閱讀順序：
 * 01 工具函式 → 02 輸入 → 03 Game 建構 → 04 建立世界 → 05 玩家物理
 * → 06 近戰 Combo → 07 元素 → 08 職業 → 09 敵人 AI → 10 機關
 * → 11 雙人同步 → 12 繪圖 → 13 Debug API。
 *
 * 最重要觀念：
 * 「資料」放 config.js；「規則」才放 game.js。
 * ============================================================================
 */

(function () {
  "use strict";
  const C = window.ES_CONFIG;
  if (!C) throw new Error("ES_CONFIG 未載入，請先載入 js/config.js");

  // --------------------------------------------------------------------------
  // 01. 小工具
  // --------------------------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const sign = (v) => (v < 0 ? -1 : 1);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const cx = (o) => o.x + o.w / 2;
  const cy = (o) => o.y + o.h / 2;
  const now = () => performance.now() / 1000;
  const fmtKey = (code) => ({Space:"SPACE",ShiftLeft:"SHIFT",ShiftRight:"SHIFT",ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓"}[code] || code.replace("Key", "").replace("Digit", ""));

  function colorAlpha(hex, alpha) {
    if (!hex || hex[0] !== "#") return hex;
    const h = hex.slice(1);
    const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  // --------------------------------------------------------------------------
  // 02. 鍵盤輸入：held = 持續按住；pressed = 這一幀剛按下
  // --------------------------------------------------------------------------
  class Input {
    constructor() {
      this.held = new Set();
      this.pressed = new Set();
      this.capture = null;
      window.addEventListener("keydown", (e) => {
        if (this.capture) {
          e.preventDefault();
          this.capture(e.code);
          this.capture = null;
          return;
        }
        if (!this.held.has(e.code)) this.pressed.add(e.code);
        this.held.add(e.code);
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      });
      window.addEventListener("keyup", (e) => this.held.delete(e.code));
      window.addEventListener("blur", () => this.held.clear());
    }
    down(code) { return this.held.has(code); }
    tap(code) { return this.pressed.has(code); }
    endFrame() { this.pressed.clear(); }
  }

  // --------------------------------------------------------------------------
  // 03. Game 建構與全域狀態
  // --------------------------------------------------------------------------
  class Game {
    constructor() {
      this.canvas = $("#game");
      this.ctx = this.canvas.getContext("2d");
      this.input = new Input();
      this.keys = this.loadKeys();
      this.network = new window.ESNetwork();
      this.paused = false;
      this.started = true;
      this.time = 0;
      this.lastFrame = performance.now();
      this.camera = { x: 0, y: 0 };
      this.screenShake = 0;
      this.hitStop = 0;
      this.message = { text: "", t: 0 };
      this.combo = { hits: 0, damage: 0, timer: 0 };
      this.projectiles = [];
      this.enemyShots = [];
      this.enemies = [];
      this.platforms = [];
      this.tempPlatforms = [];
      this.hazards = [];
      this.puzzles = [];
      this.npcs = [];
      this.effects = [];
      this.turrets = [];
      this.remote = null;
      this.checkpointX = 180;
      this.currentZone = 0;
      this.lastElement = null;
      this.elementHistory = [];
      this.puzzleFlags = new Set();
      this.stats = { kills: 0, swaps: 0, maxCombo: 0 };
      this.debugEnabled = true;

      this.player = this.makePlayer(220, C.GROUND_Y - C.PLAYER.height, "rift");
      this.buildWorld();
      this.bindUI();
      this.bindNetwork();
      this.resize();
      window.addEventListener("resize", () => this.resize());
      requestAnimationFrame((t) => this.loop(t));
    }

    makePlayer(x, y, classId) {
      const cl = C.CLASSES[classId];
      return {
        x, y, w: C.PLAYER.width, h: C.PLAYER.height,
        vx: 0, vy: 0, dir: 1, onGround: false, jumps: 0,
        classId, hp: cl.maxHp, maxHp: cl.maxHp, mp: cl.maxMp, maxMp: cl.maxMp,
        shield: 0, invuln: 0, superArmor: 0, phase: 0, lowGravity: 0,
        dashT: 0, dashCooldown: 0, attackT: 0, attackStep: 0, attackKind: "",
        comboInputT: 0, skillCD: [0,0,0], qCD: 0,
        beastForm: "wolf", beastBuff: 0, rift: 0, summonFrenzy: 0,
        anim: "idle", respawnT: 0
      };
    }

    loadKeys() {
      try {
        const saved = JSON.parse(localStorage.getItem("esv2_keys") || "null");
        return Object.assign({}, C.DEFAULT_KEYS, saved || {});
      } catch (_) { return Object.assign({}, C.DEFAULT_KEYS); }
    }

    saveKeys() {
      localStorage.setItem("esv2_keys", JSON.stringify(this.keys));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(960, Math.floor(rect.width * dpr));
      this.canvas.height = Math.max(540, Math.floor(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.viewW = rect.width;
      this.viewH = rect.height;
    }

    // ------------------------------------------------------------------------
    // 04. 建立世界：這裡放關卡物件。正式大型專案可改成 JSON / Tiled map。
    // ------------------------------------------------------------------------
    buildWorld() {
      this.platforms.length = 0;
      this.enemies.length = 0;
      this.hazards.length = 0;
      this.puzzles.length = 0;
      this.npcs = C.NPCS.map(n => ({...n, y: C.GROUND_Y - 60, w: 42, h: 60}));

      // 底部地面分成多段，故意留洞讓玩家使用二段跳/換位。
      const groundSegments = [
        [0,1750],[1880,2550],[2670,3500],[3650,4480],[4620,5400],[5580,6320],
        [6480,7350],[7480,8450],[8580,9450],[9600,10400],[10560,11450],[11600,12550],
        [12700,13900],[14050,15100],[15250,16400],[16550,18000]
      ];
      for (const [a,b] of groundSegments) this.platforms.push({x:a,y:C.GROUND_Y,w:b-a,h:190,type:"ground"});

      // 高低平台：每區都有多路徑，讓換位和空中 Combo 有用途。
      const addP = (x,y,w,type="platform",extra={}) => this.platforms.push({x,y,w,h:24,type,...extra});
      [
        [520,590,260],[900,510,210],[1260,430,250],[2100,565,270],[2380,465,180],[2920,570,280],
        [3240,450,220],[3880,560,250],[4210,410,240],[4730,550,220],[5030,450,250],[5350,350,200],
        [5810,570,310],[6200,440,210],[6700,590,270],[7050,480,230],[7350,370,200],[7850,560,280],
        [8200,430,250],[8700,560,230],[9070,430,210],[9470,330,240],[9890,570,280],[10300,445,240],
        [10800,350,190],[11300,560,250],[11700,430,260],[12120,330,200],[12600,570,270],[13000,450,240],
        [13400,350,210],[13950,570,250],[14350,440,220],[14720,330,190],[15150,560,250],[15540,420,200],
        [16000,580,280],[16380,470,220],[16700,350,210],[17120,560,260],[17500,430,220]
      ].forEach(p => addP(...p));

      // 移動平台
      addP(3400, 330, 180, "moving", {baseX:3400, range:260, speed:1.15, phase:0});
      addP(7600, 280, 180, "moving", {baseX:7600, range:350, speed:0.9, phase:1});
      addP(11900, 250, 190, "moving", {baseX:11900, range:300, speed:1.3, phase:2});

      // 障礙物與機關
      this.hazards.push(
        {type:"spikes",x:1500,y:680,w:180,h:30}, {type:"spikes",x:3650,y:680,w:220,h:30},
        {type:"water",x:2250,y:650,w:350,h:60,frozen:0}, {type:"water",x:5650,y:650,w:500,h:60,frozen:0},
        {type:"firewall",x:3220,y:540,w:38,h:170,active:true}, {type:"firewall",x:10180,y:500,w:40,h:210,active:true},
        {type:"laser",x:11480,y:430,w:18,h:280,active:true,phase:0},
        {type:"laser",x:13280,y:350,w:18,h:360,active:true,phase:1.2},
        {type:"crusher",x:14580,y:170,w:100,h:230,baseY:170,phase:0},
        {type:"crusher",x:14960,y:120,w:100,h:260,baseY:120,phase:1.1}
      );

      this.puzzles.push(
        {type:"torch",x:1180,y:370,w:34,h:60,lit:false},
        {type:"lightBridge",x:9200,y:535,w:420,h:20,revealed:false},
        {type:"shadowWall",x:10450,y:390,w:42,h:320},
        {type:"seed",x:7000,y:665,w:35,h:45,grown:false},
        {type:"plate",x:4950,y:690,w:100,h:20,pressed:false},
        {type:"crate",x:4700,y:645,w:55,h:65,vx:0},
        {type:"socket",x:12850,y:630,w:72,h:80,charged:false},
        {type:"gravityCore",x:12400,y:570,w:50,h:50,vx:0,vy:0},
        {type:"brittleWall",x:15480,y:430,w:70,h:280,broken:false}
      );

      // 檢查點
      [200, 2250, 4550, 6750, 9050, 11300, 13600, 16000].forEach((x,i) => {
        this.puzzles.push({type:"checkpoint",x,y:C.GROUND_Y-90,w:30,h:90,index:i,active:i===0});
      });

      // 敵人配置：不同區域混搭不同 AI。
      const spawns = [
        [900,"slime"],[1320,"slime"],[2050,"archer"],[2810,"shield"],[3200,"bat"],[4050,"turret"],
        [4850,"slime"],[5250,"shield"],[6100,"golem"],[6870,"bat"],[7310,"archer"],[8050,"mage"],
        [8750,"shield"],[9360,"mage"],[10080,"turret"],[10900,"bat"],[11650,"golem"],[12250,"mage"],
        [13050,"turret"],[13800,"shield"],[14200,"mage"],[15000,"golem"],[15850,"archer"],[16450,"golem"],
        [17200,"boss"]
      ];
      for (const [x,t] of spawns) this.spawnEnemy(t,x,t === "bat" ? 330 : C.GROUND_Y-58);
    }

    spawnEnemy(type, x, y) {
      const t = C.ENEMIES[type];
      const h = type === "boss" ? 130 : type === "golem" ? 90 : 58;
      const w = type === "boss" ? 110 : type === "golem" ? 72 : 54;
      this.enemies.push({
        id: Math.random().toString(36).slice(2), type, name:t.name,
        x, y:y-(h-58), w, h, vx:0, vy:0, dir:-1,
        hp:t.hp, maxHp:t.hp, damage:t.damage, speed:t.speed,
        aiT:rand(0,1), hurtT:0, stun:0, slow:0, root:0, wet:0, burn:0,
        armorBreak:0, cursed:0, marked:null, markT:0, dead:false,
        superArmor:type==="boss" || type==="golem", phase:0
      });
    }

    // ------------------------------------------------------------------------
    // 05. 主迴圈與玩家物理
    // ------------------------------------------------------------------------
    loop(ts) {
      let dt = Math.min(0.033, (ts - this.lastFrame) / 1000 || 0);
      this.lastFrame = ts;
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        dt *= 0.08;
      }
      if (!this.paused) this.update(dt, ts);
      this.render();
      this.input.endFrame();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt, tsMs) {
      this.time += dt;
      this.updateGlobalInput();
      this.updatePlayer(dt);
      this.updateProjectiles(dt);
      this.updateEnemies(dt);
      this.updatePuzzles(dt);
      this.updateEffects(dt);
      this.updateNetwork(tsMs);
      this.updateCamera(dt);
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) this.combo = {hits:0,damage:0,timer:0};
      if (this.message.t > 0) this.message.t -= dt;
      this.updateHUD();
    }

    action(name, tap=false) {
      const code = this.keys[name];
      return tap ? this.input.tap(code) : this.input.down(code);
    }

    updateGlobalInput() {
      if (this.action("pause", true)) this.paused = !this.paused;
      if (this.action("help", true)) this.togglePanel("helpPanel");
      if (this.action("keyConfig", true)) this.openKeyConfig();
      if (this.action("reset", true)) this.respawn();
      if (this.action("clearAnchor", true)) {
        this.projectiles.forEach(p => p.anchor = false);
        this.say("已清除所有元素錨點");
      }
    }

    updatePlayer(dt) {
      const p = this.player;
      const cl = C.CLASSES[p.classId];
      p.invuln = Math.max(0, p.invuln-dt); p.superArmor = Math.max(0,p.superArmor-dt);
      p.phase = Math.max(0,p.phase-dt); p.lowGravity = Math.max(0,p.lowGravity-dt);
      p.dashCooldown = Math.max(0,p.dashCooldown-dt); p.attackT = Math.max(0,p.attackT-dt);
      p.comboInputT = Math.max(0,p.comboInputT-dt); p.qCD = Math.max(0,p.qCD-dt);
      p.beastBuff = Math.max(0,p.beastBuff-dt); p.summonFrenzy = Math.max(0,p.summonFrenzy-dt);
      p.skillCD = p.skillCD.map(x => Math.max(0,x-dt));
      p.mp = Math.min(p.maxMp, p.mp + dt * 3.8);

      let speed = C.PLAYER.moveSpeed * cl.moveScale;
      if (p.classId === "beast" && p.beastForm === "wolf") speed *= 1.22;
      if (p.classId === "beast" && p.beastForm === "bear") speed *= 0.82;

      let move = 0;
      if (this.action("left")) move -= 1;
      if (this.action("right")) move += 1;
      if (move) p.dir = move;

      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.dir * C.PLAYER.dashSpeed * (p.classId === "beast" && p.beastForm === "wolf" ? 1.18 : 1);
        p.anim = "dash";
      } else if (p.attackT < 0.22 || p.attackT === 0) {
        p.vx = lerp(p.vx, move * speed, Math.min(1, dt*11));
      }

      if (this.action("dash", true) && p.dashCooldown <= 0) {
        p.dashT = C.PLAYER.dashTime;
        p.dashCooldown = 0.38;
        p.invuln = Math.max(p.invuln, 0.08);
        this.fx(cx(p),cy(p),"dash", "#aee6ff", 0.2);
      }

      if (this.action("jump", true)) {
        const maxJumps = p.classId === "beast" && p.beastForm === "eagle" ? 3 : 2;
        if (p.onGround || p.jumps < maxJumps) {
          p.vy = -C.PLAYER.jumpPower * (p.classId === "beast" && p.beastForm === "eagle" ? 1.05 : 1);
          p.onGround = false;
          p.jumps++;
          this.fx(cx(p),p.y+p.h,"jump","#c7f0ff",0.22);
        }
      }

      // 攻擊與技能
      if (this.action("lightAttack", true)) this.doCommand("light");
      if (this.action("heavyAttack", true)) this.doCommand("heavy");
      if (this.action("skill1", true)) this.useSkill(0);
      if (this.action("skill2", true)) this.useSkill(1);
      if (this.action("skill3", true)) this.useSkill(2);
      if (this.action("classSkill", true)) this.useClassSkill();

      for (let i=0;i<10;i++) if (this.action(`element${i+1}`, true)) this.elementKey(i);
      if (this.action("interact", true)) this.interactNPC();

      // 重力與位移
      let gravityScale = p.lowGravity > 0 ? 0.28 : 1;
      if (p.classId === "beast" && p.beastForm === "eagle" && p.vy > 0) gravityScale *= 0.72;
      p.vy = Math.min(C.PLAYER.maxFallSpeed, p.vy + C.GRAVITY * gravityScale * dt);
      p.x += p.vx * dt;
      this.resolveHorizontal(p);
      p.y += p.vy * dt;
      p.onGround = false;
      this.resolveVertical(p);
      p.x = clamp(p.x,0,C.WORLD_WIDTH-p.w);

      if (p.y > C.WORLD_HEIGHT + 160) this.respawn();
      this.checkHazardDamage(dt);

      // 召喚師的浮光狐：用 effects 中的 pet 畫，但邏輯在這裡處理追擊。
      if (p.classId === "summoner") this.updatePet(dt);
      this.updatePlayerTurrets(dt);
    }

    solidRects() {
      const arr = [...this.platforms, ...this.tempPlatforms.filter(p=>p.t>0)];
      for (const z of this.puzzles) {
        if (z.type === "lightBridge" && z.revealed) arr.push(z);
        if (z.type === "shadowWall" && this.player.phase <= 0) arr.push(z);
        if (z.type === "brittleWall" && !z.broken) arr.push(z);
        if (z.type === "crate") arr.push(z);
      }
      for (const h of this.hazards) if (h.type === "water" && h.frozen > 0) arr.push({x:h.x,y:h.y-12,w:h.w,h:18,type:"ice"});
      return arr;
    }

    resolveHorizontal(o) {
      for (const s of this.solidRects()) {
        if (!rectHit(o,s)) continue;
        if (o.vx > 0) o.x = s.x - o.w;
        else if (o.vx < 0) o.x = s.x + s.w;
        o.vx = 0;
      }
    }

    resolveVertical(o) {
      for (const s of this.solidRects()) {
        if (!rectHit(o,s)) continue;
        if (o.vy > 0) {
          o.y = s.y - o.h; o.vy = 0; o.onGround = true; o.jumps = 0;
          if (s.type === "moving") o.x += Math.cos(this.time*s.speed+s.phase)*s.range*s.speed*0.01;
        } else if (o.vy < 0) { o.y = s.y + s.h; o.vy = 0; }
      }
    }

    // ------------------------------------------------------------------------
    // 06. 近戰 Command Combo
    // Z Z Z Z：快速連斬；Z Z X：挑空；空中 X：下砸；Dash+Z：衝刺攻擊。
    // ------------------------------------------------------------------------
    doCommand(kind) {
      const p = this.player;
      if (p.attackT > 0.34) return;
      const inAir = !p.onGround;
      const isDash = p.dashT > 0;
      let step = p.comboInputT > 0 ? p.attackStep + 1 : 1;
      p.attackStep = Math.min(step, 4);
      p.comboInputT = 0.48;
      p.attackKind = kind;

      let damage=9, range=78, knockX=120, knockY=0, mpGain=3, duration=0.25;
      let label="快斬";
      if (kind === "heavy") { damage=18; range=92; knockX=210; duration=0.36; label="重斬"; }
      if (kind === "light" && p.attackStep >= 4) { damage=16; knockX=300; label="終結斬"; }
      if (kind === "heavy" && p.attackStep >= 3) { damage=20; knockY=-520; knockX=90; label="逆界挑空"; }
      if (inAir && kind === "light") { damage=10; range=82; knockY=-80; label="空中追斬"; }
      if (inAir && kind === "heavy") { damage=23; range=72; knockX=50; knockY=250; label="墜擊"; p.vy = 650; }
      if (isDash && kind === "light") { damage=14; range=120; knockX=340; label="衝刺斬"; }

      // 職業差異
      if (p.classId === "rift") { damage *= 1.08; p.rift = Math.min(100,p.rift+6); }
      if (p.classId === "beast" && p.beastForm === "bear") { damage *= 1.32; knockX *= 1.3; p.superArmor=0.28; }
      if (p.classId === "beast" && p.beastForm === "wolf") { duration *= 0.78; }
      if (p.classId === "beast" && p.beastForm === "eagle" && inAir) damage *= 1.25;

      p.attackT = duration;
      const hitbox = {
        x: p.dir>0 ? p.x+p.w-5 : p.x-range+5,
        y: p.y + (inAir ? 8 : 12), w:range, h:p.h-18
      };
      const hits = this.meleeHit(hitbox, damage, knockX*p.dir, knockY, label);
      if (hits) p.mp = Math.min(p.maxMp,p.mp + mpGain*hits);
      this.fx(cx(hitbox),cy(hitbox),"slash", kind==="heavy"?"#ffd09a":"#d7f1ff",0.16,{dir:p.dir});
    }

    meleeHit(box, damage, kx, ky, label) {
      let hits=0;
      for (const e of this.enemies) {
        if (e.dead || !rectHit(box,e)) continue;
        this.damageEnemy(e,damage,kx,ky,label);
        hits++;
      }
      return hits;
    }

    damageEnemy(e, dmg, kx=0, ky=0, label="攻擊") {
      if (e.dead) return;
      // 盾兵面向攻擊來源時減傷，破甲時失效。
      if (e.type === "shield" && e.armorBreak <= 0) {
        const attackerLeft = cx(this.player) < cx(e);
        const shieldFacesAttacker = (attackerLeft && e.dir < 0) || (!attackerLeft && e.dir > 0);
        if (shieldFacesAttacker) dmg *= 0.28;
      }
      if (e.armorBreak > 0) dmg *= 1.35;
      e.hp -= dmg; e.hurtT=0.16;
      if (!e.superArmor || e.stun>0) { e.vx += kx; e.vy += ky; }
      this.combo.hits++; this.combo.damage += dmg; this.combo.timer=1.7;
      this.stats.maxCombo = Math.max(this.stats.maxCombo,this.combo.hits);
      this.hitStop = Math.max(this.hitStop, 0.035);
      this.screenShake = Math.max(this.screenShake, Math.min(9,Math.abs(dmg)*0.15));
      this.fx(cx(e),cy(e),"hit","#ffffff",0.18,{text:`${Math.round(dmg)}`});
      if (this.player.classId === "rift") this.player.rift = Math.min(100,this.player.rift+2.5);
      if (e.hp <= 0) {
        e.dead=true; this.stats.kills++;
        this.fx(cx(e),cy(e),"burst",C.ENEMIES[e.type].color,0.5);
        this.say(`${e.name} 擊破`);
      }
    }

    // ------------------------------------------------------------------------
    // 07. 元素核心：同一個數字鍵第一次發射，再按一次進行換位。
    // ------------------------------------------------------------------------
    elementKey(index) {
      const el = C.ELEMENTS[index];
      const candidate = this.findSwapTarget(el.id);
      if (candidate) this.swapWith(candidate, el);
      else this.fireElement(el);
    }

    fireElement(el) {
      const p=this.player;
      const aimY = this.action("aimUp") ? -0.72 : this.action("aimDown") ? 0.72 : 0;
      const mag = Math.hypot(1,aimY);
      let dx=p.dir/mag, dy=aimY/mag;
      const shot={
        id:Math.random().toString(36).slice(2), type:"element", element:el.id,
        x:cx(p)-el.size/2 + p.dir*24, y:cy(p)-el.size/2,
        w:el.size*2,h:el.size*2,vx:dx*el.speed,vy:dy*el.speed,
        t:5,anchor:true,bounces:el.id==="water"?2:0,owner:"local"
      };
      this.projectiles.push(shot);
      this.lastElement = el.id;
      this.elementHistory.push(el.id);
      if (this.elementHistory.length>4) this.elementHistory.shift();
      this.fx(cx(shot),cy(shot),"muzzle",el.color,0.2);
    }

    findSwapTarget(elementId) {
      // 優先：最近的同元素標記敵人；其次：同元素飛行錨點。
      const marked = this.enemies.filter(e=>!e.dead && e.marked===elementId && e.markT>0).sort((a,b)=>dist(this.player,a)-dist(this.player,b))[0];
      if (marked) return {kind:"enemy",ref:marked};
      const anchors = this.projectiles.filter(p=>p.anchor && p.element===elementId && p.t>0).sort((a,b)=>dist(this.player,a)-dist(this.player,b));
      if (anchors[0]) return {kind:"projectile",ref:anchors[0]};
      return null;
    }

    swapWith(target, el) {
      const p=this.player, r=target.ref;
      const old={x:p.x,y:p.y};
      const tx = target.kind==="enemy" ? r.x : r.x-r.w/2+p.w/2;
      const ty = target.kind==="enemy" ? r.y : r.y-r.h/2+p.h/2;
      if (target.kind==="enemy") {
        const ex=r.x, ey=r.y; r.x=old.x; r.y=old.y; p.x=ex; p.y=ey;
      } else {
        p.x=clamp(tx,0,C.WORLD_WIDTH-p.w); p.y=ty; r.x=old.x; r.y=old.y; r.anchor=false; r.t=0.15;
      }
      p.vx *= 0.35; p.vy *= 0.35; p.invuln=Math.max(p.invuln,0.18);
      this.stats.swaps++;
      this.fx(old.x+p.w/2,old.y+p.h/2,"swap",el.color,0.45);
      this.fx(cx(p),cy(p),"swap",el.color,0.45);
      this.applySwapEffect(el,old,target);
      this.checkElementCombo(el.id);
      if (this.network.connected) this.network.send({type:"swap", element:el.id, x:p.x,y:p.y});
    }

    applySwapEffect(el,old,target) {
      const p=this.player;
      switch(el.id) {
        case "fire":
          this.explosion(old.x+p.w/2,old.y+p.h/2,150,28,"火焰換位爆");
          this.explosion(cx(p),cy(p),150,28,"火焰換位爆");
          break;
        case "ice":
          this.tempPlatforms.push({x:old.x-25,y:old.y+p.h-12,w:105,h:18,t:6,type:"ice"});
          this.say("冰霜換位：留下冰台");
          break;
        case "lightning":
          this.chainLightning(cx(p),cy(p),4,24);
          break;
        case "wind":
          p.vx=p.dir*900; p.vy=Math.min(p.vy,-120); p.lowGravity=1.0;
          this.say("疾風換位：風衝");
          break;
        case "earth":
          this.tempPlatforms.push({x:old.x,y:old.y+18,w:72,h:95,t:8,type:"earth"});
          p.superArmor=1.8;
          this.say("岩土換位：岩柱＋霸體");
          break;
        case "water":
          p.hp=Math.min(p.maxHp,p.hp+22); p.vy=-620;
          this.effects.push({type:"fountain",x:old.x+p.w/2,y:old.y+p.h,t:2,color:el.color});
          this.say("流水換位：治療＋噴泉跳");
          break;
        case "light":
          p.hp=Math.min(p.maxHp,p.hp+18); p.shield=Math.max(p.shield,35);
          for (const z of this.puzzles) if (z.type==="lightBridge" && Math.abs(z.x-p.x)<900) z.revealed=true;
          this.say("聖光換位：治療＋護盾＋顯形");
          break;
        case "shadow":
          p.phase=1.6; p.invuln=Math.max(p.invuln,0.8);
          this.effects.push({type:"clone",x:old.x,y:old.y,t:2,color:el.color});
          this.say("暗影換位：相位無敵＋影分身");
          break;
        case "nature":
          this.tempPlatforms.push({x:old.x+15,y:Math.min(old.y+40,C.GROUND_Y-260),w:24,h:260,t:10,type:"vine",climb:true});
          this.say("自然換位：生成藤蔓");
          break;
        case "gravity":
          p.lowGravity=3.5;
          this.effects.push({type:"gravityWell",x:old.x+p.w/2,y:old.y+p.h/2,t:3.5,color:el.color,r:230});
          this.say("引力換位：低重力＋引力井");
          break;
      }
      if (p.classId === "rift" && p.rift >= 25) {
        p.rift-=25;
        this.explosion(cx(p),cy(p),110,20,"裂隙追斬");
      }
    }

    checkElementCombo(current) {
      const h=this.elementHistory;
      const prev=h.length>=2 ? h[h.length-2] : null;
      if (!prev) return;
      if (prev==="ice" && current==="fire") {
        this.say("元素連鎖：熱震！"); this.explosion(cx(this.player),cy(this.player),260,46,"熱震");
        for (const z of this.puzzles) if (z.type==="brittleWall" && dist(this.player,z)<420) z.broken=true;
      } else if (prev==="water" && current==="lightning") {
        this.say("元素連鎖：導電暴潮！");
        for (const e of this.enemies) if(!e.dead && e.wet>0 && dist(this.player,e)<650) this.damageEnemy(e,36,80*this.player.dir,-80,"導電暴潮");
      } else if (prev==="fire" && current==="wind") {
        this.say("元素連鎖：烈風火環！"); this.explosion(cx(this.player),cy(this.player),320,35,"烈風火環");
      } else if (prev==="earth" && current==="nature") {
        this.say("元素連鎖：岩根隆起！");
        this.tempPlatforms.push({x:this.player.x-80,y:this.player.y+this.player.h-35,w:260,h:40,t:12,type:"root"});
      } else if ((prev==="light"&&current==="shadow")||(prev==="shadow"&&current==="light")) {
        this.say("元素連鎖：明暗蝕相！"); this.player.phase=2.2; this.player.hp=Math.min(this.player.maxHp,this.player.hp+35);
      } else if (prev==="gravity" && current==="wind") {
        this.say("元素連鎖：引力彈弓！"); this.player.lowGravity=4; this.player.vx=this.player.dir*1200; this.player.vy=-260;
      }
    }

    updateProjectiles(dt) {
      for (const s of this.projectiles) {
        s.t-=dt;
        const el=C.ELEMENTS.find(x=>x.id===s.element);
        s.vy += el.gravity*dt;
        if (s.element==="gravity") {
          for (const e of this.enemies) if(!e.dead && dist(s,e)<220) { const d=cx(s)-cx(e); e.vx += sign(d)*220*dt; }
        }
        s.x+=s.vx*dt; s.y+=s.vy*dt;
        // 水球可彈牆兩次。
        if (s.element==="water" && (s.x<0 || s.x>C.WORLD_WIDTH-s.w) && s.bounces>0) { s.vx*=-1; s.bounces--; }
        // 擊中敵人
        for (const e of this.enemies) {
          if (e.dead || s.t<=0 || !rectHit(s,e)) continue;
          this.applyElementHit(e,el,s);
          if (!["light","shadow"].includes(s.element)) s.t=0;
        }
        // 機關
        this.handlePuzzleElementHit(s,el);
        if (s.y>C.WORLD_HEIGHT+200 || s.x<-200 || s.x>C.WORLD_WIDTH+200) s.t=0;
      }
      this.projectiles=this.projectiles.filter(s=>s.t>0);
    }

    applyElementHit(e,el,s) {
      let dmg=el.damage;
      e.marked=el.id; e.markT=el.markDuration;
      switch(el.id) {
        case "fire": e.burn=4.5; break;
        case "ice": e.slow=5; e.vx*=0.25; break;
        case "lightning": e.stun=0.7; if(e.wet>0) dmg*=2.1; break;
        case "wind": e.vx+=this.player.dir*650; break;
        case "earth": e.armorBreak=6; e.stun=Math.max(e.stun,0.25); break;
        case "water": e.wet=8; break;
        case "light": if(e.type==="mage" || e.cursed>0) dmg*=1.8; break;
        case "shadow": e.cursed=7; break;
        case "nature": e.root=2.5; break;
        case "gravity": e.vx+=(cx(this.player)-cx(e))*0.8; break;
      }
      this.damageEnemy(e,dmg,s.vx*0.18,s.vy*0.08,`${el.name}命中`);
      this.fx(cx(e),cy(e),"elementHit",el.color,0.3,{text:el.glyph});
      if (el.id==="lightning" && e.wet>0) this.chainLightning(cx(e),cy(e),3,18,e);
    }

    chainLightning(x,y,count,damage,skip=null) {
      let list=this.enemies.filter(e=>!e.dead&&e!==skip&&Math.hypot(cx(e)-x,cy(e)-y)<360).sort((a,b)=>Math.hypot(cx(a)-x,cy(a)-y)-Math.hypot(cx(b)-x,cy(b)-y)).slice(0,count);
      for(const e of list){ this.damageEnemy(e,damage,90*sign(cx(e)-x),-70,"連鎖雷電"); e.stun=Math.max(e.stun,0.5); this.fx(cx(e),cy(e),"lightning","#ffe45c",0.25); }
    }

    explosion(x,y,r,damage,label) {
      for(const e of this.enemies){ if(e.dead) continue; const d=Math.hypot(cx(e)-x,cy(e)-y); if(d<r) this.damageEnemy(e,damage*(1-d/r*0.45),sign(cx(e)-x)*380,-180,label); }
      this.effects.push({type:"explosion",x,y,r,t:0.42,color:"#ffb54a"});
      this.screenShake=Math.max(this.screenShake,10);
    }

    // ------------------------------------------------------------------------
    // 08. 技能與四職業
    // ------------------------------------------------------------------------
    skillCost(index){ return [25,38,70][index]; }
    useSkill(index) {
      const p=this.player, cost=this.skillCost(index);
      if(p.skillCD[index]>0 || p.mp<cost) { if(p.mp<cost) this.say("MP 不足"); return; }
      p.mp-=cost; p.skillCD[index]=[2.4,5.2,12][index];
      const id=p.classId;
      if(id==="rift") this.riftSkill(index);
      else if(id==="summoner") this.summonerSkill(index);
      else if(id==="beast") this.beastSkill(index);
      else this.artificerSkill(index);
    }

    riftSkill(i){
      const p=this.player;
      if(i===0){ this.say("裂空斬"); p.vx=p.dir*620; this.meleeHit({x:p.dir>0?p.x:p.x-170,y:p.y-10,w:220,h:95},34,520*p.dir,-80,"裂空斬"); this.fx(cx(p)+p.dir*90,cy(p),"bigSlash","#8ad8ff",0.35); }
      if(i===1){ this.say("逆界挑空"); this.meleeHit({x:p.x-80,y:p.y-35,w:210,h:140},42,80*p.dir,-760,"逆界挑空"); p.vy=-480; }
      if(i===2){ this.say("十相終刃"); for(let n=0;n<6;n++) setTimeout(()=>this.explosion(cx(p)+p.dir*(100+n*65),cy(p)-20,115,24,"十相終刃"),n*70); }
    }

    summonerSkill(i){
      const p=this.player;
      if(i===0){ this.say("靈矢列陣"); for(let n=0;n<5;n++) this.projectiles.push({id:"spirit"+Math.random(),type:"spirit",element:"light",x:cx(p),y:cy(p)-40+n*18,w:12,h:12,vx:p.dir*(420+n*28),vy:(n-2)*35,t:2.4,anchor:false,bounces:0,owner:"local"}); }
      if(i===1){ this.say("契約護環"); p.shield=Math.max(p.shield,65); p.hp=Math.min(p.maxHp,p.hp+28); }
      if(i===2){ this.say("大召喚・星獸"); p.summonFrenzy=10; this.effects.push({type:"starBeast",x:p.x,y:p.y,t:10,color:"#ffd978"}); }
    }

    beastSkill(i){
      const p=this.player;
      if(i===0){ this.say("狼牙連襲"); p.vx=p.dir*850; for(let n=0;n<3;n++) this.meleeHit({x:p.dir>0?p.x:p.x-150,y:p.y,w:200,h:80},18+n*3,280*p.dir,-60,"狼牙連襲"); }
      if(i===1){ this.say("蒼鷹墜擊"); p.vy=-650; p.lowGravity=1.1; setTimeout(()=>this.explosion(cx(p),cy(p)+80,180,34,"蒼鷹墜擊"),320); }
      if(i===2){ this.say("百獸王化"); p.beastBuff=12; p.superArmor=12; p.lowGravity=12; }
    }

    artificerSkill(i){
      const p=this.player;
      if(i===0){ this.say("磁軌衝擊"); const box={x:p.dir>0?p.x:p.x-620,y:p.y+10,w:650,h:48}; for(const e of this.enemies) if(!e.dead&&rectHit(box,e)) this.damageEnemy(e,44,520*p.dir,-80,"磁軌衝擊"); this.fx(cx(p)+p.dir*300,cy(p),"rail","#62f1ff",0.32,{dir:p.dir}); }
      if(i===1){ this.say("彈射平台"); this.tempPlatforms.push({x:p.x-25,y:p.y+p.h+10,w:105,h:16,t:10,type:"spring"}); p.vy=-760; }
      if(i===2){ this.say("超載回路"); for(const t of this.turrets) t.overload=9; p.shield=Math.max(p.shield,45); }
    }

    useClassSkill(){
      const p=this.player;if(p.qCD>0)return;
      if(p.classId==="rift"){
        if(p.rift<35){this.say("裂隙值不足 35");return;} p.rift-=35;p.qCD=2.5;this.say("裂隙爆發");this.explosion(cx(p),cy(p),210,38,"裂隙爆發");p.invuln=0.5;
      } else if(p.classId==="summoner"){
        p.qCD=3;p.summonFrenzy=Math.max(p.summonFrenzy,4);this.say("靈獸指令：集中攻擊");
      } else if(p.classId==="beast"){
        p.qCD=0.35; const forms=["wolf","eagle","bear"];p.beastForm=forms[(forms.indexOf(p.beastForm)+1)%3];this.say(`百獸姿態：${{wolf:"狼",eagle:"鷹",bear:"熊"}[p.beastForm]}`);
      } else {
        p.qCD=1.2;if(this.turrets.length>=3)this.turrets.shift();this.turrets.push({x:p.x-p.dir*35,y:p.y+20,w:34,h:40,t:30,shotT:0,overload:0});this.say("部署符文炮台");
      }
    }

    updatePet(dt){
      const p=this.player;
      if(!this.pet) this.pet={x:p.x-55,y:p.y-25,shotT:0};
      this.pet.x=lerp(this.pet.x,p.x-p.dir*70,Math.min(1,dt*4));
      this.pet.y=lerp(this.pet.y,p.y-45+Math.sin(this.time*4)*14,Math.min(1,dt*5));
      this.pet.shotT-=dt;
      const target=this.enemies.filter(e=>!e.dead&&dist(this.pet,e)<560).sort((a,b)=>dist(this.pet,a)-dist(this.pet,b))[0];
      if(target&&this.pet.shotT<=0){this.pet.shotT=p.summonFrenzy>0?0.32:0.85;this.damageEnemy(target,p.summonFrenzy>0?14:7,70*sign(cx(target)-this.pet.x),-25,"浮光狐");this.fx(cx(target),cy(target),"spark","#ffd978",0.16);}
    }

    updatePlayerTurrets(dt){
      for(const t of this.turrets){t.t-=dt;t.shotT-=dt;t.overload=Math.max(0,t.overload-dt);const target=this.enemies.filter(e=>!e.dead&&Math.abs(cx(e)-t.x)<650).sort((a,b)=>Math.abs(cx(a)-t.x)-Math.abs(cx(b)-t.x))[0];if(target&&t.shotT<=0){t.shotT=t.overload>0?0.25:0.7;this.damageEnemy(target,t.overload>0?13:8,80*sign(cx(target)-t.x),-25,"符文炮台");this.fx(t.x,t.y,"spark","#65e8ff",0.15);}}
      this.turrets=this.turrets.filter(t=>t.t>0);
    }

    // ------------------------------------------------------------------------
    // 09. 敵人 AI：8 類差異化行為
    // ------------------------------------------------------------------------
    updateEnemies(dt){
      const p=this.player;
      for(const e of this.enemies){
        if(e.dead)continue;
        e.hurtT=Math.max(0,e.hurtT-dt);e.stun=Math.max(0,e.stun-dt);e.slow=Math.max(0,e.slow-dt);e.root=Math.max(0,e.root-dt);e.wet=Math.max(0,e.wet-dt);e.armorBreak=Math.max(0,e.armorBreak-dt);e.cursed=Math.max(0,e.cursed-dt);e.markT=Math.max(0,e.markT-dt);if(e.markT<=0)e.marked=null;
        if(e.burn>0){e.burn-=dt;e.hp-=4.2*dt;if(e.hp<=0){e.dead=true;this.stats.kills++;}}
        e.aiT-=dt;
        const dx=cx(p)-cx(e), ad=Math.abs(dx), dir=sign(dx); e.dir=dir;
        if(e.stun<=0){
          const scale=e.slow>0?0.38:1;
          if(e.type==="melee") e.vx=ad<700?dir*e.speed*scale:e.vx*0.9;
          else if(e.type==="ranged") { e.vx=(ad<260?-dir:ad>520?dir:0)*e.speed*scale; if(ad<620&&e.aiT<=0){e.aiT=1.5;this.enemyShoot(e,260,0);} }
          else if(e.type==="shield") e.vx=ad<650?dir*e.speed*scale:e.vx*0.9;
          else if(e.type==="flying") { e.vx=dir*e.speed*scale; e.vy += (p.y-90-e.y)*dt*2.2; e.y+=e.vy*dt; if(ad<180&&e.aiT<=0){e.aiT=1.2;e.vy=260;} }
          else if(e.type==="turret") {e.vx=0;if(ad<760&&e.aiT<=0){e.aiT=1.25;this.enemyShoot(e,330,(cy(p)-cy(e))*0.7);}}
          else if(e.type==="mage") {if(e.aiT<=0){e.aiT=2.3;e.x=clamp(p.x-dir*rand(250,430),0,C.WORLD_WIDTH-e.w);this.enemyShoot(e,240,(cy(p)-cy(e))*0.55);this.fx(cx(e),cy(e),"swap","#9d75ff",0.3);} }
          else if(e.type==="heavy") e.vx=ad<600?dir*e.speed*scale:0;
          else if(e.type==="boss") this.updateBoss(e,p,dt,ad,dir);
        } else e.vx*=0.86;

        if(e.root>0)e.vx=0;
        if(e.type!=="flying"&&e.type!=="turret"){e.vy=Math.min(900,e.vy+C.GRAVITY*dt);e.x+=e.vx*dt;e.y+=e.vy*dt;this.enemyFloor(e);}
        if(ad<42+(e.w+p.w)/2 && Math.abs(cy(p)-cy(e))<70 && e.aiT<=0){e.aiT=0.85;this.damagePlayer(e.damage,dir*300,-180,e.name);}
      }
      this.enemies=this.enemies.filter(e=>!(e.dead&&e.type!=="boss") || e.hurtT>0);
      this.updateEnemyShots(dt);
    }

    enemyFloor(e){
      let best=C.GROUND_Y-e.h;
      for(const s of this.platforms){if(cx(e)>s.x&&cx(e)<s.x+s.w&&e.y+e.h<=s.y+40&&e.y+e.h+Math.max(0,e.vy*0.034)>=s.y)best=Math.min(best,s.y-e.h);}
      if(e.y>=best){e.y=best;e.vy=0;}
    }

    updateBoss(e,p,dt,ad,dir){
      e.phase=e.hp/e.maxHp<0.33?3:e.hp/e.maxHp<0.66?2:1;
      e.vx=ad>160?dir*e.speed*(1+e.phase*0.14):0;
      if(e.aiT<=0){e.aiT=Math.max(0.7,1.8-e.phase*0.25);if(Math.random()<0.55){for(let i=-e.phase;i<=e.phase;i++)this.enemyShoot(e,300+i*15,i*80);}else{this.effects.push({type:"danger",x:p.x-80,y:C.GROUND_Y-220,w:210,h:220,t:0.75,color:"#ff4568",explode:true});}}
    }

    enemyShoot(e,speed,vy){this.enemyShots.push({x:cx(e),y:cy(e),w:12,h:12,vx:e.dir*speed,vy:vy||0,t:4,damage:e.damage,owner:e.name});}
    updateEnemyShots(dt){for(const s of this.enemyShots){s.t-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(rectHit(s,this.player)){this.damagePlayer(s.damage,sign(s.vx)*180,-100,s.owner);s.t=0;}}this.enemyShots=this.enemyShots.filter(s=>s.t>0);}

    damagePlayer(dmg,kx,ky,source){
      const p=this.player;if(p.invuln>0||p.phase>0)return;
      if(p.shield>0){const a=Math.min(p.shield,dmg);p.shield-=a;dmg-=a;}
      if(dmg<=0)return;
      p.hp-=dmg;p.invuln=C.PLAYER.invulnAfterHit;this.screenShake=8;this.fx(cx(p),cy(p),"hit","#ff6d7b",0.25,{text:`-${Math.round(dmg)}`});
      if(p.superArmor<=0){p.vx=kx;p.vy=ky;}
      if(p.hp<=0){this.say(`被 ${source} 擊倒`);this.respawn();}
    }

    // ------------------------------------------------------------------------
    // 10. 機關與地圖互動
    // ------------------------------------------------------------------------
    handlePuzzleElementHit(s,el){
      for(const h of this.hazards){if(s.t<=0)break;if(!rectHit(s,h))continue;if(h.type==="firewall"&&el.id==="water"){h.active=false;s.t=0;this.say("水熄滅火牆");}if(h.type==="water"&&el.id==="ice"){h.frozen=8;s.t=0;this.say("水面凍結，可站立 8 秒");}}
      for(const z of this.puzzles){if(s.t<=0)break;if(!rectHit(s,z))continue;if(z.type==="torch"&&el.id==="fire"){z.lit=true;s.t=0;this.say("火盆點燃：附近機關解鎖");}if(z.type==="lightBridge"&&el.id==="light"){z.revealed=true;this.say("聖光顯示隱形橋");}if(z.type==="seed"&&el.id==="nature"){z.grown=true;this.tempPlatforms.push({x:z.x+5,y:z.y-270,w:25,h:270,t:999,type:"vine",climb:true});this.say("種子生長成藤蔓");}if(z.type==="socket"&&el.id==="lightning"){z.charged=true;this.say("回路插槽充能");}if(z.type==="brittleWall"&&el.id==="earth"){this.say("牆面龜裂……需要『冰→火』熱震才能完全破壞");}}
    }

    updatePuzzles(dt){
      for(const h of this.hazards){if(h.frozen>0)h.frozen-=dt;if(h.type==="laser")h.active=Math.sin(this.time*2+h.phase)>-0.25;if(h.type==="crusher")h.y=h.baseY+(Math.sin(this.time*1.7+h.phase)*0.5+0.5)*270;}
      for(const p of this.platforms)if(p.type==="moving")p.x=p.baseX+Math.sin(this.time*p.speed+p.phase)*p.range;
      for(const z of this.puzzles){
        if(z.type==="plate")z.pressed=false;
        if(z.type==="checkpoint"&&Math.abs(cx(this.player)-z.x)<65){this.checkpointX=z.x;for(const c of this.puzzles)if(c.type==="checkpoint")c.active=false;z.active=true;}
        if(z.type==="crate"){z.x+=z.vx*dt;z.vx*=0.92;if(Math.abs(cx(this.player)-cx(z))<90&&Math.abs(this.player.y-z.y)<80&&Math.abs(this.player.vx)>80)z.vx=this.player.vx*0.55;}
        if(z.type==="gravityCore"){z.x+=z.vx*dt;z.y+=z.vy*dt;z.vy+=C.GRAVITY*0.35*dt;if(z.y>C.GROUND_Y-z.h){z.y=C.GROUND_Y-z.h;z.vy=0;}for(const ef of this.effects)if(ef.type==="gravityWell"&&ef.t>0&&Math.hypot(z.x-ef.x,z.y-ef.y)<ef.r){z.vx+=(ef.x-z.x)*dt*1.8;z.vy+=(ef.y-z.y)*dt*1.2;}}
      }
      const plate=this.puzzles.find(z=>z.type==="plate"), crate=this.puzzles.find(z=>z.type==="crate");if(plate&&crate&&rectHit(plate,crate)){plate.pressed=true;const fw=this.hazards.find(h=>h.type==="firewall"&&h.x>9000);if(fw)fw.active=false;}
      const socket=this.puzzles.find(z=>z.type==="socket"), core=this.puzzles.find(z=>z.type==="gravityCore");if(socket&&core&&rectHit(socket,core)){socket.charged=true;core.x=socket.x+11;core.y=socket.y+10;core.vx=core.vy=0;}
      this.tempPlatforms.forEach(p=>p.t-=dt);this.tempPlatforms=this.tempPlatforms.filter(p=>p.t>0);
    }

    checkHazardDamage(dt){
      const p=this.player;
      for(const h of this.hazards){if(h.type==="spikes"&&rectHit(p,h))this.damagePlayer(20,0,-450,"尖刺");if(h.type==="firewall"&&h.active&&rectHit(p,h))this.damagePlayer(18,-p.dir*300,-180,"火牆");if(h.type==="laser"&&h.active&&rectHit(p,h))this.damagePlayer(14,0,-100,"雷射");if(h.type==="crusher"&&rectHit(p,h))this.damagePlayer(32,0,180,"壓碎機");if(h.type==="water"&&h.frozen<=0&&rectHit(p,h)){p.vx*=0.96;p.vy-=C.GRAVITY*0.78*dt;}}
    }

    interactNPC(){
      const p=this.player;const n=this.npcs.find(n=>Math.abs(cx(p)-cx(n))<100&&Math.abs(cy(p)-cy(n))<100);if(!n)return;
      this.say(`${n.name}：${n.text}`,6);
      if(n.name.includes("鉚釘")){p.hp=p.maxHp;p.mp=p.maxMp;}
    }

    // ------------------------------------------------------------------------
    // 11. 雙人同步
    // ------------------------------------------------------------------------
    bindNetwork(){
      this.network.on("room", code=>{$("#roomCode").value=code;this.say(`房間代碼：${code}`,5);});
      this.network.on("status", text=>{$("#netStatus").textContent=text;});
      this.network.on("error", text=>{this.say(`連線錯誤：${text}`,6);$("#netStatus").textContent="連線錯誤";});
      this.network.on("state", d=>{this.remote=d.state;});
      this.network.on("attack", d=>{if(this.remote)this.remote.attackFlash=0.18;});
      this.network.on("swap", d=>{if(this.remote){this.remote.x=d.x;this.remote.y=d.y;this.remote.swapFlash=0.4;}});
    }

    updateNetwork(tsMs){
      const p=this.player;
      this.network.sendState({x:p.x,y:p.y,vx:p.vx,vy:p.vy,dir:p.dir,classId:p.classId,hp:p.hp,maxHp:p.maxHp,anim:p.anim,beastForm:p.beastForm},tsMs);
      if(this.remote){this.remote.attackFlash=Math.max(0,(this.remote.attackFlash||0)-0.016);this.remote.swapFlash=Math.max(0,(this.remote.swapFlash||0)-0.016);}
    }

    // ------------------------------------------------------------------------
    // 12. UI 與繪圖
    // ------------------------------------------------------------------------
    bindUI(){
      $("#classSelect").innerHTML=Object.values(C.CLASSES).map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
      $("#classSelect").value=this.player.classId;
      $("#classSelect").addEventListener("change",e=>this.changeClass(e.target.value));
      $("#createRoom").onclick=()=>{try{this.network.createRoom();}catch(e){this.say(e.message,6);}};
      $("#joinRoom").onclick=()=>{try{this.network.joinRoom($("#roomCode").value);}catch(e){this.say(e.message,6);}};
      $("#disconnectRoom").onclick=()=>this.network.disconnect();
      $("#closeHelp").onclick=()=>this.togglePanel("helpPanel",false);
      $("#closeKeys").onclick=()=>this.togglePanel("keyPanel",false);
      $("#resetKeys").onclick=()=>{this.keys=Object.assign({},C.DEFAULT_KEYS);this.saveKeys();this.renderKeyList();};
      this.renderElementBar();
    }

    changeClass(id){
      const old=this.player, cl=C.CLASSES[id];if(!cl)return;
      old.classId=id;old.maxHp=cl.maxHp;old.maxMp=cl.maxMp;old.hp=Math.min(old.hp,old.maxHp);old.mp=Math.min(old.mp,old.maxMp);old.attackStep=0;this.say(`切換職業：${cl.name}`);
    }

    togglePanel(id,force){const el=$("#"+id);const show=force===undefined?el.hidden:force;el.hidden=!show;}
    openKeyConfig(){this.renderKeyList();this.togglePanel("keyPanel",true);}
    renderKeyList(){const box=$("#keyList");box.innerHTML="";for(const [action,label] of Object.entries(C.ACTION_LABELS)){const b=document.createElement("button");b.className="key-row";b.innerHTML=`<span>${label}</span><kbd>${fmtKey(this.keys[action])}</kbd>`;b.onclick=()=>{b.querySelector("kbd").textContent="按新鍵…";this.input.capture=(code)=>{for(const [a,k] of Object.entries(this.keys))if(k===code&&a!==action)this.keys[a]=this.keys[action];this.keys[action]=code;this.saveKeys();this.renderKeyList();};};box.appendChild(b);}}
    renderElementBar(){const box=$("#elements");box.innerHTML=C.ELEMENTS.map((e,i)=>`<div class="element-chip" style="--ec:${e.color}" title="${e.description}"><kbd>${i===9?0:i+1}</kbd><b>${e.glyph}</b><span>${e.name}</span></div>`).join("");}
    say(text,t=3){this.message={text,t};}

    updateHUD(){
      const p=this.player, cl=C.CLASSES[p.classId];
      $("#hpFill").style.width=`${clamp(p.hp/p.maxHp*100,0,100)}%`;$("#hpText").textContent=`HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
      $("#mpFill").style.width=`${clamp(p.mp/p.maxMp*100,0,100)}%`;$("#mpText").textContent=`MP ${Math.floor(p.mp)} / ${p.maxMp}`;
      $("#className").textContent=`${cl.icon} ${cl.name}`;
      $("#zoneName").textContent=C.ZONES[this.currentZone]?.name||"";
      $("#combo").textContent=this.combo.hits>1?`${this.combo.hits} HIT  ${Math.round(this.combo.damage)} DMG`:"";
      let resource="";if(p.classId==="rift")resource=`裂隙 ${Math.floor(p.rift)}/100`;if(p.classId==="beast")resource=`姿態：${{wolf:"狼",eagle:"鷹",bear:"熊"}[p.beastForm]}`;if(p.classId==="summoner")resource=p.summonFrenzy>0?"星獸狂熱":"浮光狐待命";if(p.classId==="artificer")resource=`炮台 ${this.turrets.length}/3`;$("#classResource").textContent=resource;
      $("#toast").textContent=this.message.t>0?this.message.text:"";
    }

    updateCamera(dt){
      const target=clamp(this.player.x-this.viewW*0.42,0,C.WORLD_WIDTH-this.viewW);this.camera.x=lerp(this.camera.x,target,Math.min(1,dt*4.8));
      this.currentZone=Math.max(0,C.ZONES.findIndex(z=>this.player.x>=z.x0&&this.player.x<z.x1));
      this.screenShake=Math.max(0,this.screenShake-dt*30);
    }

    render(){
      const ctx=this.ctx,W=this.viewW,H=this.viewH;ctx.save();ctx.clearRect(0,0,W,H);
      const zone=C.ZONES[this.currentZone]||C.ZONES[0];ctx.fillStyle=zone.sky;ctx.fillRect(0,0,W,H);
      // 遠景視差
      ctx.fillStyle="rgba(255,255,255,.035)";for(let i=0;i<18;i++){const x=((i*420-this.camera.x*0.18)%7600)-300;ctx.beginPath();ctx.arc(x,120+(i%4)*70,100+(i%3)*40,0,Math.PI*2);ctx.fill();}
      const shakeX=this.screenShake?rand(-this.screenShake,this.screenShake):0,shakeY=this.screenShake?rand(-this.screenShake,this.screenShake):0;ctx.translate(-this.camera.x+shakeX,shakeY);
      this.drawWorld(ctx);this.drawPuzzles(ctx);this.drawEffectsBehind(ctx);this.drawNPCs(ctx);this.drawEnemies(ctx);this.drawProjectiles(ctx);this.drawTurrets(ctx);this.drawPlayer(ctx,this.player,false);if(this.remote)this.drawRemote(ctx);this.drawEffectsFront(ctx);
      ctx.restore();
    }

    drawWorld(ctx){
      for(const z of C.ZONES){if(z.x1<this.camera.x-100||z.x0>this.camera.x+this.viewW+100)continue;ctx.fillStyle=z.ground;ctx.fillRect(z.x0,C.GROUND_Y,z.x1-z.x0,190);ctx.fillStyle="rgba(255,255,255,.06)";ctx.fillRect(z.x0,C.GROUND_Y,z.x1-z.x0,5);}
      for(const p of this.platforms){ctx.fillStyle=p.type==="moving"?"#7196a8":"#586878";ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle="rgba(255,255,255,.13)";ctx.fillRect(p.x,p.y,p.w,4);}
      for(const p of this.tempPlatforms){ctx.fillStyle=p.type==="ice"?"#8fe5ff":p.type==="earth"?"#967252":p.type==="vine"?"#5db666":p.type==="spring"?"#69e5ff":"#7ca36b";ctx.fillRect(p.x,p.y,p.w,p.h);}
      for(const h of this.hazards){if(h.type==="spikes"){ctx.fillStyle="#d7dbe2";for(let x=h.x;x<h.x+h.w;x+=24){ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+12,h.y);ctx.lineTo(x+24,h.y+h.h);ctx.fill();}}if(h.type==="water"){ctx.fillStyle=h.frozen>0?"#b9f3ff":"rgba(70,150,255,.65)";ctx.fillRect(h.x,h.y,h.w,h.h);}if(h.type==="firewall"&&h.active){ctx.fillStyle="#ff653e";ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle="#ffd25a";for(let y=h.y;y<h.y+h.h;y+=35)ctx.fillRect(h.x-8+Math.sin(this.time*7+y)*8,y,h.w+16,10);}if(h.type==="laser"&&h.active){ctx.fillStyle="#ff416d";ctx.shadowColor="#ff416d";ctx.shadowBlur=16;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.shadowBlur=0;}if(h.type==="crusher"){ctx.fillStyle="#7c8590";ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle="#c84c5f";ctx.fillRect(h.x,h.y+h.h-15,h.w,15);}}
    }

    drawPuzzles(ctx){for(const z of this.puzzles){if(z.type==="checkpoint"){ctx.fillStyle=z.active?"#6dffbc":"#607080";ctx.fillRect(z.x,z.y,z.w,z.h);ctx.beginPath();ctx.arc(z.x+15,z.y,18,0,Math.PI*2);ctx.fill();}else if(z.type==="torch"){ctx.fillStyle="#765640";ctx.fillRect(z.x+10,z.y+25,14,35);if(z.lit){ctx.fillStyle="#ff7a37";ctx.beginPath();ctx.arc(z.x+17,z.y+18,18+Math.sin(this.time*8)*3,0,Math.PI*2);ctx.fill();}}else if(z.type==="lightBridge"){if(z.revealed){ctx.fillStyle="rgba(255,248,179,.55)";ctx.fillRect(z.x,z.y,z.w,z.h);}}else if(z.type==="shadowWall"){ctx.fillStyle="rgba(71,43,110,.7)";ctx.fillRect(z.x,z.y,z.w,z.h);}else if(z.type==="seed"){ctx.fillStyle=z.grown?"#78d57a":"#91ad55";ctx.beginPath();ctx.arc(z.x+17,z.y+20,18,0,Math.PI*2);ctx.fill();}else if(z.type==="plate"){ctx.fillStyle=z.pressed?"#70dc8d":"#c49b5b";ctx.fillRect(z.x,z.y,z.w,z.h);}else if(z.type==="crate"){ctx.fillStyle="#9a7049";ctx.fillRect(z.x,z.y,z.w,z.h);ctx.strokeStyle="#d5af79";ctx.strokeRect(z.x+7,z.y+7,z.w-14,z.h-14);}else if(z.type==="socket"){ctx.fillStyle=z.charged?"#ffe45c":"#62707e";ctx.fillRect(z.x,z.y,z.w,z.h);}else if(z.type==="gravityCore"){ctx.fillStyle="#ec77ff";ctx.beginPath();ctx.arc(cx(z),cy(z),25,0,Math.PI*2);ctx.fill();}else if(z.type==="brittleWall"&&!z.broken){ctx.fillStyle="#76595a";ctx.fillRect(z.x,z.y,z.w,z.h);ctx.strokeStyle="#d19393";ctx.beginPath();ctx.moveTo(z.x+10,z.y+15);ctx.lineTo(z.x+48,z.y+80);ctx.lineTo(z.x+22,z.y+150);ctx.lineTo(z.x+58,z.y+230);ctx.stroke();}}}

    drawNPCs(ctx){ctx.font="13px sans-serif";ctx.textAlign="center";for(const n of this.npcs){ctx.fillStyle="#70d7c0";ctx.fillRect(n.x,n.y,n.w,n.h);ctx.fillStyle="#fff";ctx.fillText(n.name,n.x+n.w/2,n.y-12);if(Math.abs(cx(this.player)-cx(n))<100){ctx.fillStyle="#ffe89a";ctx.fillText(`[${fmtKey(this.keys.interact)}] 互動`,n.x+n.w/2,n.y-30);}}ctx.textAlign="left";}

    drawPlayer(ctx,p,remote=false){
      const cl=C.CLASSES[p.classId]||C.CLASSES.rift;ctx.save();if(p.phase>0)ctx.globalAlpha=0.55;if(p.invuln>0&&Math.floor(this.time*20)%2===0)ctx.globalAlpha*=0.45;ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.scale(p.dir||1,1);ctx.fillStyle=remote?"#75c8ff":"#f3f6ff";ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.fillStyle="#273148";ctx.fillRect(-p.w/2+8,-p.h/2+10,p.w-16,16);ctx.fillStyle="#fff";ctx.font="19px sans-serif";ctx.textAlign="center";ctx.fillText(cl.icon,0,8);ctx.fillStyle="#9fe8ff";ctx.fillRect(13,-5,remote?18:24,7);ctx.restore();
      if(p.shield>0&&!remote){ctx.strokeStyle="rgba(120,220,255,.75)";ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx(p),cy(p),48,0,Math.PI*2);ctx.stroke();}
      if(!remote&&p.classId==="summoner"&&this.pet){ctx.fillStyle="#ffd978";ctx.beginPath();ctx.arc(this.pet.x,this.pet.y,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font="12px sans-serif";ctx.fillText("狐",this.pet.x-7,this.pet.y+4);}
    }

    drawRemote(ctx){const r=this.remote;if(!r)return;this.drawPlayer(ctx,{...r,w:C.PLAYER.width,h:C.PLAYER.height,phase:0,invuln:0,shield:0},true);ctx.fillStyle="#75c8ff";ctx.font="12px sans-serif";ctx.fillText("P2",r.x,r.y-12);if(r.swapFlash>0){ctx.strokeStyle="#d075ff";ctx.beginPath();ctx.arc(r.x+23,r.y+34,50,0,Math.PI*2);ctx.stroke();}}

    drawEnemies(ctx){for(const e of this.enemies){if(e.dead)continue;const c=C.ENEMIES[e.type].color;ctx.save();ctx.fillStyle=e.hurtT>0?"#fff":c;ctx.fillRect(e.x,e.y,e.w,e.h);if(e.type==="shield"){ctx.fillStyle="#c5ced8";ctx.fillRect(e.dir<0?e.x-8:e.x+e.w-3,e.y+8,12,e.h-16);}if(e.type==="bat"){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(e.x,e.y+25);ctx.lineTo(e.x-20,e.y);ctx.lineTo(e.x+5,e.y+45);ctx.fill();ctx.beginPath();ctx.moveTo(e.x+e.w,e.y+25);ctx.lineTo(e.x+e.w+20,e.y);ctx.lineTo(e.x+e.w-5,e.y+45);ctx.fill();}ctx.fillStyle="#1b1e28";ctx.fillRect(e.x,e.y-10,e.w,6);ctx.fillStyle="#ff5e70";ctx.fillRect(e.x,e.y-10,e.w*clamp(e.hp/e.maxHp,0,1),6);if(e.marked&&e.markT>0){const el=C.ELEMENTS.find(x=>x.id===e.marked);ctx.strokeStyle=el.color;ctx.lineWidth=3;ctx.strokeRect(e.x-4,e.y-4,e.w+8,e.h+8);ctx.fillStyle=el.color;ctx.font="bold 15px sans-serif";ctx.fillText(el.glyph,e.x+e.w/2-8,e.y-18);}ctx.restore();}}

    drawProjectiles(ctx){for(const s of this.projectiles){const el=C.ELEMENTS.find(e=>e.id===s.element);ctx.fillStyle=el.color;ctx.shadowColor=el.color;ctx.shadowBlur=14;ctx.beginPath();ctx.arc(cx(s),cy(s),s.w/2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#172030";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(el.glyph,cx(s),cy(s)+4);ctx.textAlign="left";}for(const s of this.enemyShots){ctx.fillStyle="#ff6780";ctx.beginPath();ctx.arc(cx(s),cy(s),7,0,Math.PI*2);ctx.fill();}}
    drawTurrets(ctx){for(const t of this.turrets){ctx.fillStyle=t.overload>0?"#ffe45c":"#66e6ff";ctx.fillRect(t.x,t.y,t.w,t.h);ctx.fillRect(t.x+10,t.y-8,30,8);}}

    drawEffectsBehind(ctx){for(const e of this.effects){if(e.type==="gravityWell"){ctx.strokeStyle=colorAlpha(e.color,0.6);for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(e.x,e.y,(e.r*(i+1)/4)*(0.8+0.2*Math.sin(this.time*3+i)),0,Math.PI*2);ctx.stroke();}}if(e.type==="fountain"){ctx.fillStyle=colorAlpha(e.color,0.35);ctx.fillRect(e.x-20,e.y-180,40,180);}if(e.type==="danger"){ctx.fillStyle=colorAlpha(e.color,0.22);ctx.fillRect(e.x,e.y,e.w,e.h);}}}
    drawEffectsFront(ctx){for(const e of this.effects){const a=clamp(e.t/(e.maxT||0.5),0,1);ctx.save();ctx.globalAlpha=Math.max(0.15,a);if(e.type==="explosion"){ctx.strokeStyle=e.color;ctx.lineWidth=12;ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-a*0.35),0,Math.PI*2);ctx.stroke();}else if(["swap","hit","elementHit","spark","muzzle","jump","dash","lightning"].includes(e.type)){ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,18+(1-a)*42,0,Math.PI*2);ctx.stroke();if(e.text){ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.fillText(e.text,e.x,e.y-25);}}else if(e.type==="slash"||e.type==="bigSlash"){ctx.strokeStyle=e.color;ctx.lineWidth=e.type==="bigSlash"?14:8;ctx.beginPath();ctx.arc(e.x,e.y,e.type==="bigSlash"?90:55,-1.2,1.2);ctx.stroke();}else if(e.type==="rail"){ctx.fillStyle=colorAlpha(e.color,.6);ctx.fillRect(e.x-320,e.y-12,640,24);}else if(e.type==="clone"){ctx.fillStyle=colorAlpha(e.color,.3);ctx.fillRect(e.x,e.y,C.PLAYER.width,C.PLAYER.height);}else if(e.type==="starBeast"){ctx.fillStyle=colorAlpha(e.color,.18);ctx.beginPath();ctx.arc(e.x,e.y,120+Math.sin(this.time*5)*20,0,Math.PI*2);ctx.fill();}ctx.restore();}}

    updateEffects(dt){for(const e of this.effects){e.maxT=e.maxT||e.t;e.t-=dt;if(e.type==="gravityWell"){for(const en of this.enemies)if(!en.dead&&Math.hypot(cx(en)-e.x,cy(en)-e.y)<e.r)en.vx+=(e.x-cx(en))*dt*1.8;}if(e.type==="danger"&&e.explode&&e.t<=0.05&&!e.done){e.done=true;this.explosion(e.x+e.w/2,e.y+e.h/2,150,35,"Boss 區域爆破");}}this.effects=this.effects.filter(e=>e.t>0);}
    fx(x,y,type,color,t,extra={}){this.effects.push({x,y,type,color,t,maxT:t,...extra});}

    respawn(){const p=this.player;p.x=this.checkpointX;p.y=C.GROUND_Y-p.h-30;p.vx=p.vy=0;p.hp=p.maxHp;p.mp=Math.max(p.mp,p.maxMp*0.55);p.invuln=1.2;this.say("回到最近檢查點");}

    // ------------------------------------------------------------------------
    // 13. Debug API：開發大型地圖時非常重要，不必每次從頭跑。
    // ------------------------------------------------------------------------
    debugTeleport(x){this.player.x=clamp(Number(x)||0,0,C.WORLD_WIDTH-this.player.w);this.player.y=C.GROUND_Y-this.player.h-20;this.player.vx=this.player.vy=0;}
    debugHeal(){this.player.hp=this.player.maxHp;this.player.mp=this.player.maxMp;}
  }

  // 啟動遊戲
  window.addEventListener("DOMContentLoaded",()=>{
    const game=new Game();
    window.ElementalSwap={
      game,
      debug:{
        teleport:(x)=>game.debugTeleport(x),
        heal:()=>game.debugHeal(),
        class:(id)=>game.changeClass(id),
        element:(id)=>{const i=C.ELEMENTS.findIndex(e=>e.id===id);if(i>=0)game.elementKey(i);},
        boss:()=>game.debugTeleport(16800),
        spawn:(type,x=game.player.x+400)=>game.spawnEnemy(type,x,C.GROUND_Y-58)
      }
    };
  });
})();
