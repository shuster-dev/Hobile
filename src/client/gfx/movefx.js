// Each element's own way of landing a hit (the "signature"), on top of the
// shared impact the arena already draws (battle.js impact: flash, ring,
// shards). Fire erupts out of the ground under the target; water comes up as
// a geyser and rains back down; vines burst up and wither; lightning falls
// from the sky in a jagged bolt; stone spikes punch up around it; wind spins
// a funnel round it; ice grows crystals on it that shatter; the dark folds in
// on it and lets go; light comes down as a pillar; metal crosses two blades.
//
// Each effect is an object with step(dt) → true when finished, which the
// arena's effect loop runs (kind "custom"); it removes what it added itself.
// Bigger moves draw bigger: `power` (the move's power, 30–100) and `crit`.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  Group, Mesh, MeshBasicMaterial, OctahedronGeometry, PlaneGeometry, RingGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector3,
} from 'three';
import { QUALITY } from './core.js';

const add = (color, opacity, extra = {}) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, ...extra });
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const bump = (x) => Math.sin(Math.PI * Math.min(1, Math.max(0, x)));
const rnd = (a, b) => a + Math.random() * (b - a);
const LOW = () => QUALITY.tier === 'low';

// shared geometry: made once, never disposed
const G = {
  cone: new ConeGeometry(0.5, 1, 10, 1, true).translate(0, 0.5, 0),
  spike: new ConeGeometry(0.22, 1, 5).translate(0, 0.5, 0),
  tube: new CylinderGeometry(0.5, 0.5, 1, 16, 1, true).translate(0, 0.5, 0),
  ball: new SphereGeometry(0.5, 10, 8),
  ring: new RingGeometry(0.7, 1, 40),
  torus: new TorusGeometry(1, 0.08, 6, 32),
  crystal: new OctahedronGeometry(0.5, 0),
  leaf: new PlaneGeometry(0.16, 0.08),
  blade: new PlaneGeometry(2.6, 0.22),
};

/** Fades a cone from its base to nothing at its tip (vertex colours). */
function gradient(geo, from = 1, to = 0) {
  const g = geo.clone(), p = g.attributes.position, c = new Float32Array(p.count * 3);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) { const k = from + (to - from) * ((p.getY(i) - y0) / (y1 - y0 || 1)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = Math.max(0, k); }
  g.setAttribute('color', new BufferAttribute(c, 3));
  return g;
}
/** The same fade as alpha (RGBA vertex colours), for a colour that has to
 *  read as itself on a bright floor — added light only ever goes white. */
function fadeAlpha(geo, from = 1, to = 0) {
  const g = geo.clone(), p = g.attributes.position, c = new Float32Array(p.count * 4);
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) { const k = from + (to - from) * ((p.getY(i) - y0) / (y1 - y0 || 1)); c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = 1; c[i * 4 + 3] = Math.max(0, k); }
  g.setAttribute('color', new BufferAttribute(c, 4));
  return g;
}
const GG = {
  cone: gradient(G.cone), tube: gradient(G.tube), beam: gradient(new CylinderGeometry(0.5, 0.5, 1, 18, 1, true).translate(0, 0.5, 0), 0, 1),
  flame: fadeAlpha(new ConeGeometry(0.5, 1, 12, 3, true).translate(0, 0.5, 0)), water: fadeAlpha(new CylinderGeometry(0.42, 0.5, 1, 16, 3, true).translate(0, 0.5, 0), 0.9, 0.1),
};
const solid = (color, opacity) => new MeshBasicMaterial({ color, transparent: true, opacity, vertexColors: true, depthWrite: false, side: DoubleSide, toneMapped: false });

/** Base for every signature: a group in the scene and a clock. */
class Sig {
  constructor(view, at, life) {
    this.view = view; this.at = at.clone(); this.life = life; this.t = 0;
    this.group = new Group();
    this.group.position.copy(at);
    view.scene.add(this.group);
    this.mats = [];
  }
  mat(m) { this.mats.push(m); return m; }
  mesh(geo, m, owned = false) { const x = new Mesh(geo, this.mat(m)); x.userData.owned = owned; this.group.add(x); return x; }
  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    this.tick(k, dt);
    if (k >= 1) { this.dispose(); return true; }
    return false;
  }
  dispose() {
    this.view.scene.remove(this.group);
    this.group.traverse((o) => o.userData.owned && o.geometry?.dispose());
    for (const m of this.mats) m.dispose();
  }
}

