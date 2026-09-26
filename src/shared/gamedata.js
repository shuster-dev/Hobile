import { NPC_QUESTS } from './story.js';
var ELEMENTS = {
    ember: {
      name: "Ember",
      he: "אש",
      color: 16739133,
      ui: "#ff6b3d",
      icon: "🔥"
    },
    aqua: {
      name: "Aqua",
      he: "מים",
      color: 4040191,
      ui: "#3da5ff",
      icon: "💧"
    },
    verdant: {
      name: "Verdant",
      he: "טבע",
      color: 5230950,
      ui: "#4fd166",
      icon: "🌿"
    },
    volt: {
      name: "Volt",
      he: "חשמל",
      color: 16765501,
      ui: "#ffd23d",
      icon: "⚡"
    },
    terra: {
      name: "Terra",
      he: "אדמה",
      color: 12618826,
      ui: "#c08c4a",
      icon: "🪨"
    },
    gale: {
      name: "Gale",
      he: "רוח",
      color: 10479837,
      ui: "#9fe8dd",
      icon: "🌪"
    },
    frost: {
      name: "Frost",
      he: "קרח",
      color: 9427199,
      ui: "#8fd8ff",
      icon: "❄"
    },
    umbra: {
      name: "Umbra",
      he: "אופל",
      color: 9133302,
      ui: "#8b5cf6",
      icon: "🌑"
    },
    lumen: {
      name: "Lumen",
      he: "אור",
      color: 16773800,
      ui: "#fff2a8",
      icon: "✨"
    },
    metal: {
      name: "Metal",
      he: "מתכת",
      color: 12174544,
      ui: "#b9c4d0",
      icon: "⚙"
    }
  },
  TYPE_CHART = {
    ember: {
      verdant: 2,
      frost: 2,
      metal: 2,
      aqua: 0.5,
      terra: 0.5,
      ember: 0.5
    },
    aqua: {
      ember: 2,
      terra: 2,
      verdant: 0.5,
      volt: 0.5,
      aqua: 0.5
    },
    verdant: {
      aqua: 2,
      terra: 2,
      ember: 0.5,
      gale: 0.5,
      frost: 0.5,
      verdant: 0.5
    },
    volt: {
      aqua: 2,
      gale: 2,
      terra: 0.5,
      verdant: 0.5,
      volt: 0.5
    },
    terra: {
      ember: 2,
      volt: 2,
      metal: 2,
      verdant: 0.5,
      gale: 0.5
    },
    gale: {
      verdant: 2,
      terra: 2,
      volt: 0.5,
      frost: 0.5,
      metal: 0.5
    },
    frost: {
      verdant: 2,
      gale: 2,
      terra: 2,
      ember: 0.5,
      metal: 0.5,
      frost: 0.5
    },
    umbra: {
      lumen: 2,
      gale: 2,
      metal: 0.5,
      umbra: 0.5
    },
    lumen: {
      umbra: 2,
      metal: 0.5,
      lumen: 0.5
    },
    metal: {
      frost: 2,
      lumen: 2,
      umbra: 2,
      ember: 0.5,
      terra: 0.5,
      metal: 0.5
    }
  };

function typeMultiplier(i, e) {
  let t = TYPE_CHART[i] || {},
    n = 1;
  for (let s of e) n *= t[s] ?? 1;
  return n;
}

