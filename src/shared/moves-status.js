// The third wave of moves (checklist c2): twenty-two that are about statuses
// (shared/status.js) — ones that leave something behind, ones that hit twice
// as hard when something is already there, and ones that wash it all away.
//
// Three new ideas on a move's `effect`, all read by server/game/combat.js:
//  - `foe: true` on a status move: it is aimed at the other side, does no
//    damage, and only leaves its status (a sleep powder, not a punch);
//  - `vs` / `vsMul`: hits harder when the target already has one of these
//    (a list of statuses, 'any' bad one, or 'disabled' — asleep, frozen or
//    dizzy); `wake` wakes a sleeper and `thaw` breaks the ice as it lands;
//  - `cleanse`: takes the bad statuses off whoever it helps.
//
// Pure data, merged into MOVES — and into every learnset but a boss's — by
// shared/gamedata.js (which this file must not import).

export const STATUS_MOVES = {
  // ember
  willowisp: { name: "Will-o'-Wisp", he: 'אש תועה', type: 'ember', kind: 'status', foe: true, power: 0, acc: 0.85, cd: 7000, cost: 10, effect: { burn: 0.1, dur: 8000, sure: true } },
  scorch: { name: 'Scorch', he: 'צריבה', type: 'ember', kind: 'special', power: 54, acc: 1, cd: 3200, cost: 11, effect: { vs: ['burn'], vsMul: 2 } },
  // aqua
  cleansingrain: { name: 'Cleansing Rain', he: 'גשם מטהר', type: 'aqua', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 12, effect: { cleanse: true, heal: 0.1, party: true } },
  lullaby: { name: 'Lullaby', he: 'שיר ערש', type: 'aqua', kind: 'status', foe: true, power: 0, acc: 0.8, cd: 9000, cost: 12, effect: { sleep: 0.9, dur: 4000 } },
  // verdant
  toxicvine: { name: 'Toxic Vine', he: 'קנוקנת רעל', type: 'verdant', kind: 'physical', power: 50, acc: 0.95, cd: 3200, cost: 11, effect: { poison: 0.1, dur: 8000, sure: true } },
  sleepspore: { name: 'Sleep Spore', he: 'נבגי שינה', type: 'verdant', kind: 'status', foe: true, power: 0, acc: 0.8, cd: 9000, cost: 12, effect: { sleep: 0.9, dur: 4500 } },
  // volt
  thunderfang: { name: 'Thunder Fang', he: 'ניב רעם', type: 'volt', kind: 'physical', power: 60, acc: 0.95, cd: 3000, cost: 11, effect: { stun: 0.25, dur: 1100 } },
  overload: { name: 'Overload', he: 'עומס יתר', type: 'volt', kind: 'special', power: 58, acc: 1, cd: 3400, cost: 12, effect: { vs: 'disabled', vsMul: 1.8 } },
  // terra
  sandtomb: { name: 'Sand Tomb', he: 'קבר חול', type: 'terra', kind: 'special', power: 46, acc: 0.95, cd: 4000, cost: 12, effect: { slow: 0.45, dur: 6000 } },
  mudbath: { name: 'Mud Bath', he: 'אמבט בוץ', type: 'terra', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 10, effect: { cleanse: true, defUp: 0.3, dur: 7000 } },
  // gale
  windshear: { name: 'Wind Shear', he: 'גזירת רוח', type: 'gale', kind: 'physical', power: 56, acc: 0.95, cd: 3000, cost: 11, effect: { vs: ['slow', 'sleep'], vsMul: 1.8 } },
  drowsybreeze: { name: 'Drowsy Breeze', he: 'בריזה מנמנמת', type: 'gale', kind: 'status', foe: true, aoe: true, power: 0, acc: 0.75, cd: 11000, cost: 16, effect: { sleep: 0.6, dur: 3500 } },
  // frost
  freezeray: { name: 'Freeze Ray', he: 'קרן הקפאה', type: 'frost', kind: 'special', power: 58, acc: 0.95, cd: 4200, cost: 14, effect: { freeze: 0.3, dur: 2500 } },
  shatter: { name: 'Shatter', he: 'ניפוץ', type: 'frost', kind: 'physical', power: 52, acc: 1, cd: 3000, cost: 11, effect: { vs: ['freeze', 'slow'], vsMul: 2, thaw: true } },
  deepfreeze: { name: 'Deep Freeze', he: 'הקפאה עמוקה', type: 'frost', kind: 'status', foe: true, power: 0, acc: 0.75, cd: 11000, cost: 15, effect: { freeze: 0.85, dur: 3000 } },
  // umbra
  hex: { name: 'Hex', he: 'קללה', type: 'umbra', kind: 'special', power: 50, acc: 1, cd: 3000, cost: 11, effect: { vs: 'any', vsMul: 2 } },
  dreameater: { name: 'Dream Eater', he: 'אוכל חלומות', type: 'umbra', kind: 'special', power: 46, acc: 1, cd: 5500, cost: 14, effect: { vs: ['sleep'], vsMul: 2.2, lifesteal: 0.5 } },
  // lumen
  purify: { name: 'Purify', he: 'טיהור', type: 'lumen', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 12, effect: { cleanse: true, heal: 0.08, party: true } },
  hypnoflash: { name: 'Hypno Flash', he: 'הבזק מהפנט', type: 'lumen', kind: 'status', foe: true, power: 0, acc: 0.8, cd: 9500, cost: 12, effect: { sleep: 0.85, dur: 3500 } },
  // metal
  rustbite: { name: 'Rust Bite', he: 'נשיכת חלודה', type: 'metal', kind: 'physical', power: 56, acc: 0.95, cd: 3000, cost: 11, effect: { poison: 0.08, dur: 7000 } },
  alarmclang: { name: 'Alarm Clang', he: 'צלצול השכמה', type: 'metal', kind: 'physical', power: 58, acc: 1, cd: 3200, cost: 11, effect: { vs: ['sleep', 'stun'], vsMul: 2, wake: true } },
};
for (const [id, m] of Object.entries(STATUS_MOVES)) m.id = id;

// Where they come in: an element's first at 14, its second at 24 (the ones
// that put to sleep come late — not in the first zones), and the first of a
// second element at 30. Frost has a third, the deep freeze, at 34.
const STATUS_LINE = {
  ember: ['willowisp', 'scorch'],
  aqua: ['cleansingrain', 'lullaby'],
  verdant: ['toxicvine', 'sleepspore'],
  volt: ['thunderfang', 'overload'],
  terra: ['sandtomb', 'mudbath'],
  gale: ['windshear', 'drowsybreeze'],
  frost: ['freezeray', 'shatter', 'deepfreeze'],
  umbra: ['hex', 'dreameater'],
  lumen: ['purify', 'hypnoflash'],
  metal: ['rustbite', 'alarmclang'],
};
const AT = [14, 24, 34];

/** Add the status moves to a species' learnset (in place; sorted by level). */
export function withStatusMoves(sp) {
  if (!sp?.learn || sp.rarity === 'boss') return sp;
  const [t0, t1] = sp.types || [];
  const have = new Set(sp.learn.map(([, m]) => m));
  const add = (lv, m) => m && !have.has(m) && (have.add(m), sp.learn.push([lv, m]));
  (STATUS_LINE[t0] || []).forEach((m, i) => add(AT[i], m));
  t1 && add(30, STATUS_LINE[t1]?.[0]);
  sp.learn.sort((a, b) => a[0] - b[0]);
  return sp;
}
