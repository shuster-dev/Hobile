// The creatures working on your farm (shared/farmwork.js).
//
// Every job has its corner of the yard: the gardeners walk the cabbage rows,
// the miners pick at a heap of ore by the fence, the smiths stand at the
// anvil beside the workbench, the scouts wait by the gate between trips out.
// Each walks to a spot in its corner, works there a while — a dip, a peck,
// a hop — and moves on. Like the pods, a player sees their own farm: drawn
// from their base (the "base" message), not from the room.
import { ConeGeometry, Group, Mesh } from 'three';
import { SPECIES } from '../../shared/gamedata.js';
import { JOBS } from '../../shared/farmwork.js';
import { softShadowTexture } from './core.js';
import { animateCreature, buildCreature, setCreatureLod } from './creatures.js';
import { setStarLook } from './starlook.js';
import { Kit, glowVC, toonVC } from './zonekit.js';

/** Each job's corner of the yard, around the farm landmark. */
export function jobSpots(zone) {
  const f = zone?.landmarks?.find((l) => l.kind === 'base');
  if (!f) return null;
  return {
    garden: { x: f.x + 4, z: f.z - 6, rx: 3.2, rz: 1.8 },
    forge: { x: f.x + 3.2, z: f.z - 0.2, rx: 1.0, rz: 0.9, prop: { x: f.x + 4.4, z: f.z + 0.6 } },
    mine: { x: f.x + 7.2, z: f.z - 1.4, rx: 1.2, rz: 1.0, prop: { x: f.x + 8.6, z: f.z - 2.2 } },
    scout: { x: f.x + 1.2, z: f.z - 11, rx: 1.4, rz: 0.8, prop: { x: f.x + 3.2, z: f.z - 11.6 } },
  };
}

const TARGET_H = 1.05, MAX_UP = 1.5, SPEED = 1.3;

export class FarmWorkers {
  constructor(world) {
    this.world = world;
    this.spots = jobSpots(world.zone);
    this.group = new Group();
    this.group.name = 'farm-workers';
    this.list = new Map();   // uid -> worker
    this.time = 0;
    this.spots && this.buildProps();
  }

  /** The anvil, the ore heap, the signpost: there whether anyone works or not. */
  buildProps() {
    const y = (x, z) => this.world.heightAt(x, z);
    const S = this.spots, solid = new Kit(), lit = new Kit();
    // the forge: an anvil on a stump, a brazier with coals
    {
      const p = S.forge.prop, k = new Kit({ x: p.x, y: y(p.x, p.z), z: p.z, rot: 0.5 }), g = new Kit({ x: p.x, y: y(p.x, p.z), z: p.z, rot: 0.5 });
      k.cyl(0.32, 0.38, 0.5, { y: 0.25 }, 0x6B4A2E, 10);
      k.box(0.62, 0.14, 0.26, { y: 0.57 }, 0x3A3F48);
      k.box(0.3, 0.12, 0.2, { y: 0.69 }, 0x4A505A);
      k.cone(0.12, 0.3, { x: 0.38, y: 0.66, rz: Math.PI / 2 }, 0x4A505A, 6);
      k.cyl(0.34, 0.24, 0.42, { x: -0.85, y: 0.21, z: 0.3 }, 0x2E3138, 10);
      g.ball(0.26, { x: -0.85, y: 0.45, z: 0.3, sy: 0.4 }, 0xFF8A3A, 8);
      solid.parts.push(k.geometry()); lit.parts.push(g.geometry());
    }
    // the mine: a heap of rock with ore showing, a pick against it
    {
      const p = S.mine.prop, k = new Kit({ x: p.x, y: y(p.x, p.z), z: p.z, rot: 0.2 }), g = new Kit({ x: p.x, y: y(p.x, p.z), z: p.z, rot: 0.2 });
      k.rock(0.75, { y: 0.35, sy: 0.7 }, 0x7E7468);
      k.rock(0.5, { x: 0.6, y: 0.25, z: 0.3, sy: 0.8 }, 0x8C8276);
      k.rock(0.42, { x: -0.55, y: 0.22, z: 0.35 }, 0x6E655B);
      k.rock(0.3, { x: 0.15, y: 0.7, z: -0.1 }, 0x928878);
      k.box(0.06, 0.9, 0.06, { x: -0.2, y: 0.45, z: 0.75, rz: 0.5 }, 0x7A5A3A);
      k.box(0.5, 0.07, 0.07, { x: -0.42, y: 0.84, z: 0.75, rz: 0.5 }, 0x5A606A);
      g.add(new ConeGeometry(0.09, 0.28, 5), { x: 0.25, y: 0.78, z: 0.2, rz: 0.3 }, 0x8FE8FF);
      g.add(new ConeGeometry(0.08, 0.24, 5), { x: -0.3, y: 0.55, z: 0.55, rz: -0.4 }, 0xFFC861);
      solid.parts.push(k.geometry()); lit.parts.push(g.geometry());
    }
    // the road out: a signpost and a little cart for what the scouts bring back
    {
      const p = S.scout.prop, k = new Kit({ x: p.x, y: y(p.x, p.z), z: p.z, rot: -0.3 });
      k.box(0.1, 1.7, 0.1, { y: 0.85 }, 0x7A5A3A);
      k.box(0.8, 0.22, 0.05, { x: 0.28, y: 1.45, rz: 0.08 }, 0xC8A878);
      k.box(0.7, 0.2, 0.05, { x: -0.22, y: 1.15, rz: -0.06 }, 0xB8946A);
      k.box(0.9, 0.35, 0.6, { x: 0.6, y: 0.45, z: 0.9 }, 0x8A6A44);
      k.cyl(0.22, 0.22, 0.06, { x: 0.15, y: 0.24, z: 0.9, rx: Math.PI / 2 }, 0x5A4030, 10);
      k.cyl(0.22, 0.22, 0.06, { x: 1.05, y: 0.24, z: 0.9, rx: Math.PI / 2 }, 0x5A4030, 10);
      solid.parts.push(k.geometry());
    }
    const sm = new Mesh(solid.geometry(), toonVC()), lm = new Mesh(lit.geometry(), glowVC());
    sm.castShadow = true; sm.receiveShadow = true;
    this.group.add(sm, lm);
    this.props = [sm, lm];
  }

