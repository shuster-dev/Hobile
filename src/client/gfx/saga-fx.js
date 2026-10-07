// What the end of the story puts in the world (shared/saga.js): the anchors
// standing in the zones they hold, Vesper's projection when she speaks, and
// the rift over the port — calm, torn wide, or closed — for this player.
//
// The rift itself is built with the town (world.js buildWaterPlane); this
// only scales it and turns its light up or down. Everything here is drawn
// from the player's own story, not from the room: two players in the port
// can see two different skies.
import {
  AdditiveBlending, BufferAttribute, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, OctahedronGeometry, RingGeometry,
} from 'three';
import { VILLAIN } from '../../shared/saga.js';
import { animateCreature, buildAvatar } from './creatures.js';
import { personAct, KINDS } from './people.js';
import { Kit, glowVC, toonVC } from './zonekit.js';

const TEAL = 0x2FE6D0, CORAL = 0xFF7A59, HOLO = 0x7FF3FF;
const RIFT = { calm: { scale: 1, gain: 1 }, torn: { scale: 1.75, gain: 1.9 }, sealed: { scale: 0.06, gain: 0.25 } };
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

function additive(color, opacity) {
  return new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false });
}

/** One anchor: a black stone held up over a ring of rock, a crack of the
 *  rift's light down it, and a column of that light into the sky. */
function buildAnchor(a, y) {
  const g = new Group();
  g.position.set(a.x, y, a.z);
  const k = new Kit(), l = new Kit();
  for (let i = 0; i < 7; i++) {
    const t = i / 7 * Math.PI * 2;
    k.rock(0.55 + (i % 3) * 0.15, { x: Math.cos(t) * 2.1, y: 0.25, z: Math.sin(t) * 2.1, sy: 0.7, ry: t }, i % 2 ? 0x2E2840 : 0x3A3450);
  }
  k.cyl(1.7, 1.9, 0.18, { y: 0.09 }, 0x1E1A2E, 18);
  l.ring(1.45, 0.05, { y: 0.2, rx: Math.PI / 2 }, TEAL, 36);
  const base = new Mesh(k.geometry(), toonVC()), ring = new Mesh(l.geometry(), glowVC());
  base.castShadow = true; base.receiveShadow = true;
  g.add(base, ring);
  // the stone: four-sided, hanging in the air, turning slowly
  const stone = new Group();
  stone.position.y = 1.4;
  const s = new Kit(), c = new Kit();
  s.add(new CylinderGeometry(0.28, 0.62, 3.6, 4, 1), { y: 1.8, ry: Math.PI / 4 }, 0x1A1628);
  s.add(new ConeGeometry(0.28, 0.7, 4), { y: 3.95, ry: Math.PI / 4 }, 0x1A1628);
  c.box(0.13, 3.0, 0.13, { x: 0.3, y: 1.7, z: 0.0, rz: -0.08 }, TEAL);
  c.box(0.1, 2.2, 0.1, { x: 0.0, y: 1.9, z: 0.34, rz: 0.05 }, TEAL);
  c.box(0.06, 1.6, 0.06, { x: -0.25, y: 2.2, z: 0.25, rz: 0.12 }, CORAL);
  c.add(new OctahedronGeometry(0.22, 0), { y: 4.5 }, HOLO);
  const sm = new Mesh(s.geometry(), toonVC()), cm = new Mesh(c.geometry(), glowVC());
  sm.castShadow = true;
  stone.add(sm, cm);
  g.add(stone);
  // the column of light
  const beam = new Mesh(new CylinderGeometry(0.45, 1.1, 40, 18, 1, true).translate(0, 20, 0), additive(TEAL, 0.18));
  beam.renderOrder = 5;
  g.add(beam);
  // shards going round it
  const shards = new Group();
  for (let i = 0; i < 6; i++) {
    const m = new Mesh(new OctahedronGeometry(0.16, 0), additive(i % 2 ? TEAL : CORAL, 0.9));
    m.userData.i = i;
    shards.add(m);
  }
  g.add(shards);
  g.userData = { id: a.id, stone, beam, shards, seed: a.x * 0.1 };
  return g;
}

/** Her projection: the figure in light, a disc under it, a beam it stands in. */
function buildHolo() {
  const g = new Group();
  const fig = buildAvatar(VILLAIN.look, { outline: false });
  // light, not paint: one tint over all of her, brighter than what is behind
  const mat = new MeshBasicMaterial({ color: 0x6FEFFF, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  fig.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.renderOrder = 7; } });
  fig.scale.multiplyScalar(1.08);
  const disc = new Mesh(new RingGeometry(0.25, 0.8, 40), additive(HOLO, 0));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
  // the beam she stands in: bright at the disc, gone by her head
  const cg = new CylinderGeometry(0.62, 0.7, 2.6, 24, 4, true).translate(0, 1.3, 0), cp = cg.attributes.position, cc = new Float32Array(cp.count * 3);
  for (let i = 0; i < cp.count; i++) { const k = Math.max(0, 1 - cp.getY(i) / 2.6); cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = k * k; }
  cg.setAttribute('color', new BufferAttribute(cc, 3));
  const col = new Mesh(cg, additive(TEAL, 0));
  col.material.vertexColors = true;
  g.add(fig, disc, col);
  g.userData = { fig, mat, disc, col, k: 0, want: 0 };
  return g;
}