var MOVES = {
    tackle: {
      id: "tackle",
      name: "Tackle",
      he: "נגיחה",
      type: null,
      kind: "physical",
      power: 34,
      acc: 1,
      cd: 1200,
      cost: 4
    },
    guard: {
      id: "guard",
      name: "Guard",
      he: "מגן",
      type: null,
      kind: "status",
      power: 0,
      acc: 1,
      cd: 8e3,
      cost: 8,
      effect: {
        shield: 0.5,
        dur: 3e3
      }
    },
    focus: {
      id: "focus",
      name: "Focus",
      he: "ריכוז",
      type: null,
      kind: "status",
      power: 0,
      acc: 1,
      cd: 12e3,
      cost: 6,
      effect: {
        atkUp: 0.35,
        dur: 8e3
      }
    },
    emberjab: {
      id: "emberjab",
      name: "Ember Jab",
      he: "ניצוץ",
      type: "ember",
      kind: "physical",
      power: 42,
      acc: 1,
      cd: 1800,
      cost: 7
    },
    cinderburst: {
      id: "cinderburst",
      name: "Cinder Burst",
      he: "פרץ גחלים",
      type: "ember",
      kind: "special",
      power: 62,
      acc: 0.95,
      cd: 3600,
      cost: 13,
      effect: {
        burn: 0.12,
        dur: 6e3
      }
    },
    magmawave: {
      id: "magmawave",
      name: "Magma Wave",
      he: "גל מאגמה",
      type: "ember",
      kind: "special",
      power: 96,
      acc: 0.85,
      cd: 9e3,
      cost: 24,
      aoe: !0
    },
    bubblelash: {
      id: "bubblelash",
      name: "Bubble Lash",
      he: "שוט בועות",
      type: "aqua",
      kind: "special",
      power: 40,
      acc: 1,
      cd: 1700,
      cost: 6
    },
    tidecrash: {
      id: "tidecrash",
      name: "Tide Crash",
      he: "נחשול",
      type: "aqua",
      kind: "special",
      power: 68,
      acc: 0.95,
      cd: 4e3,
      cost: 14
    },
    maelstrom: {
      id: "maelstrom",
      name: "Maelstrom",
      he: "מערבולת",
      type: "aqua",
      kind: "special",
      power: 92,
      acc: 0.85,
      cd: 9500,
      cost: 25,
      aoe: !0,
      effect: {
        slow: 0.3,
        dur: 4e3
      }
    },
    vinewhip: {
      id: "vinewhip",
      name: "Vine Whip",
      he: "שוט גפן",
      type: "verdant",
      kind: "physical",
      power: 41,
      acc: 1,
      cd: 1700,
      cost: 6
    },
    leechbloom: {
      id: "leechbloom",
      name: "Leech Bloom",
      he: "פריחה יונקת",
      type: "verdant",
      kind: "special",
      power: 55,
      acc: 0.95,
      cd: 5e3,
      cost: 15,
      effect: {
        lifesteal: 0.5
      }
    },
    thornstorm: {
      id: "thornstorm",
      name: "Thorn Storm",
      he: "סופת קוצים",
      type: "verdant",
      kind: "physical",
      power: 88,
      acc: 0.9,
      cd: 9e3,
      cost: 22,
      effect: {
        poison: 0.1,
        dur: 8e3
      }
    },
    sparkbite: {
      id: "sparkbite",
      name: "Spark Bite",
      he: "נשיכת ברק",
      type: "volt",
      kind: "physical",
      power: 43,
      acc: 1,
      cd: 1600,
      cost: 7
    },
    arcbolt: {
      id: "arcbolt",
      name: "Arc Bolt",
      he: "קשת חשמל",
      type: "volt",
      kind: "special",
      power: 66,
      acc: 0.95,
      cd: 3800,
      cost: 14,
      effect: {
        stun: 0.18,
        dur: 1200
      }
    },
    thunderdome: {
      id: "thunderdome",
      name: "Thunder Dome",
      he: "כיפת רעם",
      type: "volt",
      kind: "special",
      power: 95,
      acc: 0.85,
      cd: 1e4,
      cost: 26,
      aoe: !0
    },
    rockfling: {
      id: "rockfling",
      name: "Rock Fling",
      he: "הטלת סלע",
      type: "terra",
      kind: "physical",
      power: 45,
      acc: 0.95,
      cd: 1900,
      cost: 7
    },
    quakestep: {
      id: "quakestep",
      name: "Quake Step",
      he: "רעידה",
      type: "terra",
      kind: "physical",
      power: 70,
      acc: 0.9,
      cd: 4200,
      cost: 15,
      aoe: !0
    },
    bulwark: {
      id: "bulwark",
      name: "Bulwark",
      he: "חומה",
      type: "terra",
      kind: "status",
      power: 0,
      acc: 1,
      cd: 11e3,
      cost: 10,
      effect: {
        defUp: 0.5,
        dur: 9e3
      }
    },
    gustcut: {
      id: "gustcut",
      name: "Gust Cut",
      he: "חיתוך רוח",
      type: "gale",
      kind: "physical",
      power: 39,
      acc: 1,
      cd: 1400,
      cost: 5
    },
    cyclonelift: {
      id: "cyclonelift",
      name: "Cyclone Lift",
      he: "הרמת ציקלון",
      type: "gale",
      kind: "special",
      power: 64,
      acc: 0.95,
      cd: 3900,
      cost: 13,
      effect: {
        stun: 0.14,
        dur: 900
      }
    },
    tailwind: {
      id: "tailwind",
      name: "Tailwind",
      he: "רוח גבית",
      type: "gale",
      kind: "status",
      power: 0,
      acc: 1,
      cd: 14e3,
      cost: 9,
      effect: {
        hasteUp: 0.35,
        dur: 9e3,
        party: !0
      }
    },
    frostnip: {
      id: "frostnip",
      name: "Frost Nip",
      he: "נשיכת כפור",
      type: "frost",
      kind: "special",
      power: 40,
      acc: 1,
      cd: 1700,
      cost: 6,
      effect: {
        slow: 0.2,
        dur: 2500
      }
    },
    icelance: {
      id: "icelance",
      name: "Ice Lance",
      he: "רומח קרח",
      type: "frost",
      kind: "special",
      power: 69,
      acc: 0.95,
      cd: 4100,
      cost: 15
    },
    glacierfall: {
      id: "glacierfall",
      name: "Glacier Fall",
      he: "מפולת קרחון",
      type: "frost",
      kind: "special",
      power: 98,
      acc: 0.82,
      cd: 10500,
      cost: 27,
      aoe: !0,
      effect: {
        slow: 0.4,
        dur: 5e3
      }
    },
    shadowclaw: {
      id: "shadowclaw",
      name: "Shadow Claw",
      he: "טופר צל",
      type: "umbra",
      kind: "physical",
      power: 44,
      acc: 1,
      cd: 1700,
      cost: 7
    },
    duskbind: {
      id: "duskbind",
      name: "Dusk Bind",
      he: "כבלי אופל",
      type: "umbra",
      kind: "status",
      power: 0,
      acc: 0.9,
      cd: 9e3,
      cost: 12,
      effect: {
        defDown: 0.35,
        dur: 8e3
      }
    },
    voidpulse: {
      id: "voidpulse",
      name: "Void Pulse",
      he: "פעימת ריק",
      type: "umbra",
      kind: "special",
      power: 94,
      acc: 0.88,
      cd: 9800,
      cost: 25,
      effect: {
        lifesteal: 0.3
      }
    },
    glintray: {
      id: "glintray",
      name: "Glint Ray",
      he: "קרן נצנוץ",
      type: "lumen",
      kind: "special",
      power: 42,
      acc: 1,
      cd: 1700,
      cost: 6
    },
    mendinglight: {
      id: "mendinglight",
      name: "Mending Light",
      he: "אור מרפא",
      type: "lumen",
      kind: "status",
      power: 0,
      acc: 1,
      cd: 8500,
      cost: 16,
      effect: {
        heal: 0.28,
        party: !0
      }
    },
    solarlance: {
      id: "solarlance",
      name: "Solar Lance",
      he: "רומח שמש",
      type: "lumen",
      kind: "special",
      power: 97,
      acc: 0.87,
      cd: 9700,
      cost: 25
    },
    ironfang: {
      id: "ironfang",
      name: "Iron Fang",
      he: "ניב ברזל",
      type: "metal",
      kind: "physical",
      power: 46,
      acc: 0.97,
      cd: 1900,
      cost: 7
    },
    gearcrush: {
      id: "gearcrush",
      name: "Gear Crush",
      he: "מחץ גלגלים",
      type: "metal",
      kind: "physical",
      power: 72,
      acc: 0.92,
      cd: 4300,
      cost: 16,
      effect: {
        defDown: 0.25,
        dur: 6e3
      }
    },
    alloyaegis: {
      id: "alloyaegis",
      name: "Alloy Aegis",
      he: "מגן סגסוגת",
      type: "metal",
      kind: "status",
      power: 0,
      acc: 1,
      cd: 13e3,
      cost: 12,
      effect: {
        shield: 0.6,
        dur: 5e3,
        party: !0
      }
    }
  },
  ACTIONS = {
    strike: {
      id: "strike",
      name: "Strike",
      he: "מכה",
      power: 26,
      cd: 1500,
      cost: 0,
      kind: "physical"
    },
    sphere: {
      id: "sphere",
      name: "Throw Sphere",
      he: "זרוק כדור",
      power: 0,
      cd: 4e3,
      cost: 0,
      capture: !0
    },
    potion: {
      id: "potion",
      name: "Potion",
      he: "שיקוי",
      power: 0,
      cd: 9e3,
      cost: 0,
      heal: 0.35
    },
    rally: {
      id: "rally",
      name: "Rally",
      he: "עידוד",
      power: 0,
      cd: 16e3,
      cost: 0,
      effect: {
        atkUp: 0.3,
        dur: 8e3,
        party: !0
      }
    },
    flee: {
      id: "flee",
      name: "Flee",
      he: "בריחה",
      power: 0,
      cd: 2500,
      cost: 0,
      flee: !0
    }
  },
  def = i => i,
  SPECIES = {
    cindcub: def({
      id: "cindcub",
      name: "Cindcub",
      he: "סינדקאב",
      types: ["ember"],
      rarity: "starter",
      base: {
        hp: 46,
        atk: 52,
        def: 42,
        spa: 55,
        spd: 44,
        spe: 58
      },
      learn: [[1, "tackle"], [1, "emberjab"], [8, "focus"], [14, "cinderburst"], [24, "magmawave"]],
      evolve: {
        into: "pyrelynx",
        level: 16
      },
      model: {
        shape: "quad",
        a: 16747084,
        b: 16766624,
        scale: 0.85,
        horns: 1,
        tail: "flame",
        eyes: 2824982
      }
    }),
    pyrelynx: def({
      id: "pyrelynx",
      name: "Pyrelynx",
      he: "פיירלינקס",
      types: ["ember"],
      rarity: "evolved",
      base: {
        hp: 62,
        atk: 70,
        def: 55,
        spa: 74,
        spd: 58,
        spe: 76
      },
      learn: [[1, "emberjab"], [1, "tackle"], [18, "cinderburst"], [26, "focus"], [34, "magmawave"]],
      evolve: {
        into: "vulcanth",
        level: 34
      },
      model: {
        shape: "quad",
        a: 16736046,
        b: 16756812,
        scale: 1.05,
        horns: 2,
        tail: "flame",
        mane: !0,
        eyes: 16773312
      }
    }),
    vulcanth: def({
      id: "vulcanth",
      name: "Vulcanth",
      he: "וולקנת'",
      types: ["ember", "terra"],
      rarity: "final",
      base: {
        hp: 86,
        atk: 98,
        def: 82,
        spa: 96,
        spd: 80,
        spe: 84
      },
      learn: [[1, "emberjab"], [1, "quakestep"], [1, "cinderburst"], [40, "magmawave"], [46, "bulwark"]],
      model: {
        shape: "quad",
        a: 14236446,
        b: 8006164,
        scale: 1.35,
        horns: 3,
        tail: "flame",
        mane: !0,
        spikes: !0,
        eyes: 16765516
      }
    }),
    puddlet: def({
      id: "puddlet",
      name: "Puddlet",
      he: "פאדלט",
      types: ["aqua"],
      rarity: "starter",
      base: {
        hp: 54,
        atk: 44,
        def: 50,
        spa: 56,
        spd: 52,
        spe: 48
      },
      learn: [[1, "tackle"], [1, "bubblelash"], [8, "guard"], [14, "tidecrash"], [24, "maelstrom"]],
      evolve: {
        into: "tidefin",
        level: 16
      },
      model: {
        shape: "blob",
        a: 5224703,
        b: 13233407,
        scale: 0.8,
        fins: !0,
        eyes: 1192007
      }
    }),
    tidefin: def({
      id: "tidefin",
      name: "Tidefin",
      he: "טיידפין",
      types: ["aqua"],
      rarity: "evolved",
      base: {
        hp: 74,
        atk: 60,
        def: 68,
        spa: 76,
        spd: 70,
        spe: 64
      },
      learn: [[1, "bubblelash"], [1, "guard"], [18, "tidecrash"], [28, "icelance"], [34, "maelstrom"]],
      evolve: {
        into: "maelstride",
        level: 34
      },
      model: {
        shape: "serpent",
        a: 3117024,
        b: 10476799,
        scale: 1.1,
        fins: !0,
        eyes: 15268863
      }
    }),
    maelstride: def({
      id: "maelstride",
      name: "Maelstride",
      he: "מיילסטרייד",
      types: ["aqua", "gale"],
      rarity: "final",
      base: {
        hp: 92,
        atk: 78,
        def: 86,
        spa: 100,
        spd: 92,
        spe: 82
      },
      learn: [[1, "tidecrash"], [1, "cyclonelift"], [1, "guard"], [40, "maelstrom"], [46, "tailwind"]],
      model: {
        shape: "serpent",
        a: 2060224,
        b: 11071718,
        scale: 1.4,
        fins: !0,
        wings: !0,
        eyes: 16777215
      }
    }),
    sproutle: def({
      id: "sproutle",
      name: "Sproutle",
      he: "ספראוטל",
      types: ["verdant"],
      rarity: "starter",
      base: {
        hp: 50,
        atk: 48,
        def: 52,
        spa: 54,
        spd: 54,
        spe: 46
      },
      learn: [[1, "tackle"], [1, "vinewhip"], [8, "guard"], [14, "leechbloom"], [24, "thornstorm"]],
      evolve: {
        into: "thornkin",
        level: 16
      },
      model: {
        shape: "sprite",
        a: 7331198,
        b: 3111493,
        scale: 0.82,
        leaves: !0,
        eyes: 1326368
      }
    }),
    thornkin: def({
      id: "thornkin",
      name: "Thornkin",
      he: "ת'ורנקין",
      types: ["verdant"],
      rarity: "evolved",
      base: {
        hp: 70,
        atk: 68,
        def: 72,
        spa: 72,
        spd: 72,
        spe: 60
      },
      learn: [[1, "vinewhip"], [1, "leechbloom"], [20, "bulwark"], [30, "thornstorm"]],
      evolve: {
        into: "verdammoth",
        level: 34
      },
      model: {
        shape: "sprite",
        a: 4831330,
        b: 2055220,
        scale: 1.08,
        leaves: !0,
        spikes: !0,
        eyes: 14221263
      }
    }),
    verdammoth: def({
      id: "verdammoth",
      name: "Verdammoth",
      he: "ורדאמות'",
      types: ["verdant", "lumen"],
      rarity: "final",
      base: {
        hp: 96,
        atk: 84,
        def: 96,
        spa: 92,
        spd: 94,
        spe: 70
      },
      learn: [[1, "leechbloom"], [1, "glintray"], [1, "bulwark"], [40, "thornstorm"], [48, "mendinglight"]],
      model: {
        shape: "insect",
        a: 4170839,
        b: 16773800,
        scale: 1.35,
        wings: !0,
        leaves: !0,
        eyes: 16774856
      }
    }),
    sparkit: def({
      id: "sparkit",
      name: "Sparkit",
      he: "ספארקיט",
      types: ["volt"],
      rarity: "common",
      base: {
        hp: 44,
        atk: 50,
        def: 40,
        spa: 58,
        spd: 46,
        spe: 70
      },
      learn: [[1, "tackle"], [1, "sparkbite"], [12, "arcbolt"], [26, "thunderdome"]],
      evolve: {
        into: "voltmane",
        level: 22
      },
      model: {
        shape: "quad",
        a: 16769126,
        b: 16758531,
        scale: 0.8,
        tail: "bolt",
        eyes: 2826752
      }
    }),
    voltmane: def({
      id: "voltmane",
      name: "Voltmane",
      he: "וולטמיין",
      types: ["volt"],
      rarity: "evolved",
      base: {
        hp: 66,
        atk: 72,
        def: 58,
        spa: 84,
        spd: 64,
        spe: 96
      },
      learn: [[1, "sparkbite"], [1, "arcbolt"], [30, "thunderdome"], [38, "tailwind"]],
      model: {
        shape: "quad",
        a: 16765501,
        b: 16748319,
        scale: 1.12,
        mane: !0,
        tail: "bolt",
        eyes: 3811840
      }
    }),
    pebblin: def({
      id: "pebblin",
      name: "Pebblin",
      he: "פבלין",
      types: ["terra"],
      rarity: "common",
      base: {
        hp: 60,
        atk: 56,
        def: 68,
        spa: 38,
        spd: 52,
        spe: 32
      },
      learn: [[1, "tackle"], [1, "rockfling"], [12, "bulwark"], [22, "quakestep"]],
      evolve: {
        into: "boulderon",
        level: 24
      },
      model: {
        shape: "golem",
        a: 11041871,
        b: 7230003,
        scale: 0.9,
        spikes: !0,
        eyes: 16771524
      }
    }),
    boulderon: def({
      id: "boulderon",
      name: "Boulderon",
      he: "בולדרון",
      types: ["terra", "metal"],
      rarity: "evolved",
      base: {
        hp: 92,
        atk: 84,
        def: 106,
        spa: 52,
        spd: 78,
        spe: 40
      },
      learn: [[1, "rockfling"], [1, "bulwark"], [1, "ironfang"], [32, "quakestep"], [40, "gearcrush"]],
      model: {
        shape: "golem",
        a: 9136709,
        b: 12174544,
        scale: 1.3,
        spikes: !0,
        horns: 2,
        eyes: 16767114
      }
    }),
    zephyrb: def({
      id: "zephyrb",
      name: "Zephyrb",
      he: "זפירב",
      types: ["gale"],
      rarity: "common",
      base: {
        hp: 42,
        atk: 46,
        def: 40,
        spa: 52,
        spd: 46,
        spe: 74
      },
      learn: [[1, "gustcut"], [1, "tackle"], [12, "cyclonelift"], [24, "tailwind"]],
      evolve: {
        into: "cirrowing",
        level: 22
      },
      model: {
        shape: "avian",
        a: 13234922,
        b: 8374717,
        scale: 0.78,
        wings: !0,
        eyes: 1980982
      }
    }),
    cirrowing: def({
      id: "cirrowing",
      name: "Cirrowing",
      he: "סירואינג",
      types: ["gale", "lumen"],
      rarity: "evolved",
      base: {
        hp: 64,
        atk: 66,
        def: 58,
        spa: 80,
        spd: 68,
        spe: 100
      },
      learn: [[1, "gustcut"], [1, "cyclonelift"], [1, "glintray"], [34, "tailwind"], [42, "solarlance"]],
      model: {
        shape: "avian",
        a: 15400184,
        b: 16773800,
        scale: 1.12,
        wings: !0,
        eyes: 16775384
      }
    }),
    frostnib: def({
      id: "frostnib",
      name: "Frostnib",
      he: "פרוסטניב",
      types: ["frost"],
      rarity: "common",
      base: {
        hp: 52,
        atk: 42,
        def: 54,
        spa: 60,
        spd: 58,
        spe: 44
      },
      learn: [[1, "frostnip"], [1, "guard"], [14, "icelance"], [28, "glacierfall"]],
      evolve: {
        into: "glacilisk",
        level: 26
      },
      model: {
        shape: "blob",
        a: 12577535,
        b: 7321320,
        scale: 0.84,
        spikes: !0,
        eyes: 1192007
      }
    }),
    glacilisk: def({
      id: "glacilisk",
      name: "Glacilisk",
      he: "גלאסיליסק",
      types: ["frost", "metal"],
      rarity: "evolved",
      base: {
        hp: 80,
        atk: 66,
        def: 92,
        spa: 88,
        spd: 86,
        spe: 56
      },
      learn: [[1, "icelance"], [1, "alloyaegis"], [34, "glacierfall"], [40, "gearcrush"]],
      model: {
        shape: "serpent",
        a: 10475765,
        b: 13095902,
        scale: 1.28,
        spikes: !0,
        horns: 2,
        eyes: 15400959
      }
    }),
    umbrat: def({
      id: "umbrat",
      name: "Umbrat",
      he: "אומברט",
      types: ["umbra"],
      rarity: "common",
      base: {
        hp: 46,
        atk: 58,
        def: 42,
        spa: 54,
        spd: 44,
        spe: 66
      },
      learn: [[1, "shadowclaw"], [1, "tackle"], [14, "duskbind"], [28, "voidpulse"]],
      evolve: {
        into: "nocturnix",
        level: 24
      },
      model: {
        shape: "insect",
        a: 7162805,
        b: 2363960,
        scale: 0.8,
        wings: !0,
        eyes: 16740312
      }
    }),
    nocturnix: def({
      id: "nocturnix",
      name: "Nocturnix",
      he: "נוקטורניקס",
      types: ["umbra", "gale"],
      rarity: "evolved",
      base: {
        hp: 70,
        atk: 88,
        def: 62,
        spa: 80,
        spd: 64,
        spe: 94
      },
      learn: [[1, "shadowclaw"], [1, "gustcut"], [1, "duskbind"], [34, "voidpulse"]],
      model: {
        shape: "avian",
        a: 4992902,
        b: 1707819,
        scale: 1.15,
        wings: !0,
        horns: 2,
        eyes: 16748512
      }
    }),
    glimmer: def({
      id: "glimmer",
      name: "Glimmer",
      he: "גלימר",
      types: ["lumen"],
      rarity: "common",
      base: {
        hp: 48,
        atk: 40,
        def: 46,
        spa: 64,
        spd: 62,
        spe: 58
      },
      learn: [[1, "glintray"], [1, "guard"], [14, "mendinglight"], [30, "solarlance"]],
      evolve: {
        into: "solaraith",
        level: 26
      },
      model: {
        shape: "sprite",
        a: 16773800,
        b: 16765020,
        scale: 0.76,
        glow: !0,
        eyes: 7031552
      }
    }),
    solaraith: def({
      id: "solaraith",
      name: "Solaraith",
      he: "סולארית'",
      types: ["lumen", "ember"],
      rarity: "evolved",
      base: {
        hp: 74,
        atk: 62,
        def: 70,
        spa: 100,
        spd: 88,
        spe: 74
      },
      learn: [[1, "glintray"], [1, "mendinglight"], [1, "cinderburst"], [36, "solarlance"]],
      model: {
        shape: "sprite",
        a: 16771466,
        b: 16751164,
        scale: 1.18,
        glow: !0,
        wings: !0,
        eyes: 16776166
      }
    }),
    coglet: def({
      id: "coglet",
      name: "Coglet",
      he: "קוגלט",
      types: ["metal"],
      rarity: "common",
      base: {
        hp: 54,
        atk: 58,
        def: 66,
        spa: 44,
        spd: 50,
        spe: 40
      },
      learn: [[1, "ironfang"], [1, "guard"], [14, "gearcrush"], [30, "alloyaegis"]],
      evolve: {
        into: "ferrogeist",
        level: 26
      },
      model: {
        shape: "golem",
        a: 12174544,
        b: 7306378,
        scale: 0.86,
        gears: !0,
        eyes: 7336191
      }
    }),
    ferrogeist: def({
      id: "ferrogeist",
      name: "Ferrogeist",
      he: "פרוגייסט",
      types: ["metal", "umbra"],
      rarity: "evolved",
      base: {
        hp: 82,
        atk: 90,
        def: 98,
        spa: 66,
        spd: 76,
        spe: 58
      },
      learn: [[1, "ironfang"], [1, "gearcrush"], [1, "duskbind"], [38, "alloyaegis"], [44, "voidpulse"]],
      model: {
        shape: "golem",
        a: 9279912,
        b: 3813206,
        scale: 1.3,
        gears: !0,
        spikes: !0,
        eyes: 12152831
      }
    }),
    mossnail: def({
      id: "mossnail",
      name: "Mossnail",
      he: "מוסנייל",
      types: ["verdant", "aqua"],
      rarity: "common",
      base: {
        hp: 66,
        atk: 44,
        def: 74,
        spa: 50,
        spd: 66,
        spe: 26
      },
      learn: [[1, "vinewhip"], [1, "bubblelash"], [16, "guard"], [28, "leechbloom"]],
      model: {
        shape: "blob",
        a: 8374666,
        b: 4165534,
        scale: 0.9,
        shell: !0,
        eyes: 1850154
      }
    }),
    emberfly: def({
      id: "emberfly",
      name: "Emberfly",
      he: "אמברפליי",
      types: ["ember", "gale"],
      rarity: "common",
      base: {
        hp: 44,
        atk: 54,
        def: 40,
        spa: 62,
        spd: 46,
        spe: 82
      },
      learn: [[1, "emberjab"], [1, "gustcut"], [16, "cinderburst"], [30, "cyclonelift"]],
      model: {
        shape: "insect",
        a: 16751180,
        b: 16769192,
        scale: 0.74,
        wings: !0,
        eyes: 3874048
      }
    }),
    duskmaw: def({
      id: "duskmaw",
      name: "Duskmaw",
      he: "דאסקמאו",
      types: ["umbra", "frost"],
      rarity: "rare",
      base: {
        hp: 84,
        atk: 96,
        def: 74,
        spa: 88,
        spd: 72,
        spe: 88
      },
      learn: [[1, "shadowclaw"], [1, "icelance"], [1, "duskbind"], [36, "voidpulse"], [44, "glacierfall"]],
      model: {
        shape: "serpent",
        a: 3877475,
        b: 9427199,
        scale: 1.4,
        spikes: !0,
        horns: 3,
        eyes: 8256255
      }
    }),
    aurorix: def({
      id: "aurorix",
      name: "Aurorix",
      he: "אורוריקס",
      types: ["lumen", "frost"],
      rarity: "legendary",
      base: {
        hp: 100,
        atk: 88,
        def: 92,
        spa: 112,
        spd: 104,
        spe: 96
      },
      learn: [[1, "glintray"], [1, "icelance"], [1, "mendinglight"], [40, "solarlance"], [50, "glacierfall"]],
      model: {
        shape: "avian",
        a: 14677759,
        b: 11075558,
        scale: 1.6,
        wings: !0,
        glow: !0,
        horns: 2,
        eyes: 16777215
      }
    }),
    magmadon: def({
      id: "magmadon",
      name: "Magmadon",
      he: "מגמדון",
      types: ["ember", "terra"],
      rarity: "boss",
      base: {
        hp: 320,
        atk: 130,
        def: 120,
        spa: 120,
        spd: 110,
        spe: 60
      },
      learn: [[1, "magmawave"], [1, "quakestep"], [1, "emberjab"], [1, "bulwark"]],
      model: {
        shape: "golem",
        a: 12596250,
        b: 2823184,
        scale: 3.2,
        horns: 3,
        spikes: !0,
        glow: !0,
        eyes: 16756796
      }
    }),
    leviathorn: def({
      id: "leviathorn",
      name: "Leviathorn",
      he: "לוויאת'ורן",
      types: ["aqua", "frost"],
      rarity: "boss",
      base: {
        hp: 340,
        atk: 118,
        def: 126,
        spa: 132,
        spd: 124,
        spe: 66
      },
      learn: [[1, "maelstrom"], [1, "glacierfall"], [1, "tidecrash"], [1, "guard"]],
      model: {
        shape: "serpent",
        a: 1859486,
        b: 11069695,
        scale: 3.4,
        fins: !0,
        spikes: !0,
        eyes: 15269887
      }
    }),
    nullwarden: def({
      id: "nullwarden",
      name: "Nullwarden",
      he: "נאלוורדן",
      types: ["umbra", "metal"],
      rarity: "boss",
      base: {
        hp: 380,
        atk: 140,
        def: 140,
        spa: 126,
        spd: 128,
        spe: 58
      },
      learn: [[1, "voidpulse"], [1, "gearcrush"], [1, "duskbind"], [1, "alloyaegis"]],
      model: {
        shape: "golem",
        a: 3024197,
        b: 10135220,
        scale: 3.6,
        gears: !0,
        horns: 3,
        glow: !0,
        eyes: 12611583
      }
    }),
    rootfather: def({
      id: "rootfather",
      name: "Rootfather",
      he: "אבי-השורש",
      types: ["verdant"],
      rarity: "boss",
      base: {
        hp: 260,
        atk: 112,
        def: 128,
        spa: 104,
        spd: 116,
        spe: 44
      },
      learn: [[1, "thornstorm"], [1, "leechbloom"], [1, "bulwark"], [1, "vinewhip"]],
      model: {
        shape: "golem",
        a: 4160069,
        b: 7031338,
        scale: 2.8,
        leaves: !0,
        spikes: !0,
        eyes: 14221210
      }
    }),
    stormcaller: def({
      id: "stormcaller",
      name: "Stormcaller",
      he: "קורא-הסופה",
      types: ["volt", "gale"],
      rarity: "boss",
      base: {
        hp: 270,
        atk: 120,
        def: 104,
        spa: 138,
        spd: 108,
        spe: 96
      },
      learn: [[1, "thunderdome"], [1, "cyclonelift"], [1, "arcbolt"], [1, "tailwind"]],
      model: {
        shape: "avian",
        a: 16765501,
        b: 7326207,
        scale: 3,
        wings: !0,
        glow: !0,
        eyes: 16777215
      }
    }),
    hollowking: def({
      id: "hollowking",
      name: "Hollow King",
      he: "מלך החלול",
      types: ["umbra"],
      rarity: "boss",
      base: {
        hp: 300,
        atk: 134,
        def: 116,
        spa: 124,
        spd: 112,
        spe: 74
      },
      learn: [[1, "voidpulse"], [1, "shadowclaw"], [1, "duskbind"], [1, "focus"]],
      model: {
        shape: "sprite",
        a: 2759493,
        b: 10116351,
        scale: 3,
        glow: !0,
        horns: 3,
        eyes: 16735456
      }
    })
  },
  STARTERS = ["cindcub", "puddlet", "sproutle"],
  // How a species takes to a trainer walking through its ground. Anything not
  // listed is calm: it wanders, and it only fights when you start it.
  //   fierce     sees you, shouts, comes for you (server/game/field.js)
  //   nocturnal  calm by day, fierce after dark
  // Past the meadow, each zone's fierce ones are mostly of its own element, so
  // a companion of that element is the way to walk it in peace; and every
  // zone keeps calm ones too, so none is a gauntlet (tools/qa.mjs holds the
  // line at 60% of a zone's spawns, day or night).
  TEMPER = {
    cindcub: "fierce",
    pyrelynx: "fierce",
    vulcanth: "fierce",
    tidefin: "fierce",
    maelstride: "fierce",
    thornkin: "fierce",
    verdammoth: "fierce",
    sparkit: "fierce",
    voltmane: "fierce",
    boulderon: "fierce",
    frostnib: "fierce",
    glacilisk: "fierce",
    ferrogeist: "fierce",
    duskmaw: "fierce",
    nocturnix: "nocturnal"
  },
  ITEMS = {
    sphere_basic: {
      id: "sphere_basic",
      name: "Aether Sphere",
      he: "כדור אתר",
      kind: "sphere",
      rate: 1,
      // Two early wins, not four: at 200 a first catch cost six to eight
      // fights of gold (tools/balance.mjs). The workshop still makes five for
      // about the price of two.
      price: 100,
      icon: "🔵"
    },
    sphere_great: {
      id: "sphere_great",
      name: "Prism Sphere",
      he: "כדור פריזמה",
      kind: "sphere",
      rate: 1.6,
      price: 700,
      icon: "🟣"
    },
    sphere_ultra: {
      id: "sphere_ultra",
      name: "Nova Sphere",
      he: "כדור נובה",
      kind: "sphere",
      rate: 2.6,
      price: 2200,
      icon: "🟠"
    },
    potion_s: {
      id: "potion_s",
      name: "Salve",
      he: "משחה",
      kind: "heal",
      amount: 60,
      price: 100,
      icon: "🧪"
    },
    potion_m: {
      id: "potion_m",
      name: "Tonic",
      he: "תרכיז",
      kind: "heal",
      amount: 180,
      price: 450,
      icon: "🧪"
    },
    potion_l: {
      id: "potion_l",
      name: "Elixir",
      he: "אליקסיר",
      kind: "heal",
      amount: 480,
      price: 1400,
      icon: "🧪"
    },
    revive: {
      id: "revive",
      name: "Ember Feather",
      he: "נוצת גחלים",
      kind: "revive",
      ratio: 0.5,
      price: 1800,
      icon: "🪶"
    },
    revive_full: {
      id: "revive_full",
      name: "Phoenix Plume",
      he: "נוצת עוף החול",
      kind: "revive",
      ratio: 1,
      price: 4800,
      icon: "🕊"
    },
    ether: {
      id: "ether",
      name: "Ether Dust",
      he: "אבק אתר",
      kind: "stamina",
      amount: 60,
      price: 380,
      icon: "💠"
    },
    bandage: {
      id: "bandage",
      name: "Field Bandage",
      he: "תחבושת",
      kind: "trainerHeal",
      amount: 45,
      price: 120,
      icon: "🩹"
    },
    medkit: {
      id: "medkit",
      name: "Medkit",
      he: "ערכת עזרה",
      kind: "trainerHeal",
      amount: 160,
      price: 520,
      icon: "⛑"
    },
    blade_iron: {
      id: "blade_iron",
      name: "Iron Blade",
      he: "להב ברזל",
      kind: "gear",
      slot: "weapon",
      bonus: {
        atk: 8
      },
      price: 900,
      icon: "🗡"
    },
    blade_storm: {
      id: "blade_storm",
      name: "Stormbrand",
      he: "חרב הסופה",
      kind: "gear",
      slot: "weapon",
      bonus: {
        atk: 22,
        spe: 6
      },
      price: 5200,
      icon: "🗡"
    },
    vest_hide: {
      id: "vest_hide",
      name: "Hide Vest",
      he: "אפוד עור",
      kind: "gear",
      slot: "armor",
      bonus: {
        def: 9,
        hp: 20
      },
      price: 850,
      icon: "🥋"
    },
    vest_aegis: {
      id: "vest_aegis",
      name: "Aegis Plate",
      he: "שריון אגיס",
      kind: "gear",
      slot: "armor",
      bonus: {
        def: 26,
        hp: 70
      },
      price: 5400,
      icon: "🛡"
    },
    charm_focus: {
      id: "charm_focus",
      name: "Focus Charm",
      he: "קמע ריכוז",
      kind: "gear",
      slot: "trinket",
      bonus: {
        spa: 12,
        spd: 6
      },
      price: 1600,
      icon: "📿"
    },
    charm_swift: {
      id: "charm_swift",
      name: "Swift Charm",
      he: "קמע זריזות",
      kind: "gear",
      slot: "trinket",
      bonus: {
        spe: 18
      },
      price: 1600,
      icon: "📿"
    },
    mat_emberdust: {
      id: "mat_emberdust",
      name: "Ember Dust",
      he: "אבק גחלים",
      kind: "material",
      icon: "🔶"
    },
    mat_tidepearl: {
      id: "mat_tidepearl",
      name: "Tide Pearl",
      he: "פנינת גאות",
      kind: "material",
      icon: "🔷"
    },
    mat_verdseed: {
      id: "mat_verdseed",
      name: "Verdant Seed",
      he: "זרע ירוק",
      kind: "material",
      icon: "🌱"
    },
    mat_voidshard: {
      id: "mat_voidshard",
      name: "Void Shard",
      he: "רסיס ריק",
      kind: "material",
      icon: "🔮"
    }
  },
  ZONES = {
    aetherport: {
      id: "aetherport",
      name: "Aetherport",
      he: "נמל האתר",
      levels: [2, 5],
      ground: 6120563,
      accent: 3817552,
      sky: 9418456,
      capturable: !1,
      size: 130,
      urban: !0,
      safe: !0,
      water: {
        z: -38,
        level: -1.35,
        color: 1919587
      },
      rift: {
        x: 0,
        y: 28,
        z: -52,
        r: 10
      },
      spawns: [["sparkit", 20], ["mossnail", 20], ["pebblin", 20], ["coglet", 20], ["zephyrb", 20]],
      landmarks: [{
        kind: "plaza",
        name: "Shard Plaza",
        he: "כיכר הרסיס",
        x: 0,
        z: 0,
        r: 9
      }, {
        kind: "archive",
        name: "The Archive",
        he: "הארכיון",
        x: -12,
        z: -12,
        r: 7.5,
        npc: "maro",
        interior: "archive",
        door: {
          x: -12,
          z: -6.5
        }
      }, {
        kind: "shop",
        name: "Market Row",
        he: "שוק הרחוב",
        x: -12,
        z: 12,
        r: 7.5,
        npc: "tavi",
        interior: "shop",
        door: {
          x: -12,
          z: 17.5
        }
      }, {
        kind: "workshop",
        name: "Ren’s Workshop",
        he: "המסגרייה של רן",
        x: 12,
        z: -12,
        r: 7.5,
        npc: "ren",
        interior: "workshop",
        door: {
          x: 12,
          z: -6.5
        }
      }, {
        kind: "clinic",
        name: "Tideward Clinic",
        he: "מרפאת הגאות",
        x: -36,
        z: 12,
        r: 7.5,
        interior: "clinic",
        door: {
          x: -36,
          z: 17.5
        }
      }, {
        kind: "base",
        name: "Your Yard",
        he: "החצר שלך",
        x: 12,
        z: 12,
        r: 7.5
      }, {
        kind: "pier",
        name: "Rift Pier",
        he: "מזח הקרע",
        x: 0,
        z: -44,
        r: 8
      }, {
        kind: "gate",
        name: "North Gate",
        he: "השער הצפוני",
        x: 0,
        z: 36,
        r: 5,
        npc: "sela"
      }, {
        kind: "dungeon",
        to: "undercity_cistern",
        x: -36,
        z: -12
      }, {
        kind: "portal",
        to: "verdant_meadow",
        x: 0,
        z: 46
      }, {
        kind: "portal",
        gate: "ember",
        to: "emberfall_canyon",
        x: -9,
        z: -40,
        name: "Flame Gate",
        he: "שער הלהבה",
        band: [8, 16]
      }, {
        kind: "portal",
        gate: "aqua",
        to: "tidal_hollow",
        x: -3,
        z: -47,
        name: "Tide Gate",
        he: "שער הגאות",
        band: [14, 24]
      }, {
        kind: "portal",
        gate: "terra",
        to: "stonewake_mesa",
        x: 3,
        z: -47,
        name: "Stone Gate",
        he: "שער האבן",
        band: [10, 20]
      }, {
        kind: "portal",
        gate: "volt",
        to: "stormreach_heights",
        x: 9,
        z: -40,
        name: "Storm Gate",
        he: "שער הסופה",
        band: [18, 28]
      }]
    },
    verdant_meadow: {
      id: "verdant_meadow",
      name: "Verdant Meadow",
      he: "אחו הירוק",
      levels: [3, 8],
      ground: 6531422,
      accent: 4160069,
      sky: 9425151,
      capturable: !0,
      element: "verdant",
      size: 120,
      spawns: [["sproutle", 18], ["cindcub", 10], ["puddlet", 10], ["sparkit", 16], ["zephyrb", 16], ["pebblin", 16], ["mossnail", 14]],
      landmarks: [{
        kind: "camp",
        name: "Meadow Watch",
        he: "משמר האחו",
        x: 0,
        z: 34,
        r: 10
      }, {
        kind: "portal",
        to: "aetherport",
        x: 2,
        z: 46
      }, {
        kind: "portal",
        to: "emberfall_canyon",
        x: 48,
        z: -34
      }]
    },
    stonewake_mesa: {
      id: "stonewake_mesa",
      name: "Stonewake Mesa",
      he: "מישורי האבן",
      levels: [10, 20],
      ground: 11041358,
      accent: 7162412,
      sky: 15255450,
      capturable: !0,
      element: "terra",
      size: 132,
      spawns: [["pebblin", 22], ["boulderon", 12], ["coglet", 16], ["mossnail", 14], ["cindcub", 10], ["ferrogeist", 8], ["sproutle", 10], ["duskmaw", 3]],
      landmarks: [{
        kind: "camp",
        name: "Quarry Rest",
        he: "מנוחת המחצבה",
        x: -18,
        z: 20,
        r: 10
      }, {
        kind: "portal",
        to: "aetherport",
        x: 0,
        z: 50
      }, {
        kind: "portal",
        to: "emberfall_canyon",
        x: 46,
        z: -38
      }, {
        kind: "dungeon",
        to: "sunken_vault",
        x: 20,
        z: 26
      }]
    },
    stormreach_heights: {
      id: "stormreach_heights",
      name: "Stormreach Heights",
      he: "רמות הסופה",
      levels: [18, 28],
      ground: 4871536,
      accent: 2830919,
      sky: 7176112,
      capturable: !0,
      element: "volt",
      size: 134,
      spawns: [["sparkit", 20], ["voltmane", 14], ["zephyrb", 14], ["cirrowing", 12], ["coglet", 12], ["frostnib", 10], ["glimmer", 10], ["ferrogeist", 6]],
      landmarks: [{
        kind: "camp",
        name: "Mast Camp",
        he: "מחנה התורן",
        x: 16,
        z: 18,
        r: 10
      }, {
        kind: "portal",
        to: "aetherport",
        x: 0,
        z: 52
      }, {
        kind: "portal",
        to: "frostpeak_ridge",
        x: -48,
        z: -40
      }, {
        kind: "dungeon",
        to: "storm_spire",
        x: -22,
        z: 24
      }]
    },
    emberfall_canyon: {
      id: "emberfall_canyon",
      name: "Emberfall Canyon",
      he: "קניון האש",
      levels: [8, 16],
      ground: 11822138,
      accent: 8008992,
      sky: 16757370,
      capturable: !0,
      element: "ember",
      size: 130,
      spawns: [["cindcub", 18], ["emberfly", 20], ["pebblin", 18], ["sparkit", 14], ["pyrelynx", 8], ["coglet", 12], ["boulderon", 4]],
      landmarks: [{
        kind: "camp",
        name: "Cinder Camp",
        he: "מחנה הגחלים",
        x: -20,
        z: 18,
        r: 10
      }, {
        kind: "portal",
        to: "aetherport",
        x: 0,
        z: 50
      }, {
        kind: "portal",
        to: "verdant_meadow",
        x: -52,
        z: 36
      }, {
        kind: "portal",
        to: "tidal_hollow",
        x: 44,
        z: -40
      }, {
        kind: "dungeon",
        to: "sunken_vault",
        x: 22,
        z: 30
      }]
    },
    tidal_hollow: {
      id: "tidal_hollow",
      name: "Tidal Hollow",
      he: "מפרץ הגאות",
      levels: [14, 24],
      ground: 3112847,
      accent: 1855324,
      sky: 8379647,
      capturable: !0,
      element: "aqua",
      size: 130,
      spawns: [["puddlet", 16], ["tidefin", 12], ["mossnail", 18], ["zephyrb", 12], ["frostnib", 12], ["glimmer", 12], ["cirrowing", 6]],
      landmarks: [{
        kind: "camp",
        name: "Hollow Docks",
        he: "מזח החלול",
        x: 18,
        z: -12,
        r: 10
      }, {
        kind: "portal",
        to: "aetherport",
        x: 0,
        z: 50
      }, {
        kind: "portal",
        to: "emberfall_canyon",
        x: -48,
        z: 42
      }, {
        kind: "portal",
        to: "frostpeak_ridge",
        x: 46,
        z: -44
      }, {
        kind: "dungeon",
        to: "storm_spire",
        x: -26,
        z: -28
      }]
    },
    frostpeak_ridge: {
      id: "frostpeak_ridge",
      name: "Frostpeak Ridge",
      he: "רכס הכפור",
      levels: [22, 32],
      ground: 14085375,
      accent: 9418968,
      sky: 12575999,
      capturable: !0,
      element: "frost",
      size: 140,
      spawns: [["frostnib", 20], ["glacilisk", 8], ["coglet", 14], ["zephyrb", 12], ["glimmer", 14], ["cirrowing", 10], ["duskmaw", 3]],
      landmarks: [{
        kind: "camp",
        name: "Rime Outpost",
        he: "מוצב הכפור",
        x: -14,
        z: -20,
        r: 10
      }, {
        kind: "portal",
        to: "tidal_hollow",
        x: -50,
        z: 46
      }, {
        kind: "portal",
        to: "umbral_grove",
        x: 48,
        z: -46
      }]
    },
    umbral_grove: {
      id: "umbral_grove",
      name: "Umbral Grove",
      he: "חורש האופל",
      levels: [30, 45],
      ground: 3682396,
      accent: 1906483,
      sky: 2761552,
      capturable: !0,
      element: "umbra",
      size: 140,
      spawns: [["umbrat", 20], ["nocturnix", 12], ["ferrogeist", 10], ["duskmaw", 8], ["glacilisk", 8], ["solaraith", 6], ["aurorix", 1]],
      landmarks: [{
        kind: "camp",
        name: "Lantern Rest",
        he: "מנוחת הפנס",
        x: 12,
        z: 22,
        r: 10
      }, {
        kind: "portal",
        to: "frostpeak_ridge",
        x: -52,
        z: 48
      }, {
        kind: "dungeon",
        to: "hollow_keep",
        x: -20,
        z: -30
      }]
    }
  },
  HOME_ZONE = "aetherport",
  // How hard a zone's wilds fight. `scale` multiplies a wild's stats in the
  // fight (one that is caught is an ordinary creature of its level); `ai` is
  // how it picks its moves and how quickly (AI_TIERS in server/game/combat.js).
  // The port and the meadow are where a new trainer learns with one creature;
  // the last three zones are for teams. Measured with tools/balance.mjs and
  // held by tools/qa.mjs. `ambushAbove`: a fierce wild more levels than this
  // above your companion leaves you alone here (server/game/field.js) — in
  // the first zones an ambush should be a fight you can win.
  WILD_TIERS = {
    aetherport: { scale: 0.78, ai: "novice", ambushAbove: 1 },
    verdant_meadow: { scale: 0.85, ai: "novice", ambushAbove: 1 },
    emberfall_canyon: { scale: 0.9, ai: "standard", ambushAbove: 3 },
    stonewake_mesa: { scale: 0.95, ai: "standard", ambushAbove: 3 },
    tidal_hollow: { scale: 0.97, ai: "standard", ambushAbove: 3 },
    stormreach_heights: { scale: 1.1, ai: "veteran" },
    frostpeak_ridge: { scale: 1.1, ai: "veteran" },
    umbral_grove: { scale: 1.15, ai: "veteran" }
  },
  DUNGEONS = {
    undercity_cistern: {
      id: "undercity_cistern",
      name: "Undercity Cistern",
      he: "בורות העיר התחתית",
      minLevel: 5,
      floors: 2,
      partyMax: 4,
      element: "aqua",
      trash: ["mossnail", "puddlet", "coglet", "pebblin"],
      boss: "rootfather",
      rewards: {
        gold: [200, 500],
        items: ["sphere_basic", "potion_s", "scrap_iron"]
      }
    },
    sunken_vault: {
      id: "sunken_vault",
      name: "Sunken Vault",
      he: "הכספת הטבועה",
      minLevel: 10,
      floors: 3,
      partyMax: 4,
      element: "aqua",
      trash: ["mossnail", "puddlet", "tidefin", "coglet"],
      boss: "rootfather",
      rewards: {
        gold: [400, 900],
        items: ["mat_tidepearl", "potion_m", "sphere_great"]
      }
    },
    storm_spire: {
      id: "storm_spire",
      name: "Storm Spire",
      he: "צריח הסופה",
      minLevel: 22,
      floors: 4,
      partyMax: 4,
      element: "volt",
      trash: ["sparkit", "voltmane", "zephyrb", "cirrowing"],
      boss: "stormcaller",
      rewards: {
        gold: [900, 1800],
        items: ["charm_swift", "potion_l", "sphere_great"]
      }
    },
    hollow_keep: {
      id: "hollow_keep",
      name: "Hollow Keep",
      he: "מצודת החלול",
      minLevel: 34,
      floors: 5,
      partyMax: 4,
      element: "umbra",
      trash: ["umbrat", "nocturnix", "ferrogeist", "duskmaw"],
      boss: "hollowking",
      rewards: {
        gold: [2e3, 4200],
        items: ["mat_voidshard", "vest_aegis", "sphere_ultra"]
      }
    }
  },
  WORLD_BOSSES = [{
    id: "wb_magmadon",
    species: "magmadon",
    zone: "emberfall_canyon",
    x: 10,
    z: -22,
    level: 22,
    everyMinutes: 20,
    windowMinutes: 6
  }, {
    id: "wb_leviathorn",
    species: "leviathorn",
    zone: "tidal_hollow",
    x: -18,
    z: 16,
    level: 30,
    everyMinutes: 25,
    windowMinutes: 6
  }, {
    id: "wb_nullwarden",
    species: "nullwarden",
    zone: "umbral_grove",
    x: 0,
    z: -14,
    level: 42,
    everyMinutes: 30,
    windowMinutes: 8
  }],
  QUESTS = {
    q_main_01: {
      id: "q_main_01",
      chain: "main",
      step: 1,
      name: "First Bond",
      he: "הקשר הראשון",
      desc: "Speak with Elder Maro at the Archive and receive your starter.",
      descHe: "דבר עם הזקן מארו בארכיון וקבל את היצור הראשון שלך.",
      goal: {
        kind: "talk",
        target: "maro"
      },
      reward: {
        gold: 200,
        items: [["sphere_basic", 5]],
        xp: 40
      }
    },
    q_main_02: {
      id: "q_main_02",
      chain: "main",
      step: 3,
      name: "Shards in the Street",
      he: "רסיסים ברחוב",
      desc: "Tavi runs Market Row. Go hear what she has been buying lately.",
      descHe: "טאבי מנהלת את שוק הרחוב. לך לשמוע מה היא קונה לאחרונה.",
      goal: {
        kind: "talk",
        target: "tavi"
      },
      reward: {
        gold: 400,
        items: [["potion_s", 3]],
        xp: 130
      }
    },
    q_main_03: {
      id: "q_main_03",
      chain: "main",
      step: 4,
      name: "Your Yard",
      he: "החצר שלך",
      desc: "The city granted you the empty lot east of the plaza. Go and stand in it.",
      descHe: "העירייה הקצתה לך את המגרש הריק ממזרח לכיכר. לך ותעמוד בו.",
      goal: {
        kind: "visit",
        target: "base",
        zone: "aetherport"
      },
      reward: {
        gold: 500,
        items: [["scrap_iron", 6], ["fiber", 6]],
        xp: 190
      }
    },
    q_main_04: {
      id: "q_main_04",
      chain: "main",
      step: 5,
      name: "The First Forge",
      he: "ההיתוך הראשון",
      desc: "Ren will not explain twice. Craft anything at all in your yard.",
      descHe: "רן לא יסביר פעמיים. ייצר משהו — כל דבר — בחצר שלך.",
      goal: {
        kind: "craft",
        count: 1
      },
      reward: {
        gold: 650,
        items: [["sphere_basic", 8]],
        xp: 260
      }
    },
    q_main_05: {
      id: "q_main_05",
      chain: "main",
      step: 6,
      name: "Beyond the Gate",
      he: "מעבר לשער",
      desc: "Sela holds the North Gate. Get her to open it, then defeat 5 creatures in the Meadow.",
      descHe: "סלע שומרת על השער הצפוני. שכנע אותה לפתוח אותו, ואז הבס 5 יצורים באחו.",
      goal: {
        kind: "defeat",
        count: 5,
        zone: "verdant_meadow"
      },
      reward: {
        gold: 800,
        items: [["potion_s", 4]],
        xp: 340
      }
    },
    q_main_06: {
      id: "q_main_06",
      chain: "main",
      step: 2,
      name: "A Companion",
      he: "בן לוויה",
      desc: "Capture your first wild creature.",
      descHe: "לכוד את יצור הבר הראשון שלך.",
      goal: {
        kind: "capture",
        count: 1
      },
      reward: {
        gold: 300,
        items: [["sphere_basic", 10]],
        xp: 80
      }
    },
    q_main_07: {
      id: "q_main_07",
      chain: "main",
      step: 7,
      name: "Rest and Rise",
      he: "מנוחה ועלייה",
      desc: "Leave a creature in a training pod until it reaches 2 stars.",
      descHe: "השאר יצור בתא אימון עד שיגיע ל‑2 כוכבים.",
      goal: {
        kind: "star",
        star: 2
      },
      reward: {
        gold: 900,
        items: [["aether_core", 2]],
        xp: 420
      }
    },
    q_main_08: {
      id: "q_main_08",
      chain: "main",
      step: 8,
      name: "The Cistern",
      he: "הבורות",
      desc: "Something is nesting under the old city. Clear the Undercity Cistern.",
      descHe: "משהו מקנן מתחת לעיר הישנה. נקה את בורות העיר התחתית.",
      goal: {
        kind: "dungeon",
        target: "undercity_cistern"
      },
      reward: {
        gold: 1200,
        items: [["vest_hide", 1], ["sphere_great", 4]],
        xp: 600
      }
    },
    q_main_09: {
      id: "q_main_09",
      chain: "main",
      step: 9,
      name: "Into the Canyon",
      he: "אל תוך הקניון",
      desc: "The trail of shards runs east. Survive 3 battles in Emberfall Canyon.",
      descHe: "עקבות הרסיסים מובילים מזרחה. שרוד 3 קרבות בקניון האש.",
      goal: {
        kind: "defeat",
        count: 3,
        zone: "emberfall_canyon"
      },
      reward: {
        gold: 1600,
        items: [["blade_iron", 1]],
        xp: 900
      }
    },
    q_main_10: {
      id: "q_main_10",
      chain: "main",
      step: 10,
      name: "What Fell Through",
      he: "מה שנפל דרך הקרע",
      desc: "Whatever came through the rift is out there and it is enormous. Land a hit on a world boss.",
      descHe: "מה שעבר דרך הקרע נמצא שם בחוץ, והוא ענק. פגע בבוס עולמי.",
      goal: {
        kind: "boss",
        count: 1
      },
      reward: {
        gold: 3e3,
        items: [["sphere_ultra", 3]],
        xp: 1800
      }
    },
    q_daily_hunt: {
      id: "q_daily_hunt",
      chain: "daily",
      name: "Daily Hunt",
      he: "ציד יומי",
      desc: "Defeat 12 wild creatures.",
      descHe: "הבס 12 יצורי בר.",
      goal: {
        kind: "defeat",
        count: 12
      },
      reward: {
        gold: 900,
        items: [["potion_m", 2]],
        xp: 400
      }
    },
    q_daily_catch: {
      id: "q_daily_catch",
      chain: "daily",
      name: "Daily Catch",
      he: "לכידה יומית",
      desc: "Capture 3 creatures.",
      descHe: "לכוד 3 יצורים.",
      goal: {
        kind: "capture",
        count: 3
      },
      reward: {
        gold: 800,
        items: [["sphere_great", 3]],
        xp: 380
      }
    },
    q_daily_party: {
      id: "q_daily_party",
      chain: "daily",
      name: "Better Together",
      he: "ביחד עדיף",
      desc: "Win 3 battles while in a party.",
      descHe: "נצח 3 קרבות בזמן שאתה בקבוצה.",
      goal: {
        kind: "defeat",
        count: 3,
        party: !0
      },
      reward: {
        gold: 1e3,
        items: [["ether", 2]],
        xp: 450
      }
    },
    q_daily_dungeon: {
      id: "q_daily_dungeon",
      chain: "daily",
      name: "Delve",
      he: "צלילה למבוך",
      desc: "Clear any dungeon once.",
      descHe: "נקה מבוך כלשהו פעם אחת.",
      goal: {
        kind: "dungeon"
      },
      reward: {
        gold: 1600,
        items: [["potion_l", 1]],
        xp: 800
      }
    },
    q_daily_boss: {
      id: "q_daily_boss",
      chain: "daily",
      name: "Giant Slayer",
      he: "קוטל ענקים",
      desc: "Contribute damage to a world boss.",
      descHe: "תרום נזק לבוס עולמי.",
      goal: {
        kind: "boss",
        count: 1
      },
      reward: {
        gold: 2e3,
        items: [["sphere_ultra", 1]],
        xp: 900
      }
    }
  };

