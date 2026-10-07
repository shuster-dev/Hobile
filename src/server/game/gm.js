// GM tools, behind one message: `gm` with an `op`.
//
// Every op is refused unless the server decided at join time that this
// session belongs to a GM (ctx.admin — see server/admin.js); the client only
// decides whether to draw the panel. Every op that changes anything is written
// to the audit log with who did it, to whom, and what.
//
// What a GM can give, a GM can take back: gold, a number of an item, a
// creature (`take`) — and any gift, fill or take in the log can be undone
// from its row (`undo`), which is how "I typed 500 and meant 50" is fixed.
// The player is told, as they are told of a gift.
//
// ctx.gm is the online room's reach beyond one player: everyone online in any
// zone, the log, a broadcast to the whole server. The single-player build has
// no ctx.gm and no GMs.
import { ITEMS, PROGRESSION, SPECIES, ZONES } from '../../shared/gamedata.js';
import { activeCreature, addCreature, creatureCard, dexRecord, giveItem, healTeam, isWorker, makeCreature, publicProfile, takeItem, unassignWorker } from './combat.js';
import { hpRatio } from './player.js';
import { earn, economyReport, spend } from './economy.js';
import { setSaddle } from './saddles.js';
import { mountKind } from '../../shared/riding.js';

export const GM_LIMITS = {
  gold: 10_000_000,        // most gold in one gift
  goldCap: 999_999_999,    // most gold anyone can hold
  qty: 999,                // most of one item in one gift
  fillGold: 10_000_000,    // "fill" tops gold up to this
  fillQty: 999,            // and every consumable and material to this
  text: 200,               // an announcement
  summons: 6,              // summoned wilds alive in one zone at once
  takeQty: 999_999,        // most of one item taken back in one go
};

// What the log can undo.
const UNDOABLE = new Set(['give', 'fill', 'take']);
// rows undone by this process (the log's own record of it may still be on its way)
const UNDONE = new Set();

// What "fill" tops up: everything a player spends, not the gear they wear.
const FILL_KINDS = new Set(['sphere', 'heal', 'revive', 'stamina', 'trainerHeal', 'material']);

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const int = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

/** The player a gift or a warp is aimed at: this GM, or someone online. */
function targetOf(ctx, to) {
  if (!to || to === 'me' || to === ctx.doc.id) {
    return { doc: ctx.doc, self: ctx.self, send: ctx.net.emit, save: ctx.net.save, ctx: () => ctx, me: true };
  }
  const t = ctx.gm.reach(String(to));
  return t ? { ...t, me: false } : null;
}

const podded = (doc, uid) => !!doc.base?.training?.some((t) => t.uid === uid);

/** Where a creature is: team, box, a training pod, or at work on the farm. */
function whereIs(doc, uid) {
  if ((doc.team || []).includes(uid)) return 'team';
  if (podded(doc, uid)) return 'pod';
  if (doc.base?.workers?.some((w) => w.uid === uid)) return 'work';
  return 'box';
}

/**
 * Take one creature away for good, from wherever it is. Not the last one
 * that could fight: a player always has someone to walk with. Returns the
 * creature as it was (the log keeps it, so the take can be undone).
 */
export function removeCreature(doc, uid, target = null) {
  const c = typeof uid === 'string' && Object.prototype.hasOwnProperty.call(doc.creatures || {}, uid) ? doc.creatures[uid] : null;
  if (!c) return { error: 'no_creature' };
  const others = Object.keys(doc.creatures).filter((u) => u !== uid && doc.creatures[u] && !podded(doc, u));
  if (!others.length) return { error: 'last_creature' };
  const where = whereIs(doc, uid), snapshot = JSON.parse(JSON.stringify(c));
  doc.team = (doc.team || []).filter((u) => u !== uid);
  doc.box = (doc.box || []).filter((u) => u !== uid);
  if (doc.base) {
    doc.base.training = (doc.base.training || []).filter((t) => t.uid !== uid);
    doc.base.workers = (doc.base.workers || []).filter((w) => w.uid !== uid);
  }
  delete doc.creatures[uid];
  // the team is never left empty: the first in the box steps up (off its job)
  if (!doc.team.length) {
    const k = Math.max(0, doc.box.findIndex((u) => !isWorker(doc, u)));
    if (doc.box[k]) { isWorker(doc, doc.box[k]) && unassignWorker(doc, doc.box[k]); doc.team.push(doc.box.splice(k, 1)[0]); }
  }
  // off its back, if it was the one being ridden
  if (doc.riding === uid) {
    doc.riding = null;
    const tc = target?.ctx?.(), p = target?.self?.();
    tc && (tc.ride = null);
    p && (p.mount = '', p.mountKind = '', p.mountStar = 1);
    target?.send?.('ride', null);
  }
  return { creature: snapshot, where };
}

