// The social layer: who is online and where, friends, whispers, the world
// channel, parties, and the invitations that start a fight between players.
//
// One process holds every room (WorldRoom per zone, a BattleRoom per fight,
// DungeonRoom), so "everyone online" is this module's map, not a service.
// A player is online while any of their rooms is attached here; moving from
// the world into a fight and back detaches one and attaches the other a moment
// later, so going offline waits a few seconds before it tells anyone.
//
// What lasts is on the player's document: `friends` (ids), `friendRequests`
// ({id, name, level, at}), `friendInfo` (the last name and level seen for each
// friend, for when they are offline) and `blocked` (ids). A friend request to
// someone who is offline is written into their document through the store.
// Parties and invitations live only here: a restart dissolves them, which is
// what a party is for anyway.
import { activeCreature } from './game/combat.js';
import { hpRatio } from './game/player.js';

export const SOCIAL = {
  offlineGraceMs: 4000,      // a room switch is not a logout
  partyMax: 4,
  partyDropMs: 3 * 60_000,   // offline this long, and you are out of the party
  inviteMs: 60_000,
  duelInviteMs: 30_000,
  friendMax: 100,
  requestMax: 50,
  chatBurst: 5,              // lines in any `chatWindowMs`
  chatWindowMs: 5000,
  worldGapMs: 3000,
  pushEveryMs: 3000,
};

const ONLINE = new Map();   // playerId -> entry
const PARTIES = new Map();  // partyId -> { id, leader, members: [ids] }
const INVITES = new Map();  // inviteId -> { id, kind, from, to, ... until }
let STORE = null;
let seq = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;

/** The store to reach players who are not online (index.js sets it). */
export function useStore(store) { STORE = store; }

// ---------------------------------------------------------------- presence

function entryOf(id) { return ONLINE.get(id) || null; }
export function isOnline(id) { const e = ONLINE.get(id); return !!e && e.sinks.size > 0; }

/** Where someone is right now, as their friends see it. */
export function whereIs(id) {
  const e = ONLINE.get(id);
  if (!e || !e.sinks.size) return null;
  // the most telling of their rooms: a fight beats the world
  let best = null;
  for (const s of e.sinks.values()) if (!best || (s.where !== 'world' && best.where === 'world')) best = s;
  return { zone: best.zone, where: best.where };
}

/** A room's client for one player: world, battle or dungeon. `sink` is
 *  { send(event, data), where, zone, setParty?(partyId), pos?() }. */
export function attach(doc, key, sink) {
  if (!doc?.id) return;
  let e = ONLINE.get(doc.id);
  // still here from a moment ago (a room switch): not a fresh log-on
  const fresh = !e;
  if (!e) { e = { id: doc.id, doc, sinks: new Map(), offTimer: null, chatTimes: [], worldAt: 0 }; ONLINE.set(doc.id, e); }
  clearTimeout(e.offTimer); e.offTimer = null;
  clearTimeout(e.partyTimer); e.partyTimer = null;
  e.doc = doc;
  e.sinks.set(key, sink);
  normalize(doc);
  // a party that ended while they were away
  if (doc.partyId && !PARTIES.get(doc.partyId)?.members.includes(doc.id)) doc.partyId = '';
  sink.setParty?.(doc.partyId || '');
  // their friends see them come on (or move); their party sees where they are
  if (fresh) tellFriends(doc.id);
  else tellFriends(doc.id, true);
  doc.partyId && pushParty(doc.partyId);
}

export function detach(id, key) {
  const e = ONLINE.get(id);
  if (!e) return;
  e.sinks.delete(key);
  if (e.sinks.size) { tellFriends(id, true); return; }
  clearTimeout(e.offTimer);
  e.offTimer = setTimeout(() => {
    if (e.sinks.size) return;
    ONLINE.delete(id);
    tellFriends(id);
    const pid = e.doc?.partyId;
    if (pid && PARTIES.has(pid)) {
      pushParty(pid);
      // gone long enough, and they are out of it
      e.partyTimer = setTimeout(() => {
        if (!isOnline(id) && PARTIES.get(pid)?.members.includes(id)) leaveParty(e.doc, 'gone');
      }, SOCIAL.partyDropMs);
      e.partyTimer.unref?.();
    }
  }, SOCIAL.offlineGraceMs);
  e.offTimer.unref?.();
}