function zoneQuestChain(i) {
  let [e, t] = i.levels,
    n = Math.round((e + t) / 2),
    s = Math.max(1, Math.round(n / 4)),
    r = {
      legendary: 5,
      rare: 4,
      final: 3,
      evolved: 2,
      starter: 1,
      common: 0
    },
    o = [...(i.spawns || [])].map(([h]) => h).filter(h => Object.prototype.hasOwnProperty.call(SPECIES, h)).sort((h, d) => (r[SPECIES[d].rarity] ?? 0) - (r[SPECIES[h].rarity] ?? 0))[0],
    a = ELEMENTS[i.element] || null,
    l = a ? `${a.icon} ` : "",
    c = {};
  return c[`q_${i.id}_hunt`] = {
    id: `q_${i.id}_hunt`,
    chain: "zone",
    zone: i.id,
    step: 1,
    name: `Survey: ${i.name}`,
    he: `${l}סיור ב${i.he}`,
    desc: `Defeat ${4 + s} creatures in ${i.name}.`,
    descHe: `הבס ${4 + s} יצורים ב${i.he}.`,
    goal: {
      kind: "defeat",
      count: 4 + s,
      zone: i.id
    },
    reward: {
      gold: 90 * n,
      items: [["potion_s", 3]],
      xp: 34 * n
    }
  }, c[`q_${i.id}_catch`] = {
    id: `q_${i.id}_catch`,
    chain: "zone",
    zone: i.id,
    step: 2,
    name: `Local Stock: ${i.name}`,
    he: `${l}מלאי מקומי ב${i.he}`,
    desc: `Capture 2 creatures in ${i.name}.`,
    descHe: `לכוד 2 יצורים ב${i.he}.`,
    goal: {
      kind: "capture",
      count: 2,
      zone: i.id
    },
    reward: {
      gold: 130 * n,
      items: [["sphere_basic", 6]],
      xp: 48 * n
    }
  }, o && (c[`q_${i.id}_prize`] = {
    id: `q_${i.id}_prize`,
    chain: "zone",
    zone: i.id,
    step: 3,
    name: `The Prize of ${i.name}`,
    he: `${l}הפרס של ${i.he}`,
    desc: `Capture a ${SPECIES[o].name}.`,
    descHe: `לכוד ${SPECIES[o].he} אחד.`,
    goal: {
      kind: "capture",
      count: 1,
      zone: i.id,
      species: o
    },
    reward: {
      gold: 220 * n,
      items: [["sphere_great", 3]],
      xp: 80 * n
    }
  }), c;
}