/** A creature given back (an undone take): to the team if there is room. */
function restoreCreature(doc, c) {
  if (!c?.uid || !SPECIES[c.species]) return { error: 'no_creature' };
  if (doc.creatures?.[c.uid]) return { error: 'already_there' };
  addCreature(doc, JSON.parse(JSON.stringify(c)));
  return { where: doc.team.includes(c.uid) ? 'team' : 'box' };
}

function refresh(t) {
  const p = t.self?.();
  if (p) { p.hpRatio = hpRatio(t.doc); p.petSpecies = activeCreature(t.doc)?.species || ''; p.petStar = activeCreature(t.doc)?.star || 1; }
  t.save?.();
  t.send('profile', publicProfile(t.doc));
}

/** Take back gold, an item or a creature. Returns { detail } or { error }. */
function takeFrom(target, t) {
  const doc = target.doc, what = String(t.what || '');
  if (what === 'gold') {
    const want = int(t.amount, 0, GM_LIMITS.goldCap, 0);
    if (!want) return { error: 'bad_amount' };
    // out of the books as the GM's, as a gift is into them
    const amount = spend(doc, want, 'gm');
    if (!amount) return { error: 'nothing_to_take' };
    return { detail: { what, amount, asked: want } };
  }
  if (what === 'item') {
    if (!own(ITEMS, t.item)) return { error: 'bad_item' };
    const want = int(t.qty, 1, GM_LIMITS.takeQty, 1), have = doc.inventory?.[t.item] || 0, qty = Math.min(want, have);
    if (!qty || !takeItem(doc, t.item, qty)) return { error: 'nothing_to_take' };
    return { detail: { what, item: t.item, qty, asked: want } };
  }
  if (what === 'creature') {
    const r = removeCreature(doc, String(t.uid || ''), target);
    if (r.error) return r;
    return { detail: { what, uid: r.creature.uid, species: r.creature.species, level: r.creature.level, shiny: !!r.creature.shiny, from: r.where, creature: r.creature } };
  }
  return { error: 'bad_gift' };
}

/** The opposite of one row of the log, done to its player. */
function undoRow(target, row) {
  const doc = target.doc, d = row.detail || {};
  if (row.op === 'give') {
    if (d.what === 'creature') {
      const r = removeCreature(doc, d.uid, target);
      return r.error ? r : { detail: { what: 'creature', species: d.species, level: d.level, removed: true } };
    }
    if (d.what === 'gold') return { detail: { what: 'gold', amount: -spend(doc, d.amount, 'gm') } };
    if (d.what === 'item') {
      const qty = Math.min(d.qty || 0, doc.inventory?.[d.item] || 0);
      qty && takeItem(doc, d.item, qty);
      return { detail: { what: 'item', item: d.item, qty: -qty } };
    }
    if (d.what === 'level' && Number.isFinite(d.from)) {
      doc.level = d.from; doc.xp = Number.isFinite(d.fromXp) ? d.fromXp : (d.from > 1 ? PROGRESSION.xpToLevel(d.from) : 0);
      const p = target.self?.();
      p && (p.level = doc.level);
      return { detail: { what: 'level', level: doc.level } };
    }
    return { error: 'cannot_undo' };
  }
  if (row.op === 'fill') {
    const a = d.added;
    if (!a) return { error: 'cannot_undo' };
    const gold = spend(doc, a.gold || 0, 'gm');
    let items = 0;
    for (const [id, n] of Object.entries(a.items || {})) {
      const q = Math.min(n, doc.inventory?.[id] || 0);
      q && takeItem(doc, id, q) && items++;
    }
    return { detail: { what: 'fill', gold: -gold, items } };
  }
  if (row.op === 'take') {
    if (d.what === 'gold') return { detail: { what: 'gold', amount: earn(doc, d.amount || 0, 'gm') } };
    if (d.what === 'item' && own(ITEMS, d.item)) { giveItem(doc, d.item, d.qty || 0); return { detail: { what: 'item', item: d.item, qty: d.qty || 0 } }; }
    if (d.what === 'creature') {
      const r = restoreCreature(doc, d.creature);
      return r.error ? r : { detail: { what: 'creature', species: d.species, level: d.level, restored: true, where: r.where } };
    }
  }
  return { error: 'cannot_undo' };
}

