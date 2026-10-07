// The world message protocol, shared by both drivers.
//
// It used to live inside WorldSim, which is the single-player simulation: the
// server would have had to re-implement all 34 messages a second time, and the
// two copies would have drifted on the first balance change. It is written
// against a small context instead:
//
//   doc, net.emit(event, data), net.save(), state, zone, zoneId, colliders,
//   wildDocs, bossContribution, _bossCd, self(), welcome(), speak(),
//   guildView(), friendList(), refreshBossBoard(), checkVisits(), chat(msg),
//   startBattle(opts), startDungeon(opts)
//
// WorldSim satisfies it directly; WorldRoom builds one per connected client.
import { DUNGEONS, GUILD, ITEMS, MOVES, PROGRESSION, SPECIES, ZONES, statsFor, clinicCost } from '../../shared/gamedata.js';
import { NPCS, npcAt, npcLines } from '../../shared/npcs.js';
import { giverView } from '../../shared/story.js';
import { resolveCollision } from '../../shared/props.js';
import { stepWithin } from '../../shared/worldplan.js';
import {
  acceptQuest, activeCreature, addCreature, baseView, cancelTraining, claimQuest, collectGarden,
  collectTraining, creatureCard, equipGear, giveItem, healTeam, publicProfile,
  startCraft, startTraining, syncQuests, takeItem, uid, upgradeBuilding, dexView, atFarm, assignWorker, unassignWorker, collectWork, isWorker,
} from './combat.js';
import { hpRatio, petOf } from './player.js';
import { FIELD, calmWild, keepSpot } from './field.js';
import { handleGm } from './gm.js';
import { earn, spend } from './economy.js';
import { claimDaily } from './daily.js';
import { TIER_IDS, TOWER, canEnter, weekly } from '../../shared/endgame.js';
import { mountKind, moveMode } from '../../shared/riding.js';
import * as Social from '../social.js';
import { sceneSeen, storyFoe } from './saga.js';
import { buyCosmetic, wearCosmetic } from './cosmetics.js';
import { GUARD, cadence, moveAllowance, spendMove, strike } from './guard.js';
import { claimTier } from './pass.js';
import { passView } from '../../shared/pass.js';
import { wardrobeOf } from '../../shared/cosmetics.js';

// The furthest one move packet may carry a player. The client sends roughly
// 20 a second and a sprint is about 7 m/s, so 3m leaves generous headroom for
// a late packet while making a teleport impossible.
const MAX_STEP = 3;

const PLAYER_CHANNELS = new Set(['zone', 'world', 'party', 'guild', 'whisper']);

/**
 * Start a fight with a wild. One path whoever starts it: the player walking
 * up and pressing the button, or a fierce wild catching them (`ambush`).
 * Returns true when a battle is on its way.
 */
export function engageWild(ctx, wildId, { ambush = false } = {}) {
  const n = ctx.doc, s = ctx.self(), now = Date.now();
  const o = ctx.state.wilds.get(wildId);
  if (!o || o.engagedBy) return ctx.net.emit('error', { code: 'wild_gone' }), false;
  if (!s || Math.hypot(o.x - s.x, o.z - s.z) > 8) return ctx.net.emit('error', { code: 'too_far' }), false;
  const a = activeCreature(n);
  if (!a || a.hp <= 0) return ctx.net.emit('error', { code: 'no_healthy_creature' }), false;
  // One fight at a time. The client guards its own button, but the server is
  // the one that knows a wild is also about to catch this player.
  if (now < (ctx.battlePending || 0)) return false;
  ctx.battlePending = now + FIELD.pendingMs;
  o.engagedBy = n.id;
  const d = ctx.wildDocs.get(wildId);
  d && calmWild(o, d, now, 0);
  ctx.startBattle({
    zoneId: ctx.zoneId,
    wildId,
    ambush,
    wild: { species: o.species, level: o.level },
    onEnd: (captured) => {
      // Whatever became of the fight, this session is free to start another.
      ctx.battlePending = 0;
      if (captured) { ctx.state.wilds.delete(wildId); ctx.wildDocs.delete(wildId); return; }
      o.engagedBy = '';
      // It stands where the fight was, and so will you: give it a while
      // before it looks at anyone again.
      const dd = ctx.wildDocs.get(wildId);
      dd && calmWild(o, dd, Date.now(), FIELD.foughtRestMs);
    },
  });
  return true;
}

/** Talk to an NPC: their lines for who the player is right now, and any
 *  "talk to …" quest step that completes by it. One implementation for both
 *  drivers — the online room had a stub here that answered every NPC with no
 *  lines at all, which is why nobody in the world would speak. */