var DAILY_QUEST_IDS = Object.keys(QUESTS).filter(i => QUESTS[i].chain === "daily"),
  MAIN_QUEST_IDS = Object.keys(QUESTS).filter(i => QUESTS[i].chain === "main").sort((i, e) => QUESTS[i].step - QUESTS[e].step),
  GUILD = {
    createCost: 5e3,
    maxMembers: 40,
    ranks: ["member", "officer", "master"],
    buffs: [{
      level: 1,
      cost: 0,
      id: "gb_vigor",
      name: "Vigor",
      he: "מרץ",
      bonus: {
        hp: 0.05
      }
    }, {
      level: 2,
      cost: 12e3,
      id: "gb_might",
      name: "Might",
      he: "עוצמה",
      bonus: {
        atk: 0.06,
        spa: 0.06
      }
    }, {
      level: 3,
      cost: 4e4,
      id: "gb_ward",
      name: "Ward",
      he: "הגנה",
      bonus: {
        def: 0.08,
        spd: 0.08
      }
    }, {
      level: 4,
      cost: 11e4,
      id: "gb_fortune",
      name: "Fortune",
      he: "מזל",
      bonus: {
        gold: 0.15,
        xp: 0.1
      }
    }, {
      level: 5,
      cost: 26e4,
      id: "gb_swift",
      name: "Swiftness",
      he: "זריזות",
      bonus: {
        spe: 0.1,
        cdr: 0.08
      }
    }],
    houseUpgrades: [{
      id: "gh_hall",
      name: "Great Hall",
      he: "אולם ראשי",
      cost: 8e3,
      effect: "Raises member cap to 60"
    }, {
      id: "gh_garden",
      name: "Aether Garden",
      he: "גן האתר",
      cost: 22e3,
      effect: "Passive creature stamina regen +25%"
    }, {
      id: "gh_forge",
      name: "Guild Forge",
      he: "נפחיית גילדה",
      cost: 55e3,
      effect: "Gear upgrades cost 20% less"
    }],
    warZones: ["emberfall_canyon", "tidal_hollow", "frostpeak_ridge", "umbral_grove"],
    warDayUTC: 6,
    warHourUTC: 18,
    warDurationMinutes: 60,
    territoryBonus: {
      gold: 0.1,
      xp: 0.1
    }
  },
  STARS = {
    max: 5,
    multiplier: (i = 1) => [1, 1, 1.18, 1.4, 1.68, 2.05][Math.max(1, Math.min(5, i))] ?? 1,
    cost(i) {
      let e = Math.max(1, Math.min(4, i));
      return {
        crystals: [0, 4, 8, 16, 30][e],
        cores: [0, 0, 1, 3, 6][e],
        gold: [0, 600, 1800, 5e3, 12e3][e],
        hours: [0, 2, 6, 16, 36][e]
      };
    }
  },
  MATERIALS = (() => {
    let i = {};
    for (let [e, t] of Object.entries(ELEMENTS)) i[`shard_${e}`] = {
      id: `shard_${e}`,
      kind: "material",
      tier: "shard",
      element: e,
      name: `${t.name} Shard`,
      he: `שבר ${t.he}`,
      icon: t.icon,
      price: 40
    }, i[`crystal_${e}`] = {
      id: `crystal_${e}`,
      kind: "material",
      tier: "crystal",
      element: e,
      name: `${t.name} Crystal`,
      he: `גביש ${t.he}`,
      icon: "💎",
      price: 260
    };
    return i.aether_core = {
      id: "aether_core",
      kind: "material",
      tier: "core",
      name: "Aether Core",
      he: "ליבת אתר",
      icon: "🔮",
      price: 2400
    }, i.scrap_iron = {
      id: "scrap_iron",
      kind: "material",
      tier: "shard",
      name: "Scrap",
      he: "גרוטאות",
      icon: "⚙️",
      price: 30
    }, i.fiber = {
      id: "fiber",
      kind: "material",
      tier: "shard",
      name: "Fiber",
      he: "סיבים",
      icon: "🧵",
      price: 25
    }, i;
  })();