  /** The base's work view (combat.js workView), as it came from the server. */
  sync(work) {
    if (!this.spots) return;
    const want = new Map((work?.workers || []).filter((w) => SPECIES[w.species] && JOBS[w.job]).map((w) => [w.uid, w]));
    for (const [uid, w] of this.list) {
      const n = want.get(uid);
      if (!n || n.species !== w.species || (n.star || 1) !== w.star) this.drop(uid);
      else if (n.job !== w.job) { w.job = n.job; w.full = !!n.full; this.pick(w, true); }
      else w.full = !!n.full;
    }
    let i = 0;
    for (const [uid, n] of want) {
      i++;
      if (this.list.has(uid)) continue;
      this.list.set(uid, this.make(uid, n, i));
    }
  }

  make(uid, n, i) {
    const holder = new Group(), c = buildCreature(n.species, { outline: false });
    setStarLook(c, n.star || 1);
    // sized to the yard: a big one brought down, a small one up to be seen
    const m = c.userData.model, h = (m?.height || 1) * c.scale.x;
    const k = Math.min(MAX_UP, TARGET_H / h);
    if (Math.abs(k - 1) > 0.02) { c.userData.baseScale *= k; const st = c.userData.star; c.userData.star = 0; setStarLook(c, st); }
    holder.add(c, softShadowTexture(0.42, 0.26));
    const s = this.spots[n.job];
    holder.position.set(s.x + (i % 3 - 1) * 0.8, 0, s.z + (i % 2) * 0.6);
    holder.position.y = this.world.heightAt(holder.position.x, holder.position.z);
    this.group.add(holder);
    const w = { uid, species: n.species, star: n.star || 1, job: n.job, full: !!n.full, holder, creature: c, seed: (i * 1.7 + uid.charCodeAt(0)) % 10, to: null, wait: 0.5 + i * 0.4, working: false, heading: 0 };
    return w;
  }

  drop(uid) {
    const w = this.list.get(uid);
    if (!w) return;
    // (the creature's mesh is its species' shared one: taken off, not disposed)
    this.group.remove(w.holder);
    this.list.delete(uid);
  }

  /** Somewhere new in its corner to walk to. */
  pick(w, now = false) {
    const s = this.spots[w.job], a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
    w.to = { x: s.x + Math.cos(a) * s.rx * r, z: s.z + Math.sin(a) * s.rz * r };
    w.working = false;
    now && (w.wait = 0);
  }

  update(dt, tMs, camera) {
    if (!this.list.size) return;
    this.time += dt;
    const t = this.time;
    for (const w of this.list.values()) {
      const p = w.holder.position, c = w.creature;
      let moving = false, dip = 0;
      if (w.wait > 0) {
        w.wait -= dt;
        // at work: each job its own motion. A full basket: it sits and waits.
        if (w.working && !w.full) {
          const ph = t * (w.job === 'mine' ? 5.5 : w.job === 'forge' ? 4.2 : 2.6) + w.seed;
          dip = w.job === 'scout' ? Math.max(0, Math.sin(ph)) * 0.18 : Math.abs(Math.sin(ph)) * 0.08;
          c.rotation.x = w.job === 'scout' ? 0 : Math.max(0, Math.sin(ph)) * 0.22;
        } else c.rotation.x *= 0.9;
        if (w.wait <= 0) this.pick(w);
      } else if (w.to) {
        const dx = w.to.x - p.x, dz = w.to.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) {
          w.to = null; w.working = true;
          w.wait = w.full ? 6 : 2.5 + Math.random() * 3.5;
          // face the work: the heap, the anvil, the road, the rows
          const s = this.spots[w.job], aim = s.prop || s;
          w.heading = Math.atan2(aim.x - p.x, aim.z - p.z);
        } else {
          const step = Math.min(d, SPEED * dt);
          p.x += dx / d * step; p.z += dz / d * step;
          w.heading = Math.atan2(dx, dz);
          moving = true;
        }
      } else this.pick(w);
      // turn toward where it is going, smoothly
      let dh = w.heading - w.holder.rotation.y;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      w.holder.rotation.y += dh * Math.min(1, dt * 6);
      p.y = this.world.heightAt(p.x, p.z) + dip;
      animateCreature(c, tMs, moving, 0.8);
      camera && setCreatureLod(c, Math.hypot(camera.position.x - p.x, camera.position.z - p.z));
    }
  }

  /** How many are out working (for tests and the panel). */
  get count() { return this.list.size; }
}
