// Guilds: a name and a tag over your head, a roster with ranks, a treasury
// the members fill, buffs that grow with what has been given, a house with
// upgrades bought from the treasury, a log, and a chat channel that reaches
// every member online wherever they are.
//
// Like social.js, one process holds every room, so the guilds live in this
// module's map — loaded from the store when the server starts and written
// back (a moment after each change) through store.saveGuild. A player's
// document carries only `guildId`; whether they are still a member is the
// guild's say, checked whenever they come online.
import { GUILD } from '../shared/gamedata.js';
import { spend } from './game/economy.js';
import * as Social from './social.js';

export const GUILDS_RULES = {
  nameMin: 3, nameMax: 20, tagMin: 2, tagMax: 4,
  cap: GUILD.maxMembers,         // 40, 60 with the great hall
  hallCap: 60,
  logMax: 40,
  contributeMin: 100,
  saveDelayMs: 1500,
};

/** What the house upgrades do (GUILD.houseUpgrades has their names and prices). */
export const HOUSE_EFFECTS = {
  gh_hall: { cap: GUILDS_RULES.hallCap, he: 'מקום ל‑60 חברים' },
  gh_garden: { stam: 0.25, he: 'מרץ מתמלא מהר יותר ב‑25% בקרבות' },
  gh_forge: { train: 0.15, he: 'אימון כוכבים זול ב‑15%' },
};

const GUILDS = new Map();
let STORE = null;
const timers = new Map();
let seq = 0;

export async function useStore(store) {
  STORE = store;
  GUILDS.clear();
  try {
    for (const g of (await store.listGuilds()) || []) if (g?.id && g.members && typeof g.members === 'object' && !Array.isArray(g.members)) GUILDS.set(g.id, g);
  } catch (err) { console.error('[guilds] load', err); }
}

function save(g) {
  clearTimeout(timers.get(g.id));
  const t = setTimeout(() => { timers.delete(g.id); STORE?.saveGuild?.(g).catch?.(() => {}); }, GUILDS_RULES.saveDelayMs);
  t.unref?.();
  timers.set(g.id, t);
}

function log(g, text) {
  g.log = [{ t: Date.now(), text }, ...(g.log || [])].slice(0, GUILDS_RULES.logMax);
}

const RANK = { member: 0, officer: 1, master: 2 };

export function guildOf(doc) {
  const g = doc?.guildId ? GUILDS.get(doc.guildId) : null;
  return g && g.members[doc.id] ? g : null;
}

export function capOf(g) { return g.house?.includes('gh_hall') ? GUILDS_RULES.hallCap : GUILDS_RULES.cap; }

export function buffLevelOf(total) {
  let lv = 0;
  for (const b of GUILD.buffs) if (total >= b.cost) lv = Math.max(lv, b.level);
  return lv;
}

/** The stat bonuses a member fights with (Combatant `guildBonus`). */
export function buffsFor(doc) {
  const g = guildOf(doc);
  if (!g) return null;
  const out = {};
  for (const b of GUILD.buffs) if (b.level <= g.buffLevel) for (const [k, v] of Object.entries(b.bonus)) out[k] = (out[k] || 0) + v;
  if (g.house?.includes('gh_garden')) out.stam = (out.stam || 0) + HOUSE_EFFECTS.gh_garden.stam;
  return out;
}

/** The perks that are not stats — gold and XP from fights, cheaper training —
 *  kept on the document for the game code that pays and charges. */
function perksOf(g) {
  if (!g) return null;
  const b = {};
  for (const x of GUILD.buffs) if (x.level <= g.buffLevel) for (const [k, v] of Object.entries(x.bonus)) b[k] = (b[k] || 0) + v;
  return { gold: b.gold || 0, xp: b.xp || 0, train: g.house?.includes('gh_forge') ? HOUSE_EFFECTS.gh_forge.train : 0 };
}

/** Coming online: still a member? Their row and perks brought up to date. */
export function check(doc) {
  if (!doc) return null;
  const g = doc.guildId ? GUILDS.get(doc.guildId) : null;
  if (!g || !g.members[doc.id]) { if (doc.guildId) doc.guildId = null; doc.guildPerks = null; return null; }
  const m = g.members[doc.id];
  if (m.name !== doc.name || m.level !== doc.level) { m.name = doc.name; m.level = doc.level; save(g); }
  doc.guildPerks = perksOf(g);
  return g;
}