var BUILDINGS = {
    pod: {
      id: "pod",
      name: "Training Pod",
      he: "תא אימון",
      icon: "🛖",
      desc: "Creatures left here gain a star over time.",
      descHe: "יצור שמושאר כאן עולה כוכב עם הזמן.",
      maxLevel: 5,
      cost: i => ({
        gold: [400, 1200, 3200, 8e3, 18e3][i] ?? 0,
        items: [{
          fiber: 6
        }, {
          fiber: 14,
          scrap_iron: 8
        }, {
          fiber: 30,
          scrap_iron: 20
        }, {
          fiber: 60,
          scrap_iron: 44,
          aether_core: 1
        }, {
          fiber: 110,
          scrap_iron: 90,
          aether_core: 3
        }][i] ?? {}
      }),
      effect: i => ({
        slots: i,
        speed: 1 + (i - 1) * 0.12
      })
    },
    refinery: {
      id: "refinery",
      name: "Refinery",
      he: "מזקקה",
      icon: "⚗️",
      desc: "Refines raw shards into crystals.",
      descHe: "מזקקת שברים גולמיים לגבישים.",
      maxLevel: 5,
      cost: i => ({
        gold: [300, 900, 2600, 6500, 15e3][i] ?? 0,
        items: [{
          scrap_iron: 5
        }, {
          scrap_iron: 16
        }, {
          scrap_iron: 38,
          fiber: 20
        }, {
          scrap_iron: 70,
          fiber: 48,
          aether_core: 1
        }, {
          scrap_iron: 130,
          fiber: 100,
          aether_core: 2
        }][i] ?? {}
      }),
      effect: i => ({
        queue: i,
        speed: 1 + (i - 1) * 0.15
      })
    },
    workshop: {
      id: "workshop",
      name: "Workshop",
      he: "סדנה",
      icon: "🔨",
      desc: "Crafts gear, spheres and potions.",
      descHe: "מייצרת ציוד, כדורים ושיקויים.",
      maxLevel: 5,
      cost: i => ({
        gold: [500, 1500, 4e3, 9500, 21e3][i] ?? 0,
        items: [{
          scrap_iron: 8,
          fiber: 4
        }, {
          scrap_iron: 22,
          fiber: 14
        }, {
          scrap_iron: 50,
          fiber: 34
        }, {
          scrap_iron: 96,
          fiber: 70,
          aether_core: 1
        }, {
          scrap_iron: 170,
          fiber: 130,
          aether_core: 3
        }][i] ?? {}
      }),
      effect: i => ({
        tier: i,
        speed: 1 + (i - 1) * 0.15
      })
    },
    garden: {
      id: "garden",
      name: "Garden",
      he: "גינה",
      icon: "🌿",
      desc: "Grows fiber on its own. Collect whenever you visit.",
      descHe: "מגדלת סיבים מעצמה. אוספים בכל ביקור.",
      maxLevel: 5,
      cost: i => ({
        gold: [200, 700, 2e3, 5200, 12e3][i] ?? 0,
        items: [{}, {
          fiber: 10
        }, {
          fiber: 28,
          scrap_iron: 12
        }, {
          fiber: 60,
          scrap_iron: 34
        }, {
          fiber: 120,
          scrap_iron: 80,
          aether_core: 1
        }][i] ?? {}
      }),
      effect: i => ({
        perHour: 2 + i * 2,
        capHours: 12
      })
    }
  },
  RECIPES = {
    ...Object.fromEntries(Object.keys(ELEMENTS).map(i => [`refine_${i}`, {
      id: `refine_${i}`,
      at: "refinery",
      mins: 20,
      name: `Refine ${ELEMENTS[i].name}`,
      he: `זיקוק ${ELEMENTS[i].he}`,
      inputs: {
        [`shard_${i}`]: 5
      },
      gold: 60,
      output: {
        [`crystal_${i}`]: 1
      }
    }])),
    core: {
      id: "core",
      at: "refinery",
      mins: 180,
      tier: 3,
      name: "Aether Core",
      he: "ליבת אתר",
      inputs: {
        crystal_lumen: 2,
        crystal_umbra: 2,
        scrap_iron: 20
      },
      gold: 900,
      output: {
        aether_core: 1
      }
    },
    make_sphere: {
      id: "make_sphere",
      at: "workshop",
      mins: 6,
      name: "Aether Spheres",
      he: "כדורי אתר",
      inputs: {
        scrap_iron: 3,
        fiber: 2
      },
      gold: 40,
      output: {
        sphere_basic: 5
      }
    },
    make_sphere_great: {
      id: "make_sphere_great",
      at: "workshop",
      mins: 25,
      tier: 2,
      name: "Prism Spheres",
      he: "כדורי פריזמה",
      inputs: {
        scrap_iron: 8,
        crystal_lumen: 1
      },
      gold: 260,
      output: {
        sphere_great: 3
      }
    },
    make_potion: {
      id: "make_potion",
      at: "workshop",
      mins: 8,
      name: "Tonics",
      he: "תרכיזים",
      inputs: {
        fiber: 6
      },
      gold: 90,
      output: {
        potion_m: 2
      }
    },
    make_blade: {
      id: "make_blade",
      at: "workshop",
      mins: 90,
      tier: 3,
      name: "Iron Blade",
      he: "להב ברזל",
      inputs: {
        scrap_iron: 24,
        crystal_metal: 2
      },
      gold: 700,
      output: {
        blade_iron: 1
      }
    },
    make_vest: {
      id: "make_vest",
      at: "workshop",
      mins: 90,
      tier: 3,
      name: "Hide Vest",
      he: "אפוד עור",
      inputs: {
        fiber: 30,
        crystal_terra: 2
      },
      gold: 700,
      output: {
        vest_hide: 1
      }
    },
    make_storm: {
      id: "make_storm",
      at: "workshop",
      mins: 420,
      tier: 5,
      name: "Stormbrand",
      he: "חרב הסופה",
      inputs: {
        crystal_volt: 6,
        crystal_metal: 4,
        aether_core: 2
      },
      gold: 4200,
      output: {
        blade_storm: 1
      }
    }
  },
  DROPS = {
    roll(i, e, t = "wild", n = Math.random) {
      let s = {},
        r = (l, c) => {
          c > 0 && (s[l] = (s[l] || 0) + c);
        },
        o = t === "boss" ? 6 : t === "dungeon" ? 3 : 1,
        a = 1 + Math.floor(e / 8);
      return r(`shard_${i}`, Math.round((a + (n() < 0.5 ? 1 : 0)) * o)), n() < 0.45 * o && r("scrap_iron", Math.round((1 + n() * 2) * o)), n() < 0.45 * o && r("fiber", Math.round((1 + n() * 2) * o)), t !== "wild" && n() < 0.3 * o && r("aether_core", 1), s;
    }
  },
  PROGRESSION = {
    maxLevel: 60,
    xpToLevel: i => Math.floor(12 * Math.pow(i, 2.35) + 40 * i),
    partyXpShare: 0.75,
    staminaMax: 100,
    staminaRegenPerSec: 7,
    reviveHpRatio: 0.5,
    fleeChance: 0.7,
    trainerHp: i => 60 + Math.max(1, i) * 14,
    captureWindowMs: 2400,
    switchDelayMs: 1200
  },
  RARITY = {
    common: 1,
    starter: 1,
    evolved: 0.65,
    final: 0.4,
    rare: 0.35,
    legendary: 0.15
  };