function who(doc) { return doc ? { id: doc.id, name: doc.name } : null; }

export function handleGm(ctx, t = {}) {
  if (!ctx.admin || !ctx.gm) return ctx.net.emit('error', { code: 'forbidden' });
  const op = String(t.op || '');
  const done = (detail, target = null) => {
    ctx.gm.audit({ op, to: who(target), detail });
    ctx.net.emit('gm', { kind: 'done', op, to: target && target.id !== ctx.doc.id ? target.name : null, detail });
  };
  const fail = (code) => ctx.net.emit('gm', { kind: 'error', op, code });

  switch (op) {
    case 'hello':
      ctx.net.emit('gm', { kind: 'hello', limits: GM_LIMITS });
      return;

    case 'players':
      ctx.net.emit('gm', { kind: 'players', players: ctx.gm.online() });
      return;

    case 'economy':
      // the books: where gold came from and went, this process (economy.js)
      ctx.net.emit('gm', { kind: 'economy', report: economyReport() });
      return;

    case 'log':
      Promise.resolve(ctx.gm.recent(40))
        .then((rows) => ctx.net.emit('gm', { kind: 'log', rows }))
        .catch(() => fail('log_unavailable'));
      return;

    case 'give': {
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      const doc = target.doc;
      const what = String(t.what || '');
      let detail, gift;
      if (what === 'creature') {
        if (!own(SPECIES, t.species)) return fail('bad_species');
        const level = int(t.level, 1, PROGRESSION.maxLevel, 5);
        const c = makeCreature(t.species, level, { shiny: !!t.shiny });
        addCreature(doc, c);
        dexRecord(doc, c.species, c);
        detail = { what, species: c.species, level, shiny: c.shiny, uid: c.uid, where: doc.team.includes(c.uid) ? 'team' : 'box' };
        gift = { what, species: c.species, level, shiny: c.shiny, card: creatureCard(doc, c.uid) };
      } else if (what === 'gold') {
        const amount = int(t.amount, 0, GM_LIMITS.gold, 0);   // nothing, or less: refused
        if (!amount) return fail('bad_amount');
        const before = doc.gold || 0;
        // in the ledger as the GM's, so it does not read as the game paying out
        earn(doc, Math.max(0, Math.min(GM_LIMITS.goldCap, before + amount) - before), 'gm');
        detail = { what, amount: doc.gold - before };
        gift = { what, amount: doc.gold - before };
      } else if (what === 'item') {
        if (!own(ITEMS, t.item)) return fail('bad_item');
        const qty = int(t.qty, 1, GM_LIMITS.qty, 1);
        giveItem(doc, t.item, qty);
        detail = { what, item: t.item, qty };
        gift = { what, item: t.item, qty };
      } else if (what === 'level') {
        // The trainer's own level: what zones let you in, and what the
        // field's "still new" rule reads. XP is set to the start of it.
        const level = int(t.level, 1, PROGRESSION.maxLevel, 0);
        if (!level) return fail('bad_amount');
        const from = doc.level || 1, fromXp = doc.xp || 0;
        doc.level = level;
        doc.xp = level > 1 ? PROGRESSION.xpToLevel(level) : 0;
        const p = target.self?.();
        if (p) p.level = level;
        detail = { what, level, from, fromXp };
        gift = { what, level };
      } else return fail('bad_gift');
      refresh(target);
      if (!target.me) target.send('gmGift', { from: ctx.doc.name, ...gift });
      else if (what === 'creature') ctx.net.emit('gmGift', { from: null, ...gift });
      return done(detail, doc);
    }

    case 'fill': {
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      const doc = target.doc;
      // what was added, exactly, so the log can take just that back
      const added = { gold: earn(doc, Math.max(0, GM_LIMITS.fillGold - (doc.gold || 0)), 'gm'), items: {} };
      let kinds = 0;
      for (const [id, it] of Object.entries(ITEMS)) {
        if (!FILL_KINDS.has(it.kind)) continue;
        const had = doc.inventory[id] || 0;
        doc.inventory[id] = Math.max(had, GM_LIMITS.fillQty);
        doc.inventory[id] > had && (added.items[id] = doc.inventory[id] - had);
        kinds++;
      }
      refresh(target);
      if (!target.me) target.send('gmGift', { from: ctx.doc.name, what: 'fill' });
      return done({ gold: doc.gold, items: kinds, qty: GM_LIMITS.fillQty, added }, doc);
    }

    case 'take': {
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      const r = takeFrom(target, t);
      if (r.error) return fail(r.error);
      refresh(target);
      const { creature, ...told } = r.detail;
      target.send('gmTake', { from: target.me ? null : ctx.doc.name, ...told });
      return done(r.detail, target.doc);
    }

    case 'creatures': {
      // the player's creatures, for picking one to take back
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      const doc = target.doc, order = new Map((doc.team || []).map((u, i) => [u, i]));
      const list = Object.values(doc.creatures || {}).filter(Boolean)
        .map((c) => ({ uid: c.uid, species: c.species, level: c.level, star: c.star || 1, shiny: !!c.shiny, where: whereIs(doc, c.uid), saddle: !!c.saddle, rides: !!mountKind(c.species, c.star || 1) }))
        .sort((a, b) => (order.get(a.uid) ?? 99) - (order.get(b.uid) ?? 99) || b.level - a.level);
      ctx.net.emit('gm', { kind: 'creatures', to: doc.id, list });
      return;
    }

    case 'undo': {
      const id = String(t.id || '');
      if (!id) return fail('not_found');
      Promise.resolve(ctx.gm.recent(300)).then((rows) => {
        const row = (rows || []).find((r) => r.id === id);
        if (!row) return fail('not_found');
        if (!UNDOABLE.has(row.op)) return fail('cannot_undo');
        if (UNDONE.has(id) || (rows || []).some((r) => r.op === 'undo' && r.detail?.ref === id)) return fail('already_undone');
        const target = targetOf(ctx, row.to?.id || row.gm?.id);
        if (!target) return fail('player_offline');
        const r = undoRow(target, row);
        if (r.error) return fail(r.error);
        UNDONE.add(id);
        refresh(target);
        target.send('gmTake', { from: target.me ? null : ctx.doc.name, undo: row.op, ...r.detail });
        done({ ref: id, of: row.op, ...r.detail }, target.doc);
      }).catch(() => fail('log_unavailable'));
      return;
    }

    case 'heal': {
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      healTeam(target.doc, 1);
      refresh(target);
      target.send('healed', { gm: true });
      return done({}, target.doc);
    }

    case 'teleport': {
      // To a zone: arrive at its camp, like any journey. To a player: arrive
      // beside them, wherever they are standing.
      let zone, beside = null, room = null;
      if (t.player) {
        const other = ctx.gm.reach(String(t.player));
        const p = other?.self?.();
        if (!other || !p) return fail('player_offline');
        zone = other.zoneId;
        // the same channel as them, not just the same zone
        room = other.roomId || null;
        beside = { x: p.x + 1.2, z: p.z + 0.6, name: other.doc.name };
      } else {
        if (!own(ZONES, t.zone)) return fail('bad_zone');
        zone = t.zone;
      }
      const doc = ctx.doc;
      doc.zone = zone;
      if (beside) doc.pos = { zone, x: beside.x, z: beside.z };
      ctx.warping = true;
      ctx.net.save();
      done({ zone, beside: beside?.name || null });
      // Same message a portal sends. Without `fromZone` the arrival uses the
      // spot just written, which is what puts a warp next to the player.
      ctx.net.emit('goto', beside ? { kind: 'world', zone, ...(room ? { room } : {}) } : { kind: 'world', zone, fromZone: ctx.zoneId });
      return;
    }

    case 'bring': {
      // The other way round: a player brought to stand beside the GM, from
      // wherever they are in the world, into this very channel. Not someone
      // in a fight or a dungeon (they are not in a world room to move).
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      if (target.me) return fail('not_yourself');
      const me = ctx.self?.();
      if (!me) return fail('player_offline');
      const tctx = target.ctx?.();
      const doc = target.doc, zone = ctx.zoneId;
      doc.zone = zone;
      doc.pos = { zone, x: me.x - 1.2, z: me.z + 0.6 };
      // their room stops taking their steps, so nothing writes over the spot
      tctx && (tctx.warping = true);
      target.save?.();
      const from = target.zoneId;
      target.send('gmBring', { from: ctx.doc.name, zone });
      target.send('goto', { kind: 'world', zone, ...(ctx.roomId ? { room: ctx.roomId } : {}) });
      return done({ zone, from }, doc);
    }

    case 'saddle': {
      // fit a saddle by hand, or take one off (game/saddles.js)
      const target = targetOf(ctx, t.to);
      if (!target) return fail('player_offline');
      const r = setSaddle(target.doc, String(t.uid || ''), t.on !== false);
      if (r.error) return fail(r.error);
      // off its back, if it was the one being ridden
      if (t.on === false && target.doc.riding === r.uid) {
        target.doc.riding = null;
        const tc = target.ctx?.(), p = target.self?.();
        tc && (tc.ride = null);
        p && (p.mount = '', p.mountKind = '', p.mountStar = 1);
        target.send('ride', null);
      }
      refresh(target);
      target.me || target.send(t.on === false ? 'gmTake' : 'gmGift', { from: ctx.doc.name, what: 'saddle', species: r.species });
      return done({ what: 'saddle', on: t.on !== false, species: r.species, uid: r.uid }, target.doc);
    }

    case 'reports': {
      // the inbox: open reports first (server/reports.js)
      if (!ctx.gm.reports) return fail('reports_unavailable');
      Promise.resolve(ctx.gm.reports.list(60))
        .then((rows) => ctx.net.emit('gm', { kind: 'reports', rows, open: rows.filter((r) => r.status === 'open').length }))
        .catch(() => fail('reports_unavailable'));
      return;
    }

    case 'reportSet': {
      if (!ctx.gm.reports) return fail('reports_unavailable');
      Promise.resolve(ctx.gm.reports.set(String(t.id || ''), String(t.status || '')))
        .then(async (r) => {
          if (r.error) return fail(r.error);
          ctx.gm.audit({ op: 'reportSet', to: { id: r.report.about?.id, name: r.report.about?.name }, detail: { ref: r.report.id, status: r.report.status, reason: r.report.reason } });
          const rows = await ctx.gm.reports.list(60);
          ctx.net.emit('gm', { kind: 'reports', rows, open: rows.filter((x) => x.status === 'open').length });
        })
        .catch(() => fail('reports_unavailable'));
      return;
    }

    case 'summon': {
      if (!own(SPECIES, t.species)) return fail('bad_species');
      const level = int(t.level, 1, PROGRESSION.maxLevel, 5);
      const id = ctx.gm.summon(t.species, level);
      if (!id) return fail('too_many_summons');
      return done({ species: t.species, level, zone: ctx.zoneId });
    }

    case 'announce': {
      const text = String(t.text || '').replace(/\s+/g, ' ').trim().slice(0, GM_LIMITS.text);
      if (!text) return fail('empty');
      const reached = ctx.gm.broadcast({ ch: 'gm', from: ctx.doc.name, fromId: ctx.doc.id, text, t: Date.now() });
      return done({ text, reached });
    }

    default:
      return fail('unknown_op');
  }
}