export class SagaStage {
  constructor(world) {
    this.world = world;
    this.group = new Group();
    this.group.name = 'saga';
    world.scene.add(this.group);
    this.anchors = [];
    this.anchorKey = '';
    this.rift = { state: 'calm', from: RIFT.calm, to: RIFT.calm, t: 1, dur: 1, pulse: 0, obj: null, base: null };
    this.holo = null;
    this.time = 0;
  }

  /** The anchors standing in this zone for this player ([{id,x,z}]). */
  setAnchors(list = []) {
    const key = `${this.world.zone?.id}|${list.map((a) => a.id).join(',')}`;
    if (key === this.anchorKey) return;
    this.anchorKey = key;
    for (const g of this.anchors) { this.group.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    this.anchors = list.map((a) => buildAnchor(a, this.world.heightAt(a.x, a.z)));
    for (const g of this.anchors) this.group.add(g);
  }

  /** The rift for this player: 'calm', 'torn' or 'sealed'; `secs` to get there. */
  setRift(state, secs = 0) {
    const R = this.rift, want = RIFT[state] || RIFT.calm;
    if (R.state === state && R.t >= R.dur) return;
    R.from = this.riftNow(); R.to = want; R.state = state; R.t = 0; R.dur = Math.max(0.001, secs);
  }

  riftNow() {
    const R = this.rift, k = ease(R.t / R.dur);
    return { scale: R.from.scale + (R.to.scale - R.from.scale) * k, gain: R.from.gain + (R.to.gain - R.from.gain) * k };
  }

  pulse(k = 1) { this.rift.pulse = Math.max(this.rift.pulse, k); }

  /** Her projection, at (x, z), facing (fx, fz); or gone. */
  showHolo(at, face) {
    if (!this.holo) { this.holo = buildHolo(); this.group.add(this.holo); }
    const h = this.holo;
    h.position.set(at.x, this.world.heightAt(at.x, at.z) + 0.05, at.z);
    h.rotation.y = Math.atan2(face.x - at.x, face.z - at.z);
    h.userData.want = 1;
    personAct(h.userData.fig, KINDS[VILLAIN.look.kind]?.pose || 'cheer', 1.6);
  }
  hideHolo() { this.holo && (this.holo.userData.want = 0); }
  holoAt() { return this.holo && this.holo.userData.want ? this.holo.position : null; }

  update(dt, tMs) {
    this.time += dt;
    const t = this.time;
    // the rift: whichever one the town has now (it is rebuilt with the zone)
    const rift = this.world.city?.rift || null, R = this.rift;
    if (rift !== R.obj) {
      R.obj = rift; R.base = null;
      if (rift) {
        R.base = { scale: rift.group.scale.x || 1, gains: [] };
        rift.group.traverse((o) => { const u = o.material?.uniforms?.uGain; u && R.base.gains.push([u, u.value]); });
      }
    }
    R.t = Math.min(R.dur, R.t + dt);
    R.pulse = Math.max(0, R.pulse - dt * 0.9);
    if (rift && R.base) {
      const now = this.riftNow(), beat = R.pulse * (0.6 + 0.4 * Math.sin(t * 9));
      rift.group.scale.setScalar(R.base.scale * now.scale * (1 + beat * 0.12));
      for (const [u, v] of R.base.gains) u.value = v * now.gain * (1 + beat * 1.4);
      rift.group.visible = now.scale > 0.02;
    }
    for (const g of this.anchors) {
      const u = g.userData;
      u.stone.position.y = 1.4 + Math.sin(t * 1.3 + u.seed) * 0.18;
      u.stone.rotation.y = t * 0.35 + u.seed;
      u.beam.material.opacity = 0.24 + 0.1 * Math.sin(t * 2.2 + u.seed);
      for (const m of u.shards.children) {
        const a = t * 0.8 + m.userData.i / 6 * Math.PI * 2;
        m.position.set(Math.cos(a) * 1.6, 2.2 + Math.sin(t * 1.7 + m.userData.i) * 0.5, Math.sin(a) * 1.6);
        m.rotation.y = t * 2 + m.userData.i;
      }
    }
    if (this.holo) {
      const u = this.holo.userData;
      u.k += (u.want - u.k) * Math.min(1, dt * 2.5);
      const flick = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3);
      u.mat.opacity = 0.72 * u.k * flick;
      u.disc.material.opacity = 0.7 * u.k;
      u.col.material.opacity = 0.35 * u.k;
      u.fig.position.y = 0.12 + Math.sin(t * 1.6) * 0.06;
      u.fig.userData.baseY = u.fig.position.y;
      animateCreature(u.fig, tMs, false);
      this.holo.visible = u.k > 0.01;
    }
  }
}

export { TEAL, CORAL, HOLO };