function captureChance(i, e = "sphere_basic") {
  if (!i || !Number.isFinite(i.hp) || !Number.isFinite(i.maxHp)) return 0;
  let t = Math.max(1, i.maxHp),
    n = Math.max(0, Math.min(t, i.hp));
  if (n <= 0) return 0.99;
  let s = (t - n) / Math.max(1, t - 1),
    r = 0.05 + 0.94 * s,
    o = Object.prototype.hasOwnProperty.call(SPECIES, i.species) ? SPECIES[i.species] : null,
    a = (RARITY[o?.rarity] ?? 0.7) * Math.max(0.5, 1 - (i.level || 1) / 120),
    l = a + (1 - a) * s,
    c = Object.prototype.hasOwnProperty.call(ITEMS, e) ? ITEMS[e] : null,
    h = (i.effects || []).some(u => ["stun", "slow", "burn", "poison"].includes(u.kind || u)),
    d = r * l * (c?.rate || 1) * (h ? 1.25 : 1);
  return Math.max(0.01, Math.min(0.99, d));
}

function starRank(i, e) {
  return e || i > 0.7 ? 3 : i > 0.45 ? 2 : i > 0.2 ? 1 : 0;
}

var AVATAR = {
  bodies: ["slim", "stocky", "tall"],
  skins: ["#f6d3b1", "#e0ac7e", "#c68642", "#8d5524", "#5a3821", "#f0dcc8"],
  hair: ["#2b1b16", "#6b3e1e", "#c9a227", "#d94f4f", "#3f7ad9", "#8b5cf6", "#e8e8e8", "#2fb27a"],
  outfits: [{
    id: "wanderer",
    name: "Wanderer",
    he: "נווד",
    a: "#4fa3ff",
    b: "#20304a"
  }, {
    id: "ranger",
    name: "Ranger",
    he: "סייר",
    a: "#4fd166",
    b: "#20402c"
  }, {
    id: "scholar",
    name: "Scholar",
    he: "חוקר",
    a: "#ffd23d",
    b: "#3a3020"
  }, {
    id: "nomad",
    name: "Nomad",
    he: "נוודת",
    a: "#ff6b3d",
    b: "#3a2018"
  }, {
    id: "shade",
    name: "Shade",
    he: "צל",
    a: "#8b5cf6",
    b: "#241d3a"
  }, {
    id: "tide",
    name: "Tide",
    he: "גאות",
    a: "#3ddad7",
    b: "#12333a"
  }]
};