export function view(g, forId = null) {
  if (!g) return null;
  const members = Object.entries(g.members).map(([id, m]) => {
    const w = Social.whereIs(id);
    return { id, name: m.name, level: m.level || 1, rank: m.rank, contributed: m.contributed || 0, joined: m.joined || 0, online: !!w, where: w?.where || '', zone: w?.zone || '' };
  }).sort((a, b) => RANK[b.rank] - RANK[a.rank] || b.online - a.online || b.contributed - a.contributed);
  return {
    id: g.id, name: g.name, tag: g.tag, motd: g.motd || '', open: g.open !== false,
    masterId: Object.keys(g.members).find((id) => g.members[id].rank === 'master') || null,
    buffLevel: g.buffLevel, total: g.total || 0, treasury: g.treasury || 0, contribution: g.treasury || 0,
    house: g.house || [], members, cap: capOf(g), log: (g.log || []).slice(0, 20),
    myRank: forId ? g.members[forId]?.rank || null : null,
    nextBuff: GUILD.buffs.find((b) => b.level === g.buffLevel + 1) || null,
  };
}

export function list() {
  return [...GUILDS.values()].map((g) => ({
    id: g.id, name: g.name, tag: g.tag, members: Object.keys(g.members).length, cap: capOf(g), buffLevel: g.buffLevel, open: g.open !== false,
    online: Object.keys(g.members).filter((id) => Social.isOnline(id)).length,
  })).sort((a, b) => b.members - a.members || b.buffLevel - a.buffLevel).slice(0, 50);
}

/** Tell every member online that their guild changed (each sees their rank). */
export function push(g) {
  if (!g) return;
  for (const id of Object.keys(g.members)) Social.isOnline(id) && Social.sendTo(id, 'guild', view(g, id));
}

const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const taken = (field, v) => [...GUILDS.values()].some((g) => String(g[field]).toLowerCase() === v.toLowerCase());

export function create(doc, { name, tag } = {}) {
  if (guildOf(doc)) return { ok: false, code: 'already_in_guild' };
  const n = clean(name, GUILDS_RULES.nameMax), t = clean(tag, GUILDS_RULES.tagMax).toUpperCase();
  if (n.length < GUILDS_RULES.nameMin) return { ok: false, code: 'guild_name' };
  if (t.length < GUILDS_RULES.tagMin || !/^[\p{L}\p{N}]+$/u.test(t)) return { ok: false, code: 'guild_tag' };
  if (taken('name', n)) return { ok: false, code: 'guild_name_taken' };
  if (taken('tag', t)) return { ok: false, code: 'guild_tag_taken' };
  if ((doc.gold || 0) < GUILD.createCost) return { ok: false, code: 'not_enough_gold' };
  spend(doc, GUILD.createCost, 'guild');
  const g = {
    id: `g${Date.now().toString(36)}${(++seq).toString(36)}`, name: n, tag: t, created: Date.now(), open: true, motd: '',
    members: { [doc.id]: { name: doc.name, level: doc.level, rank: 'master', joined: Date.now(), contributed: 0 } },
    treasury: 0, total: 0, buffLevel: 1, house: [], log: [],
  };
  log(g, `${doc.name} הקים את הגילדה`);
  GUILDS.set(g.id, g);
  doc.guildId = g.id; doc.guildPerks = perksOf(g);
  save(g);
  return { ok: true, guild: g };
}

export function join(doc, guildId) {
  if (guildOf(doc)) return { ok: false, code: 'already_in_guild' };
  const g = GUILDS.get(guildId);
  if (!g) return { ok: false, code: 'no_guild' };
  if (g.open === false) return { ok: false, code: 'guild_closed' };
  if (Object.keys(g.members).length >= capOf(g)) return { ok: false, code: 'guild_full' };
  g.members[doc.id] = { name: doc.name, level: doc.level, rank: 'member', joined: Date.now(), contributed: 0 };
  doc.guildId = g.id; doc.guildPerks = perksOf(g);
  log(g, `${doc.name} הצטרף`);
  save(g); push(g);
  return { ok: true, guild: g };
}

/** Out of the guild. A master who leaves hands it to the senior officer (or the
 *  longest member); the last one out closes it. */
export function leave(doc, why = 'left') {
  const g = guildOf(doc);
  doc.guildId = null; doc.guildPerks = null;
  if (!g) return { ok: true };
  const wasMaster = g.members[doc.id]?.rank === 'master';
  delete g.members[doc.id];
  const rest = Object.entries(g.members);
  if (!rest.length) {
    GUILDS.delete(g.id);
    clearTimeout(timers.get(g.id));
    STORE?.deleteGuild?.(g.id)?.catch?.(() => {});
    return { ok: true, disbanded: true };
  }
  if (wasMaster) {
    const [heir] = rest.sort(([, a], [, b]) => RANK[b.rank] - RANK[a.rank] || (a.joined || 0) - (b.joined || 0))[0];
    g.members[heir].rank = 'master';
    log(g, `${g.members[heir].name} מוביל עכשיו את הגילדה`);
  }
  log(g, why === 'kicked' ? `${doc.name} הוצא מהגילדה` : `${doc.name} עזב`);
  save(g); push(g);
  return { ok: true };
}