// ---------------------------------------------------------------- ember
class Eruption extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.42), 0.75);
    this.s = s;
    this.shell = this.mesh(GG.flame, solid(0xFF5A1F, 0.85));
    this.core = this.mesh(GG.flame, solid(0xFFC43A, 0.95));
    this.heat = this.mesh(GG.cone, add(0xFF8A2A, 0.5, { vertexColors: true }));
    this.embers = [];
    for (let i = 0; i < (LOW() ? 6 : 12); i++) {
      const m = this.mesh(G.ball, add(i % 2 ? 0xFFB040 : color, 0.9));
      const a = rnd(0, Math.PI * 2), r = rnd(0.2, 0.8);
      m.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      m.userData.v = new Vector3(Math.cos(a) * rnd(0.5, 1.5), rnd(3, 6) * s, Math.sin(a) * rnd(0.5, 1.5));
      m.scale.setScalar(rnd(0.08, 0.16));
      this.embers.push(m);
    }
  }
  tick(k, dt) {
    const up = ease(k / 0.35), h = 2.6 * this.s * up * (1 - 0.3 * Math.max(0, k - 0.6) / 0.4);
    this.core.scale.set(0.55 * this.s * (1 - k * 0.6), h * 0.8, 0.55 * this.s * (1 - k * 0.6));
    this.shell.scale.set(1.1 * this.s * (0.6 + up * 0.4), h, 1.1 * this.s * (0.6 + up * 0.4));
    this.heat.scale.set(1.5 * this.s * up, h * 1.1, 1.5 * this.s * up);
    this.core.rotation.y += dt * 6; this.shell.rotation.y -= dt * 4;
    const fade = 1 - Math.max(0, (k - 0.55) / 0.45);
    this.core.material.opacity = 0.95 * fade; this.shell.material.opacity = 0.85 * fade; this.heat.material.opacity = 0.5 * fade;
    for (const m of this.embers) { m.userData.v.y -= 6 * dt; m.position.addScaledVector(m.userData.v, dt); m.material.opacity = 0.9 * fade; }
  }
}

// ---------------------------------------------------------------- aqua
class Geyser extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.42), 0.9);
    this.s = s;
    this.col = this.mesh(GG.water, solid(0x6FCBFF, 0.8));
    this.foam = this.mesh(GG.tube, add(0xFFFFFF, 0.45, { vertexColors: true }));
    this.wave = this.mesh(G.torus, add(color, 0.8));
    this.wave.rotation.x = Math.PI / 2; this.wave.position.y = 0.06;
    this.drops = [];
    for (let i = 0; i < (LOW() ? 8 : 16); i++) {
      const m = this.mesh(G.ball, add(i % 3 ? color : 0xFFFFFF, 0.85));
      m.scale.setScalar(rnd(0.07, 0.13));
      m.userData.v = new Vector3(rnd(-1.6, 1.6), rnd(4.5, 7.5) * s, rnd(-1.6, 1.6));
      m.visible = false;
      this.drops.push(m);
    }
  }
  tick(k, dt) {
    const up = ease(k / 0.3), w = 0.9 * this.s;
    this.col.scale.set(w * (1 - k * 0.5), 3.2 * this.s * up * (1 - Math.max(0, k - 0.5)), w * (1 - k * 0.5));
    this.col.material.opacity = 0.8 * (1 - k);
    this.foam.scale.set(w * 1.15 * (1 - k * 0.5), 2.2 * this.s * up * (1 - Math.max(0, k - 0.5)), w * 1.15 * (1 - k * 0.5));
    this.foam.material.opacity = 0.45 * (1 - k);
    this.wave.scale.setScalar(0.4 + ease(k) * 2.4 * this.s);
    this.wave.material.opacity = 0.8 * (1 - k);
    for (const m of this.drops) {
      if (k < 0.2) continue;
      if (!m.visible) { m.visible = true; m.position.set(0, 2.6 * this.s, 0); }
      m.userData.v.y -= 14 * dt; m.position.addScaledVector(m.userData.v, dt);
      if (m.position.y < 0) m.visible = false;
      m.material.opacity = 0.85 * (1 - k);
    }
  }
}