export function speakTo(ctx, doc, npcId, phase) {
  const npc = Object.prototype.hasOwnProperty.call(NPCS, npcId) ? NPCS[npcId] : null;
  if (!npc) return ctx.net.emit('error', { code: 'no_such_npc' });
  const me = ctx.self(), at = npcAt(npcId, phase);
  // Generous: the client draws a walking NPC easing toward where the schedule
  // says it is, pushed clear of props, so the two can be metres apart while
  // the player is plainly standing next to it.
  if (me && Math.hypot(me.x - at.x, me.z - at.z) > 9) return ctx.net.emit('error', { code: 'too_far' });
  const facts = {
    hasStarter: (doc.creatures && Object.keys(doc.creatures).length > 0) || (doc.team || []).length > 0,
    captures: doc.stats?.captures || 0,
    battlesWon: doc.stats?.battlesWon || 0,
    level: doc.level || 1,
    guildId: doc.guildId || null,
    night: phase < 0.15 || phase > 0.78,
    quests: {
      active: Object.keys(doc.quests?.active || {}),
      done: Object.entries(doc.quests?.active || {}).filter(([, q]) => q.done).map(([id]) => id),
    },
  };
  const done = syncQuests(doc, { kind: 'talk', target: npcId });
  // An errand outranks small talk: something to hand in, then something new,
  // then how the current one is going.
  const v = giverView(doc, npcId);
  const errand = v.ready ? { mode: 'ready', q: v.ready } : v.offer ? { mode: 'offer', q: v.offer } : v.active ? { mode: 'active', q: v.active } : null;
  const raw = errand ? errand.q.lines?.[errand.mode === 'ready' ? 'done' : errand.mode === 'offer' ? 'offer' : 'busy'] : npcLines(npcId, facts);
  const said = Array.isArray(raw) ? { lines: raw, en: [] } : (raw || { lines: ['…'], en: [] });
  ctx.net.save();
  ctx.net.emit('dialogue', {
    npcId, id: npcId, name: npc.name, he: npc.he, questsDone: done,
    errand: errand ? { mode: errand.mode, id: errand.q.id } : null,
    lines: (said.lines || ['…']).map((he, i) => ({ he, en: said.en?.[i] || '' })),
  });
  for (const id of done) ctx.net.emit('questDone', { id });
  ctx.net.emit('profile', publicProfile(doc));
}

/** Walking into a landmark's circle completes "go to …" quest steps. The
 *  online room had this as a no-op too, so no visit step could finish there. */
export function visitCheck(ctx, doc, pos, seen) {
  for (const l of ctx.zone.landmarks) {
    if (!l.r || seen.has(l.kind) || Math.hypot(l.x - pos.x, l.z - pos.z) > l.r) continue;
    seen.add(l.kind);
    const done = syncQuests(doc, { kind: 'visit', target: l.kind, zone: ctx.zoneId });
    if (!done.length) continue;
    ctx.net.save();
    for (const id of done) ctx.net.emit('questDone', { id });
    ctx.net.emit('profile', publicProfile(doc));
  }
}

function announce(ctx, done) {
  for (const id of done || []) ctx.net.emit('questDone', { id });
}
const teamCreaturesOf = (doc) => (doc.team || []).map((u) => doc.creatures?.[u]).filter(Boolean);

/** Put a rider up (or down): on the context the moves are judged by, the
 *  state everyone sees, and the document, so it lasts past a fight. */
export function setRide(ctx, self, doc, ride) {
  ctx.ride = ride;
  doc.riding = ride?.uid || null;
  if (self) { self.mount = ride?.species || ''; self.mountKind = ride?.kind || ''; self.mountStar = ride?.star || 1; }
}

/** Back in the world: on the one they were riding, if it can still carry them. */
export function restoreRide(ctx, self, doc) {
  const c = doc.riding && doc.team?.includes(doc.riding) ? doc.creatures?.[doc.riding] : null;
  const kind = c && c.hp > 0 && mountKind(c.species, c.star || 1);
  setRide(ctx, self, doc, kind ? { uid: c.uid, species: c.species, star: c.star || 1, kind } : null);
}