function statsFor(i, e, t = 0.5, n = 1) {
  let s = SPECIES[i];
  if (!s) throw new Error("unknown species " + i);
  let r = STARS.multiplier(n),
    o = a => Math.floor((Math.floor((2 * a + 20 * t) * e / 100) + 5) * r);
  return {
    hp: Math.floor((Math.floor((2 * s.base.hp + 24 * t) * e / 45) + e * 2 + 28) * r),
    atk: o(s.base.atk),
    def: o(s.base.def),
    spa: o(s.base.spa),
    spd: o(s.base.spd),
    spe: o(s.base.spe)
  };
}

function powerOf(i) {
  if (!i || !SPECIES[i.species]) return 0;
  let e = statsFor(i.species, i.level, i.iv, i.star || 1);
  return Math.round(e.hp * 0.5 + e.atk + e.spa + e.def * 0.8 + e.spd * 0.8 + e.spe * 0.6);
}

function skillsFor(i, e) {
  let n = SPECIES[i].learn.filter(([r]) => r <= e).map(([, r]) => r);
  return [...new Set(n)].slice(-4);
}

function weightedPick(i, e = Math.random) {
  let t = i.reduce((s, [, r]) => s + r, 0),
    n = e() * t;
  for (let [s, r] of i) if (n -= r, n <= 0) return s;
  return i[i.length - 1][0];
}

