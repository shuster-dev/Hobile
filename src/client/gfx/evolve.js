// The evolution, on the battle stage once the fight is over.
//
// The stage goes dark around your creature, it turns to light, and it flickers
// between what it was and what it is becoming — slowly, then faster — until a
// flash leaves the new one standing there. A message saying "X evolved into Y"
// was the whole of it before; this is the moment the genre is remembered for.
//
// It borrows the battle view's renderer, camera, lights and effects (the
// shards, rings and vignette every hit already uses), and while it runs the
// view hands it the camera (BattleView.update). The fight's own actors are
// hidden, not removed: whatever comes next clears them as it always does.
import { AdditiveBlending, BackSide, Box3, BufferAttribute, BufferGeometry, CircleGeometry, Color, Group, Mesh, Points, PointsMaterial, RingGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { animateCreature, buildCreature } from './creatures.js';
import { setStarLook } from './starlook.js';
import { QUALITY } from './core.js';

/** Seconds: the stage dims, the glow comes, the flicker, the flash, the end. */
export const EVOLVE_T = { gather: 0.9, glow: 1.8, burst: 5.2, end: 7.8 };

const CENTER = new Vector3(0, 0.35, 1.2);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmpBox = new Box3();
const v1 = new Vector3();

/** A model of the species, its stars on, its materials its own to light up. */
function figure(view, species, star) {
  const g = setStarLook(buildCreature(species, { hi: true }), star || 1);
  const holder = new Group();
  holder.add(g);
  const actor = { group: g, mats: null };
  const mats = view.ownMaterials(actor);
  tmpBox.setFromObject(g);
  const ok = Number.isFinite(tmpBox.max.y);
  const h = ok ? Math.max(0.6, tmpBox.max.y) : 1.4;
  // turning on the spot, its widest is the diagonal of its footprint
  const w = ok ? Math.hypot(tmpBox.max.x - tmpBox.min.x, tmpBox.max.z - tmpBox.min.z) : 1.4;
  return { holder, group: g, mats, height: h, width: w, base: g.scale.x };
}

/** 0 = itself, 1 = pure light. Outlines fade with it so the shape glows clean. */
function whiten(fig, k) {
  for (const m of fig.mats) {
    if (m.m.emissive) {
      m.m.emissive.setHex(m.e).lerp(WHITE, k);
      m.m.emissiveIntensity = (m.i ?? 1) * (1 - k) + 1.35 * k;
    } else {
      m.m.transparent = k > 0.001 ? true : m.tr;
      m.m.opacity = m.o * (1 - k);
    }
  }
}
const WHITE = new Color(0xffffff);

function domeMaterial(top, bottom) {
  return new ShaderMaterial({
    uniforms: { uTop: { value: new Color(top) }, uBot: { value: new Color(bottom) }, uOp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uBot; uniform float uOp, uTime; varying vec3 vP;
      void main(){
        float h = vP.y * 0.5 + 0.5;
        vec3 c = mix(uBot, uTop, smoothstep(0.42, 1.0, h));
        float a = atan(vP.x, vP.z);
        float rays = pow(0.5 + 0.5 * sin(a * 11.0 + uTime * 0.35), 10.0) * smoothstep(0.45, 0.95, h);
        gl_FragColor = vec4(c + uTop * rays * 0.35, uOp);
      }`,
    side: BackSide, transparent: true, depthWrite: false, fog: false,
  });
}

/** The floor fading into the dark, so the edge of the dome is never a line. */
function floorMaterial(bottom) {
  return new ShaderMaterial({
    uniforms: { uBot: { value: new Color(bottom) }, uOp: { value: 0 }, uGlow: { value: new Color(0xffffff) }, uG: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uBot, uGlow; uniform float uOp, uG; varying vec2 vU;
      void main(){
        float r = length(vU);
        // a pool of light under it in the dark, and nothing at the edge
        float pool = 1.0 - smoothstep(0.0, 2.6, r);
        vec3 c = mix(uBot, uGlow * 0.42, pool * pool * (0.45 + 0.55 * uG));
        float ring = smoothstep(0.06, 0.0, abs(r - 1.25)) * 0.35 * uG;
        gl_FragColor = vec4(c + uGlow * ring, uOp * (1.0 - smoothstep(7.0, 9.0, r) * 0.0));
      }`,
    transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
}

export class EvolveCeremony {
  /**
   * `steps`: [{from, into, star}] — usually one. `hooks`: {charge(step),
   * burst(step), done()} — the game's sound and words; `fx`: the battle
   * module's {speciesColor, fxFor}.
   */
  constructor(view, steps, hooks = {}, fx = {}) {
    this.view = view;
    this.steps = steps.slice();
    this.hooks = hooks;
    this.fx = fx;
    this.t = 0;
    this.i = -1;
    this.over = false;
    this.lightBase = { sun: view.lights.sun.intensity, hemi: view.lights.hemi.intensity };
    this.camFrom = view.camera.position.clone();
    this.aimFrom = view.camAim.clone();
    // The stage goes: everything in the scene now except its lights and the
    // camera. Effects made from here on (the flash's shards and rings) show.
    this.hidden = view.scene.children.filter((o) => o.visible && !o.isLight && !o.isCamera);
    this.stageAway = false;
    this.root = new Group();
    view.scene.add(this.root);
    this.next();
  }

  next() {
    this.clearStep();
    this.i += 1;
    const step = this.steps[this.i];
    if (!step) return this.finish();
    const v = this.view;
    this.t = 0;
    this.fired = {};
    this.phase = 0;
    this.color = this.fx.speciesColor ? this.fx.speciesColor(step.into) : 0x9fe8ff;
    this.old = figure(v, step.from, step.star);
    this.neu = figure(v, step.into, step.star);
    const h = Math.max(this.old.height, this.neu.height);
    this.h = h;
    for (const f of [this.old, this.neu]) {
      f.holder.position.copy(CENTER);
      f.holder.rotation.y = 0.25;
      this.root.add(f.holder);
    }
    this.neu.holder.scale.setScalar(0.0001);
    this.neu.holder.visible = false;
    // Framing: the camera comes down in front of it, close enough that it
    // fills the middle of a tall screen, further for a big one.
    // Far enough that the bigger of the two fits — upright on a phone the
    // width is what runs out first.
    const cam = v.camera, half = Math.tan((cam.fov * Math.PI / 180) / 2);
    const wid = Math.max(this.old.width, this.neu.width);
    const byH = (h * 1.25 / 2) / half + 0.6, byW = (wid * 1.12 / 2) / (half * Math.max(0.3, cam.aspect)) + wid * 0.25;
    this.dist = Math.min(16, Math.max(4.2, byH, byW));
    this.camTo = new Vector3(CENTER.x - 0.6, CENTER.y + h * 0.62 + 0.35, CENTER.z + this.dist);
    this.aimTo = new Vector3(CENTER.x, CENTER.y + h * 0.48, CENTER.z);
    const bottom = new Color(0x05060f), top = new Color(this.color).lerp(new Color(0x0b0e1e), 0.62);
    if (!this.dome) {
      this.dome = new Mesh(new SphereGeometry(1, 32, 16), domeMaterial(top, bottom));
      this.dome.renderOrder = -2;
      this.dome.frustumCulled = false;
      this.root.add(this.dome);
      this.floor = new Mesh(new CircleGeometry(24, 64), floorMaterial(bottom));
      this.floor.rotation.x = -Math.PI / 2;
      this.floor.position.set(CENTER.x, CENTER.y + 0.02, CENTER.z);
      this.floor.renderOrder = -1;
      this.root.add(this.floor);
      this.ring = new Mesh(new RingGeometry(0.75, 0.9, 64), new ShaderMaterial({
        uniforms: { uC: { value: new Color(this.color) }, uOp: { value: 0 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uOp; varying vec2 vU; void main(){ gl_FragColor = vec4(uC + 0.4, uOp); }',
        transparent: true, depthWrite: false, blending: AdditiveBlending,
      }));
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.set(CENTER.x, CENTER.y + 0.08, CENTER.z);
      this.root.add(this.ring);
    } else {
      this.dome.material.uniforms.uTop.value.copy(top);
      this.ring.material.uniforms.uC.value.set(this.color);
    }
    this.floor.material.uniforms.uGlow.value.set(this.color).lerp(WHITE, 0.5);
    this.makeMotes();
    this.light = v.lightFor(this, 0xffffff, 0, 9);
  }

  makeMotes() {
    this.motes && (this.root.remove(this.motes), this.motes.geometry.dispose(), this.motes.material.dispose());
    const n = QUALITY.tier === 'low' ? 46 : 90;
    const pos = new Float32Array(n * 3);
    this.bits = [];
    for (let k = 0; k < n; k++) this.bits.push(this.newBit(true));
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.motes = new Points(g, new PointsMaterial({
      color: new Color(this.color).lerp(WHITE, 0.55), size: 0.075, transparent: true, opacity: 0,
      blending: AdditiveBlending, depthWrite: false,
    }));
    this.motes.frustumCulled = false;
    this.root.add(this.motes);
  }

  newBit(spread) {
    return {
      a: Math.random() * Math.PI * 2,
      r: 1.4 + Math.random() * 1.6,
      y: (spread ? Math.random() : 0) * this.h * 1.1,
      w: 0.9 + Math.random() * 1.4,
      in: 0.35 + Math.random() * 0.5,
      out: null,
    };
  }

  /** A tap: through the flicker to the flash, or past the reveal to the end. */
  skip() {
    if (this.over) return;
    if (this.t < EVOLVE_T.burst - 0.05) this.t = EVOLVE_T.burst - 0.05, this.phase = Math.PI;
    else if (this.t > EVOLVE_T.burst + 0.7) this.t = EVOLVE_T.end;
  }

  step(dt, tMs) {
    if (this.over) return;
    const v = this.view, T = EVOLVE_T;
    this.t += dt;
    const t = this.t;
    // the fight stays out of the picture, whatever it syncs in meanwhile
    for (const a of v.actors.values()) a.holder.visible = false;

    // the stage goes dark around it
    const dark = smooth(0, T.gather, t) * (this.i === 0 ? 1 : 1);
    // once it is dark enough not to be seen going
    if (!this.stageAway && dark > 0.97) {
      this.stageAway = true;
      for (const o of this.hidden) o.visible = false;
    }
    this.dome.position.copy(v.camera.position);
    this.dome.scale.setScalar(this.dist + 6);
    const du = this.dome.material.uniforms;
    du.uOp.value = dark * 0.98;
    du.uTime.value += dt;
    this.floor.material.uniforms.uOp.value = dark;
    // and lights up again on the new one
    const relight = smooth(T.burst, T.burst + 0.9, t) * 0.55;
    v.lights.sun.intensity = this.lightBase.sun * (1 - 0.7 * dark + relight);
    v.lights.hemi.intensity = this.lightBase.hemi * (1 - 0.55 * dark + relight * 0.8);

    // the camera comes to it, and drifts
    const c = smooth(0, 1.3, t);
    const sway = Math.sin(t * 0.32) * 0.5;
    v1.copy(this.camTo).add(new Vector3(sway, 0, 0));
    v.camera.position.lerpVectors(this.camFrom, v1, c);
    v.camAim.lerpVectors(this.aimFrom, this.aimTo, c);
    if (v.shake > 0) {
      v.shake = Math.max(0, v.shake - dt * 2.4);
      v.camera.position.x += (Math.random() - 0.5) * v.shake * 1.6;
      v.camera.position.y += (Math.random() - 0.5) * v.shake;
    }
    v.camera.lookAt(v.camAim);

    // light
    const w = smooth(T.gather * 0.6, T.glow, t);
    const burst = t >= T.burst;
    if (!this.fired.charge && t >= T.gather * 0.7) this.fired.charge = true, this.hooks.charge?.(this.steps[this.i]);
    this.light && v.owns(this, this.light) && (this.light.position.set(CENTER.x, CENTER.y + this.h + 1.2, CENTER.z + 1.6),
      this.light.intensity = burst ? Math.max(1.4, 9 * (1 - (t - T.burst) / 0.6)) : 0.8 + w * 3.2);

    const ru = this.ring.material.uniforms;
    this.floor.material.uniforms.uG.value = burst ? Math.max(0.5, 1.6 - (t - T.burst) * 1.2) : 0.25 + w * 0.75;
    this.ring.rotation.z += dt * (0.6 + w * 2.4);
    if (!burst) {
      // the flicker: what it was and what it will be trade places, slowly at
      // first and then too fast to follow
      const u = Math.max(0, (t - T.glow) / (T.burst - T.glow));
      const hz = t < T.glow ? 0 : 0.7 + 7.5 * u * u;
      this.phase += dt * hz * Math.PI * 2;
      const s = t < T.glow ? 1 : 0.5 + 0.5 * Math.cos(this.phase);
      whiten(this.old, w);
      whiten(this.neu, 1);
      this.old.holder.scale.setScalar(0.12 + 0.88 * s);
      this.neu.holder.visible = t >= T.glow;
      this.neu.holder.scale.setScalar(t >= T.glow ? 0.12 + 0.88 * (1 - s) : 0.0001);
      const lift = Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5) * 0.25;
      this.old.holder.position.y = this.neu.holder.position.y = CENTER.y + lift;
      this.old.holder.rotation.y = this.neu.holder.rotation.y = 0.25 + u * u * 6;
      ru.uOp.value = w * (0.35 + 0.25 * Math.sin(t * 6));
      this.ring.scale.setScalar(1 + u * 0.4 + this.h * 0.3);
      animateCreature(this.old.group, tMs, false, 1);
      this.neu.holder.visible && animateCreature(this.neu.group, tMs, false, 1);
    } else {
      if (!this.fired.burst) this.doBurst();
      const k = t - T.burst;
      // it stands there, the light running off it
      const back = 1 - smooth(0.05, 1.1, k);
      whiten(this.neu, back);
      const pop = 1 + 0.16 * Math.exp(-k * 4) * Math.sin(k * 16);
      this.neu.holder.scale.setScalar(pop);
      this.neu.holder.position.y = CENTER.y + Math.max(0, 0.25 - k * 0.7);
      this.neu.holder.rotation.y += dt * 1.6 * Math.exp(-k * 1.6);
      ru.uOp.value = Math.max(0, 0.6 - k * 0.5);
      this.ring.scale.setScalar(1 + this.h * 0.3 + k * 2);
      animateCreature(this.neu.group, tMs, false, 1.2);
    }
    this.stepMotes(dt, w, burst ? t - T.burst : -1);
    if (t >= T.end) this.next();
  }

  doBurst() {
    const v = this.view;
    this.fired.burst = true;
    this.old.holder.visible = false;
    this.neu.holder.visible = true;
    this.neu.holder.rotation.y = 0.2 - Math.PI * 2;
    v1.copy(CENTER).setY(CENTER.y + this.h * 0.5);
    const fx = this.fx.fxFor ? this.fx.fxFor('lumen') : null;
    v.flashVignette?.(0xffffff, 0.85, 0.9);
    fx && v.shockRing?.(v1.clone(), this.color, fx, true);
    fx && v.shardBurst?.(v1.clone(), this.color, fx, 1.7);
    v.puff?.(v1.clone(), 0xffffff, QUALITY.tier === 'low' ? 18 : 34);
    v.shake = Math.max(v.shake || 0, 0.5);
    for (const b of this.bits) b.out = { vx: Math.cos(b.a) * (2 + Math.random() * 3), vy: 1 + Math.random() * 3, vz: Math.sin(b.a) * (2 + Math.random() * 3) };
    this.hooks.burst?.(this.steps[this.i]);
  }

  stepMotes(dt, w, after) {
    const p = this.motes.geometry.attributes.position.array;
    const h = this.h;
    this.motes.material.opacity = after < 0 ? w * 0.95 : Math.max(0, 0.95 - after * 0.8);
    for (let k = 0; k < this.bits.length; k++) {
      const b = this.bits[k];
      if (after >= 0 && b.out) {
        b.x = (b.x ?? CENTER.x) + b.out.vx * dt; b.yy = (b.yy ?? CENTER.y + b.y) + b.out.vy * dt; b.z = (b.z ?? CENTER.z) + b.out.vz * dt;
        b.out.vy -= dt * 2.2;
        p[k * 3] = b.x; p[k * 3 + 1] = b.yy; p[k * 3 + 2] = b.z;
        continue;
      }
      // in towards it on a spiral, rising, and round again
      b.a += dt * b.w * (1 + w * 1.5);
      b.r -= dt * b.in * (0.4 + w * 1.6);
      b.y += dt * (0.25 + w * 0.5);
      if (b.r < 0.25 || b.y > h * 1.3) Object.assign(b, this.newBit(false));
      p[k * 3] = b.x = CENTER.x + Math.cos(b.a) * b.r;
      p[k * 3 + 1] = b.yy = CENTER.y + b.y;
      p[k * 3 + 2] = b.z = CENTER.z + Math.sin(b.a) * b.r;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
  }

  clearStep() {
    for (const f of [this.old, this.neu]) if (f) this.root.remove(f.holder);
    this.old = this.neu = null;
  }

  finish() {
    if (this.over) return;
    this.over = true;
    const v = this.view;
    this.clearStep();
    v.freeLight(this, this.light);
    v.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    v.lights.sun.intensity = this.lightBase.sun;
    v.lights.hemi.intensity = this.lightBase.hemi;
    for (const o of this.hidden) o.visible = true;
    for (const a of v.actors.values()) a.holder.visible = true;
    v.ceremony = null;
    this.hooks.done?.();
  }
}