export function handleWorldMessage(ctx, e, t = {}) {
      let n = ctx.doc,
        s = ctx.self(),
        r = Date.now();
      switch (e) {
        case "ready":
        case "refresh":
          ctx.welcome();
          break;
        case "move":
          // Indoors the overworld avatar stays put; and once a portal or a GM
          // warp has sent the player on, the packets still in flight from
          // before must not write the old zone back over where they are going.
          if (ctx.inside || ctx.warping) break;
          if (Number.isFinite(t.x) && Number.isFinite(t.z)) {
            // Clamp the step, then resolve collisions. A client that sends a
            // position 400m away is not walking, and without this the server
            // simply believed it: the walls only stop you if you approach them.
            let dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz);
            let tx = t.x, tz = t.z;
            // ...and to how far the fastest travel could have gone since the
            // last move (guard.js): a hundred packets a second are not a sprint
            let allow = Math.min(MAX_STEP, moveAllowance(ctx, r) + 0.05);
            if (d > allow) {
              tx = s.x + (dx / d) * allow, tz = s.z + (dz / d) * allow;
              d > allow + 0.5 && strike(ctx, "speed", r) === GUARD.speedReportAt && ctx.report?.({ at: r, op: "guard", kind: "speed", who: { id: n.id, name: n.name }, zone: ctx.zoneId, detail: "moves cut short for speed, many times in a minute" });
            }
            let half = ctx.zone.size / 2;
            tx = Math.max(-half, Math.min(half, tx));
            tz = Math.max(-half, Math.min(half, tz));
            // ...and never into the river, up a cliff or over the chasm
            // (worldplan.js): the same step the client predicts with
            let o = stepWithin(ctx.zone, ctx.colliders, s.x, s.z, tx, tz, 0.42, moveMode(ctx.ride?.kind));
            // The client reports ~12 times a second whether or not the stick
            // is held, so "stepped" is a real change of place, not a packet.
            (t.moving || Math.hypot(o.x - s.x, o.z - s.z) > 0.05) && (ctx.lastStepAt = r);
            // How fast they are coming, smoothed over a few packets: a shy
            // wild bolts from a run and lets a creep come close (field.js).
            {
              let gap = r - (ctx.lastMoveAt || 0), went = Math.hypot(o.x - s.x, o.z - s.z);
              spendMove(ctx, went);
              // a rhythm no thumb keeps for minutes: told to the GM log, once (guard.js)
              cadence(ctx, r) && ctx.report?.({ at: r, op: "guard", kind: "bot_cadence", who: { id: n.id, name: n.name }, zone: ctx.zoneId, detail: "moves at a machine-steady interval" });
              ctx.lastMoveAt = r;
              if (gap > 0 && gap < 1000) ctx.pace = (ctx.pace || 0) * 0.55 + Math.min(12, went / gap * 1000) * 0.45;
              else ctx.pace = 0;
            }
            s.x = o.x, s.z = o.z, s.rot = Number.isFinite(t.rot) ? t.rot : s.rot, s.moving = !!t.moving, keepSpot(n, ctx.zoneId, s), ctx.checkVisits(n, s);
          }
          break;
        case "passView":
          ctx.net.emit("pass", passView(n));
          break;
        case "passClaim":
          {
            // a tier of the season's track (shared/pass.js)
            let o = claimTier(n, Number(t?.tier));
            if (!o.ok) return ctx.net.emit("error", { code: o.reason });
            ctx.net.save(), ctx.net.emit("pass", { ...passView(n), got: o }), ctx.net.emit("profile", publicProfile(n));
            o.reward.cosmetic && ctx.net.emit("wardrobe", { ...wardrobeOf(n), bought: null, earned: o.reward.cosmetic });
            break;
          }
        case "ping":
          // the round trip, for the load test and the connection meter
          ctx.net.emit("pong", { t: typeof t?.t == "number" ? t.t : 0, at: r });
          break;
        case "presence":
          // The tab went to the background (a phone locked, an app switch):
          // nothing in the field should start on someone who is not there.
          ctx.away = !!t.away;
          break;
        case "gm":
          handleGm(ctx, t);
          break;
        case "ride":
          {
            // up on a creature of the team, or down off it (shared/riding.js)
            let want = typeof t.uid === "string" ? t.uid : null;
            if (!want) {
              if (!ctx.ride) break;
              // not out over the water, not in mid-air over a cliff
              let ok = stepWithin(ctx.zone, ctx.colliders, s.x, s.z, s.x, s.z, 0.42, "walk");
              if (Math.hypot(ok.x - s.x, ok.z - s.z) > 0.05) return ctx.net.emit("error", { code: "cannot_land" });
              setRide(ctx, s, n, null), ctx.net.save(), ctx.net.emit("ride", null);
              break;
            }
            if (ctx.inside) return ctx.net.emit("error", { code: "not_here" });
            let c = n.team?.includes(want) ? n.creatures?.[want] : null, kind = c && mountKind(c.species, c.star || 1);
            if (!c || !kind) return ctx.net.emit("error", { code: "cannot_ride" });
            if (c.hp <= 0) return ctx.net.emit("error", { code: "fainted" });
            setRide(ctx, s, n, { uid: c.uid, species: c.species, star: c.star || 1, kind }), ctx.net.save(), ctx.net.emit("ride", ctx.ride);
          }
          break;
        case "dailyClaim":
          {
            // today's tile of the week (game/daily.js)
            let r = claimDaily(n);
            if (!r.ok) return ctx.net.emit("error", { code: r.reason });
            ctx.net.save(), ctx.net.emit("dailyReward", { ...r, profile: publicProfile(n) });
          }
          break;
        case "chat":
          {
            // A player picks among the channels players have. "gm" and
            // "system" are the server's own voice, and used to be claimable
            // by anyone who typed the name into the message.
            let ch = PLAYER_CHANNELS.has(t.ch) ? t.ch : "zone";
            // Online: world, party and whispers reach across zones, blocks
            // hold, and nobody floods (social.js). Guild chat stays the room's.
            if (ctx.online) {
              let err = ch === "guild" ? ctx.guilds ? ctx.guilds.chat(n, t.text) : "no_guild" : Social.chat(n, { ch, text: t.text, to: t.to, toId: t.toId }, ctx.roomChat);
              err && ctx.net.emit("error", { code: err });
              break;
            }
            let o = {
              ch,
              from: n.name,
              fromId: n.id,
              text: Social.clean(t.text),
              t: r
            };
            ctx.chat(o);
            break;
          }
        case "engage":
          engageWild(ctx, typeof t.wildId == "string" ? t.wildId : "");
          break;
        case "storyFight":
          {
            // an anchor's guardian, or the rift's on the pier (shared/saga.js)
            let a = activeCreature(n);
            if (!a || a.hp <= 0) return ctx.net.emit("error", { code: "no_healthy_creature" });
            if (r < (ctx.battlePending || 0)) return;
            let f = storyFoe(n, typeof t?.id == "string" ? t.id : "", ctx.zoneId, s);
            if (f.error) return ctx.net.emit("error", { code: f.error });
            ctx.battlePending = r + FIELD.pendingMs;
            ctx.startBattle({ zoneId: ctx.zoneId, wild: f.foe, story: f.foe.story, onEnd: () => { ctx.battlePending = 0; } });
            break;
          }
        case "sceneSeen":
          sceneSeen(n, t?.id) && ctx.net.save();
          break;
        case "cosmeticBuy":
        case "cosmeticWear":
          {
            // the tailor (shared/cosmetics.js): what is worn shows on you for everyone
            let o = e === "cosmeticBuy" ? buyCosmetic(n, String(t?.id || "")) : wearCosmetic(n, String(t?.slot || ""), t?.id == null ? null : String(t.id));
            if (!o.ok) return ctx.net.emit("error", { code: o.reason });
            e === "cosmeticBuy" && t?.wear && wearCosmetic(n, o.slot, o.id);
            let w = wardrobeOf(n);
            s && (s.hat = w.hat || "", s.dye = w.dye || "");
            ctx.net.save(), ctx.net.emit("wardrobe", { ...w, bought: e === "cosmeticBuy" ? o.id : null }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "duel":
        case "duelAccept":
        case "duelDecline":
          {
            // The single-player build has nobody to fight. Saying no is not
            // the same as saying nothing.
            if (!ctx.online) {
              ctx.net.emit("error", { code: "pvp_offline" });
              break;
            }
            if (e === "duel") {
              let a = activeCreature(n);
              if (!a) return ctx.net.emit("error", { code: "no_healthy_creature" });
              let o = Social.challenge(n, { id: t.targetId, pair: !!t.pair });
              o.ok ? ctx.net.emit("duelSent", { name: o.name, pair: !!o.pair }) : ctx.net.emit("error", { code: o.code });
              break;
            }
            if (e === "duelDecline") {
              Social.declineChallenge(n, t);
              break;
            }
            let o = Social.acceptChallenge(n, t);
            if (!o.ok) return ctx.net.emit("error", { code: o.code });
            ctx.startPvp({ sides: o.sides, pair: o.pair });
            break;
          }
        case "coopJoin":
          {
            if (!ctx.online) return;
            let a = activeCreature(n);
            if (!a || a.hp <= 0) return ctx.net.emit("error", { code: "no_healthy_creature" });
            if (r < (ctx.battlePending || 0)) return;
            let o = Social.joinCoop(n, String(t.roomId || ""), ctx.zoneId);
            if (!o.ok) return ctx.net.emit("error", { code: o.code });
            ctx.battlePending = r + FIELD.pendingMs;
            ctx.net.emit("goto", { roomId: o.roomId, kind: o.kind || "battle", coop: !0 });
            break;
          }
        case "bossAttack":
          {
            let o = ctx.state.boss;
            if (!o.active) return;
            if (Math.hypot(o.x - s.x, o.z - s.z) > 16) {
              ctx.net.emit("error", {
                code: "too_far"
              });
              return;
            }
            if (r < (ctx._bossCd || 0)) return;
            ctx._bossCd = r + 900;
            let a = activeCreature(n);
            if (!a) return;
            let l = statsFor(a.species, a.level, a.iv, a.star || 1, a.nature),
              c = MOVES[t.skill] || MOVES[a.skills[0]],
              h = c?.kind === "special" ? l.spa : l.atk,
              d = Math.max(1, Math.floor(((2 * a.level / 5 + 2) * (c?.power || 34) * (h / 120) / 50 + 2) * (0.85 + Math.random() * 0.3)));
            // The online room keeps the board by player id with the name beside it
            // (WorldRoom.endBoss pays by it); this kept it by name, so online
            // nobody was ever found on the board and nobody was paid.
            let bc = ctx.bossContribution;
            ctx.online ? bc.set(n.id, { name: n.name, damage: (bc.get(n.id)?.damage || 0) + d }) : bc.set(n.name, (bc.get(n.name) || 0) + d);
            weekly(n).boss += d;
            if (o.hp = Math.max(0, o.hp - d), ctx.refreshBossBoard(), ctx.net.emit("bossHit", {
              by: n.name,
              dmg: d,
              hp: o.hp,
              skill: t.skill
            }), Math.random() < 0.25) {
              let u = Math.max(1, Math.floor(a.maxHp * (0.05 + Math.random() * 0.07)));
              a.hp = Math.max(0, a.hp - u), s.hpRatio = hpRatio(n), ctx.net.save(), ctx.net.emit("bossCounter", {
                dmg: u,
                hp: a.hp,
                maxHp: a.maxHp
              });
            }
            break;
          }
        case "travel":
          {
            let o = ZONES[t.zone];
            if (!o) return;
            if (n.level < o.levels[0] - 2) {
              ctx.net.emit("error", {
                code: "level_too_low"
              });
              return;
            }
            n.zone = t.zone, ctx.warping = !0, ctx.net.save(), ctx.net.emit("goto", {
              kind: "world",
              zone: t.zone,
              fromZone: ctx.zoneId
            });
            break;
          }
        case "dungeonEnter":
          {
            // a dungeon at a tier, or the tower (shared/endgame.js); a party
            // member's team comes along if they say yes (social.js)
            let o = t.dungeonId === TOWER.id ? TOWER : DUNGEONS[t.dungeonId];
            if (!o) return;
            let tier = TIER_IDS.includes(t.tier) ? t.tier : "normal",
              can = canEnter(n, o, o.endless ? "normal" : tier);
            if (!can.ok) return ctx.net.emit("error", { code: can.code, need: can.need });
            let a = activeCreature(n);
            if (!a || teamCreaturesOf(n).every(c => c.hp <= 0)) return ctx.net.emit("error", { code: "no_healthy_creature" });
            if (r < (ctx.battlePending || 0)) return;
            ctx.battlePending = r + FIELD.pendingMs;
            ctx.startDungeon({
              def: o,
              tier
            });
            break;
          }
        case "interact":
          {
            let o = ctx.zone.landmarks.find(a => a.id === t.target || a.kind === t.target);
            if (!o) return;
            o.kind === "npc" ? ctx.speak(n, o.id || o.npc) : (o.kind === "plaza" || o.kind === "town" || o.kind === "camp") && (healTeam(n, 1), s.hpRatio = hpRatio(n), announce(ctx, syncQuests(n, { kind: "heal" })), ctx.net.save(), ctx.net.emit("healed", {}), ctx.net.emit("profile", publicProfile(n)));
            break;
          }
        case "dex":
          {
            ctx.net.emit("dex", dexView(n));
            break;
          }
        case "enterBuilding":
          {
            // The client has sent this since v0.7 and nothing handled it, so
            // every door in the game was decorative.
            let o = ctx.zone.landmarks.find(a => a.interior && (a.interior === t.id || a.id === t.id || a.kind === t.id));
            if (!o) {
              ctx.net.emit("error", {
                code: "no_such_building"
              });
              return;
            }
            let a = o.door || {
              x: o.x,
              z: o.z
            };
            if (Math.hypot(a.x - s.x, a.z - s.z) > 6) {
              ctx.net.emit("error", {
                code: "too_far"
              });
              return;
            }
            // Park the player in the doorway so stepping back out is sensible.
            s.x = a.x, s.z = a.z, s.moving = !1, s.status = "inside", keepSpot(n, ctx.zoneId, s);
            ctx.inside = o.interior;
            // nobody rides in through a door
            ctx.ride && (setRide(ctx, s, n, null), ctx.net.emit("ride", null));
            ctx.net.emit("building", {
              id: o.interior,
              kind: o.kind,
              name: o.name,
              he: o.he,
              door: a
            });
            break;
          }
        case "exitBuilding":
          {
            ctx.inside = null, s.status = "idle";
            ctx.net.emit("building", null);
            break;
          }
        case "talk":
          {
            ctx.speak(n, typeof t?.npcId == "string" ? t.npcId : "");
            break;
          }
        case "baseLook":
          {
            // the farm wants to draw its pods: the garden is not collected
            let o = baseView(n);
            o.collected?.length && (ctx.net.save(), ctx.net.emit("profile", publicProfile(n)));
            ctx.net.emit("base", o);
            break;
          }
        case "baseOpen":
          {
            let o = collectGarden(n);
            ctx.net.save(), ctx.net.emit("base", {
              ...baseView(n),
              ...(o ? {
                fiber: o
              } : {})
            }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "baseBuild":
        case "baseTrain":
        case "baseCollect":
        case "baseCancel":
        case "baseCraft":
        case "baseWork":
        case "baseUnwork":
        case "baseCollectWork":
          {
            let o = {
              baseWork: () => assignWorker(n, String(t?.uid || ""), String(t?.job || "")),
              baseUnwork: () => unassignWorker(n, String(t?.uid || "")),
              baseCollectWork: () => collectWork(n),
              baseBuild: () => upgradeBuilding(n, t.id),
              baseTrain: () => startTraining(n, t.uid),
              baseCollect: () => collectTraining(n, t.slotId),
              baseCancel: () => cancelTraining(n, t.slotId),
              baseCraft: () => startCraft(n, t.recipe)
            }[e]();
            if (!o.ok) {
              ctx.net.emit("error", {
                code: o.reason
              });
              return;
            }
            let a = e === "baseCraft" ? syncQuests(n, {
              kind: "craft"
            }) : e === "baseTrain" ? syncQuests(n, {
              kind: "train"
            }) : e === "baseCollect" && o.star ? syncQuests(n, {
              kind: "star",
              star: o.star
            }) : [];
            // the phone: when the pod opens, when the baskets fill (server/push.js)
            if (ctx.push) {
              e === "baseTrain" && ctx.push.schedule(o.slot.readyAt, "train", `train:${o.slot.id}`, "✨ האימון הסתיים", `${SPECIES[n.creatures[o.slot.uid]?.species]?.he || "היצור"} מוכן לצאת מהתא עם ${o.slot.star} כוכבים`);
              (e === "baseCancel" || e === "baseCollect") && ctx.push.cancel(`train:${t.slotId}`);
              if (e === "baseWork" || e === "baseUnwork" || e === "baseCollectWork") {
                let full = Math.min(...(n.base?.workers || []).map(w => (w.since || Date.now()) + 12 * 3600e3));
                Number.isFinite(full) ? ctx.push.schedule(full, "farm", "farm", "🧺 הסלים בחווה מלאים", "העובדים בחווה סיימו — בוא לאסוף לפני שהם עוצרים") : ctx.push.cancel("farm");
              }
            }
            // who walks beside you may have changed (gone to the farm, back)
            petOf(s, n), s.hpRatio = hpRatio(n);
            ctx.net.save();
            for (let c of a) ctx.net.emit("questDone", {
              id: c
            });
            let l = e === "baseCollect" ? {
              starUp: o
            } : e === "baseBuild" ? {
              built: o
            } : e === "baseTrain" ? {
              started: o.slot
            } : e === "baseCraft" ? {
              craft: o.job
            } : e === "baseWork" ? {
              hired: o.worker, ...(Object.keys(o.got).length ? { worked: o.got } : {})
            } : e === "baseUnwork" || e === "baseCollectWork" ? {
              worked: o.got
            } : {};
            ctx.net.emit("base", {
              ...baseView(n),
              ...l
            }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "card":
          {
            let o = creatureCard(n, t.uid);
            o && ctx.net.emit("card", o);
            break;
          }
        case "shopBuy":
          {
            let o = ITEMS[t.itemId],
              a = Math.max(1, Math.min(99, Number(t.qty) || 1));
            if (!o?.price) return;
            if (n.gold < o.price * a) {
              ctx.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            spend(n, o.price * a, "shop"), giveItem(n, o.id, a), ctx.net.save(), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "useItem":
          {
            let o = ITEMS[t.itemId];
            if (!o) return;
            let a = n.creatures[t.uid] || activeCreature(n);
            if (o.kind === "heal" && a && a.hp > 0 && takeItem(n, o.id)) a.hp = Math.min(a.maxHp, a.hp + o.amount);else if (o.kind === "revive" && a && a.hp <= 0 && takeItem(n, o.id)) a.hp = Math.floor(a.maxHp * o.ratio);else if (o.kind === "gear") {
              if (!equipGear(n, o.id)) {
                ctx.net.emit("error", {
                  code: "cannot_equip"
                });
                return;
              }
            } else {
              ctx.net.emit("error", {
                code: "cannot_use"
              });
              return;
            }
            s.hpRatio = hpRatio(n), ctx.net.save(), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "setTeam":
          {
            let o = (t.team || []).filter(l => typeof l == "string" && n.creatures[l] && !atFarm(n, l)).slice(0, 6);
            if (!o.length) return;
            // a worker called into the team leaves its job (and is paid for it)
            for (let l of o) isWorker(n, l) && unassignWorker(n, l);
            let a = new Set([...n.team, ...n.box]);
            n.team = o, n.box = [...a].filter(l => !o.includes(l)), petOf(s, n), s.hpRatio = hpRatio(n), ctx.net.save(), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "questAccept":
          {
            if (!acceptQuest(n, t.questId)) return ctx.net.emit("error", { code: "cannot_accept" });
            ctx.net.save(), ctx.net.emit("questAccepted", { questId: t.questId }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "clinicHeal":
          {
            // Priced here, not by the client: the same sum the counter shows.
            let team = teamCreaturesOf(n),
              cost = clinicCost(team);
            if ((n.gold || 0) < cost) return ctx.net.emit("error", { code: "not_enough_gold" });
            spend(n, cost, "clinic"), healTeam(n, 1);
            let me = ctx.self();
            me && (me.hpRatio = hpRatio(n)), announce(ctx, syncQuests(n, { kind: "heal" })), ctx.net.save(), ctx.net.emit("healed", { cost }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "questClaim":
          {
            let o = claimQuest(n, t.questId);
            if (!o) {
              ctx.net.emit("error", {
                code: "cannot_claim"
              });
              return;
            }
            ctx.net.save(), ctx.net.emit("questClaimed", {
              questId: t.questId,
              reward: o.reward,
              creature: o.creature || null
            }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "partyInvite":
        case "partyAccept":
        case "partyDecline":
        case "partyKick":
        case "partyPromote":
        case "friendAdd":
        case "friendRespond":
        case "friendRemove":
        case "block":
        case "report":
          {
            if (!ctx.online) {
              e === "friendRespond" || e === "friendRemove" ? ctx.net.emit("friends", ctx.friendList()) : ctx.net.emit("error", { code: "solo_mode" });
              break;
            }
            return socialMessage(ctx, e, t).catch((err) => {
              console.error("[social]", e, err);
              ctx.net.emit("error", { code: "server_error" });
            });
          }
        case "partyLeave":
          ctx.online ? Social.leaveParty(n) : ctx.net.emit("party", null);
          break;
        case "arenaView":
        case "arenaQueue":
        case "arenaCancel":
        case "arenaClaim":
          {
            // the ranked arena is online (server/arena.js)
            if (!ctx.online || !ctx.arena) return ctx.net.emit("error", { code: "solo_mode" });
            let A = ctx.arena;
            if (e === "arenaQueue") {
              let a = activeCreature(n);
              if (!a) return ctx.net.emit("error", { code: "no_healthy_creature" });
              let q = A.enqueue(n);
              if (!q.ok) return ctx.net.emit("error", { code: q.code });
            } else if (e === "arenaCancel") A.dequeue(n.id);
            else if (e === "arenaClaim") {
              let c = A.claimSeason(n);
              if (!c.ok) return ctx.net.emit("error", { code: c.code });
              ctx.net.save(), ctx.net.emit("arenaReward", c), ctx.net.emit("profile", publicProfile(n));
            }
            ctx.net.emit("arena", { ...A.arenaView(n), queued: A.queued(n.id) });
          }
          break;
        case "guildList":
        case "guildCreate":
        case "guildJoin":
        case "guildLeave":
        case "guildContribute":
        case "guildUpgrade":
        case "guildKick":
        case "guildRank":
        case "guildSettings":
          // guilds are online (server/guilds.js); the offline build has none
          if (!ctx.online || !ctx.guilds) return ctx.net.emit("error", { code: "solo_mode" });
          guildMessage(ctx, e, t);
          break;
        default:
          break;
      }
    
}


/** Guild messages (server/guilds.js, handed in as ctx.guilds so this file
 *  stays free of server-only modules). Each answers with the guild as its
 *  sender now sees it, or why nothing changed. */
function guildMessage(ctx, type, t = {}) {
  const G = ctx.guilds, doc = ctx.doc, me = ctx.self();
  if (type === "guildList") return ctx.net.emit("guildList", G.list());
  const r = type === "guildCreate" ? G.create(doc, { name: t.name, tag: t.tag })
    : type === "guildJoin" ? G.join(doc, t.guildId)
    : type === "guildLeave" ? G.leave(doc)
    : type === "guildContribute" ? G.contribute(doc, t.gold)
    : type === "guildUpgrade" ? G.upgrade(doc, t.upgradeId)
    : type === "guildKick" ? G.kick(doc, t.id)
    : type === "guildRank" ? G.setRank(doc, t.id, t.rank)
    : G.settings(doc, { motd: t.motd, open: t.open });
  if (!r.ok) return ctx.net.emit("error", { code: r.code });
  const g = G.guildOf(doc);
  me && (me.guildTag = g?.tag || "");
  ctx.net.save(), ctx.net.emit("guild", g ? G.view(g, doc.id) : null), ctx.net.emit("profile", publicProfile(doc));
  r.levelUp && ctx.net.emit("guildBuff", { level: g?.buffLevel });
}

/** Friends, party, blocking and reports — online only (social.js). Each
 *  answers its sender with what changed, or why nothing did. */
async function socialMessage(ctx, type, t = {}) {
  const doc = ctx.doc, say = (o, ok) => o.ok ? ok?.(o) : ctx.net.emit('error', { code: o.code || 'failed' });
  const who = { id: typeof t.id === 'string' ? t.id : typeof t.targetId === 'string' ? t.targetId : undefined, name: typeof t.name === 'string' ? t.name : undefined };
  switch (type) {
    case 'friendAdd':
      return say(await Social.friendAdd(doc, who), (o) => {
        ctx.net.emit('friendResult', { ok: true, name: o.name, pending: !!o.pending, added: !!o.added });
        ctx.net.emit('friends', Social.friendsView(doc));
      });
    case 'friendRespond':
      await Social.friendRespond(doc, String(t.fromId || t.id || ''), !!t.accept);
      return ctx.net.emit('friends', Social.friendsView(doc));
    case 'friendRemove':
      await Social.friendRemove(doc, String(t.id || ''));
      return ctx.net.emit('friends', Social.friendsView(doc));
    case 'block':
      return say(await Social.block(doc, String(t.id || ''), t.on !== false), () => ctx.net.emit('friends', Social.friendsView(doc)));
    case 'report': {
      // what was reported, by whom, about whom — for the GM log
      const row = { at: Date.now(), op: 'report', by: { id: doc.id, name: doc.name }, about: String(t.id || '').slice(0, 64), reason: Social.clean(t.reason || '').slice(0, 200), zone: ctx.zoneId };
      console.log('[report]', JSON.stringify(row));
      ctx.report?.(row);
      return ctx.net.emit('reported', { ok: true });
    }
    case 'partyInvite':
      return say(Social.partyInvite(doc, who), (o) => ctx.net.emit('partySent', { name: o.name }));
    case 'partyAccept':
      return say(Social.partyAccept(doc, { inviteId: t.inviteId, partyId: t.partyId, fromId: t.fromId }));
    case 'partyDecline':
      return say(Social.partyDecline(doc, { inviteId: t.inviteId, partyId: t.partyId, fromId: t.fromId }));
    case 'partyKick':
      return say(Social.partyKick(doc, String(t.id || '')));
    case 'partyPromote':
      return say(Social.partyPromote(doc, String(t.id || '')));
  }
}