/** An officer removes a member; the master, anyone. */
export function kick(doc, targetId) {
  const g = guildOf(doc);
  if (!g) return { ok: false, code: 'no_guild' };
  const me = g.members[doc.id], them = g.members[targetId];
  if (!them || targetId === doc.id) return { ok: false, code: 'not_member' };
  if (RANK[me.rank] < 1 || RANK[me.rank] <= RANK[them.rank]) return { ok: false, code: 'no_rank' };
  const live = Social.liveDoc(targetId);
  const name = them.name;
  delete g.members[targetId];
  if (live) { live.guildId = null; live.guildPerks = null; Social.sendTo(targetId, 'guild', null); Social.sendTo(targetId, 'guildKicked', { name: g.name }); }
  log(g, `${name} הוצא מהגילדה על ידי ${doc.name}`);
  save(g); push(g);
  return { ok: true };
}

/** The master raises a member to officer, lowers an officer, or hands over. */
export function setRank(doc, targetId, rank) {
  const g = guildOf(doc);
  if (!g) return { ok: false, code: 'no_guild' };
  if (g.members[doc.id]?.rank !== 'master') return { ok: false, code: 'no_rank' };
  const them = g.members[targetId];
  if (!them || targetId === doc.id || !RANK.hasOwnProperty(rank)) return { ok: false, code: 'not_member' };
  if (rank === 'master') { g.members[doc.id].rank = 'officer'; log(g, `${doc.name} העביר את ההובלה ל${them.name}`); }
  else log(g, rank === 'officer' ? `${them.name} קודם לקצין` : `${them.name} חזר להיות חבר`);
  them.rank = rank;
  save(g); push(g);
  return { ok: true };
}

/** Gold into the treasury: what buys the house, and, in total, the buffs. */
export function contribute(doc, amount) {
  const g = guildOf(doc);
  if (!g) return { ok: false, code: 'no_guild' };
  const a = Math.floor(Number(amount) || 0);
  if (a < GUILDS_RULES.contributeMin) return { ok: false, code: 'contribute_min' };
  if ((doc.gold || 0) < a) return { ok: false, code: 'not_enough_gold' };
  spend(doc, a, 'guild');
  g.treasury = (g.treasury || 0) + a;
  g.total = (g.total || 0) + a;
  g.members[doc.id].contributed = (g.members[doc.id].contributed || 0) + a;
  const was = g.buffLevel;
  g.buffLevel = Math.max(g.buffLevel, buffLevelOf(g.total));
  log(g, `${doc.name} תרם ${a.toLocaleString('en-US')}⛁`);
  if (g.buffLevel > was) {
    const b = GUILD.buffs.find((x) => x.level === g.buffLevel);
    log(g, `באף חדש: ${b?.he || g.buffLevel}`);
    for (const id of Object.keys(g.members)) { const d = Social.liveDoc(id); d && (d.guildPerks = perksOf(g)); }
  }
  doc.guildPerks = perksOf(g);
  save(g); push(g);
  return { ok: true, levelUp: g.buffLevel > was };
}

/** Officers buy the house its upgrades from the treasury. */
export function upgrade(doc, upgradeId) {
  const g = guildOf(doc);
  if (!g) return { ok: false, code: 'no_guild' };
  if (RANK[g.members[doc.id]?.rank] < 1) return { ok: false, code: 'no_rank' };
  const u = GUILD.houseUpgrades.find((x) => x.id === upgradeId);
  if (!u || g.house.includes(u.id)) return { ok: false, code: 'no_upgrade' };
  if ((g.treasury || 0) < u.cost) return { ok: false, code: 'not_enough_contribution' };
  g.treasury -= u.cost;
  g.house.push(u.id);
  log(g, `${doc.name} בנה: ${u.he}`);
  for (const id of Object.keys(g.members)) { const d = Social.liveDoc(id); d && (d.guildPerks = perksOf(g)); }
  save(g); push(g);
  return { ok: true };
}

export function settings(doc, { motd, open } = {}) {
  const g = guildOf(doc);
  if (!g) return { ok: false, code: 'no_guild' };
  if (RANK[g.members[doc.id]?.rank] < 1) return { ok: false, code: 'no_rank' };
  if (typeof motd === 'string') g.motd = clean(motd, 140);
  if (typeof open === 'boolean') g.open = open;
  save(g); push(g);
  return { ok: true };
}

/** Guild chat: every member online, wherever they are, minus who blocked you. */
export function chat(doc, text) {
  const g = guildOf(doc);
  if (!g) return 'no_guild';
  return Social.chat(doc, { ch: 'guild', text }, null, Object.keys(g.members));
}

export function _reset() { GUILDS.clear(); for (const t of timers.values()) clearTimeout(t); timers.clear(); }
export const _debug = { GUILDS };
