// GM tools, behind one message: `gm` with an `op`.
//
// Every op is refused unless the server decided at join time that this
// session belongs to a GM (ctx.admin — see server/admin.js); the client only
// decides whether to draw the panel. Every op that changes anything is written
// to the audit log with who did it, to whom, and what.
//
// ctx.gm is the online room's reach beyond one player: everyone online in any
// zone, the log, a broadcast to the whole server. The single-player build has
// no ctx.gm and no GMs.
import { ITEMS, PROGRESSION, SPECIES, ZONES } from '../../shared/gamedata.js';
import { activeCreature, addCreature, creatureCard, dexRecord, giveItem, healTeam, makeCreature, publicProfile } from './combat.js';
import { hpRatio } from './player.js';

export const GM_LIMITS = {
  gold: 10_000_000,        // most gold in one gift
  goldCap: 999_999_999,    // most gold anyone can hold
  qty: 999,                // most of one item in one gift
  fillGold: 10_000_000,    // "fill" tops gold up to this
  fillQty: 999,            // and every consumable and material to this
  text: 200,               // an announcement
  summons: 6,              // summoned wilds alive in one zone at once
};

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
    return { doc: ctx.doc, self: ctx.self, send: ctx.net.emit, save: ctx.net.save, me: true };
  }
  const t = ctx.gm.reach(String(to));
  return t ? { ...t, me: false } : null;
}

function refresh(t) {
  const p = t.self?.();
  if (p) { p.hpRatio = hpRatio(t.doc); p.petSpecies = activeCreature(t.doc)?.species || ''; }
  t.save?.();
  t.send('profile', publicProfile(t.doc));
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
        detail = { what, species: c.species, level, shiny: c.shiny, where: doc.team.includes(c.uid) ? 'team' : 'box' };
        gift = { what, species: c.species, level, shiny: c.shiny, card: creatureCard(doc, c.uid) };
      } else if (what === 'gold') {
        const amount = int(t.amount, 0, GM_LIMITS.gold, 0);   // nothing, or less: refused
        if (!amount) return fail('bad_amount');
        const before = doc.gold || 0;
        doc.gold = Math.min(GM_LIMITS.goldCap, before + amount);
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
        doc.level = level;
        doc.xp = level > 1 ? PROGRESSION.xpToLevel(level) : 0;
        const p = target.self?.();
        if (p) p.level = level;
        detail = { what, level };
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
      doc.gold = Math.max(doc.gold || 0, GM_LIMITS.fillGold);
      let kinds = 0;
      for (const [id, it] of Object.entries(ITEMS)) {
        if (!FILL_KINDS.has(it.kind)) continue;
        doc.inventory[id] = Math.max(doc.inventory[id] || 0, GM_LIMITS.fillQty);
        kinds++;
      }
      refresh(target);
      if (!target.me) target.send('gmGift', { from: ctx.doc.name, what: 'fill' });
      return done({ gold: doc.gold, items: kinds, qty: GM_LIMITS.fillQty }, doc);
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
      let zone, beside = null;
      if (t.player) {
        const other = ctx.gm.reach(String(t.player));
        const p = other?.self?.();
        if (!other || !p) return fail('player_offline');
        zone = other.zoneId;
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
      ctx.net.emit('goto', beside ? { kind: 'world', zone } : { kind: 'world', zone, fromZone: ctx.zoneId });
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