// ---------------------------------------------------------------- verdant
class Vines extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.42), 0.95);
    this.s = s;
    this.vines = [];
    const n = LOW() ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rnd(-0.3, 0.3), r0 = 1.4 * s, pts = [];
      for (let j = 0; j <= 5; j++) {
        const u = j / 5, rr = r0 * (1 - u * 0.75), ang = a + u * 1.4;
        pts.push(new Vector3(Math.cos(ang) * rr, u * 2.4 * s, Math.sin(ang) * rr));
      }
      const geo = new TubeGeometry(new CatmullRomCurve3(pts), 24, 0.07 * s, 5, false);
      const m = this.mesh(geo, new MeshBasicMaterial({ color: i % 2 ? 0x3E9A3A : 0x5BC76A, transparent: true, opacity: 1, toneMapped: false }), true);
      geo.setDrawRange(0, 0);
      m.userData.total = geo.index ? geo.index.count : geo.attributes.position.count;
      this.vines.push(m);
    }
    this.leaves = [];
    for (let i = 0; i < (LOW() ? 6 : 14); i++) {
      const m = this.mesh(G.leaf, add(i % 2 ? color : 0xB8F27A, 0.95));
      const a = rnd(0, Math.PI * 2);
      m.userData = { a, r: rnd(0.4, 1.4) * s, y: rnd(0.3, 2.2) * s, w: rnd(3, 6) * (i % 2 ? 1 : -1) };
      this.leaves.push(m);
    }
  }
  tick(k, dt) {
    const grow = ease(k / 0.4), wither = Math.max(0, (k - 0.65) / 0.35);
    for (const m of this.vines) {
      const g = m.geometry, tot = m.userData.total;
      g.setDrawRange(0, Math.floor(tot * grow / 6) * 6);
      m.material.opacity = 1 - wither;
      m.scale.setScalar(1 - wither * 0.3);
    }
    for (const m of this.leaves) {
      const u = m.userData; u.a += u.w * dt;
      m.position.set(Math.cos(u.a) * u.r, u.y + k * 0.8, Math.sin(u.a) * u.r);
      m.rotation.set(u.a, u.a * 2, 0);
      m.material.opacity = 0.95 * (1 - wither);
    }
  }
}

// ---------------------------------------------------------------- volt
class Bolt extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone(), 0.55);
    this.s = s; this.color = color;
    this.mat1 = this.mat(add(0xFFFFFF, 1));
    this.mat2 = this.mat(add(color, 0.8));
    this.core = new Mesh(new BufferGeometry(), this.mat1); this.core.userData.owned = true;
    this.glow = new Mesh(new BufferGeometry(), this.mat2); this.glow.userData.owned = true;
    this.group.add(this.glow, this.core);
    this.disc = this.mesh(G.ring, add(color, 0.9));
    this.disc.rotation.x = -Math.PI / 2; this.disc.position.y = -this.at.y + 0.45;
    this.next = 0;
    this.zap();
  }
  /** A new jagged path from the sky to the target, as a camera-facing ribbon. */
  zap() {
    const cam = this.view.camera.position, top = new Vector3(rnd(-1, 1), 11, rnd(-1, 1)), pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = top.clone().lerp(new Vector3(0, 0, 0), u);
      if (i && i < n) p.add(new Vector3(rnd(-0.7, 0.7), rnd(-0.3, 0.3), rnd(-0.7, 0.7)));
      pts.push(p);
    }
    for (const [mesh, w] of [[this.core, 0.09 * this.s], [this.glow, 0.32 * this.s]]) {
      const pos = new Float32Array(n * 6 * 3);
      let o = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[i + 1], dir = b.clone().sub(a).normalize();
        const toCam = cam.clone().sub(this.at).sub(a).normalize(), side = dir.clone().cross(toCam).normalize().multiplyScalar(w);
        const q = [a.clone().add(side), a.clone().sub(side), b.clone().add(side), b.clone().sub(side)];
        for (const v of [q[0], q[1], q[2], q[2], q[1], q[3]]) { pos[o++] = v.x; pos[o++] = v.y; pos[o++] = v.z; }
      }
      mesh.geometry.dispose();
      mesh.geometry = new BufferGeometry();
      mesh.geometry.setAttribute('position', new BufferAttribute(pos, 3));
    }
  }
  tick(k, dt) {
    this.next -= dt;
    if (this.next <= 0 && k < 0.7) { this.zap(); this.next = 0.07; }
    const flick = k < 0.7 ? (Math.random() < 0.25 ? 0.25 : 1) : 1 - (k - 0.7) / 0.3;
    this.mat1.opacity = flick; this.mat2.opacity = 0.8 * flick;
    this.disc.scale.setScalar(0.5 + ease(k) * 2.2 * this.s);
    this.disc.material.opacity = 0.9 * (1 - k);
  }
}