function randomLevel(i, e = Math.random) {
  let [t, n] = ZONES[i].levels;
  return t + Math.floor(e() * (n - t + 1));
}

function hashString(i) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t++) e ^= i.charCodeAt(t), e = Math.imul(e, 16777619);
  return e >>> 0;
}

function seededRandom(i) {
  let e = i >>> 0;
  return () => {
    e = e + 1831565813 | 0;
    let t = Math.imul(e ^ e >>> 15, 1 | e);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// derived tables (were bundle bootstrap side effects)
for (let z of Object.values(ZONES)) if (z.capturable) Object.assign(QUESTS, zoneQuestChain(z));
// The townsfolk's errands (story.js) live in the same table, so every lookup by id works.
Object.assign(QUESTS, NPC_QUESTS);
Object.assign(ITEMS, MATERIALS);

export { ACTIONS, AVATAR, BUILDINGS, DAILY_QUEST_IDS, DROPS, DUNGEONS, ELEMENTS, GUILD, HOME_ZONE, ITEMS, MAIN_QUEST_IDS, MATERIALS, MOVES, PROGRESSION, QUESTS, RARITY, RECIPES, SPECIES, STARS, STARTERS, TEMPER, TYPE_CHART, WILD_TIERS, WORLD_BOSSES, ZONES, captureChance, def, hashString, powerOf, randomLevel, seededRandom, skillsFor, starRank, statsFor, typeMultiplier, weightedPick, zoneQuestChain };
