/*
 * Elemental Swap V5 — config.js
 * ============================================================================
 * 所有最常調整的數值都集中在這裡。
 *
 * V4 預設操作：
 *   方向鍵 ← → ↑ ↓：移動／方向指令／瞄準（就在數字鍵盤旁）
 *   Space：跳躍／二段跳／倒地受身
 *   Shift：Dash
 *   X：快攻
 *   Y：重攻
 *   C / V / B：職業技能
 *   Q：職業能力
 *   1–0：十元素；同元素再按一次＝換位
 */
window.ES4 = {
  VERSION: '5.0.0-living-ruins-puzzle-expansion',
  VIEW_W: 1600,
  VIEW_H: 900,
  WORLD_W: 24000,
  WORLD_H: 1000,
  GROUND_Y: 720,
  GRAVITY: 1850,
  SAFE_ZONE_END: 1450,

  PLAYER: {
    w: 54, h: 78,
    speed: 410,
    airSpeed: 360,
    accel: 3200,
    airAccel: 2050,
    jump: 740,
    maxFall: 1120,
    dashSpeed: 880,
    dashTime: 0.17,
    dashCooldown: 0.38,
    invulnAfterHit: 0.62,
    comboTimeout: 0.78,
    coyote: 0.10,
  },

  DEFAULT_KEYS: {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    jump: 'Space', dash: 'ShiftLeft',
    light: 'KeyX', heavy: 'KeyY',
    skill1: 'KeyC', skill2: 'KeyV', skill3: 'KeyB', classSkill: 'KeyQ',
    interact: 'KeyF', clearAnchors: 'KeyG', reset: 'KeyR', help: 'KeyH', settings: 'KeyK', pause: 'KeyP',
    e1:'Digit1',e2:'Digit2',e3:'Digit3',e4:'Digit4',e5:'Digit5',e6:'Digit6',e7:'Digit7',e8:'Digit8',e9:'Digit9',e10:'Digit0',
  },

  // WASD 仍保留成不顯示的副鍵，方便測試；正式 UI 會顯示方向鍵為預設。
  INPUT_ALIASES: {
    left:['KeyA'], right:['KeyD'], up:['KeyW'], down:['KeyS'],
    dash:['ShiftRight'],
  },

  ACTION_LABELS: {
    left:'向左',right:'向右',up:'向上／上段指令',down:'向下／下段指令',jump:'跳躍／二段跳／受身',dash:'Dash',
    light:'X 快攻',heavy:'Y 重攻',skill1:'技能 C',skill2:'技能 V',skill3:'技能 B',classSkill:'職業能力 Q',interact:'NPC 互動',
    clearAnchors:'清除錨點',reset:'回檢查點',help:'說明',settings:'改鍵',pause:'暫停',
    e1:'火焰',e2:'冰霜',e3:'雷電',e4:'疾風',e5:'岩土',e6:'流水',e7:'聖光',e8:'暗影',e9:'自然',e10:'引力',
  },

  CLASSES: {
    rift:{id:'rift',name:'裂隙劍士',icon:'刃',color:'#62e7ff',maxHp:190,maxMp:125,speed:1.05,summary:'Command 連段與換位追斬。',skills:['裂空三閃','逆界天升','十相終刃']},
    summoner:{id:'summoner',name:'靈契召喚師',icon:'契',color:'#d590ff',maxHp:145,maxMp:185,speed:.98,summary:'狐靈追擊、護環與大型召喚。',skills:['靈矢列陣','契約護環','星獸降臨']},
    beast:{id:'beast',name:'百獸憑依者',icon:'獸',color:'#8cf478',maxHp:170,maxMp:145,speed:1.08,summary:'狼／鷹／熊姿態切換。',skills:['狼牙奔襲','蒼鷹墜擊','百獸王化']},
    artificer:{id:'artificer',name:'符文機巧師',icon:'機',color:'#ffad5d',maxHp:155,maxMp:170,speed:.97,summary:'炮台、磁軌砲與地形設置。',skills:['磁軌衝擊','彈射平台','超載回路']},
  },

  ELEMENTS: [
    {id:'fire',key:'e1',glyph:'火',name:'火焰',color:'#ff623f',speed:305,gravity:0,size:42,damage:16,mark:8,
      hit:'命中後燃燒 5 秒，每 0.55 秒造成持續傷害。',swap:'新舊位置各生成 4 秒火焰區。',puzzle:'點燃火盆、燒除藤障、與冰形成熱震。'},
    {id:'ice',key:'e2',glyph:'冰',name:'冰霜',color:'#78e5ff',speed:235,gravity:250,size:48,damage:10,mark:9,
      hit:'大幅緩速；濕潤目標會直接凍結。',swap:'舊位置生成 10 秒可站立冰平台。',puzzle:'凍結水面、冷卻機關、與火形成熱震。'},
    {id:'lightning',key:'e3',glyph:'雷',name:'雷電',color:'#ffe55d',speed:530,gravity:0,size:34,damage:13,mark:6,
      hit:'暈眩；濕潤目標傷害 ×2 並連鎖。',swap:'新舊位置各放出鏈雷。',puzzle:'啟動電路與核心節點。'},
    {id:'wind',key:'e4',glyph:'風',name:'疾風',color:'#82f2bd',speed:340,gravity:-45,size:54,damage:7,mark:6,
      hit:'高擊退，能推箱與敵人。',swap:'玩家獲得高速風衝，舊位置產生推力波。',puzzle:'啟動風車、推箱壓板、跨越長缺口。'},
    {id:'earth',key:'e5',glyph:'岩',name:'岩土',color:'#ba8958',speed:190,gravity:600,size:58,damage:24,mark:10,
      hit:'重擊、破甲 6 秒、較高 BREAK 傷害。',swap:'舊位置生成 12 秒石柱並獲得霸體。',puzzle:'壓板、砸裂牆、建立高度。'},
    {id:'water',key:'e6',glyph:'水',name:'流水',color:'#529cff',speed:250,gravity:85,size:48,damage:8,mark:10,
      hit:'附加濕潤並熄滅燃燒。',swap:'舊位置生成 7 秒噴泉，並治療玩家。',puzzle:'熄滅火牆、配合雷／冰。'},
    {id:'light',key:'e7',glyph:'光',name:'聖光',color:'#fff2a7',speed:365,gravity:0,size:42,damage:11,mark:9,
      hit:'揭露隱形敵人並淨化詛咒。',swap:'治療＋護盾＋全畫面短暫顯形。',puzzle:'顯示光橋與隱藏機關。'},
    {id:'shadow',key:'e8',glyph:'影',name:'暗影',color:'#a078ff',speed:285,gravity:0,size:46,damage:14,mark:9,
      hit:'詛咒 8 秒，使後續傷害提高。',swap:'獲得相位 2.2 秒並留下吸引敵人的分身。',puzzle:'穿越影牆與黑暗柵欄。'},
    {id:'nature',key:'e9',glyph:'藤',name:'自然',color:'#68d86f',speed:215,gravity:300,size:46,damage:9,mark:11,
      hit:'纏根 2.8 秒。',swap:'舊位置長出 13 秒藤柱／攀爬點。',puzzle:'啟動種子、架橋、纏住移動機關。'},
    {id:'gravity',key:'e10',glyph:'引',name:'引力',color:'#e978ff',speed:145,gravity:-18,size:66,damage:6,mark:12,
      hit:'持續吸引敵人與物件。',swap:'舊位置生成 7 秒大型引力井；玩家進入低重力。',puzzle:'拉動核心球、箱子、敵人與懸浮平台。'},
  ],

  ENEMIES: {
    dummy:{name:'訓練傀儡',ai:'passive',hp:9999,speed:0,damage:0,color:'#71eaff'},
    slime:{name:'裂膠史萊姆',ai:'melee',hp:62,speed:95,damage:9,color:'#63d781'},
    archer:{name:'回路弓手',ai:'ranged',hp:78,speed:68,damage:12,color:'#c38b52'},
    shield:{name:'盾式守衛',ai:'shield',hp:140,speed:53,damage:16,color:'#73899a'},
    bat:{name:'電翼蝠',ai:'flying',hp:50,speed:150,damage:10,color:'#ac78e6'},
    turret:{name:'古代砲座',ai:'turret',hp:110,speed:0,damage:14,color:'#667882'},
    mage:{name:'幽相術士',ai:'mage',hp:98,speed:70,damage:15,color:'#6f57b0'},
    golem:{name:'岩核巨像',ai:'heavy',hp:245,speed:42,damage:23,color:'#88705a'},
    boss:{name:'十相哨兵・赫利俄斯',ai:'boss',hp:1900,speed:82,damage:25,color:'#e64c70'},
  },

  ZONES: [
    {a:0,b:3000,name:'01 夕照藤巷',theme:'zone1',objective:'三座火壇、冰平台與換位教學。'},
    {a:3000,b:6000,name:'02 沉水車站',theme:'zone2',objective:'濕潤導體、雷電通路與水輪。'},
    {a:6000,b:9000,name:'03 高架運輸林',theme:'zone3',objective:'風輪、引力鎖與重量板三重機關。'},
    {a:9000,b:12000,name:'04 瀑布商場',theme:'zone4',objective:'三面光鏡、永久光橋與影牆。'},
    {a:12000,b:15000,name:'05 植生塔群',theme:'zone5',objective:'三枚古種、引力核心與藤橋。'},
    {a:15000,b:18000,name:'06 水電舊都',theme:'zone6',objective:'冷卻閥、濕潤線圈與雷射停機。'},
    {a:18000,b:21000,name:'07 崩落十字路',theme:'zone7',objective:'三道熱震封印與引力彈弓。'},
    {a:21000,b:24000,name:'08 天際回路核心',theme:'zone8',objective:'職業試煉、三階段 Boss 與 BREAK。'},
  ],
};
