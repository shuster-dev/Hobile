// What a move can leave on a creature (checklist c2): the burns and poisons
// that eat at it, the slow that drains its stamina, and the three that stop it
// acting at all — dizzy (a moment), asleep (a few seconds, and a hit may wake
// it) and frozen (a few seconds, and anything of fire thaws it).
//
// The rules a player can learn once and use everywhere:
//  - one of each: a second burn renews the first instead of burning twice;
//  - every element shrugs off one thing — fire is not burned, frost does not
//    freeze, metal is not poisoned, volt is not dizzied, a plant does not
//    sleep;
//  - after being stopped, a creature cannot be stopped again for a little
//    while (`resist`), so no fight is spent watching your creature sleep;
//  - a boss is stopped for less than half as long;
//  - the trainer's potion takes the bad ones away, and a few moves do too.
//
// Shared: the server's fight (server/game/combat.js) applies them, the client
// draws them (the chips on the bars, the 💤 over the creature) and says on a
// move's card what it leaves behind.

export const STATUS = {
  burn: { he: 'כוויה', icon: '🔥', bad: true, immune: 'ember' },
  poison: { he: 'רעל', icon: '☠', bad: true, immune: 'metal' },
  slow: { he: 'האטה', icon: '🐌', bad: true },
  stun: { he: 'מסוחרר', icon: '💫', bad: true, disable: true, immune: 'volt', resist: 2000 },
  sleep: { he: 'ישן', icon: '💤', bad: true, disable: true, immune: 'verdant', resist: 6000, wake: 0.5 },
  freeze: { he: 'קפוא', icon: '🧊', bad: true, disable: true, immune: 'frost', resist: 6000, thaw: 'ember' },
  defDown: { he: 'הגנה−', icon: '🛡', bad: true },
  atkDown: { he: 'התקפה−', icon: '⚔', bad: true },
  shield: { he: 'מגן', icon: '🛡' },
  atkUp: { he: 'התקפה+', icon: '⚔' },
  defUp: { he: 'הגנה+', icon: '🛡' },
  hasteUp: { he: 'זריזות+', icon: '💨' },
};

/** The ones that stop a creature acting, strongest first. */
export const DISABLES = ['freeze', 'sleep', 'stun'];
/** The ones a creature has one of at a time (a second renews the first);
 *  the stat drops (defDown, atkDown) still add up. */
export const AILMENTS = ['burn', 'poison', 'slow', 'stun', 'sleep', 'freeze'];
/** Everything a potion or a cleansing move takes away. */
export const BAD = Object.keys(STATUS).filter((k) => STATUS[k].bad);
/** A boss is stopped for this share of the time. */
export const BOSS_DISABLE = 0.4;
/** Burns and poisons land this often unless the move says `sure`. */
export const DOT_CHANCE = 0.85;

export const isBad = (kind) => !!STATUS[kind]?.bad;
export const immuneTo = (types, kind) => !!STATUS[kind]?.immune && (types || []).includes(STATUS[kind].immune);
export const statusLabel = (kind) => (STATUS[kind] ? `${STATUS[kind].icon} ${STATUS[kind].he}` : kind);

/** What is stopping this creature right now (from its effects), or null. */
export function disabledBy(effects, now = null) {
  let best = null;
  for (const e of effects || []) {
    if (!STATUS[e.kind]?.disable || (now != null && !(e.until > now))) continue;
    (!best || DISABLES.indexOf(e.kind) < DISABLES.indexOf(best)) && (best = e.kind);
  }
  return best;
}

/** Does a move's `vs` (a list of kinds, 'any' bad one, or 'disabled') find
 *  something on these effects? */
export function matchesVs(vs, effects, now = null) {
  if (!vs) return false;
  const live = (effects || []).filter((e) => now == null || e.until > now);
  if (vs === 'any') return live.some((e) => isBad(e.kind));
  if (vs === 'disabled') return live.some((e) => STATUS[e.kind]?.disable);
  return live.some((e) => vs.includes(e.kind));
}

/** The status a move leaves on its target, if it leaves one. */
export function moveStatus(m) {
  const f = m?.effect;
  if (!f) return null;
  return ['sleep', 'freeze', 'stun', 'burn', 'poison', 'slow'].find((k) => f[k]) || null;
}

const pctOf = (x) => `${Math.round(x * 100)}%`;
const vsLabel = (vs) => (vs === 'any' ? 'כל מצב' : vs === 'disabled' ? 'מי שלא יכול לפעול' : vs.map((k) => STATUS[k]?.he || k).join(' / '));

/** A few words for a move's card: what it leaves behind, and when it hits harder. */
export function moveTags(m) {
  const f = m?.effect, out = [];
  if (!f) return out;
  const secs = f.dur ? ` ${Math.round(f.dur / 100) / 10}ש׳` : '';
  for (const k of ['sleep', 'freeze', 'stun']) f[k] && out.push(`${STATUS[k].icon} ${STATUS[k].he} ${pctOf(Math.min(1, f[k]))}${secs}`);
  for (const k of ['burn', 'poison']) f[k] && out.push(`${STATUS[k].icon} ${STATUS[k].he}${f.sure ? '' : ` ${pctOf(DOT_CHANCE)}`}`);
  f.slow && out.push(`${STATUS.slow.icon} ${STATUS.slow.he}`);
  f.defDown && out.push(`${STATUS.defDown.icon} ${STATUS.defDown.he}`);
  f.vs && out.push(`פי ${f.vsMul || 2} נגד ${vsLabel(f.vs)}`);
  f.wake && out.push('מעיר ישנים');
  f.thaw && out.push('מנפץ קרח');
  f.cleanse && out.push(`✨ מסיר מצבים${f.party ? ' מכל הצוות' : ''}`);
  f.lifesteal && out.push(`🩸 שואב ${pctOf(f.lifesteal)}`);
  f.heal && out.push(`💚 מרפא ${pctOf(f.heal)}${f.party ? ' לכולם' : ''}`);
  f.shield && out.push(`${STATUS.shield.icon} ${STATUS.shield.he}`);
  f.atkUp && out.push(`${STATUS.atkUp.icon} ${STATUS.atkUp.he}`);
  f.defUp && out.push(`${STATUS.defUp.icon} ${STATUS.defUp.he}`);
  f.hasteUp && out.push(`${STATUS.hasteUp.icon} ${STATUS.hasteUp.he}`);
  return out;
}
