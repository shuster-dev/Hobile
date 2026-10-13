// What a camp's cottages are for. Every field zone has a camp with up to four
// cottages round it (shared/props.js); they used to be walls with nothing
// behind them. Now each is a place a trainer goes in to: the clinic, which
// is also where potions and spheres are sold; the archive, where the quests
// are; the tailor; and the smith, who sells what a trainer wears into a
// fight. The town (aetherport) has its own (gamedata ZONES landmarks).
//
// Pure: the server lets you in by it (world-messages.js enterBuilding), the
// client finds the door and draws the room by it (game.js, gfx/world.js).
import { propsFor } from './props.js';

/** In the order the cottages are given them: a camp with fewer has fewer. */
export const SERVICES = [
  { kind: 'clinic', he: 'מרפאה וחנות', icon: '🩺', interior: 'clinic' },
  { kind: 'archive', he: 'ארכיון המשימות', icon: '📜', interior: 'archive' },
  { kind: 'tailor', he: 'החייט', icon: '👒', interior: 'tailor' },
  { kind: 'smith', he: 'הנפח', icon: '⚒', interior: 'workshop' },
];
export const SERVICE_KINDS = SERVICES.map((s) => s.kind);

const CACHE = new Map();

/**
 * The camp's places, as landmarks: { id, kind, he, icon, interior, x, z, r,
 * door }. The door is in front of the cottage (which faces the camp's
 * middle), a step out from its wall.
 */
export function servicesOf(zone) {
  if (!zone?.id || zone.urban) return [];
  if (CACHE.has(zone.id)) return CACHE.get(zone.id);
  let houses = [];
  try { houses = (propsFor(zone).buildings || []).filter((b) => b.kind === 'house'); } catch { houses = []; }
  const out = houses.slice(0, SERVICES.length).map((b, i) => {
    const s = SERVICES[i], rot = b.rot || 0, out = Math.max(b.w, b.d) * 0.62 + 0.5;
    return {
      ...s, id: `svc_${zone.id}_${s.kind}`, service: true,
      x: b.x, z: b.z, r: Math.max(b.w, b.d) * 0.62,
      door: { x: b.x + Math.sin(rot) * out, z: b.z + Math.cos(rot) * out },
    };
  });
  CACHE.set(zone.id, out);
  return out;
}

/** Everything a trainer can walk up to and go into, in a zone. */
export function placesOf(zone) {
  return [...(zone?.landmarks || []), ...servicesOf(zone)];
}
