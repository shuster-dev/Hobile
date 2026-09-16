// Small player-document helpers shared by the simulation and the server rooms.
import { GUILD } from '../../shared/gamedata.js';
import { activeCreature } from './combat.js';

function hpRatio(i) {
  let e = activeCreature(i);
  return e ? e.hp / Math.max(1, e.maxHp) : 1;
}

function guildBuffs(i) {
  let e = {};
  for (let t of GUILD.buffs) if (!(t.level > i.buffLevel)) for (let [n, s] of Object.entries(t.bonus)) e[n] = (e[n] || 0) + s;
  return e;
}

export { hpRatio, guildBuffs };
