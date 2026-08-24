/*
 * Elemental Swap V2 - config.js
 * ------------------------------------------------------------
 * 這是你最常修改的檔案。
 * 原則：能用「資料」描述的東西，盡量放在這裡，不要寫死在 game.js。
 *
 * 常見修改：
 * 1. 改元素傷害、速度、狀態時間。
 * 2. 改職業血量、MP、移動速度。
 * 3. 新增敵人模板、NPC 對話。
 * 4. 改預設按鍵。
 * 5. 改關卡區域名稱與背景色。
 */

window.ES_CONFIG = {
  VERSION: "2.1.0-regenerated",
  WORLD_WIDTH: 18000,
  WORLD_HEIGHT: 900,
  GROUND_Y: 710,
  GRAVITY: 1800,
  PLAYER: {
    width: 46,
    height: 68,
    moveSpeed: 360,
    jumpPower: 700,
    maxFallSpeed: 1100,
    dashSpeed: 720,
    dashTime: 0.16,
    invulnAfterHit: 0.7
  },

  // 10 種元素。key 對應下面 DEFAULT_KEYS 的 element1~element10。
  ELEMENTS: [
    {
      id: "fire", name: "火焰", glyph: "火", color: "#ff5a36",
      speed: 410, gravity: 0, damage: 18, size: 13, markDuration: 7,
      description: "燃燒持續傷害；換位時在新舊位置各引爆一次。"
    },
    {
      id: "ice", name: "冰霜", glyph: "冰", color: "#7ddcff",
      speed: 300, gravity: 260, damage: 11, size: 15, markDuration: 8,
      description: "大幅緩速並可凍結水面；換位後原地生成暫時冰平台。"
    },
    {
      id: "lightning", name: "雷電", glyph: "雷", color: "#ffe45c",
      speed: 680, gravity: 0, damage: 13, size: 10, markDuration: 5,
      description: "短暫暈眩；對濕潤目標增傷並連鎖附近敵人。"
    },
    {
      id: "wind", name: "疾風", glyph: "風", color: "#8fffc4",
      speed: 470, gravity: -60, damage: 7, size: 17, markDuration: 5,
      description: "超高擊退；換位後獲得高速風衝與空中滯留。"
    },
    {
      id: "earth", name: "岩土", glyph: "岩", color: "#b98a5a",
      speed: 250, gravity: 620, damage: 24, size: 20, markDuration: 9,
      description: "重擊與破甲；換位後原地留下可站立石柱並短暫霸體。"
    },
    {
      id: "water", name: "流水", glyph: "水", color: "#4f8fff",
      speed: 340, gravity: 90, damage: 8, size: 14, markDuration: 9,
      description: "附加濕潤並熄滅火；換位後噴泉將玩家彈起並回復生命。"
    },
    {
      id: "light", name: "聖光", glyph: "光", color: "#fff8b3",
      speed: 430, gravity: 0, damage: 10, size: 12, markDuration: 8,
      description: "照出隱形物；換位時治療並獲得護盾。"
    },
    {
      id: "shadow", name: "暗影", glyph: "影", color: "#9d75ff",
      speed: 370, gravity: 0, damage: 14, size: 14, markDuration: 8,
      description: "能穿越影牆；換位後短暫相位無敵並留下影分身。"
    },
    {
      id: "nature", name: "自然", glyph: "藤", color: "#69d66f",
      speed: 280, gravity: 330, damage: 9, size: 14, markDuration: 10,
      description: "纏根敵人與喚醒種子；換位後生成可攀爬藤蔓。"
    },
    {
      id: "gravity", name: "引力", glyph: "引", color: "#ec77ff",
      speed: 185, gravity: -25, damage: 6, size: 22, markDuration: 11,
      description: "吸引周圍物件；換位後留下引力井並短暫低重力。"
    }
  ],

  // 四種職業都使用同一套基本操作，但 Q 與技能表現差異很大。
  CLASSES: {
    rift: {
      id: "rift", name: "裂隙劍士", icon: "⚔",
      maxHp: 180, maxMp: 120, moveScale: 1.05,
      summary: "近戰連段、浮空追擊與換位斬擊。",
      skills: ["裂空斬", "逆界挑空", "十相終刃"]
    },
    summoner: {
      id: "summoner", name: "靈契召喚師", icon: "🦊",
      maxHp: 135, maxMp: 180, moveScale: 0.98,
      summary: "浮光狐自動追擊；擅長遠距、召喚與護環。",
      skills: ["靈矢列陣", "契約護環", "大召喚・星獸"]
    },
    beast: {
      id: "beast", name: "百獸憑依者", icon: "🐺",
      maxHp: 165, maxMp: 135, moveScale: 1.03,
      summary: "Q 輪替狼／鷹／熊姿態，改變移動與攻擊特性。",
      skills: ["狼牙連襲", "蒼鷹墜擊", "百獸王化"]
    },
    artificer: {
      id: "artificer", name: "符文機巧師", icon: "⚙",
      maxHp: 145, maxMp: 165, moveScale: 0.96,
      summary: "設置炮台、磁軌砲與彈射平台，偏陣地控制。",
      skills: ["磁軌衝擊", "彈射平台", "超載回路"]
    }
  },

  ENEMIES: {
    slime: {name: "裂膠史萊姆", hp: 55, speed: 90, damage: 10, type: "melee", color: "#66d978"},
    archer: {name: "回路弓手", hp: 72, speed: 70, damage: 12, type: "ranged", color: "#e0aa55"},
    shield: {name: "盾式守衛", hp: 125, speed: 55, damage: 16, type: "shield", color: "#7e93a8"},
    bat: {name: "電翼蝠", hp: 45, speed: 145, damage: 9, type: "flying", color: "#d28aff"},
    turret: {name: "古代砲座", hp: 95, speed: 0, damage: 13, type: "turret", color: "#8fa6ad"},
    mage: {name: "幽相術士", hp: 90, speed: 68, damage: 14, type: "mage", color: "#866fd6"},
    golem: {name: "岩核巨像", hp: 220, speed: 38, damage: 22, type: "heavy", color: "#8e7054"},
    boss: {name: "十相哨兵", hp: 900, speed: 72, damage: 25, type: "boss", color: "#df4564"}
  },

  NPCS: [
    {name: "回路導師・璃安", role: "戰鬥教官", x: 650, text: "Z 是快攻、X 是重攻。試試 Z→Z→X 挑空，再跳起來追擊。元素換位可以取消很多落地硬直。"},
    {name: "機巧匠・鉚釘", role: "補給與改裝", x: 4700, text: "我先免費幫你補滿 HP 與 MP。以後這裡很適合改成商店、裝備強化或技能樹。"},
    {name: "馭獸師・斑", role: "百獸研究者", x: 8800, text: "百獸憑依者按 Q 可在狼、鷹、熊之間輪替；狼快、鷹擅空戰、熊耐打。"},
    {name: "失落檔案員・M3", role: "世界觀資料庫", x: 13750, text: "十相回路原本用來搬運能源。當『位置』也被視為能量的一部分後，交換技術才誕生。"}
  ],

  ZONES: [
    {x0: 0, x1: 2200, name: "01 餘燼訓練庭", sky: "#152238", ground: "#313c4d"},
    {x0: 2200, x1: 4400, name: "02 霜水導渠", sky: "#12354a", ground: "#24536b"},
    {x0: 4400, x1: 6700, name: "03 風岩採掘帶", sky: "#3d3528", ground: "#5b4c35"},
    {x0: 6700, x1: 9000, name: "04 百獸高架林", sky: "#17352d", ground: "#28513c"},
    {x0: 9000, x1: 11200, name: "05 明影資料庫", sky: "#211c38", ground: "#3d3457"},
    {x0: 11200, x1: 13500, name: "06 引力機巧站", sky: "#251c34", ground: "#4b3456"},
    {x0: 13500, x1: 15800, name: "07 十相崩裂區", sky: "#3a2028", ground: "#5c3137"},
    {x0: 15800, x1: 18000, name: "08 回路核心塔", sky: "#241827", ground: "#492735"}
  ],

  DEFAULT_KEYS: {
    left: "KeyA", right: "KeyD", aimUp: "KeyW", aimDown: "KeyS",
    jump: "Space", dash: "ShiftLeft", interact: "KeyF",
    lightAttack: "KeyZ", heavyAttack: "KeyX",
    skill1: "KeyC", skill2: "KeyV", skill3: "KeyB", classSkill: "KeyQ",
    element1: "Digit1", element2: "Digit2", element3: "Digit3", element4: "Digit4", element5: "Digit5",
    element6: "Digit6", element7: "Digit7", element8: "Digit8", element9: "Digit9", element10: "Digit0",
    reset: "KeyR", clearAnchor: "KeyG", help: "KeyH", pause: "KeyP", keyConfig: "KeyK"
  },

  ACTION_LABELS: {
    left: "向左", right: "向右", aimUp: "向上瞄準／攀爬", aimDown: "向下瞄準／攀爬",
    jump: "跳躍／二段跳", dash: "衝刺", interact: "互動",
    lightAttack: "Z 系快攻", heavyAttack: "X 系重攻",
    skill1: "技能 1", skill2: "技能 2", skill3: "技能 3", classSkill: "職業特殊 Q",
    element1: "火焰", element2: "冰霜", element3: "雷電", element4: "疾風", element5: "岩土",
    element6: "流水", element7: "聖光", element8: "暗影", element9: "自然", element10: "引力",
    reset: "回檢查點", clearAnchor: "清除元素錨點", help: "說明", pause: "暫停", keyConfig: "自訂按鍵"
  }
};