/** Tell one player's screen something, wherever they are. */
export function sendTo(id, event, data) {
  const e = ONLINE.get(id);
  if (!e) return 0;
  let n = 0;
  for (const s of e.sinks.values()) { try { s.send(event, data); n++; } catch {} }
  return n;
}

/** The world client of a player, if they are in the world (not a fight). */
export function worldSink(id) {
  const e = ONLINE.get(id);
  if (!e) return null;
  for (const s of e.sinks.values()) if (s.where === 'world') return s;
  return null;
}

export function onlineByName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (const e of ONLINE.values()) if (e.sinks.size && String(e.doc?.name || '').toLowerCase() === n) return e;
  return null;
}

function normalize(doc) {
  doc.friends = Array.isArray(doc.friends) ? doc.friends.filter((x) => typeof x === 'string') : [];
  doc.friendRequests = (Array.isArray(doc.friendRequests) ? doc.friendRequests : [])
    .map((r) => (typeof r === 'string' ? { id: r, name: '', level: 1, at: 0 } : r))
    .filter((r) => r && typeof r.id === 'string');
  doc.friendInfo = doc.friendInfo && typeof doc.friendInfo === 'object' ? doc.friendInfo : {};
  doc.blocked = Array.isArray(doc.blocked) ? doc.blocked : [];
}

async function docOf(id) {
  const e = ONLINE.get(id);
  if (e?.doc) return e.doc;
  if (!STORE) return null;
  const d = await STORE.getDoc(id).catch(() => null);
  d && normalize(d);
  return d;
}

function saveDoc(doc) { STORE?.saveDoc(doc).catch(() => {}); }

/** Has `a` blocked `b` (either way counts for anything between them)? */
function blockedBetween(a, b) {
  const da = ONLINE.get(a)?.doc, db = ONLINE.get(b)?.doc;
  return !!(da?.blocked?.includes(b) || db?.blocked?.includes(a));
}

// ---------------------------------------------------------------- friends

function friendRow(doc, id) {
  const e = ONLINE.get(id), on = !!e && e.sinks.size > 0;
  if (on) doc.friendInfo[id] = { name: e.doc.name, level: e.doc.level };
  const info = on ? { name: e.doc.name, level: e.doc.level } : (doc.friendInfo[id] || { name: '?', level: 1 });
  const w = on ? whereIs(id) : null;
  return {
    id, name: info.name, level: info.level, online: on,
    zone: w?.zone || '', status: w?.where || '',
    party: !!doc.partyId && PARTIES.get(doc.partyId)?.members.includes(id),
  };
}

export function friendsView(doc) {
  normalize(doc);
  const friends = doc.friends.map((id) => friendRow(doc, id))
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  const pending = doc.friendRequests.map((r) => {
    const e = ONLINE.get(r.id);
    return { id: r.id, name: e?.doc?.name || r.name, level: e?.doc?.level || r.level, at: r.at };
  });
  return { friends, pending, blocked: doc.blocked.map((id) => ({ id, name: doc.friendInfo[id]?.name || '?' })) };
}

function pushFriends(id) {
  const e = ONLINE.get(id);
  e?.doc && sendTo(id, 'friends', friendsView(e.doc));
}

/** Everyone who has this player as a friend and is online gets a fresh list.
 *  `quiet`: a move, not a log-on — no "came online" line. */
function tellFriends(id, quiet = false) {
  const me = ONLINE.get(id)?.doc;
  for (const e of ONLINE.values()) {
    if (!e.sinks.size || e.id === id || !e.doc?.friends?.includes(id)) continue;
    e.doc && sendTo(e.id, 'friends', friendsView(e.doc));
    if (!quiet && me && isOnline(id)) sendTo(e.id, 'chat', { ch: 'system', t: Date.now(), text: `👥 ${me.name} התחבר/ה.` });
  }
}