// ---------------------------------------------------------------- terra
class Spikes extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.4), 0.85);
    this.s = s;
    this.spikes = [];
    const n = LOW() ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rnd(-0.2, 0.2), r = rnd(0.7, 1.3) * s;
      const m = new Mesh(G.spike, this.mat(new MeshBasicMaterial({ color: new Color(i % 2 ? 0x8A6A48 : 0x6E5A44).lerp(new Color(color), 0.25), transparent: true, opacity: 1, toneMapped: false })));
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      m.rotation.order = 'YXZ';
      m.userData.h = rnd(1.1, 2.0) * s;
      this.group.add(m);
      this.spikes.push(m);
    }
    this.dust = this.mesh(G.ring, add(0xC8B090, 0.6));
    this.dust.rotation.x = -Math.PI / 2; this.dust.position.y = 0.05;
  }
  tick(k) {
    const up = ease(k / 0.18), down = Math.max(0, (k - 0.6) / 0.4);
    for (const m of this.spikes) { m.scale.set(1.3 * this.s, m.userData.h * up * (1 - down), 1.3 * this.s); m.material.opacity = 1 - down; }
    this.dust.scale.setScalar(0.6 + ease(k) * 2.6 * this.s);
    this.dust.material.opacity = 0.6 * (1 - k);
  }
}

// ---------------------------------------------------------------- gale
class Funnel extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.42), 0.85);
    this.s = s;
    this.rings = [];
    const n = LOW() ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const m = this.mesh(G.torus, add(i % 2 ? 0xFFFFFF : color, 0.55));
      m.rotation.x = Math.PI / 2;
      m.userData.i = i / (n - 1);
      this.rings.push(m);
    }
  }
  tick(k, dt) {
    const up = ease(k / 0.3), fade = 1 - Math.max(0, (k - 0.55) / 0.45);
    for (const m of this.rings) {
      const u = m.userData.i, r = (0.35 + u * 1.3) * this.s;
      m.position.set(Math.cos(this.t * 9 + u * 5) * 0.25 * u, u * 3 * this.s * up, Math.sin(this.t * 9 + u * 5) * 0.25 * u);
      m.scale.set(r, r, 1 + u);
      m.rotation.z += dt * (12 - u * 6);
      m.material.opacity = 0.55 * fade * (0.5 + 0.5 * u);
    }
  }
}

// ---------------------------------------------------------------- frost
class Crystals extends Sig {
  constructor(view, at, color, s, done) {
    super(view, at.clone().setY(0.42), 0.8);
    this.s = s; this.done = done;
    this.bits = [];
    const n = LOW() ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const m = new Mesh(G.crystal, this.mat(new MeshBasicMaterial({ color: i % 2 ? 0xDFF8FF : color, transparent: true, opacity: 0.85, toneMapped: false })));
      const a = i / n * Math.PI * 2, r = rnd(0.35, 0.8) * s;
      m.position.set(Math.cos(a) * r, rnd(0.3, 1.6) * s, Math.sin(a) * r);
      m.rotation.set(rnd(-0.6, 0.6), a, rnd(-0.6, 0.6));
      m.userData.h = rnd(0.7, 1.4) * s;
      this.group.add(m);
      this.bits.push(m);
    }
    this.mist = this.mesh(G.ball, add(0xE0F8FF, 0.25));
    this.mist.position.y = 1;
  }
  tick(k) {
    const grow = ease(k / 0.45);
    for (const m of this.bits) { m.scale.set(0.35 * grow * this.s, m.userData.h * grow, 0.35 * grow * this.s); m.material.opacity = k > 0.75 ? 0.85 * (1 - (k - 0.75) / 0.25) : 0.85; }
    this.mist.scale.setScalar((1 + k * 2) * this.s);
    this.mist.material.opacity = 0.25 * (1 - k);
    // and then it breaks
    if (k > 0.72 && !this.broke) { this.broke = true; this.done?.(); }
  }
}

