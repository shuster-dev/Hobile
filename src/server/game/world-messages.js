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
import { DUNGEONS, GUILD, ITEMS, MOVES, PROGRESSION, SPECIES, ZONES, statsFor } from '../../shared/gamedata.js';
import { NPCS, npcAt, npcLines } from '../../shared/npcs.js';
import { resolveCollision } from '../../shared/props.js';
import {
  activeCreature, addCreature, baseView, cancelTraining, claimQuest, collectGarden,
  collectTraining, creatureCard, equipGear, giveItem, healTeam, publicProfile,
  startCraft, startTraining, syncQuests, takeItem, uid, upgradeBuilding,
} from './combat.js';
import { hpRatio } from './player.js';

// The furthest one move packet may carry a player. The client sends roughly
// 20 a second and a sprint is about 7 m/s, so 3m leaves generous headroom for
// a late packet while making a teleport impossible.
const MAX_STEP = 3;

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
          if (Number.isFinite(t.x) && Number.isFinite(t.z)) {
            // Clamp the step, then resolve collisions. A client that sends a
            // position 400m away is not walking, and without this the server
            // simply believed it: the walls only stop you if you approach them.
            let dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz);
            let tx = t.x, tz = t.z;
            if (d > MAX_STEP) { tx = s.x + (dx / d) * MAX_STEP; tz = s.z + (dz / d) * MAX_STEP; }
            let half = ctx.zone.size / 2;
            tx = Math.max(-half, Math.min(half, tx));
            tz = Math.max(-half, Math.min(half, tz));
            let o = resolveCollision(ctx.colliders, tx, tz, 0.42);
            s.x = o.x, s.z = o.z, s.rot = Number.isFinite(t.rot) ? t.rot : s.rot, s.moving = !!t.moving, ctx.checkVisits(n, s);
          }
          break;
        case "chat":
          {
            let o = {
              ch: t.ch || "zone",
              from: n.name,
              fromId: n.id,
              text: String(t.text || "").slice(0, 240),
              t: r
            };
            ctx.chat(o);
            break;
          }
        case "engage":
          {
            let o = ctx.state.wilds.get(t.wildId);
            if (!o || o.engagedBy) {
              ctx.net.emit("error", {
                code: "wild_gone"
              });
              return;
            }
            if (Math.hypot(o.x - s.x, o.z - s.z) > 8) {
              ctx.net.emit("error", {
                code: "too_far"
              });
              return;
            }
            let a = activeCreature(n);
            if (!a || a.hp <= 0) {
              ctx.net.emit("error", {
                code: "no_healthy_creature"
              });
              return;
            }
            o.engagedBy = n.id;
            ctx.startBattle({
              zoneId: ctx.zoneId,
              wildId: t.wildId,
              wild: {
                species: o.species,
                level: o.level
              },
              onEnd: captured => {
                captured ? (ctx.state.wilds.delete(t.wildId), ctx.wildDocs.delete(t.wildId)) : o.engagedBy = "";
              }
            });
            break;
          }
        case "duel":
          {
            ctx.net.emit("error", {
              code: "pvp_offline"
            });
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
            let l = statsFor(a.species, a.level, a.iv),
              c = MOVES[t.skill] || MOVES[a.skills[0]],
              h = c?.kind === "special" ? l.spa : l.atk,
              d = Math.max(1, Math.floor(((2 * a.level / 5 + 2) * (c?.power || 34) * (h / 120) / 50 + 2) * (0.85 + Math.random() * 0.3)));
            if (o.hp = Math.max(0, o.hp - d), ctx.bossContribution.set(n.name, (ctx.bossContribution.get(n.name) || 0) + d), ctx.refreshBossBoard(), ctx.net.emit("bossHit", {
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
            n.zone = t.zone, ctx.net.save(), ctx.net.emit("goto", {
              kind: "world",
              zone: t.zone,
              fromZone: ctx.zoneId
            });
            break;
          }
        case "dungeonEnter":
          {
            let o = DUNGEONS[t.dungeonId];
            if (!o) return;
            if (n.level < o.minLevel) {
              ctx.net.emit("error", {
                code: "level_too_low",
                need: o.minLevel
              });
              return;
            }
            ctx.startDungeon({
              def: o,
              allies: []
            });
            break;
          }
        case "interact":
          {
            let o = ctx.zone.landmarks.find(a => a.id === t.target || a.kind === t.target);
            if (!o) return;
            o.kind === "npc" ? ctx.speak(n, o.id || o.npc) : (o.kind === "plaza" || o.kind === "town" || o.kind === "camp") && (healTeam(n, 1), s.hpRatio = hpRatio(n), ctx.net.save(), ctx.net.emit("healed", {}), ctx.net.emit("profile", publicProfile(n)));
            break;
          }
        case "talk":
          {
            ctx.speak(n, typeof t?.npcId == "string" ? t.npcId : "");
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
          {
            let o = {
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
            }) : e === "baseCollect" && o.star ? syncQuests(n, {
              kind: "star",
              star: o.star
            }) : [];
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
            n.gold -= o.price * a, giveItem(n, o.id, a), ctx.net.save(), ctx.net.emit("profile", publicProfile(n));
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
            let o = (t.team || []).filter(l => n.creatures[l]).slice(0, 6);
            if (!o.length) return;
            let a = new Set([...n.team, ...n.box]);
            n.team = o, n.box = [...a].filter(l => !o.includes(l)), s.petSpecies = activeCreature(n)?.species || "", s.hpRatio = hpRatio(n), ctx.net.save(), ctx.net.emit("profile", publicProfile(n));
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
              reward: o.reward
            }), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "partyInvite":
        case "partyAccept":
        case "friendAdd":
          ctx.net.emit("error", {
            code: "solo_mode"
          });
          break;
        case "partyLeave":
          ctx.net.emit("party", null);
          break;
        case "friendRespond":
        case "friendRemove":
          ctx.net.emit("friends", ctx.friendList());
          break;
        case "guildList":
          ctx.net.emit("guildList", ctx.net.guilds.map(o => ({
            id: o.id,
            name: o.name,
            tag: o.tag,
            members: 1,
            buffLevel: o.buffLevel,
            territories: o.territories
          })));
          break;
        case "guildCreate":
          {
            if (n.gold < GUILD.createCost) {
              ctx.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            n.gold -= GUILD.createCost;
            let o = {
              id: "g" + uid().slice(0, 6),
              name: t.name || "Guild",
              tag: (t.tag || t.name || "GLD").slice(0, 4).toUpperCase(),
              masterId: n.id,
              buffLevel: 1,
              contribution: 0,
              myContribution: 0,
              house: [],
              territories: [],
              warScore: 0,
              log: [{
                t: Date.now(),
                text: `${n.name} founded the guild`
              }]
            };
            ctx.net.guilds.unshift(o), n.guildId = o.id, s.guildTag = o.tag, ctx.net.save(), ctx.net.emit("guild", ctx.guildView()), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildJoin":
          {
            let o = ctx.net.guilds.find(a => a.id === t.guildId);
            if (!o) return;
            n.guildId = o.id, s.guildTag = o.tag, ctx.net.save(), ctx.net.emit("guild", ctx.guildView()), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildLeave":
          n.guildId = null, s.guildTag = "", ctx.net.save(), ctx.net.emit("guild", null), ctx.net.emit("profile", publicProfile(n));
          break;
        case "guildContribute":
          {
            let o = ctx.net.guilds.find(l => l.id === n.guildId),
              a = Math.max(1, Number(t.gold) || 0);
            if (!o || n.gold < a) {
              ctx.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            n.gold -= a, o.contribution += a, o.myContribution = (o.myContribution || 0) + a;
            for (let l of GUILD.buffs) l.level > o.buffLevel && o.contribution >= l.cost && (o.buffLevel = l.level);
            ctx.net.save(), ctx.net.emit("guild", ctx.guildView()), ctx.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildUpgrade":
          {
            let o = ctx.net.guilds.find(l => l.id === n.guildId),
              a = GUILD.houseUpgrades.find(l => l.id === t.upgradeId);
            if (!o || !a || o.house.includes(a.id)) return;
            if (o.contribution < a.cost) {
              ctx.net.emit("error", {
                code: "not_enough_contribution"
              });
              return;
            }
            o.contribution -= a.cost, o.house.push(a.id), ctx.net.emit("guild", ctx.guildView());
            break;
          }
        default:
          break;
      }
    
}