/** Ask to be friends, by id or by character name. */
export async function friendAdd(doc, { id, name } = {}) {
  normalize(doc);
  let target = typeof id === 'string' && id ? id : null;
  if (!target && name) {
    const on = onlineByName(name);
    target = on?.id || (await STORE?.findDocIdByName?.(String(name).trim()).catch(() => null)) || null;
  }
  if (!target) return { ok: false, code: 'player_not_found' };
  if (target === doc.id) return { ok: false, code: 'not_yourself' };
  if (doc.friends.includes(target)) return { ok: false, code: 'already_friends' };
  if (doc.friends.length >= SOCIAL.friendMax) return { ok: false, code: 'too_many_friends' };
  const other = await docOf(target);
  if (!other) return { ok: false, code: 'player_not_found' };
  // they asked first: that is a yes both ways
  if (doc.friendRequests.some((r) => r.id === target)) return friendRespond(doc, target, true);
  // asking someone who has blocked you looks the same as asking anyone
  if (other.blocked.includes(doc.id)) return { ok: true, pending: true, name: other.name };
  doc.friendInfo[target] = { name: other.name, level: other.level };
  if (!other.friendRequests.some((r) => r.id === doc.id)) {
    other.friendRequests.push({ id: doc.id, name: doc.name, level: doc.level, at: Date.now() });
    while (other.friendRequests.length > SOCIAL.requestMax) other.friendRequests.shift();
    saveDoc(other);
    sendTo(target, 'friendRequest', { fromId: doc.id, fromName: doc.name, level: doc.level });
    pushFriends(target);
  }
  return { ok: true, pending: true, name: other.name };
}

export async function friendRespond(doc, fromId, accept) {
  normalize(doc);
  const req = doc.friendRequests.find((r) => r.id === fromId);
  doc.friendRequests = doc.friendRequests.filter((r) => r.id !== fromId);
  if (!req && !accept) return { ok: true };
  if (!accept) { pushFriends(doc.id); return { ok: true, declined: true }; }
  const other = await docOf(fromId);
  if (!other) { pushFriends(doc.id); return { ok: false, code: 'player_not_found' }; }
  other.friendRequests = other.friendRequests.filter((r) => r.id !== doc.id);
  if (!doc.friends.includes(fromId)) doc.friends.push(fromId);
  if (!other.friends.includes(doc.id)) other.friends.push(doc.id);
  doc.friendInfo[fromId] = { name: other.name, level: other.level };
  other.friendInfo[doc.id] = { name: doc.name, level: doc.level };
  saveDoc(other); saveDoc(doc);
  sendTo(fromId, 'friendResult', { ok: true, name: doc.name, added: true });
  sendTo(fromId, 'chat', { ch: 'system', t: Date.now(), text: `👥 ${doc.name} אישר/ה את בקשת החברות.` });
  pushFriends(fromId); pushFriends(doc.id);
  return { ok: true, added: true, name: other.name };
}

export async function friendRemove(doc, id) {
  normalize(doc);
  doc.friends = doc.friends.filter((x) => x !== id);
  const other = await docOf(id);
  if (other) { other.friends = other.friends.filter((x) => x !== doc.id); saveDoc(other); pushFriends(id); }
  saveDoc(doc); pushFriends(doc.id);
  return { ok: true };
}

/** Block: no whispers, invitations or requests from them, and no friendship. */
export async function block(doc, id, on = true) {
  normalize(doc);
  if (!id || id === doc.id) return { ok: false, code: 'not_yourself' };
  if (on) {
    if (!doc.blocked.includes(id)) doc.blocked.push(id);
    const other = await docOf(id);
    if (other && !doc.friendInfo[id]) doc.friendInfo[id] = { name: other.name, level: other.level };
    doc.friendRequests = doc.friendRequests.filter((r) => r.id !== id);
    if (doc.friends.includes(id)) await friendRemove(doc, id);
    if (other) { other.friendRequests = other.friendRequests.filter((r) => r.id !== doc.id); saveDoc(other); }
  } else doc.blocked = doc.blocked.filter((x) => x !== id);
  saveDoc(doc); pushFriends(doc.id);
  return { ok: true };
}