// ---------------------------------------------------------------- umbra
class Void extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone(), 0.7);
    this.s = s;
    this.sphere = this.mesh(G.ball, new MeshBasicMaterial({ color: 0x140A24, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    this.rim = this.mesh(G.torus, add(color, 0.9));
    this.rim2 = this.mesh(G.torus, add(0xC890FF, 0.7));
    this.rim2.rotation.x = Math.PI / 2;
  }
  tick(k) {
    const close = ease(k / 0.55), r = (3.6 - close * 3.2) * this.s;
    this.sphere.scale.setScalar(r);
    this.sphere.material.opacity = k < 0.55 ? 0.15 + close * 0.45 : 0.6 * (1 - (k - 0.55) / 0.45);
    this.rim.scale.setScalar(r * 0.55); this.rim2.scale.setScalar(r * 0.55);
    this.rim.lookAt(this.view.camera.position);
    this.rim2.rotation.z = this.t * 4;
    const f = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    this.rim.material.opacity = 0.9 * f; this.rim2.material.opacity = 0.7 * f;
    if (k > 0.55) { const b = 1 + bump((k - 0.55) / 0.45) * 2; this.rim.scale.setScalar(0.5 * b * this.s); this.rim2.scale.setScalar(0.6 * b * this.s); }
  }
}

// ---------------------------------------------------------------- lumen
class Pillar extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone().setY(0.42), 0.8);
    this.s = s;
    this.beam = this.mesh(GG.beam, add(0xFFF6C0, 0.9, { vertexColors: true }));
    this.outer = this.mesh(GG.beam, add(color, 0.55, { vertexColors: true }));
    this.disc = this.mesh(G.ring, add(0xFFF2A0, 0.9));
    this.disc.rotation.x = -Math.PI / 2; this.disc.position.y = 0.05;
  }
  tick(k) {
    const w = bump(k) * this.s;
    this.beam.scale.set(0.7 * w, 14, 0.7 * w);
    this.outer.scale.set(1.6 * w, 14, 1.6 * w);
    this.beam.material.opacity = 0.9 * bump(k); this.outer.material.opacity = 0.55 * bump(k);
    this.disc.scale.setScalar(0.4 + ease(k) * 2.4 * this.s);
    this.disc.material.opacity = 0.9 * (1 - k);
  }
}

// ---------------------------------------------------------------- metal
class Blades extends Sig {
  constructor(view, at, color, s) {
    super(view, at.clone(), 0.55);
    this.s = s;
    this.a = this.mesh(G.blade, add(0xF2F6FF, 0.95));
    this.b = this.mesh(G.blade, add(color, 0.85));
    this.sparks = [];
    for (let i = 0; i < (LOW() ? 6 : 12); i++) {
      const m = this.mesh(G.ball, add(0xFFE07A, 1));
      m.scale.setScalar(rnd(0.04, 0.08));
      m.userData.v = new Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 3));
      this.sparks.push(m);
    }
  }
  tick(k, dt) {
    const cam = this.view.camera.position;
    for (const [m, sgn, delay] of [[this.a, 1, 0], [this.b, -1, 0.12]]) {
      const u = Math.max(0, Math.min(1, (k - delay) / 0.4));
      m.lookAt(cam); m.rotateZ(sgn * 0.8);
      m.scale.set(ease(u) * this.s, (1 - u * 0.6) * this.s, 1);
      m.material.opacity = (sgn > 0 ? 0.95 : 0.85) * (u > 0 ? 1 - Math.max(0, (k - 0.5) / 0.5) : 0);
    }
    for (const m of this.sparks) { m.userData.v.y -= 12 * dt; m.position.addScaledVector(m.userData.v, dt); m.material.opacity = 1 - k; }
  }
}

const KINDS = { ember: Eruption, aqua: Geyser, verdant: Vines, volt: Bolt, terra: Spikes, gale: Funnel, frost: Crystals, umbra: Void, lumen: Pillar, metal: Blades };

/**
 * The signature of `type` landing on `target` (an arena actor). `power` is
 * the move's power; `crit` makes it bigger. `onShatter` (frost) is called when
 * the crystals break, so the arena can throw its shards then.
 */
export function signature(view, type, target, color, { power = 50, crit = false, onShatter } = {}) {
  const K = KINDS[type];
  if (!K || !target) return null;
  const at = target.holder.position.clone().add(new Vector3(0, 1, 0));
  const size = Math.max(0.75, Math.min(1.5, (target.height || 1.4) / 1.6)) * (0.8 + Math.min(100, power) / 250) * (crit ? 1.25 : 1);
  const fx = new K(view, at, color, size, onShatter);
  view.effects.push({ kind: 'custom', t: 0, step: (dt) => fx.step(dt) });
  return fx;
}

/** How long the arena holds still when a hit lands (seconds). */
export function hitStop({ crit = false, eff = 1, power = 50 } = {}) {
  return crit ? 0.12 : eff > 1 ? 0.09 : power >= 80 ? 0.07 : 0.035;
}

export const SIGNATURE_TYPES = Object.keys(KINDS);