// ---------------------------------------------------------------- chat

// A short list, in both languages the game is played in, masked rather than
// refused: the message still arrives, the word does not.
const ROUGH = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'faggot', 'whore', 'slut',
  'זונה', 'שרמוטה', 'כוס אמא', 'כוסאמק', 'כוס אמק', 'בן זונה', 'מזדיין', 'לך תזדיין', 'קוקסינל', 'הומו מסריח',
];
const ROUGH_RE = new RegExp(ROUGH.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
export function clean(text) {
  return String(text || '').replace(/[\u0000-\u001f‎‏‪-‮]/g, '').slice(0, 240).replace(ROUGH_RE, (m) => '*'.repeat(m.length));
}

/**
 * A chat line from a player. Zone chat stays in the room (`roomBroadcast`);
 * world, party and whisper go through here. Returns an error code, or null.
 */
export function chat(doc, { ch, text, to, toId } = {}, roomBroadcast) {
  const e = ONLINE.get(doc.id), now = Date.now();
  const body = clean(text).trim();
  if (!body) return null;
  if (e) {
    // a burst is fine, a flood is not; the world channel is slower still
    e.chatTimes = (e.chatTimes || []).filter((x) => now - x < SOCIAL.chatWindowMs);
    if (e.chatTimes.length >= SOCIAL.chatBurst) return 'chat_too_fast';
    if (ch === 'world' && now - e.worldAt < SOCIAL.worldGapMs) return 'chat_too_fast';
    e.chatTimes.push(now); if (ch === 'world') e.worldAt = now;
  }
  const msg = { ch, from: doc.name, fromId: doc.id, text: body, t: now };
  if (ch === 'world') {
    for (const o of ONLINE.values()) if (o.sinks.size && !o.doc?.blocked?.includes(doc.id)) sendTo(o.id, 'chat', msg);
    return null;
  }
  if (ch === 'party') {
    const p = doc.partyId && PARTIES.get(doc.partyId);
    if (!p) return 'not_in_party';
    for (const id of p.members) if (!ONLINE.get(id)?.doc?.blocked?.includes(doc.id)) sendTo(id, 'chat', msg);
    return null;
  }
  if (ch === 'whisper') {
    const target = (typeof toId === 'string' && ONLINE.get(toId)) || onlineByName(to);
    if (!target || !target.sinks.size) return 'player_offline';
    if (target.id === doc.id) return 'not_yourself';
    const out = { ...msg, to: target.doc.name, toId: target.id };
    // a blocked sender is told nothing different
    if (!target.doc.blocked?.includes(doc.id)) sendTo(target.id, 'chat', out);
    sendTo(doc.id, 'chat', out);
    return null;
  }
  // zone (and anything else): the room the sender is in, minus who blocked them
  roomBroadcast?.(msg, (otherId) => !ONLINE.get(otherId)?.doc?.blocked?.includes(doc.id));
  return null;
}

// ---------------------------------------------------------------- parties

export function partyOf(id) {
  const pid = ONLINE.get(id)?.doc?.partyId;
  const p = pid && PARTIES.get(pid);
  return p && p.members.includes(id) ? p : null;
}

function memberRow(id) {
  const e = ONLINE.get(id), d = e?.doc, w = whereIs(id), c = d && activeCreature(d);
  return {
    id, name: d?.name || '?', level: d?.level || 1, online: !!w,
    zone: w?.zone || '', status: w?.where || 'offline',
    hp: d ? Math.round(hpRatio(d) * 100) / 100 : 0,
    petSpecies: c?.species || '', petStar: c?.star || 1,
    kind: d?.appearance?.kind || '', look: d?.appearance?.look || '',
  };
}

export function partyView(p) {
  if (!p) return null;
  return { id: p.id, leaderId: p.leader, max: SOCIAL.partyMax, members: p.members.map(memberRow) };
}

function pushParty(pid) {
  const p = PARTIES.get(pid);
  if (!p) return;
  const view = partyView(p);
  p.sig = JSON.stringify(view);
  for (const id of p.members) sendTo(id, 'party', view);
}

function setParty(id, pid) {
  const e = ONLINE.get(id);
  if (!e?.doc) return;
  e.doc.partyId = pid || '';
  for (const s of e.sinks.values()) s.setParty?.(pid || '');
}

/** Invite someone online into your party (made on the spot if you have none). */
export function partyInvite(doc, { id, name } = {}) {
  const target = (typeof id === 'string' && ONLINE.get(id)) || onlineByName(name);
  if (!target || !target.sinks.size) return { ok: false, code: 'player_offline' };
  if (target.id === doc.id) return { ok: false, code: 'not_yourself' };
  if (blockedBetween(doc.id, target.id)) return { ok: true, sent: true, name: target.doc.name };
  const mine = partyOf(doc.id);
  if (mine?.members.includes(target.id)) return { ok: false, code: 'already_in_party' };
  if (mine && mine.members.length >= SOCIAL.partyMax) return { ok: false, code: 'party_full' };
  // one open invitation from me to them at a time
  for (const [k, v] of INVITES) if (v.kind === 'party' && v.from === doc.id && v.to === target.id) INVITES.delete(k);
  const inv = { id: newId('pi'), kind: 'party', from: doc.id, fromName: doc.name, to: target.id, until: Date.now() + SOCIAL.inviteMs };
  INVITES.set(inv.id, inv);
  sendTo(target.id, 'partyInvite', {
    inviteId: inv.id, partyId: mine?.id || '', fromId: doc.id, fromName: doc.name,
    size: mine?.members.length || 1, until: inv.until,
  });
  return { ok: true, sent: true, name: target.doc.name };
}

function liveInvite(inviteId, kind, to) {
  const inv = INVITES.get(inviteId);
  if (!inv || inv.kind !== kind || inv.to !== to) return null;
  if (Date.now() > inv.until) { INVITES.delete(inviteId); return null; }
  return inv;
}

/** Find the open invitation an older client answers by party id or sender. */
function findInvite(kind, to, { inviteId, partyId, fromId } = {}) {
  if (inviteId) return liveInvite(inviteId, kind, to);
  for (const inv of INVITES.values()) {
    if (inv.kind !== kind || inv.to !== to || Date.now() > inv.until) continue;
    if (fromId && inv.from === fromId) return inv;
    if (partyId && PARTIES.get(partyId)?.members.includes(inv.from)) return inv;
  }
  return null;
}

export function partyAccept(doc, args = {}) {
  const inv = findInvite('party', doc.id, args);
  if (!inv) return { ok: false, code: 'invite_expired' };
  INVITES.delete(inv.id);
  if (!isOnline(inv.from)) return { ok: false, code: 'player_offline' };
  let p = partyOf(inv.from);
  if (p?.members.includes(doc.id)) return { ok: true };
  if (p && p.members.length >= SOCIAL.partyMax) return { ok: false, code: 'party_full' };
  // leaving the one you were in
  if (partyOf(doc.id)) leaveParty(doc, 'left');
  if (!p) {
    p = { id: newId('p'), leader: inv.from, members: [inv.from] };
    PARTIES.set(p.id, p);
    setParty(inv.from, p.id);
  }
  p.members.push(doc.id);
  setParty(doc.id, p.id);
  for (const id of p.members) sendTo(id, 'chat', { ch: 'party', t: Date.now(), from: '', text: `⚔ ${doc.name} הצטרף/ה לקבוצה (${p.members.length}/${SOCIAL.partyMax}).` });
  pushParty(p.id);
  return { ok: true, partyId: p.id };
}

export function partyDecline(doc, args = {}) {
  const inv = findInvite('party', doc.id, args);
  if (!inv) return { ok: true };
  INVITES.delete(inv.id);
  sendTo(inv.from, 'chat', { ch: 'system', t: Date.now(), text: `${doc.name} לא הצטרף/ה לקבוצה.` });
  return { ok: true };
}

export function leaveParty(doc, why = 'left') {
  const p = doc?.partyId && PARTIES.get(doc.partyId);
  if (!p) { doc && (doc.partyId = ''); return { ok: true }; }
  p.members = p.members.filter((x) => x !== doc.id);
  doc.partyId = '';
  setParty(doc.id, '');
  sendTo(doc.id, 'party', null);
  const line = why === 'kicked' ? `${doc.name} הוצא/ה מהקבוצה.` : why === 'gone' ? `${doc.name} התנתק/ה ויצא/ה מהקבוצה.` : `${doc.name} עזב/ה את הקבוצה.`;
  if (p.members.length <= 1) {
    // one is not a party
    for (const id of p.members) { setParty(id, ''); sendTo(id, 'party', null); sendTo(id, 'chat', { ch: 'system', t: Date.now(), text: `${line} הקבוצה התפרקה.` }); }
    PARTIES.delete(p.id);
    return { ok: true };
  }
  if (p.leader === doc.id) p.leader = p.members.find((id) => isOnline(id)) || p.members[0];
  for (const id of p.members) sendTo(id, 'chat', { ch: 'party', t: Date.now(), from: '', text: line });
  pushParty(p.id);
  return { ok: true };
}

export function partyKick(doc, id) {
  const p = partyOf(doc.id);
  if (!p || p.leader !== doc.id) return { ok: false, code: 'not_leader' };
  if (!p.members.includes(id) || id === doc.id) return { ok: false, code: 'not_in_party' };
  const d = ONLINE.get(id)?.doc || { id, partyId: p.id, name: '?' };
  d.partyId = p.id;
  return leaveParty(d, 'kicked');
}

export function partyPromote(doc, id) {
  const p = partyOf(doc.id);
  if (!p || p.leader !== doc.id) return { ok: false, code: 'not_leader' };
  if (!p.members.includes(id)) return { ok: false, code: 'not_in_party' };
  p.leader = id;
  pushParty(p.id);
  return { ok: true };
}

// ---------------------------------------------------------------- fights between players

/**
 * Challenge someone standing in the same zone: one against one, or — when
 * both of you are in a party of two, everyone here and free — two against two.
 */
export function challenge(doc, { id, pair = false } = {}) {
  const me = ONLINE.get(doc.id), them = typeof id === 'string' ? ONLINE.get(id) : null;
  const mine = worldSink(doc.id), theirs = them && worldSink(them.id);
  if (!them || !theirs) return { ok: false, code: 'player_offline' };
  if (them.id === doc.id) return { ok: false, code: 'not_yourself' };
  if (!mine || mine.zone !== theirs.zone) return { ok: false, code: 'not_same_zone' };
  if (blockedBetween(doc.id, them.id)) return { ok: true, sent: true, name: them.doc.name };
  let sides = { a: [doc.id], b: [them.id] };
  if (pair) {
    const pa = partyOf(doc.id), pb = partyOf(them.id);
    if (!pa || pa.members.length !== 2) return { ok: false, code: 'need_pair' };
    if (!pb || pb.members.length !== 2 || pb === pa) return { ok: false, code: 'they_need_pair' };
    for (const pid of [...pa.members, ...pb.members]) {
      const s = worldSink(pid);
      if (!s || s.zone !== mine.zone) return { ok: false, code: 'pair_not_here' };
    }
    sides = { a: [...pa.members], b: [...pb.members] };
  }
  for (const [k, v] of INVITES) if (v.kind === 'duel' && v.from === doc.id) INVITES.delete(k);
  const inv = { id: newId('d'), kind: 'duel', from: doc.id, fromName: doc.name, to: them.id, pair: !!pair, sides, zone: mine.zone, until: Date.now() + SOCIAL.duelInviteMs };
  INVITES.set(inv.id, inv);
  const allies = sides.a.filter((x) => x !== doc.id).map((x) => ONLINE.get(x)?.doc?.name || '?');
  sendTo(them.id, 'duelRequest', { inviteId: inv.id, fromId: doc.id, fromName: doc.name, level: doc.level, pair: !!pair, allies, until: inv.until });
  // the challenger's partner hears about it too
  if (pair) for (const x of sides.a) x !== doc.id && sendTo(x, 'chat', { ch: 'party', t: Date.now(), from: '', text: `⚔ ${doc.name} הזמין/ה את ${them.doc.name} וחבר/ת הקבוצה לקרב זוגות.` });
  return { ok: true, sent: true, name: them.doc.name, pair: !!pair };
}

/** Yes to a challenge: who fights on which side, checked again now. */
export function acceptChallenge(doc, args = {}) {
  const inv = findInvite('duel', doc.id, args);
  if (!inv) return { ok: false, code: 'invite_expired' };
  INVITES.delete(inv.id);
  // the partner of the one answering may be the one who was challenged
  const everyone = [...inv.sides.a, ...inv.sides.b];
  for (const id of everyone) {
    const s = worldSink(id);
    if (!s || s.zone !== inv.zone) return { ok: false, code: inv.pair ? 'pair_not_here' : 'player_offline' };
  }
  if (inv.pair) {
    const pa = partyOf(inv.from), pb = partyOf(doc.id);
    if (!pa || !pb || pa.members.length !== 2 || pb.members.length !== 2) return { ok: false, code: 'need_pair' };
  }
  return { ok: true, sides: inv.sides, pair: inv.pair, zone: inv.zone, from: inv.from };
}

export function declineChallenge(doc, args = {}) {
  const inv = findInvite('duel', doc.id, args);
  if (inv) { INVITES.delete(inv.id); sendTo(inv.from, 'chat', { ch: 'system', t: Date.now(), text: `${doc.name} דחה/תה את הקרב.` }); }
  return { ok: true };
}

// ---------------------------------------------------------------- co-op fights

const COOP = new Map();   // battle roomId -> { partyId, zone, allowed:Set, until, species, level, from }

/** A party member started a fight with a wild: the others nearby may join. */
export function offerCoop({ roomId, doc, zone, wild, near, allowed }) {
  const p = partyOf(doc.id);
  if (!p) return 0;
  const offer = { roomId, partyId: p.id, zone, allowed, until: Date.now() + 15_000, species: wild.species, level: wild.level, from: doc.id };
  let n = 0;
  for (const id of p.members) {
    if (id === doc.id) continue;
    const s = worldSink(id);
    if (!s || s.zone !== zone || !near(id)) continue;
    sendTo(id, 'coopOffer', { roomId, fromId: doc.id, fromName: doc.name, species: wild.species, level: wild.level, until: offer.until });
    n++;
  }
  if (n) COOP.set(roomId, offer);
  return n;
}

/** Someone said yes to joining a party member's fight. */
export function joinCoop(doc, roomId, zone) {
  const o = COOP.get(roomId);
  if (!o || Date.now() > o.until) return { ok: false, code: 'fight_over' };
  if (o.zone !== zone) return { ok: false, code: 'not_same_zone' };
  const p = partyOf(doc.id);
  if (!p || p.id !== o.partyId) return { ok: false, code: 'not_in_party' };
  o.allowed.add(doc.id);
  return { ok: true, roomId };
}

export function endCoop(roomId) { COOP.delete(roomId); }

// ---------------------------------------------------------------- upkeep

// Parties see each other's health, zone and status without anyone asking:
// pushed when something they would see has changed.
const upkeep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of INVITES) if (now > v.until + 5000) INVITES.delete(k);
  for (const [k, v] of COOP) if (now > v.until + 60_000) COOP.delete(k);
  for (const p of PARTIES.values()) {
    const sig = JSON.stringify(partyView(p));
    if (sig !== p.sig) pushParty(p.id);
  }
}, SOCIAL.pushEveryMs);
upkeep.unref?.();

/** For tests: forget everyone. */
export function _reset() { ONLINE.clear(); PARTIES.clear(); INVITES.clear(); COOP.clear(); }
export const _debug = { ONLINE, PARTIES, INVITES, COOP };
